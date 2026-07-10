import { prisma } from '@/lib/prisma';
import {
  notificationService,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
} from '@/lib/notification-service';
import { translateRecord } from '@/lib/translation-service';

/**
 * Phase 1: Operational Plan -> Engagement auto-generation.
 *
 * When an Operational (annual) Audit Plan is approved, each planned audit item
 * is converted into a concrete AuditEngagement so the team can run the
 * engagement lifecycle (fieldwork, findings, report) against it.
 *
 * The conversion is idempotent: items already linked to an engagement
 * (item.engagementId set) are skipped, so re-approving a plan never creates
 * duplicate engagements.
 */

// Map a residual risk level to an engagement priority.
function riskLevelToPriority(level?: string | null): string {
  if (!level) return 'Medium';
  const l = level.toLowerCase();
  if (l === 'extreme' || l === 'critical' || l === 'high') return 'High';
  if (l === 'low' || l === 'minimal') return 'Low';
  return 'Medium';
}

// Derive planned start/end dates from a plan year + quarter (best-effort schedule).
function quarterToDates(year: number, quarter?: string | null): { start: Date | null; end: Date | null } {
  if (!quarter) return { start: null, end: null };
  const q = quarter.toUpperCase().trim();
  const map: Record<string, [number, number, number, number]> = {
    Q1: [0, 1, 2, 31],
    Q2: [3, 1, 5, 30],
    Q3: [6, 1, 8, 30],
    Q4: [9, 1, 11, 31],
  };
  const range = map[q];
  if (!range) return { start: null, end: null };
  const [sm, sd, em, ed] = range;
  return { start: new Date(year, sm, sd), end: new Date(year, em, ed) };
}

// Compute the next AUD### base number for a tenant from existing engagements.
function nextAuditNumber(existingAuditIds: { auditId: string }[]): number {
  let max = 0;
  for (const e of existingAuditIds) {
    const match = e.auditId.match(/^AUD(\d+)/) || e.auditId.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return max + 1;
}

export interface GenerateEngagementsResult {
  created: number;
  engagementIds: string[];
}

/**
 * Generate engagements for every not-yet-converted item of an operational plan.
 * Returns the count and ids of engagements created.
 */
export async function generateEngagementsFromOperationalPlan(
  planId: string,
  actor: { id: string; name?: string | null }
): Promise<GenerateEngagementsResult> {
  const plan = await prisma.auditOperationalPlan.findUnique({
    where: { id: planId },
    include: { items: true },
  });

  if (!plan) {
    return { created: 0, engagementIds: [] };
  }

  // Only convert items that have not already produced an engagement (idempotency).
  const pendingItems = plan.items.filter((item) => !item.engagementId);
  if (pendingItems.length === 0) {
    return { created: 0, engagementIds: [] };
  }

  const existingAuditIds = await prisma.auditEngagement.findMany({
    where: { customerAccountId: plan.customerAccountId },
    select: { auditId: true },
  });
  let nextNumber = nextAuditNumber(existingAuditIds);

  const createdEngagementIds: string[] = [];

  for (const item of pendingItems) {
    const auditId = `AUD${String(nextNumber).padStart(3, '0')}`;
    nextNumber += 1;

    const { start, end } = quarterToDates(plan.year, item.plannedQuarter);

    // Create the engagement and link the plan item back to it atomically so a
    // mid-loop failure cannot leave an engagement without its idempotency link.
    const engagement = await prisma.$transaction(async (tx) => {
      const created = await tx.auditEngagement.create({
        data: {
          auditId,
          engagementTitle: item.title,
          departmentId: item.departmentId || null,
          auditableEntityId: item.auditableEntityId || null,
          auditType: item.auditType || 'Internal Audit',
          assignedAuditorId: item.assignedAuditorId || null,
          priority: riskLevelToPriority(item.riskLevel),
          status: 'Planned',
          year: plan.year,
          quarter: item.plannedQuarter || null,
          plannedStartDate: start,
          plannedEndDate: end,
          startDate: start,
          endDate: end,
          customerAccountId: plan.customerAccountId,
          auditHeadId: plan.auditHeadId || null,
        },
      });

      await tx.auditOperationalPlanItem.update({
        where: { id: item.id },
        data: { engagementId: created.id },
      });

      // Link the source risk to the engagement when present.
      if (item.riskId) {
        await tx.internalAuditRisk.update({
          where: { id: item.riskId },
          data: { engagementId: created.id },
        }).catch(() => {
          // Risk may not exist / already linked elsewhere — non-fatal.
        });
      }

      return created;
    });

    createdEngagementIds.push(engagement.id);

    // Best-effort side effects (translations + notifications) outside the txn.
    void translateRecord(plan.customerAccountId, 'AuditEngagement', engagement.id, {
      engagementTitle: engagement.engagementTitle,
    });

    if (plan.auditHeadId && plan.auditHeadId !== actor.id) {
      void notificationService.send({
        customerAccountId: plan.customerAccountId,
        actorId: actor.id,
        recipientId: plan.auditHeadId,
        event: NOTIFICATION_EVENTS.AUDIT_CREATED,
        title: 'Audit Engagement Auto-Created',
        message: `Engagement "${engagement.engagementTitle}" was generated from the approved ${plan.year} operational plan.`,
        relatedEntityType: 'audit',
        relatedEntityId: engagement.id,
        link: `/internal-audit/fieldwork/${engagement.id}`,
        metadata: {
          entityName: engagement.engagementTitle,
          auditId: engagement.auditId,
          engagementTitle: engagement.engagementTitle,
          source: 'operational-plan',
          createdBy: actor.name || 'System',
        },
        channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
      });
    }

    if (item.assignedAuditorId && item.assignedAuditorId !== actor.id) {
      void notificationService.notifyEngagementAssigned({
        customerAccountId: plan.customerAccountId,
        actorId: actor.id,
        assigneeId: item.assignedAuditorId,
        engagementId: engagement.id,
        engagementCode: engagement.auditId,
        engagementName: engagement.engagementTitle,
        role: 'Auditor',
        channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
      });
    }
  }

  return { created: createdEngagementIds.length, engagementIds: createdEngagementIds };
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { notificationService, NOTIFICATION_CHANNELS } from '@/lib/notification-service';
import { startCronRun, finishCronRun } from '@/lib/cron-logger';

/**
 * Due Date Reminder Cron Job API
 *
 * This endpoint sends due date reminder notifications for:
 * 1. Evidence due tomorrow (EVIDENCE_DUE_REMINDER)
 * 2. CAPA/Findings due tomorrow (CAPA_DUE_REMINDER)
 * 3. Policy reviews due tomorrow (REVIEW_DUE_REMINDER)
 *
 * Should be called daily by a cron job (e.g., Vercel Cron, external scheduler)
 *
 * Security: Protected by CRON_SECRET environment variable (optional for dev)
 */

// Track errors but don't fail the entire batch
interface ReminderError {
  entityType: string;
  entityId: string;
  error: string;
}

export async function GET(req: NextRequest) {
  // Verify cron secret if set
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Calculate date range: today to tomorrow (end of day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  const counts = {
    evidence: 0,
    capa: 0,
    review: 0,
    tprmRemediation: 0,
    tprmContract: 0,
    tprmAssessment: 0,
    tprmSme: 0,
  };

  const errors: ReminderError[] = [];
  const triggeredBy = req.headers.get('x-triggered-by') === 'manual' ? 'manual' : 'schedule';
  const runId = await startCronRun({ taskFunction: 'due-reminders', name: 'Due Date Reminders', schedule: '0 8 * * *', triggeredBy });

  console.log('[DueReminders] Starting due date reminder processing...');
  console.log(`[DueReminders] Date range: ${today.toISOString()} to ${tomorrow.toISOString()}`);

  try {
    // ========== 1. EVIDENCE DUE REMINDERS ==========
    // Find evidence due tomorrow that is not yet approved
    const evidencesDueSoon = await prisma.evidence.findMany({
      where: {
        dueDate: {
          gte: today,
          lte: tomorrow,
        },
        status: { not: 'Approved' },
        assigneeId: { not: null },
      },
      select: {
        id: true,
        customerAccountId: true,
        assigneeId: true,
        name: true,
        evidenceCode: true,
        dueDate: true,
        control: {
          select: { controlCode: true },
        },
      },
    });

    console.log(`[DueReminders] Found ${evidencesDueSoon.length} evidence items due soon`);

    for (const evidence of evidencesDueSoon) {
      if (!evidence.assigneeId || !evidence.dueDate) continue;

      try {
        await notificationService.notifyDueReminder({
          customerAccountId: evidence.customerAccountId,
          recipientId: evidence.assigneeId,
          entityType: 'evidence',
          entityId: evidence.id,
          entityName: evidence.control?.controlCode
            ? `${evidence.control.controlCode}: ${evidence.name}`
            : evidence.name,
          dueDate: evidence.dueDate,
          link: `/compliance/evidence/${evidence.id}`,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
        counts.evidence++;
      } catch (error) {
        console.error(`[DueReminders] Failed to send evidence reminder for ${evidence.id}:`, error);
        errors.push({
          entityType: 'evidence',
          entityId: evidence.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========== 2. CAPA/FINDING DUE REMINDERS ==========
    // Find findings with target dates due tomorrow that are not yet closed
    const findingsDueSoon = await prisma.internalAuditFinding.findMany({
      where: {
        targetDate: {
          gte: today,
          lte: tomorrow,
        },
        status: { notIn: ['Closed', 'Verified'] },
      },
      select: {
        id: true,
        customerAccountId: true,
        findingId: true,
        finding: true,
        targetDate: true,
        responsiblePersonId: true,
        engagement: {
          select: {
            auditeeId: true,
            customerAccountId: true,
          },
        },
      },
    });

    console.log(`[DueReminders] Found ${findingsDueSoon.length} findings/CAPAs due soon`);

    for (const finding of findingsDueSoon) {
      // Use responsiblePersonId if set, otherwise fall back to auditee
      const recipientId = finding.responsiblePersonId || finding.engagement?.auditeeId;
      const customerAccountId = finding.customerAccountId || finding.engagement?.customerAccountId;

      if (!recipientId || !customerAccountId || !finding.targetDate) continue;

      try {
        await notificationService.notifyDueReminder({
          customerAccountId,
          recipientId,
          entityType: 'capa',
          entityId: finding.id,
          entityName: finding.finding || `Finding #${finding.findingId}`,
          dueDate: finding.targetDate,
          link: `/internal-audit/capa-tracking`,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
        counts.capa++;
      } catch (error) {
        console.error(`[DueReminders] Failed to send CAPA reminder for ${finding.id}:`, error);
        errors.push({
          entityType: 'capa',
          entityId: finding.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========== 3. POLICY REVIEW DUE REMINDERS ==========
    // Find policies with review dates due tomorrow that are not in draft status
    const policiesDueSoon = await prisma.policy.findMany({
      where: {
        reviewDate: {
          gte: today,
          lte: tomorrow,
        },
        status: { notIn: ['Draft', 'Not Uploaded'] },
        assigneeId: { not: null },
      },
      select: {
        id: true,
        customerAccountId: true,
        assigneeId: true,
        code: true,
        name: true,
        reviewDate: true,
      },
    });

    console.log(`[DueReminders] Found ${policiesDueSoon.length} policies due for review`);

    for (const policy of policiesDueSoon) {
      if (!policy.assigneeId || !policy.reviewDate) continue;

      try {
        await notificationService.notifyDueReminder({
          customerAccountId: policy.customerAccountId,
          recipientId: policy.assigneeId,
          entityType: 'review',
          entityId: policy.id,
          entityName: `${policy.code}: ${policy.name}`,
          dueDate: policy.reviewDate,
          link: `/compliance/governance/${policy.id}`,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
        counts.review++;
      } catch (error) {
        console.error(`[DueReminders] Failed to send policy review reminder for ${policy.id}:`, error);
        errors.push({
          entityType: 'review',
          entityId: policy.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // ========== 4. TPRM REMEDIATION OVERDUE ==========
    try {
      const overdueRemediations = await prisma.tPRMIssueRemediation.findMany({
        where: {
          dueDate: { lt: today },
          status: { notIn: ['Closed', 'Terminated', 'IT Approved'] },
        },
        select: {
          id: true,
          customerAccountId: true,
          issueCode: true,
          questionText: true,
          dueDate: true,
          assessmentId: true,
          assessment: {
            select: {
              assessmentCode: true,
              assessorId: true,
              vendor: { select: { name: true, accountManagerEmail: true } },
            },
          },
        },
      });

      console.log(`[DueReminders] Found ${overdueRemediations.length} overdue TPRM remediations`);

      for (const rem of overdueRemediations) {
        if (!rem.dueDate || !rem.customerAccountId) continue;

        try {
          const recipientIds: string[] = [];
          if (rem.assessment?.assessorId) recipientIds.push(rem.assessment.assessorId);

          // Resolve AM
          const amEmail = rem.assessment?.vendor?.accountManagerEmail?.split(';')[0]?.trim();
          if (amEmail) {
            const amUser = await prisma.user.findFirst({
              where: { customerAccountId: rem.customerAccountId, email: { equals: amEmail, mode: 'insensitive' }, isActive: true },
              select: { id: true },
            });
            if (amUser && !recipientIds.includes(amUser.id)) recipientIds.push(amUser.id);
          }

          // Add BO users
          const boUsers = await prisma.user.findMany({
            where: { customerAccountId: rem.customerAccountId, isActive: true, tprmRole: 'Business Owner' },
            select: { id: true },
            take: 5,
          });
          for (const u of boUsers) {
            if (!recipientIds.includes(u.id)) recipientIds.push(u.id);
          }

          if (recipientIds.length > 0) {
            await notificationService.notifyTPRMRemediationOverdue({
              customerAccountId: rem.customerAccountId,
              recipientIds,
              remediationId: rem.id,
              issueCode: rem.issueCode || rem.id.substring(0, 8),
              vendorName: rem.assessment?.vendor?.name || '',
              questionTitle: rem.questionText || '',
              dueDate: rem.dueDate.toISOString().split('T')[0],
            });
            counts.tprmRemediation++;
          }
        } catch (error) {
          errors.push({ entityType: 'tprm-remediation', entityId: rem.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    } catch (error) {
      console.error('[DueReminders] TPRM remediation overdue check failed:', error);
    }

    // ========== 5. TPRM CONTRACT EXPIRY REMINDERS ==========
    try {
      const expiringVendors = await prisma.tPRMVendor.findMany({
        where: {
          contractEndDate: { gte: today, lte: tomorrow },
          status: { notIn: ['Offboarded', 'Inactive'] },
        },
        select: {
          id: true,
          customerAccountId: true,
          name: true,
          contractEndDate: true,
          accountManagerEmail: true,
        },
      });

      console.log(`[DueReminders] Found ${expiringVendors.length} vendors with expiring contracts`);

      for (const vendor of expiringVendors) {
        if (!vendor.contractEndDate || !vendor.customerAccountId) continue;

        try {
          const recipientIds: string[] = [];

          // Resolve AM
          const amEmail = vendor.accountManagerEmail?.split(';')[0]?.trim();
          if (amEmail) {
            const amUser = await prisma.user.findFirst({
              where: { customerAccountId: vendor.customerAccountId, email: { equals: amEmail, mode: 'insensitive' }, isActive: true },
              select: { id: true },
            });
            if (amUser) recipientIds.push(amUser.id);
          }

          // Add BO users
          const boUsers = await prisma.user.findMany({
            where: { customerAccountId: vendor.customerAccountId, isActive: true, tprmRole: 'Business Owner' },
            select: { id: true },
            take: 5,
          });
          for (const u of boUsers) {
            if (!recipientIds.includes(u.id)) recipientIds.push(u.id);
          }

          if (recipientIds.length > 0) {
            await notificationService.notifyTPRMContractExpiry({
              customerAccountId: vendor.customerAccountId,
              recipientIds,
              vendorId: vendor.id,
              vendorName: vendor.name,
              expiryDate: vendor.contractEndDate.toISOString().split('T')[0],
            });
            counts.tprmContract++;
          }
        } catch (error) {
          errors.push({ entityType: 'tprm-contract', entityId: vendor.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    } catch (error) {
      console.error('[DueReminders] TPRM contract expiry check failed:', error);
    }

    // ========== 6. TPRM ASSESSMENT DUE REMINDERS ==========
    try {
      const dueSoonAssessments = await prisma.tPRMAssessment.findMany({
        where: {
          dueDate: { gte: today, lte: tomorrow },
          status: { notIn: ['Reviewed', 'Approved', 'Completed', 'Closed', 'Offboard_Completed'] },
        },
        select: {
          id: true,
          customerAccountId: true,
          assessmentCode: true,
          assessorId: true,
          dueDate: true,
          vendor: { select: { name: true, accountManagerEmail: true } },
        },
      });

      console.log(`[DueReminders] Found ${dueSoonAssessments.length} TPRM assessments due soon`);

      for (const assessment of dueSoonAssessments) {
        if (!assessment.dueDate || !assessment.customerAccountId) continue;

        try {
          const recipientIds: string[] = [];
          if (assessment.assessorId) recipientIds.push(assessment.assessorId);

          const amEmail = assessment.vendor?.accountManagerEmail?.split(';')[0]?.trim();
          if (amEmail) {
            const amUser = await prisma.user.findFirst({
              where: { customerAccountId: assessment.customerAccountId, email: { equals: amEmail, mode: 'insensitive' }, isActive: true },
              select: { id: true },
            });
            if (amUser && !recipientIds.includes(amUser.id)) recipientIds.push(amUser.id);
          }

          if (recipientIds.length > 0) {
            await notificationService.notifyTPRMAssessmentDueReminder({
              customerAccountId: assessment.customerAccountId,
              recipientIds,
              assessmentId: assessment.id,
              assessmentCode: assessment.assessmentCode || '',
              vendorName: assessment.vendor?.name || '',
              dueDate: assessment.dueDate.toISOString().split('T')[0],
            });
            counts.tprmAssessment++;
          }
        } catch (error) {
          errors.push({ entityType: 'tprm-assessment', entityId: assessment.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    } catch (error) {
      console.error('[DueReminders] TPRM assessment due check failed:', error);
    }

    // ========== 7. TPRM SME ASSIGNMENT PENDING ==========
    try {
      // Find delegated questions that haven't been responded to
      const pendingSMEResponses = await prisma.tPRMAssessmentResponse.findMany({
        where: {
          isDelegated: true,
          delegatedToId: { not: null },
          response: null,
          assessment: {
            status: { notIn: ['Reviewed', 'Approved', 'Completed', 'Closed'] },
          },
        },
        select: {
          id: true,
          assessmentId: true,
          delegatedToId: true,
          assessment: {
            select: { customerAccountId: true, assessmentCode: true },
          },
        },
        take: 100,
      });

      console.log(`[DueReminders] Found ${pendingSMEResponses.length} pending SME assignments`);

      for (const resp of pendingSMEResponses) {
        if (!resp.delegatedToId || !resp.assessment?.customerAccountId) continue;

        try {
          await notificationService.notifyTPRMSMEAssignmentPending({
            customerAccountId: resp.assessment.customerAccountId,
            // Cron-triggered reminder: no real actor; sentinel keeps
            // the self-notification guard satisfied.
            actorId: 'system',
            recipientId: resp.delegatedToId!,
            assessmentId: resp.assessmentId,
            assessmentCode: resp.assessment.assessmentCode || '',
          });
          counts.tprmSme++;
        } catch (error) {
          errors.push({ entityType: 'tprm-sme', entityId: resp.id, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    } catch (error) {
      console.error('[DueReminders] TPRM SME pending check failed:', error);
    }

    console.log('[DueReminders] Processing complete:', counts);
    if (errors.length > 0) {
      console.warn(`[DueReminders] Encountered ${errors.length} errors during processing`);
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    await finishCronRun(runId, 'Completed', { counts, errorCount: errors.length },
      `Sent ${total} reminder(s): evidence=${counts.evidence}, capa=${counts.capa}, review=${counts.review}, tprmAssessment=${counts.tprmAssessment}, tprmRemediation=${counts.tprmRemediation}, tprmContract=${counts.tprmContract}, sme=${counts.tprmSme}`);

    return NextResponse.json({
      success: true,
      message: 'Due date reminders sent',
      counts,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[DueReminders] Critical error during processing:', error);
    await finishCronRun(runId, 'Failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({
      success: false,
      error: 'Failed to process due date reminders',
      message: error instanceof Error ? error.message : 'Unknown error',
      counts,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 500 });
  }
}

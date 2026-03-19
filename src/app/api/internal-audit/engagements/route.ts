import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId, getTenantFilter, getAuditHeadId } from '@/lib/api-auth';
import { notificationService, NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from '@/lib/notification-service';
import { translateRecord } from '@/lib/translation-service';

// GET /api/internal-audit/engagements - Get all audit engagements
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const url = new URL(req.url);
      const departmentId = url.searchParams.get('departmentId');
      const status = url.searchParams.get('status');
      const year = url.searchParams.get('year');
      const search = url.searchParams.get('search');

      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const whereClause: Record<string, unknown> = {
        ...tenantFilter,
        ...(auditHeadId ? { auditHeadId } : {}),
      };
      const andConditions: Record<string, unknown>[] = [];

      // Check if user is an Auditee (and not also an Audit Head or other audit role)
      const userRoles = session.roles || [];
      const isAuditee = userRoles.includes('Auditee');
      const isAuditHead = userRoles.includes('AuditHead');
      const isAuditor = userRoles.includes('Auditor');
      const hasAuditRole = isAuditHead || isAuditor;

      // If user is only an Auditee, filter to show engagements assigned to them
      if (isAuditee && !hasAuditRole) {
        const userId = session.id;
        console.log('[ENGAGEMENTS API] Auditee user filtering - userId:', userId);

        // Find engagements where this user has evidence requests assigned
        const engagementsWithUserRequests = await prisma.fieldworkEvidenceRequest.findMany({
          where: {
            auditeeId: userId,
          },
          select: {
            engagementId: true,
          },
          distinct: ['engagementId'],
        });

        const evidenceEngagementIds = engagementsWithUserRequests.map(er => er.engagementId);

        // Also include engagements where this user is the assigned auditee at engagement level
        const directlyAssignedEngagements = await prisma.auditEngagement.findMany({
          where: {
            ...tenantFilter,
            auditeeId: userId,
          },
          select: { id: true },
        });

        const directEngagementIds = directlyAssignedEngagements.map(e => e.id);

        // Combine both sets of engagement IDs (deduplicated)
        const allEngagementIds = [...new Set([...evidenceEngagementIds, ...directEngagementIds])];

        console.log('[ENGAGEMENTS API] Auditee engagements - evidence:', evidenceEngagementIds.length, 'direct:', directEngagementIds.length, 'total:', allEngagementIds.length);

        if (allEngagementIds.length === 0) {
          console.log('[ENGAGEMENTS API] No engagements found for auditee');
          return NextResponse.json([]);
        }

        whereClause.id = { in: allEngagementIds };
      }

      if (departmentId && departmentId !== 'all') {
        whereClause.departmentId = departmentId;
      }

      if (status && status !== 'all') {
        whereClause.status = status;
      }

      if (year && year !== 'all') {
        const yearNum = parseInt(year);
        andConditions.push({
          OR: [
            { startDate: { gte: new Date(`${yearNum}-01-01`), lte: new Date(`${yearNum}-12-31`) } },
            { endDate: { gte: new Date(`${yearNum}-01-01`), lte: new Date(`${yearNum}-12-31`) } }
          ]
        });
      }

      if (search) {
        andConditions.push({
          OR: [
            { auditId: { contains: search, mode: 'insensitive' } },
            { engagementTitle: { contains: search, mode: 'insensitive' } }
          ]
        });
      }

      if (andConditions.length > 0) {
        whereClause.AND = andConditions;
      }

      const engagements = await prisma.auditEngagement.findMany({
        where: whereClause,
        include: {
          department: {
            select: { id: true, name: true }
          },
          assignedAuditor: {
            select: { id: true, fullName: true, firstName: true, lastName: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Map engagements with assigned auditors
      const engagementsWithAuditors = engagements.map((engagement) => {
        const auditors: string[] = [];

        // Add the main assigned auditor if present
        if (engagement.assignedAuditor) {
          auditors.push(engagement.assignedAuditor.fullName ||
            `${engagement.assignedAuditor.firstName} ${engagement.assignedAuditor.lastName}`);
        }

        return {
          ...engagement,
          assignedAuditors: auditors
        };
      });

      return NextResponse.json(engagementsWithAuditors);
    } catch (error) {
      console.error('Error fetching engagements:', error);
      return NextResponse.json(
        { error: 'Failed to fetch engagements' },
        { status: 500 }
      );
    }
  },
  // Use audit.fieldwork:view to allow auditees to list engagements they have evidence requests in
  { resource: 'audit.fieldwork', action: 'view' }
);

// Helper: create a single engagement and send notifications
async function createSingleEngagement(
  params: {
    auditId: string;
    engagementTitle: string;
    engagementObjective?: string;
    engagementScope?: string;
    departmentId?: string;
    auditRating?: string;
    auditType?: string;
    auditorId?: string;
    auditeeId?: string;
    processId?: string;
    startDate?: string;
    targetDate?: string;
    initialObservation?: string;
    relatedPolicies?: string;
    plannedHours?: number;
    linkedRiskIds?: string[];
    teamMemberIds?: string[];
    customerAccountId: string;
    auditHeadId: string | null;
  },
  session: { id: string; name?: string | null }
) {
  const {
    auditId, engagementTitle, engagementObjective, engagementScope,
    departmentId, auditRating, auditType, auditorId, auditeeId,
    processId, startDate, targetDate, initialObservation, relatedPolicies,
    plannedHours, linkedRiskIds, teamMemberIds, customerAccountId, auditHeadId,
  } = params;

  const engagement = await prisma.auditEngagement.create({
    data: {
      auditId,
      engagementTitle,
      engagementObjective: engagementObjective || null,
      engagementScope: engagementScope || null,
      departmentId: (departmentId && departmentId.trim()) ? departmentId : null,
      auditRating: auditRating || null,
      auditType: auditType || 'Internal Audit',
      assignedAuditorId: (auditorId && auditorId.trim()) ? auditorId : null,
      auditeeId: (auditeeId && auditeeId.trim()) ? auditeeId : null,
      processId: (processId && processId.trim()) ? processId : null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: targetDate ? new Date(targetDate) : null,
      plannedStartDate: startDate ? new Date(startDate) : null,
      plannedEndDate: targetDate ? new Date(targetDate) : null,
      initialObservation: initialObservation || null,
      relatedPolicies: relatedPolicies || null,
      plannedHours: plannedHours || 0,
      actualHours: 0,
      status: 'Planned',
      customerAccountId,
      auditHeadId: auditHeadId || null,
      ...(teamMemberIds && teamMemberIds.length > 0 ? {
        teamMembers: { connect: teamMemberIds.map(id => ({ id })) }
      } : {}),
    },
    include: {
      department: { select: { id: true, name: true } }
    }
  });

  void translateRecord(customerAccountId, 'AuditEngagement', engagement.id, {
    engagementTitle: engagement.engagementTitle,
    engagementObjective: engagement.engagementObjective,
    engagementScope: engagement.engagementScope,
    initialObservation: engagement.initialObservation,
    relatedPolicies: engagement.relatedPolicies,
  });

  // Link risks to engagement if provided
  if (linkedRiskIds && linkedRiskIds.length > 0) {
    for (const riskId of linkedRiskIds) {
      await prisma.internalAuditRisk.update({
        where: { id: riskId },
        data: { engagementId: engagement.id }
      });
    }
  }

  // Send AUDIT_CREATED notification to the Audit Head
  if (auditHeadId && auditHeadId !== session.id) {
    await notificationService.send({
      customerAccountId,
      actorId: session.id,
      recipientId: auditHeadId,
      event: NOTIFICATION_EVENTS.AUDIT_CREATED,
      title: 'New Audit Engagement Created',
      message: `A new audit engagement "${engagement.engagementTitle || engagement.auditId}" has been created.`,
      relatedEntityType: 'audit',
      relatedEntityId: engagement.id,
      link: `/internal-audit/fieldwork/${engagement.id}`,
      metadata: {
        entityName: engagement.engagementTitle || engagement.auditId,
        auditName: engagement.engagementTitle,
        auditId: engagement.auditId,
        engagementTitle: engagement.engagementTitle,
        auditType: engagement.auditType,
        createdBy: session.name || 'User',
      },
      channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
    });
  }

  // Notify assigned auditor
  if (auditorId && auditorId !== session.id) {
    await notificationService.notifyEngagementAssigned({
      customerAccountId,
      actorId: session.id,
      assigneeId: auditorId,
      engagementId: engagement.id,
      engagementCode: engagement.auditId,
      engagementName: engagement.engagementTitle || engagement.auditId,
      role: 'Auditor',
      channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
    });
  }

  // Notify assigned auditee
  if (auditeeId && auditeeId !== session.id && auditeeId !== auditorId) {
    await notificationService.notifyEngagementAssigned({
      customerAccountId,
      actorId: session.id,
      assigneeId: auditeeId,
      engagementId: engagement.id,
      engagementCode: engagement.auditId,
      engagementName: engagement.engagementTitle || engagement.auditId,
      role: 'Auditee',
      channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
    });
  }

  // Notify additional team members
  if (teamMemberIds && teamMemberIds.length > 0) {
    for (const memberId of teamMemberIds) {
      if (memberId !== session.id && memberId !== auditorId && memberId !== auditeeId) {
        await notificationService.notifyEngagementAssigned({
          customerAccountId,
          actorId: session.id,
          assigneeId: memberId,
          engagementId: engagement.id,
          engagementCode: engagement.auditId,
          engagementName: engagement.engagementTitle || engagement.auditId,
          role: 'Team Member',
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }
    }
  }

  return engagement;
}

// POST /api/internal-audit/engagements - Create a new audit engagement
// Multi-tenant: Associate with customerAccountId and auditHeadId
// Supports batch mode: send { departments: [...] } to create one engagement per department
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();

      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      if (!customerAccountId) {
        return NextResponse.json(
          { error: 'Customer account not found' },
          { status: 400 }
        );
      }

      // Fetch all existing audit IDs for this tenant
      const existingEngagements = await prisma.auditEngagement.findMany({
        where: { customerAccountId },
        select: { auditId: true },
      });

      // If caller provides a baseAuditId (e.g. from edit flow adding departments to AUD012),
      // use it and find next available suffix. Otherwise generate a new base number.
      let baseAuditId: string;

      if (body.parentAuditId) {
        // Extract base from parent (e.g. "AUD012" from "AUD012" or "AUD012.1")
        const parentBase = body.parentAuditId.split('.')[0];
        baseAuditId = parentBase;
      } else {
        // Generate next base audit number
        let maxAuditNumber = 0;
        for (const eng of existingEngagements) {
          const match = eng.auditId.match(/^AUD(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxAuditNumber) maxAuditNumber = num;
          } else {
            const legacyMatch = eng.auditId.match(/(\d+)/);
            if (legacyMatch) {
              const num = parseInt(legacyMatch[1], 10);
              if (num > maxAuditNumber) maxAuditNumber = num;
            }
          }
        }
        const baseNumber = maxAuditNumber + 1;
        baseAuditId = `AUD${String(baseNumber).padStart(3, '0')}`;
      }

      // Find the max existing suffix for this base (e.g. AUD012.3 → 3)
      let maxSuffix = 0;
      for (const eng of existingEngagements) {
        const engBase = eng.auditId.split('.')[0];
        if (engBase === baseAuditId) {
          const dotParts = eng.auditId.split('.');
          if (dotParts.length > 1) {
            const suffix = parseInt(dotParts[1], 10);
            if (suffix > maxSuffix) maxSuffix = suffix;
          } else {
            // The base itself exists (e.g. "AUD012" without suffix counts as 1)
            if (maxSuffix < 1) maxSuffix = 1;
          }
        }
      }

      // Check if this is a batch request (multi-department)
      if (body.departments && Array.isArray(body.departments) && body.departments.length > 0) {
        const {
          engagementTitle, engagementObjective, engagementScope,
          auditRating, auditType, processId,
          startDate, targetDate, initialObservation, relatedPolicies,
          plannedHours, departments,
        } = body;

        const createdEngagements = [];
        // Use suffix if: multiple departments OR adding to an existing group (parentAuditId provided)
        const useSuffix = departments.length > 1 || !!body.parentAuditId;

        for (let i = 0; i < departments.length; i++) {
          const dept = departments[i];
          const suffixNum = maxSuffix + i + 1;
          const auditId = useSuffix ? `${baseAuditId}.${suffixNum}` : baseAuditId;

          // First auditor in the list is the primary assignedAuditor, rest are team members
          const primaryAuditorId = dept.auditorIds?.[0] || null;
          const teamMemberIds = dept.auditorIds?.slice(1) || [];

          // First auditee is the primary auditee
          const primaryAuditeeId = dept.auditeeIds?.[0] || null;

          const engagement = await createSingleEngagement({
            auditId,
            engagementTitle,
            engagementObjective,
            engagementScope,
            departmentId: dept.departmentId,
            auditRating,
            auditType,
            auditorId: primaryAuditorId,
            auditeeId: primaryAuditeeId,
            processId,
            startDate,
            targetDate,
            initialObservation,
            relatedPolicies,
            plannedHours,
            linkedRiskIds: dept.linkedRiskIds || [],
            teamMemberIds,
            customerAccountId,
            auditHeadId: auditHeadId || null,
          }, session);

          createdEngagements.push(engagement);
        }

        return NextResponse.json(createdEngagements, { status: 201 });
      }

      // Legacy single-department mode
      const {
        engagementTitle, engagementObjective, engagementScope,
        departmentId, linkedRiskIds, auditRating, auditType,
        auditorId, auditeeId, processId, startDate, targetDate,
        initialObservation, relatedPolicies, plannedHours,
      } = body;

      const engagement = await createSingleEngagement({
        auditId: baseAuditId,
        engagementTitle,
        engagementObjective,
        engagementScope,
        departmentId,
        auditRating,
        auditType,
        auditorId,
        auditeeId,
        processId,
        startDate,
        targetDate,
        initialObservation,
        relatedPolicies,
        plannedHours,
        linkedRiskIds,
        customerAccountId,
        auditHeadId: auditHeadId || null,
      }, session);

      return NextResponse.json(engagement, { status: 201 });
    } catch (error) {
      console.error('Error creating engagement:', error);
      return NextResponse.json(
        { error: 'Failed to create engagement' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'create' }
);

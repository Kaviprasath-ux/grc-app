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
      const isAuditManager = userRoles.includes('AuditManager');
      const isAuditor = userRoles.includes('Auditor');
      const hasAuditRole = isAuditHead || isAuditManager || isAuditor;

      // If user is only an Auditee, filter to show only engagements where they have evidence requests
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
            auditeeId: true,
            auditeeName: true,
          },
          distinct: ['engagementId'],
        });

        console.log('[ENGAGEMENTS API] Found evidence requests for auditee:', engagementsWithUserRequests);

        const engagementIds = engagementsWithUserRequests.map(er => er.engagementId);

        if (engagementIds.length === 0) {
          // No engagements for this auditee
          console.log('[ENGAGEMENTS API] No engagements found for auditee');
          return NextResponse.json([]);
        }

        whereClause.id = { in: engagementIds };
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

// POST /api/internal-audit/engagements - Create a new audit engagement
// Multi-tenant: Associate with customerAccountId and auditHeadId
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();

      const {
        engagementTitle,
        engagementObjective,
        engagementScope,
        departmentId,
        linkedRiskIds,
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
      } = body;

      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);

      if (!customerAccountId) {
        return NextResponse.json(
          { error: 'Customer account not found' },
          { status: 400 }
        );
      }

      // Generate audit ID - scoped to tenant, handles all legacy formats
      const existingEngagements = await prisma.auditEngagement.findMany({
        where: { customerAccountId },
        select: { auditId: true },
      });

      let maxAuditNumber = 0;
      for (const eng of existingEngagements) {
        // Extract trailing number from any format: AUD001, AUD-001, AUD-2025-001, 0001
        const match = eng.auditId.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxAuditNumber) maxAuditNumber = num;
        }
      }
      const auditId = `AUD${String(maxAuditNumber + 1).padStart(3, '0')}`;

      if (!customerAccountId) {
        return NextResponse.json(
          { error: 'User must belong to a customer account' },
          { status: 403 }
        );
      }

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
          initialObservation: initialObservation || null,
          relatedPolicies: relatedPolicies || null,
          plannedHours: plannedHours || 0,
          actualHours: 0,
          status: 'Planned',
          customerAccountId,
          auditHeadId: auditHeadId || null,
        },
        include: {
          department: {
            select: { id: true, name: true }
          }
        }
      });

      if (customerAccountId) void translateRecord(customerAccountId, 'AuditEngagement', engagement.id, { engagementTitle: engagement.engagementTitle, engagementObjective: engagement.engagementObjective, engagementScope: engagement.engagementScope, initialObservation: engagement.initialObservation, relatedPolicies: engagement.relatedPolicies });

      // Link risks to engagement if provided
      if (linkedRiskIds && linkedRiskIds.length > 0) {
        for (const riskId of linkedRiskIds) {
          await prisma.internalAuditRisk.update({
            where: { id: riskId },
            data: { engagementId: engagement.id }
          });
        }
      }

      // Send AUDIT_CREATED notification to the Audit Head (if exists and different from creator)
      if (auditHeadId && auditHeadId !== session.id && customerAccountId) {
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
            auditId: engagement.auditId,
            engagementTitle: engagement.engagementTitle,
            auditType: engagement.auditType,
            createdBy: session.name || 'User',
          },
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      // Notify assigned auditor if different from creator
      if (auditorId && auditorId !== session.id && customerAccountId) {
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

      // Notify assigned auditee if different from creator and auditor
      if (auditeeId && auditeeId !== session.id && auditeeId !== auditorId && customerAccountId) {
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

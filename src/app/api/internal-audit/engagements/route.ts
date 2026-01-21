import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId, getTenantFilter } from '@/lib/api-auth';

// GET /api/internal-audit/engagements - Get all audit engagements
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const url = new URL(req.url);
      const departmentId = url.searchParams.get('departmentId');
      const status = url.searchParams.get('status');
      const year = url.searchParams.get('year');
      const search = url.searchParams.get('search');

      const tenantFilter = getTenantFilter(session);
      const whereClause: Record<string, unknown> = { ...tenantFilter };
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
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Get assigned auditors for each engagement
      const engagementsWithAuditors = await Promise.all(
        engagements.map(async (engagement) => {
          const fieldworkItems = await prisma.fieldworkEvidenceRequest.findMany({
            where: { engagementId: engagement.id },
            select: {
              auditeeName: true
            },
            distinct: ['auditeeName']
          });

          const auditors = fieldworkItems
            .map(item => item.auditeeName)
            .filter(Boolean);

          return {
            ...engagement,
            assignedAuditors: auditors
          };
        })
      );

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
        startDate,
        targetDate,
        initialObservation,
        relatedPolicies,
        tasks,
        plannedHours,
      } = body;

      const customerAccountId = getCustomerAccountId(session);

      // Generate audit ID
      const count = await prisma.auditEngagement.count();
      const auditId = String(count + 1).padStart(4, '0');

      const engagement = await prisma.auditEngagement.create({
        data: {
          auditId,
          engagementTitle,
          engagementObjective: engagementObjective || null,
          engagementScope: engagementScope || null,
          departmentId: departmentId || null,
          auditRating: auditRating || null,
          auditType: auditType || 'Internal Audit',
          assignedAuditorId: auditorId || null,
          auditeeId: auditeeId || null,
          startDate: startDate ? new Date(startDate) : null,
          endDate: targetDate ? new Date(targetDate) : null,
          initialObservation: initialObservation || null,
          relatedPolicies: relatedPolicies || null,
          plannedHours: plannedHours || 0,
          actualHours: 0,
          status: 'Planned',
          customerAccountId,
        },
        include: {
          department: {
            select: { id: true, name: true }
          }
        }
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

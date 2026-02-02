import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';

// GET /api/internal-audit/report/completed-engagements - Get all completed engagements for reports
export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const skip = (page - 1) * limit;
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      // Check if user is auditee only (has Auditee role but not AuditHead/AuditManager/Auditor)
      // Note: session IS the user object (not session.user) because withAuth passes user directly
      const userRoles = session.roles || [];
      const isAuditTeam = userRoles.some((role: string) =>
        ['AuditHead', 'AuditManager', 'Auditor'].includes(role)
      );
      const isAuditee = userRoles.includes('Auditee');
      const isAuditeeOnly = isAuditee && !isAuditTeam;

      // Build where clause - use AND to combine multiple OR conditions
      // Apply auditHeadFilter to isolate data by AuditHead (reports are NOT shared between Audit Heads)
      const whereClause: Record<string, unknown> = {
        ...tenantFilter,
        ...auditHeadFilter,
        // Status filter (case-insensitive)
        OR: [
          { status: 'Completed' },
          { status: 'completed' },
          { status: 'COMPLETED' },
        ],
      };

      // For auditee-only users, filter to show only engagements assigned to them
      // via the report's auditeeId or engagement's auditeeId
      if (isAuditeeOnly && session.id) {
        whereClause.AND = [
          {
            OR: [
              { status: 'Completed' },
              { status: 'completed' },
              { status: 'COMPLETED' },
            ],
          },
          {
            OR: [
              { auditeeId: session.id },
              { report: { auditeeId: session.id } },
            ],
          },
        ];
        // Remove the top-level OR since we're using AND with nested ORs
        delete whereClause.OR;
      }

      // Get total count of completed engagements (case-insensitive check)
      const total = await prisma.auditEngagement.count({
        where: whereClause,
      });

      // Get completed engagements with relations
      const engagements = await prisma.auditEngagement.findMany({
        where: whereClause,
        include: {
          department: {
            select: { id: true, name: true },
          },
          assignedAuditor: {
            select: { id: true, firstName: true, lastName: true },
          },
          report: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      // Transform engagements for the response
      const transformedEngagements = engagements.map((engagement) => ({
        id: engagement.id,
        auditId: engagement.auditId,
        engagementTitle: engagement.engagementTitle,
        departmentName: engagement.department?.name || '-',
        auditType: engagement.auditType || 'Internal',
        assignedAuditorName: engagement.assignedAuditor
          ? `${engagement.assignedAuditor.firstName} ${engagement.assignedAuditor.lastName}`
          : '-',
        status: engagement.status,
        hasReport: !!engagement.report,
        reportId: engagement.report?.id || null,
      }));

      return NextResponse.json({
        engagements: transformedEngagements,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching completed engagements:', error);
      return NextResponse.json(
        { error: 'Failed to fetch completed engagements' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';

// GET /api/internal-audit/reports - Get audit reports
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const search = searchParams.get('search');

      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const isAuditee = session.roles.includes('Auditee') &&
                        !session.roles.includes('AuditHead') &&
                        !session.roles.includes('AuditManager') &&
                        !session.roles.includes('Auditor');

      const hasAuditRole = session.roles.includes('AuditHead') ||
                           session.roles.includes('AuditManager') ||
                           session.roles.includes('Auditor');

      const whereClause: Record<string, unknown> = { ...tenantFilter };

      // For Auditee, only show published reports assigned to them
      if (isAuditee) {
        whereClause.status = 'Published';
        whereClause.auditeeId = session.id;
      } else if (hasAuditRole) {
        // For AuditHead/AuditManager/Auditor, filter through engagement
        whereClause.engagement = auditHeadFilter;
        if (status && status !== 'all') {
          whereClause.status = status;
        }
      } else if (status && status !== 'all') {
        whereClause.status = status;
      }

      if (search) {
        whereClause.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { reportCode: { contains: search, mode: 'insensitive' } },
          { engagement: { auditId: { contains: search, mode: 'insensitive' } } },
          { engagement: { engagementTitle: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const reports = await prisma.auditReport.findMany({
        where: whereClause,
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              department: { select: { id: true, name: true } },
              assignedAuditor: {
                select: { id: true, firstName: true, lastName: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.reports', action: 'view' }
);

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/reports/[id] - Get single report
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      // Build where clause with tenant and auditHead isolation
      // Reports are NOT shared between Audit Heads
      const whereClause = {
        id,
        ...tenantFilter,
        ...auditHeadFilter,
      };

      const report = await prisma.auditReport.findFirst({
        where: whereClause,
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              description: true,
              departmentId: true,
              department: { select: { id: true, name: true } },
              assignedAuditor: {
                select: { id: true, firstName: true, lastName: true }
              },
              plannedStartDate: true,
              plannedEndDate: true,
              actualStartDate: true,
              actualEndDate: true,
              findings: {
                select: {
                  id: true,
                  findingId: true,
                  finding: true,
                  severity: true,
                  status: true,
                }
              }
            }
          }
        },
      });

      if (!report) {
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        );
      }

      // For Auditee, only allow access to published reports for their department
      const isAuditee = session.roles.includes('Auditee') &&
                        !session.roles.includes('AuditHead') &&
                        !session.roles.includes('Auditor');

      if (isAuditee) {
        if (report.status !== 'Published') {
          return NextResponse.json(
            { error: 'Report not available' },
            { status: 403 }
          );
        }
        if (session.departmentId && report.engagement.departmentId !== session.departmentId) {
          return NextResponse.json(
            { error: 'You do not have access to this report' },
            { status: 403 }
          );
        }
      }

      return NextResponse.json(report);
    } catch (error) {
      console.error('Error fetching report:', error);
      return NextResponse.json(
        { error: 'Failed to fetch report' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.reports', action: 'view' }
);

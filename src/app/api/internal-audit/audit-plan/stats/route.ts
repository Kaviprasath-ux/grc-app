import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// GET /api/internal-audit/audit-plan/stats - Get risk and finding counts for a year or date range
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const filterType = searchParams.get('filterType') || 'Year';
      const year = searchParams.get('year') || new Date().getFullYear().toString();
      const startDateParam = searchParams.get('startDate');
      const endDateParam = searchParams.get('endDate');

      let startDate: Date;
      let endDate: Date;

      if (filterType === 'DateRange' && startDateParam && endDateParam) {
        startDate = new Date(startDateParam);
        endDate = new Date(`${endDateParam}T23:59:59.999Z`);
      } else {
        startDate = new Date(`${year}-01-01`);
        endDate = new Date(`${year}-12-31T23:59:59.999Z`);
      }

      // Count risks from Risk table (main risk register) for the date range
      const riskCount = await prisma.risk.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Count findings from InternalAuditFinding for the date range
      const findingCount = await prisma.internalAuditFinding.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Get Audit Head info
      // If current user is Audit Head, use their name; otherwise find the most recent Audit Head
      let auditHeadName = '';
      const currentUserRoles = session?.roles || [];
      const isCurrentUserAuditHead = currentUserRoles.includes('AuditHead');

      if (isCurrentUserAuditHead && session?.name) {
        auditHeadName = session.name;
      } else {
        // Find the most recent user with AuditHead role
        const auditHeadRole = await prisma.role.findFirst({
          where: { name: 'AuditHead' },
        });

        if (auditHeadRole) {
          const auditHeadUser = await prisma.userRole.findFirst({
            where: { roleId: auditHeadRole.id },
            include: {
              user: {
                select: { fullName: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (auditHeadUser?.user?.fullName) {
            auditHeadName = auditHeadUser.user.fullName;
          }
        }
      }

      return NextResponse.json({
        year,
        riskCount,
        findingCount,
        auditHeadName,
      });
    } catch (error) {
      console.error('Error fetching audit plan stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stats' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'view' }
);

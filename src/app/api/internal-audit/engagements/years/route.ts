import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadId } from '@/lib/api-auth';

// GET /api/internal-audit/engagements/years - Get only years that have audit engagements
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const engagements = await prisma.auditEngagement.findMany({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        select: {
          startDate: true,
          endDate: true,
        },
      });

      const yearsSet = new Set<number>();

      engagements.forEach((engagement) => {
        // Use startDate/endDate to determine the year (matches year filter logic)
        if (engagement.startDate) {
          yearsSet.add(new Date(engagement.startDate).getFullYear());
        }
        if (engagement.endDate) {
          yearsSet.add(new Date(engagement.endDate).getFullYear());
        }
      });

      // Convert to array and sort in descending order
      const years = Array.from(yearsSet).sort((a, b) => b - a);

      return NextResponse.json(years);
    } catch (error) {
      console.error('Error fetching engagement years:', error);
      return NextResponse.json(
        { error: 'Failed to fetch engagement years' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.planning', action: 'view' }
);

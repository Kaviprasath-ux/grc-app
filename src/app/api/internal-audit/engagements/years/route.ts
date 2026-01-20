import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

// GET /api/internal-audit/engagements/years - Get all years that have audit engagements
export const GET = withAuth(
  async () => {
    try {
      const engagements = await prisma.auditEngagement.findMany({
        select: {
          startDate: true,
          endDate: true,
          plannedStartDate: true,
          plannedEndDate: true,
          createdAt: true,
        },
      });

      const yearsSet = new Set<number>();

      engagements.forEach((engagement) => {
        // Extract years from all date fields
        if (engagement.startDate) {
          yearsSet.add(new Date(engagement.startDate).getFullYear());
        }
        if (engagement.endDate) {
          yearsSet.add(new Date(engagement.endDate).getFullYear());
        }
        if (engagement.plannedStartDate) {
          yearsSet.add(new Date(engagement.plannedStartDate).getFullYear());
        }
        if (engagement.plannedEndDate) {
          yearsSet.add(new Date(engagement.plannedEndDate).getFullYear());
        }
        // Also include createdAt year as fallback
        if (engagement.createdAt) {
          yearsSet.add(new Date(engagement.createdAt).getFullYear());
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

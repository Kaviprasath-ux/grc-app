import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter } from '@/lib/api-auth';

// GET /api/internal-audit/engagements/[id]/findings - List findings for an engagement
// Returns the engagement reporting mode alongside its findings (for continuous reporting UI)
export const GET = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, session) => {
    try {
      const { id } = await params;
      const tenantFilter = getTenantFilter(session);

      // Verify engagement exists and belongs to tenant
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, reportingMode: true, auditeeId: true },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      const findings = await prisma.internalAuditFinding.findMany({
        where: { engagementId: id, ...tenantFilter },
        select: {
          id: true,
          findingId: true,
          finding: true,
          severity: true,
          status: true,
          sharedWithAuditeeAt: true,
          criteria: true,
          condition: true,
          cause: true,
          effect: true,
          recommendation: true,
          responsiblePerson: true,
          responsiblePersonId: true,
          targetDate: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return NextResponse.json({ reportingMode: engagement.reportingMode, findings });
    } catch (error) {
      console.error('Error fetching engagement findings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch engagement findings' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

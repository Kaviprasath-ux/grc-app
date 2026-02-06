import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getAuditHeadFilter } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/report/[id] - Get report by engagement ID
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: engagementId } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      // Find report by engagement ID with AuditHead isolation
      // Reports are NOT shared between Audit Heads
      const report = await prisma.auditReport.findFirst({
        where: { engagementId, ...tenantFilter, ...auditHeadFilter },
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              engagementObjective: true,
              engagementScope: true,
              plannedStartDate: true,
              plannedEndDate: true,
              actualStartDate: true,
              actualEndDate: true,
              department: {
                select: { id: true, name: true },
              },
              assignedAuditor: {
                select: { id: true, firstName: true, lastName: true },
              },
              auditee: {
                select: { id: true, firstName: true, lastName: true },
              },
              process: {
                select: { id: true, name: true },
              },
              findings: {
                select: {
                  id: true,
                  findingId: true,
                  finding: true,
                  description: true,
                  severity: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!report) {
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        );
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
  { resource: 'audit.fieldwork', action: 'view' }
);

// PATCH /api/internal-audit/report/[id] - Update report
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: engagementId } = await context.params;
      const body = await req.json();
      const {
        executiveSummary,
        observations,
        methodology,
        objectives,
        scope,
        recommendations,
        conclusion,
        managementResponse,
        auditeeComment,
        auditeeId,
        auditeeName,
      } = body;

      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      // Find report by engagement ID with AuditHead isolation
      // Reports are NOT shared between Audit Heads
      const existingReport = await prisma.auditReport.findFirst({
        where: { engagementId, ...tenantFilter, ...auditHeadFilter },
      });

      if (!existingReport) {
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        );
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (executiveSummary !== undefined) updateData.executiveSummary = executiveSummary;
      if (observations !== undefined) updateData.observations = observations;
      if (methodology !== undefined) updateData.methodology = methodology;
      if (objectives !== undefined) updateData.objectives = objectives;
      if (scope !== undefined) updateData.scope = scope;
      if (recommendations !== undefined) updateData.recommendations = recommendations;
      if (conclusion !== undefined) updateData.conclusion = conclusion;
      if (managementResponse !== undefined) updateData.managementResponse = managementResponse;
      if (auditeeComment !== undefined) updateData.auditeeComment = auditeeComment;
      if (auditeeId !== undefined) updateData.auditeeId = auditeeId;
      if (auditeeName !== undefined) updateData.auditeeName = auditeeName;

      // Update the report using id (verified above to belong to this audit head)
      const updatedReport = await prisma.auditReport.update({
        where: { id: existingReport.id },
        data: updateData,
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              engagementObjective: true,
              engagementScope: true,
              plannedStartDate: true,
              plannedEndDate: true,
              actualStartDate: true,
              actualEndDate: true,
              department: {
                select: { id: true, name: true },
              },
              assignedAuditor: {
                select: { id: true, firstName: true, lastName: true },
              },
              auditee: {
                select: { id: true, firstName: true, lastName: true },
              },
              process: {
                select: { id: true, name: true },
              },
              findings: {
                select: {
                  id: true,
                  findingId: true,
                  finding: true,
                  description: true,
                  severity: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      return NextResponse.json(updatedReport);
    } catch (error) {
      console.error('Error updating report:', error);
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

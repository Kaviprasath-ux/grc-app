import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/report/[id] - Get report by engagement ID
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

      // Find report by engagement ID
      const report = await prisma.auditReport.findUnique({
        where: { engagementId },
        include: {
          engagement: {
            include: {
              department: {
                select: { id: true, name: true },
              },
              assignedAuditor: {
                select: { id: true, firstName: true, lastName: true },
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
  async (req: NextRequest, context: RouteContext) => {
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
        auditeeComment,
      } = body;

      // Find report by engagement ID
      const existingReport = await prisma.auditReport.findUnique({
        where: { engagementId },
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
      if (auditeeComment !== undefined) updateData.auditeeComment = auditeeComment;

      // Update the report
      const updatedReport = await prisma.auditReport.update({
        where: { engagementId },
        data: updateData,
        include: {
          engagement: {
            include: {
              department: {
                select: { id: true, name: true },
              },
              assignedAuditor: {
                select: { id: true, firstName: true, lastName: true },
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

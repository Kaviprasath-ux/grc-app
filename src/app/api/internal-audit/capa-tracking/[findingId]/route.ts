import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ findingId: string }>;
}

// DELETE /api/internal-audit/capa-tracking/[findingId] - Delete a finding
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { findingId } = await context.params;

      // Find the finding
      const finding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
      });

      if (!finding) {
        return NextResponse.json(
          { error: 'Finding not found' },
          { status: 404 }
        );
      }

      // Delete the finding (cascades to CAPAs)
      await prisma.internalAuditFinding.delete({
        where: { id: findingId },
      });

      return NextResponse.json({
        message: 'Finding deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting finding:', error);
      return NextResponse.json(
        { error: 'Failed to delete finding' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'delete' }
);

// PATCH /api/internal-audit/capa-tracking/[findingId] - Update finding
// NOTE: AI review fields (aiReviewStatus, aiReviewDescription, etc.) are not in the schema yet
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { findingId } = await context.params;
      const body = await req.json();
      const {
        engagementId,
        finding,
        severity,
        criteria,
        condition,
        cause,
        effect,
        recommendation,
        status,
        targetDate,
        auditeeComment,
        isAuditeeSubmission, // Flag to indicate auditee submission
      } = body;

      // Find the existing finding
      const existingFinding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
      });

      if (!existingFinding) {
        return NextResponse.json(
          { error: 'Finding not found' },
          { status: 404 }
        );
      }

      // Build update data
      const updateData: Record<string, unknown> = {};

      if (engagementId !== undefined) updateData.engagementId = engagementId;
      if (finding !== undefined) updateData.finding = finding;
      if (severity !== undefined) updateData.severity = severity;
      if (criteria !== undefined) updateData.criteria = criteria;
      if (condition !== undefined) updateData.condition = condition;
      if (cause !== undefined) updateData.cause = cause;
      if (effect !== undefined) updateData.effect = effect;
      if (recommendation !== undefined) updateData.recommendation = recommendation;
      if (targetDate !== undefined) updateData.targetDate = targetDate ? new Date(targetDate) : null;
      if (auditeeComment !== undefined) updateData.description = auditeeComment; // Map auditeeComment to description

      // Handle status - auditee submission automatically sets "Under Review"
      if (isAuditeeSubmission) {
        updateData.status = 'Under Review';
      } else if (status !== undefined) {
        updateData.status = status;
        updateData.closedDate = status === 'Closed' ? new Date() : null;
      }

      // Update finding
      const updatedFinding = await prisma.internalAuditFinding.update({
        where: { id: findingId },
        data: updateData,
      });

      return NextResponse.json(updatedFinding);
    } catch (error) {
      console.error('Error updating finding:', error);
      return NextResponse.json(
        { error: 'Failed to update finding' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

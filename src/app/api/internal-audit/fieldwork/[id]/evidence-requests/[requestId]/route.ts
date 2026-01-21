import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string; requestId: string }>;
}

// GET /api/internal-audit/fieldwork/[id]/evidence-requests/[requestId] - Get a specific evidence request
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, requestId } = await context.params;

      const evidenceRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id: requestId },
        include: {
          attachments: true,
        },
      });

      if (!evidenceRequest || evidenceRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Evidence request not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: evidenceRequest.id,
        title: evidenceRequest.title,
        description: evidenceRequest.description || '',
        status: evidenceRequest.status,
        dueDate: evidenceRequest.dueDate?.toISOString() || null,
        auditee: evidenceRequest.auditeeName || '',
        auditeeId: evidenceRequest.auditeeId || null,
        numberOfSamples: evidenceRequest.sampleSize || null,
        aiReviewStatus: evidenceRequest.aiReviewStatus || null,
        clarificationComment: evidenceRequest.clarificationComment || null,
        clarificationDocumentName: evidenceRequest.clarificationDocumentName || null,
        clarificationByUserName: evidenceRequest.clarificationByUserName || null,
        clarificationSentAt: evidenceRequest.clarificationSentAt?.toISOString() || null,
        attachments: evidenceRequest.attachments.map(att => ({
          id: att.id,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          uploadedAt: att.uploadedAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error('Error fetching evidence request:', error);
      return NextResponse.json(
        { error: 'Failed to fetch evidence request' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// PATCH /api/internal-audit/fieldwork/[id]/evidence-requests/[requestId] - Update an evidence request
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, requestId } = await context.params;
      const body = await req.json();

      const existingRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id: requestId },
      });

      if (!existingRequest || existingRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Evidence request not found' },
          { status: 404 }
        );
      }

      // Get auditee name if auditeeId provided
      let auditeeName = body.auditee;
      if (body.auditeeId) {
        const auditee = await prisma.user.findUnique({
          where: { id: body.auditeeId },
          select: { firstName: true, lastName: true },
        });
        if (auditee) {
          auditeeName = `${auditee.firstName} ${auditee.lastName}`;
        }
      }

      const updatedRequest = await prisma.fieldworkEvidenceRequest.update({
        where: { id: requestId },
        data: {
          title: body.title !== undefined ? body.title : undefined,
          description: body.description !== undefined ? body.description : undefined,
          status: body.status !== undefined ? body.status : undefined,
          dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
          auditeeId: body.auditeeId !== undefined ? body.auditeeId : undefined,
          auditeeName: auditeeName !== undefined ? auditeeName : undefined,
          sampleSize: body.numberOfSamples !== undefined ? (body.numberOfSamples ? String(body.numberOfSamples) : null) : undefined,
          aiReviewStatus: body.aiReviewStatus !== undefined ? body.aiReviewStatus : undefined,
          // Clarification fields
          clarificationComment: body.clarificationComment !== undefined ? body.clarificationComment : undefined,
          clarificationDocumentName: body.clarificationDocumentName !== undefined ? body.clarificationDocumentName : undefined,
          clarificationByUserId: body.clarificationByUserId !== undefined ? body.clarificationByUserId : undefined,
          clarificationByUserName: body.clarificationByUserName !== undefined ? body.clarificationByUserName : undefined,
          clarificationSentAt: body.clarificationSentAt !== undefined ? (body.clarificationSentAt ? new Date(body.clarificationSentAt) : null) : undefined,
        },
      });

      return NextResponse.json({
        id: updatedRequest.id,
        title: updatedRequest.title,
        description: updatedRequest.description || '',
        status: updatedRequest.status,
        dueDate: updatedRequest.dueDate?.toISOString() || null,
        auditee: updatedRequest.auditeeName || '',
        auditeeId: updatedRequest.auditeeId || null,
        numberOfSamples: updatedRequest.sampleSize || null,
        aiReviewStatus: updatedRequest.aiReviewStatus || null,
        clarificationComment: updatedRequest.clarificationComment || null,
        clarificationDocumentName: updatedRequest.clarificationDocumentName || null,
        clarificationByUserName: updatedRequest.clarificationByUserName || null,
        clarificationSentAt: updatedRequest.clarificationSentAt?.toISOString() || null,
      });
    } catch (error) {
      console.error('Error updating evidence request:', error);
      return NextResponse.json(
        { error: 'Failed to update evidence request' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

// DELETE /api/internal-audit/fieldwork/[id]/evidence-requests/[requestId] - Delete an evidence request
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, requestId } = await context.params;

      const existingRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id: requestId },
        include: { attachments: true },
      });

      if (!existingRequest || existingRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Evidence request not found' },
          { status: 404 }
        );
      }

      // Delete all attachments first
      if (existingRequest.attachments.length > 0) {
        await prisma.fieldworkEvidenceAttachment.deleteMany({
          where: { evidenceRequestId: requestId },
        });
      }

      // Delete the evidence request
      await prisma.fieldworkEvidenceRequest.delete({
        where: { id: requestId },
      });

      return NextResponse.json({ message: 'Evidence request deleted successfully' });
    } catch (error) {
      console.error('Error deleting evidence request:', error);
      return NextResponse.json(
        { error: 'Failed to delete evidence request' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'delete' }
);

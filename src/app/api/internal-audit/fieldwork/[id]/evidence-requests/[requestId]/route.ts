import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { notificationService, NOTIFICATION_CHANNELS } from '@/lib/notification-service';

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

      // NOTE: Clarification fields are not in the schema yet
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
        clarificationComment: null,
        clarificationDocumentName: null,
        clarificationByUserName: null,
        clarificationSentAt: null,
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
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: engagementId, requestId } = await context.params;
      const body = await req.json();

      const existingRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id: requestId },
        include: {
          engagement: {
            select: {
              customerAccountId: true,
            },
          },
        },
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

      // Detect if this is a clarification request (status changing to Pending with aiReviewStatus Needs Attention)
      const isClarificationRequest =
        body.aiReviewStatus === 'Needs Attention' &&
        body.status === 'Pending' &&
        existingRequest.status !== 'Pending';

      // Detect if auditee is being newly assigned
      const isNewAuditeeAssignment =
        body.auditeeId &&
        body.auditeeId !== existingRequest.auditeeId;

      // NOTE: Clarification fields are not in the schema yet - excluded from update
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
          aiReviewComment: body.aiReviewComment !== undefined ? body.aiReviewComment : undefined,
        },
      });

      const customerAccountId = existingRequest.engagement?.customerAccountId;
      const auditeeId = updatedRequest.auditeeId || existingRequest.auditeeId;

      // Notify auditee about clarification request (aiReviewStatus: Needs Attention)
      if (isClarificationRequest && auditeeId && auditeeId !== session.id && customerAccountId) {
        await notificationService.notifyClarificationRequested({
          customerAccountId,
          actorId: session.id,
          auditeeId,
          requestId: updatedRequest.id,
          requestName: updatedRequest.title,
          clarificationComment: body.clarificationComment ? body.clarificationComment.substring(0, 100) : undefined,
          link: `/internal-audit/fieldwork/${engagementId}`,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

      // Notify newly assigned auditee about the evidence request
      if (isNewAuditeeAssignment && body.auditeeId !== session.id && customerAccountId) {
        await notificationService.notifyFeedbackRequested({
          customerAccountId,
          actorId: session.id,
          feedbackProviderId: body.auditeeId,
          entityType: 'Evidence Request',
          entityId: updatedRequest.id,
          entityName: updatedRequest.title,
          description: updatedRequest.description ? updatedRequest.description.substring(0, 100) : undefined,
          link: `/internal-audit/fieldwork/${engagementId}`,
          channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
        });
      }

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
        clarificationComment: null,
        clarificationDocumentName: null,
        clarificationByUserName: null,
        clarificationSentAt: null,
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

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface RouteContext {
  params: Promise<{ id: string; requestId: string; attachmentId: string }>;
}

// DELETE /api/internal-audit/fieldwork/[id]/evidence-requests/[requestId]/attachments/[attachmentId]
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, requestId, attachmentId } = await context.params;

      // Find the attachment and verify it belongs to this evidence request
      const attachment = await prisma.fieldworkEvidenceAttachment.findUnique({
        where: { id: attachmentId },
        include: {
          evidenceRequest: {
            select: {
              id: true,
              engagementId: true,
            },
          },
        },
      });

      if (!attachment) {
        return NextResponse.json(
          { error: 'Attachment not found' },
          { status: 404 }
        );
      }

      // Verify attachment belongs to the specified evidence request and engagement
      if (attachment.evidenceRequestId !== requestId || attachment.evidenceRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Attachment does not belong to this evidence request' },
          { status: 400 }
        );
      }

      // Delete file from disk if it exists
      if (attachment.filePath) {
        const diskPath = path.join(process.cwd(), attachment.filePath.replace(/^\//, ''));
        if (existsSync(diskPath)) {
          try {
            await unlink(diskPath);
          } catch (err) {
            console.warn(`[Evidence Attachments] Could not delete file from disk: ${diskPath}`, err);
          }
        }
      }

      // Delete the attachment record from database
      await prisma.fieldworkEvidenceAttachment.delete({
        where: { id: attachmentId },
      });

      return NextResponse.json({
        message: 'Attachment deleted successfully',
      });
    } catch (error) {
      console.error('[Evidence Attachments] Error deleting attachment:', error);
      return NextResponse.json(
        { error: 'Failed to delete attachment' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'delete' }
);

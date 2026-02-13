import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, validateTenantAccess, forbidden } from '@/lib/api-auth';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface RouteContext {
  params: Promise<{ findingId: string; attachmentId: string }>;
}

/**
 * DELETE /api/internal-audit/capa-tracking/[findingId]/attachments/[attachmentId]
 * Delete a specific attachment from a finding
 */
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { findingId, attachmentId } = await context.params;

      // Find the attachment and verify it belongs to this finding
      const attachment = await prisma.findingAttachment.findUnique({
        where: { id: attachmentId },
        include: {
          finding: {
            select: {
              id: true,
              customerAccountId: true,
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

      // Verify attachment belongs to the specified finding
      if (attachment.findingId !== findingId) {
        return NextResponse.json(
          { error: 'Attachment does not belong to this finding' },
          { status: 400 }
        );
      }

      // Validate tenant access
      if (!validateTenantAccess(session, attachment.finding.customerAccountId)) {
        return forbidden('Access denied to this attachment');
      }

      // Delete file from disk if it exists
      if (attachment.filePath) {
        const diskPath = path.join(process.cwd(), attachment.filePath.replace(/^\//, ''));
        if (existsSync(diskPath)) {
          try {
            await unlink(diskPath);
            console.log(`[CAPA Attachments] Deleted file from disk: ${diskPath}`);
          } catch (err) {
            console.warn(`[CAPA Attachments] Could not delete file from disk: ${diskPath}`, err);
            // Continue with database deletion even if file deletion fails
          }
        }
      }

      // Delete the attachment record from database
      await prisma.findingAttachment.delete({
        where: { id: attachmentId },
      });

      console.log(`[CAPA Attachments] Deleted attachment ${attachmentId} from finding ${findingId}`);

      return NextResponse.json({
        message: 'Attachment deleted successfully',
      });
    } catch (error) {
      console.error('[CAPA Attachments] Error deleting attachment:', error);
      return NextResponse.json(
        { error: 'Failed to delete attachment' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'delete' }
);

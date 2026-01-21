import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

interface RouteContext {
  params: Promise<{ findingId: string; attachmentId: string }>;
}

// DELETE /api/internal-audit/capa-tracking/[findingId]/attachments/[attachmentId] - Delete attachment
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { findingId, attachmentId } = await context.params;

      // Get the attachment
      const attachment = await prisma.findingAttachment.findFirst({
        where: {
          id: attachmentId,
          findingId: findingId,
        },
      });

      if (!attachment) {
        return NextResponse.json(
          { error: 'Attachment not found' },
          { status: 404 }
        );
      }

      // Delete the file from disk
      const fullPath = path.join(process.cwd(), attachment.filePath);
      if (existsSync(fullPath)) {
        await unlink(fullPath);
      }

      // Delete the database record
      await prisma.findingAttachment.delete({
        where: { id: attachmentId },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting finding attachment:', error);
      return NextResponse.json(
        { error: 'Failed to delete attachment' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.capa', action: 'edit' }
);

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { unlink } from 'fs/promises';
import path from 'path';

interface RouteContext {
  params: Promise<{ id: string; workpaperId: string }>;
}

// DELETE /api/internal-audit/fieldwork/[id]/workpapers/[workpaperId] - Delete a workpaper
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, workpaperId } = await context.params;

      // Verify engagement exists
      const engagement = await prisma.auditEngagement.findUnique({
        where: { id: engagementId },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      // Find the attachment
      const attachment = await prisma.fieldworkEvidenceAttachment.findUnique({
        where: { id: workpaperId },
        include: {
          evidenceRequest: true,
        },
      });

      if (!attachment) {
        return NextResponse.json(
          { error: 'Workpaper not found' },
          { status: 404 }
        );
      }

      // Verify it belongs to this engagement
      if (attachment.evidenceRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Workpaper does not belong to this engagement' },
          { status: 403 }
        );
      }

      // Delete the file from disk
      try {
        const filePath = path.join(process.cwd(), attachment.filePath);
        await unlink(filePath);
      } catch (err) {
        console.warn('Could not delete workpaper file:', err);
      }

      // Delete the attachment record
      await prisma.fieldworkEvidenceAttachment.delete({
        where: { id: workpaperId },
      });

      return NextResponse.json({ message: 'Workpaper deleted successfully' });
    } catch (error) {
      console.error('Error deleting workpaper:', error);
      return NextResponse.json(
        { error: 'Failed to delete workpaper' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'delete' }
);

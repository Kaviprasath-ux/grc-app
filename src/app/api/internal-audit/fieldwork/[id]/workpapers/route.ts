import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/fieldwork/[id]/workpapers - Get workpapers for an engagement
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

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

      // Get attachments from fieldwork evidence requests with category 'workpaper'
      const attachments = await prisma.fieldworkEvidenceAttachment.findMany({
        where: {
          evidenceRequest: {
            engagementId: engagementId,
          },
        },
        orderBy: { uploadedAt: 'desc' },
      });

      // Transform to workpaper format
      const workpapers = attachments.map(att => ({
        id: att.id,
        fileName: att.fileName,
        fileType: att.fileType,
        fileSize: att.fileSize,
        filePath: att.filePath,
        uploadedAt: att.uploadedAt.toISOString(),
        category: 'workpapers',
      }));

      return NextResponse.json(workpapers);
    } catch (error) {
      console.error('Error fetching workpapers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch workpapers' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// POST /api/internal-audit/fieldwork/[id]/workpapers - Create workpaper (placeholder)
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

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

      // Return success placeholder - actual upload handled by upload route
      return NextResponse.json({ message: 'Use /upload endpoint for file uploads' }, { status: 200 });
    } catch (error) {
      console.error('Error creating workpaper:', error);
      return NextResponse.json(
        { error: 'Failed to create workpaper' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);

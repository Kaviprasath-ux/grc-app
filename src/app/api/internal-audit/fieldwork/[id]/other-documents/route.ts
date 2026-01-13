import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/fieldwork/[id]/other-documents - Get other documents for an engagement
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

      // Get attachments from fieldwork evidence requests with category 'other'
      const attachments = await prisma.fieldworkEvidenceAttachment.findMany({
        where: {
          evidenceRequest: {
            engagementId: engagementId,
            category: 'other',
          },
        },
        include: {
          evidenceRequest: {
            select: {
              title: true,
              documentType: true,
              description: true,
            },
          },
        },
        orderBy: { uploadedAt: 'desc' },
      });

      // Transform to document format
      const documents = attachments.map(att => ({
        id: att.id,
        fileName: att.fileName,
        fileType: att.fileType,
        fileSize: att.fileSize,
        filePath: att.filePath,
        uploadedAt: att.uploadedAt.toISOString(),
        category: 'other',
        title: att.evidenceRequest.title,
        documentType: att.evidenceRequest.documentType,
        description: att.evidenceRequest.description,
      }));

      return NextResponse.json(documents);
    } catch (error) {
      console.error('Error fetching other documents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch other documents' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

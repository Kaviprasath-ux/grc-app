import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { saveUploadedFile } from '@/lib/file-upload';

interface RouteContext {
  params: Promise<{ id: string; requestId: string }>;
}

// GET /api/internal-audit/fieldwork/[id]/evidence-requests/[requestId]/attachments - Get attachments
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, requestId } = await context.params;

      const evidenceRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id: requestId },
        include: { attachments: true },
      });

      if (!evidenceRequest || evidenceRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Evidence request not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        evidenceRequest.attachments.map(att => ({
          id: att.id,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          uploadedAt: att.uploadedAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error('Error fetching attachments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch attachments' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// POST /api/internal-audit/fieldwork/[id]/evidence-requests/[requestId]/attachments - Upload attachments
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: engagementId, requestId } = await context.params;

      // Verify evidence request exists and get engagement info for notifications
      const evidenceRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id: requestId },
        include: {
          engagement: {
            select: {
              id: true,
              auditId: true,
              engagementTitle: true,
              assignedAuditorId: true,
              customerAccountId: true,
            },
          },
        },
      });

      if (!evidenceRequest || evidenceRequest.engagementId !== engagementId) {
        return NextResponse.json(
          { error: 'Evidence request not found' },
          { status: 404 }
        );
      }

      // Parse form data
      const formData = await req.formData();
      const files = formData.getAll('files');

      if (!files || files.length === 0) {
        return NextResponse.json(
          { error: 'No files provided' },
          { status: 400 }
        );
      }

      const uploadedFiles = [];

      for (const file of files) {
        if (file instanceof File) {
          const subDir = `fieldwork/${engagementId}/evidence`;
          const { urlPath, fileName } = await saveUploadedFile(file, subDir);

          // Create attachment record
          const attachment = await prisma.fieldworkEvidenceAttachment.create({
            data: {
              evidenceRequestId: requestId,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              filePath: urlPath,
            },
          });

          uploadedFiles.push({
            id: attachment.id,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            filePath: attachment.filePath,
            uploadedAt: attachment.uploadedAt.toISOString(),
          });
        }
      }

      // No AI review on document upload - AI review is triggered separately
      return NextResponse.json({
        message: 'Files uploaded successfully',
        files: uploadedFiles,
      }, { status: 201 });
    } catch (error) {
      console.error('Error uploading attachments:', error);
      return NextResponse.json(
        { error: 'Failed to upload attachments' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { saveUploadedFile } from '@/lib/file-upload';
import { translateRecord, isTranslationConfigured } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/internal-audit/fieldwork/[id]/upload - Upload files for an engagement
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
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

      // Parse form data
      const formData = await req.formData();
      const files = formData.getAll('files');
      const category = formData.get('category') as string || 'workpapers';
      const documentTitle = formData.get('title') as string || '';
      const documentType = formData.get('documentType') as string || '';
      const documentDescription = formData.get('description') as string || '';

      if (!files || files.length === 0) {
        return NextResponse.json(
          { error: 'No files provided' },
          { status: 400 }
        );
      }

      const uploadedFiles = [];

      for (const file of files) {
        if (file instanceof File) {
          const subDir = `fieldwork/${engagementId}`;
          const { urlPath, buffer } = await saveUploadedFile(file, subDir);
          const originalName = file.name;

          // For workpapers, we need to create an evidence request first to attach files
          // For simplicity, we'll create a general evidence request for workpapers
          if (category === 'workpapers') {
            // Use provided title or default to 'Workpapers'
            const requestTitle = documentTitle || 'Workpapers';
            const requestDescription = documentDescription || 'General workpapers for this engagement';

            // Find or create an evidence request for this document
            let evidenceRequest = await prisma.fieldworkEvidenceRequest.findFirst({
              where: {
                engagementId,
                title: requestTitle,
              },
            });

            if (!evidenceRequest) {
              evidenceRequest = await prisma.fieldworkEvidenceRequest.create({
                data: {
                  engagementId,
                  title: requestTitle,
                  description: requestDescription,
                  status: 'Reviewed',
                  category: 'workpapers',
                  documentType: documentType || null,
                },
              });
            }

            // Create attachment record
            const attachment = await prisma.fieldworkEvidenceAttachment.create({
              data: {
                evidenceRequestId: evidenceRequest.id,
                fileName: originalName,
                fileType: documentType || file.type,
                fileSize: file.size,
                filePath: urlPath,
              },
            });

            // Store file binary in DB for Vercel persistence
            await prisma.$executeRaw`UPDATE "FieldworkEvidenceAttachment" SET "fileData" = ${Buffer.from(buffer)} WHERE "id" = ${attachment.id}`;

            // Translate file name
            if (session.customerAccountId && isTranslationConfigured()) {
              void translateRecord(session.customerAccountId, 'FieldworkEvidenceAttachment', attachment.id, { fileName: originalName }).catch(() => {});
            }

            uploadedFiles.push({
              id: attachment.id,
              fileName: attachment.fileName,
              fileType: attachment.fileType,
              fileSize: attachment.fileSize,
              filePath: attachment.filePath,
              uploadedAt: attachment.uploadedAt.toISOString(),
              category,
              title: documentTitle,
              documentType,
              description: documentDescription,
            });
          } else {
            // For other documents, create an evidence request with provided metadata
            const requestTitle = documentTitle || originalName;
            const requestDescription = documentDescription || '';

            // Create evidence request for the document
            const evidenceRequest = await prisma.fieldworkEvidenceRequest.create({
              data: {
                engagementId,
                title: requestTitle,
                description: requestDescription,
                status: 'Reviewed',
                category: 'other',
                documentType: documentType || null,
              },
            });

            // Create attachment record
            const attachment = await prisma.fieldworkEvidenceAttachment.create({
              data: {
                evidenceRequestId: evidenceRequest.id,
                fileName: originalName,
                fileType: documentType || file.type,
                fileSize: file.size,
                filePath: urlPath,
              },
            });

            // Store file binary in DB for Vercel persistence
            await prisma.$executeRaw`UPDATE "FieldworkEvidenceAttachment" SET "fileData" = ${Buffer.from(buffer)} WHERE "id" = ${attachment.id}`;

            // Translate file name
            if (session.customerAccountId && isTranslationConfigured()) {
              void translateRecord(session.customerAccountId, 'FieldworkEvidenceAttachment', attachment.id, { fileName: originalName }).catch(() => {});
            }

            uploadedFiles.push({
              id: attachment.id,
              fileName: attachment.fileName,
              fileType: attachment.fileType,
              fileSize: attachment.fileSize,
              filePath: attachment.filePath,
              uploadedAt: attachment.uploadedAt.toISOString(),
              category,
              title: documentTitle,
              documentType,
              description: documentDescription,
            });
          }
        }
      }

      return NextResponse.json({
        message: 'Files uploaded successfully',
        files: uploadedFiles,
      }, { status: 201 });
    } catch (error) {
      console.error('Error uploading files:', error);
      return NextResponse.json(
        { error: 'Failed to upload files' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);

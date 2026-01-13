import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/internal-audit/fieldwork/[id]/upload - Upload files for an engagement
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

      // Create upload directory
      const uploadDir = path.join(process.cwd(), 'uploads', 'fieldwork', engagementId);
      await mkdir(uploadDir, { recursive: true });

      const uploadedFiles = [];

      for (const file of files) {
        if (file instanceof File) {
          // Generate unique filename
          const timestamp = Date.now();
          const originalName = file.name;
          const ext = path.extname(originalName);
          const baseName = path.basename(originalName, ext);
          const fileName = `${baseName}_${timestamp}${ext}`;
          const filePath = path.join(uploadDir, fileName);

          // Write file to disk
          const buffer = Buffer.from(await file.arrayBuffer());
          await writeFile(filePath, buffer);

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
                filePath: `/uploads/fieldwork/${engagementId}/${fileName}`,
              },
            });

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
                filePath: `/uploads/fieldwork/${engagementId}/${fileName}`,
              },
            });

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

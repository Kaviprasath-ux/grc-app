import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, requestId } = await context.params;

      // Verify evidence request exists
      const evidenceRequest = await prisma.fieldworkEvidenceRequest.findUnique({
        where: { id: requestId },
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

      // Create upload directory
      const uploadDir = path.join(process.cwd(), 'uploads', 'fieldwork', engagementId, 'evidence');
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

          // Create attachment record
          const attachment = await prisma.fieldworkEvidenceAttachment.create({
            data: {
              evidenceRequestId: requestId,
              fileName: originalName,
              fileType: file.type,
              fileSize: file.size,
              filePath: `/uploads/fieldwork/${engagementId}/evidence/${fileName}`,
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

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

interface RouteContext {
  params: Promise<{ findingId: string }>;
}

// GET /api/internal-audit/findings/[findingId]/attachments - Get attachments
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { findingId } = await context.params;

      const finding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
        include: { attachments: true },
      });

      if (!finding) {
        return NextResponse.json(
          { error: 'Finding not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        finding.attachments.map(att => ({
          id: att.id,
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
          filePath: att.filePath,
          uploadedAt: att.uploadedAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error('Error fetching finding attachments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch attachments' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// POST /api/internal-audit/findings/[findingId]/attachments - Upload attachments
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { findingId } = await context.params;

      // Verify finding exists
      const finding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
      });

      if (!finding) {
        return NextResponse.json(
          { error: 'Finding not found' },
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
      const uploadDir = path.join(process.cwd(), 'uploads', 'findings', findingId);
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
          const attachment = await prisma.findingAttachment.create({
            data: {
              findingId: findingId,
              fileName: originalName,
              fileType: file.type,
              fileSize: file.size,
              filePath: `/uploads/findings/${findingId}/${fileName}`,
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
      console.error('Error uploading finding attachments:', error);
      return NextResponse.json(
        { error: 'Failed to upload attachments' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

// DELETE /api/internal-audit/findings/[findingId]/attachments - Delete attachment
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { findingId } = await context.params;
      const { searchParams } = new URL(req.url);
      const attachmentId = searchParams.get('attachmentId');

      if (!attachmentId) {
        return NextResponse.json(
          { error: 'Attachment ID is required' },
          { status: 400 }
        );
      }

      // Verify attachment exists and belongs to this finding
      const attachment = await prisma.findingAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment || attachment.findingId !== findingId) {
        return NextResponse.json(
          { error: 'Attachment not found' },
          { status: 404 }
        );
      }

      // Delete the attachment record
      await prisma.findingAttachment.delete({
        where: { id: attachmentId },
      });

      return NextResponse.json({ message: 'Attachment deleted successfully' });
    } catch (error) {
      console.error('Error deleting finding attachment:', error);
      return NextResponse.json(
        { error: 'Failed to delete attachment' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'delete' }
);

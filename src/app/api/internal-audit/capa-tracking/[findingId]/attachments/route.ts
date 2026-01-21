import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

interface RouteContext {
  params: Promise<{ findingId: string }>;
}

// GET /api/internal-audit/capa-tracking/[findingId]/attachments - Get all attachments for a finding
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { findingId } = await context.params;

      const attachments = await prisma.findingAttachment.findMany({
        where: { findingId },
        orderBy: { uploadedAt: 'desc' },
      });

      return NextResponse.json(attachments);
    } catch (error) {
      console.error('Error fetching finding attachments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch attachments' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.capa', action: 'view' }
);

// POST /api/internal-audit/capa-tracking/[findingId]/attachments - Upload attachment
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

      const formData = await req.formData();
      const files = formData.getAll('files') as File[];

      if (!files || files.length === 0) {
        return NextResponse.json(
          { error: 'No files provided' },
          { status: 400 }
        );
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'capa-attachments', findingId);
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      const uploadedAttachments = [];

      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}_${sanitizedName}`;
        const filePath = path.join(uploadsDir, fileName);

        // Write file
        await writeFile(filePath, buffer);

        // Create database record
        const attachment = await prisma.findingAttachment.create({
          data: {
            findingId,
            fileName: file.name,
            fileType: file.type || null,
            fileSize: file.size,
            filePath: `/uploads/capa-attachments/${findingId}/${fileName}`,
            uploadedBy: formData.get('uploadedBy') as string || null,
          },
        });

        uploadedAttachments.push(attachment);
      }

      return NextResponse.json(uploadedAttachments, { status: 201 });
    } catch (error) {
      console.error('Error uploading finding attachment:', error);
      return NextResponse.json(
        { error: 'Failed to upload attachment' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.capa', action: 'edit' }
);

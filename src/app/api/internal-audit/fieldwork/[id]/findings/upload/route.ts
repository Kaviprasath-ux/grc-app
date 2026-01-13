import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/internal-audit/fieldwork/[id]/findings/upload - Upload files for a finding
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
      const findingId = formData.get('findingId') as string;

      if (!files || files.length === 0) {
        return NextResponse.json(
          { error: 'No files provided' },
          { status: 400 }
        );
      }

      // Create upload directory
      const uploadDir = path.join(process.cwd(), 'uploads', 'findings', engagementId);
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

          // Store file info (could be stored in database if needed)
          uploadedFiles.push({
            id: timestamp.toString(),
            fileName: originalName,
            fileType: file.type,
            fileSize: file.size,
            filePath: `/uploads/findings/${engagementId}/${fileName}`,
            uploadedAt: new Date().toISOString(),
            findingId: findingId || null,
          });
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

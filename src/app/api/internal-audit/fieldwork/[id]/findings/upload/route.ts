import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { saveUploadedFile } from '@/lib/file-upload';
import { validateUploadedFiles } from '@/lib/upload-validation';

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
      const check = validateUploadedFiles(files as File[]);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      const uploadedFiles = [];

      for (const file of files) {
        if (file instanceof File) {
          const subDir = `findings/${engagementId}`;
          const { urlPath } = await saveUploadedFile(file, subDir);

          // Store file info
          uploadedFiles.push({
            id: Date.now().toString(),
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            filePath: urlPath,
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

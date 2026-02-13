import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { unlink } from 'fs/promises';
import path from 'path';
import { saveUploadedFile, getUploadBaseDir } from '@/lib/file-upload';

interface RouteContext {
  params: Promise<{ id: string; taskId: string }>;
}

// Reference to the task store from parent route
// In production, this would be a database
const taskStore: Record<string, Array<{
  id: string;
  refNo: number;
  task: string;
  document: string | null;
  documentName: string | null;
  executed: boolean;
  comments: string;
  createdAt: string;
}>> = {};

// Helper to get task store (shared with parent route)
function getTaskStore() {
  // @ts-expect-error - accessing global store
  return global.fieldworkTaskStore || taskStore;
}

// POST /api/internal-audit/fieldwork/[id]/tasks/[taskId]/document - Upload document for a task
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, taskId } = await context.params;

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
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      const subDir = `fieldwork/${engagementId}/tasks`;
      const { urlPath } = await saveUploadedFile(file, subDir);
      const originalName = file.name;

      // Return file info (task update is done separately via PATCH)
      const documentPath = urlPath;

      return NextResponse.json({
        document: documentPath,
        documentName: originalName,
      }, { status: 201 });
    } catch (error) {
      console.error('Error uploading task document:', error);
      return NextResponse.json(
        { error: 'Failed to upload document' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);

// DELETE /api/internal-audit/fieldwork/[id]/tasks/[taskId]/document - Delete document for a task
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, taskId } = await context.params;
      const { searchParams } = new URL(req.url);
      const documentPath = searchParams.get('path');

      if (!documentPath) {
        return NextResponse.json(
          { error: 'Document path is required' },
          { status: 400 }
        );
      }

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

      // Delete the file
      try {
        const baseDir = getUploadBaseDir();
        const relativePath = documentPath.replace(/^\/uploads\//, '');
        const filePath = path.join(baseDir, relativePath);
        await unlink(filePath);
      } catch (err) {
        console.warn('Could not delete document file:', err);
      }

      return NextResponse.json({ message: 'Document deleted successfully' });
    } catch (error) {
      console.error('Error deleting task document:', error);
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'delete' }
);

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { validateUploadedFile } from '@/lib/upload-validation';
import { unlink } from 'fs/promises';
import path from 'path';
import { saveUploadedFile, getUploadBaseDir } from '@/lib/file-upload';

interface RouteContext {
  params: Promise<{ id: string; taskId: string }>;
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

      // Verify task exists and belongs to this engagement
      const task = await prisma.auditEngagementTask.findFirst({
        where: { id: taskId, engagementId },
      });

      if (!task) {
        return NextResponse.json(
          { error: 'Task not found' },
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
      const check = validateUploadedFile(file);
      if (!check.ok) {
        return NextResponse.json({ error: check.reason }, { status: 400 });
      }

      // Delete old document file if replacing
      if (task.document) {
        try {
          const baseDir = getUploadBaseDir();
          const relativePath = task.document.replace(/^\/uploads\//, '');
          const oldFilePath = path.join(baseDir, relativePath);
          await unlink(oldFilePath);
        } catch (err) {
          console.warn('Could not delete old task document:', err);
        }
      }

      const subDir = `fieldwork/${engagementId}/tasks`;
      const { urlPath } = await saveUploadedFile(file, subDir);
      const originalName = file.name;

      // Update the task record with document info
      const updatedTask = await prisma.auditEngagementTask.update({
        where: { id: taskId },
        data: {
          document: urlPath,
          documentName: originalName,
        },
      });

      return NextResponse.json({
        document: updatedTask.document,
        documentName: updatedTask.documentName,
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

      // Verify task exists and belongs to this engagement
      const task = await prisma.auditEngagementTask.findFirst({
        where: { id: taskId, engagementId },
      });

      if (!task) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }

      // Delete the file from disk
      if (task.document) {
        try {
          const baseDir = getUploadBaseDir();
          const relativePath = task.document.replace(/^\/uploads\//, '');
          const filePath = path.join(baseDir, relativePath);
          await unlink(filePath);
        } catch (err) {
          console.warn('Could not delete document file:', err);
        }
      }

      // Clear document fields in database
      await prisma.auditEngagementTask.update({
        where: { id: taskId },
        data: {
          document: null,
          documentName: null,
        },
      });

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

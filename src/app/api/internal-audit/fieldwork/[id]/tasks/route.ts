import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { unlink } from 'fs/promises';
import path from 'path';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/fieldwork/[id]/tasks - Get tasks for an engagement
export const GET = withAuth(
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

      // Fetch tasks from database ordered by refNo
      const tasks = await prisma.auditEngagementTask.findMany({
        where: { engagementId },
        orderBy: { refNo: 'asc' },
      });

      return NextResponse.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

// POST /api/internal-audit/fieldwork/[id]/tasks - Create a new task
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

      // Calculate next ref number
      const lastTask = await prisma.auditEngagementTask.findFirst({
        where: { engagementId },
        orderBy: { refNo: 'desc' },
      });
      const nextRefNo = lastTask ? lastTask.refNo + 1 : 1;

      // Create task in database
      const newTask = await prisma.auditEngagementTask.create({
        data: {
          engagementId,
          refNo: nextRefNo,
          task: '',
          document: null,
          documentName: null,
          executed: false,
          comments: '',
        },
      });

      return NextResponse.json(newTask, { status: 201 });
    } catch (error) {
      console.error('Error creating task:', error);
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);

// PATCH /api/internal-audit/fieldwork/[id]/tasks - Update a task
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;
      const body = await req.json();
      const { taskId, ...updates } = body;

      if (!taskId) {
        return NextResponse.json(
          { error: 'Task ID is required' },
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

      // Verify task exists and belongs to this engagement
      const existingTask = await prisma.auditEngagementTask.findFirst({
        where: { id: taskId, engagementId },
      });

      if (!existingTask) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }

      // Build update data from allowed fields
      const updateData: Record<string, string | boolean> = {};
      if (updates.task !== undefined) updateData.task = updates.task;
      if (updates.executed !== undefined) updateData.executed = updates.executed;
      if (updates.comments !== undefined) updateData.comments = updates.comments;
      if (updates.document !== undefined) updateData.document = updates.document;
      if (updates.documentName !== undefined) updateData.documentName = updates.documentName;

      const updatedTask = await prisma.auditEngagementTask.update({
        where: { id: taskId },
        data: updateData,
      });

      return NextResponse.json(updatedTask);
    } catch (error) {
      console.error('Error updating task:', error);
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

// DELETE /api/internal-audit/fieldwork/[id]/tasks - Delete a task
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;
      const { searchParams } = new URL(req.url);
      const taskId = searchParams.get('taskId');

      if (!taskId) {
        return NextResponse.json(
          { error: 'Task ID is required' },
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

      // Find the task to delete
      const task = await prisma.auditEngagementTask.findFirst({
        where: { id: taskId, engagementId },
      });

      if (!task) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }

      // Delete associated document file if exists
      if (task.document) {
        try {
          const filePath = path.join(process.cwd(), task.document);
          await unlink(filePath);
        } catch (err) {
          console.warn('Could not delete task document:', err);
        }
      }

      // Delete the task from database
      await prisma.auditEngagementTask.delete({
        where: { id: taskId },
      });

      // Renumber remaining tasks for this engagement
      const remainingTasks = await prisma.auditEngagementTask.findMany({
        where: { engagementId },
        orderBy: { refNo: 'asc' },
      });

      for (let i = 0; i < remainingTasks.length; i++) {
        if (remainingTasks[i].refNo !== i + 1) {
          await prisma.auditEngagementTask.update({
            where: { id: remainingTasks[i].id },
            data: { refNo: i + 1 },
          });
        }
      }

      return NextResponse.json({ message: 'Task deleted successfully' });
    } catch (error) {
      console.error('Error deleting task:', error);
      return NextResponse.json(
        { error: 'Failed to delete task' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'delete' }
);

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// In-memory store for tasks (would be database in production)
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

      // Return tasks from store (or empty array)
      const tasks = taskStore[engagementId] || [];
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

      // Initialize store for this engagement if needed
      if (!taskStore[engagementId]) {
        taskStore[engagementId] = [];
      }

      // Calculate next ref number
      const existingTasks = taskStore[engagementId];
      const nextRefNo = existingTasks.length > 0
        ? Math.max(...existingTasks.map(t => t.refNo)) + 1
        : 1;

      // Create task with new structure
      const newTask = {
        id: Date.now().toString(),
        refNo: nextRefNo,
        task: '',
        document: null,
        documentName: null,
        executed: false,
        comments: '',
        createdAt: new Date().toISOString(),
      };

      taskStore[engagementId].push(newTask);

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

      // Find and update task
      const tasks = taskStore[engagementId] || [];
      const taskIndex = tasks.findIndex(t => t.id === taskId);

      if (taskIndex === -1) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }

      // Update task fields
      if (updates.task !== undefined) tasks[taskIndex].task = updates.task;
      if (updates.executed !== undefined) tasks[taskIndex].executed = updates.executed;
      if (updates.comments !== undefined) tasks[taskIndex].comments = updates.comments;

      return NextResponse.json(tasks[taskIndex]);
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

      // Find and delete task
      const tasks = taskStore[engagementId] || [];
      const taskIndex = tasks.findIndex(t => t.id === taskId);

      if (taskIndex === -1) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }

      // Delete associated document if exists
      const task = tasks[taskIndex];
      if (task.document) {
        try {
          const filePath = path.join(process.cwd(), task.document);
          await unlink(filePath);
        } catch (err) {
          console.warn('Could not delete task document:', err);
        }
      }

      // Remove task
      tasks.splice(taskIndex, 1);

      // Renumber remaining tasks
      tasks.forEach((t, idx) => {
        t.refNo = idx + 1;
      });

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

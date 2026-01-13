import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// In-memory store for tasks (would be database in production)
const taskStore: Record<string, Array<{
  id: string;
  title: string;
  description: string;
  status: string;
  assignedTo: string;
  dueDate: string | null;
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
      const body = await req.json();

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

      // Create task
      const newTask = {
        id: Date.now().toString(),
        title: body.title,
        description: body.description || '',
        status: body.status || 'Pending',
        assignedTo: body.assignedTo || '',
        dueDate: body.dueDate || null,
        createdAt: new Date().toISOString(),
      };

      // Initialize store for this engagement if needed
      if (!taskStore[engagementId]) {
        taskStore[engagementId] = [];
      }
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

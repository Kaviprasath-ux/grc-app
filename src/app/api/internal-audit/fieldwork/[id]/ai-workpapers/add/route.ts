import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface WorkpaperInput {
  id: string;
  task: string;
  steps: string;
  evidences: string;
  questionChecklist: string;
  comments: string;
  executed: boolean;
}

// POST /api/internal-audit/fieldwork/[id]/ai-workpapers/add - Add selected AI workpapers
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;
      const body = await req.json();
      const { workpapers } = body as { workpapers: WorkpaperInput[] };

      if (!workpapers || !Array.isArray(workpapers) || workpapers.length === 0) {
        return NextResponse.json(
          { error: 'No workpapers provided' },
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

      // Save workpapers to database
      const workpapersData = workpapers.map((wp) => ({
        engagementId,
        task: wp.task,
        steps: wp.steps,
        evidences: wp.evidences,
        questionChecklist: wp.questionChecklist || '',
        comments: wp.comments || '',
        executed: wp.executed || false,
      }));

      const createdWorkpapers = await prisma.aiWorkpaper.createMany({
        data: workpapersData,
      });

      // Fetch the created workpapers to return with IDs
      const savedWorkpapers = await prisma.aiWorkpaper.findMany({
        where: { engagementId },
        orderBy: { createdAt: 'desc' },
        take: workpapers.length,
      });

      return NextResponse.json({
        workpapers: savedWorkpapers,
        message: `${createdWorkpapers.count} workpaper(s) added successfully`,
      });
    } catch (error) {
      console.error('Error adding AI workpapers:', error);
      return NextResponse.json(
        { error: 'Failed to add AI workpapers' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);

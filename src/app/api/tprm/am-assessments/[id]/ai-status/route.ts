import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/tprm/am-assessments/[id]/ai-status — Poll AI evaluation status
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, customerAccountId },
        select: {
          aiEvaluationStatus: true,
          aiEvaluationStarted: true,
          aiEvaluationCompleted: true,
          aiEvaluationError: true,
        },
      });

      if (!assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      return NextResponse.json(assessment);
    } catch (error) {
      console.error('AI Status error:', error);
      return NextResponse.json({ error: 'Failed to fetch AI status' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'view' }
);

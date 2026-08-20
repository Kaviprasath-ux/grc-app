import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId, verifyAMAccess } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { startAIEvaluation } from '@/lib/tprm-ai-evaluation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Match the ASR-side rerun stall threshold so both sides converge on
// the same "this run is dead, allow a restart" rule.
const STALLED_AI_EVALUATION_MS = 15 * 60 * 1000;

// POST /api/tprm/am-assessments/[id]/ai-evaluate
//
// AM/SME-facing retry for the AI evaluation. Two entry points:
//   1. Auto-run kicked by /submit failed — assessment sits at
//      status='Submitted', aiEvaluationStatus='Failed'. The Active-tab
//      surface shows a red "AI evaluation failed — Retry" pill; this is
//      the endpoint that pill posts to.
//   2. Auto-run hung — aiEvaluationStatus is stuck at
//      Pending/Ingesting/Evaluating with aiEvaluationStarted older than
//      STALLED_AI_EVALUATION_MS. Same UX from the AM's side.
//
// Under Review is intentionally excluded here: once the assessor has
// engaged, restarts flow through the assessor's /rerun-ai route so the
// audit log attributes the run to the right actor.
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: assessmentId } = await context.params;
      const customerAccountId = getCustomerAccountId(session);

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id: assessmentId, customerAccountId },
        select: {
          id: true,
          status: true,
          aiEvaluationStatus: true,
          aiEvaluationStarted: true,
          vendor: { select: { accountManagerEmail: true } },
        },
      });

      if (!assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      if (!await verifyAMAccess(session, assessment.vendor.accountManagerEmail)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      if (assessment.status !== 'Submitted') {
        return NextResponse.json(
          { error: 'AI retry is only available while the assessment is Submitted' },
          { status: 400 },
        );
      }

      // Only reject when the AI is clearly still running. A stuck run
      // past the stall window is what this endpoint exists to rescue,
      // so let it through.
      if (['Pending', 'Ingesting', 'Evaluating'].includes(assessment.aiEvaluationStatus || '')) {
        const startedAt = assessment.aiEvaluationStarted?.getTime() ?? null;
        const isStale = startedAt === null || Date.now() - startedAt > STALLED_AI_EVALUATION_MS;
        if (!isStale) {
          return NextResponse.json(
            { error: 'AI evaluation is already in progress' },
            { status: 409 },
          );
        }
      }

      const launched = await startAIEvaluation({
        assessmentId,
        customerAccountId,
        logMessage: `AI evaluation retried by AM/SME (${session.name || session.email})`,
      });

      if (!launched) {
        return NextResponse.json({ error: 'Missing customer or vendor data' }, { status: 400 });
      }

      return NextResponse.json({ message: 'AI evaluation re-triggered', status: 'Pending' });
    } catch (error) {
      console.error('AI Evaluate error:', error);
      return NextResponse.json({ error: 'Failed to trigger AI evaluation' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'edit' }
);

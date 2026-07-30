import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { startAIEvaluation } from '@/lib/tprm-ai-evaluation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/tprm/asr-assessments/[id]/rerun-ai — Re-run AI evaluation
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: assessmentId } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      console.log(`[ASR] POST /asr-assessments/${assessmentId}/rerun-ai — user=${session.email}`);

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id: assessmentId, customerAccountId },
        select: { id: true, vendorId: true, aiEvaluationStatus: true, aiEvaluationStarted: true },
      });

      if (!assessment) {
        console.warn(`[ASR] POST /asr-assessments/${assessmentId}/rerun-ai — 404 not found`);
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Don't allow re-run if currently in progress — unless the run is stale.
      // Evaluation is fire-and-forget, so a process recycle mid-run leaves the
      // assessment pinned at 'Evaluating' with no results and, previously, no
      // way out: every re-run attempt was rejected as "already in progress" and
      // the assessor could never get their Issue/Risk/Recommendation. Past the
      // stale window nobody is running that job, so allow a restart.
      // Keep STALLED_AI_EVALUATION_MS on the ASR detail page in sync.
      const STALLED_AI_EVALUATION_MS = 15 * 60 * 1000;
      if (['Pending', 'Ingesting', 'Evaluating'].includes(assessment.aiEvaluationStatus || '')) {
        const startedAt = assessment.aiEvaluationStarted?.getTime() ?? null;
        const isStale = startedAt === null || Date.now() - startedAt > STALLED_AI_EVALUATION_MS;
        if (!isStale) {
          console.warn(`[ASR] POST /asr-assessments/${assessmentId}/rerun-ai — 400 already in progress (${assessment.aiEvaluationStatus})`);
          return NextResponse.json({ error: 'AI evaluation is already in progress' }, { status: 400 });
        }
        console.warn(`[ASR] POST /asr-assessments/${assessmentId}/rerun-ai — restarting stalled run (${assessment.aiEvaluationStatus}, started=${assessment.aiEvaluationStarted?.toISOString() ?? 'unknown'})`);
      }

      // Clear prior verdicts, log, and fire — shared with the AM submit handler
      // so both paths run an identical evaluation.
      const launched = await startAIEvaluation({
        assessmentId,
        customerAccountId,
        logMessage: `AI evaluation re-triggered by assessor (${session.name || session.email})`,
      });

      if (!launched) {
        console.warn(`[ASR] POST /asr-assessments/${assessmentId}/rerun-ai — 400 missing customer/vendor data`);
        return NextResponse.json({ error: 'Missing customer or vendor data' }, { status: 400 });
      }

      console.log(`[ASR] POST /asr-assessments/${assessmentId}/rerun-ai — OK, AI evaluation started`);
      return NextResponse.json({ message: 'AI evaluation started', status: 'Pending' });
    } catch (error) {
      console.error(`[ASR] POST /asr-assessments/rerun-ai — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to re-run AI evaluation' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'edit' }
);

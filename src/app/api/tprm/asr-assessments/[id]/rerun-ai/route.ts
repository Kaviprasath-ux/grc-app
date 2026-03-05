import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { runAIEvaluation } from '@/lib/tprm-ai-evaluation';

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
        select: { id: true, vendorId: true, aiEvaluationStatus: true },
      });

      if (!assessment) {
        console.warn(`[ASR] POST /asr-assessments/${assessmentId}/rerun-ai — 404 not found`);
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Don't allow re-run if currently in progress
      if (['Pending', 'Ingesting', 'Evaluating'].includes(assessment.aiEvaluationStatus || '')) {
        console.warn(`[ASR] POST /asr-assessments/${assessmentId}/rerun-ai — 400 already in progress (${assessment.aiEvaluationStatus})`);
        return NextResponse.json({ error: 'AI evaluation is already in progress' }, { status: 400 });
      }

      // Clear existing AI results on responses
      await prisma.tPRMAssessmentResponse.updateMany({
        where: { assessmentId, customerAccountId },
        data: {
          poScore: null,
          poStatus: null,
          poAnswer: null,
          poIssue: null,
          poRisk: null,
          poRecommendation: null,
          poSeverity: null,
          aiEvaluatedAt: null,
          aiUuid: null,
        },
      });

      // Get vendor and customer info for evaluation context
      const customerAccount = await prisma.customerAccount.findUnique({
        where: { id: customerAccountId },
        select: { code: true },
      });

      const vendor = await prisma.tPRMVendor.findUnique({
        where: { id: assessment.vendorId },
        select: { vendorCode: true, engagementId: true },
      });

      if (!customerAccount || !vendor) {
        console.warn(`[ASR] POST /asr-assessments/${assessmentId}/rerun-ai — 400 missing customer/vendor data`);
        return NextResponse.json({ error: 'Missing customer or vendor data' }, { status: 400 });
      }

      // Log the re-run
      await prisma.tPRMAssessmentLog.create({
        data: {
          customerAccountId,
          assessmentId,
          logMessage: `AI evaluation re-triggered by assessor (${session.name || session.email})`,
          logDate: new Date(),
        },
      });

      // Fire AI evaluation asynchronously
      runAIEvaluation({
        assessmentId,
        customerAccountId,
        customerCode: customerAccount.code,
        vendorCode: vendor.vendorCode,
        engagementId: vendor.engagementId || assessmentId,
      }).catch(err => {
        console.error(`[ASR] POST /asr-assessments/${assessmentId}/rerun-ai — AI evaluation async error:`, err);
      });

      console.log(`[ASR] POST /asr-assessments/${assessmentId}/rerun-ai — OK, AI evaluation started (vendor=${vendor.vendorCode})`);
      return NextResponse.json({ message: 'AI evaluation started', status: 'Pending' });
    } catch (error) {
      console.error(`[ASR] POST /asr-assessments/rerun-ai — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to re-run AI evaluation' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'edit' }
);

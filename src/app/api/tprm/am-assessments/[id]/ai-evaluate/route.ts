import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId, verifyAMAccess } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { runAIEvaluation } from '@/lib/tprm-ai-evaluation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/tprm/am-assessments/[id]/ai-evaluate — Manual re-trigger AI evaluation
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: assessmentId } = await context.params;
      const customerAccountId = getCustomerAccountId(session);

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id: assessmentId, customerAccountId },
        include: {
          vendor: { select: { vendorCode: true, engagementId: true, accountManagerEmail: true } },
        },
      });

      if (!assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Verify AM/SME access
      if (!await verifyAMAccess(session, assessment.vendor.accountManagerEmail)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Only allow re-trigger if status is Submitted or AI evaluation previously failed/completed
      if (!['Submitted', 'Under Review'].includes(assessment.status)) {
        return NextResponse.json({ error: 'Assessment must be in Submitted status' }, { status: 400 });
      }

      // Check if AI evaluation is already running
      if (assessment.aiEvaluationStatus === 'Ingesting' || assessment.aiEvaluationStatus === 'Evaluating') {
        return NextResponse.json({ error: 'AI evaluation is already in progress' }, { status: 409 });
      }

      const customerAccount = await prisma.customerAccount.findUnique({
        where: { id: customerAccountId },
        select: { code: true },
      });

      if (!customerAccount) {
        return NextResponse.json({ error: 'Customer account not found' }, { status: 404 });
      }

      // Reset AI fields on all responses
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
          aiUuid: null,
          aiEvaluatedAt: null,
        },
      });

      // Fire AI evaluation (fire-and-forget)
      runAIEvaluation({
        assessmentId,
        customerAccountId,
        customerCode: customerAccount.code,
        vendorCode: assessment.vendor.vendorCode,
        engagementId: assessment.vendor.engagementId || assessmentId,
      }).catch(err => {
        console.error('[TPRM-AI] Re-trigger evaluation error:', err);
      });

      return NextResponse.json({ message: 'AI evaluation re-triggered', status: 'Pending' });
    } catch (error) {
      console.error('AI Evaluate error:', error);
      return NextResponse.json({ error: 'Failed to trigger AI evaluation' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'edit' }
);

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/tprm/asr-assessments/[id]/override — Override AI evaluation on a question
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { questionId, assessorStatus, assessorIssue, assessorRisk, assessorRecommendation, assessorComment, assessorSeverity } = body;
      console.log(`[ASR] POST /asr-assessments/${id}/override — user=${session.email} questionId=${questionId} status=${assessorStatus} severity=${assessorSeverity}`);

      if (!questionId) {
        console.warn(`[ASR] POST /asr-assessments/${id}/override — 400 missing questionId`);
        return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
      }

      // Verify assessment exists and belongs to tenant
      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, customerAccountId },
      });
      if (!assessment) {
        console.warn(`[ASR] POST /asr-assessments/${id}/override — 404 not found`);
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Update the response with assessor override
      const response = await prisma.tPRMAssessmentResponse.updateMany({
        where: { assessmentId: id, questionId, customerAccountId },
        data: {
          assessorStatus,
          assessorIssue: assessorIssue || null,
          assessorRisk: assessorRisk || null,
          assessorRecommendation: assessorRecommendation || null,
          assessorComment: assessorComment || null,
          assessorSeverity: assessorSeverity || null,
          assessorOverriddenAt: new Date(),
          assessorOverriddenById: session.id,
        },
      });

      // Create assessment log
      await prisma.tPRMAssessmentLog.create({
        data: {
          customerAccountId,
          assessmentId: id,
          questionNo: body.questionNo || null,
          questionTitle: body.questionTitle || null,
          logMessage: `Assessor overrode AI evaluation: ${assessorStatus}`,
          logDate: new Date(),
        },
      });

      console.log(`[ASR] POST /asr-assessments/${id}/override — OK, updated ${response.count} response(s) to ${assessorStatus}`);
      return NextResponse.json({ success: true, updated: response.count });
    } catch (error) {
      console.error(`[ASR] POST /asr-assessments/${id}/override — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to override' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'edit' }
);

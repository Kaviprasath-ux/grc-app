import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId, verifyAMAccess } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { runAIEvaluation } from '@/lib/tprm-ai-evaluation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/tprm/am-assessments/[id]/submit — Validate and submit assessment
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: assessmentId } = await context.params;
      const customerAccountId = getCustomerAccountId(session);

      // Load assessment with vendor verification
      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id: assessmentId, customerAccountId },
        include: {
          vendor: { select: { accountManagerEmail: true } },
          responses: true,
        },
      });

      if (!assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Verify AM/SME access
      if (!await verifyAMAccess(session, assessment.vendor.accountManagerEmail)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Check assessment is in a submittable state
      if (!['Draft', 'In Progress', 'In_Progress', 'Returned', 'Initiated', 'Awaiting_Response'].includes(assessment.status)) {
        return NextResponse.json({ error: `Cannot submit assessment in '${assessment.status}' status` }, { status: 400 });
      }

      // Validate mandatory questions are answered
      if (assessment.questionnaireTemplate) {
        const template = await prisma.tPRMQuestionnaireTemplate.findFirst({
          where: { customerAccountId, templateName: assessment.questionnaireTemplate },
          include: {
            masterQuestionLinks: {
              include: {
                question: { select: { id: true, mandatoryQuestion: true, mandatoryAttachment: true, questionText: true } },
              },
            },
          },
        });

        if (template) {
          const mandatoryQuestions = template.masterQuestionLinks
            .filter(link => link.question.mandatoryQuestion)
            .map(link => link.question);

          const responseMap = new Map(
            assessment.responses.map(r => [r.questionId, r])
          );

          const unanswered = mandatoryQuestions.filter(q => {
            const resp = responseMap.get(q.id);
            return !resp || !resp.response;
          });

          if (unanswered.length > 0) {
            return NextResponse.json({
              error: 'Please answer all mandatory questions before submitting',
              unansweredCount: unanswered.length,
              unansweredQuestions: unanswered.map(q => q.questionText.substring(0, 100)),
            }, { status: 400 });
          }

          // Check mandatory attachments
          const mandatoryAttachments = template.masterQuestionLinks
            .filter(link => link.question.mandatoryAttachment)
            .map(link => link.question);

          const missingAttachments = mandatoryAttachments.filter(q => {
            const resp = responseMap.get(q.id);
            return !resp || !resp.artifactUrl;
          });

          if (missingAttachments.length > 0) {
            return NextResponse.json({
              error: 'Please upload all mandatory attachments before submitting',
              missingCount: missingAttachments.length,
            }, { status: 400 });
          }
        }
      }

      // Update assessment status to "Submitted"
      const updated = await prisma.tPRMAssessment.update({
        where: { id: assessmentId },
        data: {
          status: 'Submitted',
          vendorSubmissionDate: new Date(),
        },
      });

      // Log the submission
      await prisma.tPRMAssessmentLog.create({
        data: {
          customerAccountId,
          assessmentId,
          logMessage: `Assessment submitted by Account Manager (${session.name || session.email})`,
          logDate: new Date(),
        },
      });

      // Fire AI evaluation asynchronously (fire-and-forget)
      const customerAccount = await prisma.customerAccount.findUnique({
        where: { id: customerAccountId },
        select: { code: true },
      });

      const vendor = await prisma.tPRMVendor.findUnique({
        where: { id: assessment.vendorId },
        select: { vendorCode: true, engagementId: true },
      });

      if (customerAccount && vendor) {
        runAIEvaluation({
          assessmentId,
          customerAccountId,
          customerCode: customerAccount.code,
          vendorCode: vendor.vendorCode,
          engagementId: vendor.engagementId || assessmentId,
        }).catch(err => {
          console.error('[TPRM-AI] Fire-and-forget evaluation error:', err);
        });
      }

      return NextResponse.json(updated);
    } catch (error) {
      console.error('AM Submit error:', error);
      return NextResponse.json({ error: 'Failed to submit assessment' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'edit' }
);

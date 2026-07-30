import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId, verifyAMAccess } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { startAIEvaluation } from '@/lib/tprm-ai-evaluation';
import { notificationService } from '@/lib/notification-service';

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
      if (!['Draft', 'In Progress', 'In-Progress', 'Initiated', 'Awaiting_Response'].includes(assessment.status)) {
        return NextResponse.json({ error: `Cannot submit assessment in '${assessment.status}' status` }, { status: 400 });
      }

      // Validate mandatory questions + attachments before allowing submission.
      //
      // `questionnaireTemplate` may hold several comma-separated template names
      // (the initiation UI joins multi-selected templates with ", "). Resolving
      // it with a single exact-match `findFirst` returned null for any
      // multi-template assessment, which silently skipped ALL validation and
      // let the AM submit with unanswered mandatory questions and missing
      // mandatory documents. Mirror the GET route: split the names, match every
      // one, and aggregate their questions de-duplicated by id.
      if (assessment.questionnaireTemplate) {
        const templateNames = assessment.questionnaireTemplate
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

        const templates = await prisma.tPRMQuestionnaireTemplate.findMany({
          where: { customerAccountId, templateName: { in: templateNames } },
          include: {
            masterQuestionLinks: {
              include: {
                question: { select: { id: true, mandatoryQuestion: true, mandatoryAttachment: true, questionText: true } },
              },
            },
          },
        });

        // De-duplicate questions by id (the same question can appear in more
        // than one selected template).
        const questionMap = new Map<string, { id: string; mandatoryQuestion: boolean; mandatoryAttachment: boolean; questionText: string }>();
        for (const t of templates) {
          for (const link of t.masterQuestionLinks) {
            if (!questionMap.has(link.question.id)) questionMap.set(link.question.id, link.question);
          }
        }
        const allQuestions = Array.from(questionMap.values());

        const responseMap = new Map(
          assessment.responses.map(r => [r.questionId, r])
        );

        // Mandatory questions must have a response.
        const unanswered = allQuestions
          .filter(q => q.mandatoryQuestion)
          .filter(q => {
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

        // Mandatory attachments must have an uploaded artifact.
        const missingAttachments = allQuestions
          .filter(q => q.mandatoryAttachment)
          .filter(q => {
            const resp = responseMap.get(q.id);
            return !resp || !resp.artifactUrl;
          });

        if (missingAttachments.length > 0) {
          return NextResponse.json({
            error: 'Please upload all mandatory documents before submitting',
            missingCount: missingAttachments.length,
            missingQuestions: missingAttachments.map(q => q.questionText.substring(0, 100)),
          }, { status: 400 });
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

      // Fire AI evaluation asynchronously (fire-and-forget), through the same
      // launcher the assessor's rerun-ai route uses — clears any prior verdicts,
      // logs the trigger, then starts the run. This is what puts Issue / Risk /
      // Recommendation in front of the assessor without them asking for it.
      await startAIEvaluation({
        assessmentId,
        customerAccountId,
        logMessage: `AI evaluation triggered by Account Manager submission (${session.name || session.email})`,
      });

      // Get vendor name for notifications
      const vendor = await prisma.tPRMVendor.findUnique({
        where: { id: assessment.vendorId },
        select: { vendorCode: true },
      });
      const vendorName = vendor?.vendorCode || assessment.vendorId;

      // Notify the assessor (if assigned) that assessment has been submitted
      if (assessment.assessorId) {
        void notificationService.notifyTPRMAssessmentSubmitted({
          customerAccountId,
          actorId: session.id,
          recipientId: assessment.assessorId,
          assessmentId,
          assessmentCode: assessment.assessmentCode,
          vendorName,
        });
      }

      // Notify the initiator (if different from submitter and assessor)
      if (assessment.initiatedById && assessment.initiatedById !== session.id && assessment.initiatedById !== assessment.assessorId) {
        void notificationService.notifyTPRMAssessmentSubmitted({
          customerAccountId,
          actorId: session.id,
          recipientId: assessment.initiatedById,
          assessmentId,
          assessmentCode: assessment.assessmentCode,
          vendorName,
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

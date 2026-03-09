import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { notificationService } from '@/lib/notification-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/tprm/asr-assessments/[id]/complete — Complete or return assessment
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { action, comment } = body;
      console.log(`[ASR] POST /asr-assessments/${id}/complete — user=${session.email} action=${action}`);

      if (!action || !['complete', 'return', 'approve', 'return_to_assessor', 'send_to_approver'].includes(action)) {
        console.warn(`[ASR] POST /asr-assessments/${id}/complete — 400 invalid action="${action}"`);
        return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
      }

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, customerAccountId },
        select: { id: true, assessmentCode: true, vendorId: true, status: true, initiatedById: true, assessorId: true, questionnaireTemplate: true },
      });
      if (!assessment) {
        console.warn(`[ASR] POST /asr-assessments/${id}/complete — 404 not found`);
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Check for open clarifications before send_to_approver or approve
      if (action === 'send_to_approver' || action === 'approve') {
        const openClarifications = await prisma.tPRMClarification.count({
          where: { assessmentId: id, customerAccountId, status: { notIn: ['Closed', 'Submitted'] } },
        });
        if (openClarifications > 0) {
          const msg = action === 'approve'
            ? `Cannot approve: ${openClarifications} clarification(s) are still open.`
            : `Cannot send to approver: ${openClarifications} clarification(s) are still open.`;
          return NextResponse.json({ error: msg }, { status: 400 });
        }
      }

      const updateData: Record<string, unknown> = {};
      let logMessage = '';

      if (action === 'send_to_approver') {
        const { approverId } = body;
        if (!approverId) {
          return NextResponse.json({ error: 'Approver is required' }, { status: 400 });
        }
        updateData.status = 'In-Progress(approver)';
        updateData.approverId = approverId;
        updateData.assessorCompletionDate = new Date();
        // Look up approver name for log
        const approverUser = await prisma.user.findUnique({ where: { id: approverId }, select: { fullName: true } });
        logMessage = `Assessment sent to approver ${approverUser?.fullName || approverId} by ${session.name || session.email}`;
      } else if (action === 'complete') {
        updateData.status = 'Reviewed';
        updateData.assessorCompletionDate = new Date();
        logMessage = 'Assessment marked as Reviewed by assessor';
      } else if (action === 'approve') {
        updateData.status = 'Approved';
        updateData.approvalDate = new Date();
        updateData.assessmentResult = body.assessmentResult || null;
        logMessage = `Assessment approved by ${session.name || session.email}`;
      } else if (action === 'return_to_assessor') {
        updateData.status = 'Returned';
        updateData.approverComment = comment || '';
        logMessage = `Assessment returned to assessor by ${session.name || session.email}: ${comment || 'No comment'}`;
      } else {
        updateData.status = 'Returned';
        updateData.approverComment = comment || '';
        logMessage = `Assessment returned by assessor: ${comment || 'No comment'}`;
      }

      const updated = await prisma.tPRMAssessment.update({
        where: { id },
        data: updateData,
      });

      // When approved, set vendor status to Inactive and create issue remediations
      if (action === 'approve') {
        await prisma.tPRMVendor.update({
          where: { id: assessment.vendorId },
          data: { status: 'Inactive' },
        });

        // Create issue remediations from unsatisfactory responses
        const responses = await prisma.tPRMAssessmentResponse.findMany({
          where: { assessmentId: id, customerAccountId },
          include: {
            assessment: {
              include: {
                vendor: { select: { name: true } },
              },
            },
          },
        });

        // Load question texts via the template
        const questionMap = new Map<string, { questionText: string; domainName: string }>();
        if (assessment.questionnaireTemplate) {
          const template = await prisma.tPRMQuestionnaireTemplate.findFirst({
            where: { customerAccountId, templateName: assessment.questionnaireTemplate },
            include: {
              masterQuestionLinks: {
                include: {
                  question: {
                    select: { id: true, questionText: true, domain: { select: { name: true } } },
                  },
                },
              },
            },
          });
          if (template) {
            for (const link of template.masterQuestionLinks) {
              questionMap.set(link.question.id, {
                questionText: link.question.questionText,
                domainName: link.question.domain?.name || '',
              });
            }
          }
        }

        const now = new Date();
        const issueData = responses
          .filter(r => {
            // Use assessor override status if available, otherwise AI status
            const status = r.assessorStatus || r.poStatus;
            return status === 'Unsatisfactory';
          })
          .map(r => {
            const severity = r.assessorSeverity || r.poSeverity || 'Medium';
            const dueDays = severity === 'High' ? 60 : severity === 'Medium' ? 50 : 40;
            const dueDate = new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000);
            const qInfo = questionMap.get(r.questionId);
            return {
              customerAccountId,
              assessmentId: id,
              questionNo: r.questionNo || '',
              questionText: qInfo?.questionText || '',
              questionResponse: r.response || '',
              domainName: qInfo?.domainName || r.domainId || '',
              severity,
              issue: r.assessorIssue || r.poIssue || '',
              risk: r.assessorRisk || r.poRisk || '',
              recommendation: r.assessorRecommendation || r.poRecommendation || '',
              description: r.assessorIssue || r.poIssue || '',
              requestedDate: now,
              dueDate,
              status: 'Pending',
            };
          });

        if (issueData.length > 0) {
          // Remove duplicates: skip if remediation already exists for this assessment+questionNo
          const existingRems = await prisma.tPRMIssueRemediation.findMany({
            where: { customerAccountId, assessmentId: id },
            select: { questionNo: true },
          });
          const existingQNos = new Set(existingRems.map(r => r.questionNo));
          const newIssueData = issueData.filter(d => !existingQNos.has(d.questionNo));

          if (newIssueData.length === 0) {
            console.log(`[ASR] All ${issueData.length} remediations already exist for assessment ${id}, skipping`);
          } else {
          // Get the last issue code number for this customer
          const lastIssue = await prisma.tPRMIssueRemediation.findFirst({
            where: { customerAccountId },
            orderBy: { createdAt: 'desc' },
            select: { issueCode: true },
          });
          let nextNum = 1;
          if (lastIssue?.issueCode) {
            const match = lastIssue.issueCode.match(/ISS-(\d+)/);
            if (match) nextNum = parseInt(match[1]) + 1;
          }
          for (const data of newIssueData) {
            const issueCode = `ISS-${String(nextNum).padStart(3, '0')}`;
            await prisma.tPRMIssueRemediation.create({ data: { ...data, issueCode } });
            nextNum++;
          }
          console.log(`[ASR] Created ${newIssueData.length} issue remediations for assessment ${id}`);
          }
        }
      }

      // Log
      await prisma.tPRMAssessmentLog.create({
        data: {
          customerAccountId,
          assessmentId: id,
          logMessage,
          logDate: new Date(),
        },
      });

      // Notify the initiator/account manager about completion or return
      if (assessment.initiatedById) {
        if (action === 'complete') {
          void notificationService.notifyTPRMAssessmentCompleted({
            customerAccountId,
            actorId: session.id,
            recipientId: assessment.initiatedById,
            assessmentId: id,
            assessmentCode: assessment.assessmentCode,
            vendorName: assessment.vendorId, // Will be resolved below
          });
        } else {
          void notificationService.notifyTPRMAssessmentReturned({
            customerAccountId,
            actorId: session.id,
            recipientId: assessment.initiatedById,
            assessmentId: id,
            assessmentCode: assessment.assessmentCode,
            vendorName: assessment.vendorId,
            comment: comment || undefined,
          });
        }
      }

      // Also look up vendor name & AM to send more useful notifications
      const vendor = await prisma.tPRMVendor.findUnique({
        where: { id: assessment.vendorId },
        select: { name: true, accountManagerEmail: true },
      });

      // Notify account manager (if different from initiator)
      if (vendor?.accountManagerEmail) {
        const am = await prisma.user.findFirst({
          where: {
            customerAccountId,
            email: { equals: vendor.accountManagerEmail.split(';')[0].trim(), mode: 'insensitive' },
            isActive: true,
          },
          select: { id: true },
        });
        if (am && am.id !== assessment.initiatedById) {
          if (action === 'complete') {
            void notificationService.notifyTPRMAssessmentCompleted({
              customerAccountId,
              actorId: session.id,
              recipientId: am.id,
              assessmentId: id,
              assessmentCode: assessment.assessmentCode,
              vendorName: vendor.name,
            });
          } else {
            void notificationService.notifyTPRMAssessmentReturned({
              customerAccountId,
              actorId: session.id,
              recipientId: am.id,
              assessmentId: id,
              assessmentCode: assessment.assessmentCode,
              vendorName: vendor.name,
              comment: comment || undefined,
            });
          }
        }
      }

      console.log(`[ASR] POST /asr-assessments/${id}/complete — OK, action=${action} newStatus=${updated.status}`);
      return NextResponse.json(updated);
    } catch (error) {
      console.error(`[ASR] POST /asr-assessments/complete — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to complete assessment' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'edit' }
);

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { notificationService } from '@/lib/notification-service';
import { translateRecord } from '@/lib/translation-service';

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
        // Carry the assessor's overall verdict into the next stage so
        // the approver inherits it. Previously this only got written on
        // 'approve', so the approver loaded a blank result and the UI
        // defaulted to "Satisfactory".
        if (body.assessmentResult) {
          updateData.assessmentResult = body.assessmentResult;
        }
        // Look up approver name for log
        const approverUser = await prisma.user.findUnique({ where: { id: approverId }, select: { fullName: true } });
        logMessage = `Assessment sent to approver ${approverUser?.fullName || approverId} by ${session.name || session.email}`;
      } else if (action === 'complete') {
        updateData.status = 'Reviewed';
        updateData.assessorCompletionDate = new Date();
        if (body.assessmentResult) {
          updateData.assessmentResult = body.assessmentResult;
        }
        logMessage = 'Assessment marked as Reviewed by assessor';
      } else if (action === 'approve') {
        updateData.status = 'Approved';
        updateData.approvalDate = new Date();
        // Consistent with send_to_approver / complete: only update the
        // verdict when the caller explicitly provides one. Prior code
        // wiped to null on empty, which would clobber the verdict the
        // assessor set earlier in send_to_approver — leaving the
        // Approved row with no recorded result.
        if (body.assessmentResult) {
          updateData.assessmentResult = body.assessmentResult;
        }
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

      // Fire-and-forget translation for approverComment (user-entered text on return actions)
      if (customerAccountId && (action === 'return_to_assessor' || action === 'return') && comment) {
        void translateRecord(customerAccountId, 'TPRMAssessment', id, {
          approverComment: comment,
        });
      }

      // Notify approver when assessment is sent to them
      if (action === 'send_to_approver') {
        const { approverId } = body;
        const vendor = await prisma.tPRMVendor.findUnique({
          where: { id: assessment.vendorId },
          select: { name: true },
        });
        void notificationService.notifyTPRMAssessmentSentToApprover({
          customerAccountId,
          actorId: session.id,
          approverId,
          assessmentId: id,
          assessmentCode: assessment.assessmentCode,
          vendorName: vendor?.name || assessment.vendorId,
        });
      }

      // When approved, advance the vendor's lifecycle and create
      // issue remediations from any response-level Unsatisfactory
      // findings.
      //
      // Vendor lifecycle in this codebase is broader than the schema
      // comment suggests: in addition to Onboarding/Onboarded/
      // Offboarding/Offboarded, the contract-upload flow relies on
      // "Inactive" as the "cleared-but-not-yet-contracted" state (the
      // /vendors/[id]/contract route flips Inactive → Active on
      // contract upload, and the inventory pages only render the
      // "Add Contract" button when status === "Inactive"). Setting
      // the wrong value on approve silently hides the Add-Contract
      // button — a real bug raised after the previous comment-based
      // refactor; reverting to match the contract flow.
      //
      // Workflow per result:
      //   Satisfactory   → Inactive (cleared, contract upload will activate)
      //   Unsatisfactory → Inactive (cleared with remediations, contract still allowed)
      //   Deficient      → Onboarding kept (NOT cleared; engagement
      //                    must not proceed until issues remediated)
      if (action === 'approve') {
        // Prefer the body's verdict, but fall back to what was already
        // persisted on the assessment (set by send_to_approver) so the
        // approver isn't required to re-submit the same value.
        const persistedResult = (
          await prisma.tPRMAssessment.findUnique({
            where: { id },
            select: { assessmentResult: true },
          })
        )?.assessmentResult ?? null;
        const result = (body.assessmentResult as string | undefined) || persistedResult || null;
        const nextVendorStatus =
          result === 'Deficient' ? 'Onboarding'
          : (result === 'Satisfactory' || result === 'Unsatisfactory') ? 'Inactive'
          // No verdict at all — don't silently clear the vendor; leave
          // them in Onboarding until someone records an outcome.
          : 'Onboarding';
        await prisma.tPRMVendor.update({
          where: { id: assessment.vendorId },
          data: { status: nextVendorStatus },
        });

        // Load cadence/remediation config to calculate due dates
        const ddConfig = await prisma.tPRMConfiguration.findUnique({
          where: { customerAccountId },
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

        // Helper: map remediation severity to config remediation days
        const getRemediationDays = (severity: string): number => {
          const cfg = ddConfig as Record<string, unknown> | null;
          if (!cfg) {
            // Fallback defaults
            if (severity === 'Critical') return 7;
            if (severity === 'High') return 14;
            if (severity === 'Medium') return 30;
            return 60; // Low
          }
          if (severity === 'Critical') return (cfg.remediationCritical as number) || 7;
          if (severity === 'High') return (cfg.remediationHigh as number) || 14;
          if (severity === 'Medium') return (cfg.remediationModerate as number) || 30;
          if (severity === 'Low') return (cfg.remediationLow as number) || 60;
          return (cfg.remediationModerate as number) || 30;
        };

        const now = new Date();
        const issueData = responses
          .filter(r => {
            // Use assessor override status if available, otherwise AI status
            const status = r.assessorStatus || r.poStatus;
            return status === 'Unsatisfactory';
          })
          .map(r => {
            const severity = r.assessorSeverity || r.poSeverity || 'Medium';
            const dueDays = getRemediationDays(severity);
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

        let newIssueCount = 0;
        if (issueData.length > 0) {
          // Re-approval after a return cycle is now common: the
          // assessor may have edited severity/issue/risk/recommendation
          // text on the second pass. Existing remediations get UPDATED
          // (severity, text, due date) instead of being silently skipped
          // by a questionNo dedup. Only brand-new ones get a new
          // ISS-* code.
          const existingRems = await prisma.tPRMIssueRemediation.findMany({
            where: { customerAccountId, assessmentId: id },
            select: { id: true, questionNo: true, status: true },
          });
          const existingByQNo = new Map(existingRems.map((r) => [r.questionNo, r]));

          const updates = issueData.filter((d) => existingByQNo.has(d.questionNo));
          const newIssueData = issueData.filter((d) => !existingByQNo.has(d.questionNo));
          newIssueCount = newIssueData.length;

          // Refresh existing remediations that aren't already closed —
          // don't reopen Closed/Satisfied items, just keep the
          // assessor's latest verdict on still-open ones.
          for (const d of updates) {
            const existing = existingByQNo.get(d.questionNo)!;
            if (existing.status === 'Closed' || existing.status === 'Satisfied') continue;
            await prisma.tPRMIssueRemediation.update({
              where: { id: existing.id },
              data: {
                severity: d.severity,
                issue: d.issue,
                risk: d.risk,
                recommendation: d.recommendation,
                description: d.description,
                dueDate: d.dueDate,
              },
            });
          }

          if (newIssueData.length === 0) {
            console.log(`[ASR] ${updates.length} remediation(s) refreshed; no new ones to create for assessment ${id}`);
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
            const createdRemediation = await prisma.tPRMIssueRemediation.create({ data: { ...data, issueCode } });
            // Fire-and-forget translation for user-entered text in issue remediation
            if (customerAccountId) {
              void translateRecord(customerAccountId, 'TPRMIssueRemediation', createdRemediation.id, {
                issue: createdRemediation.issue,
                risk: createdRemediation.risk,
                recommendation: createdRemediation.recommendation,
                description: createdRemediation.description,
              });
            }
            nextNum++;
          }
          console.log(`[ASR] Created ${newIssueData.length} issue remediations for assessment ${id}`);
          }
        }

        // Notify about approval
        const approvalRecipients: string[] = [];
        if (assessment.initiatedById) approvalRecipients.push(assessment.initiatedById);
        // Also resolve AM from vendor
        const vendorForApproval = await prisma.tPRMVendor.findUnique({
          where: { id: assessment.vendorId },
          select: { name: true, accountManagerEmail: true },
        });
        if (vendorForApproval?.accountManagerEmail) {
          const amUser = await prisma.user.findFirst({
            where: { customerAccountId, email: { equals: vendorForApproval.accountManagerEmail.split(';')[0].trim(), mode: 'insensitive' }, isActive: true },
            select: { id: true },
          });
          if (amUser && !approvalRecipients.includes(amUser.id)) approvalRecipients.push(amUser.id);
        }
        if (assessment.assessorId && !approvalRecipients.includes(assessment.assessorId)) approvalRecipients.push(assessment.assessorId);

        if (approvalRecipients.length > 0) {
          void notificationService.notifyTPRMAssessmentApproved({
            customerAccountId,
            actorId: session.id,
            recipientIds: approvalRecipients,
            assessmentId: id,
            assessmentCode: assessment.assessmentCode,
            vendorName: vendorForApproval?.name || assessment.vendorId,
          });
        }

        // Notify about remediations created
        if (newIssueCount > 0 && approvalRecipients.length > 0) {
          void notificationService.notifyTPRMRemediationCreated({
            customerAccountId,
            actorId: session.id,
            recipientIds: approvalRecipients,
            assessmentId: id,
            assessmentCode: assessment.assessmentCode,
            vendorName: vendorForApproval?.name || assessment.vendorId,
            count: newIssueCount,
          });
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

      // Notify the appropriate recipient based on action:
      //   complete            -> initiator/AM (assessor finished review)
      //   return              -> initiator/AM (assessor sent it back for fixes)
      //   return_to_assessor  -> assessor (approver sent it back to assessor)
      if (action === 'complete' && assessment.initiatedById) {
        void notificationService.notifyTPRMAssessmentCompleted({
          customerAccountId,
          actorId: session.id,
          recipientId: assessment.initiatedById,
          assessmentId: id,
          assessmentCode: assessment.assessmentCode,
          vendorName: assessment.vendorId, // Will be resolved below
        });
      } else if (action === 'return' && assessment.initiatedById) {
        void notificationService.notifyTPRMAssessmentReturned({
          customerAccountId,
          actorId: session.id,
          recipientId: assessment.initiatedById,
          assessmentId: id,
          assessmentCode: assessment.assessmentCode,
          vendorName: assessment.vendorId,
          comment: comment || undefined,
        });
      } else if (action === 'return_to_assessor' && assessment.assessorId) {
        void notificationService.notifyTPRMAssessmentReturnedToAssessor({
          customerAccountId,
          actorId: session.id,
          recipientId: assessment.assessorId,
          assessmentId: id,
          assessmentCode: assessment.assessmentCode,
          vendorName: assessment.vendorId,
          comment: comment || undefined,
        });
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
          } else if (action === 'return' || action === 'return_to_assessor') {
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

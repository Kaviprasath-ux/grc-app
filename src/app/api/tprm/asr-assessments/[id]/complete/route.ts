import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

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
      });
      if (!assessment) {
        console.warn(`[ASR] POST /asr-assessments/${id}/complete — 404 not found`);
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Check for open clarifications before send_to_approver or approve
      if (action === 'send_to_approver' || action === 'approve') {
        const openClarifications = await prisma.tPRMClarification.count({
          where: { assessmentId: id, customerAccountId, status: { not: 'Closed' } },
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

      // Log
      await prisma.tPRMAssessmentLog.create({
        data: {
          customerAccountId,
          assessmentId: id,
          logMessage,
          logDate: new Date(),
        },
      });

      console.log(`[ASR] POST /asr-assessments/${id}/complete — OK, action=${action} newStatus=${updated.status}`);
      return NextResponse.json(updated);
    } catch (error) {
      console.error(`[ASR] POST /asr-assessments/complete — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to complete assessment' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'edit' }
);

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { notificationService, NOTIFICATION_EVENTS } from '@/lib/notification-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/tprm/asr-assessments/[id]/assign — Assign assessment to an assessor
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { assessorId, approverId } = body;
      console.log(`[ASR] POST /asr-assessments/${id}/assign — user=${session.email} assessorId=${assessorId} approverId=${approverId}`);

      if (!assessorId && !approverId) {
        console.warn(`[ASR] POST /asr-assessments/${id}/assign — 400 missing assessorId or approverId`);
        return NextResponse.json({ error: 'assessorId or approverId is required' }, { status: 400 });
      }

      // Verify assessment exists and belongs to tenant
      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, customerAccountId },
      });
      if (!assessment) {
        console.warn(`[ASR] POST /asr-assessments/${id}/assign — 404 assessment not found`);
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Handle approver reassignment
      if (approverId) {
        const approver = await prisma.user.findFirst({
          where: { id: approverId, customerAccountId },
          select: { id: true, fullName: true },
        });
        if (!approver) {
          return NextResponse.json({ error: 'Approver not found' }, { status: 404 });
        }

        const updated = await prisma.tPRMAssessment.update({
          where: { id },
          data: { approverId },
          include: {
            vendor: { select: { id: true, name: true, vendorCode: true, serviceCategory: true } },
            approver: { select: { id: true, fullName: true } },
          },
        });

        await prisma.tPRMAssessmentLog.create({
          data: {
            customerAccountId,
            assessmentId: id,
            logMessage: `Assessment reassigned to approver ${approver.fullName} by ${session.name || session.email}`,
            logDate: new Date(),
          },
        });

        console.log(`[ASR] POST /asr-assessments/${id}/assign — OK, approver reassigned to ${approver.fullName}`);
        return NextResponse.json(updated);
      }

      // Handle assessor assignment/reassignment
      const assessor = await prisma.user.findFirst({
        where: { id: assessorId, customerAccountId },
        select: { id: true, fullName: true },
      });
      if (!assessor) {
        console.warn(`[ASR] POST /asr-assessments/${id}/assign — 404 assessor not found (assessorId=${assessorId})`);
        return NextResponse.json({ error: 'Assessor not found' }, { status: 404 });
      }

      // Assign the assessor and set status to Under Review
      const updated = await prisma.tPRMAssessment.update({
        where: { id },
        data: {
          assessorId,
          status: assessment.status === 'Submitted' ? 'Under Review' : assessment.status,
        },
        include: {
          vendor: { select: { id: true, name: true, vendorCode: true, serviceCategory: true } },
          assessor: { select: { id: true, fullName: true } },
        },
      });

      // Log the assignment
      await prisma.tPRMAssessmentLog.create({
        data: {
          customerAccountId,
          assessmentId: id,
          logMessage: `Assessment ${assessment.assessorId ? 'reassigned' : 'assigned'} to ${assessor.fullName} by ${session.name || session.email}`,
          logDate: new Date(),
        },
      });

      // Notify the assessor about assignment
      const isReassignment = assessment.assessorId && assessment.assessorId !== assessorId;
      void notificationService.notifyTPRMAssessmentAssigned({
        customerAccountId,
        actorId: session.id,
        assessorId,
        assessmentId: id,
        assessmentCode: updated.vendor?.vendorCode ? `${assessment.assessmentCode}` : assessment.assessmentCode,
        vendorName: updated.vendor?.name || '',
      });

      // If reassigned, notify the previous assessor too
      if (isReassignment && assessment.assessorId) {
        void notificationService.send({
          customerAccountId,
          actorId: session.id,
          recipientId: assessment.assessorId,
          event: NOTIFICATION_EVENTS.TPRM_ASSESSMENT_REASSIGNED,
          title: 'Assessment reassigned',
          message: `Assessment ${assessment.assessmentCode} has been reassigned to ${assessor.fullName}.`,
          relatedEntityType: 'assessment',
          relatedEntityId: id,
          link: `/tprm/asr-assessments`,
        });
      }

      console.log(`[ASR] POST /asr-assessments/${id}/assign — OK, assigned to ${assessor.fullName}, status=${updated.status}`);
      return NextResponse.json(updated);
    } catch (error) {
      console.error(`[ASR] POST /asr-assessments/assign — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to assign assessment' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'edit' }
);

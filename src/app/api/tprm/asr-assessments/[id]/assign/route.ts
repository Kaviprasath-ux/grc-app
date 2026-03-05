import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

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
      const { assessorId } = body;
      console.log(`[ASR] POST /asr-assessments/${id}/assign — user=${session.email} assessorId=${assessorId}`);

      if (!assessorId) {
        console.warn(`[ASR] POST /asr-assessments/${id}/assign — 400 missing assessorId`);
        return NextResponse.json({ error: 'assessorId is required' }, { status: 400 });
      }

      // Verify assessment exists and belongs to tenant
      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, customerAccountId },
      });
      if (!assessment) {
        console.warn(`[ASR] POST /asr-assessments/${id}/assign — 404 assessment not found`);
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Verify the target assessor belongs to the same customer
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
          logMessage: `Assessment assigned to ${assessor.fullName}`,
          logDate: new Date(),
        },
      });

      console.log(`[ASR] POST /asr-assessments/${id}/assign — OK, assigned to ${assessor.fullName}, status=${updated.status}`);
      return NextResponse.json(updated);
    } catch (error) {
      console.error(`[ASR] POST /asr-assessments/${id}/assign — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to assign assessment' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'edit' }
);

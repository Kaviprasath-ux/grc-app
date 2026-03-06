import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { notificationService } from '@/lib/notification-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/tprm/asr-assessments/[id]/clarification — Get clarifications
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const questionNo = searchParams.get('questionNo');
      console.log(`[ASR] GET /asr-assessments/${id}/clarification — user=${session.email} questionNo=${questionNo || 'all'}`);

      const where: Record<string, unknown> = { assessmentId: id, customerAccountId };
      if (questionNo) where.questionNo = questionNo;

      const clarifications = await prisma.tPRMClarification.findMany({
        where,
        include: {
          requestedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      console.log(`[ASR] GET /asr-assessments/${id}/clarification — OK, returned ${clarifications.length} clarifications`);
      return NextResponse.json(clarifications);
    } catch (error) {
      console.error(`[ASR] GET /asr-assessments/clarification — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to fetch clarifications' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'view' }
);

// POST /api/tprm/asr-assessments/[id]/clarification — Request clarification
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { questionNo, domainName, rejectComment } = body;
      console.log(`[ASR] POST /asr-assessments/${id}/clarification — user=${session.email} questionNo=${questionNo} domain=${domainName}`);

      // Verify assessment exists
      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, customerAccountId },
        select: { id: true, assessmentCode: true, vendorId: true },
      });
      if (!assessment) {
        console.warn(`[ASR] POST /asr-assessments/${id}/clarification — 404 not found`);
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      const clarification = await prisma.tPRMClarification.create({
        data: {
          customerAccountId,
          assessmentId: id,
          questionNo: questionNo || null,
          domainName: domainName || null,
          rejectComment: rejectComment || '',
          status: 'Pending',
          requestedById: session.id,
        },
        include: {
          requestedBy: { select: { id: true, fullName: true } },
        },
      });

      // Log the clarification request
      await prisma.tPRMAssessmentLog.create({
        data: {
          customerAccountId,
          assessmentId: id,
          questionNo: questionNo || null,
          logMessage: `Clarification requested: ${rejectComment?.substring(0, 100) || ''}`,
          logDate: new Date(),
        },
      });

      // Notify account manager about clarification request
      const vendor = await prisma.tPRMVendor.findUnique({
        where: { id: assessment.vendorId },
        select: { name: true, accountManagerEmail: true },
      });

      if (vendor?.accountManagerEmail) {
        const am = await prisma.user.findFirst({
          where: {
            customerAccountId,
            email: { equals: vendor.accountManagerEmail.split(';')[0].trim(), mode: 'insensitive' },
            isActive: true,
          },
          select: { id: true },
        });
        if (am) {
          void notificationService.notifyTPRMClarificationRequested({
            customerAccountId,
            actorId: session.id,
            recipientId: am.id,
            assessmentId: id,
            assessmentCode: assessment.assessmentCode,
            vendorName: vendor.name,
            comment: rejectComment?.substring(0, 200) || undefined,
          });
        }
      }

      console.log(`[ASR] POST /asr-assessments/${id}/clarification — OK, created clarification id=${clarification.id}`);
      return NextResponse.json(clarification);
    } catch (error) {
      console.error(`[ASR] POST /asr-assessments/clarification — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to create clarification' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'edit' }
);

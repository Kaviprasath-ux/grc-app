import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId, getAMEmail } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { translateRecord } from '@/lib/translation-service';
import { notificationService } from '@/lib/notification-service';

// GET /api/tprm/am-follow-ups/clarifications — List clarifications for AM's assessments
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status') || 'Pending';

      // Find AM's vendor assessments (resolves SME → parent AM email)
      const userEmail = await getAMEmail(session);
      if (!userEmail) {
        return NextResponse.json({ data: [] });
      }

      const vendors = await prisma.tPRMVendor.findMany({
        where: {
          customerAccountId,
          accountManagerEmail: { contains: userEmail, mode: 'insensitive' },
        },
        select: { id: true },
      });

      const vendorIds = vendors.map(v => v.id);
      if (vendorIds.length === 0) {
        return NextResponse.json({ data: [] });
      }

      const assessments = await prisma.tPRMAssessment.findMany({
        where: { customerAccountId, vendorId: { in: vendorIds } },
        select: { id: true },
      });

      const assessmentIds = assessments.map(a => a.id);

      const clarifications = await prisma.tPRMClarification.findMany({
        where: {
          customerAccountId,
          assessmentId: { in: assessmentIds },
          status,
        },
        include: {
          assessment: {
            select: { assessmentCode: true, vendor: { select: { name: true } } },
          },
          customerAccount: { select: { name: true } },
          requestedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ data: clarifications });
    } catch (error) {
      console.error('AM Clarifications GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch clarifications' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'view' }
);

// PATCH /api/tprm/am-follow-ups/clarifications — Respond to a clarification
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { id, amResponse } = body;

      if (!id || !amResponse?.trim()) {
        return NextResponse.json({ error: 'ID and response are required' }, { status: 400 });
      }

      const clarification = await prisma.tPRMClarification.findFirst({
        where: { id, customerAccountId },
      });

      if (!clarification) {
        return NextResponse.json({ error: 'Clarification not found' }, { status: 404 });
      }

      const updated = await prisma.tPRMClarification.update({
        where: { id },
        data: {
          amResponse,
          status: 'Submitted',
        },
      });

      // Fire-and-forget dynamic translation
      if (customerAccountId) void translateRecord(customerAccountId, 'TPRMClarification', updated.id, { rejectComment: updated.rejectComment, amResponse: updated.amResponse });

      // Notify the assessor who requested the clarification
      if (clarification.requestedById) {
        const assessment = await prisma.tPRMAssessment.findFirst({
          where: { id: clarification.assessmentId, customerAccountId },
          select: { assessmentCode: true, vendorId: true },
        });
        const vendor = assessment?.vendorId
          ? await prisma.tPRMVendor.findUnique({ where: { id: assessment.vendorId }, select: { name: true } })
          : null;
        void notificationService.notifyTPRMClarificationResponded({
          customerAccountId,
          actorId: session.id,
          recipientId: clarification.requestedById,
          assessmentId: clarification.assessmentId,
          assessmentCode: assessment?.assessmentCode || '',
          vendorName: vendor?.name || '',
          questionNo: clarification.questionNo,
        });
      }

      return NextResponse.json(updated);
    } catch (error) {
      console.error('AM Clarifications PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update clarification' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-follow-ups', action: 'edit' }
);

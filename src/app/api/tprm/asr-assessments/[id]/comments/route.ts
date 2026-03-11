import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { notificationService } from '@/lib/notification-service';
import { translateRecord } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/tprm/asr-assessments/[id]/comments — Get internal comments
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const questionId = searchParams.get('questionId');
      console.log(`[ASR] GET /asr-assessments/${id}/comments — user=${session.email} questionId=${questionId || 'all'}`);

      const where: Record<string, unknown> = { assessmentId: id, customerAccountId };
      if (questionId) where.questionId = questionId;

      const comments = await prisma.tPRMInternalComment.findMany({
        where,
        include: {
          author: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      console.log(`[ASR] GET /asr-assessments/${id}/comments — OK, returned ${comments.length} comments`);
      return NextResponse.json(comments);
    } catch (error) {
      console.error(`[ASR] GET /asr-assessments/comments — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'view' }
);

// POST /api/tprm/asr-assessments/[id]/comments — Add internal comment
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { questionId, message } = body;
      console.log(`[ASR] POST /asr-assessments/${id}/comments — user=${session.email} questionId=${questionId || 'assessment-level'}`);

      if (!message?.trim()) {
        console.warn(`[ASR] POST /asr-assessments/${id}/comments — 400 empty message`);
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
      }

      // Verify assessment exists and get details for notification
      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, customerAccountId },
        select: { id: true, assessmentCode: true, assessorId: true, initiatedById: true },
      });
      if (!assessment) {
        console.warn(`[ASR] POST /asr-assessments/${id}/comments — 404 not found`);
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      const comment = await prisma.tPRMInternalComment.create({
        data: {
          customerAccountId,
          assessmentId: id,
          questionId: questionId || null,
          message: message.trim(),
          authorId: session.id,
        },
        include: {
          author: { select: { id: true, fullName: true } },
        },
      });

      // Notify the assessor (if commenter is not the assessor) or the initiator
      const notifyTargets: string[] = [];
      if (assessment.assessorId && assessment.assessorId !== session.id) {
        notifyTargets.push(assessment.assessorId);
      }
      if (assessment.initiatedById && assessment.initiatedById !== session.id && !notifyTargets.includes(assessment.initiatedById)) {
        notifyTargets.push(assessment.initiatedById);
      }

      for (const recipientId of notifyTargets) {
        void notificationService.notifyTPRMCommentAdded({
          customerAccountId,
          actorId: session.id,
          recipientId,
          assessmentId: id,
          assessmentCode: assessment.assessmentCode,
          commentPreview: message.trim().substring(0, 100),
        });
      }

      // Trigger dynamic translation for user-entered comment text
      if (customerAccountId) {
        void translateRecord(customerAccountId, 'TPRMInternalComment', comment.id, {
          message: comment.message,
        });
      }

      console.log(`[ASR] POST /asr-assessments/${id}/comments — OK, created comment id=${comment.id} by ${comment.author.fullName}`);
      return NextResponse.json(comment);
    } catch (error) {
      console.error(`[ASR] POST /asr-assessments/comments — FAILED user=${session.email}`, error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessments', action: 'edit' }
);

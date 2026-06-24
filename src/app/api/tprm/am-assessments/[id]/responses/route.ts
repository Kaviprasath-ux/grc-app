import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { notificationService } from '@/lib/notification-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/tprm/am-assessments/[id]/responses — Get all responses for an assessment
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: assessmentId } = await context.params;
      const customerAccountId = getCustomerAccountId(session);

      const responses = await prisma.tPRMAssessmentResponse.findMany({
        where: { assessmentId, customerAccountId },
        include: {
          delegatedTo: { select: { id: true, fullName: true } },
          respondedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { questionNo: 'asc' },
      });

      return NextResponse.json({ data: responses });
    } catch (error) {
      console.error('AM Responses GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'view' }
);

// POST /api/tprm/am-assessments/[id]/responses — Create or upsert a response
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: assessmentId } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { questionId, domainId, questionNo, response, comment, artifactUrl, artifactName, isFlagged, isDelegated, delegatedToId } = body;

      if (!questionId) {
        return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
      }

      // Verify assessment belongs to this tenant
      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id: assessmentId, customerAccountId },
      });
      if (!assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Capture the previous response state once; reused below for
      // both the SME write guard and the SME-notification dedup.
      const existing = await prisma.tPRMAssessmentResponse.findUnique({
        where: { assessmentId_questionId: { assessmentId, questionId } },
        select: { delegatedToId: true, isDelegated: true },
      });

      // Server-side write guard for SMEs. After the page now shows
      // every question to SMEs (for context), a logged-in SME could
      // POST a response to any questionId in the assessment because
      // there's no role-level gate. Restrict SMEs to the questions
      // they are explicitly delegated. AM/AccountManager/admin paths
      // are unaffected.
      const isSME = session.roles.includes('TPRMSME');
      const isAM = session.roles.includes('AccountManager') || session.roles.includes('CustomerAdministrator') || session.roles.includes('GRCAdministrator');
      if (isSME && !isAM) {
        const isDelegatee = existing?.isDelegated && existing.delegatedToId === session.id;
        if (!isDelegatee) {
          return NextResponse.json(
            { error: 'You can only edit questions that have been delegated to you.' },
            { status: 403 },
          );
        }
      }

      const result = await prisma.tPRMAssessmentResponse.upsert({
        where: {
          assessmentId_questionId: { assessmentId, questionId },
        },
        create: {
          customerAccountId,
          assessmentId,
          questionId,
          domainId: domainId || null,
          questionNo: questionNo || null,
          response: response || null,
          comment: comment || null,
          artifactUrl: artifactUrl || null,
          artifactName: artifactName || null,
          isFlagged: isFlagged || false,
          isDelegated: isDelegated || false,
          delegatedToId: delegatedToId || null,
          respondedById: session.id,
          respondedAt: response ? new Date() : null,
        },
        update: {
          response: response !== undefined ? response : undefined,
          comment: comment !== undefined ? comment : undefined,
          artifactUrl: artifactUrl !== undefined ? artifactUrl : undefined,
          artifactName: artifactName !== undefined ? artifactName : undefined,
          isFlagged: isFlagged !== undefined ? isFlagged : undefined,
          isDelegated: isDelegated !== undefined ? isDelegated : undefined,
          delegatedToId: delegatedToId !== undefined ? delegatedToId : undefined,
          respondedById: session.id,
          respondedAt: response ? new Date() : undefined,
        },
      });

      // Update assessment status to "In Progress" if it was "Draft"
      if (assessment.status === 'Draft') {
        await prisma.tPRMAssessment.update({
          where: { id: assessmentId },
          data: { status: 'In Progress' },
        });
      }

      // Notify SME when an AM explicitly delegates a question. The
      // body sends both isDelegated:true and delegatedToId only when
      // the AM clicks "Assign SME" in the question dialog; ordinary
      // response saves don't include these, so we don't re-notify on
      // every keystroke save.
      //
      // Also dedup against the previous state — if the same SME is
      // already the delegatee for this question, don't re-spam them
      // on a second click of the same "Assign" dialog (the dialog
      // pre-selects the current SME, so OK→OK is a no-op intent
      // that previously fired a fresh notification).
      const alreadyDelegatedToSame =
        existing?.isDelegated === true && existing?.delegatedToId === delegatedToId;
      if (isDelegated === true && delegatedToId && delegatedToId !== session.id && !alreadyDelegatedToSame) {
        const vendor = await prisma.tPRMVendor.findUnique({
          where: { id: assessment.vendorId },
          select: { name: true },
        });
        void notificationService.notifyTPRMSMEAssignmentPending({
          customerAccountId,
          actorId: session.id,
          recipientId: delegatedToId,
          assessmentId,
          assessmentCode: assessment.assessmentCode,
          vendorName: vendor?.name,
        });
      }

      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      console.error('AM Responses POST error:', error);
      return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'edit' }
);

// PATCH /api/tprm/am-assessments/[id]/responses — Bulk update responses
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id: assessmentId } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { responses } = body;

      if (!Array.isArray(responses)) {
        return NextResponse.json({ error: 'responses array is required' }, { status: 400 });
      }

      // Server-side write guard for SMEs (mirrors the POST path).
      // Without this, an SME could PATCH-bulk responses for questions
      // not delegated to them. Restrict the batch to the SME's
      // delegated questions for SME-only sessions.
      const isSME = session.roles.includes('TPRMSME');
      const isAM = session.roles.includes('AccountManager') || session.roles.includes('CustomerAdministrator') || session.roles.includes('GRCAdministrator');
      if (isSME && !isAM) {
        const questionIds = responses.map((r) => r.questionId).filter(Boolean);
        const allowed = await prisma.tPRMAssessmentResponse.findMany({
          where: {
            assessmentId,
            questionId: { in: questionIds },
            isDelegated: true,
            delegatedToId: session.id,
          },
          select: { questionId: true },
        });
        const allowedSet = new Set(allowed.map((r) => r.questionId));
        const blocked = questionIds.filter((q) => !allowedSet.has(q));
        if (blocked.length > 0) {
          return NextResponse.json(
            { error: `${blocked.length} question(s) are not delegated to you.` },
            { status: 403 },
          );
        }
      }

      // Collect every SME a question is being delegated to in this
      // batch. We notify each SME once at the end rather than per
      // question, so assigning 19 questions to one SME doesn't fan
      // out into 19 inbox entries.
      const delegatedSmeIds = new Set<string>();

      const results = [];
      for (const r of responses) {
        if (r.isDelegated === true && r.delegatedToId && r.delegatedToId !== session.id) {
          delegatedSmeIds.add(r.delegatedToId as string);
        }
        const result = await prisma.tPRMAssessmentResponse.upsert({
          where: {
            assessmentId_questionId: { assessmentId, questionId: r.questionId },
          },
          create: {
            customerAccountId,
            assessmentId,
            questionId: r.questionId,
            domainId: r.domainId || null,
            questionNo: r.questionNo || null,
            response: r.response || null,
            comment: r.comment || null,
            artifactUrl: r.artifactUrl || null,
            artifactName: r.artifactName || null,
            isFlagged: r.isFlagged || false,
            isDelegated: r.isDelegated || false,
            delegatedToId: r.delegatedToId || null,
            respondedById: session.id,
            respondedAt: r.response ? new Date() : null,
          },
          update: {
            ...(r.response !== undefined ? { response: r.response } : {}),
            ...(r.comment !== undefined ? { comment: r.comment } : {}),
            ...(r.artifactUrl !== undefined ? { artifactUrl: r.artifactUrl } : {}),
            ...(r.artifactName !== undefined ? { artifactName: r.artifactName } : {}),
            ...(r.isFlagged !== undefined ? { isFlagged: r.isFlagged } : {}),
            ...(r.isDelegated !== undefined ? { isDelegated: r.isDelegated } : {}),
            ...(r.delegatedToId !== undefined ? { delegatedToId: r.delegatedToId } : {}),
            respondedById: session.id,
            respondedAt: r.response ? new Date() : undefined,
          },
        });
        results.push(result);
      }

      if (delegatedSmeIds.size > 0) {
        const assessmentForNotif = await prisma.tPRMAssessment.findUnique({
          where: { id: assessmentId },
          select: { assessmentCode: true, vendor: { select: { name: true } } },
        });
        if (assessmentForNotif) {
          for (const smeId of delegatedSmeIds) {
            void notificationService.notifyTPRMSMEAssignmentPending({
              customerAccountId,
              actorId: session.id,
              recipientId: smeId,
              assessmentId,
              assessmentCode: assessmentForNotif.assessmentCode,
              vendorName: assessmentForNotif.vendor?.name,
            });
          }
        }
      }

      return NextResponse.json({ data: results });
    } catch (error) {
      console.error('AM Responses PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update responses' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'edit' }
);

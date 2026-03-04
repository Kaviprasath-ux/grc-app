import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

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

      const results = [];
      for (const r of responses) {
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

      return NextResponse.json({ data: results });
    } catch (error) {
      console.error('AM Responses PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update responses' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'edit' }
);

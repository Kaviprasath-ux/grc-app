import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId, verifyAMAccess } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { translateRecord } from '@/lib/translation-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/tprm/am-assessments/[id] — Get assessment detail
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, customerAccountId },
        include: {
          customerAccount: { select: { code: true } },
          vendor: { select: { id: true, name: true, vendorCode: true, accountManagerEmail: true, engagementId: true } },
          initiatedBy: { select: { id: true, fullName: true } },
          assessor: { select: { id: true, fullName: true } },
          approver: { select: { id: true, fullName: true } },
          // No `take` cap — activity logs must persist for the life of
          // the assessment. Prior cap of 50 silently dropped older
          // entries on busy assessments.
          logs: { orderBy: { logDate: 'desc' } },
          responses: {
            orderBy: { questionNo: 'asc' },
            include: {
              delegatedTo: { select: { id: true, fullName: true } },
            },
          },
        },
      });

      if (!assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Verify AM/SME access
      if (!await verifyAMAccess(session, assessment.vendor.accountManagerEmail)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Load questionnaire questions for this assessment's template
      let questions: unknown[] = [];
      if (assessment.questionnaireTemplate) {
        // questionnaireTemplate may hold several comma-separated template names
        // (the initiation UI joins multi-selected templates with ", "), so match
        // every one of them and aggregate their questions, de-duplicated by id.
        const templateNames = assessment.questionnaireTemplate
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        const templates = await prisma.tPRMQuestionnaireTemplate.findMany({
          where: { customerAccountId, templateName: { in: templateNames } },
          include: {
            masterQuestionLinks: {
              include: {
                question: {
                  include: {
                    domain: { select: { id: true, name: true } },
                    children: { orderBy: { sortOrder: 'asc' } },
                  },
                },
              },
              orderBy: { sortOrder: 'asc' },
            },
          },
        });

        const seenQuestionIds = new Set<string>();
        questions = templates
          .flatMap(t => t.masterQuestionLinks)
          .filter(link => {
            if (seenQuestionIds.has(link.question.id)) return false;
            seenQuestionIds.add(link.question.id);
            return true;
          })
          .map(link => ({
            id: link.question.id,
            questionText: link.question.questionText,
            domainId: link.question.domainId,
            domainName: link.question.domain?.name || '',
            isParentQuestion: link.question.isParentQuestion,
            parentId: link.question.parentId,
            mandatoryAttachment: link.question.mandatoryAttachment,
            mandatoryQuestion: link.question.mandatoryQuestion,
            validateThroughAI: link.question.validateThroughAI,
            verifaiPrompt: link.question.verifaiPrompt,
            issue: link.question.issue,
            risk: link.question.risk,
            recommendation: link.question.recommendation,
            severity: link.question.severity,
            sortOrder: link.sortOrder,
            children: link.question.children.map(c => ({
              id: c.id,
              questionText: c.questionText,
              mandatoryAttachment: c.mandatoryAttachment,
              mandatoryQuestion: c.mandatoryQuestion,
              validateThroughAI: c.validateThroughAI,
              sortOrder: c.sortOrder,
            })),
          }));
      }

      // Load ONLY the domains referenced by this assessment's questions —
      // previously the route loaded every active domain in the tenant,
      // which leaked unrelated domains into the AM's domain filter when
      // a template didn't cover them. Filtering by the ids actually
      // present on the question set keeps the dropdown honest.
      const usedDomainIds = Array.from(
        new Set(
          (questions as Array<{ domainId: string | null }>)
            .map((q) => q.domainId)
            .filter((id): id is string => Boolean(id))
        )
      );
      const domains = usedDomainIds.length === 0
        ? []
        : await prisma.tPRMDomain.findMany({
            where: { customerAccountId, isActive: true, id: { in: usedDomainIds } },
            orderBy: { sortOrder: 'asc' },
            select: { id: true, name: true },
          });

      return NextResponse.json({ assessment, questions, domains });
    } catch (error) {
      console.error('AM Assessment GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch assessment' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'view' }
);

// PATCH /api/tprm/am-assessments/[id] — Update assessment status
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();

      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, customerAccountId },
        include: { vendor: { select: { accountManagerEmail: true } } },
      });

      if (!assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
      }

      // Verify AM/SME access
      if (!await verifyAMAccess(session, assessment.vendor.accountManagerEmail)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const updateData: Record<string, unknown> = {};
      if (body.status) updateData.status = body.status;

      const updated = await prisma.tPRMAssessment.update({
        where: { id },
        data: updateData,
      });

      // Fire-and-forget translation
      if (customerAccountId) {
        void translateRecord(customerAccountId, 'TPRMAssessment', updated.id, {
          questionnaireTemplate: updated.questionnaireTemplate,
          approverComment: updated.approverComment,
        });
      }

      return NextResponse.json(updated);
    } catch (error) {
      console.error('AM Assessment PATCH error:', error);
      return NextResponse.json({ error: 'Failed to update assessment' }, { status: 500 });
    }
  },
  { resource: 'tprm.am-assessments', action: 'edit' }
);

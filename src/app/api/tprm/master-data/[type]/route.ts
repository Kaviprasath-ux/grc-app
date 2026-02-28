import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

const VALID_TYPES = ['questions', 'questionnaires', 'domains'] as const;
type MasterDataType = typeof VALID_TYPES[number];

// ============ GET ============
export const GET = withAuth(
  async (req: NextRequest, context: { params: Promise<{ type: string }> }, session) => {
    try {
      const { type } = await context.params;
      const customerAccountId = getCustomerAccountId(session);

      if (!VALID_TYPES.includes(type as MasterDataType)) {
        return NextResponse.json({ error: 'Invalid master data type' }, { status: 400 });
      }

      switch (type as MasterDataType) {
        case 'domains': {
          const domains = await prisma.tPRMDomain.findMany({
            where: { customerAccountId },
            orderBy: { sortOrder: 'asc' },
          });
          return NextResponse.json(domains);
        }

        case 'questions': {
          const questions = await prisma.tPRMMasterQuestion.findMany({
            where: { customerAccountId },
            include: { domain: { select: { id: true, name: true } } },
            orderBy: { sortOrder: 'asc' },
          });
          return NextResponse.json(questions);
        }

        case 'questionnaires': {
          const templates = await prisma.tPRMQuestionnaireTemplate.findMany({
            where: { customerAccountId },
            include: {
              masterQuestionLinks: {
                include: {
                  question: {
                    include: { domain: { select: { id: true, name: true } } },
                  },
                },
                orderBy: { sortOrder: 'asc' },
              },
            },
            orderBy: { templateName: 'asc' },
          });
          return NextResponse.json(templates);
        }

        default:
          return NextResponse.json({ error: 'Invalid master data type' }, { status: 400 });
      }
    } catch (error) {
      console.error('Master Data GET error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: 'Failed to fetch master data', detail: msg }, { status: 500 });
    }
  },
  { resource: 'tprm.master-data', action: 'view' }
);

// ============ POST ============
export const POST = withAuth(
  async (req: NextRequest, context: { params: Promise<{ type: string }> }, session) => {
    try {
      const { type } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();

      if (!VALID_TYPES.includes(type as MasterDataType)) {
        return NextResponse.json({ error: 'Invalid master data type' }, { status: 400 });
      }

      switch (type as MasterDataType) {
        case 'domains': {
          const { name, description } = body;
          if (!name?.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
          }
          const maxOrder = await prisma.tPRMDomain.aggregate({
            where: { customerAccountId },
            _max: { sortOrder: true },
          });
          const domain = await prisma.tPRMDomain.create({
            data: {
              customerAccountId,
              name: name.trim(),
              description: description?.trim() || null,
              sortOrder: (maxOrder._max.sortOrder || 0) + 1,
            },
          });
          return NextResponse.json(domain, { status: 201 });
        }

        case 'questions': {
          const { questionText, verifaiPrompt, domainId, isParentQuestion, parentId,
            mandatoryAttachment, validateThroughAI, mandatoryQuestion,
            evidence, issue, risk, recommendation, severity } = body;
          if (!questionText?.trim()) {
            return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
          }
          // Validate domain belongs to tenant if provided
          if (domainId) {
            const domain = await prisma.tPRMDomain.findFirst({
              where: { id: domainId, customerAccountId },
            });
            if (!domain) {
              return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
            }
          }
          // Validate parent question if provided
          if (parentId) {
            const parentQ = await prisma.tPRMMasterQuestion.findFirst({
              where: { id: parentId, customerAccountId },
            });
            if (!parentQ) {
              return NextResponse.json({ error: 'Parent question not found' }, { status: 404 });
            }
          }
          const maxOrder = await prisma.tPRMMasterQuestion.aggregate({
            where: { customerAccountId },
            _max: { sortOrder: true },
          });
          const question = await prisma.tPRMMasterQuestion.create({
            data: {
              customerAccountId,
              questionText: questionText.trim(),
              verifaiPrompt: verifaiPrompt?.trim() || null,
              domainId: domainId || null,
              isParentQuestion: isParentQuestion !== false,
              parentId: parentId || null,
              mandatoryAttachment: mandatoryAttachment === true,
              validateThroughAI: validateThroughAI === true,
              mandatoryQuestion: mandatoryQuestion === true,
              evidence: evidence?.trim() || null,
              issue: issue?.trim() || null,
              risk: risk?.trim() || null,
              recommendation: recommendation?.trim() || null,
              severity: severity || null,
              sortOrder: (maxOrder._max.sortOrder || 0) + 1,
            },
            include: { domain: { select: { id: true, name: true } } },
          });
          return NextResponse.json(question, { status: 201 });
        }

        case 'questionnaires': {
          // Link questions to a template
          const { templateId, questionIds } = body;
          if (!templateId || !Array.isArray(questionIds) || questionIds.length === 0) {
            return NextResponse.json({ error: 'templateId and questionIds are required' }, { status: 400 });
          }
          // Verify template belongs to tenant
          const template = await prisma.tPRMQuestionnaireTemplate.findFirst({
            where: { id: templateId, customerAccountId },
          });
          if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
          }
          // Get max sortOrder for existing links
          const maxOrder = await prisma.tPRMQuestionnaireQuestion.aggregate({
            where: { templateId, customerAccountId },
            _max: { sortOrder: true },
          });
          let nextOrder = (maxOrder._max.sortOrder || 0) + 1;
          // Create links (skip duplicates)
          const links = await prisma.tPRMQuestionnaireQuestion.createMany({
            data: questionIds.map((qId: string) => ({
              customerAccountId,
              templateId,
              questionId: qId,
              sortOrder: nextOrder++,
            })),
            skipDuplicates: true,
          });
          return NextResponse.json({ count: links.count }, { status: 201 });
        }

        default:
          return NextResponse.json({ error: 'Invalid master data type' }, { status: 400 });
      }
    } catch (error: unknown) {
      console.error('Master Data POST error:', error);
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
        return NextResponse.json({ error: 'A record with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create master data' }, { status: 500 });
    }
  },
  { resource: 'tprm.master-data', action: 'create' }
);

// ============ PATCH ============
export const PATCH = withAuth(
  async (req: NextRequest, context: { params: Promise<{ type: string }> }, session) => {
    try {
      const { type } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { id } = body;

      if (!VALID_TYPES.includes(type as MasterDataType)) {
        return NextResponse.json({ error: 'Invalid master data type' }, { status: 400 });
      }

      if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
      }

      switch (type as MasterDataType) {
        case 'domains': {
          const { name, description, isActive } = body;
          const existing = await prisma.tPRMDomain.findFirst({ where: { id, customerAccountId } });
          if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          const domain = await prisma.tPRMDomain.update({
            where: { id },
            data: {
              ...(name !== undefined && { name: name.trim() }),
              ...(description !== undefined && { description: description?.trim() || null }),
              ...(isActive !== undefined && { isActive }),
            },
          });
          return NextResponse.json(domain);
        }

        case 'questions': {
          const { questionText, verifaiPrompt, domainId, isActive,
            isParentQuestion, parentId, mandatoryAttachment, validateThroughAI,
            mandatoryQuestion, evidence, issue, risk, recommendation, severity } = body;
          const existing = await prisma.tPRMMasterQuestion.findFirst({ where: { id, customerAccountId } });
          if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          // Validate domain if changing
          if (domainId !== undefined && domainId !== null) {
            const domain = await prisma.tPRMDomain.findFirst({
              where: { id: domainId, customerAccountId },
            });
            if (!domain) {
              return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
            }
          }
          // Validate parent question if changing
          if (parentId !== undefined && parentId !== null) {
            const parentQ = await prisma.tPRMMasterQuestion.findFirst({
              where: { id: parentId, customerAccountId },
            });
            if (!parentQ) {
              return NextResponse.json({ error: 'Parent question not found' }, { status: 404 });
            }
          }
          const question = await prisma.tPRMMasterQuestion.update({
            where: { id },
            data: {
              ...(questionText !== undefined && { questionText: questionText.trim() }),
              ...(verifaiPrompt !== undefined && { verifaiPrompt: verifaiPrompt?.trim() || null }),
              ...(domainId !== undefined && { domainId: domainId || null }),
              ...(isActive !== undefined && { isActive }),
              ...(isParentQuestion !== undefined && { isParentQuestion }),
              ...(parentId !== undefined && { parentId: parentId || null }),
              ...(mandatoryAttachment !== undefined && { mandatoryAttachment }),
              ...(validateThroughAI !== undefined && { validateThroughAI }),
              ...(mandatoryQuestion !== undefined && { mandatoryQuestion }),
              ...(evidence !== undefined && { evidence: evidence?.trim() || null }),
              ...(issue !== undefined && { issue: issue?.trim() || null }),
              ...(risk !== undefined && { risk: risk?.trim() || null }),
              ...(recommendation !== undefined && { recommendation: recommendation?.trim() || null }),
              ...(severity !== undefined && { severity: severity || null }),
            },
            include: { domain: { select: { id: true, name: true } } },
          });
          return NextResponse.json(question);
        }

        case 'questionnaires': {
          // Replace all question links for a template
          const { templateId, questionIds } = body;
          if (!templateId || !Array.isArray(questionIds)) {
            return NextResponse.json({ error: 'templateId and questionIds are required' }, { status: 400 });
          }
          const template = await prisma.tPRMQuestionnaireTemplate.findFirst({
            where: { id: templateId, customerAccountId },
          });
          if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
          // Delete old links and recreate
          await prisma.tPRMQuestionnaireQuestion.deleteMany({
            where: { templateId, customerAccountId },
          });
          if (questionIds.length > 0) {
            let order = 1;
            await prisma.tPRMQuestionnaireQuestion.createMany({
              data: questionIds.map((qId: string) => ({
                customerAccountId,
                templateId,
                questionId: qId,
                sortOrder: order++,
              })),
            });
          }
          return NextResponse.json({ success: true });
        }

        default:
          return NextResponse.json({ error: 'Invalid master data type' }, { status: 400 });
      }
    } catch (error: unknown) {
      console.error('Master Data PATCH error:', error);
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
        return NextResponse.json({ error: 'A record with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to update master data' }, { status: 500 });
    }
  },
  { resource: 'tprm.master-data', action: 'edit' }
);

// ============ DELETE ============
export const DELETE = withAuth(
  async (req: NextRequest, context: { params: Promise<{ type: string }> }, session) => {
    try {
      const { type } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');

      if (!VALID_TYPES.includes(type as MasterDataType)) {
        return NextResponse.json({ error: 'Invalid master data type' }, { status: 400 });
      }

      if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
      }

      switch (type as MasterDataType) {
        case 'domains': {
          const domain = await prisma.tPRMDomain.findFirst({ where: { id, customerAccountId } });
          if (!domain) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          // Nullify domain on related questions before deleting
          await prisma.tPRMMasterQuestion.updateMany({
            where: { domainId: id, customerAccountId },
            data: { domainId: null },
          });
          await prisma.tPRMDomain.delete({ where: { id } });
          return NextResponse.json({ success: true });
        }

        case 'questions': {
          const question = await prisma.tPRMMasterQuestion.findFirst({ where: { id, customerAccountId } });
          if (!question) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          // Cascade deletes questionnaire links automatically
          await prisma.tPRMMasterQuestion.delete({ where: { id } });
          return NextResponse.json({ success: true });
        }

        case 'questionnaires': {
          // Delete a specific question link from a template
          const link = await prisma.tPRMQuestionnaireQuestion.findFirst({ where: { id, customerAccountId } });
          if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          await prisma.tPRMQuestionnaireQuestion.delete({ where: { id } });
          return NextResponse.json({ success: true });
        }

        default:
          return NextResponse.json({ error: 'Delete not supported for this type' }, { status: 400 });
      }
    } catch (error) {
      console.error('Master Data DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete master data' }, { status: 500 });
    }
  },
  { resource: 'tprm.master-data', action: 'delete' }
);

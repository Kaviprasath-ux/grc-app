import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

// POST /api/tprm/master-data/questionnaires-enable-ai
// Enable AI validation on all questions linked to a template
export const POST = withAuth(
  async (req: NextRequest, context: unknown, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { templateId } = await req.json();

      if (!templateId) {
        return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
      }

      // Load the template with linked questions
      const template = await prisma.tPRMQuestionnaireTemplate.findFirst({
        where: { id: templateId, customerAccountId },
        include: {
          masterQuestionLinks: {
            include: {
              question: {
                select: { id: true, questionText: true, validateThroughAI: true, verifaiPrompt: true },
                },
            },
          },
        },
      });

      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      // Update all linked questions: set validateThroughAI=true and verifaiPrompt=questionText if empty
      let updatedCount = 0;
      for (const link of template.masterQuestionLinks) {
        const q = link.question;
        await prisma.tPRMMasterQuestion.update({
          where: { id: q.id },
          data: {
            validateThroughAI: true,
            verifaiPrompt: q.verifaiPrompt || q.questionText,
          },
        });
        updatedCount++;

        // Also update children of this question
        const children = await prisma.tPRMMasterQuestion.findMany({
          where: { parentId: q.id, customerAccountId },
          select: { id: true, questionText: true, verifaiPrompt: true },
        });
        for (const child of children) {
          await prisma.tPRMMasterQuestion.update({
            where: { id: child.id },
            data: {
              validateThroughAI: true,
              verifaiPrompt: child.verifaiPrompt || child.questionText,
            },
          });
          updatedCount++;
        }
      }

      return NextResponse.json({ success: true, updatedCount });
    } catch (error) {
      console.error('Enable AI error:', error);
      return NextResponse.json({ error: 'Failed to enable AI' }, { status: 500 });
    }
  },
  { resource: 'tprm.master-data', action: 'create' }
);

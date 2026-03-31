import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';

/**
 * GET /api/tprm/configuration-check
 *
 * Checks whether the minimum required TPRM configuration has been completed
 * before vendors can be onboarded.
 *
 * Required items:
 * - At least 1 Questionnaire Template (needed for assessments)
 * - At least 1 Service Category (needed to classify vendors)
 *
 * Returns:
 *   { complete: boolean, missing: string[] }
 */
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      const [templateCount, serviceCategoryCount] = await Promise.all([
        prisma.tPRMQuestionnaireTemplate.count({
          where: { customerAccountId },
        }),
        prisma.tPRMServiceCategory.count({
          where: { customerAccountId },
        }),
      ]);

      const missing: string[] = [];
      if (templateCount === 0) missing.push('Questionnaire Template');
      if (serviceCategoryCount === 0) missing.push('Service Category');

      return NextResponse.json({
        complete: missing.length === 0,
        missing,
        counts: {
          questionnaireTemplates: templateCount,
          serviceCategories: serviceCategoryCount,
        },
      });
    } catch (error) {
      console.error('Configuration check error:', error);
      return NextResponse.json({ error: 'Failed to check configuration' }, { status: 500 });
    }
  },
  { resource: ['tprm.vendor-management', 'tprm.configurations', 'tprm.master-data', 'tprm.bo-inventory', 'tprm.rm-inventory', 'tprm.asr-inventory'], action: 'view' }
);

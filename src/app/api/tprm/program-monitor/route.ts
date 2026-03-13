import { NextResponse } from 'next/server';
import { withAuth, getTenantFilter } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

// GET /api/tprm/program-monitor — Fetch assessment & vendor counts + subscription limits
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      // Get assessment counts grouped by type
      const assessmentCounts = await prisma.tPRMAssessment.groupBy({
        by: ['assessmentType'],
        where: { ...tenantFilter },
        _count: { id: true },
      });

      // Get vendor counts grouped by status
      const vendorCounts = await prisma.tPRMVendor.groupBy({
        by: ['status'],
        where: { ...tenantFilter },
        _count: { id: true },
      });

      // Get subscription plan limits
      let assessmentLimit = 0;
      let vendorLimit = 0;

      if (session.customerAccountId) {
        const plans = await prisma.subscriptionPlan.findMany({
          where: {
            customerAccountId: session.customerAccountId,
            status: 'Active',
          },
          select: {
            assessmentLimit: true,
            vendorLimit: true,
          },
        });

        // Sum limits across all active plans
        for (const plan of plans) {
          assessmentLimit += plan.assessmentLimit || 0;
          vendorLimit += plan.vendorLimit || 0;
        }
      }

      // Build assessment breakdown
      const assessmentBreakdown = {
        'Assessment Factory': 0,
        'Onboarding Assessment': 0,
        'Periodic Assessment': 0,
        'On-Demand Assessment': 0,
      };
      let totalAssessments = 0;
      for (const item of assessmentCounts) {
        const key = item.assessmentType as keyof typeof assessmentBreakdown;
        if (key in assessmentBreakdown) {
          assessmentBreakdown[key] = item._count.id;
        }
        totalAssessments += item._count.id;
      }

      // Build vendor breakdown
      const vendorBreakdown = {
        Onboarding: 0,
        Onboarded: 0,
        Offboarding: 0,
        Offboarded: 0,
        Inactive: 0,
      };
      let totalVendors = 0;
      for (const item of vendorCounts) {
        const key = item.status as keyof typeof vendorBreakdown;
        if (key in vendorBreakdown) {
          vendorBreakdown[key] = item._count.id;
        }
        totalVendors += item._count.id;
      }

      return NextResponse.json({
        assessments: {
          total: totalAssessments,
          limit: assessmentLimit,
          breakdown: assessmentBreakdown,
        },
        vendors: {
          total: totalVendors,
          limit: vendorLimit,
          breakdown: vendorBreakdown,
        },
      });
    } catch (error) {
      console.error('Program Monitor API error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch program monitor data' },
        { status: 500 }
      );
    }
  },
  { resource: 'tprm.program-monitor', action: 'view' }
);

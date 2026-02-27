import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getTenantFilter, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

// Default DueDiligence configuration values
const DEFAULT_DUE_DILIGENCE = [
  { category: 'Critical', vrr: 50, cadenceMonths: 1, remediationDays: 7, reminderDays: 5, dueDateDays: 30 },
  { category: 'High', vrr: 40, cadenceMonths: 3, remediationDays: 14, reminderDays: 5, dueDateDays: 30 },
  { category: 'Moderate', vrr: 30, cadenceMonths: 6, remediationDays: 30, reminderDays: 5, dueDateDays: 30 },
  { category: 'Low', vrr: 20, cadenceMonths: 24, remediationDays: 60, reminderDays: 5, dueDateDays: 30 },
  { category: 'Nominal', vrr: 0, cadenceMonths: 36, remediationDays: 90, reminderDays: 5, dueDateDays: 30 },
];

// Default Scorecard configuration values
const DEFAULT_SCORECARD = [
  { category: 'Excellent', securityScore: 5 },
  { category: 'Good', securityScore: 4 },
  { category: 'Moderate', securityScore: 3 },
  { category: 'Low', securityScore: 2 },
  { category: 'Nominal', securityScore: 0 },
];

// GET /api/tprm/control-center — Fetch DueDiligence and Scorecard configuration
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const configs = await prisma.tPRMConfiguration.findMany({
        where: { ...tenantFilter },
        orderBy: { category: 'asc' },
      });

      // Separate configs by type
      const dueDiligence = configs.filter(c => c.configType === 'DueDiligence');
      const scorecard = configs.filter(c => c.configType === 'Scorecard');

      // If no configs exist yet, return defaults
      const dueDiligenceData = dueDiligence.length > 0
        ? dueDiligence
        : DEFAULT_DUE_DILIGENCE.map(d => ({
            id: '',
            configType: 'DueDiligence',
            ...d,
            securityScore: null,
            customerAccountId: session.customerAccountId || '',
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

      const scorecardData = scorecard.length > 0
        ? scorecard
        : DEFAULT_SCORECARD.map(d => ({
            id: '',
            configType: 'Scorecard',
            category: d.category,
            vrr: null,
            cadenceMonths: null,
            remediationDays: null,
            reminderDays: null,
            dueDateDays: null,
            securityScore: d.securityScore,
            customerAccountId: session.customerAccountId || '',
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

      return NextResponse.json({
        dueDiligence: dueDiligenceData,
        scorecard: scorecardData,
      });
    } catch (error) {
      console.error('Control Center GET error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch control center data' },
        { status: 500 }
      );
    }
  },
  { resource: 'tprm.control-center', action: 'view' }
);

// PATCH /api/tprm/control-center — Update DueDiligence and Scorecard configuration
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { dueDiligence, scorecard } = body;

      const results = [];

      // Upsert DueDiligence configs
      if (dueDiligence && Array.isArray(dueDiligence)) {
        for (const config of dueDiligence) {
          const result = await prisma.tPRMConfiguration.upsert({
            where: {
              customerAccountId_configType_category: {
                customerAccountId,
                configType: 'DueDiligence',
                category: config.category,
              },
            },
            update: {
              vrr: config.vrr ?? 0,
              cadenceMonths: config.cadenceMonths ?? 0,
              remediationDays: config.remediationDays ?? 0,
              reminderDays: config.reminderDays ?? 0,
              dueDateDays: config.dueDateDays ?? 0,
            },
            create: {
              customerAccountId,
              configType: 'DueDiligence',
              category: config.category,
              vrr: config.vrr ?? 0,
              cadenceMonths: config.cadenceMonths ?? 0,
              remediationDays: config.remediationDays ?? 0,
              reminderDays: config.reminderDays ?? 0,
              dueDateDays: config.dueDateDays ?? 0,
            },
          });
          results.push(result);
        }
      }

      // Upsert Scorecard configs
      if (scorecard && Array.isArray(scorecard)) {
        for (const config of scorecard) {
          const result = await prisma.tPRMConfiguration.upsert({
            where: {
              customerAccountId_configType_category: {
                customerAccountId,
                configType: 'Scorecard',
                category: config.category,
              },
            },
            update: {
              securityScore: config.securityScore ?? 0,
            },
            create: {
              customerAccountId,
              configType: 'Scorecard',
              category: config.category,
              securityScore: config.securityScore ?? 0,
            },
          });
          results.push(result);
        }
      }

      return NextResponse.json({ success: true, count: results.length });
    } catch (error) {
      console.error('Control Center PATCH error:', error);
      return NextResponse.json(
        { error: 'Failed to update control center configuration' },
        { status: 500 }
      );
    }
  },
  { resource: 'tprm.control-center', action: 'edit' }
);

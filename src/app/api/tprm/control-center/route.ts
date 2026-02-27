import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import prisma from '@/lib/prisma';

// Field mapping: maps (ddField, category) → flat column name on TPRMConfiguration
const DD_CATEGORIES = ['Critical', 'High', 'Moderate', 'Low', 'Nominal'] as const;
const SC_CATEGORIES = ['Excellent', 'Good', 'Moderate', 'Low', 'Nominal'] as const;

type DDCategory = typeof DD_CATEGORIES[number];
type SCCategory = typeof SC_CATEGORIES[number];

// Maps a DD field + category to the flat column name
const ddColumn = (field: string, cat: DDCategory): string =>
  `${field}${cat}`;

// Maps a SC category to the flat column name
const scColumn = (cat: SCCategory): string =>
  `scorecard${cat}`;

// Default values (used when no record exists yet)
const DEFAULTS = {
  vrrCritical: 50, vrrHigh: 40, vrrModerate: 30, vrrLow: 20, vrrNominal: 0,
  cadenceCritical: 1, cadenceHigh: 3, cadenceModerate: 6, cadenceLow: 24, cadenceNominal: 36,
  remediationCritical: 7, remediationHigh: 14, remediationModerate: 30, remediationLow: 60, remediationNominal: 90,
  reminderCritical: 5, reminderHigh: 5, reminderModerate: 5, reminderLow: 5, reminderNominal: 5,
  dueDateCritical: 30, dueDateHigh: 30, dueDateModerate: 30, dueDateLow: 30, dueDateNominal: 30,
  scorecardExcellent: 5, scorecardGood: 4, scorecardModerate: 3, scorecardLow: 2, scorecardNominal: 0,
};

type ConfigRecord = typeof DEFAULTS & { id: string; customerAccountId: string };

// Helper to convert flat record into the UI-friendly { dueDiligence, scorecard } shape
function toUIShape(rec: ConfigRecord) {
  const dueDiligence = DD_CATEGORIES.map((cat) => ({
    category: cat,
    vrr: rec[ddColumn('vrr', cat) as keyof typeof rec] as number,
    cadenceMonths: rec[ddColumn('cadence', cat) as keyof typeof rec] as number,
    remediationDays: rec[ddColumn('remediation', cat) as keyof typeof rec] as number,
    reminderDays: rec[ddColumn('reminder', cat) as keyof typeof rec] as number,
    dueDateDays: rec[ddColumn('dueDate', cat) as keyof typeof rec] as number,
  }));

  const scorecard = SC_CATEGORIES.map((cat) => ({
    category: cat,
    securityScore: rec[scColumn(cat) as keyof typeof rec] as number,
  }));

  return { dueDiligence, scorecard };
}

// GET /api/tprm/control-center — Fetch the single configuration record
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      const config = await prisma.tPRMConfiguration.findUnique({
        where: { customerAccountId },
      });

      if (config) {
        return NextResponse.json(toUIShape(config as unknown as ConfigRecord));
      }

      // No record yet — return defaults
      return NextResponse.json(toUIShape({ ...DEFAULTS, id: '', customerAccountId } as ConfigRecord));
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

// PATCH /api/tprm/control-center — Upsert the single configuration record
export const PATCH = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { dueDiligence, scorecard } = body;

      // Build flat data object from the UI arrays
      const data: Record<string, number> = {};

      if (dueDiligence && Array.isArray(dueDiligence)) {
        for (const item of dueDiligence) {
          const cat = item.category as DDCategory;
          if (!DD_CATEGORIES.includes(cat)) continue;
          data[ddColumn('vrr', cat)] = item.vrr ?? 0;
          data[ddColumn('cadence', cat)] = item.cadenceMonths ?? 0;
          data[ddColumn('remediation', cat)] = item.remediationDays ?? 0;
          data[ddColumn('reminder', cat)] = item.reminderDays ?? 0;
          data[ddColumn('dueDate', cat)] = item.dueDateDays ?? 0;
        }
      }

      if (scorecard && Array.isArray(scorecard)) {
        for (const item of scorecard) {
          const cat = item.category as SCCategory;
          if (!SC_CATEGORIES.includes(cat)) continue;
          data[scColumn(cat)] = item.securityScore ?? 0;
        }
      }

      const config = await prisma.tPRMConfiguration.upsert({
        where: { customerAccountId },
        update: data,
        create: {
          customerAccountId,
          ...data,
        },
      });

      return NextResponse.json({ success: true, id: config.id });
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

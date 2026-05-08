/**
 * Seed default V2 plan pricing - idempotent, safe to re-run.
 *
 * Creates 6 rows: 3 modules (GRC, TPRM, INTERNAL_AUDIT) x 2 plan types (BASE, GENERAL).
 *
 *   BASE     - Year-1 promotional plan: INR 100/year, modest caps
 *   GENERAL  - Year-2+ standard plan: INR 1500/mo or INR 15000/yr, larger caps
 *
 * Super-admin can edit any of these later via /subscription/plan-pricing.
 *
 * Run: npx tsx scripts/seed-module-plan-pricing.ts
 */

import prisma from "../src/lib/prisma";

interface Seed {
  moduleCode: "GRC" | "TPRM" | "INTERNAL_AUDIT";
  planType: "BASE" | "GENERAL";
  monthlyPrice: number | null;
  yearlyPrice: number;
  userLimit: number;
  unlimitedUsers?: boolean;
  frameworkLimit: number | null;
  unlimitedFrameworks?: boolean;
  vendorLimit: number | null;
  unlimitedVendors?: boolean;
  assessmentLimit: number | null;
  unlimitedAssessments?: boolean;
  auditLimit: number | null;
  unlimitedAudits?: boolean;
}

const SEEDS: Seed[] = [
  // GRC ---------------------------------------------
  {
    moduleCode: "GRC",
    planType: "BASE",
    monthlyPrice: null,
    yearlyPrice: 100,
    userLimit: 5,
    frameworkLimit: 3,
    vendorLimit: null,
    assessmentLimit: null,
    auditLimit: null,
  },
  {
    moduleCode: "GRC",
    planType: "GENERAL",
    monthlyPrice: 1500,
    yearlyPrice: 15000,
    userLimit: 25,
    frameworkLimit: 10,
    vendorLimit: null,
    assessmentLimit: null,
    auditLimit: null,
  },
  // TPRM --------------------------------------------
  {
    moduleCode: "TPRM",
    planType: "BASE",
    monthlyPrice: null,
    yearlyPrice: 100,
    userLimit: 5,
    frameworkLimit: null,
    vendorLimit: 10,
    assessmentLimit: 25,
    auditLimit: null,
  },
  {
    moduleCode: "TPRM",
    planType: "GENERAL",
    monthlyPrice: 1500,
    yearlyPrice: 15000,
    userLimit: 25,
    frameworkLimit: null,
    vendorLimit: 100,
    assessmentLimit: 250,
    auditLimit: null,
  },
  // INTERNAL_AUDIT ----------------------------------
  {
    moduleCode: "INTERNAL_AUDIT",
    planType: "BASE",
    monthlyPrice: null,
    yearlyPrice: 100,
    userLimit: 5,
    frameworkLimit: null,
    vendorLimit: null,
    assessmentLimit: null,
    auditLimit: 5,
  },
  {
    moduleCode: "INTERNAL_AUDIT",
    planType: "GENERAL",
    monthlyPrice: 1500,
    yearlyPrice: 15000,
    userLimit: 25,
    frameworkLimit: null,
    vendorLimit: null,
    assessmentLimit: null,
    auditLimit: 50,
  },
];

async function run() {
  console.log("Seeding ModulePlanPricing (6 rows)...\n");
  let created = 0;
  let updated = 0;

  for (const s of SEEDS) {
    const existing = await prisma.modulePlanPricing.findUnique({
      where: { moduleCode_planType: { moduleCode: s.moduleCode, planType: s.planType } },
    });
    if (existing) {
      console.log(`  = ${s.moduleCode} ${s.planType} - already exists, kept (id=${existing.id})`);
      updated++;
      continue;
    }
    await prisma.modulePlanPricing.create({
      data: {
        moduleCode: s.moduleCode,
        planType: s.planType,
        monthlyPrice: s.monthlyPrice,
        yearlyPrice: s.yearlyPrice,
        userLimit: s.userLimit,
        unlimitedUsers: s.unlimitedUsers ?? false,
        frameworkLimit: s.frameworkLimit,
        unlimitedFrameworks: s.unlimitedFrameworks ?? false,
        vendorLimit: s.vendorLimit,
        unlimitedVendors: s.unlimitedVendors ?? false,
        assessmentLimit: s.assessmentLimit,
        unlimitedAssessments: s.unlimitedAssessments ?? false,
        auditLimit: s.auditLimit,
        unlimitedAudits: s.unlimitedAudits ?? false,
        isActive: true,
      },
    });
    created++;
    console.log(`  + ${s.moduleCode} ${s.planType} - INR ${s.yearlyPrice}/yr, ${s.userLimit} users`);
  }

  console.log(`\nDone. ${created} created, ${updated} kept (already exist).`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

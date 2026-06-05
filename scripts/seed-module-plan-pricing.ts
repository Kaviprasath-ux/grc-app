/**
 * Seed default V2 plan pricing - idempotent, safe to re-run.
 *
 * Creates 8 rows: 4 modules (GRC, TPRM, INTERNAL_AUDIT, TECHNICAL_EVIDENCE) x 2 plan types (BASE, GENERAL).
 *
 *   BASE     - Year-1 promotional plan: INR 100/month = INR 1,200/year, modest caps
 *   GENERAL  - Year-2+ standard plan: INR 15,000/month = INR 180,000/year, larger caps
 *   TECHNICAL_EVIDENCE — initial pricing INR 1,000/month, INR 10,000/year (placeholder; editable in admin UI)
 *
 * Super-admin can edit any of these later via Settings > Subscription > Plan Pricing.
 *
 * Run: npx tsx scripts/seed-module-plan-pricing.ts
 */

import prisma from "../src/lib/prisma";

interface Seed {
  moduleCode: "GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE";
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
    monthlyPrice: null, // BASE is yearly only
    yearlyPrice: 1200, // ₹100/month × 12
    userLimit: 5,
    frameworkLimit: 3,
    vendorLimit: null,
    assessmentLimit: null,
    auditLimit: null,
  },
  {
    moduleCode: "GRC",
    planType: "GENERAL",
    monthlyPrice: 15000, // ₹15,000/month
    yearlyPrice: 180000, // ₹15,000 × 12
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
    monthlyPrice: null, // BASE is yearly only
    yearlyPrice: 1200, // ₹100/month × 12
    userLimit: 5,
    frameworkLimit: null,
    vendorLimit: 10,
    assessmentLimit: 25,
    auditLimit: null,
  },
  {
    moduleCode: "TPRM",
    planType: "GENERAL",
    monthlyPrice: 15000, // ₹15,000/month
    yearlyPrice: 180000, // ₹15,000 × 12
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
    monthlyPrice: null, // BASE is yearly only
    yearlyPrice: 1200, // ₹100/month × 12
    userLimit: 5,
    frameworkLimit: null,
    vendorLimit: null,
    assessmentLimit: null,
    auditLimit: 5,
  },
  {
    moduleCode: "INTERNAL_AUDIT",
    planType: "GENERAL",
    monthlyPrice: 15000, // ₹15,000/month
    yearlyPrice: 180000, // ₹15,000 × 12
    userLimit: 25,
    frameworkLimit: null,
    vendorLimit: null,
    assessmentLimit: null,
    auditLimit: 50,
  },
  // TECHNICAL_EVIDENCE -------------------------------
  // Initial pricing per BA spec: ₹1,000/month, ₹10,000/year.
  // Limits are nominal — TE doesn't currently enforce framework/vendor/assessment caps.
  {
    moduleCode: "TECHNICAL_EVIDENCE",
    planType: "BASE",
    monthlyPrice: null, // BASE is yearly only
    yearlyPrice: 10000, // ₹10,000/year placeholder
    userLimit: 5,
    frameworkLimit: null,
    vendorLimit: null,
    assessmentLimit: null,
    auditLimit: null,
  },
  {
    moduleCode: "TECHNICAL_EVIDENCE",
    planType: "GENERAL",
    monthlyPrice: 1000, // ₹1,000/month
    yearlyPrice: 10000, // ₹10,000/year (same as BASE — adjust in admin UI)
    userLimit: 25,
    frameworkLimit: null,
    vendorLimit: null,
    assessmentLimit: null,
    auditLimit: null,
  },
];

async function run() {
  console.log("Seeding/Updating ModulePlanPricing (8 rows)...\n");
  let count = 0;

  for (const s of SEEDS) {
    const result = await prisma.modulePlanPricing.upsert({
      where: { moduleCode_planType: { moduleCode: s.moduleCode, planType: s.planType } },
      update: {
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
      },
      create: {
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

    // Upsert succeeded
    count++;
    console.log(`  ✓ ${s.moduleCode} ${s.planType} - ₹${s.yearlyPrice}/yr (₹${s.monthlyPrice ?? 'N/A'}/mo)`);
  }

  console.log(`\nDone. ${count} rows upserted.`);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

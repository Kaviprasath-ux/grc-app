// Phase 2 smoke test — exercises V2 pricing engine end-to-end.
// Run: npx tsx scripts/smoke-test-v2-pricing.ts

import prisma from "../src/lib/prisma";
import { computeQuoteV2, getModulePlanPricing, getModulePriceV2 } from "../src/lib/pricing";
import { effectiveLimit, isWithinLimit, formatLimit } from "../src/lib/limit-helpers";
import { isBasePeriod, isInLockInPeriod, canCancelNow, daysUntilBaseFlip } from "../src/lib/subscription-status";

const TEST_MODULE = "TEST_GRC_V2";
let createdIds: string[] = [];

async function setup() {
  await prisma.modulePlanPricing.deleteMany({ where: { moduleCode: TEST_MODULE } });
  const base = await prisma.modulePlanPricing.create({
    data: {
      moduleCode: TEST_MODULE,
      planType: "BASE",
      monthlyPrice: null,
      yearlyPrice: 100,
      userLimit: 5,
      unlimitedUsers: false,
      frameworkLimit: 3,
      unlimitedFrameworks: false,
      isActive: true,
    },
  });
  const general = await prisma.modulePlanPricing.create({
    data: {
      moduleCode: TEST_MODULE,
      planType: "GENERAL",
      monthlyPrice: 1500,
      yearlyPrice: 15000,
      userLimit: 10,
      unlimitedUsers: false,
      frameworkLimit: 0,
      unlimitedFrameworks: true, // GENERAL = unlimited frameworks
      isActive: true,
    },
  });
  createdIds = [base.id, general.id];
}

async function teardown() {
  await prisma.modulePlanPricing.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
}

function ok(label: string, actual: any, expected: any) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "✓" : "✗"} ${label}: got ${JSON.stringify(actual)}${pass ? "" : ", expected " + JSON.stringify(expected)}`);
  if (!pass) process.exitCode = 1;
}

async function run() {
  console.log("=== Phase 2 V2 pricing smoke ===\n");

  // 1. getModulePlanPricing
  const baseRow = await getModulePlanPricing(TEST_MODULE as any, "BASE");
  ok("BASE row found", Number(baseRow.yearlyPrice), 100);

  // 2. getModulePriceV2 — BASE forces YEARLY even when caller asks MONTHLY
  const baseM = await getModulePriceV2(TEST_MODULE as any, "BASE", "MONTHLY");
  ok("BASE forces yearly (price)", baseM.price, 100);
  ok("BASE forces yearly (effectiveCycle)", baseM.effectiveCycle, "YEARLY");

  // 3. getModulePriceV2 — GENERAL respects cycle
  const genM = await getModulePriceV2(TEST_MODULE as any, "GENERAL", "MONTHLY");
  const genY = await getModulePriceV2(TEST_MODULE as any, "GENERAL", "YEARLY");
  ok("GENERAL monthly", genM.price, 1500);
  ok("GENERAL yearly", genY.price, 15000);

  // 4. computeQuoteV2 — BASE single line, ₹100 + 18% GST = ₹118
  const baseQuote = await computeQuoteV2({
    lines: [{ moduleCode: TEST_MODULE as any, planType: "BASE" }],
    cycle: "YEARLY",
  });
  ok("BASE quote subtotal", baseQuote.subtotal, 100);
  ok("BASE quote tax", baseQuote.taxAmount, 18);
  ok("BASE quote total", baseQuote.total, 118);

  // 5. computeQuoteV2 — GENERAL monthly, ₹1500 + 18% = ₹1770
  const genQuote = await computeQuoteV2({
    lines: [{ moduleCode: TEST_MODULE as any, planType: "GENERAL" }],
    cycle: "MONTHLY",
  });
  ok("GENERAL monthly subtotal", genQuote.subtotal, 1500);
  ok("GENERAL monthly total", genQuote.total, 1770);

  // 6. limit-helpers — BASE has capped users (5)
  const baseLimits = {
    userLimit: baseRow.userLimit,
    unlimitedUsers: baseRow.unlimitedUsers,
    frameworkLimit: baseRow.frameworkLimit,
    unlimitedFrameworks: baseRow.unlimitedFrameworks,
  };
  ok("BASE userLimit effective", effectiveLimit(baseLimits, "users"), 5);
  ok("BASE within limit (3 < 5)", isWithinLimit(baseLimits, "users", 3), true);
  ok("BASE at limit (5 < 5)", isWithinLimit(baseLimits, "users", 5), false);
  ok("BASE format users", formatLimit(baseLimits, "users"), "5");

  // 7. limit-helpers — GENERAL has unlimited frameworks
  const genLimits = await getModulePlanPricing(TEST_MODULE as any, "GENERAL");
  ok("GENERAL frameworks unlimited", effectiveLimit(genLimits, "frameworks"), Infinity);
  ok("GENERAL framework count of 999 within limit", isWithinLimit(genLimits, "frameworks", 999), true);
  ok("GENERAL format frameworks", formatLimit(genLimits, "frameworks"), "Unlimited");

  // 8. subscription-status V2 helpers
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  ok("isBasePeriod with future end", isBasePeriod({ baseEndDate: future }), true);
  ok("isBasePeriod with past end", isBasePeriod({ baseEndDate: past }), false);
  ok("isBasePeriod with null", isBasePeriod({ baseEndDate: null }), false);
  ok("isInLockInPeriod with future end", isInLockInPeriod({ contractEndDate: future }), true);
  ok("isInLockInPeriod with past end", isInLockInPeriod({ contractEndDate: past }), false);
  ok("canCancelNow during contract", canCancelNow({ contractEndDate: future }), false);
  ok("canCancelNow after contract", canCancelNow({ contractEndDate: past }), true);
  ok("canCancelNow with no contract (V1/Compl)", canCancelNow({ contractEndDate: null }), true);
  const flipDays = daysUntilBaseFlip({ baseEndDate: future });
  ok("daysUntilBaseFlip ~30", flipDays !== null && flipDays >= 29 && flipDays <= 30, true);

  console.log("\n=== Done ===");
}

setup()
  .then(run)
  .catch((e) => {
    console.error("FATAL:", e);
    process.exitCode = 1;
  })
  .finally(teardown);

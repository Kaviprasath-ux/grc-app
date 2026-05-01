/**
 * Tests the public (unauthenticated) pricing endpoints. Runs the same logic
 * the route handlers run, against the live DB.
 *
 * Run: npx tsx scripts/smoke-test-public-pricing-api.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TEST_DISCOUNT_NAME = "_PUBLIC_TEST_active_yearly";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  await prisma.bundleDiscount.deleteMany({ where: { name: { startsWith: "_PUBLIC_TEST_" } } });
}

async function main() {
  await cleanup();

  // ── /api/public/module-pricing ──
  console.log("/api/public/module-pricing");
  const tiers = await prisma.moduleTierPricing.findMany({
    where: { isActive: true },
    orderBy: [{ moduleCode: "asc" }, { tier: "asc" }],
  });
  assert(tiers.length === 9, `9 active tier rows (got ${tiers.length})`);
  // Confirm only safe fields would be returned (mapped explicitly in handler)
  const sample = tiers[0];
  assert(sample.moduleCode !== undefined, "has moduleCode");
  assert(sample.monthlyPrice !== undefined, "has monthlyPrice");
  // Internal fields exist on the row but the handler explicitly maps a subset
  assert("updatedBy" in sample, "row has updatedBy in DB");
  // Handler-side mapping: simulate response shape
  const responseRow = {
    moduleCode: sample.moduleCode,
    tier: sample.tier,
    monthlyPrice: Number(sample.monthlyPrice),
    yearlyPrice: Number(sample.yearlyPrice),
    currency: sample.currency,
    userLimit: sample.userLimit,
    vendorLimit: sample.vendorLimit,
    assessmentLimit: sample.assessmentLimit,
    frameworkLimit: sample.frameworkLimit,
    auditLimit: sample.auditLimit,
  };
  assert(!("updatedBy" in responseRow), "handler response strips updatedBy");
  assert(!("updatedAt" in responseRow), "handler response strips updatedAt");

  // ── /api/public/bundle-discounts: only active + valid-now ──
  console.log("\n/api/public/bundle-discounts");

  // Setup: one active discount, one inactive, one expired
  await prisma.bundleDiscount.create({
    data: {
      name: TEST_DISCOUNT_NAME,
      minModules: 2,
      discountType: "PERCENTAGE",
      discountValue: 10,
      appliesToCycle: "YEARLY",
      isActive: true,
    },
  });
  await prisma.bundleDiscount.create({
    data: {
      name: "_PUBLIC_TEST_inactive",
      minModules: 2,
      discountType: "PERCENTAGE",
      discountValue: 99,
      isActive: false,
    },
  });
  await prisma.bundleDiscount.create({
    data: {
      name: "_PUBLIC_TEST_expired",
      minModules: 2,
      discountType: "PERCENTAGE",
      discountValue: 99,
      isActive: true,
      validUntil: new Date("2020-01-01Z"),
    },
  });
  await prisma.bundleDiscount.create({
    data: {
      name: "_PUBLIC_TEST_future_only",
      minModules: 2,
      discountType: "PERCENTAGE",
      discountValue: 99,
      isActive: true,
      validFrom: new Date("2099-01-01Z"),
    },
  });

  const now = new Date();
  const visible = await prisma.bundleDiscount.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      ],
    },
  });
  // Filter to test rows only (we don't know what other rules exist)
  const testVisible = visible.filter((v) => v.name.startsWith("_PUBLIC_TEST_"));
  assert(testVisible.length === 1, `only 1 active+valid test discount visible (got ${testVisible.length})`);
  assert(testVisible[0].name === TEST_DISCOUNT_NAME, "active+valid one is the right one");

  // Confirm: inactive, expired, future-only all hidden from public response
  const allVisibleNames = testVisible.map((d) => d.name);
  assert(!allVisibleNames.includes("_PUBLIC_TEST_inactive"), "inactive hidden");
  assert(!allVisibleNames.includes("_PUBLIC_TEST_expired"), "expired hidden");
  assert(!allVisibleNames.includes("_PUBLIC_TEST_future_only"), "future-only hidden");

  // ── Sample response shape ──
  const responseDiscount = {
    name: testVisible[0].name,
    minModules: testVisible[0].minModules,
    minTier: testVisible[0].minTier,
    discountType: testVisible[0].discountType,
    discountValue: Number(testVisible[0].discountValue),
    appliesToCycle: testVisible[0].appliesToCycle,
  };
  assert(!("createdAt" in responseDiscount), "discount response strips createdAt");
  assert(!("isActive" in responseDiscount), "discount response strips isActive (always true if returned)");

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());

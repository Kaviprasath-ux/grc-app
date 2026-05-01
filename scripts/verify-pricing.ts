/**
 * End-to-end test of src/lib/pricing.ts against live DB. Uses a synthetic
 * customer for override scenarios; cleans up after itself.
 *
 * Run: npx tsx scripts/verify-pricing.ts
 */

import { PrismaClient } from "@prisma/client";
import {
  computeQuote,
  getModulePrice,
  getBestBundleDiscount,
  wholeMonthsBetween,
  round2,
} from "@/lib/pricing";

const prisma = new PrismaClient();
const TEST_CODE = "_PRICING_TEST_CUSTOMER";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}
function close(actual: number, expected: number, label: string, eps = 0.01) {
  if (Math.abs(actual - expected) < eps) { console.log(`  ✓ ${label} (got ${actual})`); pass++; }
  else                                   { console.error(`  ✗ ${label} (expected ~${expected}, got ${actual})`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  // Clean test customer
  const c = await prisma.customerAccount.findUnique({ where: { code: TEST_CODE } });
  if (c) {
    await prisma.customerPlanOverride.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.customerAccount.delete({ where: { id: c.id } });
  }
  // Clean any test bundle discounts we created
  await prisma.bundleDiscount.deleteMany({ where: { name: { startsWith: "_TEST_" } } });
}

async function main() {
  await cleanup();

  // ── Section 1 — pure helpers ──────────────────────────────────────
  console.log("Section 1 — pure helpers");
  assert(round2(3.14159) === 3.14, "round2(3.14159) = 3.14");
  assert(round2(2.555) === 2.56, "round2(2.555) = 2.56");
  assert(round2(0) === 0, "round2(0) = 0");
  assert(wholeMonthsBetween(new Date("2026-05-01Z"), new Date("2027-05-01Z")) === 12, "12 full months");
  assert(wholeMonthsBetween(new Date("2026-05-01Z"), new Date("2026-12-15Z")) === 7, "May 1 → Dec 15 = 7 months (Dec 15 < May 1 day → -1)");
  assert(wholeMonthsBetween(new Date("2026-05-01Z"), new Date("2026-12-01Z")) === 7, "May 1 → Dec 1 = 7 months");
  assert(wholeMonthsBetween(new Date("2026-05-01Z"), new Date("2026-04-30Z")) === 0, "to-before-from = 0");

  // ── Section 2 — standard pricing (no customer) ────────────────────
  console.log("\nSection 2 — standard catalog pricing");
  const grc1 = await getModulePrice("GRC", "BASIC", "YEARLY");
  assert(grc1.price === 50000 && grc1.source === "STANDARD", `GRC Basic yearly = 50000 STANDARD (got ${grc1.price} ${grc1.source})`);

  const tprm1 = await getModulePrice("TPRM", "PRO", "MONTHLY");
  assert(tprm1.price === 20000 && tprm1.source === "STANDARD", `TPRM Pro monthly = 20000 STANDARD`);

  // ── Section 3 — single-module yearly quote, no discounts ─────────
  console.log("\nSection 3 — single-module yearly, no discount");
  const q1 = await computeQuote({
    lines: [{ moduleCode: "GRC", tier: "BASIC" }],
    cycle: "YEARLY",
  });
  assert(q1.subtotal === 50000, "subtotal = 50,000");
  assert(q1.bundleDiscount === null, "no bundle discount applied");
  assert(q1.taxableAmount === 50000, "taxable = 50,000");
  assert(q1.taxAmount === 9000, "GST 18% = 9,000");
  assert(q1.total === 59000, "total = 59,000");

  // ── Section 4 — multi-module yearly quote ────────────────────────
  console.log("\nSection 4 — multi-module yearly (3 modules at Pro)");
  const q2 = await computeQuote({
    lines: [
      { moduleCode: "GRC", tier: "PRO" },
      { moduleCode: "TPRM", tier: "PRO" },
      { moduleCode: "INTERNAL_AUDIT", tier: "PRO" },
    ],
    cycle: "YEARLY",
  });
  assert(q2.subtotal === 600000, "subtotal = 200k × 3 = 600,000");
  assert(q2.bundleDiscount === null, "no active discount in DB by default");
  assert(q2.total === 708000, "total = 600k + 18% GST = 708,000");

  // ── Section 5 — bundle discount applied ──────────────────────────
  console.log("\nSection 5 — active bundle discount");
  await prisma.bundleDiscount.create({
    data: {
      name: "_TEST_All-3-Pro-10pct-yearly",
      minModules: 3,
      minTier: "PRO",
      discountType: "PERCENTAGE",
      discountValue: 10,
      appliesToCycle: "YEARLY",
      isActive: true,
    },
  });
  const q3 = await computeQuote({
    lines: [
      { moduleCode: "GRC", tier: "PRO" },
      { moduleCode: "TPRM", tier: "PRO" },
      { moduleCode: "INTERNAL_AUDIT", tier: "PRO" },
    ],
    cycle: "YEARLY",
  });
  assert(q3.subtotal === 600000, "subtotal = 600,000");
  assert(q3.bundleDiscount !== null, "discount matched");
  assert(q3.bundleDiscount?.amount === 60000, `discount = 10% of 600k = 60,000 (got ${q3.bundleDiscount?.amount})`);
  assert(q3.taxableAmount === 540000, "taxable after discount = 540,000");
  assert(q3.taxAmount === 97200, "GST 18% of 540k = 97,200");
  assert(q3.total === 637200, "total = 637,200");

  // Same modules but Medium tier — should NOT trigger Pro-only discount
  const q3b = await computeQuote({
    lines: [
      { moduleCode: "GRC", tier: "MEDIUM" },
      { moduleCode: "TPRM", tier: "MEDIUM" },
      { moduleCode: "INTERNAL_AUDIT", tier: "MEDIUM" },
    ],
    cycle: "YEARLY",
  });
  assert(q3b.bundleDiscount === null, "Medium tiers do NOT meet Pro-only discount minTier");

  // Same Pro tiers but only 2 modules — should NOT trigger 3-module discount
  const q3c = await computeQuote({
    lines: [
      { moduleCode: "GRC", tier: "PRO" },
      { moduleCode: "TPRM", tier: "PRO" },
    ],
    cycle: "YEARLY",
  });
  assert(q3c.bundleDiscount === null, "2 modules do NOT meet 3-module minimum");

  // Monthly — should NOT trigger yearly-only discount
  const q3d = await computeQuote({
    lines: [
      { moduleCode: "GRC", tier: "PRO" },
      { moduleCode: "TPRM", tier: "PRO" },
      { moduleCode: "INTERNAL_AUDIT", tier: "PRO" },
    ],
    cycle: "MONTHLY",
  });
  assert(q3d.bundleDiscount === null, "Monthly cycle does NOT trigger yearly-only discount");

  // ── Section 6 — multiple matching rules: best discount wins ──────
  console.log("\nSection 6 — multiple matching rules");
  await prisma.bundleDiscount.create({
    data: {
      name: "_TEST_All-3-Pro-5pct-yearly",
      minModules: 3,
      minTier: "PRO",
      discountType: "PERCENTAGE",
      discountValue: 5,
      appliesToCycle: "YEARLY",
      isActive: true,
    },
  });
  const q4 = await computeQuote({
    lines: [
      { moduleCode: "GRC", tier: "PRO" },
      { moduleCode: "TPRM", tier: "PRO" },
      { moduleCode: "INTERNAL_AUDIT", tier: "PRO" },
    ],
    cycle: "YEARLY",
  });
  assert(q4.bundleDiscount?.discountValue === 10, "10% rule wins over 5% rule");

  // ── Section 7 — fixed discount that exceeds subtotal ─────────────
  console.log("\nSection 7 — fixed discount capped at subtotal");
  await prisma.bundleDiscount.deleteMany({ where: { name: { startsWith: "_TEST_" } } });
  await prisma.bundleDiscount.create({
    data: {
      name: "_TEST_huge-fixed",
      minModules: 1,
      discountType: "FIXED",
      discountValue: 99999999,
      appliesToCycle: "YEARLY",
      isActive: true,
    },
  });
  const q5 = await computeQuote({
    lines: [{ moduleCode: "GRC", tier: "BASIC" }],
    cycle: "YEARLY",
  });
  assert(q5.bundleDiscount?.amount === 50000, "FIXED discount capped at subtotal (50,000), not 99,999,999");
  assert(q5.taxableAmount === 0, "taxable = 0 after full discount");
  assert(q5.total === 0, "total = 0");
  await prisma.bundleDiscount.deleteMany({ where: { name: { startsWith: "_TEST_" } } });

  // ── Section 8 — pro-rata yearly add-module ───────────────────────
  console.log("\nSection 8 — yearly pro-rata");
  const today = new Date("2026-08-15Z");
  const anchor = new Date("2027-03-15Z"); // 7 months remaining
  const q6 = await computeQuote({
    lines: [{ moduleCode: "TPRM", tier: "MEDIUM" }],
    cycle: "YEARLY",
    anchorEndDate: anchor,
    now: today,
  });
  assert(q6.lineItems[0].isProRated === true, "marked pro-rated");
  assert(q6.lineItems[0].monthsCharged === 7, "7 months charged");
  close(q6.lineItems[0].unitPrice, 58333.33, "TPRM Medium pro-rata price = 100k × 7/12 ≈ 58,333.33");

  // Pro-rata not applied to MONTHLY cycle
  const q7 = await computeQuote({
    lines: [{ moduleCode: "TPRM", tier: "MEDIUM" }],
    cycle: "MONTHLY",
    anchorEndDate: anchor,
    now: today,
  });
  assert(q7.lineItems[0].isProRated === false, "monthly cycle never pro-rated");
  assert(q7.lineItems[0].unitPrice === 10000, "monthly unitPrice = 10,000");

  // ── Section 9 — customer override ────────────────────────────────
  console.log("\nSection 9 — customer-specific override");
  const customer = await prisma.customerAccount.create({
    data: { code: TEST_CODE, name: "Pricing Test Customer", isGrcAdded: true },
  });
  await prisma.customerPlanOverride.create({
    data: {
      customerAccountId: customer.id,
      moduleCode: "GRC",
      tier: "MEDIUM",
      monthlyPrice: 7777,
      yearlyPrice: 77777,
      reason: "Strategic partner",
      isActive: true,
      createdBy: "test",
    },
  });

  const q8 = await computeQuote({
    customerAccountId: customer.id,
    lines: [{ moduleCode: "GRC", tier: "MEDIUM" }],
    cycle: "YEARLY",
  });
  assert(q8.lineItems[0].priceSource === "OVERRIDE", "GRC line resolved from OVERRIDE");
  assert(q8.lineItems[0].fullCyclePrice === 77777, "override yearly price = 77,777");
  assert(q8.subtotal === 77777, "subtotal uses override");

  // Different module same customer should still get standard pricing
  const q9 = await computeQuote({
    customerAccountId: customer.id,
    lines: [{ moduleCode: "TPRM", tier: "MEDIUM" }],
    cycle: "YEARLY",
  });
  assert(q9.lineItems[0].priceSource === "STANDARD", "TPRM (no override for this customer) → STANDARD");
  assert(q9.lineItems[0].fullCyclePrice === 100000, "TPRM standard yearly = 100,000");

  // Override with validUntil in past should NOT apply
  await prisma.customerPlanOverride.update({
    where: { customerAccountId_moduleCode: { customerAccountId: customer.id, moduleCode: "GRC" } },
    data: { validUntil: new Date("2026-01-01Z") },
  });
  const q10 = await computeQuote({
    customerAccountId: customer.id,
    lines: [{ moduleCode: "GRC", tier: "MEDIUM" }],
    cycle: "YEARLY",
    now: new Date("2026-05-01Z"),
  });
  assert(q10.lineItems[0].priceSource === "STANDARD", "expired override falls through to STANDARD");

  // ── Section 10 — empty lines errors ──────────────────────────────
  console.log("\nSection 10 — defensive errors");
  let threw = false;
  try {
    await computeQuote({ lines: [], cycle: "YEARLY" });
  } catch { threw = true; }
  assert(threw, "empty lines throws");

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());

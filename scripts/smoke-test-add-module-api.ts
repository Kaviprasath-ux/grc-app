/**
 * Tests /api/settings/subscription/add-module/quote logic.
 * Uses synthetic customer; cleans up after itself.
 *
 * Run: npx tsx scripts/smoke-test-add-module-api.ts
 */

import { PrismaClient } from "@prisma/client";
import { computeQuote, wholeMonthsBetween } from "@/lib/pricing";

const prisma = new PrismaClient();
const CODE = "_ADD_MOD_TEST";

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
  const c = await prisma.customerAccount.findUnique({ where: { code: CODE } });
  if (c) {
    await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.moduleSubscription.deleteMany({ where: { subscription: { customerAccountId: c.id } } });
    await prisma.subscription.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.customerAccount.delete({ where: { id: c.id } });
  }
}

async function main() {
  await cleanup();

  // ── Setup: customer with GRC active, anchored to ~7 months out ──
  const customer = await prisma.customerAccount.create({
    data: { code: CODE, name: "Add-Module Test", isGrcAdded: true, isInternalAuditEnabled: false },
  });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: true },
  });

  // Anchor 7 months from today (use first-of-month to make wholeMonths predictable)
  const today = new Date();
  const anchor = new Date(today);
  anchor.setUTCMonth(anchor.getUTCMonth() + 7);
  // Match the day-of-month so wholeMonthsBetween returns exactly 7
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id,
      moduleCode: "GRC", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, frameworkLimit: 3,
      cycleStart: today, cycleEnd: anchor,
    },
  });

  // ── Test 1: anchor calculation ──
  console.log("Anchor calculation");
  const monthsLeft = wholeMonthsBetween(today, anchor);
  assert(monthsLeft === 7, `wholeMonthsBetween today→anchor = 7 (got ${monthsLeft})`);

  // ── Test 2: add TPRM Medium, expect pro-rated YEARLY price ──
  console.log("\nAdd TPRM Medium, pro-rated to anchor");
  const quote = await computeQuote({
    customerAccountId: customer.id,
    lines: [{ moduleCode: "TPRM", tier: "MEDIUM" }],
    cycle: "YEARLY",
    anchorEndDate: anchor,
  });
  assert(quote.lineItems[0].isProRated === true, "marked pro-rated");
  assert(quote.lineItems[0].monthsCharged === 7, `7 months charged (got ${quote.lineItems[0].monthsCharged})`);
  // ₹100,000 × 7/12 = ₹58,333.33
  close(quote.lineItems[0].unitPrice, 58333.33, "TPRM Medium pro-rata = ~58333.33");
  close(quote.subtotal, 58333.33, "subtotal = pro-rated unit price");
  close(quote.taxAmount, 58333.33 * 0.18, "GST = 18% of pro-rated subtotal");

  // ── Test 3: add multiple modules at once — all pro-rated ──
  console.log("\nAdd TPRM + IA, both pro-rated");
  const multi = await computeQuote({
    customerAccountId: customer.id,
    lines: [
      { moduleCode: "TPRM", tier: "BASIC" },
      { moduleCode: "INTERNAL_AUDIT", tier: "BASIC" },
    ],
    cycle: "YEARLY",
    anchorEndDate: anchor,
  });
  assert(multi.lineItems.length === 2, "2 line items");
  assert(multi.lineItems.every((li) => li.isProRated && li.monthsCharged === 7), "all pro-rated to 7 months");
  // 2 × ₹50,000 × 7/12 = ₹58,333.33
  close(multi.subtotal, 58333.33, "subtotal = 2 × ₹50K × 7/12");

  // ── Test 4: anchor in past or absent → no pro-rata, full year ──
  console.log("\nNo anchor / past anchor → full year, no pro-rata");
  const fullPrice = await computeQuote({
    customerAccountId: customer.id,
    lines: [{ moduleCode: "TPRM", tier: "BASIC" }],
    cycle: "YEARLY",
  });
  assert(fullPrice.lineItems[0].isProRated === false, "no pro-rata when no anchor");
  assert(fullPrice.lineItems[0].unitPrice === 50000, "full yearly price ₹50,000");

  // ── Test 5: anchor exactly 12 months → no pro-rata (means cycle just renewed) ──
  console.log("\nAnchor 12 months out → no pro-rata");
  const twelve = new Date(today);
  twelve.setUTCMonth(twelve.getUTCMonth() + 12);
  const q12 = await computeQuote({
    customerAccountId: customer.id,
    lines: [{ moduleCode: "TPRM", tier: "BASIC" }],
    cycle: "YEARLY",
    anchorEndDate: twelve,
  });
  assert(q12.lineItems[0].isProRated === false, "12 months exact = no pro-rata");
  assert(q12.lineItems[0].unitPrice === 50000, "full ₹50K");

  // ── Test 6: anchor 1 month out → pro-rata to 1 month ──
  console.log("\nAnchor 1 month out → pro-rata");
  const oneMonth = new Date(today);
  oneMonth.setUTCMonth(oneMonth.getUTCMonth() + 1);
  const q1m = await computeQuote({
    customerAccountId: customer.id,
    lines: [{ moduleCode: "TPRM", tier: "BASIC" }],
    cycle: "YEARLY",
    anchorEndDate: oneMonth,
  });
  assert(q1m.lineItems[0].isProRated === true, "1 month → pro-rata");
  close(q1m.lineItems[0].unitPrice, 50000 / 12, "₹50K × 1/12 = ~₹4,166.67");

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());

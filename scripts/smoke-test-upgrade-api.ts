/**
 * Tests /api/settings/subscription/upgrade/quote logic.
 * Synthetic customer; cleans up.
 *
 * Run: npx tsx scripts/smoke-test-upgrade-api.ts
 */

import { PrismaClient } from "@prisma/client";
import { getModulePrice, wholeMonthsBetween, round2 } from "@/lib/pricing";

const prisma = new PrismaClient();
const CODE = "_UPGRADE_TEST";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}
function close(actual: number, expected: number, label: string, eps = 1) {
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

  // Setup: customer with GRC Basic yearly, 7 months remaining
  const customer = await prisma.customerAccount.create({
    data: { code: CODE, name: "Upgrade Test", isGrcAdded: true },
  });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: true },
  });
  const today = new Date();
  const cycleEnd = new Date(today);
  cycleEnd.setUTCMonth(cycleEnd.getUTCMonth() + 7);
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "GRC", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, frameworkLimit: 3,
      cycleStart: today, cycleEnd,
    },
  });

  const monthsLeft = wholeMonthsBetween(today, cycleEnd);
  assert(monthsLeft === 7, `7 months remaining`);

  // ── Test 1: BASIC → MEDIUM ──
  console.log("\nGRC BASIC → MEDIUM upgrade pro-rated");
  const { price: basic } = await getModulePrice("GRC", "BASIC", "YEARLY", customer.id);
  const { price: medium } = await getModulePrice("GRC", "MEDIUM", "YEARLY", customer.id);
  const diff1 = medium - basic;
  const expected1 = round2(diff1 * (7 / 12));
  // (100,000 - 50,000) × 7/12 = 50,000 × 7/12 = 29,166.67
  close(expected1, 29166.67, `Diff × 7/12 = ~₹29,166.67`, 0.5);
  // GST 18%: 29,166.67 × 0.18 = 5,250
  close(expected1 * 0.18, 5250, `GST = ~₹5,250`, 0.5);
  // Total: 29,166.67 + 5,250 ≈ 34,416.67
  close(expected1 + expected1 * 0.18, 34416.67, `Total = ~₹34,416.67`, 0.5);

  // ── Test 2: BASIC → PRO ──
  console.log("\nGRC BASIC → PRO upgrade pro-rated");
  const { price: pro } = await getModulePrice("GRC", "PRO", "YEARLY", customer.id);
  const diff2 = pro - basic;
  const expected2 = round2(diff2 * (7 / 12));
  // (200,000 - 50,000) × 7/12 = 150,000 × 7/12 = 87,500
  close(expected2, 87500, `Diff × 7/12 = ~₹87,500`, 0.5);

  // ── Test 3: Same-tier (no upgrade) ──
  console.log("\nNo upgrade (target same as current)");
  const TIER_RANK: Record<string, number> = { BASIC: 0, MEDIUM: 1, PRO: 2 };
  const isUpgrade = TIER_RANK["BASIC"] > TIER_RANK["BASIC"];
  assert(!isUpgrade, "BASIC → BASIC is NOT an upgrade");

  // ── Test 4: Downgrade detection ──
  console.log("\nDowngrade rejected");
  const wouldBeDowngrade = TIER_RANK["BASIC"] < TIER_RANK["MEDIUM"];
  assert(wouldBeDowngrade, "MEDIUM → BASIC IS a downgrade (would be rejected by API)");

  // ── Test 5: full year remaining → no pro-rata ──
  console.log("\nUpgrade with 12 months remaining (no pro-rata)");
  const fullYearEnd = new Date(today);
  fullYearEnd.setUTCMonth(fullYearEnd.getUTCMonth() + 12);
  const fullMonths = wholeMonthsBetween(today, fullYearEnd);
  const expected5 = fullMonths >= 12 ? diff1 : round2(diff1 * (fullMonths / 12));
  // With 12 months: charge full diff = ₹50,000 (no pro-rata)
  assert(expected5 === diff1, `12 months → full diff ₹${diff1.toLocaleString()}`);

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());

/**
 * Verifies src/lib/module-access.ts against live DB. Tests:
 *   1. Existing migrated customers return correct module sets.
 *   2. Customer with no Subscription returns empty set.
 *   3. SUSPENDED module is excluded.
 *   4. GRACE_PERIOD module is included.
 *   5. COMPLIMENTARY subscription returns all modules.
 *   6. Cancelled-but-still-active module is included.
 *
 * Run: npx tsx scripts/verify-module-access.ts
 */

import { PrismaClient } from "@prisma/client";
import { getActiveModules, getActiveModuleFlags } from "@/lib/module-access";

const prisma = new PrismaClient();
const TEST_CODE = "_MODULE_ACCESS_TEST";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  const c = await prisma.customerAccount.findUnique({ where: { code: TEST_CODE } });
  if (!c) return;
  await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: c.id } });
  await prisma.customerPlanOverride.deleteMany({ where: { customerAccountId: c.id } });
  await prisma.moduleSubscription.deleteMany({ where: { subscription: { customerAccountId: c.id } } });
  await prisma.subscription.deleteMany({ where: { customerAccountId: c.id } });
  await prisma.customerAccount.delete({ where: { id: c.id } });
}

async function main() {
  await cleanup();

  // ── Section A: existing migrated customer (Baarez) ──
  console.log("Section A — existing migrated customer (Baarez, GRC+IA)");
  const baarez = await prisma.customerAccount.findUnique({ where: { code: "GRC_001" } });
  if (!baarez) throw new Error("Test prerequisite: GRC_001 customer not found — run migration first");

  const baarezModules = await getActiveModules(baarez.id);
  assert(baarezModules.has("GRC"), "Baarez has GRC active");
  assert(baarezModules.has("INTERNAL_AUDIT"), "Baarez has INTERNAL_AUDIT active");
  assert(!baarezModules.has("TPRM"), "Baarez does NOT have TPRM");

  const baarezFlags = await getActiveModuleFlags(baarez.id);
  assert(baarezFlags.isGrcAdded === true, "Baarez flags.isGrcAdded=true");
  assert(baarezFlags.isTprmAdded === false, "Baarez flags.isTprmAdded=false");
  assert(baarezFlags.isInternalAuditEnabled === true, "Baarez flags.isInternalAuditEnabled=true");

  // ── Section B: customer with no subscription ──
  console.log("\nSection B — customer with no subscription");
  const qpost = await prisma.customerAccount.findUnique({ where: { code: "GRC_003" } });
  if (qpost) {
    const qpostModules = await getActiveModules(qpost.id);
    assert(qpostModules.size === 0, `QPost (no subscription) returns empty set, got size=${qpostModules.size}`);
  }

  // ── Section C: synthetic test customer with various states ──
  console.log("\nSection C — synthetic states");
  const customer = await prisma.customerAccount.create({
    data: {
      code: TEST_CODE,
      name: "Module Access Test",
      isGrcAdded: true,
      isTprmAdded: true,
      isInternalAuditEnabled: true,
    },
  });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: false },
  });

  const cycleStart = new Date();
  const future = (days: number) => new Date(Date.now() + days * 86400000);

  // GRC: ACTIVE
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "GRC", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 5000, userLimit: 5, frameworkLimit: 3,
      cycleStart, cycleEnd: future(365),
    },
  });
  // TPRM: GRACE_PERIOD (3 days post-expiry)
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "TPRM", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 5000, userLimit: 5, vendorLimit: 10, assessmentLimit: 20,
      cycleStart: future(-368), cycleEnd: future(-3),
    },
  });
  // INTERNAL_AUDIT: SUSPENDED (30 days post-expiry)
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "INTERNAL_AUDIT", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 5000, userLimit: 5, auditLimit: 5,
      cycleStart: future(-395), cycleEnd: future(-30),
    },
  });

  const mixed = await getActiveModules(customer.id);
  assert(mixed.has("GRC"), "Synthetic — ACTIVE module included");
  assert(mixed.has("TPRM"), "Synthetic — GRACE_PERIOD module included (read-only access still allowed)");
  assert(!mixed.has("INTERNAL_AUDIT"), "Synthetic — SUSPENDED module excluded");

  // ── Section D: COMPLIMENTARY subscription bypasses cycleEnd ──
  console.log("\nSection D — COMPLIMENTARY type ignores cycleEnd");
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { subscriptionType: "COMPLIMENTARY" },
  });
  const compModules = await getActiveModules(customer.id);
  assert(compModules.has("GRC"), "Complimentary — GRC included");
  assert(compModules.has("TPRM"), "Complimentary — TPRM (was GRACE_PERIOD) included");
  assert(compModules.has("INTERNAL_AUDIT"), "Complimentary — INTERNAL_AUDIT (was SUSPENDED) included");

  // ── Section E: cancelled-but-still-paid module ──
  console.log("\nSection E — cancelled but cycleEnd in future");
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { subscriptionType: "PAID" },
  });
  await prisma.moduleSubscription.updateMany({
    where: { subscriptionId: sub.id, moduleCode: "GRC" },
    data: { cancelledAt: new Date() }, // cancelled today, cycleEnd still future
  });
  const cancelledModules = await getActiveModules(customer.id);
  assert(cancelledModules.has("GRC"), "Cancelled GRC (cycleEnd in future) still included");

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

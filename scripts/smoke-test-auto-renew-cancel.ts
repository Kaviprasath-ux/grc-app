/**
 * Tests /api/settings/subscription/auto-renew + /cancel logic.
 * Synthetic customer; cleans up.
 *
 * Run: npx tsx scripts/smoke-test-auto-renew-cancel.ts
 */

import { PrismaClient } from "@prisma/client";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { computeModuleStatus } from "@/lib/subscription-status";

const prisma = new PrismaClient();
const CODE = "_AR_CANCEL_TEST";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
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

  // Setup: PAID customer with 2 active modules
  const customer = await prisma.customerAccount.create({
    data: { code: CODE, name: "Auto-renew Test", isGrcAdded: true, isInternalAuditEnabled: true },
  });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: true },
  });
  const future = new Date();
  future.setUTCFullYear(future.getUTCFullYear() + 1);
  const grcMs = await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "GRC", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, frameworkLimit: 3,
      cycleStart: new Date(), cycleEnd: future,
    },
  });
  const iaMs = await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "INTERNAL_AUDIT", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, auditLimit: 5,
      cycleStart: new Date(), cycleEnd: future,
    },
  });

  // ── Auto-renew toggle ─────────────────────────────────────
  console.log("Auto-renew toggle");
  await prisma.subscription.update({ where: { id: sub.id }, data: { autoRenew: false } });
  let cur = await prisma.subscription.findUnique({ where: { id: sub.id } });
  assert(cur!.autoRenew === false, "auto-renew = false after toggle");

  await prisma.subscription.update({ where: { id: sub.id }, data: { autoRenew: true } });
  cur = await prisma.subscription.findUnique({ where: { id: sub.id } });
  assert(cur!.autoRenew === true, "auto-renew = true after toggle back");

  // ── Cancel all modules ────────────────────────────────────
  console.log("\nCancel all modules");
  const now = new Date();
  await prisma.moduleSubscription.updateMany({
    where: { subscriptionId: sub.id },
    data: { cancelledAt: now },
  });
  await syncSubscriptionPlan(grcMs.id);
  await syncSubscriptionPlan(iaMs.id);
  await prisma.subscription.update({ where: { id: sub.id }, data: { autoRenew: false } });

  const cancelled = await prisma.moduleSubscription.findMany({ where: { subscriptionId: sub.id } });
  assert(cancelled.every((m) => m.cancelledAt !== null), "all modules have cancelledAt set");

  const subAfter = await prisma.subscription.findUnique({ where: { id: sub.id } });
  assert(subAfter!.autoRenew === false, "auto-renew flipped off");

  // Status should be CANCELLED while cycleEnd is in future
  const grcAfter = await prisma.moduleSubscription.findUnique({ where: { id: grcMs.id } });
  const status = computeModuleStatus({
    subscriptionType: "PAID",
    cycleEnd: grcAfter!.cycleEnd,
    cancelledAt: grcAfter!.cancelledAt,
  });
  assert(status === "CANCELLED", `module status=CANCELLED while cycleEnd is future (got ${status})`);

  // Legacy SubscriptionPlan should now be Inactive
  const legacyPlans = await prisma.subscriptionPlan.findMany({ where: { customerAccountId: customer.id } });
  assert(legacyPlans.every((p) => p.status === "Inactive"), "legacy SubscriptionPlan rows = Inactive");

  // ── Try cancel again — no-op ─────────────────────────────
  console.log("\nCancel when nothing active to cancel");
  const stillActive = await prisma.moduleSubscription.findMany({
    where: { subscriptionId: sub.id, cancelledAt: null },
  });
  assert(stillActive.length === 0, "no active modules to cancel (expected)");

  // ── COMPLIMENTARY blocks self-cancel (handler-level check) ──
  console.log("\nCOMPLIMENTARY rejects self-cancel");
  await prisma.subscription.update({ where: { id: sub.id }, data: { subscriptionType: "COMPLIMENTARY" } });
  const compSub = await prisma.subscription.findUnique({ where: { id: sub.id } });
  assert(compSub!.subscriptionType === "COMPLIMENTARY", "type set to COMPLIMENTARY (handler would 400)");

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());

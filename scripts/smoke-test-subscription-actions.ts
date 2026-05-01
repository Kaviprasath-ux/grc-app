/**
 * Exercises the subscription drill-in actions: extend, cancel, re-enable, grant/revoke
 * complimentary. Uses a synthetic customer; cleans up after itself.
 *
 * Run: npx tsx scripts/smoke-test-subscription-actions.ts
 */

import { PrismaClient } from "@prisma/client";
import { computeSubscriptionStatus, computeModuleStatus } from "@/lib/subscription-status";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";

const prisma = new PrismaClient();
const CODE = "_SUB_ACTIONS_TEST";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  const c = await prisma.customerAccount.findUnique({ where: { code: CODE } });
  if (c) {
    await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.customerPlanOverride.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.moduleSubscription.deleteMany({ where: { subscription: { customerAccountId: c.id } } });
    await prisma.subscription.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.customerAccount.delete({ where: { id: c.id } });
  }
}

async function main() {
  await cleanup();

  // Setup
  const customer = await prisma.customerAccount.create({
    data: { code: CODE, name: "Action Test", isGrcAdded: true, isInternalAuditEnabled: true },
  });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: true },
  });
  const cycleStart = new Date();
  const cycleEnd = new Date();
  cycleEnd.setUTCFullYear(cycleEnd.getUTCFullYear() + 1);
  const grcMs = await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "GRC", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, frameworkLimit: 3, cycleStart, cycleEnd,
    },
  });
  const iaMs = await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "INTERNAL_AUDIT", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, auditLimit: 5, cycleStart, cycleEnd,
    },
  });
  await syncSubscriptionPlan(grcMs.id);
  await syncSubscriptionPlan(iaMs.id);

  // ── Extend (single module) ────────────────────────────────────
  console.log("Extend GRC by 30 days");
  const before = grcMs.cycleEnd.getTime();
  await prisma.moduleSubscription.update({
    where: { id: grcMs.id },
    data: { cycleEnd: new Date(before + 30 * 86400000) },
  });
  const grcAfter = await prisma.moduleSubscription.findUnique({ where: { id: grcMs.id } });
  assert(grcAfter!.cycleEnd.getTime() === before + 30 * 86400000, "GRC cycleEnd extended by exactly 30 days");

  // IA unchanged
  const iaAfter = await prisma.moduleSubscription.findUnique({ where: { id: iaMs.id } });
  assert(iaAfter!.cycleEnd.getTime() === cycleEnd.getTime(), "IA cycleEnd unchanged when extending GRC only");

  // ── Cancel single module ──────────────────────────────────────
  console.log("\nCancel IA module only");
  await prisma.moduleSubscription.update({
    where: { id: iaMs.id },
    data: { cancelledAt: new Date() },
  });
  await syncSubscriptionPlan(iaMs.id);

  const iaCancelled = await prisma.moduleSubscription.findUnique({ where: { id: iaMs.id } });
  assert(iaCancelled!.cancelledAt !== null, "IA cancelledAt set");

  const iaStatus = computeModuleStatus({
    subscriptionType: "PAID",
    cycleEnd: iaCancelled!.cycleEnd,
    cancelledAt: iaCancelled!.cancelledAt,
  });
  assert(iaStatus === "CANCELLED", "IA module status = CANCELLED (still in paid period)");

  // GRC unaffected
  const grcStatus = computeModuleStatus({
    subscriptionType: "PAID",
    cycleEnd: grcAfter!.cycleEnd,
    cancelledAt: null,
  });
  assert(grcStatus === "ACTIVE", "GRC unaffected by cancelling IA");

  // ── Re-enable IA ──────────────────────────────────────────────
  console.log("\nRe-enable IA module");
  await prisma.moduleSubscription.update({
    where: { id: iaMs.id },
    data: { cancelledAt: null },
  });
  const iaReenabled = await prisma.moduleSubscription.findUnique({ where: { id: iaMs.id } });
  assert(iaReenabled!.cancelledAt === null, "IA cancelledAt cleared");

  // ── Grant Complimentary ───────────────────────────────────────
  console.log("\nGrant Complimentary");
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { subscriptionType: "COMPLIMENTARY", notes: "Granted by test" },
  });
  const comp = await prisma.subscription.findUnique({ where: { id: sub.id }, include: { modules: true } });
  const compRollup = computeSubscriptionStatus({
    subscriptionType: comp!.subscriptionType,
    trialEndsAt: comp!.trialEndsAt,
    modules: comp!.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
  });
  assert(compRollup === "ACTIVE", "Complimentary rollup = ACTIVE regardless of cycleEnd");

  // Even if I expire all modules, complimentary stays ACTIVE
  const wayPast = new Date("2020-01-01Z");
  await prisma.moduleSubscription.updateMany({
    where: { subscriptionId: sub.id },
    data: { cycleEnd: wayPast },
  });
  const compExpired = await prisma.subscription.findUnique({ where: { id: sub.id }, include: { modules: true } });
  const compRollup2 = computeSubscriptionStatus({
    subscriptionType: compExpired!.subscriptionType,
    trialEndsAt: compExpired!.trialEndsAt,
    modules: compExpired!.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
  });
  assert(compRollup2 === "ACTIVE", "Complimentary stays ACTIVE even with expired cycleEnd");

  // ── Revoke Complimentary → returns to PAID, rollup reflects expired ──
  console.log("\nRevoke Complimentary");
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { subscriptionType: "PAID" },
  });
  const revoked = await prisma.subscription.findUnique({ where: { id: sub.id }, include: { modules: true } });
  const revokedStatus = computeSubscriptionStatus({
    subscriptionType: revoked!.subscriptionType,
    trialEndsAt: revoked!.trialEndsAt,
    modules: revoked!.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
  });
  assert(revokedStatus === "SUSPENDED", "After revoke + expired cycleEnd → SUSPENDED");

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());

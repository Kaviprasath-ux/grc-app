/**
 * Verification harness for src/lib/subscription-plan-sync.ts.
 * Exercises four scenarios end-to-end against the live DB, then cleans up.
 *
 * Run: npx tsx scripts/verify-subscription-plan-sync.ts
 */

import { PrismaClient } from "@prisma/client";
import { syncSubscriptionPlan, UNLIMITED_LEGACY_VALUE } from "@/lib/subscription-plan-sync";

const prisma = new PrismaClient();

const TEST_CODE = "_SYNC_TEST_CUSTOMER";

async function cleanup() {
  const c = await prisma.customerAccount.findUnique({ where: { code: TEST_CODE } });
  if (!c) return;
  await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: c.id } });
  await prisma.customerPlanOverride.deleteMany({ where: { customerAccountId: c.id } });
  await prisma.moduleSubscription.deleteMany({ where: { subscription: { customerAccountId: c.id } } });
  await prisma.subscription.deleteMany({ where: { customerAccountId: c.id } });
  await prisma.customerAccount.delete({ where: { id: c.id } });
}

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`  ✗ FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${label}`);
  }
}

async function main() {
  console.log("Setting up test customer...");
  await cleanup(); // in case prior run failed

  const customer = await prisma.customerAccount.create({
    data: {
      code: TEST_CODE,
      name: "Sync Test Customer",
      isGrcAdded: true,
      isTprmAdded: true,
      isInternalAuditEnabled: true,
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      customerAccountId: customer.id,
      status: "ACTIVE",
      subscriptionType: "PAID",
      autoRenew: true,
    },
  });

  const cycleStart = new Date();
  const cycleEnd = new Date();
  cycleEnd.setUTCFullYear(cycleEnd.getUTCFullYear() + 1);

  // ── Scenario 1 ─────────────────────────────────────────────
  console.log("\nScenario 1: create TPRM Medium → SubscriptionPlan row created");
  const tprmMs = await prisma.moduleSubscription.create({
    data: {
      subscriptionId: subscription.id,
      moduleCode: "TPRM",
      tier: "MEDIUM",
      billingCycle: "YEARLY",
      unitPrice: 10000,
      userLimit: 15,
      vendorLimit: 50,
      assessmentLimit: 100,
      cycleStart,
      cycleEnd,
    },
  });
  const r1 = await syncSubscriptionPlan(tprmMs.id);
  assert(r1.action === "created", "first sync creates new SubscriptionPlan row");
  const tprmPlan = await prisma.subscriptionPlan.findFirst({
    where: { customerAccountId: customer.id, moduleCode: "TPRM" },
  });
  assert(tprmPlan !== null, "SubscriptionPlan row exists for TPRM");
  assert(tprmPlan?.tier === "MEDIUM", "tier=MEDIUM");
  assert(tprmPlan?.maxAccountsAllowed === 15, "maxAccountsAllowed=15");
  assert(tprmPlan?.vendorLimit === 50, "vendorLimit=50");
  assert(tprmPlan?.assessmentLimit === 100, "assessmentLimit=100");
  assert(tprmPlan?.maxFrameworksAllowed === 0, "maxFrameworksAllowed=0 (not applicable to TPRM)");
  assert(tprmPlan?.status === "Active", "status=Active");

  // ── Scenario 2 ─────────────────────────────────────────────
  console.log("\nScenario 2: upgrade TPRM Medium → Pro → SubscriptionPlan row updated, no duplicate");
  await prisma.moduleSubscription.update({
    where: { id: tprmMs.id },
    data: {
      tier: "PRO",
      unitPrice: 20000,
      userLimit: 50,
      vendorLimit: 250,
      assessmentLimit: 500,
      previousTier: "MEDIUM",
      tierChangedAt: new Date(),
    },
  });
  const r2 = await syncSubscriptionPlan(tprmMs.id);
  assert(r2.action === "updated", "second sync updates same row");
  const tprmCount = await prisma.subscriptionPlan.count({
    where: { customerAccountId: customer.id, moduleCode: "TPRM" },
  });
  assert(tprmCount === 1, "still exactly one TPRM SubscriptionPlan row (no duplicate)");
  const tprmPlan2 = await prisma.subscriptionPlan.findFirst({
    where: { customerAccountId: customer.id, moduleCode: "TPRM" },
  });
  assert(tprmPlan2?.tier === "PRO", "tier upgraded to PRO");
  assert(tprmPlan2?.vendorLimit === 250, "vendorLimit upgraded to 250");

  // ── Scenario 3 ─────────────────────────────────────────────
  console.log("\nScenario 3: GRC Pro with unlimited frameworks → maxFrameworksAllowed = UNLIMITED_LEGACY_VALUE");
  const grcMs = await prisma.moduleSubscription.create({
    data: {
      subscriptionId: subscription.id,
      moduleCode: "GRC",
      tier: "PRO",
      billingCycle: "YEARLY",
      unitPrice: 20000,
      userLimit: 50,
      frameworkLimit: null, // unlimited
      cycleStart,
      cycleEnd,
    },
  });
  await syncSubscriptionPlan(grcMs.id);
  const grcPlan = await prisma.subscriptionPlan.findFirst({
    where: { customerAccountId: customer.id, moduleCode: "GRC" },
  });
  assert(grcPlan !== null, "GRC plan created");
  assert(grcPlan?.maxFrameworksAllowed === UNLIMITED_LEGACY_VALUE, `maxFrameworksAllowed=${UNLIMITED_LEGACY_VALUE} for unlimited`);
  assert(grcPlan?.vendorLimit === 0, "vendorLimit=0 (not applicable to GRC)");

  // ── Scenario 4 ─────────────────────────────────────────────
  console.log("\nScenario 4: cancel TPRM ModuleSubscription → SubscriptionPlan.status=Inactive");
  await prisma.moduleSubscription.update({
    where: { id: tprmMs.id },
    data: { cancelledAt: new Date() },
  });
  await syncSubscriptionPlan(tprmMs.id);
  const tprmPlan3 = await prisma.subscriptionPlan.findFirst({
    where: { customerAccountId: customer.id, moduleCode: "TPRM" },
  });
  assert(tprmPlan3?.status === "Inactive", "TPRM SubscriptionPlan now Inactive");
  // GRC unchanged
  const grcPlan2 = await prisma.subscriptionPlan.findFirst({
    where: { customerAccountId: customer.id, moduleCode: "GRC" },
  });
  assert(grcPlan2?.status === "Active", "GRC plan still Active (cancelling TPRM did not touch GRC)");

  // ── Scenario 5 ─────────────────────────────────────────────
  console.log("\nScenario 5: missing moduleSubscriptionId → returns skipped-missing");
  const r5 = await syncSubscriptionPlan("nonexistent-id-zzz");
  assert(r5.action === "skipped-missing", "returns skipped-missing for unknown id");

  console.log("\nCleaning up test customer...");
  await cleanup();

  if (process.exitCode === 1) {
    console.log("\n✗ Some assertions failed.");
  } else {
    console.log("\n✓ All sync scenarios passed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

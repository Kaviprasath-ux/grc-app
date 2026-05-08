/**
 * Phase 4 smoke test - V2 signup end-to-end against a running dev server.
 *
 * Boots the V2 endpoint via HTTP, asserts:
 *   1. CustomerAccount + admin User + Subscription created
 *   2. Each ModuleSubscription has all V2 fields populated correctly:
 *        planType=BASE, nextPlanType=GENERAL
 *        baseStartDate ~today, baseEndDate ~+1y
 *        contractStartDate ~today, contractEndDate ~+2y
 *        generalStartDate=baseEndDate, generalBillingCycle as chosen
 *   3. Legacy SubscriptionPlan synced with the BASE limits
 *   4. Cleans up the test customer at end
 *
 * Run (with dev server running on :3000):
 *   SUBSCRIPTION_V2_ENABLED=true npm run dev
 *   npx tsx scripts/smoke-test-v2-signup.ts
 */

import prisma from "../src/lib/prisma";

const API_BASE = process.env.SMOKE_API_BASE || "http://localhost:3000";
const TEST_EMAIL = `smoke-v2-${Date.now()}@example.test`;
const TEST_ORG = `Smoke V2 Co ${Date.now().toString(36).slice(-4)}`;

let pass = 0, fail = 0;
function ok(label: string, actual: unknown, expected: unknown) {
  const isPass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${isPass ? "✓" : "✗"} ${label}: got ${JSON.stringify(actual)}${isPass ? "" : " (expected " + JSON.stringify(expected) + ")"}`);
  if (isPass) pass++;
  else { fail++; process.exitCode = 1; }
}

function approxEq(label: string, actual: Date | null | undefined, expectedDays: number, toleranceDays = 1) {
  if (!actual) {
    console.log(`✗ ${label}: actual was null/undefined`);
    fail++; process.exitCode = 1;
    return;
  }
  const now = Date.now();
  const diffDays = (new Date(actual).getTime() - now) / 86400000;
  const within = Math.abs(diffDays - expectedDays) <= toleranceDays;
  console.log(`${within ? "✓" : "✗"} ${label}: ${diffDays.toFixed(1)}d from now (expected ~${expectedDays}d)`);
  if (within) pass++; else { fail++; process.exitCode = 1; }
}

async function run() {
  console.log("=== Phase 4 V2 signup smoke ===\n");
  console.log(`Endpoint: ${API_BASE}/api/public/signup/v2`);
  console.log(`Test email: ${TEST_EMAIL}\n`);

  // Step 1: Hit the V2 signup endpoint
  const res = await fetch(`${API_BASE}/api/public/signup/v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationName: TEST_ORG,
      adminFirstName: "Smoke",
      adminLastName: "Tester",
      adminEmail: TEST_EMAIL,
      adminPassword: "smoke-test-pw-1234",
      modules: [{ moduleCode: "GRC" }, { moduleCode: "TPRM" }],
      generalBillingCycle: "MONTHLY",
      contractAccepted: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Signup failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  ok("API returned 201", res.status, 201);
  ok("customerCode present", typeof json.data.customerCode, "string");

  // Step 2: Verify DB state
  const customer = await prisma.customerAccount.findFirst({
    where: { name: TEST_ORG },
    include: {
      users: true,
      subscription: { include: { modules: true } },
      subscriptionPlans: true,
    },
  });
  if (!customer) throw new Error("Customer not created in DB");

  ok("Customer flags GRC", customer.isGrcAdded, true);
  ok("Customer flags TPRM", customer.isTprmAdded, true);
  ok("Customer flags Internal Audit (not selected)", customer.isInternalAuditEnabled, false);

  ok("One admin user", customer.users.length, 1);
  ok("Admin user role", customer.users[0].role, "CustomerAdministrator");

  if (!customer.subscription) throw new Error("Subscription not created");
  ok("Subscription type PAID", customer.subscription.subscriptionType, "PAID");
  ok("Subscription status ACTIVE", customer.subscription.status, "ACTIVE");
  ok("Two ModuleSubscriptions", customer.subscription.modules.length, 2);

  // Step 3: Verify V2 lifecycle fields per module
  for (const ms of customer.subscription.modules) {
    console.log(`\n  Module: ${ms.moduleCode}`);
    ok(`  ${ms.moduleCode} planType BASE`, ms.planType, "BASE");
    ok(`  ${ms.moduleCode} nextPlanType GENERAL`, ms.nextPlanType, "GENERAL");
    ok(`  ${ms.moduleCode} generalBillingCycle MONTHLY`, ms.generalBillingCycle, "MONTHLY");
    approxEq(`  ${ms.moduleCode} baseStartDate ~today`, ms.baseStartDate, 0);
    approxEq(`  ${ms.moduleCode} baseEndDate ~+365d`, ms.baseEndDate, 365);
    approxEq(`  ${ms.moduleCode} contractStartDate ~today`, ms.contractStartDate, 0);
    approxEq(`  ${ms.moduleCode} contractEndDate ~+730d`, ms.contractEndDate, 730);
    approxEq(`  ${ms.moduleCode} generalStartDate ~+365d`, ms.generalStartDate, 365);
    approxEq(`  ${ms.moduleCode} cycleEnd ~+365d (=baseEnd)`, ms.cycleEnd, 365);
    ok(`  ${ms.moduleCode} unitPrice ₹100`, Number(ms.unitPrice), 100);
  }

  // Step 4: Legacy sync
  ok("\nLegacy SubscriptionPlans created", customer.subscriptionPlans.length, 2);
  for (const sp of customer.subscriptionPlans) {
    ok(`  ${sp.moduleCode} plan status Active`, sp.status, "Active");
  }

  // Cleanup
  console.log("\nCleaning up...");
  await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: customer.id } });
  await prisma.moduleSubscription.deleteMany({
    where: { subscriptionId: customer.subscription.id },
  });
  await prisma.subscription.delete({ where: { id: customer.subscription.id } });
  await prisma.userRole.deleteMany({ where: { userId: { in: customer.users.map(u => u.id) } } });
  await prisma.user.deleteMany({ where: { customerAccountId: customer.id } });
  await prisma.customerAccount.delete({ where: { id: customer.id } });
  console.log("  Done.");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
}

run()
  .catch((e) => { console.error("FATAL:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

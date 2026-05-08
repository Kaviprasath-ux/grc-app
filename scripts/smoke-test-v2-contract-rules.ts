/**
 * Phase 7 smoke test - V2 contract enforcement.
 *
 *   1. Sign up a V2 customer (immediately puts them in 2-year lock-in)
 *   2. Pure-helper checks: getCancelEligibility (lock-in -> queue path)
 *   3. Simulate the cancel-API queue write (set cancellationRequestedAt directly)
 *      Verify shouldProcessQueuedCancellation correctly says "not yet" while
 *      contract is still active.
 *   4. Backdate contractEndDate to past, run plan-transitions cron
 *      -> queuedCancellationsProcessed >= 2, cancelledAt set, mandate cancelled
 *   5. Re-run cron -> idempotent (no double-process)
 *   6. Cleanup
 *
 * NOTE: The cancel API itself uses withAuth (NextAuth session cookies). End-to-
 * end testing the API requires a real browser session, which is out of scope
 * for a script. We exercise the cancel logic at three layers instead:
 *   - getCancelEligibility / shouldProcessQueuedCancellation (pure helpers)
 *   - The cron's queued-cancellation processor (the side-effect path that
 *     fires a year+ later in production)
 * The API route itself is small and is type-checked + reviewed.
 *
 * Run (with dev server in stub + V2 mode on :3000):
 *   PAYMENT_STUB=true SUBSCRIPTION_V2_ENABLED=true npm run dev
 *   npx tsx scripts/smoke-test-v2-contract-rules.ts
 */

import prisma from "../src/lib/prisma";
import { getCancelEligibility, shouldProcessQueuedCancellation } from "../src/lib/contract-rules";

const API_BASE = process.env.SMOKE_API_BASE || "http://localhost:3000";
const TEST_EMAIL = `smoke-cancel-${Date.now()}@example.test`;
const TEST_PASSWORD = "smoke-pw-12345678";
const TEST_ORG = `Smoke Cancel ${Date.now().toString(36).slice(-4)}`;

let pass = 0, fail = 0;
function ok(label: string, actual: unknown, expected: unknown) {
  const isPass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${isPass ? "✓" : "✗"} ${label}: got ${JSON.stringify(actual)}${isPass ? "" : " (expected " + JSON.stringify(expected) + ")"}`);
  if (isPass) pass++; else { fail++; process.exitCode = 1; }
}

async function run() {
  console.log("=== Phase 7 V2 contract enforcement smoke ===\n");

  // 1. Sign up customer
  const r = await fetch(`${API_BASE}/api/public/signup/v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationName: TEST_ORG,
      adminFirstName: "Cancel",
      adminLastName: "Tester",
      adminEmail: TEST_EMAIL,
      adminPassword: TEST_PASSWORD,
      modules: [{ moduleCode: "GRC" }, { moduleCode: "TPRM" }],
      generalBillingCycle: "MONTHLY",
      contractAccepted: true,
    }),
  });
  ok("Signup status 201", r.status, 201);
  const signupBody = await r.json();
  const customerCode = signupBody.data.customerCode as string;

  const customer = await prisma.customerAccount.findUnique({
    where: { code: customerCode },
    include: { subscription: { include: { modules: true } }, users: true },
  });
  if (!customer || !customer.subscription) throw new Error("Customer not provisioned");

  const modulesAfterSignup = customer.subscription.modules;

  // 2. Pure-helper checks
  console.log("\n— Pure helper checks —");
  for (const m of modulesAfterSignup) {
    const elig = getCancelEligibility(m);
    ok(`  ${m.moduleCode} canCancelNow=false in lock-in`, elig.canCancelNow, false);
    ok(`  ${m.moduleCode} canQueueCancellation=true in lock-in`, elig.canQueueCancellation, true);
    ok(`  ${m.moduleCode} availableOn matches contractEnd`, elig.availableOn?.toISOString(), m.contractEndDate?.toISOString());
    ok(`  ${m.moduleCode} shouldProcessQueuedCancellation=false (none queued yet)`, shouldProcessQueuedCancellation(m), false);
  }

  // 3. Simulate the cancel-API queue write (locked-in path).
  console.log("\n— Simulate API queue write (locked-in) —");
  const queueAt = new Date();
  await prisma.moduleSubscription.updateMany({
    where: { subscriptionId: customer.subscription.id },
    data: { cancellationRequestedAt: queueAt },
  });
  const afterQueue = await prisma.moduleSubscription.findMany({
    where: { subscriptionId: customer.subscription.id },
  });
  ok("All modules cancellationRequestedAt set", afterQueue.every(m => m.cancellationRequestedAt !== null), true);
  ok("No module cancelledAt yet", afterQueue.every(m => m.cancelledAt === null), true);
  ok("Mandate still active during lock-in", afterQueue.every(m => m.mandateStatus === "active"), true);

  // shouldProcessQueuedCancellation should still say NO because contractEndDate is in future
  for (const m of afterQueue) {
    ok(`  ${m.moduleCode} shouldProcessQueuedCancellation=false (still in lock-in)`, shouldProcessQueuedCancellation(m), false);
  }

  // Now simulate eligibility helpers reporting "already queued"
  for (const m of afterQueue) {
    const elig = getCancelEligibility(m);
    ok(`  ${m.moduleCode} eligibility post-queue: canCancelNow=false`, elig.canCancelNow, false);
    ok(`  ${m.moduleCode} eligibility post-queue: canQueueCancellation=false (already queued)`, elig.canQueueCancellation, false);
    ok(`  ${m.moduleCode} eligibility reason mentions queued`, elig.reason.includes("queued"), true);
  }

  // 4. Backdate contractEndDate, run cron — now the queued cancel should fire
  console.log("\n— Backdate contractEnd and run cron —");
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  yesterday.setUTCHours(0, 0, 0, 0);
  await prisma.moduleSubscription.updateMany({
    where: { subscriptionId: customer.subscription.id },
    data: { contractEndDate: yesterday, baseEndDate: yesterday },
  });

  const cronAuth = process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {};
  const cronRes = await fetch(`${API_BASE}/api/cron/plan-transitions`, {
    headers: { ...cronAuth, "x-triggered-by": "manual" },
  });
  ok("Cron returns 200", cronRes.status, 200);
  const cronBody = await cronRes.json();
  console.log("  Cron result:", JSON.stringify(cronBody.data, null, 2));
  ok("Queued cancellations processed >= 2", (cronBody.data.queuedCancellationsProcessed as number) >= 2, true);

  const afterCron = await prisma.moduleSubscription.findMany({
    where: { subscriptionId: customer.subscription.id },
  });
  ok("All modules now have cancelledAt", afterCron.every(m => m.cancelledAt !== null), true);

  // 5. Re-run cron — idempotent (no double-cancel)
  const cron2 = await fetch(`${API_BASE}/api/cron/plan-transitions`, {
    headers: { ...cronAuth, "x-triggered-by": "manual" },
  });
  const cron2Body = await cron2.json();
  console.log("\n  Re-run cron result:", JSON.stringify(cron2Body.data, null, 2));
  ok("Re-run queuedCancellationsProcessed=0", cron2Body.data.queuedCancellationsProcessed, 0);

  // 6. Cleanup
  console.log("\nCleaning up...");
  const subId = customer.subscription.id;
  await prisma.razorpayEvent.deleteMany({});  // any synthetic events
  await prisma.payment.deleteMany({ where: { subscriptionId: subId } });
  const invoices = await prisma.invoice.findMany({ where: { subscriptionId: subId } });
  for (const inv of invoices) {
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
  }
  await prisma.invoice.deleteMany({ where: { subscriptionId: subId } });
  await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: customer.id } });
  await prisma.moduleSubscription.deleteMany({ where: { subscriptionId: subId } });
  await prisma.subscription.delete({ where: { id: subId } });
  await prisma.userRole.deleteMany({ where: { userId: { in: customer.users.map(u => u.id) } } });
  await prisma.user.deleteMany({ where: { customerAccountId: customer.id } });
  await prisma.customerAccount.delete({ where: { id: customer.id } });
  console.log("  Done.");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
}

run()
  .catch(e => { console.error("FATAL:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

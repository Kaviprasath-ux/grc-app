/**
 * Phase 6 smoke test - V2 plan-transitions cron.
 *
 *   1. Create a V2 customer via the V2 signup endpoint
 *   2. Backdate baseEndDate to yesterday on every ModuleSubscription
 *   3. Hit the cron endpoint
 *   4. Verify each row flipped: planType=GENERAL, new cycleEnd, new limits,
 *      new invoice with the GENERAL price, payment captured
 *   5. Run the cron a SECOND time -> should be a no-op (idempotency)
 *   6. Cleanup
 *
 * Run (with dev server in stub + V2 mode on :3000):
 *   PAYMENT_STUB=true SUBSCRIPTION_V2_ENABLED=true npm run dev
 *   npx tsx scripts/smoke-test-v2-plan-transitions.ts
 */

import prisma from "../src/lib/prisma";

const API_BASE = process.env.SMOKE_API_BASE || "http://localhost:3000";
const TEST_EMAIL = `smoke-flip-${Date.now()}@example.test`;
const TEST_ORG = `Smoke Flip ${Date.now().toString(36).slice(-4)}`;

let pass = 0, fail = 0;
function ok(label: string, actual: unknown, expected: unknown) {
  const isPass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${isPass ? "✓" : "✗"} ${label}: got ${JSON.stringify(actual)}${isPass ? "" : " (expected " + JSON.stringify(expected) + ")"}`);
  if (isPass) pass++;
  else { fail++; process.exitCode = 1; }
}

async function run() {
  console.log("=== Phase 6 V2 plan-transitions smoke ===\n");

  // 1. Sign up a V2 customer (MONTHLY general cycle)
  const r = await fetch(`${API_BASE}/api/public/signup/v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationName: TEST_ORG,
      adminFirstName: "Flip",
      adminLastName: "Tester",
      adminEmail: TEST_EMAIL,
      adminPassword: "smoke-pw-12345678",
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
    include: { subscription: { include: { modules: true, invoices: true } }, users: true },
  });
  if (!customer || !customer.subscription) throw new Error("Customer not provisioned");

  // 2. Backdate baseEndDate to yesterday so the cron picks them up
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  yesterday.setUTCHours(0, 0, 0, 0);
  await prisma.moduleSubscription.updateMany({
    where: { subscriptionId: customer.subscription.id },
    data: { baseEndDate: yesterday },
  });
  console.log(`  Backdated baseEndDate to ${yesterday.toISOString()}\n`);

  // Capture pre-flip state
  const before = await prisma.moduleSubscription.findMany({
    where: { subscriptionId: customer.subscription.id },
    orderBy: { moduleCode: "asc" },
  });
  ok("All start as BASE", before.every(m => m.planType === "BASE"), true);
  ok("Pre-flip unitPrice = 100", before.every(m => Number(m.unitPrice) === 100), true);

  // 3. Hit the cron endpoint
  const cronAuth = process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {};
  const cron1 = await fetch(`${API_BASE}/api/cron/plan-transitions`, {
    headers: { ...cronAuth, "x-triggered-by": "manual" },
  });
  ok("Cron 1 returned 200", cron1.status, 200);
  const cron1Body = await cron1.json();
  console.log(`  Cron 1 result:`, JSON.stringify(cron1Body.data, null, 2));
  ok("Flipped at least 2 rows in run 1", (cron1Body.data.flipped as number) >= 2, true);

  // 4. Verify post-flip state
  const after = await prisma.moduleSubscription.findMany({
    where: { subscriptionId: customer.subscription.id },
    orderBy: { moduleCode: "asc" },
  });
  ok("All flipped to GENERAL", after.every(m => m.planType === "GENERAL"), true);
  ok("nextPlanType cleared", after.every(m => m.nextPlanType === null), true);
  ok("billingCycle MONTHLY (matches signup choice)", after.every(m => m.billingCycle === "MONTHLY"), true);
  ok("unitPrice now 1500 (GENERAL monthly)", after.every(m => Number(m.unitPrice) === 1500), true);
  ok("userLimit refreshed to 25 (GENERAL)", after.every(m => m.userLimit === 25), true);
  for (const m of after) {
    const cycleSpanDays = Math.round((m.cycleEnd.getTime() - m.cycleStart.getTime()) / 86400000);
    const within = cycleSpanDays >= 28 && cycleSpanDays <= 31;
    console.log(`  ${m.moduleCode}: cycle ${cycleSpanDays}d (${m.cycleStart.toISOString().slice(0,10)} -> ${m.cycleEnd.toISOString().slice(0,10)})`);
    if (!within) { fail++; process.exitCode = 1; } else pass++;
  }

  // Verify new GENERAL invoices were created (one per module)
  const invoices = await prisma.invoice.findMany({
    where: { subscriptionId: customer.subscription.id },
    orderBy: { issueDate: "asc" },
    include: { items: true, payment: true },
  });
  ok("3 invoices total (1 BASE + 2 GENERAL)", invoices.length, 3);
  const generalInvoices = invoices.slice(1);
  ok("GENERAL invoices PAID (stub)", generalInvoices.every(i => i.status === "PAID"), true);
  ok("GENERAL invoice subtotal 1500 each", generalInvoices.every(i => Number(i.subtotal) === 1500), true);
  ok("GENERAL invoice total 1770 (1500 + 18% GST)", generalInvoices.every(i => Number(i.total) === 1770), true);
  ok("GENERAL payments captured", generalInvoices.every(i => i.payment !== null && i.payment.status === "CAPTURED"), true);

  // 5. Idempotency: re-run cron, no flips this time
  const cron2 = await fetch(`${API_BASE}/api/cron/plan-transitions`, {
    headers: { ...cronAuth, "x-triggered-by": "manual" },
  });
  const cron2Body = await cron2.json();
  console.log(`\n  Cron 2 (idempotency check):`, JSON.stringify(cron2Body.data, null, 2));
  ok("Cron 2 returned 200", cron2.status, 200);
  ok("Cron 2 flipped 0", cron2Body.data.flipped, 0);

  // 6. Cleanup
  console.log("\nCleaning up...");
  const subId = customer.subscription.id;
  await prisma.payment.deleteMany({ where: { subscriptionId: subId } });
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

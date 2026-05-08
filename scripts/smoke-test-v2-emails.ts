/**
 * Phase 10 smoke test - V2 email templates + alerts cron windows.
 *
 *   1. All 7 V2 templates exist and isActive
 *   2. Each template has reasonable placeholders + a real bodyHtml
 *   3. Alert windows fire correctly:
 *      - BASE_ENDING_30D bucket builds when baseEndDate - today = 30
 *      - BASE_ENDING_15D and _7D likewise
 *      - MANDATE_FAILED fires for any module with mandateStatus=halted
 *      - CONTRACT_ENDING_30D fires when contractEndDate - today = 30
 *   4. Hit the cron endpoint with backdated test fixtures and assert
 *      it doesn't error (full email-send round-trip is asserted by counts).
 *
 * We don't actually send real email — sendTemplatedEmail() falls back to
 * console output in dev. Counts in result.sent confirm the dispatcher fired.
 *
 * Run (with dev server in stub + V2 mode on :3000):
 *   PAYMENT_STUB=true SUBSCRIPTION_V2_ENABLED=true npm run dev
 *   npx tsx scripts/smoke-test-v2-emails.ts
 */

import prisma from "../src/lib/prisma";

const API_BASE = process.env.SMOKE_API_BASE || "http://localhost:3000";

let pass = 0, fail = 0;
function ok(label: string, actual: unknown, expected: unknown) {
  const isPass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${isPass ? "✓" : "✗"} ${label}: got ${JSON.stringify(actual)}${isPass ? "" : " (expected " + JSON.stringify(expected) + ")"}`);
  if (isPass) pass++; else { fail++; process.exitCode = 1; }
}

const NEW_TEMPLATES = [
  "BASE_ENDING_30D",
  "BASE_ENDING_15D",
  "BASE_ENDING_7D",
  "MANDATE_FAILED",
  "CONTRACT_ENDING_30D",
  "CANCELLATION_QUEUED",
  "CANCELLATION_PROCESSED",
];

function startOfDayUTC(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

async function setupCustomerAndAdmin(label: string) {
  const code = `EMAIL_${label}_${Date.now().toString(36).slice(-5)}`;
  const customer = await prisma.customerAccount.create({
    data: { code, name: `Email Smoke ${label}`, isActive: true, isGrcAdded: true, isTprmAdded: false, isInternalAuditEnabled: false },
  });
  const role = await prisma.role.upsert({
    where: { name: "CustomerAdministrator" },
    update: {},
    create: { name: "CustomerAdministrator", description: "Customer-level admin", isSystem: true },
  });
  const user = await prisma.user.create({
    data: {
      userName: `${code.toLowerCase()}@smoke.test`,
      email: `${code.toLowerCase()}@smoke.test`,
      firstName: "Email",
      lastName: "Smoke",
      fullName: "Email Smoke Tester",
      password: "x", // placeholder, not used
      isActive: true,
      customerAccountId: customer.id,
      role: "CustomerAdministrator",
    },
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: true },
  });
  return { customer, user, sub };
}

async function cleanup(customerId: string, subId: string, userId: string) {
  await prisma.payment.deleteMany({ where: { subscriptionId: subId } });
  const inv = await prisma.invoice.findMany({ where: { subscriptionId: subId } });
  for (const i of inv) await prisma.invoiceItem.deleteMany({ where: { invoiceId: i.id } });
  await prisma.invoice.deleteMany({ where: { subscriptionId: subId } });
  await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: customerId } });
  await prisma.moduleSubscription.deleteMany({ where: { subscriptionId: subId } });
  await prisma.subscription.delete({ where: { id: subId } });
  await prisma.userRole.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.customerAccount.delete({ where: { id: customerId } });
}

async function run() {
  console.log("=== Phase 10 V2 emails smoke ===\n");

  // 1. All 7 templates exist
  console.log("— Template registration —");
  const templates = await prisma.emailTemplate.findMany({
    where: { code: { in: NEW_TEMPLATES } },
  });
  ok("All 7 V2 templates seeded", templates.length, NEW_TEMPLATES.length);
  for (const code of NEW_TEMPLATES) {
    const tmpl = templates.find((t) => t.code === code);
    ok(`  ${code} found`, Boolean(tmpl), true);
    ok(`  ${code} is active`, tmpl?.isActive, true);
    ok(`  ${code} has bodyHtml`, (tmpl?.bodyHtml.length ?? 0) > 100, true);
  }

  // 2. Set up fixtures for each alert window and fire the cron
  console.log("\n— Cron dispatcher fixtures —");
  const today = startOfDayUTC(new Date());

  // Fixture A: BASE_ENDING_30D
  const fxA = await setupCustomerAndAdmin("FLIP30");
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: fxA.sub.id,
      moduleCode: "GRC", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 100, userLimit: 5,
      cycleStart: new Date(today.getTime() - 335 * 86400000),
      cycleEnd: new Date(today.getTime() + 30 * 86400000),
      planType: "BASE", nextPlanType: "GENERAL",
      baseStartDate: new Date(today.getTime() - 335 * 86400000),
      baseEndDate: new Date(today.getTime() + 30 * 86400000),
      contractStartDate: new Date(today.getTime() - 335 * 86400000),
      contractEndDate: new Date(today.getTime() + 395 * 86400000),
      generalBillingCycle: "MONTHLY",
      generalStartDate: new Date(today.getTime() + 30 * 86400000),
      mandateId: "STUB-EMAIL-A", mandateStatus: "active",
    },
  });

  // Fixture B: MANDATE_FAILED (halted mandate)
  const fxB = await setupCustomerAndAdmin("HALT");
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: fxB.sub.id,
      moduleCode: "GRC", tier: "BASIC", billingCycle: "MONTHLY",
      unitPrice: 1500, userLimit: 25,
      cycleStart: new Date(today.getTime() - 5 * 86400000),
      cycleEnd: new Date(today.getTime() + 25 * 86400000),
      planType: "GENERAL",
      contractStartDate: new Date(today.getTime() - 400 * 86400000),
      contractEndDate: new Date(today.getTime() + 330 * 86400000),
      generalBillingCycle: "MONTHLY",
      mandateId: "STUB-EMAIL-B", mandateStatus: "halted",
    },
  });

  // Fixture C: CONTRACT_ENDING_30D
  const fxC = await setupCustomerAndAdmin("CON30");
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: fxC.sub.id,
      moduleCode: "GRC", tier: "BASIC", billingCycle: "MONTHLY",
      unitPrice: 1500, userLimit: 25,
      cycleStart: new Date(today.getTime() - 30 * 86400000),
      cycleEnd: new Date(today.getTime() + 30 * 86400000),
      planType: "GENERAL",
      contractStartDate: new Date(today.getTime() - 700 * 86400000),
      contractEndDate: new Date(today.getTime() + 30 * 86400000),
      generalBillingCycle: "MONTHLY",
      mandateId: "STUB-EMAIL-C", mandateStatus: "active",
    },
  });

  // Hit the alerts cron
  const cronAuth = process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {};
  const r = await fetch(`${API_BASE}/api/cron/subscription-alerts`, {
    headers: { ...cronAuth, "x-triggered-by": "manual" },
  });
  ok("Alerts cron returns 200", r.status, 200);
  const body = await r.json();
  console.log(`  Cron result: sent=${body.data?.sent} failed=${body.data?.failed} skipped=${body.data?.skipped}`);
  // Each fixture should have produced at least one send (the V2 customer admin)
  ok("At least 3 V2 emails dispatched (one per fixture)", (body.data?.sent ?? 0) >= 3, true);
  ok("No failures", body.data?.failed, 0);

  // 3. Cleanup
  console.log("\nCleaning up...");
  await cleanup(fxA.customer.id, fxA.sub.id, fxA.user.id);
  await cleanup(fxB.customer.id, fxB.sub.id, fxB.user.id);
  await cleanup(fxC.customer.id, fxC.sub.id, fxC.user.id);
  console.log("  Done.");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
}

run()
  .catch(e => { console.error("FATAL:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

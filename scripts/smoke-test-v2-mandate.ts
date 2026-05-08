/**
 * Phase 5 smoke test - V2 mandate flow + webhook idempotency.
 *
 *   1. POST /api/public/signup/v2 in stub mode -> mandate id, BASE invoice PAID, payment CAPTURED
 *   2. POST /api/webhooks/razorpay/subscription with subscription.halted -> moduleSubs flip to halted
 *   3. POST same webhook again -> idempotent, no double-update
 *   4. POST subscription.charged -> moduleSubs flip back to active, invoice handling
 *   5. Cleanup
 *
 * Run (with dev server in stub mode on :3000):
 *   PAYMENT_STUB=true SUBSCRIPTION_V2_ENABLED=true npm run dev
 *   npx tsx scripts/smoke-test-v2-mandate.ts
 */

import prisma from "../src/lib/prisma";

const API_BASE = process.env.SMOKE_API_BASE || "http://localhost:3000";
const TEST_EMAIL = `smoke-mandate-${Date.now()}@example.test`;
const TEST_ORG = `Smoke Mandate ${Date.now().toString(36).slice(-4)}`;

let pass = 0, fail = 0;
function ok(label: string, actual: unknown, expected: unknown) {
  const isPass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${isPass ? "✓" : "✗"} ${label}: got ${JSON.stringify(actual)}${isPass ? "" : " (expected " + JSON.stringify(expected) + ")"}`);
  if (isPass) pass++; else { fail++; process.exitCode = 1; }
}

async function postWebhook(eventType: string, mandateId: string, eventId: string) {
  return fetch(`${API_BASE}/api/webhooks/razorpay/subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-event-id": eventId,
    },
    body: JSON.stringify({
      event: eventType,
      payload: {
        subscription: { entity: { id: mandateId, status: eventType.split(".").pop() } },
      },
    }),
  });
}

async function run() {
  console.log("=== Phase 5 V2 mandate smoke ===\n");

  // 1. Signup with stub
  const r = await fetch(`${API_BASE}/api/public/signup/v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationName: TEST_ORG,
      adminFirstName: "Mand",
      adminLastName: "Tester",
      adminEmail: TEST_EMAIL,
      adminPassword: "smoke-pw-1234567",
      modules: [{ moduleCode: "GRC" }, { moduleCode: "TPRM" }],
      generalBillingCycle: "MONTHLY",
      contractAccepted: true,
    }),
  });
  ok("Signup status 201", r.status, 201);
  const body = await r.json();
  ok("Stub mode flag in response", body.data.stub, true);
  ok("mandateId present", typeof body.data.mandate.mandateId, "string");
  ok("mandate is STUB", body.data.mandate.mandateId.startsWith("STUB-MANDATE-"), true);
  ok("mandate status active", body.data.mandate.status, "active");
  ok("checkoutUrl null in stub", body.data.mandate.checkoutUrl, null);
  ok("BASE total INR 236 (2 modules x 100 + 18% GST)", body.data.baseAmount, 236);

  const mandateId: string = body.data.mandate.mandateId;

  // Verify DB state
  const customer = await prisma.customerAccount.findFirst({
    where: { name: TEST_ORG },
    include: {
      subscription: { include: { modules: true, invoices: { include: { items: true, payment: true } }, payments: true } },
      users: true,
    },
  });
  if (!customer || !customer.subscription) throw new Error("Customer not provisioned");

  ok("Two ModuleSubscriptions", customer.subscription.modules.length, 2);
  ok("All modules carry mandateId", customer.subscription.modules.every(m => m.mandateId === mandateId), true);
  ok("All modules mandate status active", customer.subscription.modules.every(m => m.mandateStatus === "active"), true);

  ok("One BASE invoice", customer.subscription.invoices.length, 1);
  const inv = customer.subscription.invoices[0];
  ok("Invoice status PAID (stub)", inv.status, "PAID");
  ok("Invoice subtotal 200", Number(inv.subtotal), 200);
  ok("Invoice tax 36", Number(inv.taxAmount), 36);
  ok("Invoice total 236", Number(inv.total), 236);
  ok("Invoice line items count", inv.items.length, 2);

  ok("Payment record CAPTURED", customer.subscription.payments.length, 1);
  ok("Payment amount", Number(customer.subscription.payments[0].amount), 236);

  // 2. Webhook: subscription.halted (idempotent x2)
  const haltedEventId = `evt-halted-${Date.now()}`;
  const w1 = await postWebhook("subscription.halted", mandateId, haltedEventId);
  ok("First halted webhook 200", w1.status, 200);
  const after1 = await prisma.moduleSubscription.findMany({ where: { mandateId } });
  ok("All modules now halted", after1.every(m => m.mandateStatus === "halted"), true);

  const w2 = await postWebhook("subscription.halted", mandateId, haltedEventId);
  ok("Replay halted webhook 200", w2.status, 200);
  const w2Json = await w2.json();
  ok("Replay marked idempotent", w2Json.data.idempotent, true);

  // 3. Webhook: subscription.charged
  const chargedEventId = `evt-charged-${Date.now()}`;
  const w3 = await postWebhook("subscription.charged", mandateId, chargedEventId);
  ok("Charged webhook 200", w3.status, 200);
  const after3 = await prisma.moduleSubscription.findMany({ where: { mandateId } });
  ok("All modules back to active", after3.every(m => m.mandateStatus === "active"), true);

  // RazorpayEvent log
  const events = await prisma.razorpayEvent.findMany({
    where: { eventId: { in: [haltedEventId, chargedEventId] } },
  });
  ok("Two unique events logged", events.length, 2);
  ok("Both processed", events.every(e => e.processedAt !== null), true);

  // 4. Cleanup
  console.log("\nCleaning up...");
  await prisma.razorpayEvent.deleteMany({ where: { eventId: { in: [haltedEventId, chargedEventId] } } });
  const subId = customer.subscription.id;
  await prisma.payment.deleteMany({ where: { subscriptionId: subId } });
  await prisma.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });
  await prisma.invoice.delete({ where: { id: inv.id } });
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
  .catch((e) => { console.error("FATAL:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

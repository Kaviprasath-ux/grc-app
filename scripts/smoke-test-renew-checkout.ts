/**
 * End-to-end test of the renewal checkout flow:
 *   1. Create test customer with GRC active, cycleEnd 6 months out
 *   2. Simulate POST /api/settings/subscription/renew/checkout (in-process)
 *   3. Verify ModuleSubscription extended, Invoice PAID, Payment CAPTURED, PDF on disk
 *   4. Replay → idempotent
 *
 * Run: npx tsx scripts/smoke-test-renew-checkout.ts
 */

import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { computeQuote } from "@/lib/pricing";
import { processPayment } from "@/lib/payment-provider";
import { finalizeInvoice } from "@/lib/payment-finalize";
import { nextInvoiceNumber } from "@/lib/invoice-number";

const prisma = new PrismaClient();
const CODE = "_RENEW_CHECKOUT_TEST";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  const c = await prisma.customerAccount.findUnique({ where: { code: CODE } });
  if (c) {
    await prisma.invoiceItem.deleteMany({ where: { invoice: { customerAccountId: c.id } } });
    await prisma.invoice.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.payment.deleteMany({ where: { subscription: { customerAccountId: c.id } } });
    await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.moduleSubscription.deleteMany({ where: { subscription: { customerAccountId: c.id } } });
    await prisma.subscription.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.customerAccount.delete({ where: { id: c.id } });
  }
}

async function performCheckout(customerAccountId: string, lines: { moduleCode: "GRC" | "TPRM" | "INTERNAL_AUDIT"; tier: "BASIC" | "MEDIUM" | "PRO" }[], cycle: "MONTHLY" | "YEARLY") {
  const subscription = await prisma.subscription.findUnique({
    where: { customerAccountId }, include: { modules: true },
  });
  if (!subscription) throw new Error("no sub");
  const quote = await computeQuote({ customerAccountId, lines, cycle });
  const now = new Date();
  const newCycleEnd = new Date(now);
  if (cycle === "MONTHLY") newCycleEnd.setUTCMonth(newCycleEnd.getUTCMonth() + 1);
  else newCycleEnd.setUTCFullYear(newCycleEnd.getUTCFullYear() + 1);

  const inv = await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const tierRow = await tx.moduleTierPricing.findUnique({
        where: { moduleCode_tier: { moduleCode: line.moduleCode, tier: line.tier } },
      });
      if (!tierRow) throw new Error("catalog");
      const lineQuote = quote.lineItems.find((li) => li.moduleCode === line.moduleCode && li.tier === line.tier);
      if (!lineQuote) throw new Error("quote miss");
      const existing = subscription.modules.find((m) => m.moduleCode === line.moduleCode);
      const data = {
        tier: line.tier, billingCycle: cycle,
        unitPrice: lineQuote.fullCyclePrice,
        userLimit: tierRow.userLimit, vendorLimit: tierRow.vendorLimit,
        assessmentLimit: tierRow.assessmentLimit, frameworkLimit: tierRow.frameworkLimit,
        auditLimit: tierRow.auditLimit, cycleStart: now, cycleEnd: newCycleEnd,
        cancelledAt: null,
      };
      if (existing) await tx.moduleSubscription.update({ where: { id: existing.id }, data });
      else await tx.moduleSubscription.create({ data: { subscriptionId: subscription.id, moduleCode: line.moduleCode, ...data } });
    }
    const invoiceNumber = await nextInvoiceNumber(now);
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber, subscriptionId: subscription.id, customerAccountId,
        issueDate: now, periodStart: now, periodEnd: newCycleEnd,
        subtotal: quote.subtotal, discountAmount: quote.bundleDiscount?.amount ?? 0,
        taxRate: quote.taxRate, taxAmount: quote.taxAmount, total: quote.total,
        currency: quote.currency, status: "DRAFT",
        items: {
          create: quote.lineItems.map((li) => ({
            description: li.description, moduleCode: li.moduleCode, tier: li.tier,
            quantity: 1, unitPrice: li.unitPrice, amount: li.unitPrice,
          })),
        },
      },
    });
    const payment = await tx.payment.create({
      data: { subscriptionId: subscription.id, amount: quote.total, currency: quote.currency, status: "CREATED" },
    });
    await tx.invoice.update({ where: { id: invoice.id }, data: { paymentId: payment.id } });
    return { invoiceId: invoice.id, invoiceNumber, paymentId: payment.id };
  });

  const result = await processPayment({
    subscriptionId: subscription.id, amount: quote.total, currency: quote.currency,
    customerAccountId, idempotencyKey: inv.invoiceId, description: "Test renewal",
  });
  if (result.status !== "CAPTURED") throw new Error("payment not captured");
  await prisma.payment.update({ where: { id: inv.paymentId }, data: { providerPaymentId: result.providerPaymentId } });
  return await finalizeInvoice(inv.invoiceId, { providerPaymentId: result.providerPaymentId });
}

async function main() {
  await cleanup();

  // ── Setup ──
  console.log("Setup");
  process.env.PAYMENT_STUB = "true"; // ensure stub mode
  const customer = await prisma.customerAccount.create({
    data: { code: CODE, name: "Renew Test", isGrcAdded: true },
  });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: true },
  });
  const today = new Date();
  const sixMonthsOut = new Date(today);
  sixMonthsOut.setUTCMonth(sixMonthsOut.getUTCMonth() + 6);
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "GRC", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, frameworkLimit: 3,
      cycleStart: today, cycleEnd: sixMonthsOut,
    },
  });

  // ── First checkout: renew GRC at MEDIUM yearly ──
  console.log("\nFirst checkout — renew GRC at MEDIUM yearly");
  const fin1 = await performCheckout(customer.id, [{ moduleCode: "GRC", tier: "MEDIUM" }], "YEARLY");
  assert(fin1.status === "PAID", `invoice 1 status PAID (got ${fin1.status})`);
  assert(/^INV-\d{4}-\d{4}$/.test(fin1.invoiceNumber), "invoice number format");
  assert(fin1.pdfPath !== null, "PDF generated");

  // Verify Module extended + tier upgraded
  const grcAfter = await prisma.moduleSubscription.findFirst({
    where: { subscriptionId: sub.id, moduleCode: "GRC" },
  });
  assert(grcAfter !== null, "GRC module still present");
  assert(grcAfter!.tier === "MEDIUM", `tier upgraded to MEDIUM (got ${grcAfter!.tier})`);
  // cycleEnd should be ~1 year out from now (well past the original 6-month)
  const newEnd = grcAfter!.cycleEnd.getTime();
  const oneYearFromNow = today.getTime() + 365 * 86400000;
  assert(Math.abs(newEnd - oneYearFromNow) < 86400000 * 5, "cycleEnd extended to ~1 year out");

  // Verify Invoice PAID + Payment CAPTURED
  const invoice = await prisma.invoice.findUnique({
    where: { id: fin1.invoiceId }, include: { payment: true, items: true },
  });
  assert(invoice!.status === "PAID", "Invoice status PAID");
  assert(invoice!.payment!.status === "CAPTURED", "Payment status CAPTURED");
  assert(invoice!.payment!.providerPaymentId?.startsWith("stub_pay_") === true, "providerPaymentId stamped (stub)");
  assert(invoice!.items.length === 1, "1 line item");
  assert(invoice!.items[0].tier === "MEDIUM", "line item tier MEDIUM");
  assert(Number(invoice!.items[0].amount) === 100000, `line item amount 100000 (yearly Medium)`);
  assert(Number(invoice!.total) === 118000, `total 100k + 18% GST = 118000`);

  // PDF on disk
  const absPdf = path.join(process.cwd(), invoice!.pdfPath!);
  const stats = await fs.stat(absPdf);
  assert(stats.size > 1000, `PDF file > 1KB on disk (got ${stats.size})`);

  // Legacy SubscriptionPlan synced
  const legacy = await prisma.subscriptionPlan.findFirst({
    where: { customerAccountId: customer.id, moduleCode: "GRC" },
  });
  assert(legacy?.tier === "MEDIUM", "legacy SubscriptionPlan tier=MEDIUM");
  assert(legacy?.maxAccountsAllowed === 15, "legacy maxAccountsAllowed=15 (Medium)");

  // ── Idempotency: replay finalize on PAID invoice ──
  console.log("\nIdempotency replay");
  const fin2 = await finalizeInvoice(fin1.invoiceId);
  assert(fin2.status === "ALREADY_PAID", `replay returns ALREADY_PAID (got ${fin2.status})`);

  // ── Cleanup PDF + DB ──
  try { await fs.unlink(absPdf); } catch {}
  await cleanup();

  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());

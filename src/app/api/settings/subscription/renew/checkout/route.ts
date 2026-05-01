/**
 * POST /api/settings/subscription/renew/checkout
 *
 * Customer-initiated renewal checkout. Steps:
 *   1. Validate body (cycle + lines)
 *   2. Compute live quote (via central computeQuote)
 *   3. Apply ModuleSubscription updates (extend cycleEnd, swap cycle, replace tiers)
 *   4. Create Invoice (DRAFT) + InvoiceItems + Payment (CREATED)
 *   5. Call processPayment() — dev stub auto-CAPTURED, real Razorpay deferred
 *   6. On CAPTURED → finalizeInvoice() (mark PAID, generate PDF, sync legacy plan)
 *      On FAILED  → markInvoiceFailed()
 *   7. Return { invoiceNumber, paid, redirectUrl }
 *
 * COMPLIMENTARY subscriptions are rejected (no payment needed; admin-only changes).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { computeQuote } from "@/lib/pricing";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { processPayment } from "@/lib/payment-provider";
import { finalizeInvoice, markInvoiceFailed } from "@/lib/payment-finalize";
import { z } from "zod";

const Schema = z.object({
  cycle: z.enum(["MONTHLY", "YEARLY"]),
  lines: z
    .array(z.object({
      moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]),
      tier: z.enum(["BASIC", "MEDIUM", "PRO"]),
    }))
    .min(1),
});

export const POST = withAuth(
  async (req: NextRequest, _ctx, session) => {
    if (!session.customerAccountId) {
      return NextResponse.json({ error: "No customer account on session" }, { status: 400 });
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    let subscription = await prisma.subscription.findUnique({
      where: { customerAccountId: session.customerAccountId },
      include: { modules: true },
    });

    // First-time subscriber: no Subscription row yet. Create one.
    const isFirstSubscribe = !subscription;
    if (!subscription) {
      const created = await prisma.subscription.create({
        data: {
          customerAccountId: session.customerAccountId,
          status: "ACTIVE",
          subscriptionType: "PAID",
          autoRenew: true,
          notes: `Self-subscribed via /settings/subscription/renew on ${new Date().toISOString()}`,
        },
      });
      subscription = { ...created, modules: [] };
    }

    if (subscription.subscriptionType === "COMPLIMENTARY") {
      return NextResponse.json(
        { error: "Complimentary subscriptions don't require renewal." },
        { status: 400 }
      );
    }

    // 1. Compute quote (uses overrides, bundle discounts, GST)
    const quote = await computeQuote({
      customerAccountId: session.customerAccountId,
      lines: parsed.data.lines,
      cycle: parsed.data.cycle,
    });

    const now = new Date();
    const cycle = parsed.data.cycle;
    // For renewal, cycleEnd is now + 1 month or 1 year (cycle resets at renewal)
    const newCycleEnd = (() => {
      const d = new Date(now);
      if (cycle === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1);
      else d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d;
    })();

    const requestedCodes = new Set<string>(parsed.data.lines.map((l) => l.moduleCode));

    // 2. Apply subscription changes + create Invoice/Payment in a single txn
    const inv = await prisma.$transaction(async (tx) => {
      // 2a. For each requested line, upsert the ModuleSubscription
      for (const line of parsed.data.lines) {
        const existing = subscription.modules.find((m) => m.moduleCode === line.moduleCode);
        const lineQuote = quote.lineItems.find(
          (li) => li.moduleCode === line.moduleCode && li.tier === line.tier
        );
        if (!lineQuote) throw new Error(`Quote missing for ${line.moduleCode} ${line.tier}`);

        // We need the snapshotted limits — pull from catalog (or override) via tier pricing
        const tierRow = await tx.moduleTierPricing.findUnique({
          where: { moduleCode_tier: { moduleCode: line.moduleCode, tier: line.tier } },
        });
        if (!tierRow) throw new Error(`Catalog missing for ${line.moduleCode} ${line.tier}`);

        const baseData = {
          tier: line.tier,
          billingCycle: cycle,
          unitPrice: lineQuote.fullCyclePrice,
          userLimit: tierRow.userLimit,
          vendorLimit: tierRow.vendorLimit,
          assessmentLimit: tierRow.assessmentLimit,
          frameworkLimit: tierRow.frameworkLimit,
          auditLimit: tierRow.auditLimit,
          cycleStart: now,
          cycleEnd: newCycleEnd,
          cancelledAt: null,
          previousTier: existing && existing.tier !== line.tier ? existing.tier : null,
          tierChangedAt: existing && existing.tier !== line.tier ? now : null,
        };

        if (existing) {
          await tx.moduleSubscription.update({ where: { id: existing.id }, data: baseData });
        } else {
          await tx.moduleSubscription.create({
            data: {
              subscriptionId: subscription.id,
              moduleCode: line.moduleCode,
              ...baseData,
            },
          });
        }
      }

      // 2b. Cancel modules that the customer dropped from this renewal
      for (const m of subscription.modules) {
        if (!requestedCodes.has(m.moduleCode) && !m.cancelledAt) {
          await tx.moduleSubscription.update({
            where: { id: m.id },
            data: { cancelledAt: now },
          });
        }
      }

      // 2c. Re-enable autoRenew on renewal (customer is actively committing)
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { autoRenew: true },
      });

      // 2c.i Flip CustomerAccount legacy flags to match subscribed modules
      // (so existing permissions/nav code can see the new module access immediately)
      await tx.customerAccount.update({
        where: { id: session.customerAccountId! },
        data: {
          isGrcAdded: requestedCodes.has("GRC"),
          isTprmAdded: requestedCodes.has("TPRM"),
          isInternalAuditEnabled: requestedCodes.has("INTERNAL_AUDIT"),
        },
      });

      // 2d. Create Invoice (DRAFT)
      const invoiceNumber = await nextInvoiceNumber(now);
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          subscriptionId: subscription.id,
          customerAccountId: session.customerAccountId!,
          issueDate: now,
          periodStart: now,
          periodEnd: newCycleEnd,
          subtotal: quote.subtotal,
          discountAmount: quote.bundleDiscount?.amount ?? 0,
          taxRate: quote.taxRate,
          taxAmount: quote.taxAmount,
          total: quote.total,
          currency: quote.currency,
          status: "DRAFT",
          items: {
            create: quote.lineItems.map((li) => ({
              description: li.description,
              moduleCode: li.moduleCode,
              tier: li.tier,
              quantity: 1,
              unitPrice: li.unitPrice,
              amount: li.unitPrice,
            })),
          },
        },
      });

      // 2e. Create Payment (CREATED)
      const payment = await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          amount: quote.total,
          currency: quote.currency,
          status: "CREATED",
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { paymentId: payment.id },
      });

      return { invoiceId: invoice.id, invoiceNumber, paymentId: payment.id };
    }, { timeout: 15000 });

    // 3. Process payment (stub auto-CAPTURED in dev)
    let payResult;
    try {
      payResult = await processPayment({
        subscriptionId: subscription.id,
        amount: quote.total,
        currency: quote.currency,
        customerAccountId: session.customerAccountId,
        idempotencyKey: inv.invoiceId,
        description: `Renewal — ${parsed.data.lines.map((l) => `${l.moduleCode} ${l.tier}`).join(", ")} (${cycle})`,
      });
    } catch (e) {
      // Stub disabled and no real provider → mark failed and bail
      await markInvoiceFailed(inv.invoiceId, "PROVIDER_UNAVAILABLE", (e as Error).message);
      return NextResponse.json(
        { error: "Payment provider unavailable. Please try again later.", invoiceNumber: inv.invoiceNumber },
        { status: 503 }
      );
    }

    if (payResult.status === "CAPTURED") {
      // Stamp providerPaymentId on the Payment row, then finalize
      await prisma.payment.update({
        where: { id: inv.paymentId },
        data: {
          providerPaymentId: payResult.providerPaymentId ?? null,
          providerOrderId: payResult.paymentRef,
        },
      });
      const fin = await finalizeInvoice(inv.invoiceId, {
        providerPaymentId: payResult.providerPaymentId,
      });
      return NextResponse.json({
        data: {
          invoiceNumber: fin.invoiceNumber,
          paid: true,
          firstSubscribe: isFirstSubscribe,
          redirectUrl: `/settings/subscription?paid=${encodeURIComponent(fin.invoiceNumber)}`,
        },
      });
    }

    // FAILED path
    await markInvoiceFailed(inv.invoiceId, payResult.errorCode, payResult.errorDescription);
    return NextResponse.json({
      error: payResult.errorDescription || "Payment failed",
      invoiceNumber: inv.invoiceNumber,
    }, { status: 402 });
  },
  { resource: "subscription.customer-portal", action: "edit" }
);

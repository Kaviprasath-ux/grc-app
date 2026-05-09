/**
 * POST /api/settings/subscription/renew/initiate
 *
 * Step 1 of renewal payment flow:
 *   1. Validates body (cycle + lines)
 *   2. Computes quote
 *   3. Creates Razorpay order
 *   4. Creates Invoice (DRAFT) + Payment (CREATED)
 *   5. Returns Razorpay checkout data
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { computeQuote } from "@/lib/pricing";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { processPayment, isStubMode } from "@/lib/payment-provider";
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

    // First-time subscriber: create Subscription row
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

    // Compute quote
    const quote = await computeQuote({
      customerAccountId: session.customerAccountId,
      lines: parsed.data.lines,
      cycle: parsed.data.cycle,
    });

    if (quote.total <= 0) {
      return NextResponse.json({ error: "Invalid total amount" }, { status: 400 });
    }

    const now = new Date();
    const cycle = parsed.data.cycle;
    const newCycleEnd = (() => {
      const d = new Date(now);
      if (cycle === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1);
      else d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d;
    })();

    // Create Invoice and Payment in transaction
    const inv = await prisma.$transaction(async (tx) => {
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

      return {
        invoiceId: invoice.id,
        invoiceNumber,
        paymentId: payment.id,
        subscriptionId: subscription.id,
      };
    }, { timeout: 15000 });

    // Create Razorpay order
    const description = `${isFirstSubscribe ? "Subscribe" : "Renew"} — ${parsed.data.lines.map((l) => `${l.moduleCode} ${l.tier}`).join(", ")} (${cycle})`;

    try {
      const paymentResult = await processPayment({
        subscriptionId: inv.subscriptionId,
        amount: quote.total,
        currency: quote.currency,
        customerAccountId: session.customerAccountId,
        idempotencyKey: inv.invoiceId,
        description,
        customerEmail: session.email || undefined,
        customerName: session.name || undefined,
      });

      if (paymentResult.status === "FAILED") {
        return NextResponse.json({
          error: "Failed to create payment order",
          errorCode: paymentResult.errorCode,
        }, { status: 500 });
      }

      // Store Razorpay order ID on Payment
      await prisma.payment.update({
        where: { id: inv.paymentId },
        data: { providerOrderId: paymentResult.paymentRef },
      });

      console.log(`[RENEW] Initiated payment for ${session.customerAccountId}, order: ${paymentResult.paymentRef}`);

      const amountInPaise = Math.round(quote.total * 100);
      return NextResponse.json({
        data: {
          invoiceId: inv.invoiceId,
          invoiceNumber: inv.invoiceNumber,
          orderId: paymentResult.paymentRef,
          amount: amountInPaise,
          currency: quote.currency,
          keyId: paymentResult.checkoutData?.keyId || process.env.RAZORPAY_KEY_ID,
          prefill: {
            email: session.email,
            name: session.name,
          },
          summary: {
            subtotal: quote.subtotal,
            discountAmount: quote.bundleDiscount?.amount ?? 0,
            taxAmount: quote.taxAmount,
            total: quote.total,
          },
          isFirstSubscribe,
          stubMode: isStubMode(),
          stubPaymentId: isStubMode() ? `stub_pay_${Date.now()}` : undefined,
        },
      });
    } catch (error) {
      console.error("[RENEW] Payment initiation failed:", error);
      return NextResponse.json({
        error: "Failed to initiate payment",
        details: error instanceof Error ? error.message : "Unknown error",
      }, { status: 500 });
    }
  },
  { resource: "subscription.customer-portal", action: "edit" }
);

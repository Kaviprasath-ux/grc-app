/**
 * POST /api/settings/subscription/upgrade/initiate
 *
 * Step 1 of upgrade payment flow:
 *   1. Validates upgrades
 *   2. Computes quote with pro-rated pricing
 *   3. Creates Razorpay order
 *   4. Creates Invoice (DRAFT) + Payment (CREATED)
 *   5. Returns Razorpay checkout data
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { processPayment, isStubMode } from "@/lib/payment-provider";
import { getModulePrice, wholeMonthsBetween, round2, DEFAULT_TAX_RATE, DEFAULT_CURRENCY } from "@/lib/pricing";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { z } from "zod";

const TIER_RANK: Record<string, number> = { BASIC: 0, MEDIUM: 1, PRO: 2 };

const Schema = z.object({
  upgrades: z.array(z.object({
    moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]),
    newTier: z.enum(["BASIC", "MEDIUM", "PRO"]),
  })).min(1),
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

    const subscription = await prisma.subscription.findUnique({
      where: { customerAccountId: session.customerAccountId },
      include: { modules: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: "No subscription configured" }, { status: 404 });
    }
    if (subscription.subscriptionType === "COMPLIMENTARY") {
      return NextResponse.json({ error: "Complimentary subscriptions cannot be upgraded" }, { status: 400 });
    }

    const now = new Date();
    const lineItems: Array<{
      moduleCode: string;
      currentTier: string;
      newTier: string;
      cycle: string;
      currentPrice: number;
      newPrice: number;
      diff: number;
      monthsCharged: number;
      isProRated: boolean;
      unitPrice: number;
      description: string;
      cycleEnd: Date;
    }> = [];

    // Validate and compute quote
    for (const u of parsed.data.upgrades) {
      const ms = subscription.modules.find((m) => m.moduleCode === u.moduleCode && !m.cancelledAt);
      if (!ms) {
        return NextResponse.json({ error: `${u.moduleCode} is not currently active.` }, { status: 400 });
      }
      if (ms.cycleEnd <= now) {
        return NextResponse.json({ error: `${u.moduleCode} has expired — please renew first.` }, { status: 400 });
      }
      const newRank = TIER_RANK[u.newTier];
      const currentRank = TIER_RANK[ms.tier];
      if (newRank <= currentRank) {
        return NextResponse.json({ error: `${u.moduleCode} is already at ${ms.tier}.` }, { status: 400 });
      }

      const cycle = ms.billingCycle as "MONTHLY" | "YEARLY";
      const { price: currentPrice } = await getModulePrice(u.moduleCode, ms.tier, cycle, session.customerAccountId, now);
      const { price: newPrice } = await getModulePrice(u.moduleCode, u.newTier, cycle, session.customerAccountId, now);
      const diff = round2(newPrice - currentPrice);

      let unitPrice: number;
      let monthsCharged: number;
      let isProRated: boolean;

      if (cycle === "YEARLY") {
        monthsCharged = wholeMonthsBetween(now, ms.cycleEnd);
        if (monthsCharged > 0 && monthsCharged < 12) {
          unitPrice = round2(diff * (monthsCharged / 12));
          isProRated = true;
        } else {
          unitPrice = diff;
          isProRated = false;
        }
      } else {
        unitPrice = diff;
        monthsCharged = 1;
        isProRated = false;
      }

      const cycleLabel = cycle === "MONTHLY" ? "monthly" : "yearly";
      const proLabel = isProRated ? `, ${monthsCharged}-month pro-rata` : "";
      lineItems.push({
        moduleCode: u.moduleCode,
        currentTier: ms.tier,
        newTier: u.newTier,
        cycle,
        currentPrice,
        newPrice,
        diff,
        monthsCharged,
        isProRated,
        unitPrice,
        description: `${u.moduleCode} — upgrade ${ms.tier} → ${u.newTier} (${cycleLabel}${proLabel})`,
        cycleEnd: ms.cycleEnd,
      });
    }

    const subtotal = round2(lineItems.reduce((s, li) => s + li.unitPrice, 0));
    const taxAmount = round2(subtotal * (DEFAULT_TAX_RATE / 100));
    const total = round2(subtotal + taxAmount);

    if (total <= 0) {
      return NextResponse.json({ error: "Invalid total amount" }, { status: 400 });
    }

    // Create Invoice and Payment in transaction
    const inv = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextInvoiceNumber(now);

      // Use cycleEnd from the first upgrade (they should all be similar)
      const periodEnd = lineItems[0].cycleEnd;

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          subscriptionId: subscription.id,
          customerAccountId: session.customerAccountId!,
          issueDate: now,
          periodStart: now,
          periodEnd,
          subtotal,
          discountAmount: 0,
          taxRate: DEFAULT_TAX_RATE,
          taxAmount,
          total,
          currency: DEFAULT_CURRENCY,
          status: "DRAFT",
          items: {
            create: lineItems.map((li) => ({
              description: li.description,
              moduleCode: li.moduleCode as "GRC" | "TPRM" | "INTERNAL_AUDIT",
              tier: li.newTier as "BASIC" | "MEDIUM" | "PRO",
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
          amount: total,
          currency: DEFAULT_CURRENCY,
          status: "CREATED",
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { paymentId: payment.id },
      });

      return { invoiceId: invoice.id, invoiceNumber, paymentId: payment.id };
    }, { timeout: 15000 });

    // Create Razorpay order
    const description = `Upgrade — ${lineItems.map((l) => `${l.moduleCode} ${l.currentTier}→${l.newTier}`).join(", ")}`;

    try {
      const paymentResult = await processPayment({
        subscriptionId: subscription.id,
        amount: total,
        currency: DEFAULT_CURRENCY,
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

      console.log(`[UPGRADE] Initiated payment for ${session.customerAccountId}, order: ${paymentResult.paymentRef}`);

      const amountInPaise = Math.round(total * 100);
      return NextResponse.json({
        data: {
          invoiceId: inv.invoiceId,
          invoiceNumber: inv.invoiceNumber,
          orderId: paymentResult.paymentRef,
          amount: amountInPaise,
          currency: DEFAULT_CURRENCY,
          keyId: paymentResult.checkoutData?.keyId || process.env.RAZORPAY_KEY_ID,
          prefill: {
            email: session.email,
            name: session.name,
          },
          summary: {
            subtotal,
            taxAmount,
            total,
            lineItems,
          },
          stubMode: isStubMode(),
          stubPaymentId: isStubMode() ? `stub_pay_${Date.now()}` : undefined,
        },
      });
    } catch (error) {
      console.error("[UPGRADE] Payment initiation failed:", error);
      return NextResponse.json({
        error: "Failed to initiate payment",
        details: error instanceof Error ? error.message : "Unknown error",
      }, { status: 500 });
    }
  },
  { resource: "subscription.customer-portal", action: "edit" }
);

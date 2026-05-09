/**
 * POST /api/settings/subscription/upgrade/complete
 *
 * Step 2 of upgrade payment flow:
 *   1. Verifies Razorpay payment signature
 *   2. Applies tier upgrades to ModuleSubscription
 *   3. Finalizes Invoice and Payment
 *   4. Returns success with redirect URL
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { verifyPaymentSignature, isStubMode } from "@/lib/payment-provider";
import { finalizeInvoice } from "@/lib/payment-finalize";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { z } from "zod";

const Schema = z.object({
  invoiceId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
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

    const { invoiceId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

    // Verify payment signature (skip in stub mode)
    if (!isStubMode()) {
      const isValid = verifyPaymentSignature({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });
      if (!isValid) {
        console.error("[UPGRADE] Invalid payment signature");
        return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
      }
    }

    // Find and validate invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        payment: true,
        items: true,
        subscription: { include: { modules: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.customerAccountId !== session.customerAccountId) {
      return NextResponse.json({ error: "Invoice does not belong to your account" }, { status: 403 });
    }

    if (invoice.status === "PAID") {
      return NextResponse.json({
        data: {
          invoiceNumber: invoice.invoiceNumber,
          status: "ALREADY_PAID",
          redirectUrl: `/settings/subscription?upgraded=1`,
        },
      });
    }

    // Verify order ID matches
    if (invoice.payment?.providerOrderId !== razorpay_order_id) {
      return NextResponse.json({ error: "Order ID mismatch" }, { status: 400 });
    }

    const now = new Date();

    // Apply tier upgrades in transaction
    const updatedModuleIds: string[] = [];

    try {
      await prisma.$transaction(async (tx) => {
        // Get catalog for limits
        const catalog = await tx.moduleTierPricing.findMany({ where: { isActive: true } });

        for (const item of invoice.items) {
          if (!item.moduleCode || !item.tier) continue;

          // Find the current module subscription
          const ms = invoice.subscription?.modules.find(
            (m) => m.moduleCode === item.moduleCode && !m.cancelledAt
          );

          if (!ms) continue;

          // Get new tier limits from catalog
          const tierRow = catalog.find(
            (c) => c.moduleCode === item.moduleCode && c.tier === item.tier
          );

          if (!tierRow) continue;

          // Update module subscription with new tier
          await tx.moduleSubscription.update({
            where: { id: ms.id },
            data: {
              previousTier: ms.tier,
              tier: item.tier,
              tierChangedAt: now,
              userLimit: tierRow.userLimit,
              vendorLimit: tierRow.vendorLimit,
              assessmentLimit: tierRow.assessmentLimit,
              frameworkLimit: tierRow.frameworkLimit,
              auditLimit: tierRow.auditLimit,
            },
          });

          updatedModuleIds.push(ms.id);
        }

        // Update Payment with provider details
        if (invoice.payment) {
          await tx.payment.update({
            where: { id: invoice.payment.id },
            data: {
              providerPaymentId: razorpay_payment_id,
              providerSignature: razorpay_signature,
              status: "CAPTURED",
              paidAt: now,
            },
          });
        }
      }, { timeout: 15000 });

      // Finalize invoice
      const fin = await finalizeInvoice(invoiceId, {
        providerPaymentId: razorpay_payment_id,
      });

      // Sync legacy SubscriptionPlan rows (best-effort)
      for (const id of updatedModuleIds) {
        try { await syncSubscriptionPlan(id); } catch { /* non-fatal */ }
      }

      console.log(`[UPGRADE] Completed upgrade for ${session.customerAccountId}, invoice: ${fin.invoiceNumber}`);

      return NextResponse.json({
        data: {
          invoiceNumber: fin.invoiceNumber,
          paid: true,
          redirectUrl: `/settings/subscription?upgraded=${encodeURIComponent(fin.invoiceNumber)}`,
        },
      });
    } catch (e) {
      console.error("[UPGRADE] Complete failed:", e);
      return NextResponse.json({ error: (e as Error).message || "Upgrade failed" }, { status: 500 });
    }
  },
  { resource: "subscription.customer-portal", action: "edit" }
);

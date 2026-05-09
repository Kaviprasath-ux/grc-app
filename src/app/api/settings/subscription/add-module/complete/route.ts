/**
 * POST /api/settings/subscription/add-module/complete
 *
 * Step 2 of add-module payment flow:
 *   1. Verifies Razorpay payment signature
 *   2. Creates ModuleSubscription records for new modules
 *   3. Updates CustomerAccount module flags
 *   4. Finalizes Invoice and Payment
 *   5. Returns success with redirect URL
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
        console.error("[ADD-MODULE] Invalid payment signature");
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
          redirectUrl: `/settings/subscription?added=1`,
        },
      });
    }

    // Verify order ID matches
    if (invoice.payment?.providerOrderId !== razorpay_order_id) {
      return NextResponse.json({ error: "Order ID mismatch" }, { status: 400 });
    }

    const now = new Date();
    const newModuleIds: string[] = [];

    try {
      await prisma.$transaction(async (tx) => {
        const subscription = invoice.subscription!;

        // Get catalog for limits
        const catalog = await tx.moduleTierPricing.findMany({ where: { isActive: true } });

        // Determine cycle from existing modules
        const yearlyCount = subscription.modules.filter((m) => !m.cancelledAt && m.billingCycle === "YEARLY").length;
        const monthlyCount = subscription.modules.filter((m) => !m.cancelledAt && m.billingCycle === "MONTHLY").length;
        const cycle = monthlyCount > yearlyCount ? "MONTHLY" : "YEARLY";

        // Use invoice periodEnd as the cycleEnd for new modules
        const cycleEnd = invoice.periodEnd;

        // Track which modules we're adding for CustomerAccount flags
        const addedCodes = new Set<string>();

        // Create ModuleSubscription for each invoice item
        for (const item of invoice.items) {
          if (!item.moduleCode || !item.tier) continue;

          // Check if module already exists (shouldn't happen but safety check)
          const existing = subscription.modules.find(
            (m) => m.moduleCode === item.moduleCode && !m.cancelledAt
          );
          if (existing) continue;

          const tierRow = catalog.find(
            (c) => c.moduleCode === item.moduleCode && c.tier === item.tier
          );

          if (!tierRow) {
            throw new Error(`Catalog missing for ${item.moduleCode} ${item.tier}`);
          }

          const created = await tx.moduleSubscription.create({
            data: {
              subscriptionId: subscription.id,
              moduleCode: item.moduleCode,
              tier: item.tier,
              billingCycle: cycle,
              unitPrice: Number(item.unitPrice),
              userLimit: tierRow.userLimit,
              vendorLimit: tierRow.vendorLimit,
              assessmentLimit: tierRow.assessmentLimit,
              frameworkLimit: tierRow.frameworkLimit,
              auditLimit: tierRow.auditLimit,
              cycleStart: now,
              cycleEnd,
            },
          });

          newModuleIds.push(created.id);
          addedCodes.add(item.moduleCode);
        }

        // Update CustomerAccount module flags
        const updateData: Record<string, boolean> = {};
        if (addedCodes.has("GRC")) updateData.isGrcAdded = true;
        if (addedCodes.has("TPRM")) updateData.isTprmAdded = true;
        if (addedCodes.has("INTERNAL_AUDIT")) updateData.isInternalAuditEnabled = true;

        if (Object.keys(updateData).length > 0) {
          await tx.customerAccount.update({
            where: { id: session.customerAccountId! },
            data: updateData,
          });
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
      for (const id of newModuleIds) {
        try { await syncSubscriptionPlan(id); } catch { /* non-fatal */ }
      }

      console.log(`[ADD-MODULE] Completed for ${session.customerAccountId}, invoice: ${fin.invoiceNumber}`);

      return NextResponse.json({
        data: {
          invoiceNumber: fin.invoiceNumber,
          paid: true,
          redirectUrl: `/settings/subscription?added=${encodeURIComponent(fin.invoiceNumber)}`,
        },
      });
    } catch (e) {
      console.error("[ADD-MODULE] Complete failed:", e);
      return NextResponse.json({ error: (e as Error).message || "Add module failed" }, { status: 500 });
    }
  },
  { resource: "subscription.customer-portal", action: "edit" }
);

/**
 * POST /api/settings/subscription/renew/complete
 *
 * Step 2 of renewal payment flow:
 *   1. Verifies Razorpay payment signature
 *   2. Applies ModuleSubscription updates
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
  // Original request data needed to apply subscription changes
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

    const { invoiceId, razorpay_order_id, razorpay_payment_id, razorpay_signature, cycle, lines } = parsed.data;

    // Verify payment signature (skip in stub mode)
    if (!isStubMode()) {
      const isValid = verifyPaymentSignature({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });
      if (!isValid) {
        console.error("[RENEW] Invalid payment signature");
        return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
      }
    }

    // Find and validate invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        payment: true,
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
          redirectUrl: `/settings/subscription?paid=${encodeURIComponent(invoice.invoiceNumber)}`,
        },
      });
    }

    // Verify order ID matches
    if (invoice.payment?.providerOrderId !== razorpay_order_id) {
      return NextResponse.json({ error: "Order ID mismatch" }, { status: 400 });
    }

    const now = new Date();
    const newCycleEnd = (() => {
      const d = new Date(now);
      if (cycle === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1);
      else d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d;
    })();

    const requestedCodes = new Set<string>(lines.map((l) => l.moduleCode));
    const moduleSubIds: string[] = [];

    try {
      await prisma.$transaction(async (tx) => {
        const subscription = invoice.subscription!;

        // Get catalog for limits
        const catalog = await tx.moduleTierPricing.findMany({ where: { isActive: true } });

        // Upsert ModuleSubscription for each requested line
        for (const line of lines) {
          const existing = subscription.modules.find((m) => m.moduleCode === line.moduleCode);
          const tierRow = catalog.find(
            (c) => c.moduleCode === line.moduleCode && c.tier === line.tier
          );

          if (!tierRow) {
            throw new Error(`Catalog missing for ${line.moduleCode} ${line.tier}`);
          }

          // Use unitPrice from invoice items
          const invoiceItem = await tx.invoiceItem.findFirst({
            where: { invoiceId, moduleCode: line.moduleCode },
          });
          const unitPrice = invoiceItem?.unitPrice ?? Number(
            cycle === "MONTHLY" ? tierRow.monthlyPrice : tierRow.yearlyPrice
          );

          const baseData = {
            tier: line.tier,
            billingCycle: cycle,
            unitPrice,
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
            moduleSubIds.push(existing.id);
          } else {
            const created = await tx.moduleSubscription.create({
              data: {
                subscriptionId: subscription.id,
                moduleCode: line.moduleCode,
                ...baseData,
              },
            });
            moduleSubIds.push(created.id);
          }
        }

        // Cancel modules that the customer dropped
        for (const m of subscription.modules) {
          if (!requestedCodes.has(m.moduleCode) && !m.cancelledAt) {
            await tx.moduleSubscription.update({
              where: { id: m.id },
              data: { cancelledAt: now },
            });
          }
        }

        // Re-enable autoRenew
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { autoRenew: true },
        });

        // Update CustomerAccount module flags
        await tx.customerAccount.update({
          where: { id: session.customerAccountId! },
          data: {
            isGrcAdded: requestedCodes.has("GRC"),
            isTprmAdded: requestedCodes.has("TPRM"),
            isInternalAuditEnabled: requestedCodes.has("INTERNAL_AUDIT"),
          },
        });

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
      for (const id of moduleSubIds) {
        try { await syncSubscriptionPlan(id); } catch { /* non-fatal */ }
      }

      console.log(`[RENEW] Completed renewal for ${session.customerAccountId}, invoice: ${fin.invoiceNumber}`);

      return NextResponse.json({
        data: {
          invoiceNumber: fin.invoiceNumber,
          paid: true,
          redirectUrl: `/settings/subscription?paid=${encodeURIComponent(fin.invoiceNumber)}`,
        },
      });
    } catch (e) {
      console.error("[RENEW] Complete failed:", e);
      return NextResponse.json({ error: (e as Error).message || "Renewal failed" }, { status: 500 });
    }
  },
  { resource: "subscription.customer-portal", action: "edit" }
);

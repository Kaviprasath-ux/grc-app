/**
 * Post-capture finalisation logic shared by:
 *   • Renew/Add-module/Upgrade checkout endpoints (synchronous, dev-stub)
 *   • /api/payments/internal/payment-success webhook (real provider callback)
 *
 * Idempotent: re-running with the same invoiceId is a no-op once the invoice
 * is already PAID. Safe to retry on transient failures.
 *
 * Steps performed when invoice is currently DRAFT/ISSUED:
 *   1. Mark Invoice → PAID, Payment → CAPTURED
 *   2. Stamp providerPaymentId/Signature on the Payment if supplied
 *   3. Sync each touched ModuleSubscription to the legacy SubscriptionPlan
 *   4. Generate the invoice PDF and persist it under uploads/invoices/
 *
 * Subscription changes (extending cycleEnd, creating new module subscriptions,
 * upgrading tiers) are applied by the *checkout* endpoint that created the
 * Invoice — not here. This keeps finalize() idempotent and avoids subtle
 * race conditions between concurrent payment callbacks.
 *
 * COMPLIMENTARY subscriptions never reach this code path because they don't
 * generate Invoices. If somehow called for one, we still mark records but
 * generate no PDF.
 */

import prisma from "@/lib/prisma";
import { generateAndSaveInvoicePdf } from "@/lib/invoice-pdf";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";

export interface FinalizeOptions {
  /** Provider-issued payment id (e.g., Razorpay's payment_id). Optional in stub mode. */
  providerPaymentId?: string;
  /** Provider-issued signature for verification (Razorpay HMAC). */
  providerSignature?: string;
}

export interface FinalizeResult {
  invoiceId: string;
  invoiceNumber: string;
  status: "PAID" | "ALREADY_PAID";
  pdfPath: string | null;
}

export async function finalizeInvoice(
  invoiceId: string,
  opts: FinalizeOptions = {}
): Promise<FinalizeResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      payment: true,
      subscription: { select: { id: true, gstin: true, customerAccountId: true } },
      customerAccount: { select: { id: true, code: true, name: true } },
    },
  });
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  // Idempotency
  if (invoice.status === "PAID") {
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: "ALREADY_PAID",
      pdfPath: invoice.pdfPath,
    };
  }

  const now = new Date();

  // Mark Invoice + Payment in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID" },
    });
    if (invoice.payment) {
      await tx.payment.update({
        where: { id: invoice.payment.id },
        data: {
          status: "CAPTURED",
          paidAt: now,
          providerPaymentId: opts.providerPaymentId ?? invoice.payment.providerPaymentId,
          providerSignature: opts.providerSignature ?? invoice.payment.providerSignature,
        },
      });
    }
  });

  // Sync legacy SubscriptionPlan rows for the modules touched by this invoice
  const moduleCodesTouched = new Set(invoice.items.map((it) => it.moduleCode));
  if (moduleCodesTouched.size > 0) {
    const moduleSubs = await prisma.moduleSubscription.findMany({
      where: {
        subscriptionId: invoice.subscriptionId,
        moduleCode: { in: Array.from(moduleCodesTouched) },
      },
    });
    for (const ms of moduleSubs) {
      try { await syncSubscriptionPlan(ms.id); } catch { /* non-fatal */ }
    }
  }

  // Generate PDF
  let pdfPath: string | null = null;
  try {
    pdfPath = await generateAndSaveInvoicePdf(
      { ...invoice, items: invoice.items },
      {
        code: invoice.customerAccount.code,
        name: invoice.customerAccount.name,
        gstin: invoice.subscription?.gstin ?? null,
      }
    );
    await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath } });
  } catch (e) {
    console.error("[finalizeInvoice] PDF generation failed:", e);
    // Don't fail the whole call — PDF can be regenerated on first download
  }

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: "PAID",
    pdfPath,
  };
}

/**
 * Mark an invoice + payment as failed and leave subscription changes intact.
 * Called by /api/payments/internal/payment-failed and by checkout endpoints
 * when the synchronous processPayment() call returns FAILED.
 */
export async function markInvoiceFailed(
  invoiceId: string,
  errorCode?: string,
  errorDescription?: string
): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payment: true },
  });
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
  if (invoice.status === "FAILED" || invoice.status === "PAID") return; // idempotent

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "FAILED" },
    });
    if (invoice.payment) {
      await tx.payment.update({
        where: { id: invoice.payment.id },
        data: {
          status: "FAILED",
          errorCode: errorCode ?? null,
          errorDescription: errorDescription ?? null,
        },
      });
    }
  });
}

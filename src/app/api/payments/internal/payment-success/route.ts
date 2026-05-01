/**
 * POST /api/payments/internal/payment-success
 *
 * **Internal contract endpoint for the payment provider integration.**
 *
 * The Razorpay (or other provider) integration calls this server-to-server
 * after a payment is successfully captured. It is NOT used by the dev stub
 * — the dev stub finalises synchronously inside checkout endpoints — but
 * this endpoint exists as the documented contract for the payment team.
 *
 * Body: { invoiceId, providerPaymentId?, providerSignature? }
 *
 * Idempotent: replaying the same payload is a no-op once the invoice is PAID.
 *
 * Security: protected by INTERNAL_PAYMENT_SECRET in the Authorization header
 * (Bearer token). Callers must include it.
 */

import { NextRequest, NextResponse } from "next/server";
import { finalizeInvoice } from "@/lib/payment-finalize";
import { z } from "zod";

const Schema = z.object({
  invoiceId: z.string().min(1),
  providerPaymentId: z.string().optional(),
  providerSignature: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // Bearer-token check
  const expected = process.env.INTERNAL_PAYMENT_SECRET;
  if (expected) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await finalizeInvoice(parsed.data.invoiceId, {
      providerPaymentId: parsed.data.providerPaymentId,
      providerSignature: parsed.data.providerSignature,
    });
    return NextResponse.json({
      data: {
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber,
        status: result.status, // PAID or ALREADY_PAID
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

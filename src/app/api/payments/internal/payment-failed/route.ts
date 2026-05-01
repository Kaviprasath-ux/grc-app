/**
 * POST /api/payments/internal/payment-failed
 *
 * **Internal contract endpoint for the payment provider integration.**
 *
 * Called by the payment integration after a capture attempt fails (declined
 * card, network error, etc.). Marks the Invoice and Payment as FAILED with
 * provider error details, but leaves the optimistic ModuleSubscription
 * changes alone — they will naturally expire at cycleEnd if not retried.
 *
 * Body: { invoiceId, errorCode?, errorDescription? }
 * Auth: Bearer INTERNAL_PAYMENT_SECRET (same as payment-success).
 *
 * Idempotent.
 */

import { NextRequest, NextResponse } from "next/server";
import { markInvoiceFailed } from "@/lib/payment-finalize";
import { z } from "zod";

const Schema = z.object({
  invoiceId: z.string().min(1),
  errorCode: z.string().optional(),
  errorDescription: z.string().optional(),
});

export async function POST(req: NextRequest) {
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
    await markInvoiceFailed(
      parsed.data.invoiceId,
      parsed.data.errorCode,
      parsed.data.errorDescription
    );
    return NextResponse.json({ data: { invoiceId: parsed.data.invoiceId, status: "FAILED" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

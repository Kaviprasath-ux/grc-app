/**
 * Payment provider boundary.
 *
 * `processPayment()` is the *single* function the payment team replaces with a
 * real Razorpay integration. Everything else in the codebase calls only this.
 *
 * Behaviour:
 *   PAYMENT_STUB=true    → instantly returns CAPTURED. Used in dev / QA.
 *   PAYMENT_STUB=false   → throws "Razorpay integration pending" until the
 *                          payment team swaps the body of this function.
 *   PAYMENT_STUB unset   → defaults to true in dev, false in prod.
 *
 * The integration spec (docs/payment-integration-spec.md) describes how
 * the function is invoked and what it must return for success/failure.
 *
 * For external webhooks (e.g., Razorpay Server-to-Server callback), the
 * payment team posts to /api/payments/internal/payment-success or
 * /api/payments/internal/payment-failed — those endpoints reuse the same
 * finalisation logic this function triggers internally.
 */

import { randomUUID } from "crypto";

export interface PaymentRequest {
  /** Subscription this payment belongs to. */
  subscriptionId: string;
  /** Total amount to charge in INR (will be converted to paise by Razorpay). */
  amount: number;
  currency: string; // "INR"
  /** Bound to the customer for invoice numbering / receipts. */
  customerAccountId: string;
  /** Idempotency: provider will reuse the result if same key replayed. */
  idempotencyKey?: string;
  /** What the caller wants done after CAPTURED — for the success handler to
   *  apply. Stored opaquely on the Payment row by the caller. */
  description: string;
}

export interface PaymentResult {
  status: "CAPTURED" | "AUTHORIZED" | "FAILED";
  /** Provider-issued reference. In stub mode, a random UUID. */
  paymentRef: string;
  /** Provider's transaction id, e.g., Razorpay payment_id. */
  providerPaymentId?: string;
  errorCode?: string;
  errorDescription?: string;
}

function stubEnabled(): boolean {
  if (process.env.PAYMENT_STUB === "true") return true;
  if (process.env.PAYMENT_STUB === "false") return false;
  // Default: stub on in non-production.
  return process.env.NODE_ENV !== "production";
}

/**
 * Process a payment via the configured provider.
 *
 * In stub mode this immediately returns CAPTURED, allowing checkout flows to
 * complete end-to-end in dev. The real implementation (to be supplied by the
 * payment team) should integrate with Razorpay orders + payment capture and
 * return a corresponding PaymentResult.
 */
export async function processPayment(req: PaymentRequest): Promise<PaymentResult> {
  if (stubEnabled()) {
    return {
      status: "CAPTURED",
      paymentRef: `STUB-${randomUUID()}`,
      providerPaymentId: `stub_pay_${Date.now()}`,
    };
  }
  throw new Error(
    "Razorpay integration pending — replace processPayment() in src/lib/payment-provider.ts. " +
    "See docs/payment-integration-spec.md."
  );
}

/**
 * For internal use by tests and admin tools — never call from a request handler.
 */
export function isStubMode(): boolean {
  return stubEnabled();
}

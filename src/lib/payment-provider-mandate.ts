/**
 * Razorpay mandate-based recurring subscriptions (V2 autopay).
 *
 * Used by Phase 5 for the BASE -> GENERAL 2-year auto-debit flow:
 *
 *   1. createSubscriptionMandate() -> Razorpay subscription_id + checkout URL
 *   2. Customer authorizes the mandate (UPI Autopay / e-NACH / card auth)
 *   3. Razorpay charges the first invoice (BASE: INR 100 + GST)
 *   4. Razorpay charges recurring invoices on the configured cycle
 *   5. Each successful charge fires a `subscription.charged` webhook
 *   6. cancelMandate() can stop the recurrence after contract end
 *
 * Stub mode (PAYMENT_STUB=true)
 *   No real Razorpay call is made. createSubscriptionMandate returns a fake
 *   mandate id (STUB-MANDATE-<uuid>) with status "active". The caller is
 *   expected to immediately treat the first charge as captured (no webhook
 *   round-trip needed in dev) — see signup/v2 route for the inline simulation.
 *
 * Environment variables (production)
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET    - same as V1 one-shot
 *   RAZORPAY_WEBHOOK_SECRET                  - shared with V1 webhook handler
 *
 * Replacing stub with real Razorpay
 *   Swap the implementation of createSubscriptionMandate() / cancelMandate()
 *   to call Razorpay's Subscriptions API. The shape returned should remain
 *   the same; callers do not need to change.
 */

import { randomUUID } from "crypto";
import { isStubMode } from "@/lib/payment-provider";

export type MandateStatus =
  | "created"      // returned by Razorpay before customer authorizes
  | "authenticated" // mandate authorized, awaiting first charge
  | "active"        // first charge captured, recurring
  | "halted"        // charge failed (retries exhausted)
  | "cancelled"     // customer or admin cancelled
  | "completed";    // total_count reached

export interface CreateMandateInput {
  customerAccountId: string;
  /** Cycle the GENERAL plan will charge on (used to compute total_count). */
  generalBillingCycle: "MONTHLY" | "YEARLY";
  /** Total INR to charge per cycle (single line; Phase 5 supports one mandate per customer). */
  unitAmount: number;
  /** Customer-facing description shown in Razorpay checkout. */
  description: string;
  /** Customer email for prefill. */
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  /** Idempotency key — caller-defined; reuse to safely retry mandate creation. */
  idempotencyKey?: string;
}

export interface CreateMandateResult {
  /** Razorpay subscription_id (or stub UUID). Persist to ModuleSubscription.mandateId. */
  mandateId: string;
  status: MandateStatus;
  /** URL the client redirects to for mandate authorization. Null in stub mode. */
  checkoutUrl: string | null;
  /** Total number of charges scheduled (Year 2 + Year 3 charges; BASE Year 1 is separate). */
  totalCount: number;
}

/**
 * Create a recurring mandate. In stub mode returns a fake authenticated mandate
 * with no checkoutUrl — the caller should immediately provision the customer
 * (no webhook round-trip needed locally).
 */
export async function createSubscriptionMandate(input: CreateMandateInput): Promise<CreateMandateResult> {
  // GENERAL phase runs Year 2 only (12 months on MONTHLY, 1 year on YEARLY).
  // Note: contract is 2 years total but Year 1 is BASE (charged separately as a one-shot).
  const totalCount = input.generalBillingCycle === "MONTHLY" ? 12 : 1;

  if (isStubMode()) {
    return {
      mandateId: `STUB-MANDATE-${randomUUID()}`,
      status: "active",
      checkoutUrl: null,
      totalCount,
    };
  }

  // Real Razorpay implementation: integration team replaces this.
  // SDK: razorpay.subscriptions.create({ plan_id, total_count, customer_notify, ... })
  throw new Error(
    "Razorpay Subscriptions API not yet integrated — set PAYMENT_STUB=true for local dev"
  );
}

/**
 * Cancel a mandate. After-contract use only — caller MUST verify
 * canCancelNow(moduleSubscription) before invoking.
 */
export async function cancelMandate(mandateId: string): Promise<{ status: MandateStatus }> {
  if (isStubMode()) {
    return { status: "cancelled" };
  }
  if (mandateId.startsWith("STUB-MANDATE-")) {
    // Stub artifact reaching prod somehow — treat as a no-op cancel.
    return { status: "cancelled" };
  }
  throw new Error("Razorpay Subscriptions cancel not yet integrated");
}

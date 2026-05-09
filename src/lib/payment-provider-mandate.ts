/**
 * Razorpay mandate-based recurring subscriptions (V2 autopay with 14-day trial).
 *
 * Flow:
 *   1. createSubscriptionMandate() -> Razorpay subscription with trial period
 *   2. Customer authorizes the mandate (UPI Autopay / e-NACH / card auth)
 *   3. 14-day free trial begins (no charge)
 *   4. After trial ends, Razorpay auto-charges first invoice (BASE: ₹1,200/module)
 *   5. After Year 1, GENERAL plan kicks in (₹15,000/module/month)
 *   6. cancelMandate() can stop recurrence after contract end
 *
 * Stub mode (PAYMENT_STUB=true)
 *   No real Razorpay call is made. createSubscriptionMandate returns a fake
 *   mandate id (STUB-MANDATE-<uuid>) with status "active". The caller is
 *   expected to immediately treat the account as provisioned.
 *
 * Environment variables (production)
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET    - API credentials
 *   RAZORPAY_WEBHOOK_SECRET                  - Webhook signature verification
 *   TRIAL_DAYS                               - Trial period (default: 14)
 */

import { randomUUID } from "crypto";
import { isStubMode } from "@/lib/payment-provider";
import { getOrCreate2YearPlan, getTwoYearPriceFromDb } from "@/lib/razorpay-plan-manager";

// Trial period in days (can be configured via env)
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || "14", 10);

export type MandateStatus =
  | "created"       // returned by Razorpay before customer authorizes
  | "authenticated" // mandate authorized, trial started
  | "active"        // first charge captured, recurring
  | "halted"        // charge failed (retries exhausted)
  | "cancelled"     // customer or admin cancelled
  | "completed"     // total_count reached
  | "pending";      // initial state before authorization

export interface CreateMandateInput {
  customerAccountId: string;
  /** Module code for plan lookup. */
  moduleCode: string;
  /** Cycle the GENERAL plan will charge on (used to compute total_count). */
  generalBillingCycle: "MONTHLY" | "YEARLY";
  /** Total INR to charge per cycle (not used directly - we use plan pricing). */
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
  /** Total number of charges scheduled (Year 1 BASE = 1 yearly charge). */
  totalCount: number;
  /** When the trial period ends and first charge will occur. */
  trialEndsAt: Date;
}

// Razorpay subscription types
interface RazorpaySubscriptionEntity {
  id: string;
  entity: "subscription";
  plan_id: string;
  status: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired" | "paused";
  current_start?: number;
  current_end?: number;
  ended_at?: number | null;
  quantity: number;
  notes: Record<string, string>;
  charge_at?: number;
  offer_id?: string | null;
  short_url: string;
  has_scheduled_changes: boolean;
  change_scheduled_at?: number | null;
  source?: string;
  payment_method?: string;
  customer_id?: string;
  created_at: number;
  start_at?: number;
  total_count?: number;
  paid_count?: number;
  remaining_count?: number;
  auth_attempts?: number;
  type?: number;
  expire_by?: number | null;
}

interface RazorpaySubscriptionCreateOptions {
  plan_id: string;
  total_count?: number;
  quantity?: number;
  start_at?: number; // Unix timestamp for trial end / first charge
  expire_by?: number; // Subscription must be authorized before this
  customer_notify?: 0 | 1;
  notes?: Record<string, string>;
  offer_id?: string;
}

interface RazorpayInstance {
  subscriptions: {
    create: (options: RazorpaySubscriptionCreateOptions) => Promise<RazorpaySubscriptionEntity>;
    fetch: (subscriptionId: string) => Promise<RazorpaySubscriptionEntity>;
    cancel: (subscriptionId: string, cancelAtCycleEnd?: boolean) => Promise<RazorpaySubscriptionEntity>;
  };
}

let razorpayInstance: RazorpayInstance | null = null;

function getRazorpayClient(): RazorpayInstance {
  if (razorpayInstance) return razorpayInstance;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require("razorpay");
  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpayInstance!;
}

/**
 * Create a recurring mandate with 14-day trial.
 *
 * In stub mode returns a fake authenticated mandate with no checkoutUrl.
 * In production, creates a Razorpay subscription with start_at = trial end date.
 */
export async function createSubscriptionMandate(input: CreateMandateInput): Promise<CreateMandateResult> {
  // Calculate trial end date
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  // Year 1 BASE plan is 1 yearly charge after trial
  const totalCount = 1;

  if (isStubMode()) {
    return {
      mandateId: `STUB-MANDATE-${randomUUID()}`,
      status: "active",
      checkoutUrl: null,
      totalCount,
      trialEndsAt,
    };
  }

  // Get or create the 2-year plan in Razorpay (full contract amount)
  const planId = await getOrCreate2YearPlan(input.moduleCode);

  const razorpay = getRazorpayClient();

  // Create subscription with trial (start_at defines when first charge happens)
  // Full 2-year amount charged on day 14 (after trial)
  const subscriptionOptions: RazorpaySubscriptionCreateOptions = {
    plan_id: planId,
    total_count: 1, // One-time charge for full 2-year contract
    quantity: 1,
    start_at: Math.floor(trialEndsAt.getTime() / 1000), // Unix timestamp - charge after trial
    customer_notify: 0, // We handle notifications
    notes: {
      customerAccountId: input.customerAccountId,
      moduleCode: input.moduleCode,
      planType: "2YEAR",
      trialDays: TRIAL_DAYS.toString(),
      idempotencyKey: input.idempotencyKey || "",
    },
  };

  console.log(`[Mandate] Creating 2-year subscription with trial:`, {
    moduleCode: input.moduleCode,
    planId,
    startAt: trialEndsAt.toISOString(),
    chargeType: "Full 2-year contract",
  });

  const subscription = await razorpay.subscriptions.create(subscriptionOptions);

  console.log(`[Mandate] Subscription created:`, {
    id: subscription.id,
    status: subscription.status,
    shortUrl: subscription.short_url,
  });

  return {
    mandateId: subscription.id,
    status: mapRazorpayStatus(subscription.status),
    checkoutUrl: subscription.short_url,
    totalCount,
    trialEndsAt,
  };
}

/**
 * Create mandates for multiple modules (bulk signup).
 * Each module gets its own subscription/mandate.
 */
export async function createBulkSubscriptionMandates(
  modules: Array<{ moduleCode: string }>,
  input: Omit<CreateMandateInput, "moduleCode">
): Promise<CreateMandateResult[]> {
  const results: CreateMandateResult[] = [];

  for (const mod of modules) {
    const result = await createSubscriptionMandate({
      ...input,
      moduleCode: mod.moduleCode,
      idempotencyKey: input.idempotencyKey
        ? `${input.idempotencyKey}-${mod.moduleCode}`
        : undefined,
    });
    results.push(result);
  }

  return results;
}

/**
 * Fetch current mandate/subscription status from Razorpay.
 */
export async function fetchMandateStatus(
  mandateId: string
): Promise<{ status: MandateStatus; chargeAt?: Date }> {
  if (isStubMode() || mandateId.startsWith("STUB-MANDATE-")) {
    return { status: "active" };
  }

  const razorpay = getRazorpayClient();
  const subscription = await razorpay.subscriptions.fetch(mandateId);

  return {
    status: mapRazorpayStatus(subscription.status),
    chargeAt: subscription.charge_at
      ? new Date(subscription.charge_at * 1000)
      : undefined,
  };
}

/**
 * Cancel a mandate. After-contract use only — caller MUST verify
 * canCancelNow(moduleSubscription) before invoking.
 */
export async function cancelMandate(
  mandateId: string,
  cancelAtCycleEnd: boolean = true
): Promise<{ status: MandateStatus }> {
  if (isStubMode()) {
    return { status: "cancelled" };
  }

  if (mandateId.startsWith("STUB-MANDATE-")) {
    // Stub artifact reaching prod somehow — treat as a no-op cancel.
    return { status: "cancelled" };
  }

  const razorpay = getRazorpayClient();
  const subscription = await razorpay.subscriptions.cancel(mandateId, cancelAtCycleEnd);

  return { status: mapRazorpayStatus(subscription.status) };
}

/**
 * Get the checkout URL for an existing mandate (for retry scenarios).
 */
export async function getCheckoutUrl(mandateId: string): Promise<string | null> {
  if (isStubMode() || mandateId.startsWith("STUB-MANDATE-")) {
    return null;
  }

  const razorpay = getRazorpayClient();
  const subscription = await razorpay.subscriptions.fetch(mandateId);

  return subscription.short_url || null;
}

/**
 * Map Razorpay subscription status to our MandateStatus.
 */
function mapRazorpayStatus(
  razorpayStatus: RazorpaySubscriptionEntity["status"]
): MandateStatus {
  switch (razorpayStatus) {
    case "created":
    case "pending":
      return "pending";
    case "authenticated":
      return "authenticated";
    case "active":
      return "active";
    case "halted":
      return "halted";
    case "cancelled":
    case "paused":
      return "cancelled";
    case "completed":
    case "expired":
      return "completed";
    default:
      return "pending";
  }
}

/**
 * Calculate total amount for first charge (full 2-year contract + GST).
 */
export async function calculateFirstChargeAmount(moduleCode: string): Promise<{
  subtotal: number;
  tax: number;
  total: number;
}> {
  const subtotal = await getTwoYearPriceFromDb(moduleCode);
  const tax = Math.round(subtotal * 0.18 * 100) / 100; // 18% GST
  const total = subtotal + tax;

  return { subtotal, tax, total };
}

/**
 * Get trial days from environment or default.
 */
export function getTrialDays(): number {
  return TRIAL_DAYS;
}

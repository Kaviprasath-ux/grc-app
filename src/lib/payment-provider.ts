/**
 * Production-level Razorpay Payment Provider
 *
 * Features:
 * - Order creation with automatic retry on transient failures
 * - Payment verification with signature validation
 * - Comprehensive error handling with categorization
 * - Idempotency support for safe retries
 * - Stub mode for development/testing
 *
 * Environment Variables:
 * - PAYMENT_STUB: "true" to use stub mode (default in non-prod)
 * - RAZORPAY_KEY_ID: Razorpay API key ID
 * - RAZORPAY_KEY_SECRET: Razorpay API key secret
 * - RAZORPAY_WEBHOOK_SECRET: Webhook signature verification secret
 */

import { randomUUID } from "crypto";
import crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

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
  /** What the caller wants done after CAPTURED — for the success handler to apply. */
  description: string;
  /** Customer email for Razorpay prefill */
  customerEmail?: string;
  /** Customer phone for Razorpay prefill */
  customerPhone?: string;
  /** Customer name for Razorpay prefill */
  customerName?: string;
}

export interface PaymentResult {
  status: "CAPTURED" | "AUTHORIZED" | "FAILED" | "PENDING";
  /** Provider-issued reference (Razorpay order_id). */
  paymentRef: string;
  /** Provider's transaction id (Razorpay payment_id). */
  providerPaymentId?: string;
  /** Error code for failed payments */
  errorCode?: string;
  /** Human-readable error description */
  errorDescription?: string;
  /** Additional data for frontend Razorpay Checkout */
  checkoutData?: RazorpayCheckoutData;
}

export interface RazorpayCheckoutData {
  orderId: string;
  keyId: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
}

export interface PaymentVerificationRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface WebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        error_code?: string;
        error_description?: string;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        status: string;
        notes?: Record<string, string>;
      };
    };
  };
}

// ============================================================================
// Error Classes
// ============================================================================

export class RazorpayError extends Error {
  constructor(
    message: string,
    public code: string,
    public isRetryable: boolean = false,
    public httpStatus?: number
  ) {
    super(message);
    this.name = "RazorpayError";
  }
}

export class RazorpayNetworkError extends RazorpayError {
  constructor(message: string) {
    super(message, "NETWORK_ERROR", true);
    this.name = "RazorpayNetworkError";
  }
}

export class RazorpayValidationError extends RazorpayError {
  constructor(message: string, code: string = "VALIDATION_ERROR") {
    super(message, code, false);
    this.name = "RazorpayValidationError";
  }
}

export class RazorpayAuthError extends RazorpayError {
  constructor(message: string) {
    super(message, "AUTH_ERROR", false, 401);
    this.name = "RazorpayAuthError";
  }
}

// ============================================================================
// Retry Configuration
// ============================================================================

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

// ============================================================================
// Razorpay Client Singleton
// ============================================================================

interface RazorpayInstance {
  orders: {
    create: (options: RazorpayOrderOptions) => Promise<RazorpayOrder>;
    fetch: (orderId: string) => Promise<RazorpayOrder>;
  };
  payments: {
    fetch: (paymentId: string) => Promise<RazorpayPayment>;
    capture: (paymentId: string, amount: number, currency: string) => Promise<RazorpayPayment>;
  };
}

interface RazorpayOrderOptions {
  amount: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string>;
}

interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  notes: Record<string, string>;
  created_at: number;
}

interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id: string;
  method: string;
  error_code?: string;
  error_description?: string;
}

let razorpayInstance: RazorpayInstance | null = null;

function getRazorpayClient(): RazorpayInstance {
  if (razorpayInstance) return razorpayInstance;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new RazorpayAuthError(
      "Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  // Dynamic import to avoid issues in environments without the package
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require("razorpay");
  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpayInstance!;
}

// ============================================================================
// Utility Functions
// ============================================================================

function stubEnabled(): boolean {
  if (process.env.PAYMENT_STUB === "true") return true;
  if (process.env.PAYMENT_STUB === "false") return false;
  // Default: stub on in non-production.
  return process.env.NODE_ENV !== "production";
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof RazorpayError) {
    return error.isRetryable;
  }

  // Network errors are generally retryable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("socket hang up") ||
      message.includes("network")
    ) {
      return true;
    }
  }

  // Razorpay SDK error object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = error as any;
  if (err?.statusCode) {
    // 5xx errors are retryable
    if (err.statusCode >= 500 && err.statusCode < 600) return true;
    // 429 Too Many Requests is retryable
    if (err.statusCode === 429) return true;
  }

  return false;
}

function categorizeError(error: unknown): { code: string; description: string; isRetryable: boolean } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = error as any;

  // Razorpay API error structure
  if (err?.error?.code) {
    const code = err.error.code;
    const description = err.error.description || err.message || "Unknown error";

    // Categorize by error code
    const retryableCodes = [
      "GATEWAY_ERROR",
      "SERVER_ERROR",
      "SERVICE_UNAVAILABLE",
      "TIMEOUT",
    ];

    return {
      code,
      description,
      isRetryable: retryableCodes.includes(code),
    };
  }

  // Network/timeout errors
  if (error instanceof Error) {
    const message = error.message;
    if (message.includes("timeout")) {
      return { code: "TIMEOUT", description: "Request timed out", isRetryable: true };
    }
    if (message.includes("ECONNREFUSED")) {
      return { code: "CONNECTION_REFUSED", description: "Could not connect to payment gateway", isRetryable: true };
    }
    if (message.includes("ECONNRESET")) {
      return { code: "CONNECTION_RESET", description: "Connection was reset", isRetryable: true };
    }
  }

  return {
    code: "UNKNOWN_ERROR",
    description: error instanceof Error ? error.message : "An unknown error occurred",
    isRetryable: false,
  };
}

// ============================================================================
// Core Functions with Retry
// ============================================================================

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  operationName: string = "operation"
): Promise<T> {
  let lastError: unknown;
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on non-retryable errors
      if (!isRetryableError(error)) {
        console.error(`[Razorpay] ${operationName} failed with non-retryable error:`, error);
        throw error;
      }

      // Don't retry after max attempts
      if (attempt > config.maxRetries) {
        console.error(`[Razorpay] ${operationName} failed after ${config.maxRetries} retries:`, error);
        throw error;
      }

      console.warn(
        `[Razorpay] ${operationName} attempt ${attempt} failed, retrying in ${delay}ms...`,
        error instanceof Error ? error.message : error
      );

      await sleep(delay);
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Create a Razorpay order with automatic retry on transient failures.
 */
async function createOrderWithRetry(
  options: RazorpayOrderOptions,
  retryConfig?: Partial<RetryConfig>
): Promise<RazorpayOrder> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const razorpay = getRazorpayClient();

  return withRetry(
    () => razorpay.orders.create(options),
    config,
    `createOrder(${options.receipt})`
  );
}

/**
 * Fetch order status with retry.
 */
async function fetchOrderWithRetry(
  orderId: string,
  retryConfig?: Partial<RetryConfig>
): Promise<RazorpayOrder> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const razorpay = getRazorpayClient();

  return withRetry(
    () => razorpay.orders.fetch(orderId),
    config,
    `fetchOrder(${orderId})`
  );
}

/**
 * Fetch payment details with retry.
 */
async function fetchPaymentWithRetry(
  paymentId: string,
  retryConfig?: Partial<RetryConfig>
): Promise<RazorpayPayment> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const razorpay = getRazorpayClient();

  return withRetry(
    () => razorpay.payments.fetch(paymentId),
    config,
    `fetchPayment(${paymentId})`
  );
}

// ============================================================================
// Main Payment Functions
// ============================================================================

/**
 * Process a payment via Razorpay.
 *
 * In stub mode this immediately returns CAPTURED, allowing checkout flows to
 * complete end-to-end in dev. In production mode, creates a Razorpay order
 * and returns AUTHORIZED with checkout data for frontend integration.
 */
export async function processPayment(req: PaymentRequest): Promise<PaymentResult> {
  // Stub mode for development
  if (stubEnabled()) {
    console.log("[Razorpay] Stub mode enabled - returning mock CAPTURED payment");
    return {
      status: "CAPTURED",
      paymentRef: `STUB-${randomUUID()}`,
      providerPaymentId: `stub_pay_${Date.now()}`,
    };
  }

  // Validate request
  if (!req.amount || req.amount <= 0) {
    return {
      status: "FAILED",
      paymentRef: "",
      errorCode: "INVALID_AMOUNT",
      errorDescription: "Payment amount must be greater than 0",
    };
  }

  if (!req.subscriptionId) {
    return {
      status: "FAILED",
      paymentRef: "",
      errorCode: "INVALID_REQUEST",
      errorDescription: "Subscription ID is required",
    };
  }

  try {
    // Create Razorpay order
    const receipt = req.idempotencyKey || `rcpt_${req.subscriptionId}_${Date.now()}`;
    const amountInPaise = Math.round(req.amount * 100);

    console.log(`[Razorpay] Creating order: amount=${amountInPaise} paise, receipt=${receipt}`);

    const order = await createOrderWithRetry({
      amount: amountInPaise,
      currency: req.currency || "INR",
      receipt: receipt.substring(0, 40), // Razorpay has 40 char limit
      notes: {
        subscriptionId: req.subscriptionId,
        customerAccountId: req.customerAccountId,
        description: req.description.substring(0, 255),
      },
    });

    console.log(`[Razorpay] Order created: ${order.id}`);

    // Return AUTHORIZED with checkout data for frontend
    return {
      status: "AUTHORIZED",
      paymentRef: order.id,
      checkoutData: {
        orderId: order.id,
        keyId: process.env.RAZORPAY_KEY_ID!,
        amount: amountInPaise,
        currency: req.currency || "INR",
        name: "Verifai GRC",
        description: req.description,
        prefill: {
          email: req.customerEmail,
          contact: req.customerPhone,
          name: req.customerName,
        },
      },
    };
  } catch (error) {
    const { code, description } = categorizeError(error);
    console.error(`[Razorpay] Payment failed:`, { code, description, error });

    return {
      status: "FAILED",
      paymentRef: "",
      errorCode: code,
      errorDescription: description,
    };
  }
}

/**
 * Verify payment signature from Razorpay Checkout callback.
 * This should be called from the frontend callback handler.
 */
export function verifyPaymentSignature(params: PaymentVerificationRequest): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.error("[Razorpay] Cannot verify signature: RAZORPAY_KEY_SECRET not set");
    return false;
  }

  try {
    const body = params.razorpay_order_id + "|" + params.razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    const isValid = expectedSignature === params.razorpay_signature;

    if (!isValid) {
      console.warn("[Razorpay] Signature verification failed", {
        orderId: params.razorpay_order_id,
        paymentId: params.razorpay_payment_id,
      });
    }

    return isValid;
  } catch (error) {
    console.error("[Razorpay] Error verifying signature:", error);
    return false;
  }
}

/**
 * Verify webhook signature from Razorpay.
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[Razorpay] RAZORPAY_WEBHOOK_SECRET not set - skipping webhook verification");
    return true; // Allow in development
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    return expectedSignature === signature;
  } catch (error) {
    console.error("[Razorpay] Error verifying webhook signature:", error);
    return false;
  }
}

/**
 * Fetch and verify a payment after Razorpay Checkout completion.
 * Returns the payment status from Razorpay's servers.
 */
export async function fetchAndVerifyPayment(
  orderId: string,
  paymentId: string
): Promise<PaymentResult> {
  if (stubEnabled()) {
    return {
      status: "CAPTURED",
      paymentRef: orderId,
      providerPaymentId: paymentId,
    };
  }

  try {
    const payment = await fetchPaymentWithRetry(paymentId);

    // Verify payment belongs to the order
    if (payment.order_id !== orderId) {
      return {
        status: "FAILED",
        paymentRef: orderId,
        providerPaymentId: paymentId,
        errorCode: "ORDER_MISMATCH",
        errorDescription: "Payment does not belong to the specified order",
      };
    }

    // Map Razorpay status to our status
    const statusMap: Record<string, PaymentResult["status"]> = {
      captured: "CAPTURED",
      authorized: "AUTHORIZED",
      failed: "FAILED",
      created: "PENDING",
    };

    const status = statusMap[payment.status] || "FAILED";

    return {
      status,
      paymentRef: orderId,
      providerPaymentId: paymentId,
      errorCode: payment.error_code,
      errorDescription: payment.error_description,
    };
  } catch (error) {
    const { code, description } = categorizeError(error);
    return {
      status: "FAILED",
      paymentRef: orderId,
      providerPaymentId: paymentId,
      errorCode: code,
      errorDescription: description,
    };
  }
}

/**
 * Get the status of an existing order.
 */
export async function getOrderStatus(orderId: string): Promise<{
  status: "created" | "attempted" | "paid" | "unknown";
  amountPaid: number;
  amountDue: number;
}> {
  if (stubEnabled()) {
    return { status: "paid", amountPaid: 0, amountDue: 0 };
  }

  try {
    const order = await fetchOrderWithRetry(orderId);
    return {
      status: order.status,
      amountPaid: order.amount_paid,
      amountDue: order.amount_due,
    };
  } catch (error) {
    console.error(`[Razorpay] Failed to fetch order ${orderId}:`, error);
    return { status: "unknown", amountPaid: 0, amountDue: 0 };
  }
}

/**
 * Check if stub mode is enabled.
 */
export function isStubMode(): boolean {
  return stubEnabled();
}

/**
 * Get Razorpay key ID for frontend use.
 */
export function getRazorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID || "";
}

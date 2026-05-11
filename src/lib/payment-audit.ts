/**
 * Payment Audit Logger
 *
 * Logs all payment-related events to AuditLog for compliance and debugging.
 * Uses the existing AuditLog model with entityType = "Payment" or "Subscription".
 */

import prisma from "@/lib/prisma";

export type PaymentEventType =
  | "SIGNUP_INITIATED"
  | "SIGNUP_COMPLETED"
  | "SIGNUP_FAILED"
  | "MANDATE_CREATED"
  | "MANDATE_AUTHENTICATED"
  | "MANDATE_FAILED"
  | "PAYMENT_CHARGED"
  | "PAYMENT_FAILED"
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_HALTED"
  | "SUBSCRIPTION_CANCELLED"
  | "SUBSCRIPTION_COMPLETED"
  | "MONTHLY_BILLING_STARTED"
  | "WEBHOOK_RECEIVED"
  | "WEBHOOK_PROCESSED"
  | "WEBHOOK_FAILED";

export interface PaymentAuditData {
  eventType: PaymentEventType;
  entityType: "Payment" | "Subscription" | "Mandate" | "Webhook";
  entityId: string;
  customerAccountId?: string;
  moduleCode?: string;
  amount?: number;
  currency?: string;
  razorpayId?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log a payment event to the audit log.
 * This is fire-and-forget - errors are logged but don't fail the main operation.
 */
export async function logPaymentEvent(data: PaymentAuditData): Promise<void> {
  try {
    const changes = JSON.stringify({
      eventType: data.eventType,
      customerAccountId: data.customerAccountId,
      moduleCode: data.moduleCode,
      amount: data.amount,
      currency: data.currency,
      razorpayId: data.razorpayId,
      status: data.status,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      metadata: data.metadata,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      timestamp: new Date().toISOString(),
    });

    await prisma.auditLog.create({
      data: {
        changeType: data.eventType,
        entityType: data.entityType,
        entityId: data.entityId,
        userName: data.customerAccountId || "SYSTEM",
        changes,
      },
    });

    console.log(`[PaymentAudit] ${data.eventType}: ${data.entityType}/${data.entityId}`);
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error("[PaymentAudit] Failed to log event:", error, data);
  }
}

/**
 * Log signup initiation.
 */
export function logSignupInitiated(
  email: string,
  modules: string[],
  ipAddress?: string
): Promise<void> {
  return logPaymentEvent({
    eventType: "SIGNUP_INITIATED",
    entityType: "Subscription",
    entityId: email,
    metadata: { modules },
    ipAddress,
  });
}

/**
 * Log signup completion.
 */
export function logSignupCompleted(
  customerAccountId: string,
  email: string,
  modules: string[],
  mandateId: string
): Promise<void> {
  return logPaymentEvent({
    eventType: "SIGNUP_COMPLETED",
    entityType: "Subscription",
    entityId: customerAccountId,
    customerAccountId,
    razorpayId: mandateId,
    metadata: { email, modules },
  });
}

/**
 * Log signup failure.
 */
export function logSignupFailed(
  email: string,
  errorMessage: string,
  ipAddress?: string
): Promise<void> {
  return logPaymentEvent({
    eventType: "SIGNUP_FAILED",
    entityType: "Subscription",
    entityId: email,
    errorMessage,
    ipAddress,
  });
}

/**
 * Log webhook event.
 */
export function logWebhookEvent(
  eventId: string,
  eventType: string,
  mandateId: string | undefined,
  status: "RECEIVED" | "PROCESSED" | "FAILED",
  errorMessage?: string
): Promise<void> {
  const paymentEventType: PaymentEventType =
    status === "RECEIVED"
      ? "WEBHOOK_RECEIVED"
      : status === "PROCESSED"
        ? "WEBHOOK_PROCESSED"
        : "WEBHOOK_FAILED";

  return logPaymentEvent({
    eventType: paymentEventType,
    entityType: "Webhook",
    entityId: eventId,
    razorpayId: mandateId,
    status: eventType,
    errorMessage,
  });
}

/**
 * Log payment charge event.
 */
export function logPaymentCharge(
  subscriptionId: string,
  mandateId: string,
  amount: number,
  status: "SUCCESS" | "FAILED",
  paymentId?: string,
  errorMessage?: string
): Promise<void> {
  return logPaymentEvent({
    eventType: status === "SUCCESS" ? "PAYMENT_CHARGED" : "PAYMENT_FAILED",
    entityType: "Payment",
    entityId: paymentId || mandateId,
    razorpayId: mandateId,
    amount,
    currency: "INR",
    status,
    errorMessage,
    metadata: { subscriptionId },
  });
}

/**
 * Log subscription status change.
 */
export function logSubscriptionStatus(
  subscriptionId: string,
  mandateId: string,
  status: "ACTIVATED" | "HALTED" | "CANCELLED" | "COMPLETED",
  moduleCode?: string
): Promise<void> {
  const eventTypeMap: Record<string, PaymentEventType> = {
    ACTIVATED: "SUBSCRIPTION_ACTIVATED",
    HALTED: "SUBSCRIPTION_HALTED",
    CANCELLED: "SUBSCRIPTION_CANCELLED",
    COMPLETED: "SUBSCRIPTION_COMPLETED",
  };

  return logPaymentEvent({
    eventType: eventTypeMap[status],
    entityType: "Subscription",
    entityId: subscriptionId,
    razorpayId: mandateId,
    moduleCode,
    status,
  });
}

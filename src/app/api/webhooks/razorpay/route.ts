/**
 * Razorpay Webhook Handler
 *
 * Receives payment events from Razorpay and forwards them to our internal
 * payment success/failed endpoints for processing.
 *
 * Supported events:
 * - payment.captured: Payment was successfully captured
 * - payment.failed: Payment failed
 * - order.paid: Order was fully paid
 *
 * Security:
 * - Verifies Razorpay webhook signature using timing-safe comparison
 * - Validates payload structure with Zod schema
 * - Logs all webhook events for audit trail
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyWebhookSignature } from "@/lib/payment-provider";
import { prisma } from "@/lib/prisma";

// Disable body parsing - we need raw body for signature verification
export const dynamic = "force-dynamic";

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Payment entity schema for webhook validation.
 */
const paymentEntitySchema = z.object({
  id: z.string(),
  order_id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  method: z.string().optional(),
  error_code: z.string().optional(),
  error_description: z.string().optional(),
  notes: z.record(z.string(), z.string()).optional(),
});

/**
 * Order entity schema for webhook validation.
 */
const orderEntitySchema = z.object({
  id: z.string(),
  amount: z.number(),
  amount_paid: z.number(),
  amount_due: z.number(),
  currency: z.string(),
  status: z.string(),
  notes: z.record(z.string(), z.string()).optional(),
});

/**
 * Main webhook event schema.
 */
const razorpayWebhookEventSchema = z.object({
  event: z.string().min(1, "Event type is required"),
  payload: z.object({
    payment: z.object({
      entity: paymentEntitySchema,
    }).optional(),
    order: z.object({
      entity: orderEntitySchema,
    }).optional(),
  }),
  created_at: z.number(),
});

type RazorpayWebhookEvent = z.infer<typeof razorpayWebhookEventSchema>;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Get raw body for signature verification
    const rawBody = await req.text();

    // Get signature from header
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      console.warn("[Razorpay Webhook] Missing signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    // Verify signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error("[Razorpay Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse and validate event with Zod
    let event: RazorpayWebhookEvent;
    try {
      const parsed = JSON.parse(rawBody);
      const validated = razorpayWebhookEventSchema.safeParse(parsed);

      if (!validated.success) {
        console.error("[Razorpay Webhook] Payload validation failed:", validated.error.flatten());
        return NextResponse.json(
          { error: "Invalid payload structure", details: validated.error.flatten() },
          { status: 422 }
        );
      }

      event = validated.data;
    } catch {
      console.error("[Razorpay Webhook] Failed to parse JSON");
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    console.log(`[Razorpay Webhook] Received event: ${event.event}`, {
      paymentId: event.payload.payment?.entity.id,
      orderId: event.payload.payment?.entity.order_id || event.payload.order?.entity.id,
      status: event.payload.payment?.entity.status || event.payload.order?.entity.status,
    });

    // Handle different event types
    switch (event.event) {
      case "payment.captured":
        await handlePaymentCaptured(event);
        break;

      case "payment.failed":
        await handlePaymentFailed(event);
        break;

      case "order.paid":
        await handleOrderPaid(event);
        break;

      case "payment.authorized":
        // Payment authorized but not yet captured - log for monitoring
        console.log("[Razorpay Webhook] Payment authorized", {
          paymentId: event.payload.payment?.entity.id,
          orderId: event.payload.payment?.entity.order_id,
        });
        break;

      default:
        console.log(`[Razorpay Webhook] Unhandled event type: ${event.event}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Razorpay Webhook] Processed in ${duration}ms`);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Razorpay Webhook] Error processing webhook:", error);

    // Return 200 to prevent Razorpay from retrying (we'll handle errors internally)
    // Only return non-200 for signature failures
    return NextResponse.json(
      { error: "Internal error", received: true },
      { status: 200 }
    );
  }
}

/**
 * Handle payment.captured event
 */
async function handlePaymentCaptured(event: RazorpayWebhookEvent) {
  const payment = event.payload.payment?.entity;
  if (!payment) {
    console.error("[Razorpay Webhook] No payment entity in captured event");
    return;
  }

  const orderId = payment.order_id;
  const paymentId = payment.id;

  console.log(`[Razorpay Webhook] Processing captured payment: ${paymentId} for order: ${orderId}`);

  // Find invoice by payment ref (order_id)
  const invoice = await prisma.invoice.findFirst({
    where: {
      payment: {
        providerOrderId: orderId,
      },
    },
    include: {
      payment: true,
    },
  });

  if (!invoice) {
    // Try finding by notes
    const subscriptionId = payment.notes?.subscriptionId;
    if (subscriptionId) {
      const invoiceBySubscription = await prisma.invoice.findFirst({
        where: {
          subscriptionId,
          status: { in: ["DRAFT", "ISSUED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (invoiceBySubscription) {
        await callInternalPaymentSuccess(invoiceBySubscription.id, paymentId, "");
        return;
      }
    }

    console.warn(`[Razorpay Webhook] No invoice found for order: ${orderId}`);
    return;
  }

  // Check if already processed
  if (invoice.status === "PAID") {
    console.log(`[Razorpay Webhook] Invoice ${invoice.id} already paid, skipping`);
    return;
  }

  // Call internal payment success endpoint
  await callInternalPaymentSuccess(invoice.id, paymentId, "");
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(event: RazorpayWebhookEvent) {
  const payment = event.payload.payment?.entity;
  if (!payment) {
    console.error("[Razorpay Webhook] No payment entity in failed event");
    return;
  }

  const orderId = payment.order_id;
  const errorCode = payment.error_code || "UNKNOWN";
  const errorDescription = payment.error_description || "Payment failed";

  console.log(`[Razorpay Webhook] Processing failed payment for order: ${orderId}`, {
    errorCode,
    errorDescription,
  });

  // Find invoice by payment ref (order_id)
  const invoice = await prisma.invoice.findFirst({
    where: {
      payment: {
        providerOrderId: orderId,
      },
    },
  });

  if (!invoice) {
    console.warn(`[Razorpay Webhook] No invoice found for failed order: ${orderId}`);
    return;
  }

  // Call internal payment failed endpoint
  await callInternalPaymentFailed(invoice.id, errorCode, errorDescription);
}

/**
 * Handle order.paid event
 */
async function handleOrderPaid(event: RazorpayWebhookEvent) {
  const order = event.payload.order?.entity;
  if (!order) {
    console.error("[Razorpay Webhook] No order entity in paid event");
    return;
  }

  console.log(`[Razorpay Webhook] Order paid: ${order.id}`, {
    amount: order.amount,
    amountPaid: order.amount_paid,
  });

  // The payment.captured event should have already handled this
  // This is a backup in case payment.captured was missed
}

/**
 * Call internal payment success endpoint
 */
async function callInternalPaymentSuccess(
  invoiceId: string,
  providerPaymentId: string,
  providerSignature: string
) {
  const secret = process.env.INTERNAL_PAYMENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/payments/internal/payment-success`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret && { Authorization: `Bearer ${secret}` }),
      },
      body: JSON.stringify({
        invoiceId,
        providerPaymentId,
        providerSignature,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Razorpay Webhook] Failed to call payment-success:", data);
    } else {
      console.log("[Razorpay Webhook] Payment success processed:", data);
    }
  } catch (error) {
    console.error("[Razorpay Webhook] Error calling payment-success:", error);
  }
}

/**
 * Call internal payment failed endpoint
 */
async function callInternalPaymentFailed(
  invoiceId: string,
  errorCode: string,
  errorDescription: string
) {
  const secret = process.env.INTERNAL_PAYMENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}/api/payments/internal/payment-failed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret && { Authorization: `Bearer ${secret}` }),
      },
      body: JSON.stringify({
        invoiceId,
        errorCode,
        errorDescription,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[Razorpay Webhook] Failed to call payment-failed:", data);
    } else {
      console.log("[Razorpay Webhook] Payment failure processed:", data);
    }
  } catch (error) {
    console.error("[Razorpay Webhook] Error calling payment-failed:", error);
  }
}

/**
 * POST /api/webhooks/razorpay/subscription - Razorpay Subscriptions webhook handler.
 *
 * Handles V2 mandate-driven recurring charges. Idempotent via RazorpayEvent.
 *
 * Events handled:
 *   subscription.authenticated - mandate authorized, trial started
 *                                -> mandateStatus = "authenticated", subscription status remains TRIAL
 *   subscription.charged       - charge captured (after trial or recurring)
 *                                -> mark invoice PAID, update subscription to ACTIVE
 *   subscription.halted        - retries exhausted OR autopay disabled
 *                                -> IMMEDIATELY end subscription (mandatory 2-year contract requires working autopay)
 *   subscription.completed     - total_count reached
 *                                -> mandateStatus = "completed"
 *   subscription.cancelled     - customer or admin-initiated cancel
 *                                -> mandateStatus = "cancelled", end subscription
 *
 * IMPORTANT: If autopay fails or is disabled, the subscription ends immediately.
 * This is because the 2-year contract requires valid autopay authorization.
 *
 * Idempotency:
 *   - Look up by event id; if processedAt is set, return 200 immediately.
 *   - Otherwise insert/update the row, do work, then set processedAt.
 *   - Errors are recorded in errorText; the row is NOT marked processed so a
 *     retry can re-attempt.
 *
 * SECURITY:
 *   - Webhook signature verified using timing-safe comparison
 *   - Payload validated with Zod schema
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature, isStubMode } from "@/lib/payment-provider";
import type { Prisma } from "@prisma/client";

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Razorpay subscription webhook payload schema.
 * Validates the structure of incoming webhook events.
 */
const subscriptionEntitySchema = z.object({
  id: z.string().optional(),
  status: z.string().optional(),
  notes: z.record(z.string(), z.string()).optional(),
  current_start: z.number().optional(),
  current_end: z.number().optional(),
  charge_at: z.number().optional(),
}).optional();

const paymentEntitySchema = z.object({
  id: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  method: z.string().optional(),
}).optional();

const razorpaySubscriptionEventSchema = z.object({
  event: z.string().min(1, "Event type is required"),
  payload: z.object({
    subscription: z.object({
      entity: subscriptionEntitySchema,
    }).optional(),
    payment: z.object({
      entity: paymentEntitySchema,
    }).optional(),
  }).optional(),
  id: z.string().optional(),
  created_at: z.number().optional(),
});

type RazorpaySubscriptionEvent = z.infer<typeof razorpaySubscriptionEventSchema>;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Signature check (skipped in stub or if no secret configured)
  if (!isStubMode()) {
    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error("[Razorpay subscription webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  // Parse and validate webhook payload with Zod
  let body: RazorpaySubscriptionEvent;
  try {
    const parsed = JSON.parse(rawBody);
    const validated = razorpaySubscriptionEventSchema.safeParse(parsed);

    if (!validated.success) {
      console.error("[Razorpay subscription webhook] Payload validation failed:", validated.error.flatten());
      return NextResponse.json(
        { error: "Invalid payload structure", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    body = validated.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId =
    req.headers.get("x-razorpay-event-id") ||
    body.id ||
    `synth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const eventType = body.event;
  const mandateId = body.payload?.subscription?.entity?.id;
  const paymentEntity = body.payload?.payment?.entity;

  console.log(`[Razorpay Webhook] Received: ${eventType}`, {
    eventId,
    mandateId,
    paymentId: paymentEntity?.id,
  });

  // Idempotency check - return 200 if already processed.
  const existing = await prisma.razorpayEvent.findUnique({
    where: { eventId },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ data: { idempotent: true } });
  }

  // Upsert event row
  await prisma.razorpayEvent.upsert({
    where: { eventId },
    update: { errorText: null },
    create: {
      eventId,
      eventType,
      payload: body as unknown as Prisma.InputJsonValue,
    },
  });

  if (!mandateId) {
    await markProcessed(eventId, "no mandate id in payload");
    return NextResponse.json({ data: { acknowledged: true } });
  }

  try {
    const moduleSubs = await prisma.moduleSubscription.findMany({
      where: { mandateId },
      include: {
        subscription: true,
      },
    });
    if (moduleSubs.length === 0) {
      await markProcessed(eventId, "no matching ModuleSubscriptions");
      return NextResponse.json({ data: { acknowledged: true } });
    }

    const subscriptionIds = [...new Set(moduleSubs.map((ms) => ms.subscriptionId))];

    switch (eventType) {
      case "subscription.authenticated":
        // Mandate authorized - customer can now use the platform during trial
        await prisma.moduleSubscription.updateMany({
          where: { mandateId },
          data: { mandateStatus: "authenticated" },
        });
        console.log(
          `[Razorpay Webhook] Mandate authenticated: ${mandateId}, trial active`
        );
        break;

      case "subscription.charged":
        // Charge captured - update mandate status and mark invoice as paid
        await prisma.moduleSubscription.updateMany({
          where: { mandateId },
          data: { mandateStatus: "active" },
        });

        // Update subscription status to ACTIVE (trial ended or recurring charge success)
        for (const subId of subscriptionIds) {
          await prisma.subscription.update({
            where: { id: subId },
            data: { status: "ACTIVE" },
          });
        }

        // Mark the most-recent unpaid invoice as PAID
        for (const ms of moduleSubs) {
          const openInvoice = await prisma.invoice.findFirst({
            where: {
              subscriptionId: ms.subscriptionId,
              status: { in: ["DRAFT", "ISSUED"] },
            },
            orderBy: { createdAt: "desc" },
          });

          if (openInvoice) {
            await prisma.invoice.update({
              where: { id: openInvoice.id },
              data: {
                status: "PAID",
              },
            });

            // Create payment record and link to invoice
            if (paymentEntity) {
              const payment = await prisma.payment.create({
                data: {
                  subscriptionId: ms.subscriptionId,
                  amount: (paymentEntity.amount ?? 0) / 100, // Convert from paise
                  currency: paymentEntity.currency || "INR",
                  provider: "RAZORPAY",
                  providerOrderId: mandateId,
                  providerPaymentId: paymentEntity.id || "",
                  providerSignature: "",
                  status: "CAPTURED",
                  paidAt: new Date(),
                },
              });
              // Link invoice to payment
              await prisma.invoice.update({
                where: { id: openInvoice.id },
                data: { paymentId: payment.id },
              });
            }

            console.log(
              `[Razorpay Webhook] Invoice ${openInvoice.invoiceNumber} marked PAID`
            );
            break; // One invoice per charge event
          }
        }
        break;

      case "subscription.halted":
        // CRITICAL: Autopay failed - IMMEDIATELY end subscription
        // The 2-year contract requires working autopay. If it fails, subscription ends.
        console.error(
          `[Razorpay Webhook] AUTOPAY FAILED - Ending subscription immediately: ${mandateId}`
        );

        await prisma.moduleSubscription.updateMany({
          where: { mandateId },
          data: {
            mandateStatus: "halted",
            cancelledAt: new Date(),
          },
        });

        // Set subscription to SUSPENDED immediately
        for (const subId of subscriptionIds) {
          const existingSub = await prisma.subscription.findUnique({ where: { id: subId } });
          await prisma.subscription.update({
            where: { id: subId },
            data: {
              status: "SUSPENDED",
              autoRenew: false,
              notes: `${existingSub?.notes || ""} | AUTOPAY FAILED - Subscription ended on ${new Date().toISOString()}`,
            },
          });
        }

        // Mark any draft invoices as FAILED
        for (const ms of moduleSubs) {
          await prisma.invoice.updateMany({
            where: {
              subscriptionId: ms.subscriptionId,
              status: { in: ["DRAFT", "ISSUED"] },
            },
            data: { status: "FAILED" },
          });
        }

        // Disable module access flags
        for (const ms of moduleSubs) {
          const customerAccountId = ms.subscription?.customerAccountId;
          if (customerAccountId) {
            const updateData: Record<string, boolean> = {};
            if (ms.moduleCode === "GRC") updateData.isGrcAdded = false;
            if (ms.moduleCode === "TPRM") updateData.isTprmAdded = false;
            if (ms.moduleCode === "INTERNAL_AUDIT")
              updateData.isInternalAuditEnabled = false;

            if (Object.keys(updateData).length > 0) {
              await prisma.customerAccount.update({
                where: { id: customerAccountId },
                data: updateData,
              });
            }
          }
        }

        // TODO: Send notification email about subscription termination
        console.log(
          `[Razorpay Webhook] Subscription TERMINATED due to autopay failure: ${mandateId}`
        );
        break;

      case "subscription.completed":
        // All charges completed (contract fulfilled)
        await prisma.moduleSubscription.updateMany({
          where: { mandateId },
          data: { mandateStatus: "completed" },
        });
        console.log(`[Razorpay Webhook] Mandate completed: ${mandateId}`);
        break;

      case "subscription.cancelled":
        // Subscription cancelled (by admin or if customer somehow cancels)
        await prisma.moduleSubscription.updateMany({
          where: { mandateId },
          data: {
            mandateStatus: "cancelled",
            cancelledAt: new Date(),
          },
        });

        // End subscription
        for (const subId of subscriptionIds) {
          await prisma.subscription.update({
            where: { id: subId },
            data: {
              status: "CANCELLED",
              autoRenew: false,
            },
          });
        }
        console.log(`[Razorpay Webhook] Mandate cancelled: ${mandateId}`);
        break;

      case "subscription.pending":
        // Subscription is pending authorization
        await prisma.moduleSubscription.updateMany({
          where: { mandateId },
          data: { mandateStatus: "pending" },
        });
        break;

      case "subscription.paused":
        // Subscription paused - treat as terminated (autopay disabled)
        console.warn(
          `[Razorpay Webhook] Subscription PAUSED - Treating as terminated: ${mandateId}`
        );

        await prisma.moduleSubscription.updateMany({
          where: { mandateId },
          data: {
            mandateStatus: "cancelled",
            cancelledAt: new Date(),
          },
        });

        for (const subId of subscriptionIds) {
          await prisma.subscription.update({
            where: { id: subId },
            data: {
              status: "SUSPENDED",
              autoRenew: false,
            },
          });
        }
        break;

      default:
        // Other events are logged but not acted on
        console.log(`[Razorpay Webhook] Unhandled event type: ${eventType}`);
        break;
    }

    await markProcessed(eventId);
    return NextResponse.json({
      data: { processed: true, eventType, mandateId },
    });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    console.error("[Razorpay subscription webhook] Handler failed:", msg);
    await prisma.razorpayEvent.update({
      where: { eventId },
      data: { errorText: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function markProcessed(eventId: string, note?: string) {
  await prisma.razorpayEvent.update({
    where: { eventId },
    data: { processedAt: new Date(), errorText: note ?? null },
  });
}

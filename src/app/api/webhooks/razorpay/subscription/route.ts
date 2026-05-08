/**
 * POST /api/webhooks/razorpay/subscription - Razorpay Subscriptions webhook handler.
 *
 * Handles V2 mandate-driven recurring charges. Idempotent via RazorpayEvent.
 *
 * Events handled:
 *   subscription.charged    - charge captured -> mark next invoice PAID, advance cycleEnd
 *   subscription.halted     - retries exhausted -> mandateStatus = "halted"; downstream
 *                              status engine flips module to GRACE_PERIOD then SUSPENDED
 *   subscription.completed  - total_count reached -> mandateStatus = "completed"; module
 *                              becomes eligible for cancellation
 *   subscription.cancelled  - customer or admin-initiated cancel -> mandateStatus = "cancelled"
 *
 * Stub mode: this endpoint still exists and works if hand-fed; the real BASE
 * charge in stub mode is captured inline at signup, so the webhook is normally
 * not exercised. Tests can POST a synthetic event to validate idempotency.
 *
 * Idempotency:
 *   - Look up by event id; if processedAt is set, return 200 immediately.
 *   - Otherwise insert/update the row, do work, then set processedAt.
 *   - Errors are recorded in errorText; the row is NOT marked processed so a
 *     retry can re-attempt.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature, isStubMode } from "@/lib/payment-provider";
import type { Prisma } from "@prisma/client";

interface RazorpaySubscriptionEvent {
  event: string;
  payload?: {
    subscription?: {
      entity?: {
        id?: string;
        status?: string;
        notes?: Record<string, string>;
      };
    };
    payment?: {
      entity?: {
        id?: string;
        amount?: number;
      };
    };
  };
  id?: string;
  created_at?: number;
}

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

  let body: RazorpaySubscriptionEvent;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId =
    req.headers.get("x-razorpay-event-id") ||
    body.id ||
    `synth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const eventType = body.event;
  const mandateId = body.payload?.subscription?.entity?.id;

  if (!eventType) {
    return NextResponse.json({ error: "Missing event type" }, { status: 400 });
  }

  // Idempotency check - return 200 if already processed.
  const existing = await prisma.razorpayEvent.findUnique({ where: { eventId } });
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
    });
    if (moduleSubs.length === 0) {
      await markProcessed(eventId, "no matching ModuleSubscriptions");
      return NextResponse.json({ data: { acknowledged: true } });
    }

    switch (eventType) {
      case "subscription.charged":
        await prisma.moduleSubscription.updateMany({
          where: { mandateId },
          data: { mandateStatus: "active" },
        });
        // The next invoice (if any) for this customer/subscription gets marked PAID.
        // We only mark the most-recent unpaid invoice for the subscription.
        for (const ms of moduleSubs) {
          const open = await prisma.invoice.findFirst({
            where: {
              subscriptionId: ms.subscriptionId,
              status: { in: ["DRAFT", "ISSUED"] },
            },
            orderBy: { issueDate: "desc" },
          });
          if (open) {
            await prisma.invoice.update({
              where: { id: open.id },
              data: { status: "PAID" },
            });
          }
          break; // one invoice per charge event
        }
        break;
      case "subscription.halted":
        await prisma.moduleSubscription.updateMany({
          where: { mandateId },
          data: { mandateStatus: "halted" },
        });
        break;
      case "subscription.completed":
        await prisma.moduleSubscription.updateMany({
          where: { mandateId },
          data: { mandateStatus: "completed" },
        });
        break;
      case "subscription.cancelled":
        await prisma.moduleSubscription.updateMany({
          where: { mandateId },
          data: { mandateStatus: "cancelled" },
        });
        break;
      default:
        // Other events are logged but not acted on
        break;
    }

    await markProcessed(eventId);
    return NextResponse.json({ data: { processed: true, eventType, mandateId } });
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

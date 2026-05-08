/**
 * POST /api/settings/subscription/cancel
 * Body: { moduleCode?: ModuleCode }   // omit → cancel all modules
 *
 * Customer-side cancel:
 *   - Sets cancelledAt on each target ModuleSubscription (immediate)
 *   - Calls syncSubscriptionPlan so legacy enforcement reflects status=Inactive
 *     once cycleEnd passes
 *   - When cancelling all modules, also flips autoRenew=false on the envelope
 *   - Refused for COMPLIMENTARY subscriptions (admin-only)
 *
 * V2 contract lock-in (when contractEndDate is in the future):
 *   - cancelledAt is NOT set
 *   - cancellationRequestedAt is set instead — the plan-transitions cron will
 *     process the cancellation once today >= contractEndDate
 *   - Mandate (if any) is NOT cancelled until then; recurring charges continue
 *   - Returns 202 with { queued: true, availableOn }
 *
 * Access continues until cycleEnd; status engine returns CANCELLED while
 * cycleEnd is still in the future.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { getCancelEligibility } from "@/lib/contract-rules";
import { cancelMandate } from "@/lib/payment-provider-mandate";
import { sendTemplatedEmail } from "@/lib/email-service";
import { z } from "zod";

function appUrl(): string {
  return process.env.NEXTAUTH_URL || "https://app.verifai.com";
}

const Schema = z.object({
  moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]).optional(),
});

export const POST = withAuth(
  async (req: NextRequest, _ctx, session) => {
    if (!session.customerAccountId) {
      return NextResponse.json({ error: "No customer account on session" }, { status: 400 });
    }

    let body: unknown = {};
    try { body = await req.json(); } catch {}

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { customerAccountId: session.customerAccountId },
      include: { modules: true },
    });
    if (!sub) return NextResponse.json({ error: "No subscription configured" }, { status: 404 });
    if (sub.subscriptionType === "COMPLIMENTARY") {
      return NextResponse.json({ error: "Complimentary subscriptions cannot be cancelled here — please contact your administrator" }, { status: 400 });
    }

    const targets = parsed.data.moduleCode
      ? sub.modules.filter((m) => m.moduleCode === parsed.data.moduleCode && !m.cancelledAt)
      : sub.modules.filter((m) => !m.cancelledAt);

    if (targets.length === 0) {
      return NextResponse.json({ error: "No active modules to cancel" }, { status: 400 });
    }

    const now = new Date();

    // Bucket targets by what they're allowed to do right now. V1 rows always
    // cancel immediately; V2 rows in lock-in get queued.
    const immediate: typeof targets = [];
    const queue: typeof targets = [];
    for (const m of targets) {
      const elig = getCancelEligibility(m, now);
      if (elig.canCancelNow) immediate.push(m);
      else if (elig.canQueueCancellation) queue.push(m);
      // (already cancelled / already queued rows fall through to neither bucket)
    }

    // Process immediate cancellations
    for (const m of immediate) {
      await prisma.moduleSubscription.update({
        where: { id: m.id },
        data: { cancelledAt: now },
      });
      // V2: also cancel the Razorpay mandate so no further charges fire.
      if (m.mandateId) {
        try {
          await cancelMandate(m.mandateId);
        } catch (e) {
          console.warn(`[cancel] mandate cancel failed for ms ${m.id}:`, (e as Error).message);
        }
      }
      await syncSubscriptionPlan(m.id);
    }

    // Process queued cancellations (lock-in)
    for (const m of queue) {
      await prisma.moduleSubscription.update({
        where: { id: m.id },
        data: { cancellationRequestedAt: now },
      });
    }

    // Only flip autoRenew when ALL modules are being cancelled immediately.
    if (!parsed.data.moduleCode && immediate.length === targets.length && queue.length === 0) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { autoRenew: false } });
    }

    const stamp = now.toISOString();
    const scope = parsed.data.moduleCode ?? "all modules";
    const action =
      queue.length === 0
        ? "cancelled"
        : immediate.length === 0
        ? "queued cancellation (contract lock-in)"
        : `cancelled ${immediate.length} / queued ${queue.length}`;
    const note = `[${stamp}] ${session.email || session.id}: ${action} ${scope} (customer)`;
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { notes: sub.notes ? `${sub.notes}\n${note}` : note },
    });

    if (queue.length > 0 && immediate.length === 0) {
      // Pure-queued response: surface availableOn for UI.
      const availableOn =
        queue
          .map((m) => m.contractEndDate)
          .filter((d): d is Date => Boolean(d))
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

      // Best-effort confirmation email — don't fail the cancel if email errors.
      void (async () => {
        try {
          const customer = await prisma.customerAccount.findUnique({
            where: { id: session.customerAccountId! },
            select: { name: true },
          });
          if (customer && session.email) {
            await sendTemplatedEmail(
              "CANCELLATION_QUEUED",
              session.email,
              {
                customerName: customer.name,
                contractEndDate: availableOn ? availableOn.toISOString().slice(0, 10) : "the contract end date",
                portalLink: `${appUrl()}/settings/subscription`,
                recipientName: session.email,
              },
              session.email
            );
          }
        } catch (e) {
          console.warn("[cancel] CANCELLATION_QUEUED email failed:", (e as Error).message);
        }
      })();

      return NextResponse.json(
        { queued: queue.length, availableOn, reason: "Locked until contract end" },
        { status: 202 }
      );
    }

    return NextResponse.json({
      ok: true,
      cancelled: immediate.length,
      queued: queue.length,
    });
  },
  { resource: "subscription.customer-portal", action: "edit" }
);

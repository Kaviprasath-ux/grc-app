/**
 * PATCH /api/grc/cancellation-requests/[id]
 *
 * Approve or reject a cancellation request.
 * Super-admin only (GRCAdministrator).
 *
 * Body:
 *   - action: "approve" | "reject"
 *
 * Approve: Immediately sets cancelledAt, cancels mandate, syncs plan.
 * Reject: Clears cancellationRequestedAt (customer can re-request later).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { cancelMandate } from "@/lib/payment-provider-mandate";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const Schema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

export const PATCH = withAuth(
  async (req: NextRequest, ctx: RouteContext, session) => {
    const { id } = await ctx.params;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, reason } = parsed.data;

    const moduleSubscription = await prisma.moduleSubscription.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            customerAccount: { select: { name: true } },
          },
        },
      },
    });

    if (!moduleSubscription) {
      return NextResponse.json({ error: "Cancellation request not found" }, { status: 404 });
    }

    if (!moduleSubscription.cancellationRequestedAt) {
      return NextResponse.json({ error: "No pending cancellation request for this module" }, { status: 400 });
    }

    if (moduleSubscription.cancelledAt) {
      return NextResponse.json({ error: "Module is already cancelled" }, { status: 400 });
    }

    const now = new Date();
    const stamp = now.toISOString();
    const adminEmail = session.email || session.id;

    if (action === "approve") {
      // Immediately cancel the module
      await prisma.moduleSubscription.update({
        where: { id },
        data: { cancelledAt: now },
      });

      // Cancel Razorpay mandate if exists
      if (moduleSubscription.mandateId) {
        try {
          await cancelMandate(moduleSubscription.mandateId);
        } catch (e) {
          console.warn(`[cancel-request] mandate cancel failed for ms ${id}:`, (e as Error).message);
        }
      }

      // Sync legacy SubscriptionPlan
      await syncSubscriptionPlan(id);

      // Check if all modules are now cancelled -> flip autoRenew off
      const remaining = await prisma.moduleSubscription.count({
        where: {
          subscriptionId: moduleSubscription.subscriptionId,
          cancelledAt: null,
        },
      });
      if (remaining === 0) {
        await prisma.subscription.update({
          where: { id: moduleSubscription.subscriptionId },
          data: { autoRenew: false },
        });
      }

      // Add audit note
      const note = `[${stamp}] ${adminEmail}: APPROVED cancellation request for ${moduleSubscription.moduleCode}${reason ? ` — ${reason}` : ""} (admin)`;
      await prisma.subscription.update({
        where: { id: moduleSubscription.subscriptionId },
        data: {
          notes: moduleSubscription.subscription.notes
            ? `${moduleSubscription.subscription.notes}\n${note}`
            : note,
        },
      });

      return NextResponse.json({
        ok: true,
        action: "approved",
        message: `Cancellation approved. ${moduleSubscription.moduleCode} module is now cancelled.`,
      });
    } else {
      // Reject: clear the cancellation request
      await prisma.moduleSubscription.update({
        where: { id },
        data: { cancellationRequestedAt: null },
      });

      // Add audit note
      const note = `[${stamp}] ${adminEmail}: REJECTED cancellation request for ${moduleSubscription.moduleCode}${reason ? ` — ${reason}` : ""} (admin)`;
      await prisma.subscription.update({
        where: { id: moduleSubscription.subscriptionId },
        data: {
          notes: moduleSubscription.subscription.notes
            ? `${moduleSubscription.subscription.notes}\n${note}`
            : note,
        },
      });

      return NextResponse.json({
        ok: true,
        action: "rejected",
        message: `Cancellation request rejected. Customer can re-request if needed.`,
      });
    }
  },
  { resource: "grc.customer-accounts", action: "edit" }
);

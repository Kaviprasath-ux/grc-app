/**
 * POST /api/settings/subscription/cancel
 * Body: { moduleCode?: ModuleCode }   // omit → cancel all modules
 *
 * Customer-side cancel:
 *   - Sets cancelledAt on each target ModuleSubscription
 *   - Calls syncSubscriptionPlan so legacy enforcement reflects status=Inactive
 *     once cycleEnd passes
 *   - When cancelling all modules, also flips autoRenew=false on the envelope
 *   - Refused for COMPLIMENTARY subscriptions (admin-only)
 *
 * Access continues until cycleEnd; status engine returns CANCELLED while
 * cycleEnd is still in the future.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { z } from "zod";

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
    for (const m of targets) {
      await prisma.moduleSubscription.update({
        where: { id: m.id },
        data: { cancelledAt: now },
      });
      await syncSubscriptionPlan(m.id);
    }

    if (!parsed.data.moduleCode) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { autoRenew: false } });
    }

    const stamp = now.toISOString();
    const scope = parsed.data.moduleCode ?? "all modules";
    const note = `[${stamp}] ${session.email || session.id}: cancelled ${scope} (customer)`;
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { notes: sub.notes ? `${sub.notes}\n${note}` : note },
    });

    return NextResponse.json({ ok: true, cancelled: targets.length });
  },
  { resource: "subscription.customer-portal", action: "edit" }
);

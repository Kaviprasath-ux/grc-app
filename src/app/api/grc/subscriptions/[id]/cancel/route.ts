/**
 * POST /api/grc/subscriptions/[id]/cancel
 * Body: { moduleCode?: ModuleCode }   // optional → cancel all modules
 *
 * Marks `cancelledAt` on each target module and `autoRenew=false` on the
 * envelope. Access continues until cycleEnd; status engine returns CANCELLED.
 *
 * Reversible — DELETE the same path or use the "re-enable" endpoint to clear cancelledAt.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { z } from "zod";

const Schema = z.object({
  moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]).optional(),
});

interface RouteContext { params: Promise<{ id: string }>; }

export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    const { id } = await context.params;

    let body: unknown = {};
    try { body = await req.json(); } catch {}

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: { modules: true },
    });
    if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

    // If cancelling all modules, also flip autoRenew off on the envelope.
    if (!parsed.data.moduleCode) {
      await prisma.subscription.update({ where: { id }, data: { autoRenew: false } });
    }

    const stamp = now.toISOString();
    const scope = parsed.data.moduleCode ?? "all modules";
    const note = `[${stamp}] ${session.email || session.id}: cancelled ${scope}`;
    await prisma.subscription.update({
      where: { id },
      data: { notes: sub.notes ? `${sub.notes}\n${note}` : note },
    });

    return NextResponse.json({ ok: true, cancelled: targets.length });
  },
  { resource: "subscription.detail", action: "edit" }
);

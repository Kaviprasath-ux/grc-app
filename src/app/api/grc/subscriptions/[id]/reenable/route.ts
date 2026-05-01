/**
 * POST /api/grc/subscriptions/[id]/reenable
 * Body: { moduleCode?: ModuleCode, newCycleEnd?: ISO datetime }
 *
 * Clears cancelledAt on each target module. If the module is past cycleEnd,
 * also extends cycleEnd to either the provided value or +1 year from today.
 * Use this to recover from cancel or revive a SUSPENDED subscription.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { z } from "zod";

const Schema = z.object({
  moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]).optional(),
  newCycleEnd: z.string().datetime().optional(),
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
      ? sub.modules.filter((m) => m.moduleCode === parsed.data.moduleCode)
      : sub.modules;

    if (targets.length === 0) {
      return NextResponse.json({ error: "No matching modules" }, { status: 400 });
    }

    const now = new Date();
    const fallbackEnd = new Date();
    fallbackEnd.setUTCFullYear(fallbackEnd.getUTCFullYear() + 1);
    const newEnd = parsed.data.newCycleEnd ? new Date(parsed.data.newCycleEnd) : fallbackEnd;

    for (const m of targets) {
      const data: { cancelledAt: null; cycleEnd?: Date } = { cancelledAt: null };
      if (m.cycleEnd <= now) data.cycleEnd = newEnd;
      await prisma.moduleSubscription.update({ where: { id: m.id }, data });
      await syncSubscriptionPlan(m.id);
    }

    const stamp = now.toISOString();
    const scope = parsed.data.moduleCode ?? "all modules";
    const note = `[${stamp}] ${session.email || session.id}: re-enabled ${scope}`;
    await prisma.subscription.update({
      where: { id },
      data: { notes: sub.notes ? `${sub.notes}\n${note}` : note },
    });

    return NextResponse.json({ ok: true, reenabled: targets.length });
  },
  { resource: "subscription.detail", action: "edit" }
);

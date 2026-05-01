/**
 * POST /api/grc/subscriptions/[id]/extend
 * Body: { days: number, moduleCode?: ModuleCode }   // moduleCode optional → extend all modules
 * Pushes cycleEnd forward by N days. Audit-logged via subscription.notes.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { z } from "zod";

const Schema = z.object({
  days: z.number().int().min(1).max(3650),
  moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]).optional(),
});

interface RouteContext { params: Promise<{ id: string }>; }

export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    const { id } = await context.params;

    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: { modules: true },
    });
    if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const targetModules = parsed.data.moduleCode
      ? sub.modules.filter((m) => m.moduleCode === parsed.data.moduleCode)
      : sub.modules;

    if (targetModules.length === 0) {
      return NextResponse.json({ error: "No matching modules to extend" }, { status: 400 });
    }

    const ms = parsed.data.days * 24 * 60 * 60 * 1000;
    const updatedIds: string[] = [];
    for (const m of targetModules) {
      const newEnd = new Date(m.cycleEnd.getTime() + ms);
      await prisma.moduleSubscription.update({
        where: { id: m.id },
        data: { cycleEnd: newEnd },
      });
      updatedIds.push(m.id);
    }

    // Sync legacy SubscriptionPlan rows so existing limit enforcement reflects the new expiry.
    for (const mid of updatedIds) {
      await syncSubscriptionPlan(mid);
    }

    // Append audit note
    const stamp = new Date().toISOString();
    const scope = parsed.data.moduleCode ?? "all modules";
    const note = `[${stamp}] ${session.email || session.id}: extended ${scope} by ${parsed.data.days} days`;
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { notes: sub.notes ? `${sub.notes}\n${note}` : note },
    });

    return NextResponse.json({ ok: true, extended: updatedIds.length, days: parsed.data.days });
  },
  { resource: "subscription.detail", action: "edit" }
);

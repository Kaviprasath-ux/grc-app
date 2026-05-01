/**
 * PATCH /api/settings/subscription/auto-renew
 * Body: { autoRenew: boolean }
 *
 * Toggles auto-renew on the caller's own subscription. Refused for
 * COMPLIMENTARY subscriptions (auto-renew is meaningless there).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { z } from "zod";

const Schema = z.object({ autoRenew: z.boolean() });

export const PATCH = withAuth(
  async (req: NextRequest, _ctx, session) => {
    if (!session.customerAccountId) {
      return NextResponse.json({ error: "No customer account on session" }, { status: 400 });
    }

    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { customerAccountId: session.customerAccountId },
    });
    if (!sub) return NextResponse.json({ error: "No subscription configured" }, { status: 404 });
    if (sub.subscriptionType === "COMPLIMENTARY") {
      return NextResponse.json({ error: "Auto-renew is not applicable to complimentary subscriptions" }, { status: 400 });
    }

    const stamp = new Date().toISOString();
    const note = `[${stamp}] ${session.email || session.id}: auto-renew ${parsed.data.autoRenew ? "enabled" : "disabled"} (customer)`;
    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        autoRenew: parsed.data.autoRenew,
        notes: sub.notes ? `${sub.notes}\n${note}` : note,
      },
    });

    return NextResponse.json({ data: { autoRenew: updated.autoRenew } });
  },
  { resource: "subscription.customer-portal", action: "edit" }
);

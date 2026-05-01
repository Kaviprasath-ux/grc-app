/**
 * POST /api/settings/subscription/add-module/quote
 *
 * Body: { lines: [{ moduleCode, tier }] }   // only modules NOT currently active
 *
 * Returns a pro-rated quote aligned to the customer's existing earliest cycleEnd
 * so the new modules renew on the same anchor date as their current subscription.
 *
 * Cycle is inherited from the customer's existing modules (forced YEARLY if mixed
 * or none active — pro-rata only meaningful for YEARLY).
 *
 * Read-only — no DB writes.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { computeQuote, wholeMonthsBetween } from "@/lib/pricing";
import { z } from "zod";

const Schema = z.object({
  lines: z.array(z.object({
    moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]),
    tier: z.enum(["BASIC", "MEDIUM", "PRO"]),
  })).min(1),
});

export const POST = withAuth(
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

    const subscription = await prisma.subscription.findUnique({
      where: { customerAccountId: session.customerAccountId },
      include: { modules: true },
    });
    if (!subscription) {
      return NextResponse.json({ error: "No subscription configured" }, { status: 404 });
    }
    if (subscription.subscriptionType === "COMPLIMENTARY") {
      return NextResponse.json({ error: "Complimentary subscriptions cannot self-add modules — please contact your administrator" }, { status: 400 });
    }

    const now = new Date();

    // Reject if any requested moduleCode already has an ACTIVE (non-cancelled, non-expired) subscription
    const activeCodes = new Set(
      subscription.modules
        .filter((m) => !m.cancelledAt && m.cycleEnd > now)
        .map((m) => m.moduleCode)
    );
    const conflicting = parsed.data.lines.filter((l) => activeCodes.has(l.moduleCode));
    if (conflicting.length > 0) {
      return NextResponse.json({
        error: `Already subscribed: ${conflicting.map((c) => c.moduleCode).join(", ")}. Use Upgrade Tier instead.`,
      }, { status: 400 });
    }

    // Anchor to earliest existing cycleEnd (so new modules renew with the rest)
    const futureEnds = subscription.modules
      .filter((m) => !m.cancelledAt && m.cycleEnd > now)
      .map((m) => m.cycleEnd);

    const anchorEndDate = futureEnds.length > 0
      ? new Date(Math.min(...futureEnds.map((d) => d.getTime())))
      : null;

    // Inherit cycle from existing modules (most-common); fallback YEARLY
    const yearlyCount = subscription.modules.filter((m) => !m.cancelledAt && m.billingCycle === "YEARLY").length;
    const monthlyCount = subscription.modules.filter((m) => !m.cancelledAt && m.billingCycle === "MONTHLY").length;
    const cycle = monthlyCount > yearlyCount ? "MONTHLY" : "YEARLY";

    const monthsRemaining = anchorEndDate ? wholeMonthsBetween(now, anchorEndDate) : 12;

    try {
      const quote = await computeQuote({
        customerAccountId: session.customerAccountId,
        lines: parsed.data.lines,
        cycle,
        anchorEndDate: anchorEndDate ?? undefined,
      });

      return NextResponse.json({
        data: {
          ...quote,
          anchor: {
            cycleEnd: anchorEndDate,
            monthsRemaining,
            isProRated: quote.lineItems[0]?.isProRated ?? false,
          },
          alreadyActive: subscription.modules
            .filter((m) => !m.cancelledAt && m.cycleEnd > now)
            .map((m) => ({ moduleCode: m.moduleCode, tier: m.tier, cycleEnd: m.cycleEnd })),
        },
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  },
  { resource: "subscription.customer-portal", action: "view" }
);

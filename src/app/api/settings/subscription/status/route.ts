/**
 * GET /api/settings/subscription/status
 *
 * Lightweight status endpoint for the in-app banner. Returns just enough
 * to decide which banner variant to render — much smaller than the full
 * /api/settings/subscription payload.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly } from "@/lib/api-auth";
import { computeSubscriptionStatus, daysUntilExpiry } from "@/lib/subscription-status";

// Banner is visible to every authenticated user in the customer (not just admins),
// since they all share the subscription state. Auto-scoped to their session.customerAccountId.
export const GET = withAuthOnly(
  async (_req, _ctx, session) => {
    if (!session.customerAccountId) {
      // No customer → nothing to display
      return NextResponse.json({ data: null });
    }

    const sub = await prisma.subscription.findUnique({
      where: { customerAccountId: session.customerAccountId },
      include: {
        modules: { select: { cycleEnd: true, cancelledAt: true } },
      },
    });

    if (!sub) return NextResponse.json({ data: null });

    const now = new Date();
    const status = computeSubscriptionStatus({
      subscriptionType: sub.subscriptionType,
      trialEndsAt: sub.trialEndsAt,
      modules: sub.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
      now,
    });

    // Earliest cycleEnd → drives countdown
    const futureEnds = sub.modules.filter((m) => !m.cancelledAt && m.cycleEnd > now).map((m) => m.cycleEnd);
    const nextCycleEnd = futureEnds.length > 0
      ? new Date(Math.min(...futureEnds.map((d) => d.getTime())))
      : null;

    const daysToExpiry = nextCycleEnd ? daysUntilExpiry(nextCycleEnd, now) : null;
    const trialDaysLeft = sub.trialEndsAt ? daysUntilExpiry(sub.trialEndsAt, now) : null;

    return NextResponse.json({
      data: {
        status,
        subscriptionType: sub.subscriptionType,
        nextCycleEnd,
        daysToExpiry,
        trialEndsAt: sub.trialEndsAt,
        trialDaysLeft,
      },
    });
  }
);

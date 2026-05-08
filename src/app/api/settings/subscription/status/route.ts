/**
 * GET /api/settings/subscription/status
 *
 * Lightweight status endpoint for the in-app banner. Returns just enough
 * to decide which banner variant to render — much smaller than the full
 * /api/settings/subscription payload.
 *
 * V2 fields (when SUBSCRIPTION_V2_ENABLED): summary of planType, base flip,
 * contract lock-in, queued cancellation. Earliest dates win when modules
 * differ (cheap heuristic for the banner; per-module detail is on the page).
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly } from "@/lib/api-auth";
import {
  computeSubscriptionStatus,
  daysUntilExpiry,
  isBasePeriod,
  isInLockInPeriod,
} from "@/lib/subscription-status";

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
        modules: {
          select: {
            cycleEnd: true,
            cancelledAt: true,
            planType: true,
            baseEndDate: true,
            contractEndDate: true,
            generalBillingCycle: true,
            cancellationRequestedAt: true,
          },
        },
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

    // V2 lifecycle summary. Heuristics for banner decisions:
    //   inBasePeriod      - any active module is on BASE and pre-flip
    //   earliestBaseEnd   - the earliest baseEndDate across active BASE modules (banner countdown)
    //   inLockIn          - any active module is inside its 2-year contract
    //   earliestCancelOn  - the earliest contractEndDate (date a customer can cancel)
    //   anyQueued         - true if ANY module has cancellationRequestedAt set
    //   earliestQueuedFor - the earliest contractEndDate among queued modules
    const activeModules = sub.modules.filter((m) => !m.cancelledAt);
    const inBasePeriod = activeModules.some((m) => isBasePeriod(m, now));
    const earliestBaseEnd =
      activeModules
        .filter((m) => isBasePeriod(m, now) && m.baseEndDate)
        .map((m) => m.baseEndDate!.getTime())
        .sort((a, b) => a - b)[0] ?? null;
    const inLockIn = activeModules.some((m) => isInLockInPeriod(m, now));
    const earliestCancelOn =
      activeModules
        .filter((m) => isInLockInPeriod(m, now) && m.contractEndDate)
        .map((m) => m.contractEndDate!.getTime())
        .sort((a, b) => a - b)[0] ?? null;
    const queuedModules = activeModules.filter((m) => m.cancellationRequestedAt);
    const anyQueued = queuedModules.length > 0;
    const earliestQueuedFor =
      queuedModules
        .filter((m) => m.contractEndDate)
        .map((m) => m.contractEndDate!.getTime())
        .sort((a, b) => a - b)[0] ?? null;
    const generalBillingCycle =
      activeModules.find((m) => m.generalBillingCycle)?.generalBillingCycle ?? null;

    return NextResponse.json({
      data: {
        status,
        subscriptionType: sub.subscriptionType,
        nextCycleEnd,
        daysToExpiry,
        trialEndsAt: sub.trialEndsAt,
        trialDaysLeft,
        v2: {
          inBasePeriod,
          baseEndDate: earliestBaseEnd ? new Date(earliestBaseEnd) : null,
          daysUntilBaseFlip: earliestBaseEnd ? daysUntilExpiry(new Date(earliestBaseEnd), now) : null,
          inLockIn,
          contractEndDate: earliestCancelOn ? new Date(earliestCancelOn) : null,
          daysUntilContractEnd: earliestCancelOn ? daysUntilExpiry(new Date(earliestCancelOn), now) : null,
          cancellationQueued: anyQueued,
          cancellationProcessesOn: earliestQueuedFor ? new Date(earliestQueuedFor) : null,
          generalBillingCycle,
        },
      },
    });
  }
);

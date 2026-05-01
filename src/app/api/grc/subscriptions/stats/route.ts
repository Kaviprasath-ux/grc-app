/**
 * Super-admin subscription KPIs — GET /api/grc/subscriptions/stats
 *
 * Returns aggregate metrics: active customers (by type), MRR/ARR, trial count,
 * complimentary count, expiring-30d count.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { computeSubscriptionStatus } from "@/lib/subscription-status";

export const GET = withAuth(
  async () => {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        modules: {
          select: { unitPrice: true, billingCycle: true, cycleEnd: true, cancelledAt: true },
        },
      },
    });

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let totalCustomers = 0;
    let activePaying = 0;
    let trialCount = 0;
    let complimentaryCount = 0;
    let suspendedCount = 0;
    let expiringSoonCount = 0;
    let mrr = 0;

    for (const s of subscriptions) {
      totalCustomers++;
      const status = computeSubscriptionStatus({
        subscriptionType: s.subscriptionType,
        trialEndsAt: s.trialEndsAt,
        modules: s.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
        now,
      });

      if (s.subscriptionType === "TRIAL") trialCount++;
      else if (s.subscriptionType === "COMPLIMENTARY") complimentaryCount++;
      else if (status === "ACTIVE" || status === "EXPIRING_SOON" || status === "TRIAL") activePaying++;

      if (status === "SUSPENDED") suspendedCount++;

      // Expiring soon within 30 days (and not already past)
      const hasExpiring = s.modules.some((m) =>
        !m.cancelledAt && m.cycleEnd > now && m.cycleEnd <= in30Days
      );
      if (hasExpiring && s.subscriptionType === "PAID") expiringSoonCount++;

      // MRR: sum from PAID subscriptions only
      if (s.subscriptionType === "PAID") {
        for (const m of s.modules) {
          if (m.cancelledAt || m.cycleEnd <= now) continue;
          const price = Number(m.unitPrice);
          mrr += m.billingCycle === "MONTHLY" ? price : price / 12;
        }
      }
    }

    return NextResponse.json({
      data: {
        totalCustomers,
        activePaying,
        trialCount,
        complimentaryCount,
        suspendedCount,
        expiringSoonCount,
        mrr: Math.round(mrr),
        arr: Math.round(mrr * 12),
        currency: "INR",
      },
    });
  },
  { resource: "subscription.list", action: "view" }
);

/**
 * POST /api/settings/subscription/upgrade/quote
 *
 * Body: { upgrades: [{ moduleCode, newTier }] }
 *
 * Returns the pro-rated charge to upgrade modules' tiers mid-cycle.
 * Charge per module = (newTierPrice − currentTierPrice) × monthsRemaining / 12
 * for YEARLY cycles. MONTHLY cycles charge the per-cycle difference once
 * (no pro-rata since next bill is the next billing period anyway).
 *
 * Downgrades are rejected (must go through sales — UI hides them too).
 *
 * Bundle discounts are applied to the total upgrade subtotal.
 *
 * Read-only — no DB writes.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { getModulePrice, wholeMonthsBetween, round2, getBestBundleDiscount, DEFAULT_TAX_RATE, DEFAULT_CURRENCY } from "@/lib/pricing";
import type { QuoteLineRequest } from "@/lib/pricing";
import { z } from "zod";

const TIER_RANK: Record<string, number> = { BASIC: 0, MEDIUM: 1, PRO: 2 };

const Schema = z.object({
  upgrades: z.array(z.object({
    moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]),
    newTier: z.enum(["BASIC", "MEDIUM", "PRO"]),
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
      return NextResponse.json({ error: "Complimentary subscriptions cannot be upgraded — please contact your administrator" }, { status: 400 });
    }

    const now = new Date();
    const lineItems: Array<{
      moduleCode: string;
      currentTier: string;
      newTier: string;
      cycle: string;
      currentPrice: number;
      newPrice: number;
      diff: number;
      monthsCharged: number;
      isProRated: boolean;
      unitPrice: number;
      description: string;
      cycleEnd: Date;
    }> = [];

    // Build line requests for bundle discount calculation (using new tiers)
    const quoteLineRequests: QuoteLineRequest[] = [];
    // Track the billing cycle for bundle discount lookup
    let dominantCycle: "MONTHLY" | "YEARLY" = "YEARLY";

    for (const u of parsed.data.upgrades) {
      const ms = subscription.modules.find((m) => m.moduleCode === u.moduleCode && !m.cancelledAt);
      if (!ms) {
        return NextResponse.json({ error: `${u.moduleCode} is not currently active. Use Add Module instead.` }, { status: 400 });
      }
      if (ms.cycleEnd <= now) {
        return NextResponse.json({ error: `${u.moduleCode} has expired — please renew before upgrading.` }, { status: 400 });
      }
      const newRank = TIER_RANK[u.newTier];
      const currentRank = TIER_RANK[ms.tier];
      if (newRank <= currentRank) {
        return NextResponse.json({
          error: `${u.moduleCode} is already at ${ms.tier}. Downgrades must go through sales.`,
        }, { status: 400 });
      }

      const cycle = ms.billingCycle as "MONTHLY" | "YEARLY";
      dominantCycle = cycle; // Use the last module's cycle (they should all be the same)

      const { price: currentPrice } = await getModulePrice(u.moduleCode, ms.tier, cycle, session.customerAccountId, now);
      const { price: newPrice } = await getModulePrice(u.moduleCode, u.newTier, cycle, session.customerAccountId, now);
      const diff = round2(newPrice - currentPrice);

      let unitPrice: number;
      let monthsCharged: number;
      let isProRated: boolean;

      if (cycle === "YEARLY") {
        monthsCharged = wholeMonthsBetween(now, ms.cycleEnd);
        if (monthsCharged > 0 && monthsCharged < 12) {
          unitPrice = round2(diff * (monthsCharged / 12));
          isProRated = true;
        } else {
          unitPrice = diff;
          isProRated = false;
        }
      } else {
        // MONTHLY: charge the diff once for the next billing period
        unitPrice = diff;
        monthsCharged = 1;
        isProRated = false;
      }

      const cycleLabel = cycle === "MONTHLY" ? "monthly" : "yearly";
      const proLabel = isProRated ? `, ${monthsCharged}-month pro-rata` : "";
      lineItems.push({
        moduleCode: u.moduleCode,
        currentTier: ms.tier,
        newTier: u.newTier,
        cycle,
        currentPrice,
        newPrice,
        diff,
        monthsCharged,
        isProRated,
        unitPrice,
        description: `${u.moduleCode} module — upgrade ${ms.tier} → ${u.newTier} (${cycleLabel}${proLabel})`,
        cycleEnd: ms.cycleEnd,
      });

      // Add to quote line requests for bundle discount (using the NEW tier)
      quoteLineRequests.push({
        moduleCode: u.moduleCode as "GRC" | "TPRM" | "INTERNAL_AUDIT",
        tier: u.newTier as "BASIC" | "MEDIUM" | "PRO",
      });
    }

    const subtotal = round2(lineItems.reduce((s, li) => s + li.unitPrice, 0));

    // Apply bundle discount to upgrade subtotal
    const best = await getBestBundleDiscount(quoteLineRequests, dominantCycle, subtotal, now);
    const discountAmount = best ? best.amount : 0;
    const taxableAmount = round2(subtotal - discountAmount);
    const taxAmount = round2(taxableAmount * (DEFAULT_TAX_RATE / 100));
    const total = round2(taxableAmount + taxAmount);

    return NextResponse.json({
      data: {
        lineItems,
        subtotal,
        bundleDiscount: best
          ? {
              id: best.rule.id,
              name: best.rule.name,
              amount: discountAmount,
              discountType: best.rule.discountType as "PERCENTAGE" | "FIXED",
              discountValue: Number(best.rule.discountValue),
            }
          : null,
        taxableAmount,
        taxRate: DEFAULT_TAX_RATE,
        taxAmount,
        total,
        currency: DEFAULT_CURRENCY,
      },
    });
  },
  { resource: "subscription.customer-portal", action: "view" }
);

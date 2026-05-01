/**
 * Super-admin subscription list — GET /api/grc/subscriptions
 *
 * Returns all customer subscriptions with rolled-up status, modules+tiers,
 * MRR, and "next renewal" (earliest cycleEnd). Supports query filters:
 *   ?status=ACTIVE,EXPIRING_SOON
 *   ?cycle=MONTHLY|YEARLY
 *   ?module=GRC|TPRM|INTERNAL_AUDIT
 *   ?tier=BASIC|MEDIUM|PRO
 *   ?type=PAID|TRIAL|COMPLIMENTARY
 *   ?search=acme
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { computeSubscriptionStatus } from "@/lib/subscription-status";

// Convert any module's contribution to MRR (monthly recurring revenue).
// MONTHLY cycle → full unitPrice. YEARLY cycle → unitPrice / 12.
// Cancelled or expired modules contribute 0.
function moduleToMrr(m: { billingCycle: string; unitPrice: unknown; cancelledAt: Date | null; cycleEnd: Date }, now: Date): number {
  if (m.cancelledAt) return 0;
  if (m.cycleEnd <= now) return 0;
  const price = Number(m.unitPrice);
  return m.billingCycle === "MONTHLY" ? price : price / 12;
}

export const GET = withAuth(
  async (req: NextRequest) => {
    const url = new URL(req.url);
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const cycleFilter = url.searchParams.get("cycle");      // MONTHLY|YEARLY
    const moduleFilter = url.searchParams.get("module");    // GRC|TPRM|INTERNAL_AUDIT
    const tierFilter = url.searchParams.get("tier");        // BASIC|MEDIUM|PRO
    const typeFilter = url.searchParams.get("type");        // PAID|TRIAL|COMPLIMENTARY
    const statusFilter = (url.searchParams.get("status") || "").split(",").filter(Boolean);

    const subscriptions = await prisma.subscription.findMany({
      include: {
        customerAccount: { select: { id: true, code: true, name: true } },
        modules: {
          select: {
            id: true, moduleCode: true, tier: true, billingCycle: true,
            unitPrice: true, cycleStart: true, cycleEnd: true, cancelledAt: true,
          },
        },
      },
    });

    const now = new Date();
    const rows = subscriptions.map((s) => {
      const status = computeSubscriptionStatus({
        subscriptionType: s.subscriptionType,
        trialEndsAt: s.trialEndsAt,
        modules: s.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
        now,
      });

      const mrr = s.subscriptionType === "PAID"
        ? s.modules.reduce((sum, m) => sum + moduleToMrr(m, now), 0)
        : 0;

      // earliest cycleEnd among non-cancelled, non-expired modules
      const futureEnds = s.modules
        .filter((m) => !m.cancelledAt && m.cycleEnd > now)
        .map((m) => m.cycleEnd);
      const nextRenewal = futureEnds.length > 0
        ? new Date(Math.min(...futureEnds.map((d) => d.getTime())))
        : null;

      return {
        subscriptionId: s.id,
        customerAccountId: s.customerAccountId,
        customerCode: s.customerAccount.code,
        customerName: s.customerAccount.name,
        subscriptionType: s.subscriptionType,
        status,
        autoRenew: s.autoRenew,
        trialEndsAt: s.trialEndsAt,
        modules: s.modules.map((m) => ({
          moduleCode: m.moduleCode,
          tier: m.tier,
          billingCycle: m.billingCycle,
          unitPrice: Number(m.unitPrice),
          cycleEnd: m.cycleEnd,
          cancelledAt: m.cancelledAt,
        })),
        mrr: Math.round(mrr),
        arr: Math.round(mrr * 12),
        nextRenewal,
        notes: s.notes,
      };
    });

    // Apply filters in memory (subscription set is small — every customer)
    const filtered = rows.filter((r) => {
      if (search && !`${r.customerCode} ${r.customerName}`.toLowerCase().includes(search)) return false;
      if (typeFilter && r.subscriptionType !== typeFilter) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false;
      if (cycleFilter && !r.modules.some((m) => m.billingCycle === cycleFilter)) return false;
      if (moduleFilter && !r.modules.some((m) => m.moduleCode === moduleFilter)) return false;
      if (tierFilter && !r.modules.some((m) => m.tier === tierFilter)) return false;
      return true;
    });

    // Sort: most-urgent status first (SUSPENDED → ACTIVE), then by next renewal asc
    const STATUS_ORDER: Record<string, number> = {
      SUSPENDED: 0, GRACE_PERIOD: 1, EXPIRED: 2, EXPIRING_SOON: 3,
      CANCELLED: 4, TRIAL: 5, ACTIVE: 6,
    };
    filtered.sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 99;
      const sb = STATUS_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      const ta = a.nextRenewal?.getTime() ?? Infinity;
      const tb = b.nextRenewal?.getTime() ?? Infinity;
      return ta - tb;
    });

    return NextResponse.json({ data: filtered });
  },
  { resource: "subscription.list", action: "view" }
);

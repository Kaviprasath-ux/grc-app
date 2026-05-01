/**
 * Super-admin subscription drill-in.
 *
 *   GET   /api/grc/subscriptions/[id]   → full subscription detail
 *   PATCH /api/grc/subscriptions/[id]   → update top-level fields:
 *           subscriptionType (PAID|TRIAL|COMPLIMENTARY)
 *           autoRenew, notes
 *
 *  Granting/revoking complimentary access is just a PATCH with
 *  subscriptionType=COMPLIMENTARY (or back to PAID). The status engine
 *  short-circuits to ACTIVE for COMPLIMENTARY so the customer sees a free
 *  plan without needing fake cycleEnds.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { computeSubscriptionStatus, computeModuleStatus } from "@/lib/subscription-status";
import { z } from "zod";

const PatchSchema = z.object({
  subscriptionType: z.enum(["PAID", "TRIAL", "COMPLIMENTARY"]).optional(),
  autoRenew: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
});

interface RouteContext { params: Promise<{ id: string }>; }

export const GET = withAuth(
  async (_req, context: RouteContext) => {
    const { id } = await context.params;
    const sub = await prisma.subscription.findUnique({
      where: { id },
      include: {
        customerAccount: {
          select: { id: true, code: true, name: true, isGrcAdded: true, isTprmAdded: true, isInternalAuditEnabled: true },
        },
        modules: { orderBy: { moduleCode: "asc" } },
        invoices: { orderBy: { issueDate: "desc" }, take: 50 },
        payments: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    const customerLite = sub.customerAccount;

    const now = new Date();
    const status = computeSubscriptionStatus({
      subscriptionType: sub.subscriptionType,
      trialEndsAt: sub.trialEndsAt,
      modules: sub.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
      now,
    });

    return NextResponse.json({
      data: {
        id: sub.id,
        customerAccount: customerLite,
        subscriptionType: sub.subscriptionType,
        status,
        autoRenew: sub.autoRenew,
        trialEndsAt: sub.trialEndsAt,
        gstin: sub.gstin,
        notes: sub.notes,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
        modules: sub.modules.map((m) => ({
          id: m.id,
          moduleCode: m.moduleCode,
          tier: m.tier,
          billingCycle: m.billingCycle,
          unitPrice: Number(m.unitPrice),
          userLimit: m.userLimit,
          vendorLimit: m.vendorLimit,
          assessmentLimit: m.assessmentLimit,
          frameworkLimit: m.frameworkLimit,
          auditLimit: m.auditLimit,
          cycleStart: m.cycleStart,
          cycleEnd: m.cycleEnd,
          cancelledAt: m.cancelledAt,
          previousTier: m.previousTier,
          tierChangedAt: m.tierChangedAt,
          status: computeModuleStatus({
            subscriptionType: sub.subscriptionType,
            trialEndsAt: sub.trialEndsAt,
            cycleEnd: m.cycleEnd,
            cancelledAt: m.cancelledAt,
            now,
          }),
        })),
        invoices: sub.invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          issueDate: inv.issueDate,
          periodStart: inv.periodStart,
          periodEnd: inv.periodEnd,
          subtotal: Number(inv.subtotal),
          discountAmount: Number(inv.discountAmount),
          taxAmount: Number(inv.taxAmount),
          total: Number(inv.total),
          status: inv.status,
        })),
        payments: sub.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          provider: p.provider,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
          providerPaymentId: p.providerPaymentId,
        })),
      },
    });
  },
  { resource: "subscription.detail", action: "view" }
);

export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    const { id } = await context.params;

    let body: unknown;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.subscription.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.trialEndsAt !== undefined) {
      data.trialEndsAt = parsed.data.trialEndsAt ? new Date(parsed.data.trialEndsAt) : null;
    }

    // Audit-log Complimentary grant/revoke transitions in notes (append-only).
    if (parsed.data.subscriptionType && parsed.data.subscriptionType !== existing.subscriptionType) {
      const stamp = new Date().toISOString();
      const transition = `[${stamp}] ${session.email || session.id}: ${existing.subscriptionType} → ${parsed.data.subscriptionType}`;
      const newNotes = parsed.data.notes !== undefined
        ? parsed.data.notes ?? ""
        : (existing.notes ? `${existing.notes}\n${transition}` : transition);
      data.notes = newNotes;
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        subscriptionType: updated.subscriptionType,
        autoRenew: updated.autoRenew,
        trialEndsAt: updated.trialEndsAt,
        notes: updated.notes,
        updatedAt: updated.updatedAt,
      },
    });
  },
  { resource: "subscription.detail", action: "edit" }
);

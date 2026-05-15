/**
 * Idempotent helper: ensures a customer has an active COMPLIMENTARY
 * Subscription envelope + a COMPLIMENTARY ModuleSubscription row for each
 * currently-enabled module flag.
 *
 * Used by:
 *   - POST /api/grc/customer-accounts/onboard  -> on customer create
 *   - PUT  /api/grc/customer-accounts/[id]     -> when toggling a module on
 *
 * Behaviour:
 *   1. Subscription envelope: created if missing; flipped to COMPLIMENTARY
 *      with autoRenew=false if it exists in another state.
 *   2. ModuleSubscription per requested module:
 *        - missing            -> created as COMPLIMENTARY, cycleEnd 10y out
 *        - exists, cancelled  -> un-cancelled and refreshed to COMPLIMENTARY
 *        - exists, active     -> left alone (no-op)
 *   3. Legacy SubscriptionPlan re-synced via syncSubscriptionPlan() so the
 *      16 V1 enforcement files see UNLIMITED_LEGACY_VALUE on every limit
 *      (per the COMPLIMENTARY branch in subscription-plan-sync.ts).
 *
 * Modules NOT in the requested list are NOT cancelled or removed — the flag
 * itself (isGrcAdded etc. on CustomerAccount) is the visibility gate.
 */

import prisma from "@/lib/prisma";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";

export type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE";

function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + n);
  return r;
}

export async function ensureComplimentarySubscription(
  customerAccountId: string,
  enabledModules: ModuleCode[],
): Promise<{ subscriptionId: string; ensured: ModuleCode[] }> {
  const now = new Date();
  const farFuture = addYears(now, 10);

  // 1. Envelope: create or upgrade-to-COMPLIMENTARY
  let sub = await prisma.subscription.findUnique({
    where: { customerAccountId },
  });
  if (!sub) {
    sub = await prisma.subscription.create({
      data: {
        customerAccountId,
        status: "ACTIVE",
        subscriptionType: "COMPLIMENTARY",
        autoRenew: false,
        notes: `[${now.toISOString()}] Auto-provisioned COMPLIMENTARY (super-admin)`,
      },
    });
  } else if (sub.subscriptionType !== "COMPLIMENTARY") {
    sub = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        subscriptionType: "COMPLIMENTARY",
        autoRenew: false,
        notes: sub.notes
          ? `${sub.notes}\n[${now.toISOString()}] Switched to COMPLIMENTARY (super-admin)`
          : `[${now.toISOString()}] Switched to COMPLIMENTARY (super-admin)`,
      },
    });
  }

  // 2. Per-module: ensure each enabled module has an active COMPLIMENTARY row
  const ensured: ModuleCode[] = [];
  for (const moduleCode of enabledModules) {
    const existing = await prisma.moduleSubscription.findUnique({
      where: { subscriptionId_moduleCode: { subscriptionId: sub.id, moduleCode } },
    });

    if (!existing) {
      await prisma.moduleSubscription.create({
        data: {
          subscriptionId: sub.id,
          moduleCode,
          tier: "BASIC", // legacy column placeholder
          billingCycle: "YEARLY",
          unitPrice: 0,
          userLimit: 999_999,
          vendorLimit: 999_999,
          assessmentLimit: 999_999,
          frameworkLimit: 999_999,
          auditLimit: 999_999,
          cycleStart: now,
          cycleEnd: farFuture,
          planType: "COMPLIMENTARY",
        },
      });
      ensured.push(moduleCode);
    } else if (
      existing.cancelledAt !== null ||
      existing.planType !== "COMPLIMENTARY"
    ) {
      // Un-cancel + flip to COMPLIMENTARY
      await prisma.moduleSubscription.update({
        where: { id: existing.id },
        data: {
          planType: "COMPLIMENTARY",
          nextPlanType: null,
          baseStartDate: null,
          baseEndDate: null,
          contractStartDate: null,
          contractEndDate: null,
          generalBillingCycle: null,
          generalStartDate: null,
          mandateId: null,
          mandateStatus: null,
          cancellationRequestedAt: null,
          cancelledAt: null,
          cycleEnd: farFuture,
        },
      });
      ensured.push(moduleCode);
    }
  }

  // 3. Re-sync legacy SubscriptionPlan rows for everything we just touched
  const allModules = await prisma.moduleSubscription.findMany({
    where: { subscriptionId: sub.id, moduleCode: { in: enabledModules } },
    select: { id: true },
  });
  for (const m of allModules) {
    try {
      await syncSubscriptionPlan(m.id);
    } catch (e) {
      console.warn(`[ensureComplimentary] sync failed for ${m.id}:`, (e as Error).message);
    }
  }

  return { subscriptionId: sub.id, ensured };
}

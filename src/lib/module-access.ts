/**
 * Module access derivation from Subscription state.
 *
 * `getActiveModules(customerAccountId)` returns the set of modules the customer
 * can currently access — derived from their Subscription + ModuleSubscription
 * rows and the computed status. SUSPENDED modules are excluded.
 *
 * This is the source-of-truth helper used by auth.ts (when
 * SUBSCRIPTION_GATING_ENABLED=true) to override the legacy CustomerAccount
 * boolean flags. When the feature flag is off, the legacy flags drive access
 * unchanged; this helper is dormant.
 */

import prisma from "@/lib/prisma";
import type { SubscriptionStatus, SubscriptionType } from "@prisma/client";
import {
  computeModuleStatus,
  computeSubscriptionStatus,
  isAccessAllowed,
} from "@/lib/subscription-status";

export type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE";

/**
 * Returns the set of modules the customer currently has access to.
 *
 * - If the customer has no Subscription row, returns an empty set.
 * - SUSPENDED modules (8+ days post-expiry) are excluded.
 * - GRACE_PERIOD modules ARE included here (read-only enforcement happens
 *   separately via isWriteAllowed() at the API layer).
 * - COMPLIMENTARY subscriptions always have all their modules accessible.
 */
export async function getActiveModules(customerAccountId: string): Promise<Set<ModuleCode>> {
  const subscription = await prisma.subscription.findUnique({
    where: { customerAccountId },
    include: {
      modules: {
        select: { moduleCode: true, cycleEnd: true, cancelledAt: true },
      },
    },
  });

  if (!subscription) return new Set();

  const active = new Set<ModuleCode>();
  for (const m of subscription.modules) {
    const status = computeModuleStatus({
      subscriptionType: subscription.subscriptionType,
      trialEndsAt: subscription.trialEndsAt,
      cycleEnd: m.cycleEnd,
      cancelledAt: m.cancelledAt,
    });
    if (isAccessAllowed(status)) {
      active.add(m.moduleCode as ModuleCode);
    }
  }
  return active;
}

/**
 * Convenience: return the three legacy CustomerAccount module flags derived
 * from current subscription state. Used by auth.ts to override the raw DB
 * flags when SUBSCRIPTION_GATING_ENABLED=true.
 */
export async function getActiveModuleFlags(customerAccountId: string): Promise<{
  isGrcAdded: boolean;
  isTprmAdded: boolean;
  isInternalAuditEnabled: boolean;
  isTechnicalEvidenceEnabled: boolean;
}> {
  const active = await getActiveModules(customerAccountId);
  return {
    isGrcAdded: active.has("GRC"),
    isTprmAdded: active.has("TPRM"),
    isInternalAuditEnabled: active.has("INTERNAL_AUDIT"),
    isTechnicalEvidenceEnabled: active.has("TECHNICAL_EVIDENCE"),
  };
}

/**
 * Snapshot for the JWT/session: module flags + rolled-up subscription status +
 * subscription type. Used by auth.ts to populate session.user so middleware
 * (which can't query the DB) can gate routes on subscription state.
 *
 * Single DB read, suitable for the auth callback path.
 */
export async function getAccessSnapshot(customerAccountId: string): Promise<{
  isGrcAdded: boolean;
  isTprmAdded: boolean;
  isInternalAuditEnabled: boolean;
  isTechnicalEvidenceEnabled: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionType: SubscriptionType | null;
}> {
  const subscription = await prisma.subscription.findUnique({
    where: { customerAccountId },
    include: {
      modules: { select: { moduleCode: true, cycleEnd: true, cancelledAt: true } },
    },
  });

  if (!subscription) {
    return {
      isGrcAdded: false, isTprmAdded: false, isInternalAuditEnabled: false, isTechnicalEvidenceEnabled: false,
      subscriptionStatus: null, subscriptionType: null,
    };
  }

  const status = computeSubscriptionStatus({
    subscriptionType: subscription.subscriptionType,
    trialEndsAt: subscription.trialEndsAt,
    modules: subscription.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
  });

  const active = new Set<ModuleCode>();
  for (const m of subscription.modules) {
    const ms = computeModuleStatus({
      subscriptionType: subscription.subscriptionType,
      trialEndsAt: subscription.trialEndsAt,
      cycleEnd: m.cycleEnd,
      cancelledAt: m.cancelledAt,
    });
    if (isAccessAllowed(ms)) active.add(m.moduleCode as ModuleCode);
  }

  return {
    isGrcAdded: active.has("GRC"),
    isTprmAdded: active.has("TPRM"),
    isInternalAuditEnabled: active.has("INTERNAL_AUDIT"),
    isTechnicalEvidenceEnabled: active.has("TECHNICAL_EVIDENCE"),
    subscriptionStatus: status,
    subscriptionType: subscription.subscriptionType,
  };
}

/**
 * Subscription status engine — pure functions, no DB calls, fully unit-testable.
 *
 * Maps a (subscription, module subscription, now) tuple to one of the
 * SubscriptionStatus enum values used everywhere in the app:
 *
 *   TRIAL          — subscriptionType=TRIAL with trialEndsAt in the future
 *   ACTIVE         — cycleEnd > now + EXPIRING_SOON_DAYS (or COMPLIMENTARY)
 *   EXPIRING_SOON  — 0 < daysToExpiry ≤ EXPIRING_SOON_DAYS
 *   EXPIRED        — first day post-cycleEnd (daysSinceExpiry < 1)
 *   GRACE_PERIOD   — 1 ≤ daysSinceExpiry ≤ GRACE_PERIOD_DAYS  (read-only)
 *   SUSPENDED      — daysSinceExpiry > GRACE_PERIOD_DAYS       (locked out)
 *   CANCELLED      — cancelledAt set AND cycleEnd still in future
 *
 * COMPLIMENTARY (subscriptionType, not a SubscriptionStatus) is normalised to
 * ACTIVE for status purposes — UI checks subscriptionType separately to render
 * the "Complimentary plan" badge.
 */

import type { SubscriptionStatus, SubscriptionType, PlanTier, BillingCycle } from "@prisma/client";

export const EXPIRING_SOON_DAYS = 30;
export const GRACE_PERIOD_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Severity ranking — higher is more urgent. Used for rolling up multiple module
 * statuses to a single "what should the top banner say?" subscription status.
 */
const STATUS_SEVERITY: Record<SubscriptionStatus, number> = {
  ACTIVE: 0,
  TRIAL: 1,
  CANCELLED: 2,
  EXPIRING_SOON: 3,
  EXPIRED: 4,
  GRACE_PERIOD: 5,
  SUSPENDED: 6,
};

export interface ModuleStatusInput {
  subscriptionType: SubscriptionType;
  trialEndsAt?: Date | null;
  cycleEnd: Date;
  cancelledAt?: Date | null;
  /** Override for testing. Defaults to new Date(). */
  now?: Date;
}

/**
 * Compute the status of a single ModuleSubscription.
 */
export function computeModuleStatus(input: ModuleStatusInput): SubscriptionStatus {
  const now = input.now ?? new Date();

  // Complimentary subscriptions are always ACTIVE-equivalent regardless of cycleEnd.
  if (input.subscriptionType === "COMPLIMENTARY") return "ACTIVE";

  // Active trial — overrides expiry calculations.
  if (input.subscriptionType === "TRIAL" && input.trialEndsAt && input.trialEndsAt > now) {
    return "TRIAL";
  }

  // Cancelled but still within paid period → CANCELLED (functional until cycleEnd).
  if (input.cancelledAt && input.cycleEnd > now) {
    return "CANCELLED";
  }

  // Standard expiry calculations
  const daysToExpiry = (input.cycleEnd.getTime() - now.getTime()) / MS_PER_DAY;

  if (daysToExpiry > EXPIRING_SOON_DAYS) return "ACTIVE";
  if (daysToExpiry > 0) return "EXPIRING_SOON";

  // Past cycleEnd
  const daysSinceExpiry = -daysToExpiry;
  if (daysSinceExpiry < 1) return "EXPIRED";          // first 24 hours after expiry
  if (daysSinceExpiry <= GRACE_PERIOD_DAYS) return "GRACE_PERIOD";
  return "SUSPENDED";
}

export interface SubscriptionStatusInput {
  subscriptionType: SubscriptionType;
  trialEndsAt?: Date | null;
  modules: Array<{ cycleEnd: Date; cancelledAt?: Date | null }>;
  now?: Date;
}

/**
 * Roll up the statuses of all modules into a single subscription-level status.
 * Returns the most severe status across modules (e.g., one expired module on
 * an otherwise active subscription rolls up to EXPIRED).
 */
export function computeSubscriptionStatus(input: SubscriptionStatusInput): SubscriptionStatus {
  if (input.subscriptionType === "COMPLIMENTARY") return "ACTIVE";

  const now = input.now ?? new Date();
  if (input.subscriptionType === "TRIAL" && input.trialEndsAt && input.trialEndsAt > now) {
    return "TRIAL";
  }

  if (input.modules.length === 0) return "SUSPENDED";

  let worst: SubscriptionStatus = "ACTIVE";
  for (const m of input.modules) {
    const s = computeModuleStatus({
      subscriptionType: input.subscriptionType,
      trialEndsAt: input.trialEndsAt,
      cycleEnd: m.cycleEnd,
      cancelledAt: m.cancelledAt ?? null,
      now,
    });
    if (STATUS_SEVERITY[s] > STATUS_SEVERITY[worst]) {
      worst = s;
    }
  }
  return worst;
}

/**
 * Convenience: how many days until a module expires (negative if already past).
 * Returns floor for positive values, ceil for negative — i.e., "day 0" only on
 * the actual cycleEnd day.
 */
export function daysUntilExpiry(cycleEnd: Date, now: Date = new Date()): number {
  const diff = (cycleEnd.getTime() - now.getTime()) / MS_PER_DAY;
  return diff >= 0 ? Math.floor(diff) : Math.ceil(diff);
}

/**
 * Determines whether the customer should be allowed write operations on a module.
 * GRACE_PERIOD = read-only. SUSPENDED = no access. Everything else = full.
 */
export function isWriteAllowed(status: SubscriptionStatus): boolean {
  return status !== "GRACE_PERIOD" && status !== "SUSPENDED";
}

/**
 * Determines whether the customer should be allowed any access to a module.
 * Only SUSPENDED locks out completely.
 */
export function isAccessAllowed(status: SubscriptionStatus): boolean {
  return status !== "SUSPENDED";
}

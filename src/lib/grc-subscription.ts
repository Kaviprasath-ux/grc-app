/**
 * GRC subscription limit checks — parallel to src/lib/tprm-subscription.ts.
 *
 *   checkGrcUserLimit       — caps GRC seats (users with a GRC role on this customer)
 *   checkFrameworkLimit     — caps subscribed compliance frameworks
 *
 * Reads limits from ModuleSubscription (tier-driven, override-aware), so
 * customers on Pro tier or with an elevated CustomerPlanOverride get their
 * proper cap. Subscriptions in SUSPENDED status block at the gate.
 *
 * NOTE: these helpers exist as of Step 9 but are NOT yet wired into create
 * APIs — that wiring lives in Phase 1D so we can surface "limit reached"
 * UI cleanly. They can be called manually today for testing or read-only
 * reporting via the customer billing portal (Step 16).
 */

import prisma from "@/lib/prisma";
import { computeModuleStatus, isAccessAllowed } from "@/lib/subscription-status";

export interface LimitCheckResult {
  allowed: boolean;
  message?: string;
  current?: number;
  limit?: number;
}

/**
 * Roles that consume a GRC seat. Mirrors the modules a user can actually access:
 * Customer admin (cross-module) + GRC-specific roles. System roles excluded.
 */
const GRC_COUNTED_ROLES = [
  "CustomerAdministrator",
  "Reviewer",
  "Contributor",
  "DepartmentReviewer",
  "DepartmentContributor",
];

async function getActiveGrcModule(customerAccountId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { customerAccountId },
    include: {
      modules: { where: { moduleCode: "GRC" } },
    },
  });
  if (!subscription || subscription.modules.length === 0) return null;
  const ms = subscription.modules[0];
  const status = computeModuleStatus({
    subscriptionType: subscription.subscriptionType,
    trialEndsAt: subscription.trialEndsAt,
    cycleEnd: ms.cycleEnd,
    cancelledAt: ms.cancelledAt,
  });
  if (!isAccessAllowed(status)) return null;
  return ms;
}

/**
 * Check whether the customer can add another GRC user.
 * Counts users on this customer who have at least one of the GRC_COUNTED_ROLES.
 */
export async function checkGrcUserLimit(customerAccountId: string): Promise<LimitCheckResult> {
  const ms = await getActiveGrcModule(customerAccountId);
  if (!ms) {
    return { allowed: false, message: "No active GRC subscription found." };
  }

  const currentCount = await prisma.user.count({
    where: {
      customerAccountId,
      userRoles: {
        some: { role: { name: { in: GRC_COUNTED_ROLES } } },
      },
    },
  });

  if (currentCount >= ms.userLimit) {
    return {
      allowed: false,
      message: `GRC user limit reached. Your subscription allows ${ms.userLimit} users; ${currentCount} already exist.`,
      current: currentCount,
      limit: ms.userLimit,
    };
  }
  return { allowed: true, current: currentCount, limit: ms.userLimit };
}

/**
 * Check whether the customer can subscribe to another compliance framework.
 * Counts Framework records linked to the customer.
 *
 * Returns allowed=true when the GRC tier is Pro (frameworkLimit=null = unlimited).
 */
export async function checkFrameworkLimit(customerAccountId: string): Promise<LimitCheckResult> {
  const ms = await getActiveGrcModule(customerAccountId);
  if (!ms) {
    return { allowed: false, message: "No active GRC subscription found." };
  }

  // Unlimited tier — frameworkLimit stored as null
  if (ms.frameworkLimit === null) {
    const currentCount = await prisma.framework.count({ where: { customerAccountId } });
    return { allowed: true, current: currentCount, limit: Number.POSITIVE_INFINITY };
  }

  const currentCount = await prisma.framework.count({ where: { customerAccountId } });

  if (currentCount >= ms.frameworkLimit) {
    return {
      allowed: false,
      message: `Framework limit reached. Your subscription allows ${ms.frameworkLimit} frameworks; ${currentCount} already exist.`,
      current: currentCount,
      limit: ms.frameworkLimit,
    };
  }
  return { allowed: true, current: currentCount, limit: ms.frameworkLimit };
}

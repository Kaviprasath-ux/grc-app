/**
 * Internal Audit subscription limit checks — parallel to grc-subscription.ts
 * and tprm-subscription.ts.
 *
 *   checkInternalAuditUserLimit  — caps IA seats
 *   checkAuditProjectLimit       — caps active AuditEngagement records (audit projects per cycle)
 *
 * Reads limits from ModuleSubscription (tier-driven, override-aware).
 * NOT yet wired into create APIs — Phase 1D will hook these in.
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
 * Roles that consume an Internal Audit seat. Customer admin (cross-module) +
 * IA-specific roles. System roles excluded.
 */
const IA_COUNTED_ROLES = [
  "CustomerAdministrator",
  "AuditHead",
  "AuditUser",
  "Auditor",
  "Auditee",
];

async function getActiveIaModule(customerAccountId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { customerAccountId },
    include: {
      modules: { where: { moduleCode: "INTERNAL_AUDIT" } },
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
 * Check whether the customer can add another Internal Audit user.
 */
export async function checkInternalAuditUserLimit(customerAccountId: string): Promise<LimitCheckResult> {
  const ms = await getActiveIaModule(customerAccountId);
  if (!ms) {
    return { allowed: false, message: "No active Internal Audit subscription found." };
  }

  const currentCount = await prisma.user.count({
    where: {
      customerAccountId,
      userRoles: {
        some: { role: { name: { in: IA_COUNTED_ROLES } } },
      },
    },
  });

  if (currentCount >= ms.userLimit) {
    return {
      allowed: false,
      message: `Internal Audit user limit reached. Your subscription allows ${ms.userLimit} users; ${currentCount} already exist.`,
      current: currentCount,
      limit: ms.userLimit,
    };
  }
  return { allowed: true, current: currentCount, limit: ms.userLimit };
}

/**
 * Check whether the customer can create another audit project (AuditEngagement).
 *
 * Counts engagements created in the current subscription cycle (cycleStart..cycleEnd).
 * Returns allowed=true when the IA tier is Pro (auditLimit=null = unlimited).
 */
export async function checkAuditProjectLimit(customerAccountId: string): Promise<LimitCheckResult> {
  const ms = await getActiveIaModule(customerAccountId);
  if (!ms) {
    return { allowed: false, message: "No active Internal Audit subscription found." };
  }

  // Unlimited tier — auditLimit stored as null
  if (ms.auditLimit === null) {
    const currentCount = await prisma.auditEngagement.count({
      where: { customerAccountId, createdAt: { gte: ms.cycleStart, lte: ms.cycleEnd } },
    });
    return { allowed: true, current: currentCount, limit: Number.POSITIVE_INFINITY };
  }

  const currentCount = await prisma.auditEngagement.count({
    where: { customerAccountId, createdAt: { gte: ms.cycleStart, lte: ms.cycleEnd } },
  });

  if (currentCount >= ms.auditLimit) {
    return {
      allowed: false,
      message: `Audit project limit reached. Your subscription allows ${ms.auditLimit} audits per cycle; ${currentCount} already created.`,
      current: currentCount,
      limit: ms.auditLimit,
    };
  }
  return { allowed: true, current: currentCount, limit: ms.auditLimit };
}

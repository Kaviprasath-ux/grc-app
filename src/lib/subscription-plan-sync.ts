/**
 * Write-through helper that bridges the new module-based subscription system
 * (Subscription / ModuleSubscription) back to the legacy SubscriptionPlan table.
 *
 * Why this exists
 *   The 16 files that read SubscriptionPlan today (tprm-subscription.ts,
 *   framework subscribe checks, etc.) keep working unchanged. Whenever a
 *   ModuleSubscription is created, upgraded, or cancelled, call
 *   syncSubscriptionPlan(moduleSubscriptionId) to upsert the corresponding
 *   SubscriptionPlan row.
 *
 * Identity rule
 *   One SubscriptionPlan row per (customerAccountId, moduleCode) is upserted.
 *   Legacy rows (moduleCode IS NULL) are intentionally left in place — they
 *   continue to enforce limits until they expire naturally (their existing
 *   expiryDate). After expiry, the new module-coded rows take over.
 *
 * Limit mapping
 *   ModuleSubscription   →  SubscriptionPlan
 *   ─────────────────────────────────────────
 *   userLimit            →  maxAccountsAllowed
 *   frameworkLimit       →  maxFrameworksAllowed   (null = unlimited → UNLIMITED_VALUE)
 *   vendorLimit          →  vendorLimit            (null = unlimited → UNLIMITED_VALUE)
 *   assessmentLimit      →  assessmentLimit        (null = unlimited → UNLIMITED_VALUE)
 *   auditLimit           →  (no legacy column)
 *
 *   Limit fields not applicable to a module (e.g. vendorLimit on a GRC plan)
 *   are set to 0, which is naturally a no-op since the customer also has a
 *   different module-coded row that supplies the real cap.
 *
 * Counters (frameworksUsed, accountsUsed) are NOT touched on update — they
 * are managed by the existing API routes that increment/decrement them on
 * create/delete events. On insert we initialize them to 0.
 */

import prisma from "@/lib/prisma";

/**
 * Sentinel used in legacy SubscriptionPlan int columns to represent "unlimited"
 * (since those columns are non-nullable Int @default(0)). Large enough that no
 * real customer will hit it; small enough to avoid 32-bit overflow concerns.
 */
export const UNLIMITED_LEGACY_VALUE = 999_999;

export interface SyncResult {
  action: "created" | "updated" | "skipped-missing";
  subscriptionPlanId?: string;
  moduleCode?: string;
}

/**
 * Sync one ModuleSubscription to the legacy SubscriptionPlan table.
 * Idempotent: re-running with the same input is safe.
 *
 * V2 awareness: when ms.planType is set (V2), per-limit unlimited flags are
 * read live from ModulePlanPricing. COMPLIMENTARY rows always sync as
 * fully-unlimited.
 */
export async function syncSubscriptionPlan(moduleSubscriptionId: string): Promise<SyncResult> {
  const ms = await prisma.moduleSubscription.findUnique({
    where: { id: moduleSubscriptionId },
    include: { subscription: { select: { customerAccountId: true } } },
  });

  if (!ms) {
    return { action: "skipped-missing" };
  }

  const customerAccountId = ms.subscription.customerAccountId;
  const isCancelled = ms.cancelledAt !== null;
  const moduleCode = ms.moduleCode;

  // V2 unlimited-flag lookup. For V1 rows (planType=null) all flags stay false,
  // preserving existing "null limit = unlimited" semantics for non-user limits.
  let unlimitedUsers = false;
  let unlimitedFrameworks = false;
  let unlimitedVendors = false;
  let unlimitedAssessments = false;

  if (ms.planType === "COMPLIMENTARY") {
    unlimitedUsers = unlimitedFrameworks = unlimitedVendors = unlimitedAssessments = true;
  } else if (ms.planType === "BASE" || ms.planType === "GENERAL") {
    const pricing = await prisma.modulePlanPricing.findUnique({
      where: { moduleCode_planType: { moduleCode, planType: ms.planType } },
    });
    if (pricing) {
      unlimitedUsers = pricing.unlimitedUsers;
      unlimitedFrameworks = pricing.unlimitedFrameworks;
      unlimitedVendors = pricing.unlimitedVendors;
      unlimitedAssessments = pricing.unlimitedAssessments;
    }
  }

  const data = {
    customerAccountId,
    moduleCode,
    tier: ms.tier,
    startDate: ms.cycleStart,
    expiryDate: ms.cycleEnd,
    maxAccountsAllowed: unlimitedUsers ? UNLIMITED_LEGACY_VALUE : ms.userLimit,
    maxFrameworksAllowed:
      moduleCode === "GRC"
        ? (unlimitedFrameworks || ms.frameworkLimit === null
            ? UNLIMITED_LEGACY_VALUE
            : ms.frameworkLimit)
        : 0,
    vendorLimit:
      moduleCode === "TPRM"
        ? (unlimitedVendors || ms.vendorLimit === null
            ? UNLIMITED_LEGACY_VALUE
            : (ms.vendorLimit ?? 0))
        : 0,
    assessmentLimit:
      moduleCode === "TPRM"
        ? (unlimitedAssessments || ms.assessmentLimit === null
            ? UNLIMITED_LEGACY_VALUE
            : (ms.assessmentLimit ?? 0))
        : 0,
    status: isCancelled ? "Inactive" : "Active",
  };

  const existing = await prisma.subscriptionPlan.findFirst({
    where: { customerAccountId, moduleCode },
    select: { id: true },
  });

  if (existing) {
    await prisma.subscriptionPlan.update({
      where: { id: existing.id },
      data, // counters (frameworksUsed, accountsUsed) intentionally not touched
    });
    return { action: "updated", subscriptionPlanId: existing.id, moduleCode };
  }

  const created = await prisma.subscriptionPlan.create({
    data: {
      ...data,
      frameworksUsed: 0,
      accountsUsed: 0,
    },
  });
  return { action: "created", subscriptionPlanId: created.id, moduleCode };
}

/**
 * Sync every ModuleSubscription belonging to a Subscription envelope.
 * Useful when applying a bulk change (e.g., status transition).
 */
export async function syncAllModulesForSubscription(subscriptionId: string): Promise<SyncResult[]> {
  const modules = await prisma.moduleSubscription.findMany({
    where: { subscriptionId },
    select: { id: true },
  });
  const results: SyncResult[] = [];
  for (const m of modules) {
    results.push(await syncSubscriptionPlan(m.id));
  }
  return results;
}

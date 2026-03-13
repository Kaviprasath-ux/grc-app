/**
 * TPRM Subscription Plan limit validation.
 *
 * Customer Admin limits:
 *  - maxAccountsAllowed  → TPRM users with roles: Approver, Assessor, Auditor,
 *                          BusinessOwner, InternalITTeam, RelationshipManager.
 *                          Excludes Account Manager, SME, and Factory Assessor.
 *  - vendorLimit         → TPRMVendor records (all statuses).
 *                          Monitoring-only vendors (TPRMMonitoringVendor without
 *                          an onboarded TPRMVendor link) are NOT counted.
 *  - assessmentLimit     → TPRMAssessment (non-offboard, non-factory) + TPRMMonitoringAssessment.
 *                          Offboard assessments (status starting with "Offboard_") excluded.
 *                          Assessment Factory assessments excluded.
 *
 * Factory Admin limits:
 *  - maxAccountsAllowed  → Factory Assessor users only.
 *  - assessmentLimit     → Assessment Factory assessments only.
 */

import prisma from "@/lib/prisma";

// Roles that count towards the customer maxAccountsAllowed limit
const COUNTED_TPRM_ROLES = [
  "Approver",
  "Assessor",
  "Auditor",
  "BusinessOwner",
  "InternalITTeam",
  "RelationshipManager",
];

interface ActivePlanLimits {
  maxAccounts: number;
  vendorLimit: number;
  assessmentLimit: number;
}

/**
 * Sum limits across all active (non-expired) subscription plans for a customer.
 */
async function getActivePlanLimits(customerAccountId: string): Promise<ActivePlanLimits | null> {
  const now = new Date();
  const plans = await prisma.subscriptionPlan.findMany({
    where: {
      customerAccountId,
      status: "Active",
      startDate: { lte: now },
      expiryDate: { gte: now },
    },
    select: {
      maxAccountsAllowed: true,
      assessmentLimit: true,
      vendorLimit: true,
    },
  });

  if (plans.length === 0) return null;

  return {
    maxAccounts: plans.reduce((sum, p) => sum + p.maxAccountsAllowed, 0),
    vendorLimit: plans.reduce((sum, p) => sum + p.vendorLimit, 0),
    assessmentLimit: plans.reduce((sum, p) => sum + p.assessmentLimit, 0),
  };
}

// ─── Public check helpers ──────────────────────────────────────

export interface LimitCheckResult {
  allowed: boolean;
  message?: string;
  current?: number;
  limit?: number;
}

/**
 * Check whether the customer can add another TPRM user.
 */
export async function checkUserLimit(customerAccountId: string): Promise<LimitCheckResult> {
  const limits = await getActivePlanLimits(customerAccountId);
  if (!limits) return { allowed: false, message: "No active subscription plan found. Please contact your administrator." };

  const currentCount = await prisma.user.count({
    where: {
      customerAccountId,
      tprmRole: { in: COUNTED_TPRM_ROLES },
    },
  });

  if (currentCount >= limits.maxAccounts) {
    return {
      allowed: false,
      message: `User limit reached. Your subscription allows a maximum of ${limits.maxAccounts} TPRM users. Currently ${currentCount} users exist.`,
      current: currentCount,
      limit: limits.maxAccounts,
    };
  }

  return { allowed: true, current: currentCount, limit: limits.maxAccounts };
}

/**
 * Check whether the customer can onboard another vendor.
 */
export async function checkVendorLimit(customerAccountId: string): Promise<LimitCheckResult> {
  const limits = await getActivePlanLimits(customerAccountId);
  if (!limits) return { allowed: false, message: "No active subscription plan found. Please contact your administrator." };

  const currentCount = await prisma.tPRMVendor.count({
    where: { customerAccountId },
  });

  if (currentCount >= limits.vendorLimit) {
    return {
      allowed: false,
      message: `Vendor limit reached. Your subscription allows a maximum of ${limits.vendorLimit} vendors. Currently ${currentCount} vendors exist.`,
      current: currentCount,
      limit: limits.vendorLimit,
    };
  }

  return { allowed: true, current: currentCount, limit: limits.vendorLimit };
}

/**
 * Check whether the customer can create another assessment.
 * Counts: regular TPRM assessments (non-offboard) + monitoring assessments.
 */
export async function checkAssessmentLimit(customerAccountId: string): Promise<LimitCheckResult> {
  const limits = await getActivePlanLimits(customerAccountId);
  if (!limits) return { allowed: false, message: "No active subscription plan found. Please contact your administrator." };

  // Count regular assessments excluding offboard and factory ones
  const regularCount = await prisma.tPRMAssessment.count({
    where: {
      customerAccountId,
      NOT: { status: { startsWith: "Offboard" } },
      assessmentType: { not: "Assessment Factory" },
    },
  });

  // Count monitoring assessments
  const monitoringCount = await prisma.tPRMMonitoringAssessment.count({
    where: { customerAccountId },
  });

  const total = regularCount + monitoringCount;

  if (total >= limits.assessmentLimit) {
    return {
      allowed: false,
      message: `Assessment limit reached. Your subscription allows a maximum of ${limits.assessmentLimit} assessments. Currently ${total} assessments exist (${regularCount} vendor + ${monitoringCount} monitoring).`,
      current: total,
      limit: limits.assessmentLimit,
    };
  }

  return { allowed: true, current: total, limit: limits.assessmentLimit };
}

// ─── Factory-specific check helpers ────────────────────────────

/**
 * Check whether the factory admin can add another Factory Assessor user.
 * Counts only users with tprmRole = "Factory Assessor".
 */
export async function checkFactoryUserLimit(customerAccountId: string): Promise<LimitCheckResult> {
  const limits = await getActivePlanLimits(customerAccountId);
  if (!limits) return { allowed: false, message: "No active subscription plan found. Please contact your administrator." };

  const currentCount = await prisma.user.count({
    where: {
      customerAccountId,
      tprmRole: "Factory Assessor",
    },
  });

  if (currentCount >= limits.maxAccounts) {
    return {
      allowed: false,
      message: `Factory Assessor limit reached. Your subscription allows a maximum of ${limits.maxAccounts} Factory Assessors. Currently ${currentCount} exist.`,
      current: currentCount,
      limit: limits.maxAccounts,
    };
  }

  return { allowed: true, current: currentCount, limit: limits.maxAccounts };
}

/**
 * Check whether the factory admin can create another Assessment Factory assessment.
 * Counts only TPRMAssessment records with assessmentType = "Assessment Factory".
 */
export async function checkFactoryAssessmentLimit(customerAccountId: string): Promise<LimitCheckResult> {
  const limits = await getActivePlanLimits(customerAccountId);
  if (!limits) return { allowed: false, message: "No active subscription plan found. Please contact your administrator." };

  const currentCount = await prisma.tPRMAssessment.count({
    where: {
      customerAccountId,
      assessmentType: "Assessment Factory",
    },
  });

  if (currentCount >= limits.assessmentLimit) {
    return {
      allowed: false,
      message: `Assessment Factory limit reached. Your subscription allows a maximum of ${limits.assessmentLimit} factory assessments. Currently ${currentCount} exist.`,
      current: currentCount,
      limit: limits.assessmentLimit,
    };
  }

  return { allowed: true, current: currentCount, limit: limits.assessmentLimit };
}

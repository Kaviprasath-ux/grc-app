/**
 * Razorpay Plan Manager
 *
 * Manages pre-created Razorpay plans for subscription creation.
 * Plans are stored in RazorpayPlan table and created in Razorpay on demand.
 *
 * Pricing is fetched from ModulePlanPricing table (admin-configurable):
 *   Year 1 BASE plan: from ModulePlanPricing where planType = 'BASE'
 *   Year 2+ GENERAL plan: from ModulePlanPricing where planType = 'GENERAL'
 */

import prisma from "@/lib/prisma";
import { isStubMode } from "@/lib/payment-provider";

// Razorpay SDK types
interface RazorpayPlanEntity {
  id: string;
  entity: "plan";
  interval: number;
  period: "daily" | "weekly" | "monthly" | "yearly";
  item: {
    id: string;
    name: string;
    amount: number;
    currency: string;
  };
  notes: Record<string, string>;
  created_at: number;
}

interface RazorpayInstance {
  plans: {
    create: (options: RazorpayPlanCreateOptions) => Promise<RazorpayPlanEntity>;
    fetch: (planId: string) => Promise<RazorpayPlanEntity>;
  };
}

interface RazorpayPlanCreateOptions {
  period: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  item: {
    name: string;
    amount: number; // in paise
    currency: string;
    description?: string;
  };
  notes?: Record<string, string>;
}

// Default pricing constants (fallback if database not seeded)
// These should match the values in scripts/seed-module-plan-pricing.ts
export const BASE_YEARLY_PRICE = 1200; // ₹100/month × 12 = ₹1,200/year
export const GENERAL_MONTHLY_PRICE = 15000; // ₹15,000/month
export const GENERAL_YEARLY_PRICE = 180000; // ₹15,000 × 12 = ₹180,000/year

// Full 2-year contract price per module (Year 1 + Year 2)
export const TWO_YEAR_TOTAL_PRICE = BASE_YEARLY_PRICE + GENERAL_YEARLY_PRICE; // ₹1,200 + ₹180,000 = ₹181,200

const MODULE_NAMES: Record<string, string> = {
  GRC: "Verifai GRC",
  TPRM: "Verifai TPRM",
  INTERNAL_AUDIT: "Verifai Internal Audit",
  TECHNICAL_EVIDENCE: "Verifai Technical Evidence",
};

let razorpayInstance: RazorpayInstance | null = null;

function getRazorpayClient(): RazorpayInstance {
  if (razorpayInstance) return razorpayInstance;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay credentials not configured. Either set PAYMENT_STUB=true for development, or provide RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require("razorpay");
  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpayInstance!;
}

/**
 * Get the Year 1 BASE price for a module (used for Day 14 charge).
 */
export async function getYear1PriceFromDb(moduleCode: string): Promise<number> {
  const basePricing = await prisma.modulePlanPricing.findFirst({
    where: { moduleCode, planType: "BASE", isActive: true },
  });

  return basePricing ? Number(basePricing.yearlyPrice) : BASE_YEARLY_PRICE;
}

/**
 * Get the monthly GENERAL price for a module (used for Year 2+ monthly billing).
 */
export async function getMonthlyPriceFromDb(moduleCode: string): Promise<number> {
  const generalPricing = await prisma.modulePlanPricing.findFirst({
    where: { moduleCode, planType: "GENERAL", isActive: true },
  });

  if (generalPricing?.monthlyPrice) {
    return Number(generalPricing.monthlyPrice);
  }

  return generalPricing ? Math.round(Number(generalPricing.yearlyPrice) / 12) : GENERAL_MONTHLY_PRICE;
}

/**
 * Get the full 2-year contract price for a module (Year 1 BASE + Year 2 GENERAL).
 * @deprecated Use getYear1PriceFromDb for initial charge, then monthly billing
 */
export async function getTwoYearPriceFromDb(moduleCode: string): Promise<number> {
  const basePricing = await prisma.modulePlanPricing.findFirst({
    where: { moduleCode, planType: "BASE", isActive: true },
  });
  const generalPricing = await prisma.modulePlanPricing.findFirst({
    where: { moduleCode, planType: "GENERAL", isActive: true },
  });

  const basePrice = basePricing ? Number(basePricing.yearlyPrice) : BASE_YEARLY_PRICE;
  const generalPrice = generalPricing ? Number(generalPricing.yearlyPrice) : GENERAL_YEARLY_PRICE;

  return basePrice + generalPrice;
}

/**
 * Get price in INR for a specific plan configuration from database.
 * Falls back to constants if not found.
 */
export async function getPlanPriceFromDb(
  moduleCode: string,
  planType: "BASE" | "GENERAL",
  billingCycle: "MONTHLY" | "YEARLY"
): Promise<number> {
  const pricing = await prisma.modulePlanPricing.findFirst({
    where: {
      moduleCode,
      planType,
      isActive: true,
    },
  });

  if (pricing) {
    if (billingCycle === "MONTHLY" && pricing.monthlyPrice) {
      return Number(pricing.monthlyPrice);
    }
    return Number(pricing.yearlyPrice);
  }

  // Fallback to defaults
  if (planType === "BASE") {
    return BASE_YEARLY_PRICE;
  }
  return billingCycle === "MONTHLY" ? GENERAL_MONTHLY_PRICE : GENERAL_YEARLY_PRICE;
}

/**
 * Get price in INR for a specific plan configuration (sync version for backward compat).
 */
export function getPlanPrice(
  planType: "BASE" | "GENERAL",
  billingCycle: "MONTHLY" | "YEARLY"
): number {
  if (planType === "BASE") {
    return BASE_YEARLY_PRICE;
  }
  return billingCycle === "MONTHLY" ? GENERAL_MONTHLY_PRICE : GENERAL_YEARLY_PRICE;
}

/**
 * Get or create a Razorpay plan for Year 1 (BASE plan).
 * This is a one-time charge plan (total_count=1) for Year 1 only.
 * After Year 1, a separate monthly subscription will be created.
 */
export async function getOrCreateYear1Plan(moduleCode: string): Promise<string> {
  const planType = "YEAR1";
  const billingCycle = "YEARLY";

  // Check if plan exists in database
  const existingPlan = await prisma.razorpayPlan.findFirst({
    where: {
      moduleCode,
      planType,
      billingCycle,
      isActive: true,
    },
  });

  if (existingPlan) {
    return existingPlan.razorpayPlanId;
  }

  // Get Year 1 price from database
  const amount = await getYear1PriceFromDb(moduleCode);
  const moduleName = MODULE_NAMES[moduleCode] || moduleCode;
  const planName = `${moduleName} - Year 1 (BASE)`;

  // Stub mode: return a fake plan ID
  if (isStubMode()) {
    const stubPlanId = `STUB-PLAN-${moduleCode}-YEAR1`;

    await prisma.razorpayPlan.create({
      data: {
        razorpayPlanId: stubPlanId,
        moduleCode,
        planType,
        billingCycle,
        amount,
        currency: "INR",
        isActive: true,
      },
    });

    return stubPlanId;
  }

  // Create plan in Razorpay (one-time yearly charge)
  const razorpay = getRazorpayClient();

  let razorpayPlan;
  try {
    razorpayPlan = await razorpay.plans.create({
      period: "yearly",
      interval: 1,
      item: {
        name: planName,
        amount: amount * 100, // Convert to paise
        currency: "INR",
        description: `${moduleName} - Year 1 Promotional Rate (BASE plan)`,
      },
      notes: {
        moduleCode,
        planType: "YEAR1",
        year1Price: String(amount),
      },
    });
  } catch (err) {
    const error = err as { statusCode?: number; error?: { description?: string }; message?: string };
    console.error("[RazorpayPlanManager] Failed to create Year 1 plan:", error);
    throw new Error(
      `Razorpay Year 1 plan creation failed: ${error.error?.description || error.message || "Unknown error"}`
    );
  }

  // Store in database
  await prisma.razorpayPlan.create({
    data: {
      razorpayPlanId: razorpayPlan.id,
      moduleCode,
      planType,
      billingCycle,
      amount,
      currency: "INR",
      isActive: true,
    },
  });

  console.log(`[RazorpayPlanManager] Created Year 1 plan: ${razorpayPlan.id} (${planName}) - ₹${amount}`);

  return razorpayPlan.id;
}

/**
 * Get or create a Razorpay plan for Year 2+ monthly billing (GENERAL plan).
 * This is used after Year 1 ends to start monthly recurring charges.
 */
export async function getOrCreateMonthlyPlan(moduleCode: string): Promise<string> {
  const planType = "MONTHLY";
  const billingCycle = "MONTHLY";

  // Check if plan exists in database
  const existingPlan = await prisma.razorpayPlan.findFirst({
    where: {
      moduleCode,
      planType,
      billingCycle,
      isActive: true,
    },
  });

  if (existingPlan) {
    return existingPlan.razorpayPlanId;
  }

  // Get monthly price from database
  const amount = await getMonthlyPriceFromDb(moduleCode);
  const moduleName = MODULE_NAMES[moduleCode] || moduleCode;
  const planName = `${moduleName} - Monthly (GENERAL)`;

  // Stub mode: return a fake plan ID
  if (isStubMode()) {
    const stubPlanId = `STUB-PLAN-${moduleCode}-MONTHLY`;

    await prisma.razorpayPlan.create({
      data: {
        razorpayPlanId: stubPlanId,
        moduleCode,
        planType,
        billingCycle,
        amount,
        currency: "INR",
        isActive: true,
      },
    });

    return stubPlanId;
  }

  // Create plan in Razorpay (monthly recurring)
  const razorpay = getRazorpayClient();

  let razorpayPlan;
  try {
    razorpayPlan = await razorpay.plans.create({
      period: "monthly",
      interval: 1,
      item: {
        name: planName,
        amount: amount * 100, // Convert to paise
        currency: "INR",
        description: `${moduleName} - Monthly Standard Rate (GENERAL plan)`,
      },
      notes: {
        moduleCode,
        planType: "MONTHLY",
        monthlyPrice: String(amount),
      },
    });
  } catch (err) {
    const error = err as { statusCode?: number; error?: { description?: string }; message?: string };
    console.error("[RazorpayPlanManager] Failed to create monthly plan:", error);
    throw new Error(
      `Razorpay monthly plan creation failed: ${error.error?.description || error.message || "Unknown error"}`
    );
  }

  // Store in database
  await prisma.razorpayPlan.create({
    data: {
      razorpayPlanId: razorpayPlan.id,
      moduleCode,
      planType,
      billingCycle,
      amount,
      currency: "INR",
      isActive: true,
    },
  });

  console.log(`[RazorpayPlanManager] Created monthly plan: ${razorpayPlan.id} (${planName}) - ₹${amount}/mo`);

  return razorpayPlan.id;
}

/**
 * Get or create a Razorpay plan for the full 2-year contract.
 * @deprecated Use getOrCreateYear1Plan for initial charge, then getOrCreateMonthlyPlan after Year 1
 */
export async function getOrCreate2YearPlan(moduleCode: string): Promise<string> {
  const planType = "2YEAR";
  const billingCycle = "ONETIME";

  // Check if plan exists in database
  const existingPlan = await prisma.razorpayPlan.findFirst({
    where: {
      moduleCode,
      planType,
      billingCycle,
      isActive: true,
    },
  });

  if (existingPlan) {
    return existingPlan.razorpayPlanId;
  }

  // Get 2-year total price from database
  const amount = await getTwoYearPriceFromDb(moduleCode);
  const moduleName = MODULE_NAMES[moduleCode] || moduleCode;
  const planName = `${moduleName} - 2-Year Contract`;

  // Stub mode: return a fake plan ID
  if (isStubMode()) {
    const stubPlanId = `STUB-PLAN-${moduleCode}-2YEAR`;

    await prisma.razorpayPlan.create({
      data: {
        razorpayPlanId: stubPlanId,
        moduleCode,
        planType,
        billingCycle,
        amount,
        currency: "INR",
        isActive: true,
      },
    });

    return stubPlanId;
  }

  // Create plan in Razorpay (one-time charge, period=yearly with interval=2)
  const razorpay = getRazorpayClient();

  let razorpayPlan;
  try {
    razorpayPlan = await razorpay.plans.create({
      period: "yearly",
      interval: 2, // 2-year period
      item: {
        name: planName,
        amount: amount * 100, // Convert to paise
        currency: "INR",
        description: `${moduleName} - Full 2-Year Subscription (Year 1 + Year 2)`,
      },
      notes: {
        moduleCode,
        planType: "2YEAR",
        year1Price: String(BASE_YEARLY_PRICE),
        year2Price: String(GENERAL_YEARLY_PRICE),
      },
    });
  } catch (err) {
    const error = err as { statusCode?: number; error?: { description?: string }; message?: string };
    console.error("[RazorpayPlanManager] Failed to create 2-year plan:", error);
    throw new Error(
      `Razorpay 2-year plan creation failed: ${error.error?.description || error.message || "Unknown error"}`
    );
  }

  // Store in database
  await prisma.razorpayPlan.create({
    data: {
      razorpayPlanId: razorpayPlan.id,
      moduleCode,
      planType,
      billingCycle,
      amount,
      currency: "INR",
      isActive: true,
    },
  });

  console.log(`[RazorpayPlanManager] Created 2-year plan: ${razorpayPlan.id} (${planName}) - ₹${amount}`);

  return razorpayPlan.id;
}

/**
 * Get or create a Razorpay plan for the given configuration.
 *
 * @param moduleCode - GRC, TPRM, or INTERNAL_AUDIT
 * @param planType - BASE or GENERAL
 * @param billingCycle - MONTHLY or YEARLY (BASE is always YEARLY)
 * @returns razorpayPlanId for subscription creation
 */
export async function getOrCreatePlan(
  moduleCode: string,
  planType: "BASE" | "GENERAL",
  billingCycle: "MONTHLY" | "YEARLY"
): Promise<string> {
  // BASE plan is always yearly
  const effectiveCycle = planType === "BASE" ? "YEARLY" : billingCycle;

  // Check if plan exists in database
  const existingPlan = await prisma.razorpayPlan.findUnique({
    where: {
      moduleCode_planType_billingCycle: {
        moduleCode,
        planType,
        billingCycle: effectiveCycle,
      },
    },
  });

  if (existingPlan && existingPlan.isActive) {
    return existingPlan.razorpayPlanId;
  }

  // Stub mode: return a fake plan ID
  if (isStubMode()) {
    const stubPlanId = `STUB-PLAN-${moduleCode}-${planType}-${effectiveCycle}`;
    const amount = await getPlanPriceFromDb(moduleCode, planType, effectiveCycle as "MONTHLY" | "YEARLY");

    // Create/update local record
    await prisma.razorpayPlan.upsert({
      where: {
        moduleCode_planType_billingCycle: {
          moduleCode,
          planType,
          billingCycle: effectiveCycle,
        },
      },
      update: {
        razorpayPlanId: stubPlanId,
        isActive: true,
      },
      create: {
        razorpayPlanId: stubPlanId,
        moduleCode,
        planType,
        billingCycle: effectiveCycle,
        amount,
        currency: "INR",
        isActive: true,
      },
    });

    return stubPlanId;
  }

  // Create plan in Razorpay - fetch price from database
  const amount = await getPlanPriceFromDb(moduleCode, planType, effectiveCycle as "MONTHLY" | "YEARLY");
  const moduleName = MODULE_NAMES[moduleCode] || moduleCode;
  const planName = `${moduleName} - ${planType} ${effectiveCycle === "YEARLY" ? "Annual" : "Monthly"}`;

  const razorpay = getRazorpayClient();

  let razorpayPlan;
  try {
    razorpayPlan = await razorpay.plans.create({
      period: effectiveCycle === "YEARLY" ? "yearly" : "monthly",
      interval: 1,
      item: {
        name: planName,
        amount: amount * 100, // Convert to paise
        currency: "INR",
        description: `${moduleName} - ${planType === "BASE" ? "Year 1 Promotional" : "Standard"} Plan`,
      },
      notes: {
        moduleCode,
        planType,
        billingCycle: effectiveCycle,
      },
    });
  } catch (err) {
    const error = err as { statusCode?: number; error?: { description?: string }; message?: string };
    console.error("[RazorpayPlanManager] Failed to create plan:", {
      statusCode: error.statusCode,
      error: error.error,
      message: error.message,
    });
    throw new Error(
      `Razorpay plan creation failed: ${error.error?.description || error.message || "Unknown error"}. ` +
      `Check your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET credentials.`
    );
  }

  // Store in database
  await prisma.razorpayPlan.upsert({
    where: {
      moduleCode_planType_billingCycle: {
        moduleCode,
        planType,
        billingCycle: effectiveCycle,
      },
    },
    update: {
      razorpayPlanId: razorpayPlan.id,
      isActive: true,
    },
    create: {
      razorpayPlanId: razorpayPlan.id,
      moduleCode,
      planType,
      billingCycle: effectiveCycle,
      amount,
      currency: "INR",
      isActive: true,
    },
  });

  console.log(`[RazorpayPlanManager] Created plan: ${razorpayPlan.id} (${planName})`);

  return razorpayPlan.id;
}

/**
 * Verify a plan still exists and is active in Razorpay.
 */
export async function verifyPlan(razorpayPlanId: string): Promise<boolean> {
  if (isStubMode()) {
    return razorpayPlanId.startsWith("STUB-PLAN-");
  }

  try {
    const razorpay = getRazorpayClient();
    await razorpay.plans.fetch(razorpayPlanId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deactivate a plan (marks as inactive in our DB, doesn't delete from Razorpay).
 */
export async function deactivatePlan(
  moduleCode: string,
  planType: string,
  billingCycle: string
): Promise<void> {
  await prisma.razorpayPlan.updateMany({
    where: {
      moduleCode,
      planType,
      billingCycle,
    },
    data: {
      isActive: false,
    },
  });
}

/**
 * List all plans in our database.
 */
export async function listPlans(): Promise<
  Array<{
    moduleCode: string;
    planType: string;
    billingCycle: string;
    razorpayPlanId: string;
    amount: number;
    isActive: boolean;
  }>
> {
  const plans = await prisma.razorpayPlan.findMany({
    orderBy: [{ moduleCode: "asc" }, { planType: "asc" }, { billingCycle: "asc" }],
  });

  return plans.map((p) => ({
    moduleCode: p.moduleCode,
    planType: p.planType,
    billingCycle: p.billingCycle,
    razorpayPlanId: p.razorpayPlanId,
    amount: Number(p.amount),
    isActive: p.isActive,
  }));
}

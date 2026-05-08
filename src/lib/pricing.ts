/**
 * Pricing engine — single source of truth for any quote in the app.
 *
 * Every renew, add-module, upgrade, public-pricing, and invoice flow calls
 * computeQuote(). Do not duplicate price math anywhere else.
 *
 * Resolution order for each line:
 *   1. CustomerPlanOverride (per-customer special pricing)  ← if active & in date range
 *   2. ModuleTierPricing    (standard catalog)
 *
 * Then the subtotal is reduced by the best-matching active BundleDiscount,
 * and 18% GST is added to produce the final total.
 *
 * Pro-rating (mid-cycle add-module):
 *   - YEARLY cycle: charge `yearlyPrice * monthsRemaining / 12`
 *   - MONTHLY cycle: charge full `monthlyPrice` (no pro-rata)
 *   Months are computed at month boundaries (no per-day arithmetic).
 */

import prisma from "@/lib/prisma";
import type {
  PlanTier,
  PlanType,
  BillingCycle,
  ModuleTierPricing,
  ModulePlanPricing,
  BundleDiscount,
  CustomerPlanOverride,
} from "@prisma/client";

export type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";

export const DEFAULT_TAX_RATE = 18;     // GST %
export const DEFAULT_CURRENCY = "INR";

const TIER_RANK: Record<PlanTier, number> = { BASIC: 0, MEDIUM: 1, PRO: 2 };

// ─── Types ─────────────────────────────────────────────────────────

export interface QuoteLineRequest {
  moduleCode: ModuleCode;
  tier: PlanTier;
}

export interface QuoteLineItem extends QuoteLineRequest {
  description: string;
  fullCyclePrice: number;     // standard or override price for the full cycle (mo or yr)
  unitPrice: number;          // after pro-rata adjustment
  monthsCharged: number;      // 12 for full yearly, N for pro-rata yearly, 1 for monthly
  isProRated: boolean;
  priceSource: "STANDARD" | "OVERRIDE";
}

export interface ComputeQuoteInput {
  /** Optional — when omitted, public/standard pricing is used (no override resolution). */
  customerAccountId?: string;
  lines: QuoteLineRequest[];
  cycle: BillingCycle;
  /** When set, pro-rate to monthly granularity until this date. */
  anchorEndDate?: Date;
  /** Override for testing (defaults to today). */
  now?: Date;
  /** Override default 18% GST (e.g., for a non-Indian customer). */
  taxRatePercent?: number;
}

export interface QuoteResult {
  cycle: BillingCycle;
  currency: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  bundleDiscount: {
    id: string;
    name: string;
    amount: number;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
  } | null;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

// ─── Pure helpers (used by computeQuote and exported for callers) ─

/**
 * Whole-month difference between two dates. Returns 0 if `to` is before `from`.
 * Used for pro-rata: we don't bother with day-level granularity.
 */
export function wholeMonthsBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  const years = to.getUTCFullYear() - from.getUTCFullYear();
  const months = to.getUTCMonth() - from.getUTCMonth();
  let total = years * 12 + months;
  // If `to`'s day-of-month is earlier than `from`'s, the last month isn't full.
  if (to.getUTCDate() < from.getUTCDate()) total -= 1;
  return Math.max(0, total);
}

/**
 * Round a decimal to 2 places using bankers' rounding-free arithmetic
 * (avoids float drift like 1.005 → 1.00 in JS).
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function meetsMinTier(lines: QuoteLineRequest[], minTier: PlanTier | null | undefined): boolean {
  if (!minTier) return true;
  const minRank = TIER_RANK[minTier];
  return lines.every(l => TIER_RANK[l.tier] >= minRank);
}

function isDiscountValidNow(d: BundleDiscount, now: Date): boolean {
  if (!d.isActive) return false;
  if (d.validFrom && d.validFrom > now) return false;
  if (d.validUntil && d.validUntil < now) return false;
  return true;
}

function discountApplies(
  d: BundleDiscount,
  lines: QuoteLineRequest[],
  cycle: BillingCycle,
  now: Date,
): boolean {
  if (!isDiscountValidNow(d, now)) return false;
  if (d.appliesToCycle && d.appliesToCycle !== cycle) return false;
  if (lines.length < d.minModules) return false;
  if (!meetsMinTier(lines, d.minTier)) return false;
  return true;
}

function computeDiscountAmount(d: BundleDiscount, subtotal: number): number {
  const value = Number(d.discountValue);
  if (d.discountType === "PERCENTAGE") return round2(subtotal * (value / 100));
  return round2(Math.min(value, subtotal)); // FIXED never exceeds subtotal
}

// ─── DB-backed resolvers ───────────────────────────────────────────

export async function getModuleTierPricing(moduleCode: ModuleCode, tier: PlanTier): Promise<ModuleTierPricing> {
  const row = await prisma.moduleTierPricing.findUnique({
    where: { moduleCode_tier: { moduleCode, tier } },
  });
  if (!row) {
    throw new Error(`No pricing configured for ${moduleCode} ${tier} — run seed-subscription-catalog`);
  }
  if (!row.isActive) {
    throw new Error(`Pricing for ${moduleCode} ${tier} is inactive`);
  }
  return row;
}

export async function getCustomerOverride(
  customerAccountId: string,
  moduleCode: ModuleCode,
  now: Date = new Date(),
): Promise<CustomerPlanOverride | null> {
  const override = await prisma.customerPlanOverride.findUnique({
    where: { customerAccountId_moduleCode: { customerAccountId, moduleCode } },
  });
  if (!override || !override.isActive) return null;
  if (override.validFrom > now) return null;
  if (override.validUntil && override.validUntil < now) return null;
  return override;
}

/**
 * Resolve the unit price for one (module, tier, cycle) for a specific customer
 * (or the public catalog if no customerAccountId provided).
 *
 * Returns the FULL-CYCLE price (monthly or yearly), before any pro-rata or discount.
 */
export async function getModulePrice(
  moduleCode: ModuleCode,
  tier: PlanTier,
  cycle: BillingCycle,
  customerAccountId?: string,
  now: Date = new Date(),
): Promise<{ price: number; source: "STANDARD" | "OVERRIDE" }> {
  if (customerAccountId) {
    const override = await getCustomerOverride(customerAccountId, moduleCode, now);
    if (override) {
      const overridden = cycle === "MONTHLY" ? override.monthlyPrice : override.yearlyPrice;
      if (overridden !== null) {
        return { price: Number(overridden), source: "OVERRIDE" };
      }
      // Override row exists but doesn't override price for this cycle → fall through to standard
    }
  }
  const standard = await getModuleTierPricing(moduleCode, tier);
  const price = cycle === "MONTHLY" ? Number(standard.monthlyPrice) : Number(standard.yearlyPrice);
  return { price, source: "STANDARD" };
}

/**
 * Pick the active BundleDiscount that produces the largest discount for this
 * subtotal, or null if none applies. "Largest" is customer-friendly tie-breaker.
 */
export async function getBestBundleDiscount(
  lines: QuoteLineRequest[],
  cycle: BillingCycle,
  subtotal: number,
  now: Date = new Date(),
): Promise<{ rule: BundleDiscount; amount: number } | null> {
  const candidates = await prisma.bundleDiscount.findMany({
    where: {
      isActive: true,
      OR: [{ appliesToCycle: null }, { appliesToCycle: cycle }],
    },
  });

  let best: { rule: BundleDiscount; amount: number } | null = null;
  for (const rule of candidates) {
    if (!discountApplies(rule, lines, cycle, now)) continue;
    const amount = computeDiscountAmount(rule, subtotal);
    if (amount <= 0) continue;
    if (!best || amount > best.amount) best = { rule, amount };
  }
  return best;
}

// ─── Main quote builder ────────────────────────────────────────────

export async function computeQuote(input: ComputeQuoteInput): Promise<QuoteResult> {
  const now = input.now ?? new Date();
  const taxRate = input.taxRatePercent ?? DEFAULT_TAX_RATE;

  if (input.lines.length === 0) {
    throw new Error("computeQuote requires at least one line");
  }

  // Pro-rata factor — only applicable for YEARLY cycle with anchorEndDate
  let monthsCharged = input.cycle === "MONTHLY" ? 1 : 12;
  let isProRated = false;
  if (input.cycle === "YEARLY" && input.anchorEndDate) {
    const months = wholeMonthsBetween(now, input.anchorEndDate);
    if (months > 0 && months < 12) {
      monthsCharged = months;
      isProRated = true;
    }
  }

  // Build line items
  const lineItems: QuoteLineItem[] = [];
  for (const req of input.lines) {
    const { price: fullCyclePrice, source } = await getModulePrice(
      req.moduleCode,
      req.tier,
      input.cycle,
      input.customerAccountId,
      now,
    );

    let unitPrice: number;
    if (input.cycle === "YEARLY" && isProRated) {
      unitPrice = round2(fullCyclePrice * (monthsCharged / 12));
    } else {
      unitPrice = round2(fullCyclePrice);
    }

    const cycleLabel = input.cycle === "MONTHLY" ? "Monthly" : "Yearly";
    const proLabel = isProRated ? `, ${monthsCharged}-month pro-rata` : "";
    lineItems.push({
      moduleCode: req.moduleCode,
      tier: req.tier,
      description: `${req.moduleCode} module — ${req.tier} (${cycleLabel}${proLabel})`,
      fullCyclePrice,
      unitPrice,
      monthsCharged,
      isProRated,
      priceSource: source,
    });
  }

  const subtotal = round2(lineItems.reduce((s, li) => s + li.unitPrice, 0));

  // Bundle discount
  const best = await getBestBundleDiscount(input.lines, input.cycle, subtotal, now);
  const discountAmount = best ? best.amount : 0;
  const taxableAmount = round2(subtotal - discountAmount);
  const taxAmount = round2(taxableAmount * (taxRate / 100));
  const total = round2(taxableAmount + taxAmount);

  return {
    cycle: input.cycle,
    currency: DEFAULT_CURRENCY,
    lineItems,
    subtotal,
    bundleDiscount: best
      ? {
          id: best.rule.id,
          name: best.rule.name,
          amount: discountAmount,
          discountType: best.rule.discountType as "PERCENTAGE" | "FIXED",
          discountValue: Number(best.rule.discountValue),
        }
      : null,
    taxableAmount,
    taxRate,
    taxAmount,
    total,
  };
}

// ─── V2 (BASE / GENERAL) quote engine ─────────────────────────────
// Active when SUBSCRIPTION_V2_ENABLED=true. Coexists with V1 above; V1 paths
// keep working until callers migrate. Differences from V1:
//   - No PlanTier dimension (super admin sets one limit set per planType×module)
//   - BASE always charges yearlyPrice (cycle arg ignored)
//   - GENERAL respects cycle (MONTHLY or YEARLY)
//   - BundleDiscount.minTier is ignored in V2 (no tiers)
//   - CustomerPlanOverride is keyed (customerAccountId, moduleCode) — same row
//     as V1; we just read the price columns

export interface QuoteLineRequestV2 {
  moduleCode: ModuleCode;
  planType: PlanType; // BASE | GENERAL (COMPLIMENTARY does not generate invoices)
}

export interface QuoteLineItemV2 extends QuoteLineRequestV2 {
  description: string;
  fullCyclePrice: number;
  unitPrice: number;
  monthsCharged: number;
  isProRated: boolean;
  priceSource: "STANDARD" | "OVERRIDE";
}

export interface ComputeQuoteV2Input {
  customerAccountId?: string;
  lines: QuoteLineRequestV2[];
  /** GENERAL respects this; BASE forces YEARLY internally. */
  cycle: BillingCycle;
  anchorEndDate?: Date;
  now?: Date;
  taxRatePercent?: number;
}

export interface QuoteResultV2 {
  cycle: BillingCycle;
  currency: string;
  lineItems: QuoteLineItemV2[];
  subtotal: number;
  bundleDiscount: {
    id: string;
    name: string;
    amount: number;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
  } | null;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export async function getModulePlanPricing(
  moduleCode: ModuleCode,
  planType: PlanType,
): Promise<ModulePlanPricing> {
  if (planType === "COMPLIMENTARY") {
    throw new Error("COMPLIMENTARY plans do not have pricing — bypass quoting");
  }
  const row = await prisma.modulePlanPricing.findUnique({
    where: { moduleCode_planType: { moduleCode, planType } },
  });
  if (!row) {
    throw new Error(`No V2 pricing configured for ${moduleCode} ${planType} — seed ModulePlanPricing`);
  }
  if (!row.isActive) {
    throw new Error(`V2 pricing for ${moduleCode} ${planType} is inactive`);
  }
  return row;
}

/**
 * V2 price resolver. BASE always uses yearlyPrice (1-year promo); GENERAL respects cycle.
 * Customer override (price columns) wins when present and active.
 */
export async function getModulePriceV2(
  moduleCode: ModuleCode,
  planType: PlanType,
  cycle: BillingCycle,
  customerAccountId?: string,
  now: Date = new Date(),
): Promise<{ price: number; effectiveCycle: BillingCycle; source: "STANDARD" | "OVERRIDE" }> {
  const effectiveCycle: BillingCycle = planType === "BASE" ? "YEARLY" : cycle;

  if (customerAccountId) {
    const override = await getCustomerOverride(customerAccountId, moduleCode, now);
    if (override) {
      const overridden = effectiveCycle === "MONTHLY" ? override.monthlyPrice : override.yearlyPrice;
      if (overridden !== null) {
        return { price: Number(overridden), effectiveCycle, source: "OVERRIDE" };
      }
    }
  }

  const standard = await getModulePlanPricing(moduleCode, planType);
  let price: number;
  if (effectiveCycle === "MONTHLY") {
    if (standard.monthlyPrice === null) {
      throw new Error(`${moduleCode} ${planType} has no monthlyPrice configured`);
    }
    price = Number(standard.monthlyPrice);
  } else {
    price = Number(standard.yearlyPrice);
  }
  return { price, effectiveCycle, source: "STANDARD" };
}

/**
 * V2 bundle discount resolver. Same engine as V1 but ignores minTier (V2 has no tiers).
 * Treats every active rule's tier check as satisfied.
 */
async function getBestBundleDiscountV2(
  lineCount: number,
  cycle: BillingCycle,
  subtotal: number,
  now: Date,
): Promise<{ rule: BundleDiscount; amount: number } | null> {
  const candidates = await prisma.bundleDiscount.findMany({
    where: {
      isActive: true,
      OR: [{ appliesToCycle: null }, { appliesToCycle: cycle }],
    },
  });

  let best: { rule: BundleDiscount; amount: number } | null = null;
  for (const rule of candidates) {
    if (!isDiscountValidNow(rule, now)) continue;
    if (rule.appliesToCycle && rule.appliesToCycle !== cycle) continue;
    if (lineCount < rule.minModules) continue;
    // V2: ignore rule.minTier
    const amount = computeDiscountAmount(rule, subtotal);
    if (amount <= 0) continue;
    if (!best || amount > best.amount) best = { rule, amount };
  }
  return best;
}

export async function computeQuoteV2(input: ComputeQuoteV2Input): Promise<QuoteResultV2> {
  if (input.lines.length === 0) {
    throw new Error("computeQuoteV2 requires at least one line");
  }

  const now = input.now ?? new Date();
  const taxRate = input.taxRatePercent ?? DEFAULT_TAX_RATE;

  // BASE forces yearly internally; GENERAL uses caller's cycle.
  // If the caller mixes BASE and GENERAL in one quote (rare — usually a flip
  // invoice charges only the new GENERAL line), we honour each line's own cycle.
  const lineItems: QuoteLineItemV2[] = [];
  for (const req of input.lines) {
    const { price: fullCyclePrice, effectiveCycle, source } = await getModulePriceV2(
      req.moduleCode,
      req.planType,
      input.cycle,
      input.customerAccountId,
      now,
    );

    let monthsCharged = effectiveCycle === "MONTHLY" ? 1 : 12;
    let isProRated = false;
    if (effectiveCycle === "YEARLY" && input.anchorEndDate) {
      const months = wholeMonthsBetween(now, input.anchorEndDate);
      if (months > 0 && months < 12) {
        monthsCharged = months;
        isProRated = true;
      }
    }

    const unitPrice =
      effectiveCycle === "YEARLY" && isProRated
        ? round2(fullCyclePrice * (monthsCharged / 12))
        : round2(fullCyclePrice);

    const cycleLabel = effectiveCycle === "MONTHLY" ? "Monthly" : "Yearly";
    const proLabel = isProRated ? `, ${monthsCharged}-month pro-rata` : "";
    lineItems.push({
      moduleCode: req.moduleCode,
      planType: req.planType,
      description: `${req.moduleCode} ${req.planType} (${cycleLabel}${proLabel})`,
      fullCyclePrice,
      unitPrice,
      monthsCharged,
      isProRated,
      priceSource: source,
    });
  }

  const subtotal = round2(lineItems.reduce((s, li) => s + li.unitPrice, 0));
  const best = await getBestBundleDiscountV2(input.lines.length, input.cycle, subtotal, now);
  const discountAmount = best ? best.amount : 0;
  const taxableAmount = round2(subtotal - discountAmount);
  const taxAmount = round2(taxableAmount * (taxRate / 100));
  const total = round2(taxableAmount + taxAmount);

  return {
    cycle: input.cycle,
    currency: DEFAULT_CURRENCY,
    lineItems,
    subtotal,
    bundleDiscount: best
      ? {
          id: best.rule.id,
          name: best.rule.name,
          amount: discountAmount,
          discountType: best.rule.discountType as "PERCENTAGE" | "FIXED",
          discountValue: Number(best.rule.discountValue),
        }
      : null,
    taxableAmount,
    taxRate,
    taxAmount,
    total,
  };
}

/**
 * Limit helpers — single resolver for "what's the effective cap for this field?"
 *
 * Each numeric limit on ModulePlanPricing pairs with an `unlimited<Field>` boolean.
 * When unlimited is true, the cap is conceptually Infinity (rendered as "Unlimited"
 * in UI; persisted to legacy SubscriptionPlan as UNLIMITED_LEGACY_VALUE).
 *
 * All V2 enforcement / display call sites must go through these helpers — never
 * read the *Limit column directly without first checking the unlimited flag.
 *
 * Pure functions, no DB calls.
 */

export type LimitField =
  | "users"
  | "frameworks"
  | "vendors"
  | "assessments"
  | "audits";

/**
 * Shape of the limit record on either ModulePlanPricing or ModuleSubscription
 * (for V2 — V1 ModuleSubscription rows lack the unlimited* booleans, in which
 * case `unlimited` is treated as false).
 */
export interface LimitBearer {
  userLimit?: number | null;
  unlimitedUsers?: boolean | null;
  frameworkLimit?: number | null;
  unlimitedFrameworks?: boolean | null;
  vendorLimit?: number | null;
  unlimitedVendors?: boolean | null;
  assessmentLimit?: number | null;
  unlimitedAssessments?: boolean | null;
  auditLimit?: number | null;
  unlimitedAudits?: boolean | null;
}

const FIELD_MAP: Record<LimitField, { count: keyof LimitBearer; flag: keyof LimitBearer }> = {
  users:       { count: "userLimit",       flag: "unlimitedUsers" },
  frameworks:  { count: "frameworkLimit",  flag: "unlimitedFrameworks" },
  vendors:     { count: "vendorLimit",     flag: "unlimitedVendors" },
  assessments: { count: "assessmentLimit", flag: "unlimitedAssessments" },
  audits:      { count: "auditLimit",      flag: "unlimitedAudits" },
};

/**
 * Returns Infinity when the unlimited flag is set, the numeric cap otherwise.
 * Returns 0 if the field is null/undefined (i.e., not configured for this module).
 */
export function effectiveLimit(bearer: LimitBearer, field: LimitField): number {
  const { count, flag } = FIELD_MAP[field];
  if (bearer[flag] === true) return Infinity;
  const raw = bearer[count];
  if (raw === null || raw === undefined) return 0;
  return raw as number;
}

/**
 * True if `currentCount` is below the effective cap.
 */
export function isWithinLimit(
  bearer: LimitBearer,
  field: LimitField,
  currentCount: number,
): boolean {
  return currentCount < effectiveLimit(bearer, field);
}

/**
 * UI-friendly display: "Unlimited" or "12" or "0".
 */
export function formatLimit(bearer: LimitBearer, field: LimitField): string {
  const v = effectiveLimit(bearer, field);
  return v === Infinity ? "Unlimited" : String(v);
}

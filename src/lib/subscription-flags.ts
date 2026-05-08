/**
 * Centralized feature flags for the subscription system.
 *
 * SUBSCRIPTION_GATING_ENABLED — V1 gating: separates Internal Audit from GRC.
 *   When true, audit.* resources are gated on isInternalAuditEnabled instead of
 *   isGrcAdded. (See src/lib/permissions.ts.)
 *
 * SUBSCRIPTION_V2_ENABLED — V2 plan model: BASE (Year 1 promo) → GENERAL
 *   (Year 2+, monthly or annual) with a 2-year contract lock-in. When false,
 *   V1 tier-based code paths (BASIC/MEDIUM/PRO) remain in use unchanged.
 *
 * Both flags default to false in production. UAT enables them first; Prod
 * follows after validation per the single-branch deploy pattern.
 */

export const SUBSCRIPTION_GATING_ENABLED =
  process.env.SUBSCRIPTION_GATING_ENABLED === "true";

export const SUBSCRIPTION_V2_ENABLED =
  process.env.SUBSCRIPTION_V2_ENABLED === "true";

/**
 * Legacy V1 upgrade page (BASIC -> MEDIUM -> PRO) — retired.
 *
 * V2 has no tiers — there's nothing to upgrade between. Limits are configured
 * by super-admin per (module, planType) in /subscription/plan-pricing.
 */

import { redirect } from "next/navigation";

export default function LegacyUpgradeRedirect() {
  redirect("/settings/subscription");
}

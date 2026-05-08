/**
 * Legacy V1 pricing page (Basic / Medium / Pro tiers) was retired in favour of
 * the V2 Base/General model at /subscription/plan-pricing. Any inbound link
 * here redirects to the new page.
 *
 * Kept as a redirect (rather than deleted) because: (a) it preserves the
 * `subscription.pricing:view` permission slug for the new URL, and
 * (b) old bookmarks / docs links continue to work.
 */

import { redirect } from "next/navigation";

export default function LegacyPricingRedirect() {
  redirect("/subscription/plan-pricing");
}

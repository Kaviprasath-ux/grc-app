/**
 * Legacy V1 renew page (Basic / Medium / Pro tier-based) — retired.
 *
 * V2 customers don't need a manual renew flow:
 *   - BASE plan auto-flips to GENERAL on day 365 (plan-transitions cron)
 *   - GENERAL plan recurs via Razorpay autopay mandate
 *   - COMPLIMENTARY customers don't pay at all
 *
 * Any direct URL hit (button, bookmark, link from old emails) lands on the
 * customer portal which shows V2 lifecycle banners instead.
 */

import { redirect } from "next/navigation";

export default function LegacyRenewRedirect() {
  redirect("/settings/subscription");
}

import { redirect } from "next/navigation";

/**
 * IA Organization > Subscription & Billing — redirect to the existing
 * /settings/subscription page. URL stays the same per the BA spec
 * ("don't change url for subscription, keep it old one"). The nav placement
 * inside Organization is handled via navigation.ts.
 */
export default function InternalAuditOrganizationSubscription() {
  redirect("/settings/subscription");
}

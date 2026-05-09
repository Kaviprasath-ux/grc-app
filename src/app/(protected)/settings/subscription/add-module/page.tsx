/**
 * Legacy V1 add-module page (tier-based) — retired.
 *
 * V2 module additions are handled via super-admin (toggling module flags on
 * the customer account, which auto-creates a COMPLIMENTARY ModuleSubscription
 * via ensureComplimentarySubscription). Customers don't add modules
 * self-service in the V2 model.
 */

import { redirect } from "next/navigation";

export default function LegacyAddModuleRedirect() {
  redirect("/settings/subscription");
}

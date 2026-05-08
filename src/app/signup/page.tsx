/**
 * Legacy V1 signup wizard (Basic / Medium / Pro tiers) was retired in favour
 * of the V2 Base/General signup flow at /signup/v2. Any inbound link here
 * redirects to the new wizard.
 *
 * Kept as a redirect (rather than deleted) because external marketing pages
 * and old links to /signup continue to work.
 */

import { redirect } from "next/navigation";

export default function LegacySignupRedirect() {
  redirect("/signup/v2");
}

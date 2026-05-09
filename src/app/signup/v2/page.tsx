/**
 * Backwards-compat redirect: /signup/v2 -> /signup
 *
 * The V2 wizard is now the only signup flow and lives at /signup. Kept here
 * so old marketing links, email CTAs, and tests still resolve cleanly.
 */

import { redirect } from "next/navigation";

export default function SignupV2Redirect() {
  redirect("/signup");
}

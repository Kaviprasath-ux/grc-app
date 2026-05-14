import { redirect } from "next/navigation";

/**
 * IA Organization landing — there's no dashboard for IA's Organization
 * (the GRC dashboard charts are GRC-specific). Redirect to Profile, which
 * is the most generally useful entry point.
 */
export default function InternalAuditOrganizationLanding() {
  redirect("/internal-audit/organization/profile");
}

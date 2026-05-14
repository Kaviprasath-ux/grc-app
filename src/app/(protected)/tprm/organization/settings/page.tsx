/**
 * TPRM Organization > Settings — re-exports the existing /organization/settings page.
 *
 * The shared component detects the URL via usePathname and hides GRC-specific
 * settings (BIA, Nature of Implementation, Process Frequency, Translations).
 * TPRM users see only: Location, Designation, User Document Types + Logo +
 * Email Notifications. Same trim rule as Internal Audit.
 */
export { default } from "@/app/(protected)/organization/settings/page";

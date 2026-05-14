/**
 * IA Organization > Settings — re-exports the existing /organization/settings page.
 *
 * The shared component detects the URL via usePathname and hides GRC-specific
 * settings (BIA, Nature of Implementation, Process Frequency, Translations).
 * IA users see only: Location, Designation, User Document Types + Logo +
 * Email Notifications.
 */
export { default } from "@/app/(protected)/organization/settings/page";

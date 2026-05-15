/**
 * Technical Evidence > Organization > Profile — re-exports /organization/profile.
 *
 * The shared component detects the URL via usePathname and hides the
 * GRC-only tabs (Services, Regulations, Organization Chart). Only Company
 * Info and Departments tabs are visible in the Technical Evidence workspace.
 */
export { default } from "@/app/(protected)/organization/profile/page";

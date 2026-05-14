/**
 * IA Organization > Profile — re-exports the existing /organization/profile page.
 *
 * The shared component detects the URL via usePathname and hides the
 * GRC-only tabs (Services, Regulations, Organization Chart). Only Company
 * Info and Departments tabs are visible in the IA workspace.
 */
export { default } from "@/app/(protected)/organization/profile/page";

/**
 * TPRM Organization > Reports — re-exports the existing /organization/reports page.
 *
 * The shared component detects the URL via usePathname and:
 *   - hides the "Management Report" featured card (GRC-only)
 *   - drops the "Processes" category tab
 *   - hides process-by-* reports
 * TPRM users see 5 cards total (3 issue + 2 user). Same trim rule as IA.
 */
export { default } from "@/app/(protected)/organization/reports/page";

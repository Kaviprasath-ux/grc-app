/**
 * IA Organization > Users — re-exports the existing /organization/users page.
 *
 * The page is already module-aware (Phase 4 of three-platform plan): the
 * Function dropdown auto-filters to "Audit" when the customer only subscribes
 * to Internal Audit. No duplicate logic needed.
 */
export { default } from "@/app/(protected)/organization/users/page";

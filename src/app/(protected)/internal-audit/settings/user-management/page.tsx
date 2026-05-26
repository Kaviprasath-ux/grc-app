/**
 * IA Settings > User Management — re-exports the shared /organization/users
 * page so it renders identically to the GRC design and the IA sidebar's
 * /internal-audit/organization/users entry-point.
 *
 * The shared page is module-aware: it detects the /internal-audit/ URL
 * prefix and restricts the Function dropdown and role list to Internal
 * Audit roles only.
 *
 * Previously this route contained a separate 927-line implementation with
 * a divergent layout; that file is replaced by this re-export so the three
 * platforms (GRC, IA, TPRM) each have a single canonical user-management
 * page design.
 */
export { default } from "@/app/(protected)/organization/users/page";

/**
 * Role ↔ Module mapping — single source of truth.
 *
 * Used by:
 *   - User Management UI (filter the role dropdown by subscribed modules)
 *   - customer-role-validator.ts (reject API requests assigning a role for a
 *     module the customer hasn't subscribed to)
 *   - Login picker (decide which module cards to show a user)
 *
 * Each role belongs to one of:
 *   - "system"          — applies across all modules (GRCAdministrator, TPRMAdmin)
 *   - ["GRC"]           — only assignable on GRC subscriptions
 *   - ["INTERNAL_AUDIT"] — only assignable on Internal Audit subscriptions
 *   - ["TPRM"]          — only assignable on TPRM subscriptions
 *   - ["GRC", "TPRM", "INTERNAL_AUDIT"] — assignable in any subscribed module
 *     (only CustomerAdministrator — same role name, different moduleCode per row)
 */

import type { RoleName } from "@/lib/permissions";

export type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE";

export const ROLE_MODULES: Record<RoleName, ModuleCode[] | "system"> = {
  // ── System-wide roles ───────────────────────────────────────────
  GRCAdministrator: "system",
  TPRMAdmin: "system",

  // ── Cross-module customer admin (one row per subscribed module) ─
  CustomerAdministrator: ["GRC", "TPRM", "INTERNAL_AUDIT", "TECHNICAL_EVIDENCE"],

  // ── GRC platform roles ──────────────────────────────────────────
  Reviewer: ["GRC"],
  Contributor: ["GRC"],
  DepartmentReviewer: ["GRC"],
  DepartmentContributor: ["GRC"],

  // ── Internal Audit platform roles ───────────────────────────────
  AuditHead: ["INTERNAL_AUDIT"],
  Auditor: ["INTERNAL_AUDIT"],
  AuditUser: ["INTERNAL_AUDIT"],
  Auditee: ["INTERNAL_AUDIT"],

  // ── TPRM platform roles ─────────────────────────────────────────
  BusinessOwner: ["TPRM"],
  RelationshipManager: ["TPRM"],
  TPRMAssessor: ["TPRM"],
  TPRMApprover: ["TPRM"],
  TPRMAuditor: ["TPRM"],
  AccountManager: ["TPRM"],
  TPRMSME: ["TPRM"],
  FactoryAdmin: ["TPRM"],
  FactoryAssessor: ["TPRM"],
  InternalITTeam: ["TPRM"],

};

/**
 * Returns the module list a role can be assigned in, or "system" for
 * cross-cutting roles. Throws if the role isn't in the map (catches typos).
 */
export function getModulesForRole(roleName: RoleName): ModuleCode[] | "system" {
  const entry = ROLE_MODULES[roleName];
  if (entry === undefined) {
    throw new Error(`Role not in ROLE_MODULES map: ${roleName}`);
  }
  return entry;
}

/**
 * Returns true if the role is system-wide (applies regardless of moduleCode).
 */
export function isSystemRole(roleName: RoleName): boolean {
  return ROLE_MODULES[roleName] === "system";
}

/**
 * Returns the list of role names that can be assigned in a given module.
 * Used by the User Management UI to populate a per-module dropdown.
 *
 * System roles (GRCAdministrator, TPRMAdmin) are excluded — they're not
 * assignable per module; only the super-admin onboarding flow creates them.
 */
export function getRolesForModule(moduleCode: ModuleCode): RoleName[] {
  return (Object.keys(ROLE_MODULES) as RoleName[]).filter((name) => {
    const entry = ROLE_MODULES[name];
    return Array.isArray(entry) && entry.includes(moduleCode);
  });
}

/**
 * Returns true if the given role can be assigned with the given moduleCode.
 *   - system roles: only valid with moduleCode = null
 *   - module roles: only valid when moduleCode is in their module list
 */
export function isRoleValidForModule(
  roleName: RoleName,
  moduleCode: ModuleCode | null,
): boolean {
  const entry = ROLE_MODULES[roleName];
  if (entry === undefined) return false;
  if (entry === "system") return moduleCode === null;
  return moduleCode !== null && entry.includes(moduleCode);
}

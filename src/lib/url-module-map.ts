/**
 * URL prefix → ModuleCode lookup.
 *
 * Used by:
 *   - ModuleContext: derive currentModule from the URL when no cookie is set
 *     (deep-link flow — user clicks /internal-audit/fieldwork from an email)
 *   - MainLayout subscription gate (Phase 6): block deep-links into modules
 *     the customer hasn't subscribed to
 *
 * Note on URL strategy (Phase 5a):
 *   Customer GRC routes are still scattered (/dashboard, /organization/*,
 *   /compliance/*, /asset-management/*, /risks/*) — they have NOT been
 *   restructured under /grc/* yet. The URL→module map encodes the legacy
 *   prefix layout. A Phase 5b refactor can collapse them later.
 *
 *   The /grc/* prefix today is the GRCAdministrator super-admin namespace
 *   (customer-accounts, customers, email-settings) — NOT customer GRC.
 *   That's why /grc is mapped under SYSTEM, not GRC.
 */

export type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE";

// Module-or-system tag used on the system-only super-admin pages.
// "SYSTEM" never gets shown as a workspace in the picker — it's only
// accessible to GRCAdministrator and bypasses the picker entirely.
export type ModuleOrSystem = ModuleCode | "SYSTEM";

interface PrefixEntry {
  prefix: string;
  module: ModuleOrSystem;
}

// Order matters — the first matching prefix wins. Put more specific paths
// before less specific ones (e.g. /grc-admin before /grc).
export const URL_MODULE_PREFIXES: PrefixEntry[] = [
  // System-level super-admin pages (GRCAdministrator only)
  { prefix: "/grc/customer-accounts",   module: "SYSTEM" },
  { prefix: "/grc/customers",           module: "SYSTEM" },
  { prefix: "/grc/configuration",       module: "SYSTEM" },
  { prefix: "/grc/email-settings",      module: "SYSTEM" },
  { prefix: "/grc/email-templates",     module: "SYSTEM" },
  { prefix: "/grc",                     module: "SYSTEM" }, // bare /grc landing
  { prefix: "/subscription/pricing",    module: "SYSTEM" },
  { prefix: "/subscription/bundle-discounts", module: "SYSTEM" },
  { prefix: "/subscription/list",       module: "SYSTEM" },

  // Internal Audit module
  { prefix: "/internal-audit",          module: "INTERNAL_AUDIT" },

  // TPRM module
  { prefix: "/tprm",                    module: "TPRM" },

  // Technical Evidence module (4th independent platform)
  { prefix: "/technical-evidence",      module: "TECHNICAL_EVIDENCE" },

  // GRC platform (customer-side)
  { prefix: "/dashboard",               module: "GRC" },
  { prefix: "/organization",            module: "GRC" },
  { prefix: "/compliance",              module: "GRC" },
  { prefix: "/qpost-compliance",        module: "GRC" },
  { prefix: "/asset-management",        module: "GRC" },
  { prefix: "/assets",                  module: "GRC" }, // legacy alias
  { prefix: "/risk-management",         module: "GRC" },
  { prefix: "/risks",                   module: "GRC" }, // legacy alias

  // Cross-cutting paths that don't belong to any single module — left
  // unmapped on purpose so they don't trigger the subscription gate.
  // Examples: /select-module, /subscription-required, /settings/subscription,
  //           /login, /api/*, /profile, /notifications.
];

/**
 * Returns the module a URL belongs to, or null if it doesn't map to any
 * specific module (cross-cutting path or unknown).
 */
export function getModuleFromPath(path: string): ModuleOrSystem | null {
  if (!path) return null;
  // Normalise: strip query / hash
  const cleanPath = path.split("?")[0].split("#")[0];
  for (const entry of URL_MODULE_PREFIXES) {
    if (cleanPath === entry.prefix || cleanPath.startsWith(entry.prefix + "/")) {
      return entry.module;
    }
  }
  return null;
}

/**
 * Returns the canonical "home" URL for a given module — where the picker
 * lands a user after they choose a workspace.
 *
 * Note: callers that know the user's roles should prefer `moduleHomeForRoles`
 * since some roles (CustomerAdministrator, Auditee, etc.) only have view
 * permission on a subset of pages within a module.
 */
export function getModuleHome(module: ModuleCode): string {
  switch (module) {
    case "GRC":
      return "/dashboard";
    case "INTERNAL_AUDIT":
      return "/internal-audit/dashboard";
    case "TPRM":
      return "/tprm/program-monitor";
    case "TECHNICAL_EVIDENCE":
      return "/technical-evidence/dashboard";
  }
}

/**
 * Role-aware variant. The module dashboard pages require role-specific
 * `view` permissions — e.g. `/internal-audit/dashboard` requires AuditHead
 * (CustomerAdministrator does NOT have audit.dashboard:view, only
 * audit.risk-register:view and audit.settings:view). Landing them on a
 * page they can't view would trigger the proxy gate (accessDenied=1).
 *
 * This function maps (module × roles) → a landing page the user can view.
 * Used by both `app/page.tsx` (post-login redirect) and the picker
 * (`/select-module`) when a card is clicked.
 */
export function moduleHomeForRoles(module: ModuleCode, roles: string[]): string {
  if (module === "INTERNAL_AUDIT") {
    if (roles.includes("Auditee")) return "/internal-audit/fieldwork";
    if (roles.includes("AuditHead") || roles.includes("Auditor") || roles.includes("AuditUser"))
      return "/internal-audit/dashboard";
    // CustomerAdministrator (and anyone else with IA module-tag but no audit
    // dashboard view) lands on Risk Register — they have view on it.
    if (roles.includes("CustomerAdministrator")) return "/internal-audit/risk-register";
    return "/internal-audit/dashboard";
  }
  if (module === "TPRM") {
    if (roles.includes("BusinessOwner")) return "/tprm/bo-dashboard";
    if (roles.includes("RelationshipManager")) return "/tprm/rm-dashboard";
    if (
      roles.includes("TPRMAssessor") ||
      roles.includes("TPRMApprover") ||
      roles.includes("TPRMAuditor")
    )
      return "/tprm/asr-dashboard";
    if (roles.includes("AccountManager") || roles.includes("TPRMSME"))
      return "/tprm/am-assessments";
    if (roles.includes("FactoryAdmin") || roles.includes("FactoryAssessor"))
      return "/tprm/asr-assessment-factory";
    if (roles.includes("InternalITTeam")) return "/tprm/it-issues";
    return getModuleHome("TPRM");
  }
  if (module === "TECHNICAL_EVIDENCE") {
    return getModuleHome("TECHNICAL_EVIDENCE");
  }
  return getModuleHome("GRC");
}

// Roles that belong to exactly one platform. Used to recover a workspace when a
// UserRole row was saved without a moduleCode (older assignments) — otherwise
// the layout gate wrongly shows "Subscription Required" for a role the user
// actually holds. Cross-module / system roles (GRCAdministrator,
// CustomerAdministrator, Reviewer, Contributor, …) are intentionally absent —
// they anchor to GRC/base and don't need inference.
const TPRM_ROLE_NAMES = new Set<string>([
  "TPRMAdmin", "BusinessOwner", "RelationshipManager", "TPRMAssessor",
  "TPRMApprover", "TPRMAuditor", "AccountManager", "TPRMSME",
  "InternalITTeam", "FactoryAdmin", "FactoryAssessor",
]);
const INTERNAL_AUDIT_ROLE_NAMES = new Set<string>([
  "AuditHead", "AuditManager", "Auditor", "AuditUser", "Auditee",
]);

/**
 * Best-effort module for a single-platform role name. Returns null for
 * cross-module / system / GRC roles (no inference needed — they map to GRC).
 */
export function inferModuleFromRoleName(roleName: string): ModuleCode | null {
  if (TPRM_ROLE_NAMES.has(roleName)) return "TPRM";
  if (INTERNAL_AUDIT_ROLE_NAMES.has(roleName)) return "INTERNAL_AUDIT";
  return null;
}

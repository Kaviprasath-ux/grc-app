/**
 * Module Context — Determines which GRC module the chatbot persona should
 * identify with, based on the user's role(s) and (for admins) the customer
 * account's enabled module toggles.
 *
 * The returned label is interpolated into chatbot system prompts and
 * user-facing fallback messages, so the bot says "TPRM Help Assistant" to a
 * TPRM user, "Internal Audit Help Assistant" to an audit user, etc.
 */

const AUDIT_ROLES = new Set([
  "AuditHead",
  "AuditManager",
  "Auditor",
  "Auditee",
]);

const TPRM_ROLES = new Set([
  "TPRMAdmin",
  "TPRMCustomerAdmin",
  "BusinessOwner",
  "RelationshipManager",
  "TPRMAssessor",
  "TPRMApprover",
  "TPRMAuditor",
  "InternalITTeam",
  "AccountManager",
  "TPRMSME",
]);

export interface ModuleToggles {
  isGrcAdded?: boolean;
  isTprmAdded?: boolean;
  isInternalAuditEnabled?: boolean;
}

function joinModules(parts: string[]): string {
  if (parts.length === 0) return "GRC";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function togglesToLabel(toggles: ModuleToggles): string {
  const parts: string[] = [];
  if (toggles.isGrcAdded) parts.push("GRC");
  if (toggles.isTprmAdded) parts.push("TPRM");
  if (toggles.isInternalAuditEnabled) parts.push("Internal Audit");
  return joinModules(parts);
}

/**
 * Resolve the chatbot persona label for a user.
 *
 * Priority:
 *  1. GRCAdministrator → always "GRC, TPRM, and Internal Audit" (system superadmin)
 *  2. CustomerAdministrator → label built from customer's enabled module toggles
 *  3. Roles are entirely Internal Audit roles → "Internal Audit"
 *  4. Roles are entirely TPRM roles → "TPRM"
 *  5. Anything else (Reviewer/Contributor/mixed/etc.) → "GRC"
 */
export function getModuleContext(
  roles: string[] = [],
  toggles: ModuleToggles = {}
): string {
  if (roles.includes("GRCAdministrator")) {
    return "GRC, TPRM, and Internal Audit";
  }

  if (roles.includes("CustomerAdministrator")) {
    return togglesToLabel(toggles);
  }

  if (roles.length > 0) {
    const allAudit = roles.every((r) => AUDIT_ROLES.has(r));
    if (allAudit) return "Internal Audit";

    const allTprm = roles.every((r) => TPRM_ROLES.has(r));
    if (allTprm) return "TPRM";
  }

  return "GRC";
}

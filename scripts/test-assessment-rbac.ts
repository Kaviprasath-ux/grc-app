/**
 * Per-role RBAC test for the TPRM Assessment chatbot model.
 *
 * Exercises (without a DB or LLM):
 *   1. getAccessibleModelNames() — is TPRMAssessment visible to this role?
 *   2. buildAssessmentRoleScope() — what WHERE fragment gets AND'd?
 *   3. "me" keyword split — does `assessorId: "me"` route to the override map?
 *
 * Run: npx tsx scripts/test-assessment-rbac.ts
 */

import { getAccessibleModelNames, QUERYABLE_MODELS } from "../src/lib/chatbot/schema-metadata";
import { buildAssessmentRoleScope } from "../src/lib/chatbot/data-query-engine";

type Expectation = {
  roles: string[];
  /** Canonical role name for display */
  label: string;
  /** Expected access to TPRMAssessment model */
  expectModelAccess: boolean;
  /** Check function for the scope WHERE */
  scopeCheck: (scope: unknown) => { ok: boolean; why: string };
  /** Simulated AM vendor IDs (for AM/SME roles) */
  amVendorIds?: string[];
};

const MODEL = "TPRMAssessment";
const USER_ID = "user_current_123";

// ==================== Scope checkers ====================
type Scope = Record<string, unknown> | { __deny: true } | null;

function isNull(scope: unknown) { return scope === null; }
function isDeny(scope: unknown) {
  return !!scope && typeof scope === "object" && (scope as Record<string, unknown>).__deny === true;
}
function hasTopLevelOr(scope: unknown): scope is { OR: unknown[] } {
  return !!scope && typeof scope === "object" && Array.isArray((scope as Record<string, unknown>).OR);
}
function hasTopLevelAnd(scope: unknown): scope is { AND: unknown[] } {
  return !!scope && typeof scope === "object" && Array.isArray((scope as Record<string, unknown>).AND);
}

function offboardStatusesInScope(scope: unknown): string[] {
  const json = JSON.stringify(scope);
  const offboard = [
    "Offboard_Approve_Assessor",
    "Offboard_Approve_RM",
    "Offboard_Approve_BO",
    "Offboard_In_Progress",
    "Offboard_Awaiting_Response",
    "Offboard_Completed",
  ];
  return offboard.filter((s) => json.includes(s));
}

function expectBroadScope(expected: string[]) {
  return (scope: unknown) => {
    if (!hasTopLevelOr(scope)) return { ok: false, why: "expected top-level OR (broad scope)" };
    const found = offboardStatusesInScope(scope).sort();
    const wanted = [...expected].sort();
    const ok = JSON.stringify(found) === JSON.stringify(wanted);
    return {
      ok,
      why: ok ? `offboard statuses: [${found.join(", ")}]`
              : `expected [${wanted.join(", ")}], got [${found.join(", ")}]`,
    };
  };
}

function expectVendorScope(expectedVendorIds: string[]) {
  return (scope: unknown) => {
    if (!hasTopLevelAnd(scope)) return { ok: false, why: "expected top-level AND (AM scope)" };
    const json = JSON.stringify(scope);
    const vendorMatch = expectedVendorIds.length === 0
      ? json.includes(`"__none__"`)
      : expectedVendorIds.every((id) => json.includes(id));
    if (!vendorMatch) return { ok: false, why: "vendor IDs not in scope" };
    const amStatuses = ["Offboard_In_Progress", "Offboard_Awaiting_Response"];
    const found = offboardStatusesInScope(scope).sort();
    const wanted = [...amStatuses].sort();
    const ok = JSON.stringify(found) === JSON.stringify(wanted);
    return {
      ok,
      why: ok ? `vendor-scoped + [${found.join(", ")}]`
              : `offboard statuses wrong: wanted [${wanted.join(", ")}], got [${found.join(", ")}]`,
    };
  };
}

function expectFactoryOnly() {
  return (scope: unknown) => {
    const json = JSON.stringify(scope);
    const ok = !!scope && typeof scope === "object"
      && (scope as Record<string, unknown>).assessmentType === "Assessment Factory"
      && !json.includes("Offboard");
    return { ok, why: ok ? "assessmentType = Assessment Factory (no offboard)" : "expected factory-only" };
  };
}

function expectNull() {
  return (scope: unknown) => ({ ok: isNull(scope), why: isNull(scope) ? "no extra scope (full tenant)" : "expected null" });
}

function expectDeny() {
  return (scope: unknown) => ({ ok: isDeny(scope), why: isDeny(scope) ? "__deny sentinel returned" : "expected deny" });
}

// ==================== Test matrix ====================

const CASES: Expectation[] = [
  // Tier 1 — full tenant
  { label: "GRCAdministrator", roles: ["GRCAdministrator"], expectModelAccess: true, scopeCheck: expectNull() },
  { label: "TPRMAdmin",        roles: ["TPRMAdmin"],        expectModelAccess: true, scopeCheck: expectNull() },
  { label: "TPRMAuditor",      roles: ["TPRMAuditor"],      expectModelAccess: true, scopeCheck: expectNull() },

  // Tier 2 — broad + role-specific offboard
  { label: "RelationshipManager", roles: ["RelationshipManager"], expectModelAccess: true,
    scopeCheck: expectBroadScope(["Offboard_Approve_RM", "Offboard_Completed"]) },
  { label: "BusinessOwner",       roles: ["BusinessOwner"],       expectModelAccess: true,
    scopeCheck: expectBroadScope(["Offboard_Approve_BO", "Offboard_Completed"]) },
  { label: "TPRMAssessor",        roles: ["TPRMAssessor"],        expectModelAccess: true,
    scopeCheck: expectBroadScope(["Offboard_Approve_Assessor", "Offboard_Completed"]) },
  { label: "TPRMApprover",        roles: ["TPRMApprover"],        expectModelAccess: true,
    scopeCheck: expectBroadScope(["Offboard_Approve_Assessor", "Offboard_Completed"]) },

  // Tier 3 — AM vendor-scoped
  { label: "AccountManager (with vendors)", roles: ["AccountManager"], expectModelAccess: true,
    amVendorIds: ["vendor_a", "vendor_b"],
    scopeCheck: expectVendorScope(["vendor_a", "vendor_b"]) },
  { label: "AccountManager (no vendors)", roles: ["AccountManager"], expectModelAccess: true,
    amVendorIds: [],
    scopeCheck: expectVendorScope([]) },
  { label: "TPRMSME (with vendors)", roles: ["TPRMSME"], expectModelAccess: true,
    amVendorIds: ["vendor_x"],
    scopeCheck: expectVendorScope(["vendor_x"]) },

  // Tier 4 — Factory only
  { label: "FactoryAdmin",    roles: ["FactoryAdmin"],    expectModelAccess: true, scopeCheck: expectFactoryOnly() },
  { label: "FactoryAssessor", roles: ["FactoryAssessor"], expectModelAccess: true, scopeCheck: expectFactoryOnly() },

  // Denials
  { label: "CustomerAdministrator (DENIED)", roles: ["CustomerAdministrator"], expectModelAccess: false, scopeCheck: expectDeny() },
  { label: "Reviewer (DENIED)",              roles: ["Reviewer"],              expectModelAccess: false, scopeCheck: expectDeny() },
  { label: "AuditHead (DENIED)",             roles: ["AuditHead"],             expectModelAccess: false, scopeCheck: expectDeny() },
];

// ==================== "me" keyword test ====================
function testMeSubstitution(): { ok: boolean; detail: string } {
  const model = QUERYABLE_MODELS.find((m) => m.prismaModel === MODEL)!;
  const rawFilters: Record<string, unknown> = {
    status: "Submitted",
    assessorId: "me",
    approverId: "MYSELF",
    vendorId: "ACME Corp",
  };

  const meOverrides: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawFilters)) {
    if (typeof v !== "string") continue;
    const normalized = v.trim().toLowerCase();
    if (normalized !== "me" && normalized !== "myself" && normalized !== "i") continue;
    const fm = model.fields.find((f) => f.name === k);
    if (fm?.relation?.model === "User") {
      meOverrides[k] = USER_ID;
      delete rawFilters[k];
    }
  }

  const ok =
    meOverrides.assessorId === USER_ID &&
    meOverrides.approverId === USER_ID &&
    !("assessorId" in rawFilters) &&
    !("approverId" in rawFilters) &&
    rawFilters.vendorId === "ACME Corp" &&
    rawFilters.status === "Submitted";

  return {
    ok,
    detail:
      `overrides=${JSON.stringify(meOverrides)} leftover=${JSON.stringify(rawFilters)}`,
  };
}

// ==================== Run ====================
function run() {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  console.log(`\nTPRM Assessment chatbot — per-role RBAC test\n${"=".repeat(60)}\n`);

  for (const c of CASES) {
    // 1. Model access check
    const accessible = getAccessibleModelNames(c.roles).includes(MODEL);
    const accessOk = accessible === c.expectModelAccess;

    // 2. Scope WHERE check
    const scope = buildAssessmentRoleScope(c.roles, c.amVendorIds ?? []);
    const scopeResult = c.scopeCheck(scope);

    // Denied roles: skip scope check if model access already blocks them,
    // since applyRoleScope wouldn't even run. But we still compute buildAssessmentRoleScope
    // and expect __deny for symmetry.
    const allOk = accessOk && scopeResult.ok;
    const tag = allOk ? "PASS" : "FAIL";
    const line = `[${tag}] ${c.label.padEnd(40)} access=${accessible ? "yes" : "no "} | ${scopeResult.why}`;
    console.log(line);

    if (allOk) passed++;
    else {
      failed++;
      failures.push(
        `${c.label}: accessOk=${accessOk} (got ${accessible}, want ${c.expectModelAccess}), scopeOk=${scopeResult.ok} (${scopeResult.why})`
      );
    }
  }

  // 3. "me" substitution
  const meResult = testMeSubstitution();
  const meTag = meResult.ok ? "PASS" : "FAIL";
  console.log(`\n[${meTag}] "me"/"myself" substitution`.padEnd(49) + `| ${meResult.detail}`);
  if (meResult.ok) passed++;
  else {
    failed++;
    failures.push(`"me" substitution: ${meResult.detail}`);
  }

  console.log(`\n${"=".repeat(60)}\nTotal: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log(`\nFailures:\n  - ${failures.join("\n  - ")}`);
    process.exit(1);
  }
}

run();

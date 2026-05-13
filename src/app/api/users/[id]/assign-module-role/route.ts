import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import {
  assertRoleAllowedForCustomer,
  assertOneRolePerModule,
  RoleAssignmentError,
} from "@/lib/customer-role-validator";
import type { RoleName } from "@/lib/permissions";
import type { ModuleCode } from "@/lib/role-module-map";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Reverse of TPRM_ROLE_TO_SYSTEM_ROLE in auth.ts — when we assign a TPRM
// role via this endpoint we also sync the legacy `tprmRole` + `tprmFunctionCategory`
// fields on the User row so the existing /api/tprm/user-management GET
// (which filters by `tprmRole != null`) sees the freshly-attached user.
const TPRM_SYSTEM_TO_LEGACY: Record<string, { tprmRole: string; tprmFunctionCategory: string | null }> = {
  BusinessOwner:        { tprmRole: "Business Owner",       tprmFunctionCategory: "Business" },
  RelationshipManager:  { tprmRole: "Relationship Manager", tprmFunctionCategory: "Business" },
  InternalITTeam:       { tprmRole: "Internal IT Team",     tprmFunctionCategory: "Business" },
  TPRMAssessor:         { tprmRole: "Assessor",             tprmFunctionCategory: "TPRM Team" },
  TPRMApprover:         { tprmRole: "Approver",             tprmFunctionCategory: "TPRM Team" },
  TPRMAuditor:          { tprmRole: "Auditor",              tprmFunctionCategory: "TPRM Team" },
  AccountManager:       { tprmRole: "Account Manager",      tprmFunctionCategory: null },
  TPRMSME:              { tprmRole: "SME",                  tprmFunctionCategory: null },
};

/**
 * POST /api/users/[id]/assign-module-role
 *
 * Body: { moduleCode: "GRC" | "TPRM" | "INTERNAL_AUDIT", roleName: string }
 *
 * Adds a single UserRole row for this user in the specified module. Does NOT
 * touch the user's UserRole rows for other modules — that's the whole point.
 *
 * Used by:
 *   - "Assign Role" action in the All Users tab
 *   - "User exists in another module" confirmation popup (cross-module add)
 *
 * Validators (Phase 3) enforce:
 *   - role is in ROLE_MODULES and allowed for the given moduleCode
 *   - customer has an active subscription for the moduleCode
 *   - user does not already hold a role in this module (one-role-per-module rule)
 *
 * Errors:
 *   400 - missing/invalid body
 *   403 - tenant mismatch or RoleAssignmentError (returns code field)
 *   404 - user not found
 */
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = (await req.json()) as { moduleCode?: string; roleName?: string };
      const moduleCode = body.moduleCode;
      const roleName = body.roleName;

      if (!moduleCode || (moduleCode !== "GRC" && moduleCode !== "TPRM" && moduleCode !== "INTERNAL_AUDIT")) {
        return NextResponse.json(
          { error: "moduleCode must be GRC, TPRM, or INTERNAL_AUDIT" },
          { status: 400 },
        );
      }
      if (!roleName) {
        return NextResponse.json({ error: "roleName is required" }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, customerAccountId: true },
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, user.customerAccountId)) {
        return forbidden("Access denied to this user");
      }
      if (!user.customerAccountId) {
        return NextResponse.json(
          { error: "User has no customer account" },
          { status: 400 },
        );
      }

      // Look up (or auto-create) the Role record by name.
      let role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        role = await prisma.role.create({
          data: { name: roleName, description: `${roleName} role`, isSystem: false },
        });
      }

      // Phase 3 validators: subscription gating + one-role-per-module.
      await assertRoleAllowedForCustomer(
        roleName as RoleName,
        moduleCode as ModuleCode,
        user.customerAccountId,
      );
      await assertOneRolePerModule(user.id, moduleCode as ModuleCode);

      // Idempotent: if the exact row already exists, return it. Prisma's
      // composite-key WHERE rejects nullable moduleCode so we use findFirst.
      const existing = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: role.id, moduleCode },
      });
      if (existing) {
        return NextResponse.json({ created: false, userRole: existing });
      }

      const created = await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id, moduleCode },
      });

      // TPRM-specific: keep legacy User.tprmRole / tprmFunctionCategory in
      // sync so the existing TPRM user-management page (which filters by
      // these fields) picks up the newly-attached user.
      if (moduleCode === "TPRM") {
        const legacy = TPRM_SYSTEM_TO_LEGACY[roleName];
        if (legacy) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              tprmRole: legacy.tprmRole,
              tprmFunctionCategory: legacy.tprmFunctionCategory,
              function: legacy.tprmFunctionCategory ?? "TPRM",
            },
          });
        }
      }

      return NextResponse.json({ created: true, userRole: created }, { status: 201 });
    } catch (error: unknown) {
      if (error instanceof RoleAssignmentError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 403 },
        );
      }
      console.error("Error assigning module role:", error);
      return NextResponse.json(
        { error: "Failed to assign role" },
        { status: 500 },
      );
    }
  },
  { resource: "organization.users", action: "edit" },
);

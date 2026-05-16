/**
 * Phase 3 validators — block role assignments that violate the
 * platform model (GRC / TPRM / Internal Audit / Technical Evidence).
 *
 * Two rules enforced here:
 *   1. assertRoleAllowedForCustomer — the role must belong to a module the
 *      customer currently has an active subscription for (or be a system role).
 *   2. assertOneRolePerModule — a user can hold at most one role per module
 *      (system roles excluded — those are global).
 *
 * Both throw `RoleAssignmentError` (extends Error) on violation. API handlers
 * should catch and convert to a 403 response.
 */

import prisma from "@/lib/prisma";
import { getActiveModules } from "@/lib/module-access";
import {
  getModulesForRole,
  isSystemRole,
  isRoleValidForModule,
  type ModuleCode,
} from "@/lib/role-module-map";
import type { RoleName } from "@/lib/permissions";

export class RoleAssignmentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ROLE_NOT_IN_MAP"
      | "ROLE_MODULE_MISMATCH"
      | "MODULE_NOT_SUBSCRIBED"
      | "DUPLICATE_ROLE_IN_MODULE",
  ) {
    super(message);
    this.name = "RoleAssignmentError";
  }
}

/**
 * Validate that the given role can be assigned to a user belonging to this
 * customer with the given moduleCode.
 *
 * Throws RoleAssignmentError when:
 *   - role isn't in ROLE_MODULES (typo / dropped role)
 *   - role's modules don't include the given moduleCode
 *     (e.g., assigning TPRMAssessor with moduleCode="GRC")
 *   - the customer doesn't currently have an active subscription for the
 *     given moduleCode (skipped for system roles where moduleCode=null)
 */
export async function assertRoleAllowedForCustomer(
  roleName: RoleName,
  moduleCode: ModuleCode | null,
  customerAccountId: string,
): Promise<void> {
  // 1. role must exist in the map
  let modules: ModuleCode[] | "system";
  try {
    modules = getModulesForRole(roleName);
  } catch {
    throw new RoleAssignmentError(
      `Unknown role: ${roleName}`,
      "ROLE_NOT_IN_MAP",
    );
  }

  // 2. system roles must always have moduleCode=null and skip the subscription check
  if (modules === "system") {
    if (moduleCode !== null) {
      throw new RoleAssignmentError(
        `System role ${roleName} must be assigned with moduleCode=null, got ${moduleCode}`,
        "ROLE_MODULE_MISMATCH",
      );
    }
    return;
  }

  // 3. moduleCode must be in the role's allowed modules
  if (!moduleCode || !isRoleValidForModule(roleName, moduleCode)) {
    throw new RoleAssignmentError(
      `Role ${roleName} cannot be assigned with moduleCode=${moduleCode}. ` +
        `Allowed modules: ${modules.join(", ")}`,
      "ROLE_MODULE_MISMATCH",
    );
  }

  // 4. customer must currently have an active subscription for moduleCode
  const active = await getActiveModules(customerAccountId);
  if (!active.has(moduleCode)) {
    throw new RoleAssignmentError(
      `Customer is not subscribed to ${moduleCode}; cannot assign role ${roleName}.`,
      "MODULE_NOT_SUBSCRIBED",
    );
  }
}

/**
 * Validate that this user does not already hold a role for the given module.
 * Pass `excludeUserRoleId` when updating an existing assignment so you don't
 * conflict with the row you're about to replace.
 *
 * Skipped for system roles (moduleCode=null) — a user can hold multiple
 * system roles and one role per module concurrently.
 */
export async function assertOneRolePerModule(
  userId: string,
  moduleCode: ModuleCode | null,
  excludeUserRoleId?: string,
): Promise<void> {
  if (moduleCode === null) return;

  const existing = await prisma.userRole.findFirst({
    where: {
      userId,
      moduleCode,
      ...(excludeUserRoleId ? { NOT: { id: excludeUserRoleId } } : {}),
    },
    include: { role: { select: { name: true } } },
  });

  if (existing) {
    throw new RoleAssignmentError(
      `User already holds role "${existing.role.name}" in ${moduleCode}. ` +
        `Remove the existing assignment before adding a new one.`,
      "DUPLICATE_ROLE_IN_MODULE",
    );
  }
}

/**
 * Convenience wrapper: validate then create a UserRole row.
 * Returns the created UserRole.
 *
 * Uses findFirst+create rather than upsert because Prisma's composite-key
 * WHERE rejects null moduleCode even when the column is nullable.
 */
export async function assignRoleSafely(
  userId: string,
  roleId: string,
  roleName: RoleName,
  moduleCode: ModuleCode | null,
  customerAccountId: string,
) {
  await assertRoleAllowedForCustomer(roleName, moduleCode, customerAccountId);
  // Skip one-role-per-module for system roles.
  if (!isSystemRole(roleName)) {
    await assertOneRolePerModule(userId, moduleCode);
  }

  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId, moduleCode },
  });
  if (existing) return existing;

  return prisma.userRole.create({
    data: { userId, roleId, moduleCode },
  });
}

/**
 * Legacy bridge: take a single role name (the shape the existing UI sends)
 * and produce the right set of UserRole rows.
 *
 *   - System role (GRCAdministrator/TPRMAdmin) → one row with moduleCode=null
 *   - Single-module role (e.g. AuditHead)     → one row with that moduleCode
 *   - Multi-module role (CustomerAdministrator)
 *       → one row per active customer module that the role allows
 *
 * Validators run before each creation; throws `RoleAssignmentError` on first
 * violation. Designed to run inside a transaction (caller passes a tx-bound
 * client) but works fine on the singleton too.
 */
export async function assignRoleByName(opts: {
  userId: string;
  roleName: RoleName;
  roleId: string;
  customerAccountId: string;
  /**
   * Optional Prisma transaction client. If omitted, uses the singleton.
   * Type kept loose because Prisma doesn't export TransactionClient cleanly.
   */
  tx?: typeof prisma;
}) {
  const { userId, roleName, roleId, customerAccountId } = opts;
  const db = opts.tx ?? prisma;
  const modules = getModulesForRole(roleName);

  // System role — one row with moduleCode=null, no subscription check.
  if (modules === "system") {
    const existing = await db.userRole.findFirst({
      where: { userId, roleId, moduleCode: null },
    });
    if (!existing) {
      await db.userRole.create({ data: { userId, roleId, moduleCode: null } });
    }
    return [{ moduleCode: null }];
  }

  // For multi-module roles, intersect role's modules with customer's active modules.
  // For single-module roles, the array has one entry.
  const active = await getActiveModules(customerAccountId);
  const targets = modules.filter((m) => active.has(m));
  if (targets.length === 0) {
    throw new RoleAssignmentError(
      `Customer is not subscribed to any module that role ${roleName} can apply to ` +
        `(role allows: ${modules.join(", ")}).`,
      "MODULE_NOT_SUBSCRIBED",
    );
  }

  const created: { moduleCode: ModuleCode }[] = [];
  for (const moduleCode of targets) {
    await assertRoleAllowedForCustomer(roleName, moduleCode, customerAccountId);
    await assertOneRolePerModule(userId, moduleCode);

    const existing = await db.userRole.findFirst({
      where: { userId, roleId, moduleCode },
    });
    if (!existing) {
      await db.userRole.create({ data: { userId, roleId, moduleCode } });
    }
    created.push({ moduleCode });
  }
  return created;
}

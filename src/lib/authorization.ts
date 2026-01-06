/**
 * Authorization Helper Functions
 *
 * This file provides utilities for:
 * - Fetching user roles from database
 * - Building permission lists from roles
 * - Data filtering based on department/scope
 * - Server-side authorization checks
 */

import { prisma } from '@/lib/prisma';
import {
  UserPermission,
  expandRolePermissions,
  hasPermission,
  getPermissionScope,
  Action,
  Scope,
} from '@/lib/permissions';

// ==================== TYPES ====================

export interface UserWithRoles {
  id: string;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  departmentId: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  userRoles: Array<{
    role: {
      id: string;
      name: string;
    };
  }>;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
  roles: string[];
  permissions: UserPermission[];
}

// ==================== DATABASE FUNCTIONS ====================

/**
 * Get a user with their roles from the database
 */
export async function getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      userName: true,
      email: true,
      firstName: true,
      lastName: true,
      fullName: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      userRoles: {
        select: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Get a user by email with their roles
 */
export async function getUserByEmailWithRoles(email: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      userName: true,
      email: true,
      firstName: true,
      lastName: true,
      fullName: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      userRoles: {
        select: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Build session user data from database user
 */
export function buildSessionUser(user: UserWithRoles): SessionUser {
  const roleNames = user.userRoles.map(ur => ur.role.name);
  const permissions = expandRolePermissions(roleNames);

  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    departmentId: user.departmentId,
    departmentName: user.department?.name || null,
    roles: roleNames,
    permissions,
  };
}

// ==================== DATA FILTERING ====================

export interface DataFilter {
  departmentId?: string;
  ownerId?: string;
}

/**
 * Build a Prisma where clause for data filtering based on user permissions
 */
export function buildDataFilter(
  sessionUser: SessionUser,
  resource: string,
  action: Action
): DataFilter {
  const scope = getPermissionScope(sessionUser.permissions, resource, action);

  if (!scope) {
    // No permission - return impossible filter
    return { departmentId: 'NONE' };
  }

  switch (scope) {
    case 'all':
      // No filtering needed
      return {};
    case 'department':
      if (sessionUser.departmentId) {
        return { departmentId: sessionUser.departmentId };
      }
      return {};
    case 'own':
      return { ownerId: sessionUser.id };
    default:
      return {};
  }
}

/**
 * Apply data filter to a Prisma query's where clause
 */
export function applyDataFilter<T extends Record<string, unknown>>(
  where: T,
  filter: DataFilter
): T & DataFilter {
  return { ...where, ...filter };
}

// ==================== AUTHORIZATION CHECKS ====================

/**
 * Check if user has permission (server-side)
 */
export function checkPermission(
  sessionUser: SessionUser,
  resource: string,
  action: Action,
  options?: {
    resourceDepartmentId?: string;
    resourceOwnerId?: string;
  }
): boolean {
  return hasPermission(sessionUser.permissions, resource, action, {
    userDepartmentId: sessionUser.departmentId || undefined,
    userId: sessionUser.id,
    resourceDepartmentId: options?.resourceDepartmentId,
    resourceOwnerId: options?.resourceOwnerId,
  });
}

/**
 * Assert user has permission, throw if not
 */
export function assertPermission(
  sessionUser: SessionUser,
  resource: string,
  action: Action,
  options?: {
    resourceDepartmentId?: string;
    resourceOwnerId?: string;
  }
): void {
  if (!checkPermission(sessionUser, resource, action, options)) {
    throw new AuthorizationError(
      `Permission denied: ${action} on ${resource}`,
      resource,
      action
    );
  }
}

// ==================== ERROR CLASSES ====================

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public resource: string,
    public action: string
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// ==================== ROLE MANAGEMENT ====================

/**
 * Assign a role to a user
 */
export async function assignRole(userId: string, roleName: string): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role not found: ${roleName}`);
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId,
      roleId: role.id,
    },
  });
}

/**
 * Remove a role from a user
 */
export async function removeRole(userId: string, roleName: string): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role not found: ${roleName}`);
  }

  await prisma.userRole.deleteMany({
    where: {
      userId,
      roleId: role.id,
    },
  });
}

/**
 * Get all roles for a user
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        select: { name: true },
      },
    },
  });

  return userRoles.map(ur => ur.role.name);
}

/**
 * Check if user has a specific role
 */
export async function hasRole(userId: string, roleName: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes(roleName);
}

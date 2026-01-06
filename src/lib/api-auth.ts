/**
 * API Route Authorization Helpers
 *
 * Provides wrappers and utilities for protecting API routes with RBAC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  UserPermission,
  hasPermission,
  getPermissionScope,
  Action,
  Scope,
} from '@/lib/permissions';

// ==================== TYPES ====================

export interface AuthenticatedRequest extends NextRequest {
  user: {
    id: string;
    name: string;
    email: string;
    departmentId: string | null;
    departmentName: string | null;
    roles: string[];
    permissions: UserPermission[];
  };
}

export interface AuthOptions {
  /** Resource identifier (e.g., "organization.process", "risk.register") */
  resource: string;
  /** Action being performed */
  action: Action;
}

// ==================== RESPONSE HELPERS ====================

export function unauthorized(message = 'Authentication required') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Permission denied') {
  return NextResponse.json({ error: message }, { status: 403 });
}

// ==================== AUTH WRAPPER ====================

/**
 * Wrap an API route handler with authentication and authorization checks.
 *
 * @example
 * // In your API route
 * export const GET = withAuth(
 *   async (req, context, session) => {
 *     // Your handler code here
 *     return NextResponse.json({ data: 'protected data' });
 *   },
 *   { resource: 'organization.process', action: 'view' }
 * );
 */
export function withAuth<T extends { params?: Promise<unknown> }>(
  handler: (
    req: NextRequest,
    context: T,
    session: AuthenticatedRequest['user']
  ) => Promise<NextResponse>,
  options: AuthOptions
) {
  return async (req: NextRequest, context: T): Promise<NextResponse> => {
    try {
      // Get session
      const session = await auth();

      if (!session?.user) {
        return unauthorized();
      }

      const user = session.user;

      // Check if user has required permission
      const hasAccess = hasPermission(
        user.permissions || [],
        options.resource,
        options.action
      );

      if (!hasAccess) {
        return forbidden(`You don't have permission to ${options.action} ${options.resource}`);
      }

      // Build authenticated user object
      const authenticatedUser: AuthenticatedRequest['user'] = {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        departmentId: user.departmentId || null,
        departmentName: user.departmentName || null,
        roles: user.roles || [],
        permissions: user.permissions || [],
      };

      // Call the actual handler
      return handler(req, context, authenticatedUser);
    } catch (error) {
      console.error('Auth wrapper error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Wrap an API route handler with authentication only (no permission check).
 * Use this for routes that just need a logged-in user.
 */
export function withAuthOnly<T extends { params?: Promise<unknown> }>(
  handler: (
    req: NextRequest,
    context: T,
    session: AuthenticatedRequest['user']
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: T): Promise<NextResponse> => {
    try {
      const session = await auth();

      if (!session?.user) {
        return unauthorized();
      }

      const user = session.user;

      const authenticatedUser: AuthenticatedRequest['user'] = {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        departmentId: user.departmentId || null,
        departmentName: user.departmentName || null,
        roles: user.roles || [],
        permissions: user.permissions || [],
      };

      return handler(req, context, authenticatedUser);
    } catch (error) {
      console.error('Auth wrapper error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// ==================== DATA SCOPE HELPERS ====================

export interface DataScopeFilter {
  departmentId?: string;
  ownerId?: string;
}

/**
 * Get data filtering scope based on user permissions.
 * Use this to build Prisma where clauses for data access.
 *
 * @example
 * const filter = getDataScopeFilter(session, 'risk.register', 'view');
 * const risks = await prisma.risk.findMany({
 *   where: {
 *     ...filter,
 *     // other conditions
 *   }
 * });
 */
export function getDataScopeFilter(
  session: AuthenticatedRequest['user'],
  resource: string,
  action: Action
): DataScopeFilter {
  const scope = getPermissionScope(session.permissions, resource, action);

  if (!scope) {
    // No permission - return filter that matches nothing
    return { departmentId: '__NONE__' };
  }

  switch (scope) {
    case 'all':
      // No filtering - user can see all data
      return {};
    case 'department':
      // Filter to user's department
      if (session.departmentId) {
        return { departmentId: session.departmentId };
      }
      return {};
    case 'own':
      // Filter to user's own records
      return { ownerId: session.id };
    default:
      return {};
  }
}

/**
 * Check if user can access a specific record based on scope.
 *
 * @example
 * const risk = await prisma.risk.findUnique({ where: { id } });
 * if (!canAccessRecord(session, 'risk.register', 'view', {
 *   departmentId: risk.departmentId,
 *   ownerId: risk.ownerId
 * })) {
 *   return forbidden();
 * }
 */
export function canAccessRecord(
  session: AuthenticatedRequest['user'],
  resource: string,
  action: Action,
  record: { departmentId?: string | null; ownerId?: string | null }
): boolean {
  const scope = getPermissionScope(session.permissions, resource, action);

  if (!scope) {
    return false;
  }

  switch (scope) {
    case 'all':
      return true;
    case 'department':
      if (!session.departmentId) return true; // No department set, allow access
      return record.departmentId === session.departmentId;
    case 'own':
      return record.ownerId === session.id;
    default:
      return false;
  }
}

// ==================== HELPER TO GET SESSION IN API ROUTES ====================

/**
 * Get the current session in an API route.
 * Returns null if not authenticated.
 */
export async function getApiSession(): Promise<AuthenticatedRequest['user'] | null> {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  const user = session.user;

  return {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    departmentId: user.departmentId || null,
    departmentName: user.departmentName || null,
    roles: user.roles || [],
    permissions: user.permissions || [],
  };
}

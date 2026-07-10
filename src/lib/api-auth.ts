/**
 * API Route Authorization Helpers
 *
 * Provides wrappers and utilities for protecting API routes with RBAC.
 * Includes multi-tenant data isolation helpers.
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
import { recordAuditTrail, actionLabel, moduleLabel } from '@/lib/audit-trail';

// ==================== TYPES ====================

export interface AuthenticatedRequest extends NextRequest {
  user: {
    id: string;
    name: string;
    email: string;
    departmentId: string | null;
    departmentName: string | null;
    // Multi-tenant: Customer account information
    customerAccountId: string | null;
    customerAccountCode: string | null;
    customerAccountName: string | null;
    // Audit Head isolation: auditHeadId for audit team members
    auditHeadId: string | null;
    // Subscription snapshot — populated when SUBSCRIPTION_GATING_ENABLED=true.
    // null otherwise; consumed by checkSubscriptionGate() to gate writes.
    subscriptionStatus: string | null;
    subscriptionType: string | null;
    // Customer-account module toggles — drive module-aware behavior
    // (e.g. chatbot Department → TPRMDepartment redirect for TPRM-only customers)
    isGrcAdded: boolean;
    isTprmAdded: boolean;
    isInternalAuditEnabled: boolean;
    roles: string[];
    permissions: UserPermission[];
  };
}

export interface AuthOptions {
  /** Resource identifier (e.g., "organization.process", "risk.register").
   *  Pass an array to allow access if the user has permission for ANY of the listed resources. */
  resource: string | string[];
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

// ==================== AUDIT TRAIL AUTO-CAPTURE ====================

// Never auto-log these resources (the audit-trail reader itself, plus pure
// auth/notification noise) to avoid recursion / clutter.
const AUDIT_TRAIL_SKIP_RESOURCES = new Set(['audit.audit-trail']);

// Fire-and-forget: append an audit-trail entry for a successful mutation.
async function autoRecordMutation(
  req: NextRequest,
  context: { params?: Promise<unknown> },
  user: AuthenticatedRequest['user'],
  options: AuthOptions
): Promise<void> {
  try {
    const resource = Array.isArray(options.resource) ? options.resource[0] : options.resource;
    if (AUDIT_TRAIL_SKIP_RESOURCES.has(resource)) return;

    // Best-effort record identifier from the route params (id, then any *Id).
    let recordId: string | null = null;
    try {
      const params = (context?.params ? await context.params : {}) as Record<string, unknown>;
      const idKey =
        Object.keys(params).find((k) => k === 'id') ||
        Object.keys(params).find((k) => /id$/i.test(k));
      if (idKey && typeof params[idKey] === 'string') recordId = params[idKey] as string;
    } catch {
      /* params may be absent */
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null;

    // Derive a CRUD label primarily from the HTTP method (more reliable than the
    // route's RBAC action, which is about permissions). Approvals keep their label.
    const method = req.method.toUpperCase();
    let label: string;
    if (method === 'DELETE') label = 'Delete';
    else if (options.action === 'approve') label = 'Approve';
    else if (method === 'POST') label = 'Create';
    else if (method === 'PUT' || method === 'PATCH') label = 'Update';
    else label = actionLabel(options.action);

    await recordAuditTrail({
      customerAccountId: user.customerAccountId,
      userId: user.id,
      userName: user.name || user.email || 'Unknown',
      userRole: (user.roles || []).join(', ') || null,
      action: label,
      module: moduleLabel(resource),
      recordId,
      ipAddress: ip,
    });
  } catch (error) {
    console.error('[audit-trail] auto-capture error:', error);
  }
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

      // Check if user has required permission (supports multiple resources — any match grants access)
      const resources = Array.isArray(options.resource) ? options.resource : [options.resource];
      const hasAccess = resources.some(r =>
        hasPermission(user.permissions || [], r, options.action)
      );

      if (!hasAccess) {
        return forbidden(`You don't have permission to ${options.action} ${resources.join(' or ')}`);
      }

      // Build authenticated user object
      const authenticatedUser: AuthenticatedRequest['user'] = {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        departmentId: user.departmentId || null,
        departmentName: user.departmentName || null,
        // Multi-tenant: Include customer account
        customerAccountId: user.customerAccountId || null,
        customerAccountCode: user.customerAccountCode || null,
        customerAccountName: user.customerAccountName || null,
        // Audit Head isolation: Include auditHeadId
        auditHeadId: user.auditHeadId || null,
        subscriptionStatus: user.subscriptionStatus ?? null,
        subscriptionType: user.subscriptionType ?? null,
        isGrcAdded: user.isGrcAdded ?? false,
        isTprmAdded: user.isTprmAdded ?? false,
        isInternalAuditEnabled: user.isInternalAuditEnabled ?? false,
        roles: user.roles || [],
        permissions: user.permissions || [],
      };

      // Call the actual handler
      const response = await handler(req, context, authenticatedUser);

      // Audit-trail auto-capture: log successful mutations (non-view actions).
      if (
        options.action !== 'view' &&
        response.status >= 200 &&
        response.status < 300
      ) {
        void autoRecordMutation(req, context, authenticatedUser, options);
      }

      return response;
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
        // Multi-tenant: Include customer account
        customerAccountId: user.customerAccountId || null,
        customerAccountCode: user.customerAccountCode || null,
        customerAccountName: user.customerAccountName || null,
        // Audit Head isolation: Include auditHeadId
        auditHeadId: user.auditHeadId || null,
        subscriptionStatus: user.subscriptionStatus ?? null,
        subscriptionType: user.subscriptionType ?? null,
        isGrcAdded: user.isGrcAdded ?? false,
        isTprmAdded: user.isTprmAdded ?? false,
        isInternalAuditEnabled: user.isInternalAuditEnabled ?? false,
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

// ==================== MULTI-TENANT HELPERS ====================

/**
 * Get tenant filter for Prisma queries.
 * Enforces data isolation by customer account.
 *
 * GRCAdministrators can see all data (returns empty filter).
 * All other users are restricted to their customer account.
 *
 * @example
 * const tenantFilter = getTenantFilter(session);
 * const risks = await prisma.risk.findMany({
 *   where: {
 *     ...tenantFilter,
 *     // other conditions
 *   }
 * });
 */
export function getTenantFilter(session: AuthenticatedRequest['user'], options?: { globalAccess?: boolean }): { customerAccountId?: string } {
  // GRCAdministrators:
  // - If globalAccess option is true, return empty filter (see all data)
  // - Otherwise, filter by their own customerAccountId for data isolation
  if (session.roles.includes('GRCAdministrator')) {
    // Allow global access for specific use cases (e.g., customer management pages)
    if (options?.globalAccess) {
      return {};
    }
    // GRC Admin data isolation: filter by their own customerAccountId
    if (session.customerAccountId) {
      return { customerAccountId: session.customerAccountId };
    }
    // Fallback: empty filter if no customerAccountId (legacy behavior)
    return {};
  }

  // All other users are restricted to their customer account
  if (!session.customerAccountId) {
    // If user has no customer account, return an impossible filter
    // This prevents data leakage if a user is misconfigured
    return { customerAccountId: '__NO_TENANT__' };
  }

  return { customerAccountId: session.customerAccountId };
}

/**
 * Get the customer account ID for creating new records.
 * Throws an error if the user has no customer account (except GRCAdministrators).
 *
 * @example
 * const customerAccountId = getCustomerAccountId(session);
 * await prisma.risk.create({
 *   data: {
 *     customerAccountId,
 *     name: 'New Risk',
 *     // ...other fields
 *   }
 * });
 */
export function getCustomerAccountId(session: AuthenticatedRequest['user']): string {
  if (!session.customerAccountId) {
    throw new Error('User does not have a customer account assigned');
  }
  return session.customerAccountId;
}

/**
 * Validate that a record belongs to the user's customer account.
 * GRCAdministrators can access any record.
 *
 * @example
 * const risk = await prisma.risk.findUnique({ where: { id } });
 * if (!validateTenantAccess(session, risk?.customerAccountId)) {
 *   return forbidden('Access denied to this record');
 * }
 */
export function validateTenantAccess(
  session: AuthenticatedRequest['user'],
  recordCustomerAccountId: string | null | undefined
): boolean {
  // GRCAdministrators can access all records
  if (session.roles.includes('GRCAdministrator')) {
    return true;
  }

  // User must have a customer account
  if (!session.customerAccountId) {
    return false;
  }

  // Record must belong to the user's customer account
  return recordCustomerAccountId === session.customerAccountId;
}

// ==================== AUDIT HEAD FILTER HELPERS ====================

/**
 * Get the auditHeadId for data filtering in multi-tenant Internal Audit.
 *
 * Hierarchy:
 * - CustomerAdmin can create multiple Audit Heads
 * - Each Audit Head can create/manage their own Audit Managers and Auditees
 * - Data isolation: Audit Head A cannot see Audit Head B's data
 *
 * Returns:
 * - AuditHead: their own ID (they are the head, their ID is the auditHeadId)
 * - Auditor: session.auditHeadId (they belong to an Audit Head)
 * - Auditor/Auditee: session.auditHeadId (they belong to an Audit Head)
 * - Admins (GRCAdministrator, CustomerAdministrator): null (see all data within tenant)
 *
 * @example
 * const auditHeadId = getAuditHeadId(session);
 * if (auditHeadId) {
 *   // Filter by this audit head
 * }
 */
export function getAuditHeadId(session: AuthenticatedRequest['user']): string | null {
  // Admin roles see all data within their tenant
  const adminRoles = ['GRCAdministrator', 'CustomerAdministrator'];
  if (session.roles.some(role => adminRoles.includes(role))) {
    return null;
  }

  // AuditHead: their own user ID is the auditHeadId for data they create/own
  if (session.roles.includes('AuditHead')) {
    return session.id;
  }

  // Auditor, Auditee: use their assigned auditHeadId
  const auditRoles = ['Auditor', 'Auditee', 'AuditUser'];
  if (session.roles.some(role => auditRoles.includes(role))) {
    // Return the user's assigned auditHeadId for data isolation
    return session.auditHeadId || null;
  }

  // Other roles don't have audit head filtering
  return null;
}

/**
 * Resolve the auditHeadId for data creation.
 * For CustomerAdministrator: looks up the AuditHead user in their customer account
 * so that created data is visible to the AuditHead.
 * For AuditHead: returns their own ID.
 * For other audit roles: returns their assigned auditHeadId.
 */
export async function resolveAuditHeadIdForCreate(session: AuthenticatedRequest['user']): Promise<string | null> {
  // AuditHead creates data under their own ID
  if (session.roles.includes('AuditHead')) {
    return session.id;
  }

  // Auditor, Auditee etc: use their assigned auditHeadId
  const auditRoles = ['Auditor', 'Auditee', 'AuditUser'];
  if (session.roles.some(role => auditRoles.includes(role))) {
    return session.auditHeadId || null;
  }

  // CustomerAdministrator: find the AuditHead for their customer account
  if (session.roles.includes('CustomerAdministrator') && session.customerAccountId) {
    const auditHead = await prisma.user.findFirst({
      where: {
        customerAccountId: session.customerAccountId,
        userRoles: { some: { role: { name: 'AuditHead' } } },
        isActive: true,
      },
      select: { id: true },
    });
    return auditHead?.id || null;
  }

  return null;
}

/**
 * Get filter for Internal Audit data isolation by AuditHead.
 *
 * For AuditHead/Auditor roles, returns filter to only show data
 * where auditHeadId matches their user ID.
 *
 * GRCAdministrator and CustomerAdministrator see all data within their tenant.
 *
 * @example
 * const auditHeadFilter = getAuditHeadFilter(session);
 * const engagements = await prisma.auditEngagement.findMany({
 *   where: {
 *     ...getTenantFilter(session),
 *     ...auditHeadFilter,
 *   }
 * });
 */
export function getAuditHeadFilter(session: AuthenticatedRequest['user']): { auditHeadId?: string } | {} {
  const auditHeadId = getAuditHeadId(session);

  if (auditHeadId === null) {
    // Admin roles - no additional filter
    return {};
  }

  // Filter by auditHeadId
  return { auditHeadId };
}

/**
 * Get filter for Internal Audit risks by AuditHead.
 * Directly filters by auditHeadId field on risks.
 *
 * @example
 * const riskFilter = getAuditHeadRiskFilter(session);
 * const risks = await prisma.internalAuditRisk.findMany({
 *   where: {
 *     ...getTenantFilter(session),
 *     ...riskFilter,
 *   }
 * });
 */
export function getAuditHeadRiskFilter(session: AuthenticatedRequest['user']): { auditHeadId?: string } | {} {
  const auditHeadId = getAuditHeadId(session);

  if (auditHeadId === null) {
    // Admin roles - no additional filter
    return {};
  }

  // Filter by auditHeadId
  return { auditHeadId };
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
    // Multi-tenant: Include customer account
    customerAccountId: user.customerAccountId || null,
    customerAccountCode: user.customerAccountCode || null,
    customerAccountName: user.customerAccountName || null,
    // Audit Head isolation: Include auditHeadId
    auditHeadId: user.auditHeadId || null,
    subscriptionStatus: user.subscriptionStatus ?? null,
    subscriptionType: user.subscriptionType ?? null,
    isGrcAdded: user.isGrcAdded ?? false,
    isTprmAdded: user.isTprmAdded ?? false,
    isInternalAuditEnabled: user.isInternalAuditEnabled ?? false,
    roles: user.roles || [],
    permissions: user.permissions || [],
  };
}

// ==================== TPRM AM/SME HELPERS ====================

import prisma from '@/lib/prisma';

/**
 * Resolve the effective Account Manager email for vendor access.
 * - If the user is an AccountManager, returns their own email.
 * - If the user is an SME (TPRMSME role), looks up their creator (the AM) and returns the AM's email.
 * This allows SMEs to access the same vendor assessments as their parent AM.
 */
export async function getAMEmail(session: AuthenticatedRequest['user']): Promise<string | null> {
  const isSME = session.roles.includes('TPRMSME');

  if (!isSME) {
    return session.email?.toLowerCase() || null;
  }

  // SME: look up the creator (Account Manager) and return their email
  const smeUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { createdById: true },
  });

  if (!smeUser?.createdById) return null;

  const amUser = await prisma.user.findUnique({
    where: { id: smeUser.createdById },
    select: { email: true },
  });

  return amUser?.email?.toLowerCase() || null;
}

/**
 * Find vendor IDs accessible by the current user (AM or SME).
 * For AMs: vendors where accountManagerEmail matches their email.
 * For SMEs: vendors where accountManagerEmail matches their parent AM's email.
 */
export async function getAMVendorIds(session: AuthenticatedRequest['user'], customerAccountId: string): Promise<string[]> {
  const amEmail = await getAMEmail(session);
  if (!amEmail) return [];

  const vendors = await prisma.tPRMVendor.findMany({
    where: {
      customerAccountId,
      accountManagerEmail: { contains: amEmail, mode: 'insensitive' },
    },
    select: { id: true },
  });

  return vendors.map(v => v.id);
}

/**
 * Verify AM/SME access to a specific assessment's vendor.
 * Returns true if the user (AM or SME) has access to the vendor.
 */
export async function verifyAMAccess(session: AuthenticatedRequest['user'], vendorAccountManagerEmail: string | null): Promise<boolean> {
  const amEmail = await getAMEmail(session);
  if (!amEmail || !vendorAccountManagerEmail) return false;
  return vendorAccountManagerEmail.toLowerCase().includes(amEmail);
}

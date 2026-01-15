"use client";

import { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { hasPermission, type Action, type UserPermission } from "@/lib/permissions";

interface PermissionGateProps {
  /**
   * The resource to check permission for (e.g., 'compliance.governance')
   */
  resource: string;
  /**
   * The action to check (e.g., 'create', 'edit', 'delete', 'approve')
   */
  action: Action;
  /**
   * Content to render if permission is granted
   */
  children: ReactNode;
  /**
   * Optional content to render if permission is denied
   * @default null (renders nothing)
   */
  fallback?: ReactNode;
  /**
   * If true, shows children while session is loading
   * @default false
   */
  showWhileLoading?: boolean;
}

/**
 * Conditionally renders children based on user's permission.
 * Use this to show/hide UI elements based on what the user can do.
 *
 * @example
 * ```tsx
 * // Simple usage - hide button if no permission
 * <PermissionGate resource="compliance.governance" action="create">
 *   <Button>Create Policy</Button>
 * </PermissionGate>
 *
 * // With fallback - show disabled button instead
 * <PermissionGate
 *   resource="compliance.governance"
 *   action="delete"
 *   fallback={<Button disabled>Delete (No Permission)</Button>}
 * >
 *   <Button variant="destructive">Delete</Button>
 * </PermissionGate>
 *
 * // In table actions
 * <TableCell>
 *   <PermissionGate resource="risk.register" action="edit">
 *     <Button size="sm">Edit</Button>
 *   </PermissionGate>
 *   <PermissionGate resource="risk.register" action="approve">
 *     <Button size="sm" variant="outline">Approve</Button>
 *   </PermissionGate>
 * </TableCell>
 * ```
 */
export function PermissionGate({
  resource,
  action,
  children,
  fallback = null,
  showWhileLoading = false,
}: PermissionGateProps) {
  const { data: session, status } = useSession();

  // Handle loading state
  if (status === "loading") {
    return showWhileLoading ? <>{children}</> : null;
  }

  // Check permission
  const permissions = session?.user?.permissions as UserPermission[] | undefined;
  const hasAccess = permissions ? hasPermission(permissions, resource, action) : false;

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface MultiPermissionGateProps {
  /**
   * Array of permission checks - user needs ALL of them to see children
   */
  permissions: Array<{ resource: string; action: Action }>;
  /**
   * Content to render if all permissions are granted
   */
  children: ReactNode;
  /**
   * Optional content to render if any permission is denied
   */
  fallback?: ReactNode;
  /**
   * If true, user needs only ONE of the permissions (OR logic)
   * @default false (requires ALL permissions - AND logic)
   */
  requireAny?: boolean;
}

/**
 * Check multiple permissions at once.
 * By default, requires ALL permissions (AND logic).
 * Set requireAny=true for OR logic.
 *
 * @example
 * ```tsx
 * // Require both permissions (AND)
 * <MultiPermissionGate
 *   permissions={[
 *     { resource: 'compliance.governance', action: 'edit' },
 *     { resource: 'compliance.governance', action: 'approve' }
 *   ]}
 * >
 *   <Button>Edit & Approve</Button>
 * </MultiPermissionGate>
 *
 * // Require any permission (OR)
 * <MultiPermissionGate
 *   permissions={[
 *     { resource: 'risk.register', action: 'create' },
 *     { resource: 'risk.register', action: 'edit' }
 *   ]}
 *   requireAny
 * >
 *   <Button>Modify Risk</Button>
 * </MultiPermissionGate>
 * ```
 */
export function MultiPermissionGate({
  permissions: requiredPermissions,
  children,
  fallback = null,
  requireAny = false,
}: MultiPermissionGateProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return null;
  }

  const userPermissions = session?.user?.permissions as UserPermission[] | undefined;
  if (!userPermissions) {
    return <>{fallback}</>;
  }

  const checkResults = requiredPermissions.map(({ resource, action }) =>
    hasPermission(userPermissions, resource, action)
  );

  const hasAccess = requireAny
    ? checkResults.some(Boolean) // OR logic
    : checkResults.every(Boolean); // AND logic

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RoleGateProps {
  /**
   * Role(s) required to see children
   */
  roles: string | string[];
  /**
   * Content to render if user has the role(s)
   */
  children: ReactNode;
  /**
   * Optional content to render if user doesn't have the role(s)
   */
  fallback?: ReactNode;
  /**
   * If true, user needs only ONE of the roles (OR logic)
   * @default true (requires ANY role)
   */
  requireAny?: boolean;
}

/**
 * Conditionally render based on user's role(s).
 * Use sparingly - prefer PermissionGate for most cases.
 * Only use RoleGate when UI significantly differs by role (not just permissions).
 *
 * @example
 * ```tsx
 * // Show only to CustomerAdministrator (for unique card-grid UI)
 * <RoleGate roles="CustomerAdministrator">
 *   <FrameworkCardGrid />
 * </RoleGate>
 *
 * // Show to any audit role
 * <RoleGate roles={['AuditHead', 'AuditManager', 'Auditor']}>
 *   <AuditSpecificFeature />
 * </RoleGate>
 * ```
 */
export function RoleGate({
  roles,
  children,
  fallback = null,
  requireAny = true,
}: RoleGateProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return null;
  }

  const userRoles = (session?.user?.roles as string[]) || [];
  const requiredRoles = Array.isArray(roles) ? roles : [roles];

  const hasRole = requireAny
    ? requiredRoles.some((role) => userRoles.includes(role))
    : requiredRoles.every((role) => userRoles.includes(role));

  if (!hasRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

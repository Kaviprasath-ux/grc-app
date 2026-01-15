"use client";

import { useSession } from "next-auth/react";
import { useMemo } from "react";
import {
  hasPermission,
  getPermissionScope,
  type Action,
  type Scope,
  type UserPermission
} from "@/lib/permissions";

export interface PermissionState {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  isLoading: boolean;
  scope: Scope | null;
}

/**
 * Hook to check permissions for a specific resource.
 * Returns permission states for all actions on the resource.
 *
 * @param resource - The resource identifier (e.g., 'compliance.governance')
 * @returns Permission state object with boolean flags for each action
 *
 * @example
 * ```tsx
 * const { canCreate, canEdit, canApprove, isLoading } = usePermissions('compliance.governance');
 *
 * if (isLoading) return <Spinner />;
 *
 * return (
 *   <div>
 *     {canCreate && <Button>Create</Button>}
 *     {canEdit && <Button>Edit</Button>}
 *     {canApprove && <Button>Approve</Button>}
 *   </div>
 * );
 * ```
 */
export function usePermissions(resource: string): PermissionState {
  const { data: session, status } = useSession();

  return useMemo(() => {
    const permissions = session?.user?.permissions as UserPermission[] | undefined;
    const isLoading = status === "loading";

    if (!permissions || isLoading) {
      return {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        isLoading,
        scope: null,
      };
    }

    return {
      canView: hasPermission(permissions, resource, "view"),
      canCreate: hasPermission(permissions, resource, "create"),
      canEdit: hasPermission(permissions, resource, "edit"),
      canDelete: hasPermission(permissions, resource, "delete"),
      canApprove: hasPermission(permissions, resource, "approve"),
      isLoading: false,
      scope: getPermissionScope(permissions, resource, "view"),
    };
  }, [session?.user?.permissions, status, resource]);
}

/**
 * Hook to check a single permission.
 * Use this for simple permission checks without needing all actions.
 *
 * @param resource - The resource identifier
 * @param action - The action to check
 * @returns Boolean indicating if permission is granted
 *
 * @example
 * ```tsx
 * const canCreatePolicy = useHasPermission('compliance.governance', 'create');
 * ```
 */
export function useHasPermission(resource: string, action: Action): boolean {
  const { data: session, status } = useSession();

  return useMemo(() => {
    if (status === "loading") return false;
    const permissions = session?.user?.permissions as UserPermission[] | undefined;
    if (!permissions) return false;
    return hasPermission(permissions, resource, action);
  }, [session?.user?.permissions, status, resource, action]);
}

/**
 * Hook to get the permission scope for a resource.
 * Useful for filtering data based on department/own scope.
 *
 * @param resource - The resource identifier
 * @param action - The action to check scope for
 * @returns The scope ('all', 'department', 'own') or null if no permission
 *
 * @example
 * ```tsx
 * const scope = usePermissionScope('risk.register', 'view');
 * // scope === 'department' means only show department's risks
 * ```
 */
export function usePermissionScope(resource: string, action: Action): Scope | null {
  const { data: session, status } = useSession();

  return useMemo(() => {
    if (status === "loading") return null;
    const permissions = session?.user?.permissions as UserPermission[] | undefined;
    if (!permissions) return null;
    return getPermissionScope(permissions, resource, action);
  }, [session?.user?.permissions, status, resource, action]);
}

/**
 * Hook to get user's roles.
 * Useful for role-specific UI rendering (when UI differs significantly by role).
 *
 * @returns Array of role names or empty array if not loaded
 *
 * @example
 * ```tsx
 * const roles = useUserRoles();
 * const isAuditHead = roles.includes('AuditHead');
 * ```
 */
export function useUserRoles(): string[] {
  const { data: session, status } = useSession();

  return useMemo(() => {
    if (status === "loading") return [];
    return (session?.user?.roles as string[]) || [];
  }, [session?.user?.roles, status]);
}

/**
 * Hook to check if user has a specific role.
 *
 * @param role - The role name to check
 * @returns Boolean indicating if user has the role
 *
 * @example
 * ```tsx
 * const isCustomerAdmin = useHasRole('CustomerAdministrator');
 * ```
 */
export function useHasRole(role: string): boolean {
  const roles = useUserRoles();
  return roles.includes(role);
}

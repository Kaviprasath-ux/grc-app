import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Role name to kebab-case folder name mapping
 */
const ROLE_PATH_MAP: Record<string, string> = {
  GRCAdministrator: "grc-administrator",
  CustomerAdministrator: "customer-administrator",
  AuditHead: "audit-head",
  AuditManager: "audit-manager",
  AuditUser: "audit-user",
  Auditor: "auditor",
  Auditee: "auditee",
  Reviewer: "reviewer",
  Contributor: "contributor",
  DepartmentReviewer: "department-reviewer",
  DepartmentContributor: "department-contributor",
};

/**
 * Paths that have role-specific versions with genuinely different UI.
 *
 * IMPORTANT: Only paths with fundamentally different UI/functionality should
 * be listed here. For most pages, use permission-based rendering instead
 * of creating duplicate role-specific pages.
 *
 * @see src/hooks/usePermissions.ts for permission-based rendering
 * @see src/components/ui/permission-gate.tsx for conditional rendering
 */
const ROLE_SPECIFIC_PATHS: Record<string, string[]> = {
  // CustomerAdministrator has unique card-grid UI with subscription management
  // (vs table view for other roles) - keep as exception
  "/compliance/framework": ["CustomerAdministrator"],
};

/**
 * Get primary role for path transformation
 */
function getPrimaryRole(roles: string[]): string {
  const rolePriority = [
    "AuditHead",
    "AuditManager",
    "Auditor",
    "AuditUser",
    "Auditee",
    "GRCAdministrator",
    "CustomerAdministrator",
    "Reviewer",
    "DepartmentReviewer",
    "Contributor",
    "DepartmentContributor",
  ];

  for (const role of rolePriority) {
    if (roles.includes(role)) {
      return role;
    }
  }

  return roles[0] || "Contributor";
}

/**
 * Check if a path should be redirected to role-specific version
 */
function shouldRedirectToRolePath(pathname: string): string | null {
  // Check exact matches first
  if (ROLE_SPECIFIC_PATHS[pathname]) {
    return pathname;
  }

  // Check if pathname starts with any role-specific base path
  for (const basePath of Object.keys(ROLE_SPECIFIC_PATHS)) {
    if (pathname.startsWith(basePath + "/")) {
      return basePath;
    }
  }

  return null;
}

/**
 * Check if user has access to a role-specific path
 */
function hasAccessToRolePath(pathname: string, userRoles: string[]): boolean {
  // Extract role from path like /roles/auditor/internal-audit/...
  const match = pathname.match(/^\/roles\/([^\/]+)/);
  if (!match) return true;

  const pathRole = match[1];

  // Find the role that matches this path
  for (const [role, kebabRole] of Object.entries(ROLE_PATH_MAP)) {
    if (kebabRole === pathRole) {
      // Check if user has this role
      return userRoles.includes(role);
    }
  }

  return false;
}

/**
 * Check if a role-specific path should be redirected to base path.
 * Returns the base path if it should redirect, null otherwise.
 *
 * This handles deprecated role-specific paths that no longer need
 * role-specific versions (now using permission-based rendering).
 */
function getBasePathFromRoleSpecificPath(pathname: string): string | null {
  // Match paths like /roles/reviewer/compliance/governance
  const match = pathname.match(/^\/roles\/[^\/]+(\/.+)$/);
  if (!match) return null;

  const basePath = match[1];

  // Check if this base path still needs role-specific handling
  // If it's in ROLE_SPECIFIC_PATHS, don't redirect (it's still role-specific)
  for (const path of Object.keys(ROLE_SPECIFIC_PATHS)) {
    if (basePath === path || basePath.startsWith(path + "/")) {
      return null; // Don't redirect - this path is still role-specific
    }
  }

  // This role-specific path is deprecated - return base path for redirect
  return basePath;
}

export default auth((request) => {
  const { pathname } = request.nextUrl;

  // Skip middleware for non-protected routes
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Get user session from auth
  const session = request.auth;

  // If not authenticated, let the auth system handle it
  if (!session?.user) {
    return NextResponse.next();
  }

  const userRoles = (session.user.roles as string[]) || [];

  // Check if user is trying to access a role-specific path
  if (pathname.startsWith("/roles/")) {
    // First check if this is a deprecated role-specific path that should redirect to base
    const basePath = getBasePathFromRoleSpecificPath(pathname);
    if (basePath) {
      // Redirect to base path - the page now uses permission-based rendering
      return NextResponse.redirect(new URL(basePath, request.url));
    }

    // For paths that are still role-specific, check if user has access
    if (!hasAccessToRolePath(pathname, userRoles)) {
      // Redirect to dashboard or unauthorized page
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Check if this is a shared path that should redirect to role-specific version
  const basePath = shouldRedirectToRolePath(pathname);
  if (basePath && ROLE_SPECIFIC_PATHS[basePath]) {
    const primaryRole = getPrimaryRole(userRoles);
    const allowedRoles = ROLE_SPECIFIC_PATHS[basePath];

    // Only redirect if user's primary role has a role-specific version
    if (allowedRoles.includes(primaryRole)) {
      const rolePath = ROLE_PATH_MAP[primaryRole];
      if (rolePath) {
        // Construct the new path
        const newPath = `/roles/${rolePath}${pathname}`;
        return NextResponse.redirect(new URL(newPath, request.url));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

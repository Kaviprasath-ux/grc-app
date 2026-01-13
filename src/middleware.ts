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
 * Paths that have role-specific versions
 */
const ROLE_SPECIFIC_PATHS: Record<string, string[]> = {
  // Organization module shared pages
  "/dashboard": ["CustomerAdministrator", "AuditUser", "Auditor", "Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/organization/context": ["CustomerAdministrator", "Reviewer", "DepartmentReviewer", "DepartmentContributor"],
  "/organization/users": ["CustomerAdministrator", "DepartmentReviewer", "DepartmentContributor"],
  "/organization/process": ["CustomerAdministrator", "Auditor", "Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  // Compliance module shared pages
  "/compliance/framework": ["GRCAdministrator", "Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/compliance/control": ["GRCAdministrator", "Auditor", "Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/compliance/governance": ["GRCAdministrator", "Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/compliance/evidence": ["GRCAdministrator", "Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/compliance/domain": ["GRCAdministrator"],
  "/compliance/exceptions": ["Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/compliance/kpis": ["Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  // Asset module shared pages
  "/assets/inventory": ["Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/assets/classification": ["Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/assets/reports": ["Reviewer", "DepartmentReviewer", "DepartmentContributor"],
  // Risk module shared pages
  "/risks/dashboard": ["Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/risks/register": ["Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/risks/assessment": ["Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/risks/response": ["Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  "/risks/reports": ["Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"],
  // Internal Audit module shared pages (including sub-pages)
  "/internal-audit/dashboard": ["AuditHead", "AuditManager", "AuditUser", "Auditor"],
  "/internal-audit/audit-universe": ["AuditHead", "AuditManager", "AuditUser", "Auditor"],
  "/internal-audit/risk-identification": ["AuditHead", "AuditManager", "AuditUser", "Auditor"],
  "/internal-audit/risk-register": ["AuditHead", "AuditManager", "AuditUser", "Auditor", "DepartmentReviewer", "DepartmentContributor"],
  "/internal-audit/audit-planning": ["AuditHead", "AuditManager", "AuditUser", "Auditor"],
  "/internal-audit/fieldwork": ["AuditHead", "AuditManager", "AuditUser", "Auditor", "Auditee"],
  "/internal-audit/report": ["AuditHead", "AuditManager", "AuditUser", "Auditor", "Auditee"],
  "/internal-audit/capa-tracking": ["AuditHead", "AuditManager", "AuditUser", "Auditor", "Auditee"],
  "/internal-audit/document-library": ["AuditHead", "AuditManager", "AuditUser", "Auditor"],
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

  // Check if user is trying to access a role-specific path they don't have access to
  if (pathname.startsWith("/roles/")) {
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

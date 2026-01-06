import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { canAccessRoute, expandRolePermissions } from "@/lib/permissions";

// Public routes that don't require authentication
const publicRoutes = ["/login", "/register", "/forgot-password"];

// Routes that are accessible to all authenticated users
const authOnlyRoutes = ["/dashboard", "/profile", "/settings", "/api"];

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isLoggedIn = !!req.auth;

  // Check if public route
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // API routes are handled separately (by API auth wrapper)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated and trying to access protected route
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Redirect to dashboard if authenticated and trying to access login
  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // For authenticated users, check permissions
  if (isLoggedIn && req.auth?.user) {
    // Auth-only routes are accessible to all authenticated users
    const isAuthOnlyRoute = authOnlyRoutes.some(route => pathname.startsWith(route));
    if (isAuthOnlyRoute) {
      return NextResponse.next();
    }

    // Expand permissions from roles (roles are stored in JWT, permissions are computed)
    const roles = (req.auth.user.roles as string[]) || [];
    const permissions = expandRolePermissions(roles);

    // Check if user can access this route
    if (!canAccessRoute(permissions, pathname)) {
      // Redirect to dashboard with access denied flag
      const dashboardUrl = new URL("/dashboard", nextUrl);
      dashboardUrl.searchParams.set("accessDenied", "true");
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

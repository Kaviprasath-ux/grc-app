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

  // Redirect to appropriate landing page if authenticated and trying to access login
  if (isLoggedIn && isPublicRoute) {
    const userRoles = req.auth?.user?.roles as string[] | undefined;
    if (userRoles?.includes("GRCAdministrator")) {
      return NextResponse.redirect(new URL("/grc", nextUrl));
    }
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // For authenticated users, check permissions
  if (isLoggedIn && req.auth) {
    // Auth-only routes are accessible to all authenticated users
    const isAuthOnlyRoute = authOnlyRoutes.some(route => pathname.startsWith(route));
    if (isAuthOnlyRoute) {
      return NextResponse.next();
    }

    // In NextAuth v5, req.auth is the Session object with user.roles
    const userRoles = req.auth.user?.roles as string[] | undefined;
    const roles = userRoles || [];
    const permissions = expandRolePermissions(roles);

    // Check if user can access this route
    if (!canAccessRoute(permissions, pathname)) {
      // Redirect to appropriate landing page with access denied flag
      const landingPage = roles.includes("GRCAdministrator") ? "/grc" : "/dashboard";
      const redirectUrl = new URL(landingPage, nextUrl);
      redirectUrl.searchParams.set("accessDenied", "true");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

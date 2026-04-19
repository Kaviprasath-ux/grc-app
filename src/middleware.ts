import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  RESOURCES,
  hasPermission,
  type UserPermission,
} from "@/lib/permissions";

// Reverse of RESOURCES — `/tprm/user-management` → `tprm.user-management`.
// Built once at module load. Used for EXACT-match auth checks only; sub-routes
// (e.g. `/tprm/monitoring/[id]`) are intentionally left to the page/API to
// enforce, because many detail pages are shared across roles that have
// different parent-resource keys (tprm.monitoring vs tprm.bo-monitoring etc).
const ROUTE_TO_RESOURCE: Record<string, string> = Object.entries(RESOURCES)
  .reduce<Record<string, string>>((acc, [resource, path]) => {
    acc[path] = resource;
    return acc;
  }, {});

/**
 * NextAuth v5 middleware.
 *
 * 1) Authentication — unauthenticated requests are redirected to
 *    /login?callbackUrl=<original-path>&username=<emailUser>
 * 2) Authorization — when the URL *exactly* matches a registered resource
 *    landing page (see `RESOURCES` in permissions.ts), the session must
 *    include a `view` permission for that resource. Otherwise the user is
 *    redirected to `/` with ?accessDenied=1. This blocks direct URL
 *    navigation to admin-only pages (e.g. a BusinessOwner typing
 *    `/tprm/user-management`).
 *
 *    Sub-routes like `/tprm/monitoring/abc-123` fall through because those
 *    detail pages are shared across roles with different parent-resource
 *    keys (tprm.monitoring, tprm.bo-monitoring, tprm.rm-monitoring…). The
 *    underlying API route + server-side data filtering already gate them.
 *
 * The session callback in auth.ts already populates
 * `session.user.permissions` so no extra computation is needed here.
 */
export default auth((req) => {
  const { pathname, searchParams } = req.nextUrl;

  // ── 1) Authentication ──
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);

    // Forward ?emailUser= as ?username= for login pre-fill
    const emailUser = searchParams.get("emailUser");
    if (emailUser) {
      loginUrl.searchParams.set("username", emailUser);
    }

    return NextResponse.redirect(loginUrl);
  }

  // ── 2) Authorization (exact-match only) ──
  const normalized = pathname.replace(/\/$/, "");
  const resource = ROUTE_TO_RESOURCE[normalized];
  if (resource) {
    const permissions = (req.auth.user?.permissions ?? []) as UserPermission[];
    if (!hasPermission(permissions, resource, "view")) {
      const homeUrl = new URL("/", req.url);
      homeUrl.searchParams.set("accessDenied", "1");
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  // Match all protected routes, exclude public ones
  matcher: [
    /*
     * Match all request paths except:
     * - /login (auth page)
     * - /api (API routes handle their own auth)
     * - /_next (Next.js internals)
     * - /favicon.ico, /logo*, /icons, etc. (static assets)
     */
    "/((?!login|api|_next|favicon\\.ico|logo|icons|uploads).*)",
  ],
};

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

const SUBSCRIPTION_GATING_ENABLED = process.env.SUBSCRIPTION_GATING_ENABLED === "true";

// Paths that remain accessible even for SUSPENDED customers (so they can renew
// or contact support). Everything else under module routes redirects to the
// subscription page when SUSPENDED.
const SUSPENDED_ALLOWLIST_PREFIXES = [
  "/settings/subscription", // billing portal — primary renewal path
  "/login",
  "/logout",
  "/signup",
];

function isSuspendedAllowlisted(pathname: string): boolean {
  return SUSPENDED_ALLOWLIST_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

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

  // ── 0) HTTPS enforcement ──
  // Belt-and-suspenders. DigitalOcean App Platform terminates TLS at its proxy
  // and forwards x-forwarded-proto. If anything ever served us via plain HTTP
  // (misconfigured proxy, internal probe), 301 it to HTTPS so the browser
  // upgrades and HSTS does its job.
  if (process.env.NODE_ENV === "production") {
    const proto = req.headers.get("x-forwarded-proto");
    if (proto === "http") {
      const httpsUrl = new URL(req.url);
      httpsUrl.protocol = "https:";
      return NextResponse.redirect(httpsUrl, 301);
    }
  }

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

  // ── 3) Subscription gating (feature-flagged) ──
  // When SUBSCRIPTION_GATING_ENABLED=true, customers in SUSPENDED state are
  // redirected to /settings/subscription on any non-allowlisted page so they
  // can renew. The full-page interstitial banner (subscription-banner.tsx)
  // covers any case where the redirect somehow doesn't fire (defence in depth).
  if (SUBSCRIPTION_GATING_ENABLED) {
    const status = req.auth.user?.subscriptionStatus;
    if (status === "SUSPENDED" && !isSuspendedAllowlisted(pathname)) {
      const renewUrl = new URL("/settings/subscription", req.url);
      renewUrl.searchParams.set("suspended", "1");
      return NextResponse.redirect(renewUrl);
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
    "/((?!login|signup|api|_next|favicon\\.ico|logo|icons|uploads).*)",
  ],
};

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * NextAuth v5 middleware for auth redirect.
 * Unauthenticated users clicking email deep-links are redirected to
 * /login?callbackUrl=<original-path>&username=<emailUser>
 */
export default auth((req) => {
  const { pathname, searchParams } = req.nextUrl;

  // If user is not authenticated, redirect to login with callbackUrl
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

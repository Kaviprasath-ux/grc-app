# Middleware

## Table of Contents
1. [What is Middleware?](#what-is-middleware)
2. [Next.js Middleware](#nextjs-middleware)
3. [How It Intercepts All Requests](#how-it-intercepts-all-requests)
4. [Authentication Check](#authentication-check)
5. [Protected Routes](#protected-routes)
6. [Public Routes](#public-routes)
7. [Redirect Flow for Unauthenticated Users](#redirect-flow)
8. [How to Add New Public Routes](#how-to-add-new-public-routes)
9. [API Middleware — withAuth in api-auth.ts](#api-middleware)
10. [Session Validation](#session-validation)
11. [Permission Checking in withAuth](#permission-checking-in-withauth)
12. [Tenant Filter Building](#tenant-filter-building)
13. [Audit Trail Capture](#audit-trail-capture)
14. [withAuth vs withAuthOnly](#withauth-vs-withauthonly)

---

## What is Middleware?

Imagine a nightclub with a bouncer at the door. Every person who wants to enter must pass through the bouncer first. The bouncer checks:
1. Is this person on the guest list? (Are they authenticated?)
2. Do they have the right wristband for VIP area? (Do they have the right permissions?)
3. Are they dressed appropriately? (Do they meet other requirements?)

Depending on the answers, the bouncer either lets them in, directs them to a different area, or turns them away.

**Middleware** in a web application works exactly the same way. It is code that runs **between** the incoming HTTP request and the destination route handler. Every request — whether to a page or an API endpoint — passes through middleware first.

Middleware can:
- **Inspect** the request (read cookies, headers, URL)
- **Allow** the request to proceed to its destination
- **Redirect** the request to a different URL
- **Reject** the request with an error response

In the GRC application, middleware enforces authentication: unauthenticated users trying to access protected pages are redirected to `/login`.

---

## Next.js Middleware

In the Next.js App Router, middleware is defined in a file at the root of the project or in `src/`. The file must be named exactly `middleware.ts`.

This application's middleware is implemented through NextAuth v5's built-in Next.js integration. The `auth` export from `src/lib/auth.ts` itself acts as the middleware when configured correctly.

Looking at `src/lib/auth.ts`, NextAuth is configured with:
1. **Credential-based authentication** (username + password, verified against the database)
2. **Google OAuth** (sign in with Google)
3. **Microsoft Entra ID OAuth** (sign in with Microsoft work accounts)
4. **JWT session strategy** — sessions are stored in encrypted cookies, not the database

The middleware configuration tells Next.js which routes to protect:

```ts
// The matcher config (in NextAuth/middleware setup) tells Next.js
// which paths to run the middleware on
export const config = {
  matcher: [
    // Protect all routes except these:
    "/((?!api/auth|api/cron|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

---

## How It Intercepts All Requests

The `matcher` array in the middleware config uses a **negative lookahead regex** to match "everything except these specific paths."

```
/((?!api/auth|api/cron|login|_next/static|_next/image|favicon.ico).*)
```

Breaking it down:
- `/` — Match paths starting with /
- `(` — Start of capture group
- `(?!...)` — Negative lookahead: NOT followed by these strings
  - `api/auth` — NextAuth's own endpoints
  - `api/cron` — Cron job endpoints (authenticated differently)
  - `login` — The login page
  - `_next/static` — Next.js static assets (JS bundles, CSS)
  - `_next/image` — Next.js image optimisation endpoint
  - `favicon.ico` — Browser favicon
- `.*` — Match any remaining characters
- `)` — End capture group

**In plain English**: Run the middleware on all requests EXCEPT the login page, NextAuth APIs, cron endpoints, and static assets.

### Execution Flow

```
Request arrives
      ↓
Does URL match the matcher pattern?
  NO  → Skip middleware (static assets, login, auth routes)
  YES ↓
Does the request have a valid NextAuth session cookie?
  YES → Request proceeds to the page/API
  NO  ↓
Is this an API route (/api/...)?
  YES → Return 401 Unauthorized JSON
  NO  ↓
Redirect to /login?callbackUrl=ORIGINAL_URL
```

---

## Authentication Check

The authentication check reads the user's JWT from their browser cookie. NextAuth handles all the cryptographic complexity of verifying the JWT's signature and expiry.

The middleware calls `auth()` (from NextAuth), which:

1. Reads the `next-auth.session-token` cookie from the request
2. Decrypts and verifies the JWT using the `NEXTAUTH_SECRET` environment variable
3. Returns the session object (with user data) if valid, or `null` if invalid/expired

```ts
// Inside the middleware
const session = await auth();

if (!session) {
  // No valid session → unauthenticated
  // Redirect to login (for pages) or return 401 (for API routes)
}
```

---

## Protected Routes

After the login page, the `(protected)` route group in `src/app/(protected)/` contains all authenticated routes. These are the pages that require a logged-in user.

Examples:
```
/dashboard                          → Protected
/risks/register                     → Protected
/compliance/governance              → Protected
/internal-audit/dashboard           → Protected
```

The middleware's matcher catches all requests to these URLs. If no valid session exists, the user is redirected to `/login`.

### Additional Protection at the API Level

The route-level middleware is the **first line of defence** — it prevents unauthenticated access to pages. But API routes have a **second line of defence** through the `withAuth` wrapper (covered in detail below and in API-Patterns.md).

This layered approach means:
- A user without a session cannot reach any page or API
- A user with a session but wrong permissions cannot reach certain APIs even if they navigate directly to the URL

---

## Public Routes

Routes NOT protected by the middleware. Accessible without any authentication:

### `/login`

The login page. Users enter their username and password here to authenticate.

### `/api/auth/[...nextauth]`

NextAuth's own API endpoints. These handle the authentication flow itself:
- `POST /api/auth/signin` — Verify credentials and issue a session cookie
- `GET /api/auth/signout` — Clear the session cookie
- `GET /api/auth/session` — Return current session data (used by `useSession()`)
- `GET /api/auth/providers` — List available auth providers

These MUST be public — the login page calls them to authenticate the user.

### `/api/cron/due-reminders`

The cron job endpoint that sends due-date reminder notifications. This is called by Vercel Cron on a schedule, not by users in browsers.

It uses a different authentication mechanism — a Bearer token in the `Authorization` header:

```ts
// In production, the cron endpoint requires:
// Authorization: Bearer YOUR_CRON_SECRET

// In development, it runs without auth (CRON_SECRET env var not set)
```

The reason this is excluded from the session-cookie middleware: Vercel Cron calls this endpoint from a server environment and cannot provide a browser session cookie.

### `/_next/static` and `/_next/image`

Next.js internal routes for serving JavaScript bundles, CSS files, and optimised images. These are public because:
- Static assets have no sensitive data
- The login page itself needs to load CSS and JavaScript

---

## Redirect Flow for Unauthenticated Users

When an unauthenticated user tries to access a protected page, the redirect flow is:

```
User opens browser → navigates to /risks/register
              ↓
Middleware runs → no session cookie found
              ↓
Middleware redirects to: /login?callbackUrl=%2Frisks%2Fregister
              ↓
User sees login page
              ↓
User enters credentials → NextAuth verifies → sets session cookie
              ↓
User is redirected back to /risks/register (the original URL)
```

The `callbackUrl` query parameter preserves the intended destination. After successful login, NextAuth reads the `callbackUrl` and redirects there automatically.

### Security Considerations

1. The `callbackUrl` is validated to ensure it is a relative URL on the same domain. External redirect URLs are rejected to prevent open redirect attacks.
2. The session cookie is:
   - `httpOnly` — Cannot be accessed by JavaScript (prevents XSS theft)
   - `secure` — Only sent over HTTPS in production
   - `sameSite: "lax"` — Prevents CSRF attacks

---

## How to Add New Public Routes

If you need to add a new route that does not require authentication (e.g., a public registration page or a health check endpoint), update the middleware matcher configuration.

The middleware matcher is configured in `src/lib/auth.ts` (within the NextAuth `config` export) or in the root `middleware.ts` file (if one exists).

### Option 1: Add to the matcher exclusion list

```ts
export const config = {
  matcher: [
    "/((?!api/auth|api/cron|api/health|login|register|_next/static|_next/image|favicon.ico).*)",
    //                       ^^^^^^^^^^^  ^^^^^^^^
    //                       Added health check endpoint and register page
  ],
};
```

### Option 2: Check inside the middleware (for conditional logic)

If the route needs to be conditionally public (e.g., public in development only):

```ts
// In the middleware function
const pathname = req.nextUrl.pathname;

if (pathname.startsWith("/api/health") || pathname.startsWith("/public/")) {
  return NextResponse.next(); // Allow through without auth check
}
```

---

## API Middleware

The `withAuth` function in `src/lib/api-auth.ts` is the **second layer of middleware**, applied at the individual API route level. While Next.js middleware handles authentication at the routing level, `withAuth` performs fine-grained permission checks specific to each endpoint.

Every API route in the application uses one of two wrappers:
- `withAuth(handler, { resource, action })` — Requires authentication AND a specific permission
- `withAuthOnly(handler)` — Requires authentication only, no permission check

---

## Session Validation

Inside `withAuth`, session validation happens through NextAuth's `auth()` function:

```ts
const session = await auth();

if (!session?.user) {
  return unauthorized(); // { error: "Authentication required" }, 401
}
```

`auth()` is Next.js middleware-aware: in API routes, it reads the session from the request's cookies. It performs:

1. **Cookie extraction** — reads the `next-auth.session-token` cookie
2. **JWT decryption** — decrypts using `NEXTAUTH_SECRET`
3. **Signature verification** — ensures the token has not been tampered with
4. **Expiry check** — rejects expired tokens
5. **Session data expansion** — the `jwt` callback in `auth.ts` expands the token with the user's roles, permissions, customerAccountId, and module flags

### The Session Object

After successful validation, `session.user` contains:

```ts
{
  id: string;                 // User's database ID (cuid)
  name: string;               // Display name
  email: string;              // Email address
  roles: string[];            // e.g., ["CustomerAdministrator", "AuditHead"]
  permissions: UserPermission[]; // Expanded from ROLE_PERMISSIONS in permissions.ts
  customerAccountId: string | null;   // Multi-tenant identifier
  customerAccountCode: string | null; // Short code for the account
  customerAccountName: string | null; // Display name of the account
  departmentId: string | null;    // For department-scoped access
  departmentName: string | null;
  auditHeadId: string | null;     // For audit team isolation
  subscriptionStatus: string | null;
  subscriptionType: string | null;
  isGrcAdded: boolean;            // Has GRC module
  isTprmAdded: boolean;           // Has TPRM module
  isInternalAuditEnabled: boolean; // Has Internal Audit module
}
```

---

## Permission Checking in withAuth

After session validation, `withAuth` checks if the user has the required permission:

```ts
const resources = Array.isArray(options.resource)
  ? options.resource
  : [options.resource];

const hasAccess = resources.some(r =>
  hasPermission(user.permissions || [], r, options.action)
);

if (!hasAccess) {
  return forbidden(`You don't have permission to ${options.action} ${resources.join(' or ')}`);
}
```

`hasPermission()` (from `src/lib/permissions.ts`) checks the user's expanded permissions array for a match on:
1. **Resource** — supports exact match and wildcards (`compliance.*`)
2. **Action** — must exactly match (`view`, `create`, `edit`, `delete`, `approve`)
3. **Scope** — `all`, `department`, or `own` (context-sensitive)

The permission matrix (which role has which permissions) is defined in `ROLE_PERMISSIONS` in `src/lib/permissions.ts`. During login, NextAuth's `jwt` callback calls `expandRolePermissions()` to flatten the role → permission matrix into a flat list stored in the JWT. This means permission checking on every API call is a simple array iteration — no database lookup needed.

---

## Tenant Filter Building

After permission checking, the handler receives the authenticated user's session. The handler is responsible for building database query filters that isolate data by tenant.

The primary helper is `getTenantFilter(session)` from `src/lib/api-auth.ts`:

```ts
export function getTenantFilter(session) {
  if (session.roles.includes('GRCAdministrator')) {
    if (options?.globalAccess) return {};
    if (session.customerAccountId) return { customerAccountId: session.customerAccountId };
    return {};
  }

  // Regular users — strict tenant filter
  if (!session.customerAccountId) {
    // Safety net: no tenant = impossible filter (returns zero results)
    return { customerAccountId: '__NO_TENANT__' };
  }

  return { customerAccountId: session.customerAccountId };
}
```

The returned filter object is spread into Prisma `where` clauses:

```ts
const filter = getTenantFilter(session);
// Example return value: { customerAccountId: "cust-abc-123" }

await prisma.risk.findMany({
  where: {
    ...filter,       // Prisma receives: { customerAccountId: "cust-abc-123" }
    status: "open",  // Additional query conditions
  },
});
```

This approach ensures that even if a developer forgets to add tenant filtering in a query, there is a clear and auditable helper that handles it.

---

## Audit Trail Capture

The final step inside `withAuth` is the automatic audit trail. After the handler returns a successful response (HTTP 200-299), `withAuth` fires an asynchronous record into the audit log:

```ts
if (
  options.action !== 'view' &&      // Don't log read-only operations
  response.status >= 200 &&
  response.status < 300
) {
  void autoRecordMutation(req, context, authenticatedUser, options);
  // void = fire-and-forget, does not block the response
}
```

The `autoRecordMutation` function:

1. Resolves the action label from the HTTP method (POST → "Create", PATCH/PUT → "Update", DELETE → "Delete")
2. Extracts the record ID from route params (if available)
3. Resolves the module label from the resource string (e.g., `risk.register` → "Risk Management")
4. Reads the client IP address from request headers (`x-forwarded-for`, `x-real-ip`)
5. Writes a record to the `AuditTrail` table via Prisma

This happens asynchronously after the response is sent, so the user never waits for the audit log write.

### Audit Trail Skip List

The audit trail is intentionally skipped for these resources to prevent recursion and noise:

```ts
const AUDIT_TRAIL_SKIP_RESOURCES = new Set([
  'audit.audit-trail'  // Reading the audit trail itself would create an infinite loop
]);
```

---

## withAuth vs withAuthOnly

### withAuth

Use when the route requires both:
1. Authentication (logged-in user)
2. A specific resource + action permission

```ts
// User must be logged in AND have risk.register:create permission
export const POST = withAuth(
  async (req, context, session) => { /* ... */ },
  { resource: "risk.register", action: "create" }
);
```

### withAuthOnly

Use when the route requires authentication but no specific resource permission. Appropriate for:
- User-specific data (e.g., "get my notifications" — all users should see their own)
- User profile information
- Application-wide settings that are identical for all authenticated users

```ts
// User must be logged in (any role — no specific permission required)
export const GET = withAuthOnly(async (req, context, session) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: session.id },
  });
  return NextResponse.json({ notifications });
});
```

### Decision Guide

```
Does this route expose data from a specific module?
  YES → use withAuth with the module's resource and action
  NO (e.g., notifications, profile, general settings) → use withAuthOnly

Does the data returned vary significantly by role?
  YES → withAuth (different roles have different permitted actions)
  NO (all users see the same thing) → withAuthOnly

Is the operation dangerous (delete, modify critical data)?
  YES → always withAuth with an explicit action
  NO (read-only, user-scoped) → withAuthOnly is acceptable
```

### Summary Comparison

| Feature | `withAuth` | `withAuthOnly` |
|---------|-----------|----------------|
| Requires login | Yes | Yes |
| Checks resource permission | Yes | No |
| Supports multi-resource OR | Yes | N/A |
| Auto audit trail | Yes (mutations) | No |
| Returns 403 on wrong permission | Yes | N/A |
| Passes session to handler | Yes | Yes |

# Session Management

This document explains how the GRC application manages user sessions from first
principles: what a session is, how JWTs work, how the rolling expiry is
implemented, and how to access the session in every part of the application.

---

## Table of Contents

1. [What Is a Session?](#1-what-is-a-session)
2. [NextAuth v5 JWT Strategy](#2-nextauth-v5-jwt-strategy)
3. [JWT Token Creation and Signing](#3-jwt-token-creation-and-signing)
4. [Session Data Structure](#4-session-data-structure)
5. [Rolling Session Refresh](#5-rolling-session-refresh)
6. [Session Expiry](#6-session-expiry)
7. [Accessing the Session](#7-accessing-the-session)
8. [Multi-Tenant Session](#8-multi-tenant-session)
9. [Audit Head Isolation](#9-audit-head-isolation)
10. [OAuth Account Linking](#10-oauth-account-linking)
11. [Logout Flow](#11-logout-flow)
12. [Cookie Security Details](#12-cookie-security-details)
13. [Permission Expansion on Session Build](#13-permission-expansion-on-session-build)

---

## 1. What Is a Session?

### HTTP Is Stateless

The web protocol (HTTP) has no built-in memory. Each request-response pair is
completely independent. The server processes a request, sends a response, and
forgets the connection.

This creates a problem for applications that need to maintain state across
multiple requests (e.g., "this user is logged in and should see their dashboard").

### Three Approaches to State

**Server-side sessions**: The server generates a unique session ID, stores user
data in memory or a database keyed by that ID, and sends the ID to the client
as a cookie. On each request, the client sends the ID back, and the server
looks up the state. Simple, but requires a shared session store when running
multiple server instances.

**Client-side tokens (JWT)**: The server creates a cryptographically signed
token containing the user's state, sends it to the client, and verifies the
signature on each request. No server-side storage required. Scales horizontally.

**Database token**: A random opaque token is stored in the database alongside
expiry and user data. Useful when you need server-side invalidation (e.g.,
"revoke all sessions for a user"). Higher database load per request.

This application uses **JWT (client-side tokens)**, which is the correct choice
for a multi-instance, horizontally scaled Next.js deployment.

---

## 2. NextAuth v5 JWT Strategy

NextAuth is configured with `strategy: 'jwt'` in `src/lib/auth.ts`:

```typescript
session: {
  strategy: 'jwt',
  maxAge: 30 * 60,    // 30 minutes
  updateAge: 5 * 60,  // Refresh token every 5 minutes of activity
},
jwt: {
  maxAge: 30 * 60,
}
```

With `strategy: 'jwt'`, NextAuth:
1. Creates a signed JWT after authentication.
2. Stores the JWT in an httpOnly cookie in the user's browser.
3. On every request that reads the session, extracts the cookie, verifies
   the JWT signature, and reconstructs the session object.
4. Never stores session state in the database. (The `OAuthAccount` table stores
   OAuth linkage for audit, but not session state.)

The session validation is done with the same `NEXTAUTH_SECRET` environment
variable that was used to sign the token.

---

## 3. JWT Token Creation and Signing

### When Is the JWT Created?

The JWT is created inside the `jwt` callback in `src/lib/auth.ts`. This callback
runs in three situations:

1. **Initial login** (`user` parameter is set): Called immediately after
   `authorize()` (credentials) or after the `signIn` callback (OAuth). All
   custom fields are written to the token at this point.

2. **Token refresh** (`user` parameter is undefined): Called on subsequent
   requests when the token is more than `updateAge` seconds old. The existing
   token is passed through, extended with a new `exp` timestamp.

3. **Session read in server context**: Called when `auth()` is invoked. Returns
   the current token contents.

### The jwt Callback

```typescript
async jwt({ token, user, account }) {
  if (user) {
    // Initial login — populate all fields
    if (account?.provider === 'credentials') {
      token.id = user.id;
      token.role = user.role;
      token.roles = user.roles;
      token.permissions = user.permissions;
      token.customerAccountId = user.customerAccountId;
      // ... all other fields
    } else {
      // OAuth — user object is from provider, must re-query DB
      const dbUser = await prisma.user.findFirst({
        where: { email, isActive: true, isBlocked: false },
        select: userSelect,
      });
      const authUser = await buildAuthUser(dbUser);
      token.id = authUser.id;  // Critical: use DB id, not OAuth provider id
      // ... all other fields from authUser
    }
  }
  return token;
}
```

**Critical note on OAuth user IDs**: OAuth providers assign their own IDs to
users. Google may call a user "12345678". The GRC database has its own UUID for
that user. The `jwt` callback explicitly overwrites `token.id` with the database
UUID (`authUser.id`), not Google's ID. This ensures all application-level
database queries use the correct ID.

### The session Callback

The `session` callback transforms the JWT token into the session object that
application code uses:

```typescript
async session({ session, token }) {
  if (session.user) {
    session.user.id = token.id;
    session.user.roles = token.roles;
    // ... copy other fields from token ...

    // Expand permissions here (session callback always runs server-side)
    session.user.permissions = expandRolePermissions(
      session.user.roles,
      { isGrcAdded, isTprmAdded, isInternalAuditEnabled, ... }
    );
  }
  return session;
}
```

**Why expand permissions in session rather than jwt?**

The `jwt` callback caches the result in the cookie. If permissions were stored
in the cookie directly, every permission change would require all active users
to log out and back in. By expanding permissions inside `session()`, the
expansion happens on every request — meaning module flag changes take effect
within minutes (when the token is next refreshed).

---

## 4. Session Data Structure

The session object is typed in `src/types/next-auth.d.ts`. The `session.user`
object contains:

```typescript
{
  // Core identity
  id: string                   // Database UUID (NOT the OAuth provider's id)
  name: string | null          // Full name
  email: string | null         // Email address

  // Legacy compatibility fields
  role: string                 // Primary role name (first role in the array)
  department: string           // Department name (empty string if none)

  // Department scoping
  departmentId: string | null
  departmentName: string | null

  // Multi-tenant isolation
  customerAccountId: string | null     // Tenant UUID
  customerAccountCode: string | null   // Short code (e.g., "ACME001")
  customerAccountName: string | null   // Display name (e.g., "Acme Corporation")

  // Audit team isolation
  auditHeadId: string | null   // For audit staff: their Audit Head's user ID

  // Subscription module flags
  isGrcAdded: boolean
  isTprmAdded: boolean
  isInternalAuditEnabled: boolean
  isTechnicalEvidenceEnabled: boolean
  isQpostComplianceEnabled: boolean

  // Subscription metadata
  subscriptionStatus: SubscriptionStatus | null
  subscriptionType: SubscriptionType | null

  // RBAC
  roles: string[]              // All assigned role names, e.g., ["AuditHead"]
  roleModules: ("GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE")[]
  permissions: UserPermission[] // Expanded from roles, filtered by module flags
}
```

### What Is `roleModules`?

`roleModules` lists the module codes in which the user holds at least one role.
This powers the workspace picker (the module selection screen users see if they
have access to multiple modules like GRC + TPRM).

System roles (GRCAdministrator, TPRMAdmin, etc.) have `moduleCode: null` in the
`UserRole` table, so they are excluded from `roleModules`. The workspace picker
shows them only the modules they have explicit module-scoped role assignments in.

---

## 5. Rolling Session Refresh

The session uses a rolling expiry model: activity extends the session deadline.

**Configuration:**
```typescript
session: {
  maxAge: 30 * 60,     // 1800 seconds — token lives 30 min from last activity
  updateAge: 5 * 60,   // 300 seconds — re-issue token if older than 5 min
}
```

**How it works step-by-step:**

```
T+00:00  User logs in
         Token created: iat=0, exp=1800 (30 min from now)
         Cookie set in browser

T+05:30  User navigates to a page
         Token age = 5m30s > updateAge (5m)
         NextAuth re-issues token: new iat=330, new exp=2130
         New cookie header sent with response

T+05:45  User clicks something
         Token age = 15s < updateAge (5m)
         Token NOT re-issued (no cookie overhead)

T+35:00  User has been idle since T+05:30
         Token created at T+05:30 with exp = T+05:30 + 30m = T+35:30
         Still valid!

T+35:35  Token exp = T+35:30 has passed
         Next request finds expired token
         NextAuth treats session as null
         User redirected to /login
```

**The 5-minute `updateAge` threshold** prevents unnecessary cookie updates.
Without it, every single request (including background API calls from React Query)
would trigger a Set-Cookie response header, adding overhead.

---

## 6. Session Expiry

When a session expires (inactive for 30 minutes), the next request to any
protected route will find `session === null` and trigger the middleware redirect
to `/login`.

The login page accepts a `callbackUrl` query parameter. After successful
re-authentication, the user is returned to the page they were on.

**Note**: Session expiry is silent. The user does not see a warning countdown.
If they try to submit a form after expiry, the API request will return HTTP 401,
and the client-side error handler should redirect to `/login`.

---

## 7. Accessing the Session

### In Server Components (Next.js App Router)

```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MyPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const userId = session.user.id;
  const isAdmin = session.user.roles.includes('CustomerAdministrator');

  return <div>Welcome, {session.user.name}</div>;
}
```

### In Client Components

```typescript
'use client';
import { useSession } from 'next-auth/react';

export default function MyClientComponent() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <Spinner />;
  if (status === 'unauthenticated') return <p>Not logged in</p>;

  // status === 'authenticated'
  return <div>Welcome, {session.user.name}</div>;
}
```

The `status` values:
- `'loading'` — Session is being fetched (initial page load).
- `'authenticated'` — Session is valid.
- `'unauthenticated'` — No valid session.

### In API Routes

```typescript
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  // ...
}
```

**Preferred pattern** — use `withAuth` wrapper instead:

```typescript
import { withAuth } from '@/lib/api-auth';

export const GET = withAuth(
  async (req, context, session) => {
    // session is already verified — access session.user directly
    const userId = session.id;
    return NextResponse.json({ userId });
  },
  { resource: 'organization.profile', action: 'view' }
);
```

### In Server Actions

```typescript
'use server';
import { auth } from '@/lib/auth';

export async function updateProfile(data: FormData) {
  const session = await auth();
  if (!session) throw new Error('Not authenticated');
  // ...
}
```

---

## 8. Multi-Tenant Session

This application is multi-tenant: many customer organizations (tenants) share
one deployed application instance. Session data ensures each user only sees
their tenant's data.

The `customerAccountId` in the session token is the key identifier. It is
populated during login from the user's `customerAccount` relation.

Every API route that reads tenant-specific data uses `getTenantFilter()`:

```typescript
export function getTenantFilter(
  session: AuthenticatedRequest['user'],
  options?: { globalAccess?: boolean }
): { customerAccountId?: string } {
  // GRCAdministrator with globalAccess: no filter (see all tenants)
  if (session.roles.includes('GRCAdministrator') && options?.globalAccess) {
    return {};
  }

  // All other users: filter to their tenant
  if (!session.customerAccountId) {
    return { customerAccountId: '__NO_TENANT__' }; // Impossible filter (security fallback)
  }
  return { customerAccountId: session.customerAccountId };
}
```

The `__NO_TENANT__` fallback is a safety net: if a user somehow has no
`customerAccountId` in their session (misconfiguration), all their queries
return zero results instead of leaking data from another tenant.

---

## 9. Audit Head Isolation

Within a single customer tenant, the Internal Audit module can have multiple
Audit Heads, each managing their own team. Data isolation is enforced via
the `auditHeadId` field.

The `auditHeadId` in the session:
- For `AuditHead`: their own user ID.
- For `Auditor`, `Auditee`, `AuditUser`: their assigned AuditHead's user ID.
- For `CustomerAdministrator`, `GRCAdministrator`: `null` (see all audit data in tenant).

```typescript
export function getAuditHeadId(session): string | null {
  if (session.roles.includes('GRCAdministrator') ||
      session.roles.includes('CustomerAdministrator')) {
    return null;  // No filter — see all
  }
  if (session.roles.includes('AuditHead')) {
    return session.id;  // Their own data
  }
  // Auditor/Auditee/AuditUser:
  return session.auditHeadId || null;
}
```

---

## 10. OAuth Account Linking

When a user logs in via Google or Microsoft for the first time, an `OAuthAccount`
record is created or updated in the database:

```typescript
await prisma.oAuthAccount.upsert({
  where: {
    provider_providerAccountId: {
      provider: account.provider,
      providerAccountId: account.providerAccountId,
    },
  },
  create: {
    userId: dbUser.id,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    email: email,
  },
  update: {
    email: email,
    updatedAt: new Date(),
  },
});
```

This record:
- Links the OAuth provider's account ID to the GRC user record.
- Allows auditing which OAuth provider a user used.
- Does not affect authorization — the GRC user record is the source of truth
  for roles and permissions.

A user can have OAuth account records for multiple providers linked to the same
GRC user account.

---

## 11. Logout Flow

When a user logs out (clicks the Logout button or their session expires):

1. The client calls `signOut()` from `next-auth/react`.
2. NextAuth clears the session token cookie (sets it to an empty value with
   `max-age=0`, causing the browser to delete it immediately).
3. The NextAuth `signOut` event fires:
   ```typescript
   events: {
     async signOut(message) {
       await recordAuditTrail({
         action: 'Logout',
         module: 'Authentication',
         // ...
       });
     }
   }
   ```
4. The audit trail records the logout event with timestamp, user ID, and name.
5. The user is redirected to `/login`.

**No server-side session invalidation**: Because sessions are stored entirely
in the cookie (JWT strategy), there is no session database to clear. The session
is effectively destroyed by deleting the cookie.

**Implication**: If a user's JWT is stolen (e.g., via cookie theft), there is
no built-in mechanism to revoke it before it expires. The 30-minute expiry
window limits the exposure. For higher-security requirements, a token revocation
list (deny-list in Redis) would be needed — this is not currently implemented.

---

## 12. Cookie Security Details

| Cookie Name (Production) | Content | Security |
|--------------------------|---------|----------|
| `__Secure-authjs.session-token` | JWT (signed, not encrypted) | httpOnly, Secure, SameSite=Lax |
| `__Secure-authjs.callback-url` | Return URL after login | Secure, SameSite=Lax |
| `__Host-authjs.csrf-token` | Anti-CSRF token | httpOnly, Secure, SameSite=Lax, host-scoped |

Development cookie names omit the `__Secure-` and `__Host-` prefixes (which
require HTTPS) and the `Secure` flag.

### Cookie Attribute Explanations

**`httpOnly`**: The cookie is invisible to JavaScript (`document.cookie` returns
nothing for it). Protects against XSS attacks stealing the session token.

**`Secure`**: Cookie is only sent over HTTPS. Prevents the token from being
sent over a cleartext HTTP connection.

**`SameSite=Lax`**: Cookie is sent when the user navigates to your site from
an external site (e.g., clicking a link in an email — this is needed for OAuth
callbacks). Cookie is NOT sent for cross-origin sub-resource requests (AJAX
calls from other domains, form submissions from other sites). This protects
against CSRF attacks without blocking legitimate OAuth redirects.

**`__Secure-` prefix**: Browser will only accept (and send) this cookie over
HTTPS. Provides defense-in-depth even if the `Secure` flag is somehow bypassed.

**`__Host-` prefix**: Even stricter than `__Secure-`. The cookie is bound to
the exact hostname (not subdomains) and must have `path=/`. Used for the CSRF
token because cross-subdomain CSRF is a known attack vector.

---

## 13. Permission Expansion on Session Build

The `session()` callback calls `expandRolePermissions()` on every session read.
This is a computational function (no database queries) that:

1. Iterates the user's `roles` array.
2. For each role, looks up the `ROLE_PERMISSIONS` matrix.
3. Expands wildcards in resource names.
4. Expands `['*']` in action arrays to all five actions.
5. Applies module flag filtering (removes inaccessible module resources).
6. De-duplicates using a `Set<string>` keyed on `resource:action:scope`.
7. Returns a flat `UserPermission[]` array.

The result is stored in `session.user.permissions`. Every permission check in
the application (both client-side `usePermissions()` and server-side `withAuth`)
reads from this flat array, not from the role names.

**Why not store permissions in the JWT?**

Permissions are computed from roles and module flags. If permissions were stored
in the JWT payload, a change to the permission matrix (e.g., adding a new action
to a role) would not take effect until all users re-login. By keeping permissions
in the `session()` callback (which runs on every request), permission changes
are effective within one refresh cycle (up to `updateAge` = 5 minutes).

There is a subtle distinction:
- The JWT token (stored in the cookie) contains roles and module flags.
- The session object (returned by `auth()` / `useSession()`) contains expanded permissions.
- Session objects are reconstructed from the JWT on every request — they are never
  stored on the server.

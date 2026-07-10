# API Patterns

## Table of Contents
1. [Standard CRUD Route Structure](#standard-crud-route-structure)
2. [withAuth Wrapper — Line by Line](#withauth-wrapper)
3. [withAuthOnly](#withauthonly)
4. [Multi-Resource OR Permission Check](#multi-resource-permission-check)
5. [Tenant Isolation Pattern](#tenant-isolation-pattern)
6. [Audit Head Isolation](#audit-head-isolation)
7. [Data Scope Filtering](#data-scope-filtering)
8. [Pagination Pattern](#pagination-pattern)
9. [Error Handling Pattern](#error-handling-pattern)
10. [File Upload Handling](#file-upload-handling)
11. [Transaction Pattern](#transaction-pattern)
12. [How to Add a New API Endpoint](#how-to-add-a-new-api-endpoint)
13. [How to Add a New CRUD Resource](#how-to-add-a-new-crud-resource)
14. [Common Pitfalls](#common-pitfalls)

---

## Standard CRUD Route Structure

Every resource in the application has a predictable two-file structure:

```
src/app/api/[resource]/
  route.ts          → Collection operations: GET (list), POST (create)
  [id]/
    route.ts        → Item operations: GET (detail), PATCH (update), DELETE
```

### Collection Route (`route.ts`)

```ts
// src/app/api/risks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ==================== GET — List risks ====================

export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") ?? "";
    const page = Number(url.searchParams.get("page") ?? "1");
    const limit = Number(url.searchParams.get("limit") ?? "20");

    // Build the where clause with tenant isolation
    const tenantFilter = getTenantFilter(session);
    const where = {
      ...tenantFilter,
      ...(search && {
        name: { contains: search, mode: "insensitive" as const },
      }),
    };

    // Fetch with pagination
    const [risks, total] = await Promise.all([
      prisma.risk.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.risk.count({ where }),
    ]);

    return NextResponse.json({ risks, total, page, limit });
  },
  { resource: "risk.register", action: "view" }
);

// ==================== POST — Create risk ====================

// Validation schema
const createRiskSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  level: z.enum(["high", "medium", "low"]),
  ownerId: z.string().cuid().optional(),
});

export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    // 1. Parse and validate request body
    const body = await req.json().catch(() => ({}));
    const parsed = createRiskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 2. Get the customer account ID for the new record
    const customerAccountId = session.customerAccountId;
    if (!customerAccountId) {
      return NextResponse.json(
        { error: "Customer account not found" },
        { status: 400 }
      );
    }

    // 3. Create the record
    const risk = await prisma.risk.create({
      data: {
        ...data,
        customerAccountId,
        createdById: session.id,
      },
    });

    return NextResponse.json({ risk }, { status: 201 });
  },
  { resource: "risk.register", action: "create" }
);
```

### Item Route (`[id]/route.ts`)

```ts
// src/app/api/risks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth, getTenantFilter, validateTenantAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ==================== GET — Get single risk ====================

export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    const { id } = await context.params; // MUST await in Next.js 16

    const risk = await prisma.risk.findUnique({ where: { id } });

    // Validate existence AND tenant ownership in one check
    if (!risk || !validateTenantAccess(session, risk.customerAccountId)) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    return NextResponse.json({ risk });
  },
  { resource: "risk.register", action: "view" }
);

// ==================== PATCH — Update risk ====================

const updateRiskSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  level: z.enum(["high", "medium", "low"]).optional(),
});

export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    const { id } = await context.params;

    // Fetch existing record first
    const existing = await prisma.risk.findUnique({ where: { id } });
    if (!existing || !validateTenantAccess(session, existing.customerAccountId)) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    // Validate request body
    const body = await req.json().catch(() => ({}));
    const parsed = updateRiskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    // Update
    const risk = await prisma.risk.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ risk });
  },
  { resource: "risk.register", action: "edit" }
);

// ==================== DELETE ====================

export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    const { id } = await context.params;

    const existing = await prisma.risk.findUnique({ where: { id } });
    if (!existing || !validateTenantAccess(session, existing.customerAccountId)) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    await prisma.risk.delete({ where: { id } });

    return NextResponse.json({ message: "Risk deleted successfully" });
  },
  { resource: "risk.register", action: "delete" }
);
```

---

## withAuth Wrapper — Line by Line

Here is the `withAuth` function from `src/lib/api-auth.ts` with detailed explanations:

```ts
export function withAuth<T extends { params?: Promise<unknown> }>(
  handler: (
    req: NextRequest,
    context: T,
    session: AuthenticatedRequest['user']
  ) => Promise<NextResponse>,
  options: AuthOptions   // { resource: string | string[], action: Action }
) {
  return async (req: NextRequest, context: T): Promise<NextResponse> => {
    try {
      // STEP 1: Retrieve the current session from NextAuth
      // auth() reads the JWT from the request cookie and validates it
      const session = await auth();

      // STEP 2: Check if there is a valid session
      // If not logged in, return 401
      if (!session?.user) {
        return unauthorized(); // { error: "Authentication required" }, 401
      }

      const user = session.user;

      // STEP 3: Check permissions
      // Supports multiple resources (OR logic): any match grants access
      const resources = Array.isArray(options.resource)
        ? options.resource
        : [options.resource];

      const hasAccess = resources.some(r =>
        hasPermission(user.permissions || [], r, options.action)
      );

      // STEP 4: If permission denied, return 403
      if (!hasAccess) {
        return forbidden(`You don't have permission to ${options.action} ...`);
      }

      // STEP 5: Build the full authenticated user object
      // This is passed as the third argument to the handler
      const authenticatedUser = {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        departmentId: user.departmentId || null,
        customerAccountId: user.customerAccountId || null,
        auditHeadId: user.auditHeadId || null,
        roles: user.roles || [],
        permissions: user.permissions || [],
        // ...and more fields
      };

      // STEP 6: Call the actual handler
      const response = await handler(req, context, authenticatedUser);

      // STEP 7: Auto-capture audit trail for successful mutations
      // This is fire-and-forget — it does NOT block or delay the response
      if (options.action !== 'view' && response.status >= 200 && response.status < 300) {
        void autoRecordMutation(req, context, authenticatedUser, options);
      }

      return response;

    } catch (error) {
      // STEP 8: Catch unexpected errors
      console.error('Auth wrapper error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
```

---

## withAuthOnly

`withAuthOnly` is a simpler wrapper that only verifies the user is logged in, without checking any specific permission.

### When to Use It

- Dashboard summary APIs where any authenticated user can access aggregate data
- User profile APIs (`/api/users/me`)
- Notification APIs
- Settings that apply to all users

```ts
import { withAuthOnly } from "@/lib/api-auth";

export const GET = withAuthOnly(async (req, context, session) => {
  // Any logged-in user can reach here — no specific resource/action checked
  const notifications = await prisma.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ notifications });
});
```

---

## Multi-Resource OR Permission Check

Some routes are accessible to users who have permission for ANY of several related resources. This is common when two modules share a page (e.g., regular Compliance and QPost Compliance).

```ts
export const GET = withAuth(
  async (req, context, session) => {
    // Handler code...
  },
  {
    // User needs compliance.governance OR qpost-compliance.governance — EITHER works
    resource: ["compliance.governance", "qpost-compliance.governance"],
    action: "view",
  }
);
```

Inside the handler, you may need to determine which module applies:

```ts
const { canView: canViewCompliance } = usePermissions("compliance.governance");
const { canView: canViewQpost } = usePermissions("qpost-compliance.governance");

// Use the appropriate data source based on which module the user has
```

---

## Tenant Isolation Pattern

**Every database query that reads or creates records must include the tenant filter.**

### Reading (findMany, findFirst, findUnique)

```ts
import { getTenantFilter, validateTenantAccess } from "@/lib/api-auth";

// For lists — filter in the query
const tenantFilter = getTenantFilter(session);
const risks = await prisma.risk.findMany({
  where: {
    ...tenantFilter,    // { customerAccountId: "cust-abc" } for regular users
    status: "active",  // Other conditions
  },
});

// For single record — validate after fetch
const risk = await prisma.risk.findUnique({ where: { id } });
if (!risk || !validateTenantAccess(session, risk.customerAccountId)) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

### Creating

```ts
const risk = await prisma.risk.create({
  data: {
    name: data.name,
    customerAccountId: session.customerAccountId, // ALWAYS set this
    createdById: session.id,
  },
});
```

### The GRCAdministrator Exception

`getTenantFilter` automatically handles GRCAdministrators:

```ts
export function getTenantFilter(session) {
  if (session.roles.includes('GRCAdministrator')) {
    // Global access option (e.g., customer management pages)
    if (options?.globalAccess) return {};

    // By default, GRC Admin is also filtered to their own tenant for data isolation
    if (session.customerAccountId) {
      return { customerAccountId: session.customerAccountId };
    }
    return {}; // Fallback: no filter
  }

  // Regular users — strict tenant filter
  if (!session.customerAccountId) {
    return { customerAccountId: '__NO_TENANT__' }; // Impossible value → no results
  }

  return { customerAccountId: session.customerAccountId };
}
```

---

## Audit Head Isolation

Internal Audit adds a second layer of isolation: an `AuditHead` and their team can only see data that belongs to that audit team.

```ts
import { getTenantFilter, getAuditHeadFilter } from "@/lib/api-auth";

// Applies to most Internal Audit records
const engagements = await prisma.auditEngagement.findMany({
  where: {
    ...getTenantFilter(session),    // Customer isolation (layer 1)
    ...getAuditHeadFilter(session), // Audit team isolation (layer 2)
  },
});
```

`getAuditHeadFilter` returns:
- `{}` (empty) for GRCAdministrator and CustomerAdministrator — they see everything within the tenant
- `{ auditHeadId: session.id }` for AuditHead users — they see only their team's records
- `{ auditHeadId: session.auditHeadId }` for Auditors and Auditees — filtered to their assigned AuditHead

---

## Data Scope Filtering

Some roles have `scope: "department"` or `scope: "own"` permissions — meaning they can only see data associated with their own department or created by themselves.

```ts
import { getDataScopeFilter } from "@/lib/api-auth";

// DepartmentContributor sees only their department's risks
// CustomerAdministrator sees all risks
const scopeFilter = getDataScopeFilter(session, "risk.register", "view");
// Returns: {} (all), { departmentId: "dept-123" }, or { ownerId: "user-456" }

const risks = await prisma.risk.findMany({
  where: {
    ...getTenantFilter(session),
    ...scopeFilter,
  },
});
```

The scope is determined by the permission in `ROLE_PERMISSIONS`:
- `scope: "all"` → `{}` (no additional filter)
- `scope: "department"` → `{ departmentId: session.departmentId }`
- `scope: "own"` → `{ ownerId: session.id }`

---

## Pagination Pattern

All list endpoints support pagination to prevent loading thousands of records at once.

```ts
export const GET = withAuth(async (req, context, session) => {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const where = { ...getTenantFilter(session) };

  // Use Promise.all to run count and data fetch in parallel
  const [items, total] = await Promise.all([
    prisma.risk.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.risk.count({ where }),
  ]);

  return NextResponse.json({
    risks: items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  });
}, { resource: "risk.register", action: "view" });
```

The frontend uses the `Pagination` component (from `src/components/ui/pagination.tsx`) to render page navigation, and the `usePagination` hook to manage state.

---

## Error Handling Pattern

### Validation Errors

Always validate request bodies using Zod before touching the database:

```ts
const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  level: z.enum(["high", "medium", "low"], {
    errorMap: () => ({ message: "Level must be high, medium, or low" }),
  }),
  dueDate: z.string().datetime().optional().nullable(),
});

const parsed = createSchema.safeParse(body);
if (!parsed.success) {
  // Return the first validation error
  return NextResponse.json(
    { error: parsed.error.errors[0].message },
    { status: 400 }
  );
}
```

### Not Found

Always check if a record exists AND belongs to the user's tenant:

```ts
const record = await prisma.risk.findUnique({ where: { id } });

// Do NOT return different errors for "not found" vs "wrong tenant"
// This would allow tenant enumeration (discovering other tenants' IDs)
if (!record || !validateTenantAccess(session, record.customerAccountId)) {
  return NextResponse.json({ error: "Risk not found" }, { status: 404 });
}
```

### Database Errors

Wrap database operations in try-catch when specific error handling is needed:

```ts
try {
  await prisma.risk.create({ data });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      // Unique constraint violation
      return NextResponse.json({ error: "A risk with this name already exists" }, { status: 409 });
    }
  }
  throw error; // Re-throw unexpected errors — withAuth catches them as 500
}
```

---

## File Upload Handling

Routes that accept file uploads use `multipart/form-data` instead of JSON:

```ts
export const POST = withAuth(async (req, context, session) => {
  const formData = await req.formData();

  // Get the uploaded file(s)
  const files = formData.getAll("files") as File[]; // Multiple files
  const file = formData.get("file") as File | null;  // Single file

  // Get other form fields
  const name = formData.get("name") as string;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Read file contents as a Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Save to disk or database
  const uploadDir = path.join(process.cwd(), "uploads");
  const filePath = path.join(uploadDir, `${Date.now()}-${file.name}`);
  await fs.writeFile(filePath, buffer);

  // Or store in database (Bytes field — auto-encrypted if in encrypted-fields.ts)
  const evidence = await prisma.evidence.create({
    data: {
      name,
      fileName: file.name,
      fileData: buffer,  // Encrypted at rest via Prisma extension
      customerAccountId: session.customerAccountId,
    },
  });

  return NextResponse.json({ evidence }, { status: 201 });
}, { resource: "compliance.evidence", action: "create" });
```

---

## Transaction Pattern

When an operation must create or update multiple related records atomically (all succeed or all fail), use a Prisma transaction:

```ts
const result = await prisma.$transaction(async (tx) => {
  // All operations inside use the transaction client `tx`
  // If any throws, ALL are rolled back

  const risk = await tx.risk.create({
    data: { name: data.name, customerAccountId },
  });

  const assessment = await tx.riskAssessment.create({
    data: {
      riskId: risk.id,
      likelihood: data.likelihood,
      impact: data.impact,
      customerAccountId,
    },
  });

  return { risk, assessment };
});

return NextResponse.json({ risk: result.risk, assessment: result.assessment }, { status: 201 });
```

### When to Use Transactions

- Creating a parent record AND child records in the same request
- Moving a record from one state to another AND recording that transition
- Deleting a record AND all its associated child records (when cascade delete is not configured)
- Any operation where partial completion would leave data in an inconsistent state

---

## How to Add a New API Endpoint

Follow these steps when adding a new endpoint. Example: adding a `POST /api/risks/:id/acknowledge` endpoint.

### Step 1: Create the route file

```
src/app/api/risks/[id]/acknowledge/route.ts
```

### Step 2: Write the handler

```ts
// src/app/api/risks/[id]/acknowledge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth, validateTenantAccess } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    const { id } = await context.params;

    const risk = await prisma.risk.findUnique({ where: { id } });
    if (!risk || !validateTenantAccess(session, risk.customerAccountId)) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    const updated = await prisma.risk.update({
      where: { id },
      data: { acknowledgedAt: new Date(), acknowledgedById: session.id },
    });

    return NextResponse.json({ risk: updated });
  },
  { resource: "risk.register", action: "edit" }
);
```

### Step 3: Test the endpoint

```bash
# Using curl
curl -X POST http://localhost:3000/api/risks/RISK_ID/acknowledge \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"

# Or call from the frontend
const res = await fetch(`/api/risks/${riskId}/acknowledge`, { method: "POST" });
```

---

## How to Add a New CRUD Resource

When adding an entirely new resource (e.g., "Contracts"), follow this checklist:

### 1. Add the Prisma model

```prisma
// prisma/schema.prisma
model Contract {
  id                String   @id @default(cuid())
  name              String
  vendor            String
  value             Decimal?
  expiresAt         DateTime?
  customerAccountId String
  createdById       String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id])
  createdBy         User            @relation(fields: [createdById], references: [id])
}
```

Then run:
```bash
npx prisma migrate dev --name add-contracts
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql
```

### 2. Add the resource to permissions.ts

```ts
// In RESOURCES object
'compliance.contracts': '/compliance/contracts',

// In ROLE_PERMISSIONS — add to relevant roles
CustomerAdministrator: [
  // ...existing permissions...
  { resource: 'compliance.contracts', actions: ['*'], scope: 'all' },
],
Reviewer: [
  { resource: 'compliance.contracts', actions: ['view', 'create', 'edit'], scope: 'all' },
],
```

### 3. Create the API routes

```
src/app/api/contracts/route.ts        → GET + POST
src/app/api/contracts/[id]/route.ts   → GET + PATCH + DELETE
```

### 4. Add navigation

```ts
// src/lib/navigation.ts
{ name: "Contracts", href: "/compliance/contracts", icon: FileText, permission: "compliance.contracts:view" },
```

### 5. Create the page

```
src/app/(protected)/compliance/contracts/page.tsx
```

### 6. Add i18n phrases

```ts
// scripts/init-translations.ts
"Contracts",
"Add Contract",
"Contract Name",
"Vendor",
"Expiry Date",
```

---

## Common Pitfalls

### 1. Forgetting to await context.params

```ts
// WRONG — params.id is undefined in Next.js 16
const { id } = context.params;

// CORRECT
const { id } = await context.params;
```

### 2. Forgetting the tenant filter

```ts
// WRONG — returns ALL risks across ALL customers
const risks = await prisma.risk.findMany();

// CORRECT — filtered to user's tenant
const risks = await prisma.risk.findMany({
  where: getTenantFilter(session),
});
```

### 3. Using the wrong HTTP method for the action

```ts
// WRONG — using POST for a read operation
export const POST = withAuth(handler, { resource: "risk.register", action: "view" });

// CORRECT — GET for reads
export const GET = withAuth(handler, { resource: "risk.register", action: "view" });
```

### 4. Leaking existence in 404 vs 403

```ts
// WRONG — tells the attacker that the record exists but they lack permission
const risk = await prisma.risk.findUnique({ where: { id } });
if (!risk) return NextResponse.json({ error: "Not found" }, { status: 404 });
if (risk.customerAccountId !== session.customerAccountId) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 }); // ← leaks existence
}

// CORRECT — same 404 for both cases
const risk = await prisma.risk.findUnique({ where: { id } });
if (!risk || !validateTenantAccess(session, risk.customerAccountId)) {
  return NextResponse.json({ error: "Risk not found" }, { status: 404 });
}
```

### 5. Mutating shared objects

```ts
// WRONG — modifies the fetched record object (unexpected side effects)
const risk = await prisma.risk.findUnique({ where: { id } });
risk.status = "updated"; // ← Don't do this

// CORRECT — use prisma.update for persistence, or spread for local changes
const updatedRisk = await prisma.risk.update({ where: { id }, data: { status: "updated" } });
```

### 6. Not validating request body

```ts
// WRONG — trusting user input without validation
const body = await req.json();
await prisma.risk.create({ data: body }); // Could inject arbitrary fields

// CORRECT — validate and pick fields explicitly
const parsed = createRiskSchema.safeParse(body);
if (!parsed.success) return NextResponse.json({ error: "..." }, { status: 400 });
await prisma.risk.create({ data: { name: parsed.data.name, /* explicit fields */ } });
```

### 7. Blocking the response with the audit trail

```ts
// WRONG — awaiting audit trail blocks the response
await autoRecordMutation(...); // User waits for this

// CORRECT — fire and forget (withAuth does this automatically)
void autoRecordMutation(...); // Response returns immediately
```

### 8. Missing customerAccountId on created records

```ts
// WRONG — record is not associated with any tenant
await prisma.risk.create({ data: { name: "..." } });

// CORRECT — always set customerAccountId
await prisma.risk.create({
  data: {
    name: "...",
    customerAccountId: session.customerAccountId, // REQUIRED
  },
});
```

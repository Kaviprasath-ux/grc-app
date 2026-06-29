# Development Guidelines

## Table of Contents

1. [Philosophy](#philosophy)
2. [TypeScript Standards](#typescript-standards)
3. [Component Creation Guidelines](#component-creation-guidelines)
4. [Internationalization (i18n) Requirements](#internationalization-i18n-requirements)
5. [Permission Checking](#permission-checking)
6. [Multi-Tenancy Rules](#multi-tenancy-rules)
7. [API Route Patterns](#api-route-patterns)
8. [Database Query Patterns](#database-query-patterns)
9. [Error Handling Standards](#error-handling-standards)
10. [Logging Standards](#logging-standards)
11. [Git Workflow](#git-workflow)
12. [Adding a New Module: Complete Checklist](#adding-a-new-module-complete-checklist)
13. [Code Review Checklist](#code-review-checklist)
14. [Security Rules](#security-rules)
15. [Performance Guidelines](#performance-guidelines)
16. [Documentation Requirements](#documentation-requirements)

---

## Philosophy

This project serves paying customers in a compliance-sensitive domain. Every feature must be:

- **Correct** — it must do exactly what it says it does, with no hidden edge cases
- **Secure** — it must protect customer data and enforce authorization at every level
- **Maintainable** — it must be understandable by another developer six months from now
- **Internationalized** — it must work in English, Arabic, and Latvian from day one

When in doubt, write more defensive code, add more explicit type annotations, and add more specific error messages. Do not leave "TODO: fix later" comments in production code unless they are tracked in an issue.

---

## TypeScript Standards

### Never Use `any`

Using `any` disables TypeScript's type checking for that value, undermining the entire purpose of TypeScript. Every value must have an explicit or inferred type.

```typescript
// WRONG
function processData(data: any) {
  return data.name;  // No type safety
}

// CORRECT
interface RecordData {
  name: string;
  id: string;
}

function processData(data: RecordData) {
  return data.name;  // TypeScript confirms .name exists
}
```

**Exceptions:** `any` is occasionally necessary when interfacing with untyped third-party libraries. In those cases, constrain the `any` as quickly as possible:

```typescript
// Acceptable: narrowing any from external library
const result: unknown = externalLibrary.getResult();
const typed = result as { id: string; name: string };  // Type assertion with explicit shape
```

### Prefer `interface` Over `type` for Objects

Use `interface` for object shapes (they are extendable and produce clearer error messages). Use `type` for unions, intersections, and primitive aliases.

```typescript
// Preferred for object shapes
interface RiskFormValues {
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Preferred for unions
type RiskStatus = 'OPEN' | 'MITIGATED' | 'ACCEPTED' | 'CLOSED';
```

### Explicit Return Types on Functions

Functions that are not trivially obvious should have explicit return types:

```typescript
// Too short to need an explicit return type
const toUpperCase = (s: string) => s.toUpperCase();

// Should have explicit return type
async function fetchRiskById(id: string): Promise<Risk | null> {
  return prisma.risk.findUnique({ where: { id } });
}
```

### Null vs Undefined

TypeScript distinguishes `null` (explicitly no value) from `undefined` (value not provided). Be deliberate:

- Use `undefined` for optional function parameters and optional object properties
- Use `null` when the absence of a value is a meaningful state (e.g., a nullable DB column)
- Do not mix them; pick one convention per context and be consistent

```typescript
// Inconsistent — avoid
interface Props {
  description?: string;     // undefined when not provided
  assigneeId: string | null; // null when explicitly unassigned
}
```

### Next.js 16: Always Await Route Params

In Next.js 16, route parameters in server components and API routes are Promises:

```typescript
// WRONG — will cause a TypeScript error in production build
export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const { id } = context.params;  // Error: params is a Promise
}

// CORRECT
interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (req, context) => {
  const { id } = await context.params;
  // ...
});
```

---

## Component Creation Guidelines

### Server Components vs. Client Components

Next.js App Router defaults to Server Components. Understanding when to use each is essential for performance and correctness.

**Use Server Components (default — no directive needed) when:**
- The component only renders static content
- The component fetches data directly from the database
- The component has no event handlers, state, or effects
- The component is a layout wrapper

```typescript
// Server Component — no directive
async function RiskList() {
  const risks = await prisma.risk.findMany();  // Server-side DB query
  return <ul>{risks.map(r => <li key={r.id}>{r.name}</li>)}</ul>;
}
```

**Use Client Components (`"use client"` directive) when:**
- The component uses React hooks (`useState`, `useEffect`, `useCallback`, etc.)
- The component handles user events (onClick, onChange, onSubmit)
- The component uses browser-only APIs (`localStorage`, `window`, `document`)
- The component uses context (including `useLanguage()`)
- The component uses third-party libraries that require client-side rendering

```typescript
"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export function RiskForm() {
  const { t } = useLanguage();
  const [name, setName] = useState("");

  return (
    <form>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit">{t("Save")}</button>
    </form>
  );
}
```

**Rule:** Keep the boundary between server and client components as high as possible. If only a small interactive part of a page needs client-side behavior, extract that part into a small Client Component and leave the rest as Server Components.

### File Naming and Organization

- Page components: `page.tsx` in the route directory
- Layout wrappers: `layout.tsx`
- Shared feature components: `src/components/[module-name]/ComponentName.tsx`
- UI primitives: `src/components/ui/ComponentName.tsx`
- Shared utilities: `src/components/shared/ComponentName.tsx`

### Props Interface

Every component should define a typed props interface:

```typescript
interface RiskCardProps {
  risk: Risk;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

export function RiskCard({ risk, onEdit, onDelete, showActions = true }: RiskCardProps) {
  // ...
}
```

---

## Internationalization (i18n) Requirements

### This Is Mandatory, Not Optional

Every user-facing string in the application MUST be wrapped with the `t()` translation function. This applies to:

- Page titles and headings
- Button labels
- Table column headers
- Form labels, placeholders, and validation messages
- Status labels and badge text
- Empty state messages
- Modal titles and body text
- Toast notifications

**No exceptions for "small" strings.** "Save", "Cancel", "Delete", "Yes", "No" — all of these must be wrapped.

### Implementation Pattern

```typescript
"use client";

import { useLanguage } from "@/contexts/LanguageContext";

export default function MyPage() {
  const { t } = useLanguage();

  return (
    <div>
      <h1>{t("Risk Register")}</h1>
      <Button onClick={handleCreate}>{t("Add New Risk")}</Button>
      <TableHead>{t("Risk Name")}</TableHead>
      <TableHead>{t("Severity")}</TableHead>
      <TableHead>{t("Status")}</TableHead>
    </div>
  );
}
```

### What NOT to Translate

Do not wrap with `t()`:
- Variable names and identifiers
- API endpoint paths (`/api/risks`)
- Database column names
- Enum values used as keys (`'OPEN'`, `'CLOSED'`)
- Technical log messages
- URLs and file paths

```typescript
// CORRECT: do not translate API calls, DB column names, or technical identifiers
const response = await fetch('/api/risks');      // Not translated
const status = risk.status === 'OPEN';           // Not translated — enum value
console.log('Risk saved:', risk.id);             // Not translated — dev log
safeLog('info', 'Risk created', { id: risk.id }); // Not translated

// CORRECT: DO translate user-visible labels
return <Badge>{t(risk.status)}</Badge>;   // Status label shown to user — translate
```

### Adding New Phrases

When you use a new phrase in `t()` that does not yet have an Arabic or Latvian translation:

1. Add the phrase to `scripts/init-translations.ts` in the `phrases` array
2. Add the Arabic translation (use a translation service if needed; mark as `[AUTO]` for review if uncertain)
3. Add the Latvian translation
4. Run `npm run i18n:generate`
5. Verify the build passes with `npm run build`

### Dynamic Data Translation

For user-entered data (risk names, control descriptions), use the dynamic translation system:

```typescript
// List page — use useTranslatedData to display translated content
const { data: translatedRisks } = useTranslatedData(risks, { modelName: 'Risk' });

// After create/edit — trigger translation
triggerTranslation('Risk', savedRisk.id, {
  name: savedRisk.name,
  description: savedRisk.description
});
```

See the Python Translation Service documentation for the complete integration pattern.

---

## Permission Checking

### Always Use `withAuth` on API Routes

Every API route that requires authentication MUST use the `withAuth` wrapper. Never write raw handlers that bypass the permission system.

```typescript
// CORRECT — permission enforced
export const GET = withAuth(
  async (req, context, session) => {
    // handler code
  },
  { resource: 'compliance.controls', action: 'view' }
);

export const POST = withAuth(
  async (req, context, session) => {
    // handler code
  },
  { resource: 'compliance.controls', action: 'create' }
);

// WRONG — bypasses all permission checking
export async function GET(req: NextRequest) {
  // No permission check!
  return NextResponse.json(await prisma.control.findMany());
}
```

### Standard Permission Mapping

| HTTP Method | Action |
|---|---|
| GET (list or single) | `view` |
| POST | `create` |
| PATCH / PUT | `edit` |
| DELETE | `delete` |

### Client-Side Permission Checks

Use permission hooks to conditionally render action buttons:

```typescript
import { usePermissions, useHasRole } from "@/hooks/usePermissions";

export function RiskActions({ riskId }: { riskId: string }) {
  const { canEdit, canDelete } = usePermissions('risk.register');

  return (
    <div>
      {canEdit && <Button onClick={() => handleEdit(riskId)}>{t("Edit")}</Button>}
      {canDelete && <Button variant="destructive" onClick={() => handleDelete(riskId)}>{t("Delete")}</Button>}
    </div>
  );
}
```

**Important:** Client-side permission checks are for UX (showing/hiding buttons). Server-side `withAuth` checks are for security (actually enforcing access control). Both are required. Never rely solely on client-side checks.

### Never Hardcode Role Checks

Do not check role names directly in business logic. Use the permission system:

```typescript
// WRONG — brittle hardcoded role name
if (session.user.roles.includes('AuditHead')) { /* ... */ }

// CORRECT — use permission checking
const { canEdit } = usePermissions('audit.engagements');
// or server-side:
export const PATCH = withAuth(handler, { resource: 'audit.engagements', action: 'edit' });
```

---

## Multi-Tenancy Rules

### Always Filter by `customerAccountId`

The application is multi-tenant. Every database query that reads or writes customer data MUST include a `customerAccountId` filter. Failure to do so is a critical security vulnerability that would expose one customer's data to another.

```typescript
// CORRECT — scoped to the customer
const risks = await prisma.risk.findMany({
  where: {
    customerAccountId: session.user.customerAccountId,  // Always include this
    status: 'OPEN'
  }
});

// WRONG — returns ALL customers' risks
const risks = await prisma.risk.findMany({
  where: {
    status: 'OPEN'
  }
});
```

### Where Does `customerAccountId` Come From?

Always read `customerAccountId` from the authenticated session, never from the request body or query parameters. A malicious user could manipulate request parameters to access another customer's data.

```typescript
export const GET = withAuth(async (req, context, session) => {
  const customerAccountId = session.user.customerAccountId;  // From session — trusted

  // Do NOT do this:
  // const { customerAccountId } = await req.json();  // From request — untrusted!
});
```

### Creating Records

When creating any new record, always set `customerAccountId`:

```typescript
const risk = await prisma.risk.create({
  data: {
    name: body.name,
    description: body.description,
    customerAccountId: session.user.customerAccountId,  // Always set this
    createdById: session.user.id,
    // ...
  }
});
```

### Verifying Ownership Before Update/Delete

Before updating or deleting a record, verify it belongs to the current customer:

```typescript
export const PATCH = withAuth(async (req, context, session) => {
  const { id } = await context.params;
  const customerAccountId = session.user.customerAccountId;

  // Verify ownership first
  const existing = await prisma.risk.findUnique({
    where: { id }
  });

  // CRITICAL: check customerAccountId before allowing modification
  if (!existing || existing.customerAccountId !== customerAccountId) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // Safe to update
  const updated = await prisma.risk.update({
    where: { id },
    data: { /* ... */ }
  });
});
```

Return 404 (not 403) when the record exists but belongs to another customer. This prevents information leakage (the attacker should not know whether the record exists for another customer).

---

## API Route Patterns

### Standard CRUD Structure

```typescript
// src/app/api/module/resource/route.ts — Collection endpoints
export const GET = withAuth(
  async (req, context, session) => {
    const customerAccountId = session.user.customerAccountId;
    const records = await prisma.resource.findMany({
      where: { customerAccountId },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(records);
  },
  { resource: 'module.resource', action: 'view' }
);

export const POST = withAuth(
  async (req, context, session) => {
    const customerAccountId = session.user.customerAccountId;
    const body = await req.json();

    const record = await prisma.resource.create({
      data: { ...body, customerAccountId, createdById: session.user.id }
    });

    // Trigger translation (non-blocking)
    if (customerAccountId) {
      void translateRecord(customerAccountId, 'Resource', record.id, {
        name: record.name,
        description: record.description
      });
    }

    return NextResponse.json(record, { status: 201 });
  },
  { resource: 'module.resource', action: 'create' }
);
```

```typescript
// src/app/api/module/resource/[id]/route.ts — Item endpoints
export const GET = withAuth(
  async (req, context, session) => {
    const { id } = await context.params;
    const customerAccountId = session.user.customerAccountId;

    const record = await prisma.resource.findUnique({
      where: { id }
    });

    if (!record || record.customerAccountId !== customerAccountId) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    return NextResponse.json(record);
  },
  { resource: 'module.resource', action: 'view' }
);

export const PATCH = withAuth(
  async (req, context, session) => {
    const { id } = await context.params;
    const customerAccountId = session.user.customerAccountId;
    const body = await req.json();

    const existing = await prisma.resource.findUnique({ where: { id } });
    if (!existing || existing.customerAccountId !== customerAccountId) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const updated = await prisma.resource.update({
      where: { id },
      data: body
    });

    void translateRecord(customerAccountId, 'Resource', updated.id, {
      name: updated.name,
      description: updated.description
    });

    return NextResponse.json(updated);
  },
  { resource: 'module.resource', action: 'edit' }
);

export const DELETE = withAuth(
  async (req, context, session) => {
    const { id } = await context.params;
    const customerAccountId = session.user.customerAccountId;

    const existing = await prisma.resource.findUnique({ where: { id } });
    if (!existing || existing.customerAccountId !== customerAccountId) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    await prisma.resource.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  },
  { resource: 'module.resource', action: 'delete' }
);
```

### Request Validation

Validate all request bodies with Zod before using the data:

```typescript
import { z } from 'zod';

const CreateRiskSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  departmentId: z.string().cuid()
});

export const POST = withAuth(async (req, context, session) => {
  const body = await req.json();
  const parsed = CreateRiskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const { name, description, severity, departmentId } = parsed.data;
  // Proceed with validated data
});
```

---

## Database Query Patterns

### Avoid N+1 Queries

An N+1 query is when you query for a list of records and then make a separate query for each record to fetch related data. This is extremely inefficient.

```typescript
// WRONG: N+1 — one query for risks, then one per risk for department
const risks = await prisma.risk.findMany({ where: { customerAccountId } });
for (const risk of risks) {
  risk.department = await prisma.department.findUnique({ where: { id: risk.departmentId } });
}

// CORRECT: single query with include
const risks = await prisma.risk.findMany({
  where: { customerAccountId },
  include: {
    department: true,  // Single JOIN — one query total
    owner: true
  }
});
```

### Use Select for Performance

When you only need specific fields, use `select` instead of fetching entire records. This reduces data transfer and memory usage.

```typescript
// Inefficient: fetches all fields including large blobs
const risks = await prisma.risk.findMany({ where: { customerAccountId } });

// Efficient: only fetch what the list view needs
const risks = await prisma.risk.findMany({
  where: { customerAccountId },
  select: {
    id: true,
    name: true,
    severity: true,
    status: true,
    department: { select: { name: true } }
  }
});
```

### Pagination for Large Datasets

Never return unlimited rows. Use pagination for list endpoints:

```typescript
const PAGE_SIZE = 50;

const { searchParams } = new URL(req.url);
const page = parseInt(searchParams.get('page') || '1');
const skip = (page - 1) * PAGE_SIZE;

const [records, total] = await Promise.all([
  prisma.risk.findMany({
    where: { customerAccountId },
    skip,
    take: PAGE_SIZE,
    orderBy: { createdAt: 'desc' }
  }),
  prisma.risk.count({ where: { customerAccountId } })
]);

return NextResponse.json({
  data: records,
  pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) }
});
```

### Transactions for Multi-Step Writes

When multiple database writes must succeed or fail together, use a Prisma transaction:

```typescript
const result = await prisma.$transaction(async (tx) => {
  const finding = await tx.auditFinding.create({ data: findingData });
  const capa = await tx.capa.create({
    data: { ...capaData, findingId: finding.id }
  });
  return { finding, capa };
});
```

---

## Error Handling Standards

### Consistent API Error Responses

All API routes must return consistent error response shapes:

```typescript
// Standard error response format
interface ErrorResponse {
  error: string;       // Short error code or category
  message: string;     // Human-readable message
  details?: unknown;   // Optional additional context
}

// Usage
return NextResponse.json(
  { error: 'Not Found', message: 'The requested risk does not exist.' },
  { status: 404 }
);

return NextResponse.json(
  { error: 'Validation Error', message: 'Invalid input', details: parsed.error.errors },
  { status: 400 }
);

return NextResponse.json(
  { error: 'Internal Server Error', message: 'An unexpected error occurred.' },
  { status: 500 }
);
```

### Never Expose Stack Traces to Clients

Never return raw error objects or stack traces in API responses:

```typescript
// WRONG — leaks internal details to clients
catch (err) {
  return NextResponse.json({ error: err }, { status: 500 });
}

// CORRECT — log the full error server-side, return safe message to client
catch (err) {
  safeLog('error', 'Risk creation failed', { error: err });
  return NextResponse.json(
    { error: 'Internal Server Error', message: 'Failed to create risk.' },
    { status: 500 }
  );
}
```

### Client-Side Error Handling

Show meaningful error messages to users. Never silently swallow errors:

```typescript
try {
  const response = await fetch('/api/risks', { method: 'POST', body: JSON.stringify(data) });
  if (!response.ok) {
    const error = await response.json();
    toast.error(error.message || t("Failed to save risk. Please try again."));
    return;
  }
  const saved = await response.json();
  toast.success(t("Risk saved successfully."));
} catch (err) {
  toast.error(t("Network error. Please check your connection and try again."));
}
```

---

## Logging Standards

### Use `safeLog` for All Structured Logging

The application uses a custom `safeLog` function (`src/lib/safe-log.ts`) that automatically redacts sensitive fields before writing to logs. Always use `safeLog` instead of `console.log` in production code.

```typescript
import { safeLog } from '@/lib/safe-log';

// Correct
safeLog('info', 'Risk created', { riskId: risk.id, department: risk.departmentId });
safeLog('error', 'Translation failed', { model: 'Risk', recordId: risk.id });
safeLog('warn', 'Permission check failed', { userId: session.user.id, resource });

// Wrong — use only in development/debugging
console.log('Risk created:', risk);
```

### Never Log Sensitive Data

The following must NEVER appear in logs, even in development:

- Passwords or password hashes
- Encryption keys (`FIELD_ENCRYPTION_KEY`)
- OAuth tokens or secrets
- Personal data (full names, email addresses, national IDs)
- Session tokens or JWT payloads
- Database connection strings

The `safeLog` function automatically redacts known-sensitive keys. If you add a new type of sensitive data, add it to the redaction list in `src/lib/safe-log.ts`.

---

## Git Workflow

### NEVER Auto-Commit or Auto-Push

**This is the most important rule.** Never commit or push code unless the user explicitly requests it. Making unsolicited commits disrupts the team's git history, can introduce untested code, and violates the developer's expectation of when commits happen.

Wait for explicit instructions: "commit this", "commit and push", "push to the branch".

### Always Pull Before Commit

Before making any commit, ensure your local branch is up to date with the remote:

```bash
# Step 1: Fetch from remote and check status
git fetch origin
git status
# If "Your branch is behind 'origin/GRC-MultiTenant' by N commits" → pull first

# Step 2: If behind remote, pull
git pull

# Step 3: Now stage and commit
git add <specific-files>
git commit -m "Descriptive commit message"

# Step 4: Push only when explicitly requested
git push
```

### Commit Message Format

Write commit messages that describe WHY the change was made, not just WHAT was changed:

```
# Good: explains purpose
"Risk: add department filter to risk register list view"
"Fix: prevent null pointer in BIA score calculation when no categories configured"
"Internal Audit: display finding count on engagement card"

# Too vague
"fix bug"
"update"
"changes"

# Overly detailed (save details for PR description)
"Changed the risk register page component by adding a new useState hook for the department filter, updating the useEffect to refetch when the filter changes, and also fixing a null check in the BIA calculation function that was causing crashes when the organization had no BIA categories configured"
```

### Branch Naming

```
feature/short-description
fix/what-is-fixed
docs/what-is-documented
refactor/what-is-refactored
```

### Pre-Push Checklist

Before pushing:
1. `git fetch origin && git status` — ensure you are not behind remote
2. `npm run build` — verify the build passes
3. `npm run lint` — verify ESLint passes
4. Review `git diff origin/GRC-MultiTenant` to see what you are pushing
5. Ensure no sensitive data (passwords, keys) is included in the diff

---

## Adding a New Module: Complete Checklist

When building a new GRC module from scratch, follow this checklist in order:

### 1. Create Route Structure

```
src/app/(protected)/new-module/
  ├── page.tsx                    # Module home page
  ├── layout.tsx                  # Module layout (if needed)
  ├── [sub-section]/
  │     └── page.tsx
  └── [item-id]/
        └── page.tsx
```

### 2. Create API Routes

```
src/app/api/new-module/
  ├── route.ts                    # Collection: GET (list), POST (create)
  └── [id]/
        └── route.ts              # Item: GET, PATCH, DELETE
```

Use the standard `withAuth` pattern (see API Route Patterns section).

### 3. Add Prisma Models

In `prisma/schema.prisma`, add the new models:

```prisma
model NewModuleRecord {
  id                String   @id @default(cuid())
  customerAccountId String
  name              String
  description       String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id])

  @@index([customerAccountId])
}
```

After editing the schema:
```bash
npx prisma migrate dev --name "add-new-module-models"
npx prisma generate

# Regenerate schema.sql
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql
```

### 4. Add Permissions to `permissions.ts`

In `src/lib/permissions.ts`, add the new resource to the permission matrix:

```typescript
// Add resource key
'new-module.records': {
  view:   ['GRCAdministrator', 'CustomerAdministrator', 'Reviewer', 'Contributor'],
  create: ['GRCAdministrator', 'CustomerAdministrator', 'Contributor'],
  edit:   ['GRCAdministrator', 'CustomerAdministrator', 'Contributor'],
  delete: ['GRCAdministrator', 'CustomerAdministrator'],
}
```

### 5. Add Navigation Items to `navigation.ts`

In `src/lib/navigation.ts`, add the sidebar navigation entry:

```typescript
{
  label: "New Module",
  href: "/new-module",
  icon: SomeIcon,
  permission: "new-module.records:view",
  children: [
    {
      label: "Records",
      href: "/new-module",
      permission: "new-module.records:view"
    }
  ]
}
```

### 6. Add Translations to `init-translations.ts`

In `scripts/init-translations.ts`, add all new phrases with Arabic and Latvian translations:

```typescript
{
  en: "New Module",
  ar: "الوحدة الجديدة",
  lv: "Jaunais modulis"
},
{
  en: "Add New Record",
  ar: "إضافة سجل جديد",
  lv: "Pievienot jaunu ierakstu"
},
// ... all phrases used in the module
```

### 7. Run i18n Generation

```bash
npm run i18n:generate
```

Verify no duplicate phrase errors.

### 8. Register Translatable Models

In `src/lib/translation-config.ts`, add the new model:

```typescript
export const TRANSLATION_CONFIG = {
  // ... existing
  NewModuleRecord: {
    fields: ['name', 'description']
  }
}
```

### 9. Implement the UI

- Create page components with `"use client"` where interactivity is needed
- Use `useLanguage()` and `t()` for all user-facing strings
- Use `usePermissions()` for conditional rendering of action buttons
- Use `useTranslatedData()` on list pages
- Call `triggerTranslation()` after create/edit operations

### 10. Update CLAUDE.md

If the new module adds significant functionality, update `CLAUDE.md` with a description in the Project Overview section.

### 11. Update Module Documentation

Create a documentation file:
```
Project-Documentation/08-Features/New-Module.md
```

Cover:
- What problem the module solves
- Data model and key concepts
- Workflow (how users use it)
- API endpoints
- Permissions
- Cross-module connections

### 12. Run Full Build Verification

```bash
npm run build
```

Resolve all TypeScript errors before considering the module complete.

---

## Code Review Checklist

Before submitting code for review, verify:

**Functionality:**
- [ ] The feature works as designed for the happy path
- [ ] Edge cases are handled (empty state, no permissions, missing data)
- [ ] Error states are handled and show meaningful messages

**Security:**
- [ ] All API routes use `withAuth` with correct resource/action
- [ ] All DB queries include `customerAccountId` filter
- [ ] Ownership is verified before update/delete operations
- [ ] No sensitive data is logged or returned in error responses
- [ ] Input is validated with Zod before use

**Internationalization:**
- [ ] All user-facing strings use `t()`
- [ ] New phrases added to `init-translations.ts` with Arabic and Latvian
- [ ] `npm run i18n:generate` succeeds without errors
- [ ] Dynamic data uses `useTranslatedData()` and `triggerTranslation()`

**Code Quality:**
- [ ] No `any` types without justification
- [ ] No unused imports or variables
- [ ] No N+1 database query patterns
- [ ] `npm run build` passes without errors
- [ ] `npm run lint` passes without errors

**Documentation:**
- [ ] Module documentation updated if features changed
- [ ] Complex logic has inline comments
- [ ] New environment variables documented

---

## Security Rules

### SQL Injection Prevention

Never concatenate user input into SQL queries. Prisma's parameterized queries protect against SQL injection by default when using the standard API. The only risk is when using `$queryRaw` with string interpolation:

```typescript
// WRONG — SQL injection vulnerability
const id = req.params.id;  // Could be "'; DROP TABLE Risk; --"
await prisma.$queryRaw`SELECT * FROM "Risk" WHERE id = '${id}'`;  // Dangerous!

// CORRECT — parameterized query
await prisma.$queryRaw`SELECT * FROM "Risk" WHERE id = ${id}`;
// Prisma uses ? placeholders; ${id} is a parameter, not interpolation
```

### XSS Prevention

Next.js with React auto-escapes JSX output, preventing most XSS attacks. However:

- Never use `dangerouslySetInnerHTML` with user-supplied content
- Sanitize HTML if you must render user-provided rich text
- Validate URLs before using them in `<a href>` attributes (check for `javascript:` schemes)

```typescript
// WRONG
<div dangerouslySetInnerHTML={{ __html: userProvidedContent }} />

// If rich text is required, use a sanitizer
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userProvidedContent) }} />
```

### File Upload Security

- Validate MIME type on the server (not just the file extension)
- Scan uploaded files for malicious content if the threat model requires it
- Store uploaded files outside the web root (not in `public/`)
- Do not serve uploaded files with their original names (use a content-addressed path)

---

## Performance Guidelines

### Memoize Expensive Calculations

Use `useMemo` for expensive computations that should not run on every render:

```typescript
// WRONG — recalculates on every render
const sortedRisks = risks.sort((a, b) => b.score - a.score);

// CORRECT — only recalculates when risks changes
const sortedRisks = useMemo(
  () => [...risks].sort((a, b) => b.score - a.score),
  [risks]
);
```

### Memoize Callbacks Passed to Children

Use `useCallback` for functions passed as props to child components to prevent unnecessary re-renders:

```typescript
// CORRECT
const handleDelete = useCallback((id: string) => {
  setRecords(prev => prev.filter(r => r.id !== id));
}, []); // No dependencies — stable reference
```

### Debounce Search and Filter Inputs

Search inputs that trigger API calls should be debounced to avoid making a request on every keystroke:

```typescript
import { useDebouncedCallback } from 'use-debounce';

const handleSearch = useDebouncedCallback((value: string) => {
  setSearchQuery(value);  // Triggers API refetch
}, 300);

<Input onChange={(e) => handleSearch(e.target.value)} />
```

### Avoid Blocking the Main Thread

Long synchronous operations in components block rendering. Move heavy computation to:
- `useMemo` (runs synchronously but only when deps change)
- Web Workers (for truly heavy computation — rarely needed in GRC context)
- Server-side API routes (computation happens on the server, not in the browser)

---

## Documentation Requirements

### When to Update Documentation

| Change | Required Documentation Update |
|---|---|
| New module created | New file in `Project-Documentation/08-Features/` |
| Existing module feature added | Update the module's documentation file |
| Feature removed | Remove or mark as deprecated in documentation |
| New API endpoint | Update the API reference section in the module doc |
| New environment variable | Update `.env.example` and Vercel Deployment docs |
| Internal Audit change | MANDATORY: update `docs/INTERNAL_AUDIT_MODULE.md` |
| New encrypted field | Update `docs/encryption-raw-sql-audit.md` |
| Permission change | Update the Permissions table in the module doc |

### Documentation Style

- Write for someone with no prior knowledge of the feature
- Explain the "why" before the "how"
- Include concrete examples (code snippets, example values)
- Use tables for structured data (permissions, API endpoints, field descriptions)
- Keep documentation in sync with the code — outdated documentation is worse than none

### CLAUDE.md Updates

The `CLAUDE.md` file is read by Claude Code at the start of every session. It should always reflect:

- The current module list (Project Overview section)
- Any new mandatory rules or conventions
- New environment variables added to the project
- New NPM scripts available

---

*Last updated: 2026-06-29*
*Module version: GRC App — GRC-MultiTenant branch*

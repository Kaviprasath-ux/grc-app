# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **GRC (Governance, Risk, and Compliance) application** built with Next.js 16, using the App Router pattern. It provides modules for:
- **Organization** - Profile, context, processes, BIA (Business Impact Analysis)
- **Compliance** - Frameworks, controls, governance documents, evidence, exceptions, KPIs
- **Risk Management** - Risk register, assessment, response, risk control matrix
- **Asset Management** - Inventory, classification
- **Internal Audit** - Audit universe, planning, fieldwork, findings, CAPA tracking, reports

## Commands

```bash
# Development
npm run dev              # Start development server on http://localhost:3000

# Build
npm run build            # Production build (uses Turbopack)
npm run lint             # Run ESLint

# Database
npm run db:seed          # Seed database with initial data
npm run db:seed-bts      # Seed customer-specific data
npm run db:reset         # Reset database (runs prisma migrate reset --force)
npx prisma studio        # Open Prisma Studio GUI
npx prisma migrate dev   # Create new migration

# Testing (Playwright E2E)
npm run test:e2e         # Run all E2E tests
npm run test:e2e:ui      # Run tests with Playwright UI
npm run test:e2e:debug   # Debug tests
npm run test:e2e:codegen # Generate tests by recording browser actions
```

## Architecture

### Authentication & Authorization (RBAC)

The app uses NextAuth v5 with JWT sessions and a comprehensive Role-Based Access Control system:

- **`src/lib/auth.ts`** - NextAuth configuration, expands role permissions on session callback
- **`src/lib/permissions.ts`** - Defines all roles, resources, actions, scopes, and the permission matrix
- **`src/lib/api-auth.ts`** - API route protection wrappers (`withAuth`, `withAuthOnly`)
- **`src/hooks/usePermissions.ts`** - Client-side permission hooks (`usePermissions`, `useHasPermission`, `useHasRole`)

**Key Roles:**
- `GRCAdministrator` - System-level admin (customer accounts, framework setup)
- `CustomerAdministrator` - Organization-level admin
- `AuditHead` - Full Internal Audit access
- `AuditManager`, `Auditor`, `Auditee` - Audit module roles
- `Reviewer`, `Contributor` - Cross-module roles
- `DepartmentReviewer`, `DepartmentContributor` - Department-scoped roles

**Permission Pattern:**
```typescript
// API route protection
export const GET = withAuth(
  async (req, context, session) => { /* handler */ },
  { resource: 'compliance.governance', action: 'view' }
);

// Client-side permission check
const { canCreate, canEdit, canDelete } = usePermissions('compliance.governance');
const isAuditHead = useHasRole('AuditHead');
```

### Route Structure

- **`src/app/(protected)/`** - All authenticated routes, wrapped with `MainLayout`
- **`src/app/api/`** - API routes following REST conventions
- **`src/app/login/`** - Public login page

Protected routes use route groups: `(protected)` applies the `MainLayout` wrapper automatically.

### Database (Prisma + SQLite)

- **`prisma/schema.prisma`** - Database schema with models for RBAC, Organization, Compliance, Risk, Audit, Assets
- **`prisma/seed.ts`** - Main seeder with sample data
- **`src/lib/prisma.ts`** - Singleton Prisma client

### UI Components

- **`src/components/ui/`** - shadcn/ui components (Radix UI + Tailwind)
- **`src/components/layout/`** - Layout components (MainLayout, Sidebar, Header)
- **`src/components/shared/`** - Shared components across modules

### Navigation

Navigation is permission-filtered via `src/lib/navigation.ts`. Each nav item specifies a `permission` field (`resource:action` format) to control visibility.

## Key Patterns

### API Route Pattern
```typescript
// Standard CRUD route structure
export const GET = withAuth(handler, { resource: 'module.resource', action: 'view' });
export const POST = withAuth(handler, { resource: 'module.resource', action: 'create' });
export const PATCH = withAuth(handler, { resource: 'module.resource', action: 'edit' });
export const DELETE = withAuth(handler, { resource: 'module.resource', action: 'delete' });
```

### Dynamic Route Context
For routes with parameters (`[id]`), context params are Promises in Next.js 16:
```typescript
interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (req, context) => {
  const { id } = await context.params;
  // ...
});
```

### Form Handling
Uses React Hook Form with Zod validation. Common pattern in page components:
```typescript
const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: { /* ... */ }
});
```

### File Uploads
Files are stored in `uploads/` directory. API routes handle multipart form data with `formData.getAll('files')`.

## Test Credentials

Default seeded users (from `prisma/seed.ts`):
- GRC Admin: `grcadmin` / password (check seed file)
- Audit Head: `abhishek` / `1`

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
- **`prisma/schema.sql`** - SQL version of the schema (auto-generated)
- **`prisma/seed.ts`** - Main seeder with sample data
- **`src/lib/prisma.ts`** - Singleton Prisma client

**IMPORTANT:** Whenever you modify `prisma/schema.prisma`, always regenerate the SQL file:
```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql
```

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

## Vercel Deployment (BA Testing Environment)

### Live URL
**https://grc-app-ba-testing.vercel.app**

### Test Credentials (Cloud)
- Superadmin: `superadmin` / `Baarez@2025`
- GRC Admin 2: `grcadmin2` / `Baarez@2025`
- Audit Head: `abhishek` / `1`

### Infrastructure
| Component | Service | Details |
|-----------|---------|---------|
| Hosting | Vercel | Free tier |
| Database | Neon PostgreSQL | Free tier (0.5GB), Project: `grc-app-ba-testing` |
| Region | US East | `aws-us-east-1` |

### Environment Variables (configured in Vercel)
- `DATABASE_URL` - Neon PostgreSQL connection string
- `NEXTAUTH_SECRET` - Auto-generated auth secret
- `NEXTAUTH_URL` - https://grc-app-ba-testing.vercel.app

### Deployment Workflow

**Local Development:**
```bash
npm run dev  # Uses local PostgreSQL (localhost:5432/grc_app)
```

**Push Changes:**
```bash
git add . && git commit -m "message" && git push
```

**IMPORTANT: Full Deployment with Database Seeding (Recommended Approach)**

Due to git author permission issues with Vercel, use this temp directory approach:

```bash
# Step 1: Create temp directory and copy files (without .git)
rm -rf /c/temp/grc-deploy 2>/dev/null
mkdir -p /c/temp/grc-deploy
cd "C:\Claude apps\grc-app"
cp -r src package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs prisma components.json public .vercel /c/temp/grc-deploy/

# Step 2: Deploy from temp directory
cd /c/temp/grc-deploy
vercel --prod

# Step 3: Reset and seed the cloud database (from main project directory)
cd "C:\Claude apps\grc-app"

# Reset database (clears all data)
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx prisma db push --force-reset

# Seed main data (superadmin, grcadmin2, frameworks, all modules)
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx tsx prisma/seed.ts

# Seed BTS customer-specific data (bts users and their data)
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx tsx prisma/seed-customer-bts.ts
```

**Quick Redeploy (without database changes):**
```bash
# Find latest deployment
vercel ls grc-app-ba-testing

# Redeploy (only rebuilds, doesn't include new code changes)
vercel redeploy <deployment-url>
```

### Database Management (Cloud)

**Neon PostgreSQL Connection:**
```
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

**Push schema changes to Neon:**
```bash
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx prisma db push
```

**Full database reset and reseed:**
```bash
# Reset (clears all data and recreates schema)
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx prisma db push --force-reset

# Seed main data
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx tsx prisma/seed.ts

# Seed BTS customer data
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx tsx prisma/seed-customer-bts.ts
```

### Key Notes
- Local and cloud environments are **completely isolated**
- Local changes don't affect Vercel deployment until pushed and redeployed
- The Vercel project is linked to: `omjc44-8839s-projects/grc-app-ba-testing`
- **Use temp directory approach** to avoid git author permission errors during deployment
- **Always run both seed files** (seed.ts and seed-customer-bts.ts) for complete data

## Pending Tasks / Reminders

### Functional Testing on Vercel (User Reminder)
**When the user resumes this chat or starts a new session**, remind them:

> "Would you like me to perform complete functional testing on the Vercel deployment (https://grc-app-ba-testing.vercel.app) using Playwright? I can test all modules as a real user would - login, navigation, CRUD operations across Organization, Compliance, Risk Management, Asset Management, and Internal Audit modules."

**How to run functional testing:**
1. Use Playwright MCP browser tools to navigate to https://grc-app-ba-testing.vercel.app
2. Login with test credentials (`superadmin` / `Baarez@2025`)
3. Test each module systematically:
   - Organization (Profile, Context, Processes, BIA)
   - Compliance (Frameworks, Controls, Evidence, Exceptions, KPIs)
   - Risk Management (Register, Assessment, Response, Risk Control Matrix)
   - Asset Management (Inventory, Classification)
   - Internal Audit (Universe, Planning, Fieldwork, CAPA, Reports)
4. Document any issues found

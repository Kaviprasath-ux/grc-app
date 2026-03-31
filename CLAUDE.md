# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **GRC (Governance, Risk, and Compliance) application** built with Next.js 16, using the App Router pattern. It provides modules for:
- **Organization** - Profile, context, processes, BIA (Business Impact Analysis)
- **Compliance** - Frameworks, controls, governance documents, evidence, exceptions, KPIs
- **Risk Management** - Risk register, assessment, response, risk control matrix
- **Asset Management** - Inventory, classification
- **Internal Audit** - Audit universe, planning, fieldwork, findings, CAPA tracking, reports

CODEX will review your response and code once you are done so do not slack off.

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

### Cron Jobs / Scheduled Tasks

The app uses scheduled API endpoints for automated tasks. These are configured in `vercel.json` for Vercel Cron.

**Due Date Reminders** (`/api/cron/due-reminders`):
- Runs daily at 8:00 AM UTC
- Sends notifications for items due within the next 24 hours:
  - Evidence items due soon (to assignees)
  - CAPA/Findings due soon (to responsible persons or auditees)
  - Policy reviews due soon (to assignees)

**Local Testing:**
```bash
# Test the cron endpoint locally (no auth required in dev)
curl http://localhost:3000/api/cron/due-reminders
```

**Production Security:**
Set the `CRON_SECRET` environment variable in Vercel to protect the endpoint:
```bash
# In production, the endpoint requires Bearer token authentication
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron/due-reminders
```

**Vercel Cron Configuration** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/due-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

## Git Workflow Rules (ALL CONTRIBUTORS)

### MANDATORY: Never Auto-Commit or Auto-Push
**NEVER commit or push unless the user explicitly asks you to.** Do not auto-commit after making changes. Wait for the user to say "commit", "push", "commit and push", etc.

### MANDATORY: Pull Before Commit
**This rule applies to ALL users working on this repository, on ANY branch.**

Before every commit or commit-and-push task:

1. **Fetch and check if your branch is up-to-date with remote:**
```bash
git fetch origin
git status
```

2. **If behind remote, pull the latest changes first:**
```bash
git pull
```

3. **Only then proceed with staging and committing your changes.**

This prevents merge conflicts and ensures everyone is always working with the latest codebase. **Never skip this step.**

### Commit Workflow Summary
```bash
# Step 1: Always fetch and check status first
git fetch origin && git status

# Step 2: If behind, pull latest changes
git pull

# Step 3: Stage your changes
git add <files>

# Step 4: Commit with descriptive message
git commit -m "message"

# Step 5: Push (if requested)
git push
```

## Internationalization (i18n) - REQUIRED FOR ALL PAGES

This app supports **3 languages**: English (default), Arabic (RTL), and Latvian (LTR).

### Architecture
- **Translation source**: `scripts/init-translations.ts` - Single source of truth for all translations
- **Language context**: `src/contexts/LanguageContext.tsx` - Provides `t()` function and RTL support
- **Phrase-based keys**: English phrases ARE the keys (e.g., `t("Save")`, `t("Add New")`)

### MANDATORY: Adding i18n to Pages

**IMPORTANT: Whenever you create or modify ANY page component, you MUST add i18n support.**

1. **Add the import:**
```typescript
import { useLanguage } from "@/contexts/LanguageContext";
```

2. **Add the hook inside the component:**
```typescript
const { t } = useLanguage();
```

3. **Wrap ALL hardcoded English strings with `t()`:**
```typescript
// Before
<Button>Save Changes</Button>
<h1>User Management</h1>
<TableHead>Name</TableHead>

// After
<Button>{t("Save Changes")}</Button>
<h1>{t("User Management")}</h1>
<TableHead>{t("Name")}</TableHead>
```

4. **DO NOT translate:**
   - Variable names, API endpoints, console.log messages
   - Enum values, field names, technical identifiers
   - URLs, file paths, database column names

### RTL Support for Arabic
Use Tailwind's `ltr:` and `rtl:` variants for directional styling:
```typescript
<div className="ltr:ml-4 rtl:mr-4">  // margin-left in LTR, margin-right in RTL
<Icon className="ltr:rotate-0 rtl:rotate-180" />  // flip icons for RTL
```

### Adding New Translations
If you use a new phrase that doesn't exist in translations:
1. Add it to `scripts/init-translations.ts` in the `phrases` array
2. Include Arabic and Latvian translations (use translation service or placeholder)
3. Run `npm run build` to verify no missing translations

### Example Page with i18n
```typescript
"use client";
import { useLanguage } from "@/contexts/LanguageContext";

export default function MyPage() {
  const { t } = useLanguage();

  return (
    <div>
      <h1>{t("Page Title")}</h1>
      <Button>{t("Save")}</Button>
    </div>
  );
}
```

### Dynamic Data Translation (User-Entered Data)

The app also translates **user-entered data** (risk names, control descriptions, etc.) dynamically using a Python backend API. This is separate from the static `t()` function above.

**Architecture:**
- **Translation service**: `src/lib/translation-service.ts` — Calls Python backend API for translations
- **Frontend hooks**: `src/hooks/useTranslatedData.ts` — `useTranslatedData()`, `useTranslatedRecord()`, `triggerTranslation()`
- **Translation config**: `src/lib/translation-config.ts` — Registry of all translatable models and fields
- **DB storage**: `DynamicTranslation` table stores translations per record/field/locale

**IMPORTANT: Translations Only on Create/Edit**

Translations are **NOT** triggered automatically when viewing pages. They are **only** triggered when a record is explicitly created or edited:
- **Server-side**: API route handlers call `translateRecord()` after create/update operations
- **Client-side**: Frontend forms call `triggerTranslation()` after successful API responses
- **Bulk endpoint** (`/api/translations/bulk`): Only reads existing translations from the DB — does NOT auto-translate missing records

**DO NOT** add background auto-translate logic to the bulk endpoint or `useTranslatedData` hook. If a record has no translations, it simply displays the original text until the record is edited.

**IMPORTANT: Multi-Language Data Entry Support**

Users can create/edit records in ANY language (not just English). The system:
1. Auto-detects which language the user is currently using (from `localStorage`)
2. Translates to ALL OTHER languages (including English if data was entered in Arabic/Latvian)
3. The `useTranslatedData` hook fetches translations for ALL locales (no early-return for English)

**DO NOT** add `locale === 'en'` early-returns in translation hooks or API routes — records may contain non-English text that needs English translations.

**Adding Dynamic Translation to a New Page:**

1. **Import the hooks:**
```typescript
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
```

2. **Add translation hook for list data (read-only, fetches existing translations):**
```typescript
const { data: translatedRisks } = useTranslatedData(risks, { modelName: 'Risk' });
// Use translatedRisks instead of risks for display
```

3. **Add triggerTranslation after create/edit (this is the ONLY place translations are triggered):**
```typescript
// After successful API response
triggerTranslation('Risk', savedRisk.id, { name: savedRisk.name, description: savedRisk.description });
```

4. **Add translateRecord in API route handlers (server-side trigger on create/edit):**
```typescript
// In POST/PUT API handlers, after successful DB write
if (customerAccountId) void translateRecord(customerAccountId, 'Risk', risk.id, { name: risk.name, description: risk.description });
```

5. **Register new models** in `src/lib/translation-config.ts` if not already listed.

**Key Rules:**
- `triggerTranslation()` auto-reads the current locale from `localStorage` — no need to pass it manually
- The Python backend API auto-detects source language and translates accordingly
- `useTranslatedData` only fetches existing translations — it never triggers new ones
- For lookup helpers (e.g., showing translated names in dropdowns), use the `useCallback` pattern:
```typescript
const tCat = useCallback((id: string) => translatedCategories.find(c => c.id === id)?.name, [translatedCategories]);
// Usage: {tCat(item.categoryId) || item.categoryName}
```

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

**CRITICAL: Run Local Build Before Every Deployment**

Before deploying to Vercel, ALWAYS run a local production build to catch TypeScript errors:

```bash
cd "C:\Claude apps\grc-app"
npm run build
```

This is critical because:
- Vercel runs stricter TypeScript checking during production builds
- Errors that don't appear in `npm run dev` will fail the Vercel build
- Common issues: `null` vs `undefined`, missing interface properties, Prisma `select`/`include` conflicts, implicit `any` types
- Fix ALL errors locally before attempting deployment

**IMPORTANT: Full Deployment with Database Seeding (Recommended Approach)**

Due to git author permission issues with Vercel, use this temp directory approach:

```bash
# Step 1: Create temp directory and copy files (without .git)
rm -rf /c/temp/grc-deploy 2>/dev/null
mkdir -p /c/temp/grc-deploy
cd "C:\Claude apps\grc-app"
cp -r src package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs prisma components.json public .vercel scripts locales i18n /c/temp/grc-deploy/

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


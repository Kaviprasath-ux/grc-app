# Folder Structure

**Document:** Folder Structure and File Organisation Reference  
**Application:** GRC (Governance, Risk, and Compliance) Platform  
**Last Updated:** 2026-06-29

---

## Table of Contents

1. [The Import Alias: What `@/` Means](#1-the-import-alias-what--means)
2. [Root-Level Files and Folders](#2-root-level-files-and-folders)
3. [`src/app/` — The Application Core](#3-srcapp--the-application-core)
4. [`src/app/(protected)/` — Authenticated Routes](#4-srcappprotected--authenticated-routes)
5. [`src/app/api/` — REST API Endpoints](#5-srcappapi--rest-api-endpoints)
6. [`src/lib/` — Server-Only Utilities](#6-srclib--server-only-utilities)
7. [`src/hooks/` — Client-Side React Hooks](#7-srchooks--client-side-react-hooks)
8. [`src/components/` — UI Building Blocks](#8-srccomponents--ui-building-blocks)
9. [`src/contexts/` — React Contexts](#9-srccontexts--react-contexts)
10. [`src/types/` — TypeScript Type Definitions](#10-srctypes--typescript-type-definitions)
11. [`prisma/` — Database Configuration](#11-prisma--database-configuration)
12. [`scripts/` — Build-Time and Maintenance Scripts](#12-scripts--build-time-and-maintenance-scripts)
13. [`locales/` — Generated Translation Files](#13-locales--generated-translation-files)
14. [`i18n/` — Translation Source Files](#14-i18n--translation-source-files)
15. [`docs/` — Developer Documentation](#15-docs--developer-documentation)
16. [`uploads/` — File Storage](#16-uploads--file-storage)
17. [`public/` — Static Web Assets](#17-public--static-web-assets)
18. [File Naming Conventions](#18-file-naming-conventions)

---

## 1. The Import Alias: What `@/` Means

Throughout the codebase you will see import statements like:

```typescript
import { withAuth } from "@/lib/api-auth";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
```

The `@/` prefix is an **import alias** configured in `tsconfig.json`. It is a shorthand that always refers to the `src/` directory of the project:

- `@/lib/api-auth` → `D:\GRC\grc-app\src\lib\api-auth.ts`
- `@/components/ui/button` → `D:\GRC\grc-app\src\components\ui\button.tsx`

**Why use it?** Without the alias, imports would use relative paths like `../../../lib/api-auth`. Relative paths break when files are moved and are hard to read. The `@/` alias is always absolute relative to the project root, regardless of where the importing file lives.

---

## 2. Root-Level Files and Folders

```
D:\GRC\grc-app\
├── src/               ← All application source code
├── prisma/            ← Database schema and seeds
├── scripts/           ← Utility scripts (translations, encryption)
├── locales/           ← Generated translation JSON files
├── i18n/              ← Translation source (Excel)
├── docs/              ← Developer documentation
├── uploads/           ← Uploaded files from users
├── public/            ← Static assets served as-is
├── e2e/               ← Playwright end-to-end tests
├── node_modules/      ← npm dependencies (never edit)
├── .next/             ← Build output (never commit)
├── package.json       ← Project metadata and npm scripts
├── package-lock.json  ← Exact dependency versions (commit this)
├── tsconfig.json      ← TypeScript configuration
├── next.config.ts     ← Next.js configuration
├── eslint.config.mjs  ← ESLint linting rules
├── postcss.config.mjs ← PostCSS / Tailwind CSS configuration
├── components.json    ← shadcn/ui component configuration
├── playwright.config.ts ← Playwright test configuration
├── vercel.json        ← Vercel deployment + cron job configuration
└── CLAUDE.md          ← Instructions for Claude Code AI assistant
```

### Key Root Files Explained

**`package.json`** — Defines the project's npm scripts (`dev`, `build`, `db:seed`, etc.) and lists all dependencies. When you run `npm run dev`, npm reads this file to know what command to execute.

**`tsconfig.json`** — TypeScript compiler configuration. Defines the `@/` import alias, TypeScript strictness settings, and which files to include in compilation.

**`next.config.ts`** — Next.js-specific settings: image optimization domains, experimental features, environment variable exposure.

**`vercel.json`** — Vercel deployment configuration. Contains the cron job schedule for the 7 scheduled tasks (e.g., daily due-date reminders at 08:00 UTC).

---

## 3. `src/app/` — The Application Core

The `src/app/` directory is the heart of the Next.js App Router. Its structure directly determines the URL routing of the application.

```
src/app/
├── layout.tsx              ← Root HTML layout (html, body, providers)
├── page.tsx                ← Root page (redirects to /login or /dashboard)
├── globals.css             ← Global CSS (Tailwind base, custom variables)
├── login/
│   └── page.tsx            ← Public login page (/login)
├── (protected)/            ← All authenticated routes (see Section 4)
└── api/                    ← All REST API endpoints (see Section 5)
```

### `src/app/layout.tsx` — The Root Layout

This is the outermost React component. Every page in the application is wrapped in it. It sets up:

- The `<html>` element with language attributes.
- The `<body>` element with font and theme classes.
- Global **context providers**: `SessionProvider` (NextAuth), `LanguageProvider` (i18n), `ThemeProvider`.
- The Toaster component (for toast notifications).

**Why providers here?** React Context (used for language, session, theme) must wrap every component that needs to access that context. Putting providers in the root layout ensures they wrap the entire application.

---

## 4. `src/app/(protected)/` — Authenticated Routes

Every page that requires a logged-in user lives under `(protected)/`. The parentheses make this a **Route Group** — the folder name does not appear in the URL.

```
src/app/(protected)/
├── layout.tsx                     ← Applies MainLayout (sidebar + header) to all sub-routes
├── dashboard/
│   └── page.tsx                   → /dashboard
├── organization/
│   ├── page.tsx                   → /organization
│   ├── profile/
│   │   └── page.tsx               → /organization/profile
│   ├── department/
│   │   └── page.tsx               → /organization/department
│   ├── process/
│   │   └── page.tsx               → /organization/process
│   ├── users/
│   │   └── page.tsx               → /organization/users
│   └── settings/
│       └── page.tsx               → /organization/settings
├── compliance/
│   ├── page.tsx                   → /compliance
│   ├── framework/
│   │   ├── page.tsx               → /compliance/framework
│   │   └── [id]/
│   │       └── page.tsx           → /compliance/framework/:id
│   ├── control/
│   │   └── page.tsx               → /compliance/control
│   ├── governance/
│   │   └── page.tsx               → /compliance/governance
│   ├── evidence/
│   │   └── page.tsx               → /compliance/evidence
│   ├── exceptions/
│   │   └── page.tsx               → /compliance/exceptions
│   └── kpi/
│       └── page.tsx               → /compliance/kpi
├── risks/
│   ├── page.tsx                   → /risks
│   ├── register/
│   │   └── page.tsx               → /risks/register
│   ├── assessment/
│   │   └── page.tsx               → /risks/assessment
│   ├── response/
│   │   └── page.tsx               → /risks/response
│   └── risk-matrix/
│       └── page.tsx               → /risks/risk-matrix
├── assets/
│   ├── page.tsx                   → /assets
│   ├── inventory/
│   │   └── page.tsx               → /assets/inventory
│   └── settings/
│       └── page.tsx               → /assets/settings
├── internal-audit/
│   ├── page.tsx                   → /internal-audit
│   ├── audit-universe/
│   ├── strategic-plan/
│   ├── operational-plan/
│   ├── engagements/
│   │   ├── page.tsx               → /internal-audit/engagements
│   │   └── [id]/
│   │       ├── page.tsx           → /internal-audit/engagements/:id
│   │       ├── fieldwork/
│   │       ├── findings/
│   │       └── report/
│   ├── findings/
│   ├── capa/
│   ├── reports/
│   ├── audit-charter/
│   ├── independence/
│   └── document-library/
├── tprm/
│   └── [multiple sub-routes]
├── grc/
│   ├── customer-accounts/
│   │   └── page.tsx               → /grc/customer-accounts
│   └── configuration/
│       └── page.tsx               → /grc/configuration
└── settings/
    └── page.tsx                   → /settings
```

### The `(protected)/layout.tsx`

This layout applies the `MainLayout` component to every protected route. `MainLayout` renders:

1. **Sidebar** — permission-filtered navigation links. Links whose `permission` is not held by the current user are hidden.
2. **Header** — top bar with user avatar, notification bell, language switcher.
3. **Content area** — the `{children}` slot where page components render.

---

## 5. `src/app/api/` — REST API Endpoints

API routes are files named `route.ts` that export HTTP method handlers.

```
src/app/api/
├── auth/
│   └── [...nextauth]/
│       └── route.ts           ← NextAuth handler (all auth routes)
├── risks/
│   ├── route.ts               ← GET /api/risks, POST /api/risks
│   └── [id]/
│       └── route.ts           ← GET/PATCH/DELETE /api/risks/:id
├── compliance/
│   ├── frameworks/
│   │   ├── route.ts
│   │   └── [id]/
│   │       └── route.ts
│   ├── controls/
│   ├── evidence/
│   ├── governance/
│   ├── exceptions/
│   └── kpi/
├── internal-audit/            ← 167+ endpoints
│   ├── engagements/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       ├── fieldwork/
│   │       ├── findings/
│   │       │   ├── route.ts
│   │       │   └── [findingId]/
│   │       │       ├── route.ts
│   │       │       └── capa/
│   │       │           └── route.ts
│   │       └── report/
│   ├── strategic-plan/
│   ├── operational-plan/
│   ├── findings/
│   └── capa/
├── assets/
├── organization/
│   ├── departments/
│   ├── processes/
│   └── users/
├── tprm/
├── notifications/
│   ├── route.ts               ← GET all notifications
│   └── [id]/
│       ├── route.ts
│       └── read/
│           └── route.ts       ← PATCH mark as read
├── translations/
│   └── bulk/
│       └── route.ts           ← GET translations for a set of records
├── ai/
│   ├── chat/
│   └── evidence-review/
└── cron/
    ├── due-reminders/
    │   └── route.ts           ← Daily due-date notification job
    ├── stale-translations/
    │   └── route.ts
    └── subscription-renewal/
        └── route.ts
```

### API Naming Conventions

- **Resource name** is plural and lowercase: `risks`, `controls`, `frameworks`.
- **List + create** on the root route: `GET /api/risks`, `POST /api/risks`.
- **Single item** on the `[id]` route: `GET /api/risks/:id`, `PATCH /api/risks/:id`, `DELETE /api/risks/:id`.
- **Sub-resources** nest naturally: `GET /api/internal-audit/engagements/:id/findings`.
- **Actions** that are not CRUD use descriptive route segments: `/api/notifications/:id/read`, `/api/risks/:id/submit`.

---

## 6. `src/lib/` — Server-Only Utilities

The `src/lib/` directory contains modules that run exclusively on the **server side**. They must never be imported in `"use client"` components, because they contain server-only code (database connections, secret keys, Node.js APIs).

```
src/lib/
├── auth.ts                 ← NextAuth v5 configuration (585 lines)
├── permissions.ts          ← RBAC permission matrix (1,117 lines)
├── api-auth.ts             ← withAuth wrapper, tenant helpers (680 lines)
├── prisma.ts               ← Prisma client singleton + encryption extension
├── encryption.ts           ← AES-256-GCM encrypt/decrypt helpers
├── encrypted-fields.ts     ← Registry of all encrypted model fields
├── email-service.ts        ← Email sending and template rendering (1,700 lines)
├── translation-service.ts  ← Dynamic content translation via Python API
├── audit-trail.ts          ← AuditTrail write helpers
├── navigation.ts           ← Navigation tree with permission annotations
├── safe-log.ts             ← Logger that redacts sensitive keys
└── utils.ts                ← Small utility functions (cn, formatDate, etc.)
```

### File Descriptions

**`auth.ts`** — Configures NextAuth. Defines credential providers (username/password), OAuth providers, the JWT session callback (where roles and permissions are embedded into the token), and the session object shape.

**`permissions.ts`** — The authoritative permission matrix. Contains the `RESOURCES` map (resource name → URL), the `ROLE_PERMISSIONS` map (role name → array of `{resource, action, scope}`), and the `hasPermission()` helper function.

**`api-auth.ts`** — The `withAuth` higher-order function. Every API route handler is wrapped with this. It handles authentication verification, permission checking, tenant isolation, and automatic audit trail writing.

**`prisma.ts`** — Creates the Prisma client singleton and applies the transparent field encryption extension. All application code imports `prisma` from this file — never imports `PrismaClient` directly.

**`encryption.ts`** — Low-level AES-256-GCM implementation using Node.js's built-in `crypto` module. Exports `maybeEncryptBytes`, `maybeDecryptBytes`, `encryptString`, `decryptString`, and `isEncrypted`.

**`email-service.ts`** — Sends emails using SMTP (configured via `EmailSettings` in the database). Contains 65+ template renderers for every notification event type.

**`navigation.ts`** — Defines the sidebar navigation tree. Each item has a `permission` field. The `MainLayout`'s sidebar filters this list using the current user's permissions, showing only links the user is permitted to access.

---

## 7. `src/hooks/` — Client-Side React Hooks

Hooks are reusable pieces of stateful logic for React Client Components. Files in `src/hooks/` are always imported in `"use client"` components.

```
src/hooks/
├── usePermissions.ts          ← Permission checks in the UI
├── useTranslatedData.ts       ← Fetch and overlay translated field values
├── useNotifications.ts        ← Real-time notification state
└── useDebounce.ts             ← Input debounce utility
```

### `usePermissions.ts`

Provides three hooks:

```typescript
// Returns { canView, canCreate, canEdit, canDelete, canApprove }
const { canCreate, canEdit } = usePermissions('risk.register');

// Returns true/false for a specific resource + action
const canApprove = useHasPermission('audit.findings', 'approve');

// Returns true if user has the named role
const isAuditHead = useHasRole('AuditHead');
```

These hooks read the `session.user.permissions` array from the NextAuth session (already in the browser's JWT). No network call is made — permission checks are instant.

### `useTranslatedData.ts`

Used on all list pages to overlay translations on raw database records:

```typescript
const { data: translatedRisks } = useTranslatedData(risks, { modelName: 'Risk' });
// translatedRisks[0].name is now in the user's current language
```

The hook fetches translations from `/api/translations/bulk` once per page load.

The `triggerTranslation()` export is called after a create or edit operation to kick off translation of the new/updated content:

```typescript
triggerTranslation('Risk', savedRisk.id, { name: savedRisk.name, description: savedRisk.description });
```

---

## 8. `src/components/` — UI Building Blocks

```
src/components/
├── ui/                     ← 37 shadcn/ui base components
├── layout/                 ← Application chrome components
└── shared/                 ← Business-logic-aware reusable components
```

### `src/components/ui/`

These are **unstyled-then-styled** primitive components from the [shadcn/ui](https://ui.shadcn.com/) library. They are based on [Radix UI](https://www.radix-ui.com/) accessibility primitives and styled with Tailwind CSS.

Examples include:
`button.tsx`, `input.tsx`, `dialog.tsx`, `table.tsx`, `select.tsx`, `form.tsx`, `badge.tsx`, `card.tsx`, `tabs.tsx`, `popover.tsx`, `calendar.tsx`, `toast.tsx`

**Rule:** Never modify these files. They are managed by the `shadcn/ui` CLI (`npx shadcn@latest add <component>`). Customise via Tailwind class overrides at the call site.

### `src/components/layout/`

These components build the application's visual shell:

- **`MainLayout.tsx`** — The outer wrapper: sidebar + header + content area.
- **`Sidebar.tsx`** — Renders the permission-filtered navigation tree.
- **`Header.tsx`** — Top bar: breadcrumb, notification bell, user avatar, language switcher.

### `src/components/shared/`

Reusable components that contain business logic shared across multiple modules:

- **`AuditTrailPanel.tsx`** — Displays an activity log table, used on detail pages.
- **`NotificationBell.tsx`** — In-app notification dropdown.
- **`FileUploader.tsx`** — Consistent file upload UI (used for evidence, policies, declarations).
- **`PermissionGuard.tsx`** — Conditionally renders children based on a permission check.
- **`StatusBadge.tsx`** — Coloured pill badge for statuses (Open, In Progress, Closed, etc.).
- **`ConfirmDialog.tsx`** — Confirmation modal before destructive operations.

**Rule:** A component goes in `shared/` only if it is used in two or more modules AND contains module-specific knowledge (like GRC status values). If it is purely generic UI, it belongs in `ui/`.

---

## 9. `src/contexts/` — React Contexts

**What is a React Context?** A mechanism that allows data to be passed down through the component tree without passing it as props at every level. Think of it as a global variable that any component can subscribe to.

```
src/contexts/
└── LanguageContext.tsx     ← Language and RTL state
```

### `LanguageContext.tsx`

Provides the `useLanguage()` hook to every component in the application. The hook returns:

- `t(string)` — translates a static UI string to the current language.
- `locale` — current locale code (`"en"`, `"ar"`, `"lv"`).
- `setLocale(locale)` — changes the language.
- `isRTL` — `true` if the current language is right-to-left (Arabic).

The translation data is loaded from `locales/en.json`, `locales/ar.json`, or `locales/lv.json` based on the locale stored in `localStorage`.

---

## 10. `src/types/` — TypeScript Type Definitions

TypeScript **type definitions** describe the shape of data structures. When a function returns a `Risk` object, TypeScript needs to know what fields `Risk` has and what types they are.

```
src/types/
└── next-auth.d.ts          ← Augments NextAuth session type with GRC fields
```

The `next-auth.d.ts` file extends the default NextAuth `Session` and `JWT` types to include GRC-specific fields like `customerAccountId`, `roles`, `permissions`, `departmentId`, and `auditHeadId`. Without this, TypeScript would not know these fields exist on the session object.

Prisma auto-generates its own types from the schema, so explicit type files are rarely needed for database models.

---

## 11. `prisma/` — Database Configuration

```
prisma/
├── schema.prisma           ← The authoritative database schema (~6,250 lines)
├── schema.sql              ← Auto-generated SQL version of the schema
├── seed.ts                 ← Main seeder (CustomerAccount, Roles, Superadmin, Templates)
├── dev.db                  ← SQLite development database (never commit changes to this)
├── seed-email-templates.ts ← Seeds 65+ email templates
├── seed-subscription-catalog.ts ← Seeds subscription plans and tiers
├── seed-rbac.ts            ← Seeds role-permission assignments
├── seed-risk-settings.ts   ← Seeds risk categories, types, likelihood/impact ratings
├── seed-bia-settings.ts    ← Seeds BIA categories and scoring
├── seed-audit-settings.ts  ← Seeds audit categories and types
├── seed-internal-audit.ts  ← Seeds sample audit data
├── seed-tprm.ts            ← Seeds TPRM configuration
├── seed-customer-*.ts      ← Customer-specific data seeds (non-public)
└── [many more seed files]
```

### `schema.prisma`

The single source of truth for the database structure. It defines:

- **`datasource db`** — database provider (`postgresql`) and connection string.
- **`generator client`** — generates the Prisma Client TypeScript library.
- **200+ `model` declarations** — each model maps to a database table.

**When you change the schema**, you must also regenerate `schema.sql`:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql
```

### `dev.db`

The SQLite database file used during local development. It is a single file — no server process needed. It is included in `.gitignore` for developer-specific data but the initial copy is checked in for convenience.

---

## 12. `scripts/` — Build-Time and Maintenance Scripts

These scripts are run manually (not as part of the web server) for one-time or maintenance tasks.

```
scripts/
├── init-translations.ts       ← Single source of truth for all UI translations
├── generate-translations.ts   ← Generates locales/en.json, ar.json, lv.json from init file
└── encrypt-migrate.ts         ← One-time migration to encrypt existing plaintext fileData rows
```

### `init-translations.ts`

Contains a `phrases` array listing every English UI string used in the application, paired with its Arabic and Latvian translations. This is the **source of truth** for static translations.

```typescript
const phrases = [
  { en: "Save", ar: "حفظ", lv: "Saglabāt" },
  { en: "Add New", ar: "إضافة جديد", lv: "Pievienot jaunu" },
  // ...thousands of entries
];
```

Do NOT edit `locales/*.json` directly — run `npm run generate-translations` instead to regenerate them from this source.

### `generate-translations.ts`

Reads `init-translations.ts` and writes `locales/en.json`, `locales/ar.json`, and `locales/lv.json`. Run after adding new phrases:

```bash
npx tsx scripts/generate-translations.ts
```

---

## 13. `locales/` — Generated Translation Files

```
locales/
├── en.json    ← English translations (key = phrase, value = English phrase)
├── ar.json    ← Arabic translations
└── lv.json    ← Latvian translations
```

**NEVER edit these files directly.** They are auto-generated by `scripts/generate-translations.ts`. Manual edits will be overwritten the next time the script runs.

These files are loaded by `LanguageContext.tsx` at runtime. The `t("Save")` call looks up `"Save"` in the current locale's JSON file and returns the translated string.

---

## 14. `i18n/` — Translation Source Files

```
i18n/
└── translations.xlsx    ← Master translations spreadsheet (all phrases, 3 languages)
```

This Excel file is the **human-readable master** for translations. Translators work in this file. Changes here must be ported to `scripts/init-translations.ts` and then regenerated.

---

## 15. `docs/` — Developer Documentation

```
docs/
├── SECURITY.md                     ← Encryption, key custody, rotation runbook
├── INTERNAL_AUDIT_MODULE.md        ← Internal Audit feature inventory and RBAC matrix
├── encryption-raw-sql-audit.md     ← Audit log of all raw SQL sites touching encrypted fields
└── [other documents]
```

**IMPORTANT:** Per `CLAUDE.md`, whenever Internal Audit functionality changes, `docs/INTERNAL_AUDIT_MODULE.md` must be updated.

---

## 16. `uploads/` — File Storage

```
uploads/
└── [uploaded files — never commit to git]
```

User-uploaded files (evidence attachments, policy documents, audit report PDFs) are stored in this directory during local development. In production (Vercel), file storage uses the `fileData Bytes` column in the database instead (serverless environments do not have a persistent local filesystem).

**Never commit files in this directory.** It is in `.gitignore`. Each developer's `uploads/` folder contains only their local test files.

---

## 17. `public/` — Static Web Assets

```
public/
├── favicon.ico
├── logo.png
├── fonts/
└── images/
```

Files in `public/` are served directly by the web server at the root URL. For example, `public/logo.png` is accessible at `https://app.example.com/logo.png`. Next.js does not process these files — they are served as-is.

---

## 18. File Naming Conventions

### Pages and Components

| Convention | Example | Rule |
|------------|---------|------|
| PascalCase for React components | `RiskRegisterPage.tsx` | Every `.tsx` file that exports a React component |
| kebab-case for route folders | `risk-matrix/` | URL-friendly, lowercase with hyphens |
| `page.tsx` for route pages | `risks/register/page.tsx` | Next.js App Router convention |
| `route.ts` for API handlers | `api/risks/route.ts` | Next.js App Router convention |
| `layout.tsx` for layouts | `(protected)/layout.tsx` | Next.js App Router convention |

### Hooks and Utilities

| Convention | Example | Rule |
|------------|---------|------|
| `use` prefix for hooks | `usePermissions.ts` | React convention for hooks |
| camelCase for utility files | `api-auth.ts`, `safe-log.ts` | Server utilities |
| Descriptive names | `email-service.ts` | Name describes what the module does |

### Database

| Convention | Example | Rule |
|------------|---------|------|
| PascalCase for models | `model RiskAssessment` | Prisma convention |
| camelCase for fields | `customerAccountId` | Prisma convention |
| Plural for relation arrays | `assessments RiskAssessment[]` | Prisma convention |
| `seed-*.ts` for seed files | `seed-email-templates.ts` | Clear purpose prefix |

### Tests

```
e2e/
└── *.spec.ts     ← Playwright end-to-end tests (kebab-case, .spec.ts suffix)
```

---

*For architectural context, see [System-Architecture.md](System-Architecture.md). For database models, see [Database-Overview.md](../03-Database/Database-Overview.md).*

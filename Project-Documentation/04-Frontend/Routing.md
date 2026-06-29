# Routing

## Table of Contents
1. [What is Routing?](#what-is-routing)
2. [File-System Routing in Next.js App Router](#file-system-routing)
3. [How Folders Become URL Segments](#folder-to-url-mapping)
4. [Special Files](#special-files)
5. [Dynamic Routes](#dynamic-routes)
6. [Route Groups](#route-groups)
7. [How to Add a New Page](#how-to-add-a-new-page)
8. [Navigation with the Link Component](#navigation-with-link)
9. [Programmatic Navigation with useRouter](#programmatic-navigation)
10. [The navigation.ts File](#navigationts)
11. [Permission-Filtered Navigation](#permission-filtered-navigation)
12. [All Module Routes](#all-module-routes)

---

## What is Routing?

**Routing** is the process of mapping a URL (the address in the browser's address bar) to a specific page that gets displayed. When a user clicks a link or types a URL, the router determines which component to render.

For example:
- `/` → Home/Dashboard page
- `/risks/register` → Risk Register page
- `/compliance/governance` → Governance documents page
- `/risks/abc-123` → Detail page for a specific risk with ID `abc-123`

Without routing, every navigation would require a full page reload from the server. Next.js provides **client-side routing** so navigation between pages is instant—no reload, no flash, just smooth transitions.

---

## File-System Routing in Next.js App Router

In Next.js App Router (used in this project), **the folder structure under `src/app/` is the routing configuration**. You do not write any routing configuration files. You simply create folders and add `page.tsx` files.

This is called **file-system routing** and it is one of Next.js's most powerful features because it makes the application structure immediately obvious from the directory tree.

### The Rule

Any folder inside `src/app/` that contains a `page.tsx` file becomes a navigable URL.

```
src/app/
  page.tsx                    → /
  login/
    page.tsx                  → /login
  (protected)/
    dashboard/
      page.tsx                → /dashboard
    risks/
      register/
        page.tsx              → /risks/register
      assessment/
        page.tsx              → /risks/assessment
      [id]/
        page.tsx              → /risks/:id (dynamic)
    compliance/
      framework/
        page.tsx              → /compliance/framework
      governance/
        page.tsx              → /compliance/governance
```

---

## Folder to URL Mapping

Each folder name becomes one **segment** of the URL path. Segments are separated by `/`.

```
Folder structure              URL
─────────────────────────     ──────────────────────
src/app/                      /
src/app/login/                /login
src/app/(protected)/          (no segment — route group)
src/app/(protected)/risks/    /risks
src/app/(protected)/risks/register/    /risks/register
```

### Key Rules

1. **Every folder** in the path contributes one URL segment.
2. **Route groups** (folders with parentheses like `(protected)`) are **excluded** from the URL.
3. **Dynamic segments** (folders with brackets like `[id]`) match any string at that position.
4. Only folders with a `page.tsx` file are accessible as URLs. A folder without `page.tsx` is just an organisational container.

---

## Special Files

Inside any route folder, these special filenames have specific meanings in the App Router:

### `page.tsx`

The actual page content. This is the component rendered when the user visits the URL.

```tsx
// src/app/(protected)/risks/register/page.tsx
export default function RiskRegisterPage() {
  return <div>Risk Register content here</div>;
}
```

### `layout.tsx`

A persistent wrapper applied to the `page.tsx` in the same folder AND all nested pages. Layouts do not unmount when navigating between child routes—only the `{children}` portion changes.

```tsx
// src/app/(protected)/layout.tsx
// This wraps ALL pages under (protected)/
export default function ProtectedLayout({ children }) {
  return (
    <MainLayout>
      {children}
    </MainLayout>
  );
}
```

### `loading.tsx`

Automatically shown while the page's async data is loading. Creates a React Suspense boundary. Useful for skeleton screens.

### `error.tsx`

Automatically shown when an unhandled error occurs in the page or its children. Must be a Client Component (`"use client"`).

### `not-found.tsx`

Shown when the `notFound()` function is called from within the page (e.g., when a record with the given ID does not exist).

---

## Dynamic Routes

Many pages in the GRC application show details for a specific record identified by an ID. For example:
- `/risks/clx1234abc` — the risk with ID `clx1234abc`
- `/compliance/governance/pol-456` — a specific policy

To handle this, the folder name uses square brackets: `[id]`.

```
src/app/(protected)/
  risks/
    [id]/
      page.tsx        → /risks/any-id-here
  compliance/
    governance/
      [id]/
        page.tsx      → /compliance/governance/any-id-here
```

### Accessing the Parameter

Inside the page, the dynamic segment value is available via `params`. In Next.js 16, `params` is a **Promise** that must be `await`ed:

```tsx
// src/app/(protected)/risks/[id]/page.tsx
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RiskDetailPage({ params }: PageProps) {
  const { id } = await params;

  const risk = await prisma.risk.findUnique({
    where: { id },
  });

  if (!risk) {
    notFound(); // Renders not-found.tsx
  }

  return <RiskDetailView risk={risk} />;
}
```

**Important**: Forgetting to `await` the params is a common mistake in Next.js 16. The TypeScript compiler will warn you if you try to use `params.id` without awaiting, because TypeScript knows `params` is `Promise<{ id: string }>`, not `{ id: string }`.

### The Same Pattern in API Routes

API routes also use dynamic segments and `await context.params`:

```ts
// src/app/api/risks/[id]/route.ts
export const GET = withAuth(async (req, context) => {
  const { id } = await context.params; // Must await
  // ...
});
```

---

## Route Groups

A **route group** is a folder whose name is wrapped in parentheses: `(group-name)`.

Route groups:
- Do **NOT** add a URL segment (the folder name is invisible in the URL)
- Allow you to apply a shared `layout.tsx` to a subset of pages
- Are purely organisational — they help group related pages together

### The `(protected)` Route Group

The most important route group in this application is `(protected)`:

```
src/app/
  (protected)/           ← Route group
    layout.tsx           ← Wraps ALL pages inside (protected)/
    dashboard/           → /dashboard (not /(protected)/dashboard)
    risks/               → /risks/...
    compliance/          → /compliance/...
  login/                 → /login (no layout — public page)
```

The `(protected)` layout wraps every authenticated page in the `MainLayout` component (sidebar + header). The `/login` page lives **outside** the group and therefore has no layout applied.

You could also use route groups for other purposes, such as organising feature areas without affecting URLs.

---

## How to Add a New Page

Here is the exact process for adding a new page to the GRC application. For this example, we will add a "Vendor Contracts" page at URL `/compliance/contracts`.

### Step 1: Create the folder and file

```
src/app/(protected)/compliance/contracts/page.tsx
```

### Step 2: Write the page component

```tsx
"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { PageHeader } from "@/components/shared/page-header";
import { Unauthorized } from "@/components/ui/unauthorized";

export default function ContractsPage() {
  const { t } = useLanguage();
  const { canView, isLoading } = usePermissions("compliance.contracts");

  if (isLoading) return null;
  if (!canView) return <Unauthorized />;

  return (
    <div>
      <PageHeader title={t("Vendor Contracts")} />
      {/* Page content goes here */}
    </div>
  );
}
```

### Step 3: Add a resource in `src/lib/permissions.ts`

Open `src/lib/permissions.ts` and add the new resource to the `RESOURCES` object:

```ts
'compliance.contracts': '/compliance/contracts',
```

Then add permissions for the relevant roles in `ROLE_PERMISSIONS`.

### Step 4: Add the navigation item in `src/lib/navigation.ts`

Open `src/lib/navigation.ts` and add the link inside the Compliance section:

```ts
{ name: "Contracts", href: "/compliance/contracts", icon: FileText, permission: "compliance.contracts:view" },
```

### Step 5: Create the API route (if needed)

```
src/app/api/contracts/route.ts        → GET (list), POST (create)
src/app/api/contracts/[id]/route.ts   → GET (detail), PATCH (update), DELETE
```

### Step 6: Add i18n

Add the phrase `"Vendor Contracts"` to `scripts/init-translations.ts` with Arabic and Latvian translations.

---

## Navigation with Link

Next.js provides the `<Link>` component for client-side navigation. It is imported from `next/link`.

```tsx
import Link from "next/link";

// Basic usage
<Link href="/risks/register">Risk Register</Link>

// With dynamic ID
<Link href={`/risks/${risk.id}`}>View Risk</Link>

// With className
<Link href="/compliance/framework" className="nav-link">
  Frameworks
</Link>
```

`<Link>` is **always preferred over `<a href="...">`** for internal navigation because:
- It prefetches the destination page in the background
- Navigation happens without a full page reload
- The browser's back/forward buttons work correctly

---

## Programmatic Navigation with useRouter

Sometimes you need to navigate in response to code logic rather than a user click — for example, redirecting after a form submission. Use the `useRouter` hook:

```tsx
"use client";

import { useRouter } from "next/navigation";

export function CreateRiskForm() {
  const router = useRouter();

  async function handleSubmit(data: RiskFormValues) {
    const response = await fetch("/api/risks", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const newRisk = await response.json();

    // Navigate to the new risk's detail page
    router.push(`/risks/${newRisk.id}`);
  }

  // ...
}
```

### Key `useRouter` Methods

| Method | What it does |
|--------|-------------|
| `router.push('/path')` | Navigate to a new page (adds to browser history) |
| `router.replace('/path')` | Navigate without adding to history (back button won't return here) |
| `router.back()` | Go back one step in browser history |
| `router.refresh()` | Re-fetch server data for the current page without full reload |

**Note**: `useRouter` is from `next/navigation`, not `next/router`. Importing from the wrong package is a common mistake.

---

## navigation.ts

The file `src/lib/navigation.ts` is the single source of truth for all sidebar navigation items. It exports a `navigation` array where each item describes:

```ts
interface NavItem {
  name: string;           // Display label
  href?: string;          // URL (leaf items only — parent groups have no href)
  icon?: LucideIcon;      // Icon from lucide-react
  children?: NavItem[];   // Nested items (creates a collapsible group)
  permission?: string;    // "resource:action" — hides item if user lacks this permission
  alwaysVisible?: boolean;// If true, shown regardless of permissions (e.g., Log Out)
  module?: "GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE" | "SYSTEM";
}
```

The `module` field controls which items are shown depending on the user's active module workspace. For example, a user in the `INTERNAL_AUDIT` workspace only sees navigation items tagged with `module: "INTERNAL_AUDIT"` (plus untagged cross-cutting items like Log Out).

### Example Entry

```ts
{
  name: "Risk Management",
  module: "GRC",
  icon: AlertTriangle,
  permission: "risk.dashboard:view",
  children: [
    { name: "Risk Dashboard",         href: "/risks/dashboard",          icon: PieChart,      permission: "risk.dashboard:view" },
    { name: "Risk Register",          href: "/risks/register",           icon: ClipboardList, permission: "risk.register:view" },
    { name: "Risk Assessment",        href: "/risks/assessment",         icon: Search,        permission: "risk.assessment:view" },
    { name: "Risk Response Strategy", href: "/risks/response",           icon: CheckSquare,   permission: "risk.response:view" },
    { name: "Risk Control Matrix",    href: "/risks/risk-control-matrix",icon: AlertTriangle, permission: "risk.risk-matrix:view" },
    { name: "Risk Settings",          href: "/risks/settings",           icon: Settings2,     permission: "risk.settings:create" },
    { name: "Reports",                href: "/risks/reports",            icon: FileText,      permission: "risk.reports:view" },
  ],
}
```

---

## Permission-Filtered Navigation

The sidebar does not show all navigation items to all users. Items are filtered based on the user's permissions. This is handled by `filterNavigationByPermissionsAndRole()` in `navigation.ts`.

### How It Works

1. Each `NavItem` has an optional `permission` field in the format `"resource:action"`.
2. When the Sidebar component renders, it calls `filterNavigationByPermissionsAndRole()` with the user's permission array.
3. Items the user does not have permission for are removed from the returned array.
4. Parent groups are removed if all their children are removed.

```
User has permission for:    User sees in sidebar:
risk.dashboard:view  →      Risk Dashboard ✓
risk.register:view   →      Risk Register ✓
risk.settings:create →      Risk Settings ✓ (note: uses 'create', not 'view')
                            (user does NOT see Risk Reports if they lack risk.reports:view)
```

### Role-Specific Paths

Some pages have different implementations for different roles. For example:
- `CustomerAdministrator` visiting `/compliance/framework` gets routed to `src/app/(protected)/roles/customer-administrator/compliance/framework/page.tsx` (a card-grid view)
- `GRCAdministrator` visiting `/compliance/framework` gets routed to `src/app/(protected)/roles/grc-administrator/compliance/framework/page.tsx` (a table view)

This transformation is applied automatically by `filterNavigationByPermissionsAndRole()`.

---

## All Module Routes

### System / Super-Admin Module

| URL | Description |
|-----|-------------|
| `/grc` | GRC Administration dashboard |
| `/grc/customer-accounts` | Customer account management |
| `/grc/customers` | Customer list |
| `/grc/email-settings` | Email server configuration |
| `/grc/email-templates` | Email notification templates |
| `/subscription/plan-pricing` | Subscription plan pricing |
| `/subscription/bundle-discounts` | Bundle discount management |
| `/subscription/list` | All customer subscriptions |

### Organization Module

| URL | Description |
|-----|-------------|
| `/dashboard` | Organisation dashboard |
| `/organization/profile` | Company profile |
| `/organization/context` | Strategic context |
| `/organization/users` | User management |
| `/organization/process` | Business processes and BIA |
| `/organization/reports` | Organisation reports |
| `/organization/settings` | Organisation settings |
| `/settings/subscription` | Customer subscription portal |

### Compliance Module

| URL | Description |
|-----|-------------|
| `/compliance/regulatory-intelligence` | Regulatory Intelligence Hub |
| `/compliance/framework` | Compliance frameworks |
| `/compliance/control` | Controls library |
| `/compliance/governance` | Governance documents / policies |
| `/compliance/evidence` | Evidence management |
| `/compliance/exceptions` | Exception management |
| `/compliance/kpis` | Key performance indicators |
| `/compliance/reports` | Compliance reports |
| `/compliance/master-data` | Compliance settings / master data |

### Asset Management Module

| URL | Description |
|-----|-------------|
| `/assets/inventory` | Full asset inventory |
| `/assets/classification` | Asset CIA classifications |
| `/assets/settings` | Asset master data settings |
| `/assets/reports` | Asset reports |

### Risk Management Module

| URL | Description |
|-----|-------------|
| `/risks/dashboard` | Risk dashboard |
| `/risks/register` | Risk register |
| `/risks/assessment` | Risk assessment |
| `/risks/response` | Risk response strategies |
| `/risks/risk-control-matrix` | Risk control matrix |
| `/risks/settings` | Risk master data settings |
| `/risks/reports` | Risk reports |

### Internal Audit Module

| URL | Description |
|-----|-------------|
| `/internal-audit/dashboard` | Audit dashboard |
| `/internal-audit/independence` | Independence and objectivity declarations |
| `/internal-audit/audit-charter` | Audit charter |
| `/internal-audit/audit-universe` | Auditables / audit universe |
| `/internal-audit/risk-identification` | Audit risk identification |
| `/internal-audit/risk-register` | Internal audit risk register |
| `/internal-audit/strategic-plan` | Strategic audit plan |
| `/internal-audit/operational-plan` | Operational audit plan |
| `/internal-audit/audit-engagement` | Audit engagements |
| `/internal-audit/report` | Audit reports |
| `/internal-audit/follow-up` | Follow-up meetings |
| `/internal-audit/document-library` | Audit document library |
| `/internal-audit/audit-trail` | Audit trail (activity log) |
| `/internal-audit/settings` | Audit master data settings |

### TPRM Module

| URL | Description |
|-----|-------------|
| `/tprm/program-monitor` | TPRM program monitor |
| `/tprm/control-center` | TPRM control center |
| `/tprm/vendor-management` | Vendor management |
| `/tprm/user-management` | TPRM user management |
| `/tprm/assessments` | Assessment workspace |
| `/tprm/monitoring` | Vendor monitoring |
| `/tprm/reports` | TPRM reports |
| `/tprm/configurations` | TPRM configurations |
| `/tprm/master-data` | TPRM master data |

### Technical Evidence Module

| URL | Description |
|-----|-------------|
| `/technical-evidence/dashboard` | Technical evidence dashboard |
| `/technical-evidence/settings` | Credential vault |

### Support Module

| URL | Description |
|-----|-------------|
| `/support/console` | Agent console |
| `/support/tickets` | All support tickets |
| `/support/dashboard` | Support dashboard |
| `/support/kb` | Knowledge base |
| `/support/settings` | Support settings |

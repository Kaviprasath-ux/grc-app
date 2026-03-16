# Client-Specific Module Duplication — Implementation Guide

> **Version:** 2.0
> **Last Updated:** March 2026
> **Branch:** `GRC-MultiTenant`
> **First Client:** QPost (Qatar Post)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture: Full Duplication Pattern](#2-architecture-full-duplication-pattern)
3. [Module Toggle Mechanism](#3-module-toggle-mechanism)
4. [Blueprint: How to Duplicate Any Module for a Client](#4-blueprint-how-to-duplicate-any-module-for-a-client)
5. [QPost Compliance — Reference Implementation](#5-qpost-compliance--reference-implementation)
6. [Shared Modules (Never Duplicated)](#6-shared-modules-never-duplicated)
7. [How to Extract a Client Module](#7-how-to-extract-a-client-module)
8. [How to Delete a Client Module](#8-how-to-delete-a-client-module)
9. [Rules for All Client Modules](#9-rules-for-all-client-modules)
10. [Known Issues & TODOs](#10-known-issues--todos)

---

## 1. Overview

### The Problem

Some clients require **50%+ changes** to an existing GRC module (Compliance, Risk, Asset, Audit). Modifying the shared module risks regressions for all other customers.

### The Solution

**Full module duplication** — create an isolated copy of the module with a client-specific prefix. Each duplicated module has:

- Its own **database models** (prefixed, e.g., `QPost*`)
- Its own **API routes** (namespaced, e.g., `/api/qpost-compliance/`)
- Its own **frontend pages** (separate route, e.g., `/qpost-compliance/`)
- Its own **permissions** (prefixed, e.g., `qpost-compliance.*`)
- Its own **seed data** (separate file, e.g., `prisma/seed-qpost.ts`)

A boolean toggle on `CustomerAccount` controls which version a customer sees (standard or client-specific).

### Why Not Feature Flags?

| Approach | Pros | Cons |
|----------|------|------|
| Feature flags in existing code | Less code | Spaghetti logic, impossible to extract later, high regression risk |
| **Full duplication (chosen)** | Clean separation, easy extract/delete, zero impact on other customers | More files, some code duplication |

### Current Client Modules

| Client | Module Duplicated | Prefix | Toggle Flag | Status |
|--------|------------------|--------|-------------|--------|
| QPost (Qatar Post) | Compliance | `QPost` / `qpost-compliance` | `isQpostComplianceEnabled` | In Development |

---

## 2. Architecture: Full Duplication Pattern

Every duplicated module follows this structure:

```
┌──────────────────────────────────────────────────────────┐
│ CustomerAccount                                          │
│   isQpostComplianceEnabled: Boolean                      │
│   is<Client><Module>Enabled: Boolean  (future)           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Database:    QPost* models in prisma/schema.prisma      │
│  API:         /api/qpost-compliance/*                    │
│  Pages:       /qpost-compliance/*                        │
│  Permissions: qpost-compliance.* in permissions.ts       │
│  Navigation:  Separate section in navigation.ts          │
│  Seed:        prisma/seed-qpost.ts                       │
│                                                          │
│  Toggle Flow:                                            │
│  DB → JWT Token → Session → Sidebar → Show/Hide Module  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Naming Convention

For a client `<Client>` duplicating module `<Module>`:

| Layer | Pattern | Example (QPost + Compliance) |
|-------|---------|------------------------------|
| DB Models | `<Client><Model>` | `QPostFramework`, `QPostRequirement` |
| API Routes | `/api/<client>-<module>/` | `/api/qpost-compliance/` |
| Pages | `/<client>-<module>/` | `/qpost-compliance/` |
| Permissions | `<client>-<module>.<resource>` | `qpost-compliance.frameworks` |
| Toggle Flag | `is<Client><Module>Enabled` | `isQpostComplianceEnabled` |
| Seed File | `prisma/seed-<client>.ts` | `prisma/seed-qpost.ts` |

---

## 3. Module Toggle Mechanism

### 3.1 Database Flag

Add a boolean to `CustomerAccount` in `prisma/schema.prisma`:

```prisma
model CustomerAccount {
  isQpostComplianceEnabled Boolean @default(false)
  // Future: isClientXRiskEnabled Boolean @default(false)
}
```

### 3.2 Session Propagation

The flag flows through the auth system:

```
Database (CustomerAccount)
  → JWT Token (src/lib/auth.ts — token callback)
    → Session (src/lib/auth.ts — session callback)
      → Client (useSession / sidebar / navigation)
```

**Files to modify:**
- `src/lib/auth.ts` — Read flag in token callback, expose in session callback
- `src/types/next-auth.d.ts` — Add flag to session user type

### 3.3 Navigation Filtering

**File: `src/lib/navigation.ts`**
- Add the client module's nav section alongside the standard module
- Use `showWhen` condition based on the toggle flag

**File: `src/components/layout/sidebar.tsx`**
- Pass the flag to navigation filtering logic
- When `true`: show client module, hide standard module
- When `false` (default): show standard module, hide client module

### 3.4 Admin Toggle

**File: `src/app/(protected)/grc/customer-accounts/page.tsx`**
- GRC Admin / Superadmin can toggle the flag per customer account

---

## 4. Blueprint: How to Duplicate Any Module for a Client

Follow these steps when a new client needs a customized version of an existing module.

### Step 1: Add the Toggle Flag

1. **Add boolean to `CustomerAccount`** in `prisma/schema.prisma`:
   ```prisma
   is<Client><Module>Enabled Boolean @default(false)
   ```

2. **Run migration:**
   ```bash
   npx prisma migrate dev --name add-<client>-<module>-flag
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql
   ```

3. **Add to auth session flow** — Update `src/lib/auth.ts`:
   - Token callback: read the flag from `CustomerAccount`
   - Session callback: expose as `session.user.is<Client><Module>Enabled`

4. **Add type declaration** — Update `src/types/next-auth.d.ts`:
   ```typescript
   is<Client><Module>Enabled?: boolean;
   ```

### Step 2: Duplicate Database Models

1. **Copy all models** from the source module in `prisma/schema.prisma`
2. **Prefix every model name** with `<Client>` (e.g., `Risk` → `QPostRisk`)
3. **Prefix all relation names** to avoid Prisma conflicts
4. **Keep `customerAccountId`** relation on all models for multi-tenant filtering
5. **Make schema changes** — add/remove/modify fields as the client needs
6. **Add `@@map` if needed** to control table names

**Example — Duplicating Risk models:**
```prisma
model QPostRisk {
  id                String   @id @default(cuid())
  customerAccountId String
  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id])
  // ... client-specific fields
}
```

7. **Run migration:**
   ```bash
   npx prisma migrate dev --name add-<client>-<module>-models
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql
   ```

### Step 3: Duplicate API Routes

1. **Create directory:** `src/app/api/<client>-<module>/`
2. **Copy all route files** from the source module's API directory
3. **In every route file, update:**
   - Prisma model references: `prisma.risk` → `prisma.qPostRisk`
   - Permission resource strings: `risk.register` → `qpost-risk.register`
   - Any cross-module API calls that should point to shared modules
4. **Keep `withAuth` wrapper** — it handles multi-tenant filtering automatically

**Checklist for each route file:**
- [ ] Prisma model name updated to `<Client>*` version
- [ ] Permission resource string updated to `<client>-<module>.*`
- [ ] `getTenantFilter` still used for multi-tenant safety
- [ ] Shared module references (users, departments, risks) point to standard APIs
- [ ] `translateRecord` calls use the new model name for dynamic translations

### Step 4: Duplicate Frontend Pages

1. **Create directory:** `src/app/(protected)/<client>-<module>/`
2. **Copy all page files** from the source module
3. **In every page file, update:**
   - API fetch URLs: `/api/compliance/` → `/api/<client>-<module>/`
   - Router navigation: `/compliance/` → `/<client>-<module>/`
   - Link hrefs: same pattern
   - Permission hooks: `usePermissions('compliance.governance')` → `usePermissions('<client>-<module>.governance')`
   - `useTranslatedData` model names: `'Policy'` → `'<Client>Policy'`
   - `triggerTranslation` model names: same
   - Breadcrumb links

4. **Make UI changes** as needed for the client

### Step 5: Add Permissions

1. **Open `src/lib/permissions.ts`**
2. **Add resource definitions** for the new module:
   ```typescript
   // <Client> <Module>
   '<client>-<module>.dashboard': { actions: ['view'] },
   '<client>-<module>.frameworks': { actions: ['view', 'create', 'edit', 'delete'] },
   // ... all resources
   ```
3. **Add permission matrix entries** for each role that should access the module
4. **Group all entries together** with a clear comment header

### Step 6: Add Navigation

1. **Open `src/lib/navigation.ts`**
2. **Add a navigation section** for the client module:
   ```typescript
   {
     title: '<Client> Compliance',
     icon: Shield,
     showWhen: (flags) => flags.is<Client><Module>Enabled === true,
     children: [
       { title: 'Dashboard', href: '/<client>-<module>', permission: '<client>-<module>.dashboard:view' },
       // ... all nav items
     ],
   },
   ```
3. **Add `showWhen` condition** to the STANDARD module section to hide it when the client module is active:
   ```typescript
   showWhen: (flags) => flags.is<Client><Module>Enabled !== true,
   ```

4. **Update `src/components/layout/sidebar.tsx`** to pass the new flag to navigation filtering

### Step 7: Create Seed Data

1. **Create `prisma/seed-<client>.ts`**
2. **Seed a customer account** with `is<Client><Module>Enabled: true`
3. **Seed a user** with appropriate role for that customer
4. **Seed module data** (frameworks, requirements, etc.) using the `<Client>*` Prisma models
5. **All records must have `customerAccountId`** pointing to the seeded customer

### Step 8: Register Translations

1. **Add new `<Client>*` model names** to `src/lib/translation-config.ts`
2. **Add any new UI strings** to `scripts/init-translations.ts`

### Step 9: Admin UI Toggle

1. **Update `src/app/(protected)/grc/customer-accounts/page.tsx`** — Add toggle switch for the new flag
2. **Update `src/app/api/grc/customer-accounts/route.ts`** and `[id]/route.ts` — Handle the new flag in CRUD

### Step 10: Verify

```bash
# Build to catch TypeScript errors
npm run build

# Run seed
npx tsx prisma/seed-<client>.ts

# Test login as the client user
# Verify sidebar shows client module, not standard module
# Test all CRUD operations
```

---

## 5. QPost Compliance — Reference Implementation

QPost (Qatar Post) is the first client to use the module duplication pattern. They duplicated the **Compliance** module with significant changes.

### 5.1 Key Differences from Standard Compliance

| Feature | Standard Compliance | QPost Compliance |
|---------|-------------------|-----------------|
| Controls | Full Control/ControlDomain system | **Removed** — no controls layer |
| Requirements | Linked to Controls via junction | Standalone, linked directly to Framework |
| Framework page | Table layout | Card layout with donut/bar charts |
| Compliance calculation | Based on Control implementation | Based on Requirement `implementationStatus` |
| CMM Maturity | Supported | Not supported |
| Control owner/assignee | Supported | Not applicable |
| Risk Matrix | Links to Controls | Links to Requirements (displayed as "Controls") |

### 5.1.1 IMPORTANT: "Control" vs "Requirement" Naming Confusion

**This is a critical distinction to understand when working on QPost Compliance.**

In the **database, API routes, code variables, and Prisma models**, the entity is called **"Requirement"** (e.g., `QPostRequirement`, `/api/qpost-compliance/requirements/`, `requirementType`, `requirementId`).

In the **UI (frontend display)**, the same entity is labeled **"Control"** (e.g., sidebar shows "Controls", page titles say "Controls", buttons say "Add Control", table headers say "Control Name").

This is because QPost's compliance model removed the standard Compliance "Control/ControlDomain" layer entirely. What QPost calls "Controls" in their business terminology maps to what the codebase stores as "Requirements" — standalone items linked directly to Frameworks.

**Quick Reference:**

| Layer | Term Used | Examples |
|-------|-----------|---------|
| Database (Prisma models) | **Requirement** | `QPostRequirement`, `QPostRequirementCategory`, `QPostRequirementEvidence` |
| API routes & URLs | **requirement** | `/api/qpost-compliance/requirements/`, `/api/qpost-compliance/requirements/[id]/evidences` |
| Code variables | **requirement** | `requirementType`, `requirementId`, `fetchRequirements()`, `translatedRequirements` |
| Permission resources | **controls** | `qpost-compliance.controls:view`, `qpost-compliance.controls:create` |
| UI display (sidebar, headings, labels, buttons, toasts) | **Control** | "Controls", "Add Control", "Control Name", "Control Type", "Linked Controls" |
| Translations (`t()` keys) | **Control** | `t("Controls")`, `t("Add Control")`, `t("Control Type")`, `t("Linked Controls")` |

**Rules when making changes:**
- **DO NOT rename** database models, API routes, file/folder paths, or code variable names from "requirement" to "control"
- **DO** use "Control" (not "Requirement") in any new user-visible `t()` strings for QPost pages
- The navigation item is `{ name: "Controls", href: "/qpost-compliance/requirements" }` — the display name differs from the URL path intentionally
- When adding new QPost pages or features that reference this entity, always display "Control" to the user but use "requirement" in code

### 5.2 File Inventory

| Category | Count | Location |
|----------|-------|----------|
| Frontend Pages | 28 | `src/app/(protected)/qpost-compliance/` |
| API Routes | 51 | `src/app/api/qpost-compliance/` |
| Database Models | 26 | `prisma/schema.prisma` (prefixed `QPost`) |
| Seed File | 1 | `prisma/seed-qpost.ts` |
| Integration Points | 8 | Shared config files |

### 5.3 Database Models (26 total)

**Core Framework:**
`QPostFramework`, `QPostRequirementCategory`, `QPostRequirement`, `QPostRequirementException`

**Policy & Governance:**
`QPostPolicy`, `QPostPolicyAttachment`, `QPostPolicyException`, `QPostPolicyAIReview`, `QPostGovernanceVaultDocument`, `QPostGovernanceVaultDocumentLink`

**Evidence:**
`QPostEvidence`, `QPostEvidenceAttachment`, `QPostEvidenceCycleComment`, `QPostEvidenceAIReview`, `QPostEvidenceAIIngestJob`, `QPostEvidenceAIIngestResult`, `QPostArtifact`, `QPostEvidenceArtifact`

**Junctions:**
`QPostRequirementEvidence`, `QPostRequirementPolicy`

**KPIs:**
`QPostKPI`, `QPostKPIReview`, `QPostKPIActionPlan`

**Exceptions:**
`QPostException`

### 5.4 API Routes

All under `src/app/api/qpost-compliance/`:

```
Frameworks:     GET/POST /frameworks, GET/PUT/DELETE /frameworks/[id], GET /frameworks/[id]/charts, POST /frameworks/[id]/import
Requirements:   GET/POST /requirements, GET/PUT/DELETE /requirements/[id], GET/POST /requirements/[id]/evidences, GET/POST /requirements/[id]/policies
Policies:       GET/POST /policies, GET/PUT/DELETE /policies/[id], POST /policies/[id]/approve, attachments, exceptions, export, delete-all
Evidence:       GET/POST /evidences, GET/PUT/DELETE /evidences/[id], artifacts, attachments, cycle-comments, requirements, ai-status, export, import, status-counts
Artifacts:      GET/POST /artifacts, GET/PUT/DELETE /artifacts/[id], download, link-evidences
KPIs:           GET/POST /kpis, GET/PUT/DELETE /kpis/[id], reviews, action-plans
Exceptions:     GET/POST /exceptions, GET/PUT/DELETE /exceptions/[id], comments
Governance:     GET/POST /governance-templates, GET/PUT/DELETE /governance-templates/[id], download
Regulatory:     profiles CRUD, regulations, subscribe, suggest
SOA:            GET /soa
```

### 5.5 Frontend Pages

All under `src/app/(protected)/qpost-compliance/`:

| Module | Pages | Route |
|--------|-------|-------|
| Framework | List (cards), Detail, Requirements, Policies, Evidence | `/framework`, `/framework/[id]/*` |
| Requirements | List, Detail | `/requirements`, `/requirements/[id]` |
| Governance | List (with tabs), Detail | `/governance`, `/governance/[id]` |
| Evidence | List, Detail | `/evidence`, `/evidence/[id]` |
| Exceptions | List (with charts), Detail | `/exceptions`, `/exceptions/[id]` |
| KPIs | Dashboard, Detail | `/kpis`, `/kpis/[id]` |
| Reports | List, Management Report | `/reports`, `/reports/management` |
| Risk Matrix | List, Detail | `/risk-matrix`, `/risk-matrix/[id]` |
| SOA | Single page | `/soa` |
| Master Data | Settings hub, Framework, Governance, Evidences, Templates | `/master-data/*` |
| Regulatory Intelligence | List, Add, Edit Profile | `/regulatory-intelligence/*` |

### 5.6 Integration Points (Shared Files Modified)

| File | What Was Added |
|------|---------------|
| `prisma/schema.prisma` | 26 QPost models (~528 lines) |
| `src/lib/permissions.ts` | 11 QPost resource definitions + permission matrix entries |
| `src/lib/auth.ts` | `isQpostComplianceEnabled` in JWT/session callbacks |
| `src/lib/navigation.ts` | QPost Compliance sidebar section + toggle logic |
| `src/types/next-auth.d.ts` | `isQpostComplianceEnabled` type declaration |
| `src/components/layout/sidebar.tsx` | Flag passthrough for navigation filtering |
| `src/app/(protected)/grc/customer-accounts/page.tsx` | QPost toggle in admin UI |
| `src/app/api/grc/customer-accounts/*` | QPost flag in CRUD operations |

### 5.7 Seed Data

**File:** `prisma/seed-qpost.ts`

| Data | Details |
|------|---------|
| Customer Account | Code: `QPOST_001`, `isQpostComplianceEnabled: true` |
| User | `qpostadmin` / `Baarez@2025` (CustomerAdministrator) |
| Frameworks | 3: NIA, Qatar PDPL, ISO 27001:2022 |
| Requirement Categories | 11 across all frameworks |
| Requirements | 20 with parent/child hierarchy |
| Policies | 6 (Policy + Standard types) |
| Evidence | 8 linked to NIA framework |
| Exceptions | 3 |
| KPIs | 4 with reviews and action plans |

```bash
npx tsx prisma/seed-qpost.ts
```

### 5.8 QPost Login & Access

```
Local: qpostadmin / Baarez@2025
```

Enable for a customer:
1. Login as `superadmin` or `grcadmin`
2. Go to **GRC > Customer Accounts**
3. Edit the customer → Toggle **QPost Compliance Enabled** ON
4. Save — sidebar will show QPost Compliance instead of standard Compliance

---

## 6. Shared Modules (Never Duplicated)

These modules are shared across ALL customers and should NOT be duplicated:

| Module | API | Reason |
|--------|-----|--------|
| Organization | `/api/organization/*` | Profile, Context, Processes — universal |
| Users | `/api/users` | User management is tenant-scoped already |
| Departments | `/api/departments` | Shared organizational structure |
| Risk Management | `/api/risks/*` | Risk Register, Assessment, Response |
| Asset Management | `/api/assets/*` | Inventory, Classification |
| Internal Audit | `/api/audit/*` | Universe, Planning, Fieldwork |
| Translations | `/api/translations/*` | Translation service is generic |
| Notifications | Notification service | Shared notification system |

**Important:** Client-specific modules should reference shared modules via their standard APIs. For example, QPost exceptions page uses `/api/risks` (not `/api/qpost-compliance/risks`).

Only duplicate a shared module if the client needs **fundamental structural changes** to it (different data model, different workflow). If the client just needs UI tweaks, handle that in the page layer.

---

## 7. How to Extract a Client Module

If a client module needs to become a standalone app:

### Step 1: Extract Database Models
- Copy all `<Client>*` models from `prisma/schema.prisma` to a new schema
- Remove the `<Client>` prefix from model names
- Keep or replace `customerAccountId` with a tenant ID

### Step 2: Extract API Routes
- Copy `src/app/api/<client>-<module>/` entirely
- Update Prisma model references (remove prefix)
- Update permission resource strings

### Step 3: Extract Frontend Pages
- Copy `src/app/(protected)/<client>-<module>/` entirely
- Update route links and API fetch URLs

### Step 4: Extract Permissions & Navigation
- Copy entries from `permissions.ts` and `navigation.ts`
- Rename resource strings

### Step 5: Extract Seed Data
- Copy `prisma/seed-<client>.ts`
- Update model references

### Step 6: Clean Up
- Remove all `<Client>*` entries from the 8 shared integration files

---

## 8. How to Delete a Client Module

```bash
# 1. Remove frontend pages
rm -rf src/app/(protected)/<client>-<module>/

# 2. Remove API routes
rm -rf src/app/api/<client>-<module>/

# 3. Remove DB models from prisma/schema.prisma (all <Client>* models)
# Then run:
npx prisma migrate dev --name remove-<client>-<module>-models
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql

# 4. Remove seed file
rm prisma/seed-<client>.ts

# 5. Clean up shared files:
#    - src/lib/permissions.ts — remove <client>-<module>.* entries
#    - src/lib/navigation.ts — remove client nav section + showWhen conditions
#    - src/lib/auth.ts — remove flag from JWT/session callbacks
#    - src/types/next-auth.d.ts — remove flag type
#    - src/components/layout/sidebar.tsx — remove flag passthrough
#    - src/app/(protected)/grc/customer-accounts/page.tsx — remove toggle UI
#    - src/app/api/grc/customer-accounts/* — remove flag from CRUD
#    - prisma/schema.prisma — remove flag from CustomerAccount model

# 6. Verify
npm run build
npx prisma generate
```

---

## 9. Rules for All Client Modules

### MUST Follow

1. **All client DB models MUST be prefixed** — `<Client><Model>` (e.g., `QPostFramework`, `AcmeRisk`)
2. **All client API routes MUST be namespaced** — `/api/<client>-<module>/` (e.g., `/api/qpost-compliance/`, `/api/acme-risk/`)
3. **All client pages MUST be in a separate route** — `/<client>-<module>/` (e.g., `/qpost-compliance/`)
4. **All client permissions MUST be prefixed** — `<client>-<module>.*` (e.g., `qpost-compliance.frameworks`)
5. **Never add client logic to shared module code** — If a client needs different risk behavior, create `/api/<client>-risk/` (don't modify `/api/risks`)
6. **Use shared modules via standard APIs** — Risks `/api/risks`, Users `/api/users`, Departments `/api/departments`
7. **Each client's seed data MUST be in its own file** — `prisma/seed-<client>.ts`
8. **Changes to shared files MUST be minimal** — Group entries together with clear `// <Client>` comment headers
9. **One seed file per client** — Even if multiple modules are duplicated, keep seed data in one file per client

### SHOULD Follow

10. **Keep client modules functionally independent** — A client user should complete all workflows within `/<client>-<module>/`
11. **Mirror the standard module's API structure** — Makes extraction easier
12. **Register new models in translation config** — `src/lib/translation-config.ts`
13. **Add new UI strings to translations** — `scripts/init-translations.ts`

---

## 10. Known Issues & TODOs

### QPost Compliance — Current Issues

| Issue | Severity | Details |
|-------|----------|---------|
| Risk Matrix API | Medium | `/qpost-compliance/risk-matrix` pages reference `/api/qpost-compliance/risks` which doesn't exist — should use `/api/risks` |
| Missing translations | Low | QPost-specific strings not in `scripts/init-translations.ts` — shows English fallback |
| Sparse seed data | Low | ISO 27001/PDPL frameworks have no linked policies/evidence in seed |

### Future TODOs

- [ ] Fix risk-matrix pages to use `/api/risks` instead of non-existent `/api/qpost-compliance/risks`
- [ ] Add QPost translation keys to `scripts/init-translations.ts`
- [ ] Register all QPost models in `src/lib/translation-config.ts`
- [ ] Add more seed data (link policies/evidence to all 3 frameworks)
- [ ] Add E2E tests for QPost compliance workflow
- [ ] Add `global-search.tsx` support for QPost pages

---

## Appendix: Future Scenarios

### Scenario A: QPost wants a custom Risk module

Follow the blueprint in Section 4. Key specifics:
- Toggle: `isQpostRiskEnabled` on `CustomerAccount`
- Models: `QPostRisk`, `QPostRiskAssessment`, `QPostRiskResponse`, etc.
- API: `/api/qpost-risk/`
- Pages: `/qpost-risk/`
- Permissions: `qpost-risk.*`
- Seed: Add to existing `prisma/seed-qpost.ts`

### Scenario B: A new client (e.g., Acme Corp) wants custom Compliance

- Toggle: `isAcmeComplianceEnabled` on `CustomerAccount`
- Models: `AcmeFramework`, `AcmeRequirement`, etc.
- API: `/api/acme-compliance/`
- Pages: `/acme-compliance/`
- Permissions: `acme-compliance.*`
- Seed: `prisma/seed-acme.ts`
- Navigation: Add `showWhen` condition, hide standard Compliance when active

### Scenario C: Client wants custom Asset + Risk modules

- Add TWO toggle flags: `isClientXAssetEnabled`, `isClientXRiskEnabled`
- Duplicate both modules independently
- Each can be toggled ON/OFF separately
- Navigation filtering handles both flags
- One seed file: `prisma/seed-clientx.ts`

### Scenario D: Multiple clients want different Compliance versions

- Each gets its own toggle, models, routes, pages
- Navigation shows whichever client module is enabled (only one active per customer)
- All coexist in the same codebase without interference

# Four‑Platform Architecture — Implementation Documentation

**Project:** GRC AI — independent platforms with shared identity: **GRC**, **TPRM**, **Internal Audit**, and **Technical Evidence**
**Status:** Phases 1‑11 complete and deployed
**Last updated:** 2026-05-16

> **Filename note**: this doc was created during the original three-platform migration. Technical Evidence was added as the 4th platform on 2026-05-15. Filename retained for stable external references; content reflects current four-platform model.

---

## 1. Executive summary

The application now treats **GRC**, **TPRM**, **Internal Audit**, and **Technical Evidence** as four independent platforms (workspaces) under a single login. A customer subscribes to any combination of the four; a user holds at most one role per platform but can hold roles across platforms.

Headline features delivered:

- **Per‑module subscription gating** — `audit.*` resources gate on `isInternalAuditEnabled` (was previously bundled with `isGrcAdded`)
- **Role × module assignments** — every `UserRole` row is tagged with the platform it applies to (`moduleCode`)
- **Workspace picker** — multi‑module users land on `/select-module` after login; single‑module users go straight in
- **Module‑scoped sidebar** — only the current workspace's nav is visible
- **Layout subscription gate** — bookmarked URLs into non‑subscribed modules redirect to a clear "subscription required" page
- **Cross‑module user assignment** — add an existing user to a second module via a confirm popup (preserves existing assignments)
- **All Users tab** — every customer admin can see every user with module badges + an "Assign role" action
- **Globally unique usernames + emails** — no more tenant‑scoped username collisions; login is deterministic

10 phases (P1‑P10) shipped across schema, RBAC, APIs, layout, navigation, and UI.

---

## 2. The four platforms

| Platform | URL prefix (current) | Subscription flag | Default home |
|---|---|---|---|
| **GRC** | `/dashboard`, `/organization/*`, `/compliance/*`, `/qpost-compliance/*`, `/asset-management/*`, `/risks/*` | `isGrcAdded` | `/dashboard` |
| **Internal Audit** | `/internal-audit/*` | `isInternalAuditEnabled` | `/internal-audit/dashboard` |
| **TPRM** | `/tprm/*` | `isTprmAdded` | `/tprm/program-monitor` (role‑dependent) |
| **Technical Evidence** | `/technical-evidence/*` | `isTechnicalEvidenceEnabled` | `/technical-evidence/dashboard` |
| **Super‑admin** (system) | `/grc/customer-accounts`, `/grc/customers`, `/subscription/*`, `/grc/email-*` | n/a — `GRCAdministrator` role only | `/grc` |

**Technical Evidence specifics** (4th platform, added 2026-05-15):
- Customer can subscribe to Technical Evidence alone or alongside any combination of the other 3
- Its sidebar is intentionally stripped down: only **Organization → Profile + Subscription & Billing** and **Technical Evidence → Dashboard + Credential Vault**
- The actual evidence-collection pages (was previously nested under `/compliance/technical-evidence/*`) now live under `/technical-evidence/*` and are no longer gated by GRC subscription

> **URL restructure (P5b.2)** to `/grc/*`, `/ia/*`, `/grc-admin/*` was deferred. Module‑identification today happens via `getModuleFromPath()` in `src/lib/url-module-map.ts`, which knows the current legacy prefix layout.

Cross‑cutting routes (visible/usable in every workspace): `/settings/subscription`, `/select-module`, `/subscription-required`, `/login`, `/profile`, `/api/*`.

---

## 3. Data model changes

### 3.1 `UserRole.moduleCode` (P1)

```prisma
model UserRole {
  id         String   @id @default(cuid())
  userId     String
  roleId     String
  moduleCode String?   // "GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE" | NULL (system role)
  user       User     @relation(...)
  role       Role     @relation(...)
  createdAt  DateTime @default(now())

  @@unique([userId, roleId, moduleCode])
  @@index([userId, moduleCode])
}
```

A user holds **one row per (role, module) pair**. A `null` `moduleCode` denotes a system‑wide role (only `GRCAdministrator`).

### 3.2 Globally unique `User.userName` + `User.email` (P10)

```prisma
model User {
  ...
  userName  String  @unique
  email     String  @unique
  ...
  @@unique([customerAccountId, userId])  // legacy USR‑xxx sequence per tenant
  @@index([customerAccountId])
}
```

- **Before**: usernames and emails were unique *per customer* (`@@unique([customerAccountId, userName])`). That allowed two customers to each have an "aman", and login picked one at random.
- **After**: usernames and emails are globally unique. Login is deterministic. Cross‑customer attempts to create a duplicate are rejected with a neutral *"This username/email is already in use"* message that does **not** leak the other tenant's data.

### 3.3 Customer flags (one per platform)

```prisma
model CustomerAccount {
  isGrcAdded                 Boolean @default(true)
  isTprmAdded                Boolean @default(false)
  isInternalAuditEnabled     Boolean @default(false)
  isTechnicalEvidenceEnabled Boolean @default(false)   // added 2026-05-15
  isQpostComplianceEnabled   Boolean @default(false)
  ...
}
```

The first three columns existed before Phase 1; Phase 1 wired `isInternalAuditEnabled` into gating alongside the others. `isTechnicalEvidenceEnabled` was added as part of the Technical Evidence platform migration (Phase 11) — grandfathered to `true` for all existing GRC customers via `scripts/prod-backfill-technical-evidence.ts`.

### 3.4 Subscription provisioning

Every customer with one or more module flags gets a `Subscription` envelope + per‑module `ModuleSubscription` rows (typically `COMPLIMENTARY`). Created by `ensureComplimentarySubscription()` in `src/lib/customer-complimentary.ts`:

- On customer create/edit via super‑admin UI (`/api/grc/customer-accounts/onboard` and `[id]` PUT)
- In dev seeds (`prisma/seed.ts`, `prisma/seed-customer-bts.ts`)

`getAccessSnapshot(customerAccountId)` in `src/lib/module-access.ts` derives the live `is{Module}Enabled` flags from `ModuleSubscription` state. That snapshot is what `auth.ts` puts on the session.

### 3.5 Removed (P7 cleanup)

| Item | Status |
|---|---|
| `TPRMCustomerAdmin` role | **Removed.** Customer admins use `CustomerAdministrator` + `moduleCode="TPRM"`. |
| `SUBSCRIPTION_GATING_ENABLED` env flag | **Removed.** Behavior is now unconditional (audit.* gates on `isInternalAuditEnabled`). |
| `MULTI_MODULE_PICKER_ENABLED` env flag | **Removed.** Picker is unconditional. |
| Legacy `isGrcModuleResource` helper | **Removed** — no longer reachable. |
| `TPRMAdmin` role | **Deliberately kept.** Active in vendor‑management UI + account‑overview API + chatbot. Marked as future cleanup. |

---

## 4. Role × Module map

Single source of truth: `src/lib/role-module-map.ts`.

| Role | Modules | Notes |
|---|---|---|
| `GRCAdministrator` | `system` | Super‑admin. `moduleCode=null` on UserRole. Bypasses picker. |
| `TPRMAdmin` | `system` | Legacy TPRM super‑admin. Still active. |
| `CustomerAdministrator` | `["GRC", "TPRM", "INTERNAL_AUDIT", "TECHNICAL_EVIDENCE"]` | Multi‑module. One row per active customer module. |
| `Reviewer` | `["GRC"]` | |
| `Contributor` | `["GRC"]` | UI‑hidden in Phase 4. |
| `DepartmentReviewer` | `["GRC"]` | |
| `DepartmentContributor` | `["GRC"]` | |
| `AuditHead` | `["INTERNAL_AUDIT"]` | |
| `Auditor` | `["INTERNAL_AUDIT"]` | |
| `AuditUser` | `["INTERNAL_AUDIT"]` | |
| `Auditee` | `["INTERNAL_AUDIT"]` | Scope: own department only. |
| `BusinessOwner` | `["TPRM"]` | |
| `RelationshipManager` | `["TPRM"]` | |
| `TPRMAssessor` | `["TPRM"]` | |
| `TPRMApprover` | `["TPRM"]` | |
| `TPRMAuditor` | `["TPRM"]` | |
| `AccountManager` | `["TPRM"]` | Vendor‑side. |
| `TPRMSME` | `["TPRM"]` | Vendor‑side. |
| `FactoryAdmin` | `["TPRM"]` | |
| `FactoryAssessor` | `["TPRM"]` | |
| `InternalITTeam` | `["TPRM"]` | |

> **Technical Evidence has no module-specific roles** as of 2026-05-16. Only `CustomerAdministrator` can be assigned with `moduleCode="TECHNICAL_EVIDENCE"`. Module-specific TE roles (e.g. a "TechnicalEvidenceUser") can be added later if needed.

Helper functions in `role-module-map.ts`:
- `getModulesForRole(roleName)` → `ModuleCode[] | "system"`, throws on unknown
- `isSystemRole(roleName)`
- `getRolesForModule(moduleCode)` → list of role names assignable in that module
- `isRoleValidForModule(roleName, moduleCode)` → boolean

---

## 5. Hard rules (invariants)

These are enforced at validator + UI + DB layers.

1. **A role can only be assigned for a module the customer is subscribed to.**
   Enforced by `assertRoleAllowedForCustomer(roleName, moduleCode, customerAccountId)` in `src/lib/customer-role-validator.ts`. Reads from `getActiveModules(customerAccountId)`.

2. **A user holds at most one role per module.**
   Enforced by `assertOneRolePerModule(userId, moduleCode)`. UI in Phase 9 also visually disables the "Assign role" button for users already in the current module.

3. **A role's `moduleCode` must match the role's natural module(s).**
   Enforced by `isRoleValidForModule`. System roles must have `moduleCode=null`; module roles must have a non‑null value in their `ROLE_MODULES` list. `assertRoleAllowedForCustomer` throws `ROLE_MODULE_MISMATCH` on violation.

4. **Usernames and emails are globally unique.**
   DB constraint + `assertUserGloballyUnique()` in `src/lib/user-uniqueness.ts`. Case‑insensitive.

5. **GRCAdministrator bypasses module gates.**
   No `currentModule` filter, no layout subscription gate, no picker, no role‑module map check (they're system‑wide).

---

## 6. Application flow — what users actually experience

### 6.1 Login → routing

`src/app/page.tsx` runs after login:

```
session = auth()
if not authenticated      → /login
if GRCAdministrator        → /grc                (super‑admin home)
otherwise:
  available = subscribed modules ∩ user's roleModules
  if available is empty   → /subscription-required
  if 1 module             → moduleHomeForRoles(module, roles)   (role‑aware landing)
  if 2+ modules           → /select-module        (workspace picker)
```

`moduleHomeForRoles(module, roles)` in `src/lib/url-module-map.ts` picks a landing page each role can actually view. Notable mappings:

| Module | Role | Lands on |
|---|---|---|
| INTERNAL_AUDIT | AuditHead / Auditor / AuditUser | `/internal-audit/dashboard` |
| INTERNAL_AUDIT | Auditee | `/internal-audit/fieldwork` |
| INTERNAL_AUDIT | CustomerAdministrator | `/internal-audit/risk-register` *(view-only on dashboard)* |
| TPRM | BusinessOwner | `/tprm/bo-dashboard` |
| TPRM | RelationshipManager | `/tprm/rm-dashboard` |
| TPRM | TPRMAssessor / Approver / Auditor | `/tprm/asr-dashboard` |
| TPRM | AccountManager / TPRMSME | `/tprm/am-assessments` |
| TPRM | FactoryAdmin / FactoryAssessor | `/tprm/asr-assessment-factory` |
| TPRM | InternalITTeam | `/tprm/it-issues` |
| TECHNICAL_EVIDENCE | Anyone | `/technical-evidence/dashboard` |
| GRC | Anyone | `/dashboard` |

### 6.2 Workspace picker

`/select-module` (`src/app/select-module/page.tsx`):
- Cards rendered for each module the user has both **subscription AND role** in
- Single‑module users auto‑redirect (shouldn't see the picker)
- Empty state ("No active workspaces") when nothing matches
- Click a card → write `currentModule` cookie (30‑day) → push to `moduleHomeForRoles(module, roles)`

### 6.3 ModuleContext

`src/contexts/ModuleContext.tsx` wraps the **root** layout (not just protected routes — moved up in Phase 9.4 bugfix). Provides:

- `currentModule: ModuleCode | null` — the workspace the user is currently in
- `availableModules: ModuleCode[]` — subscription ∩ roleModules (excludes `system` users)
- `setCurrentModule(m)` — writes cookie + state
- `isSystemUser: boolean` — true for `GRCAdministrator`

Initial value resolution order: **cookie → URL prefix → only‑available‑module → null**. The provider also auto‑syncs `currentModule` when the user navigates to a different module's URL (e.g., clicking a header link).

### 6.4 Sidebar (nav filtering)

`src/components/layout/sidebar.tsx`:
- Reads `currentModule` from `ModuleContext`
- Passes it to `filterNavigationByPermissionsAndRole(items, perms, roles, flags, currentModule)`
- The filter (in `src/lib/navigation.ts`) hides top‑level sections whose `module` tag doesn't match the current workspace (untagged cross‑cutting items are always visible)
- `GRCAdministrator` bypasses this filter and sees their full super‑admin nav

Each top‑level section in `navigation.ts` carries a `module` tag:
- `module: "GRC"` — Organization, Compliance, QPost Compliance, Asset Management, Risk Management
- `module: "INTERNAL_AUDIT"` — Internal Audit
- `module: "TPRM"` — TPRM
- `module: "SYSTEM"` — super‑admin sections (GRC admin, Subscription, Email)
- Untagged — Subscription & Billing, Log Out (cross‑cutting, always visible)

A "**Switch workspace**" button appears at the top of the sidebar when `availableModules.length >= 2`.

### 6.5 Layout subscription gate (Phase 6)

`src/components/layout/main-layout.tsx`:

```
on every render:
  if status !== authenticated → no-op
  if isSystemUser              → no-op   (super-admin bypasses)
  m = getModuleFromPath(pathname)
  if m is null or "SYSTEM"     → no-op
  if !availableModules.includes(m) → router.replace("/subscription-required?module=" + m)
```

So bookmarked deep links into non‑subscribed modules redirect cleanly. The `subscription-required` page offers two actions: "Choose another workspace" → `/select-module`, "Manage subscription" → `/settings/subscription`.

---

## 7. APIs

### 7.1 User CRUD

| Endpoint | What it does | Notes |
|---|---|---|
| `GET /api/users` | List users in tenant. Pass `?includeModules=true` to get `roleModules` array on each user. Used by the All Users tab. | |
| `POST /api/users` | Create a user. Calls `assertUserGloballyUnique` first (P10). Uses `assignRoleByName` to create UserRole rows. For multi‑module roles (CustomerAdministrator), expands to one row per active customer module. | Rejects with 409 if username/email taken; 403 with `RoleAssignmentError` codes if role/module rules violated. |
| `PUT /api/users/[id]` | Update user. Email check is global (excludeUserId allowed). Role updates only touch **the new role's module**, preserving other modules' rows (P8 fix). | Phase 9 critical fix: previously did `deleteMany({userId})` which wiped cross‑module assignments. |
| `DELETE /api/users/[id]` | Delete user (cascade deletes UserRole rows). | Tenant‑scoped. |

### 7.2 Cross‑module endpoints (P8)

#### `GET /api/users/check-existing?userName=X[&email=Y][&moduleCode=Z]`

Smart Add User pre‑check. Tri‑state response:

| State | Shape | UX |
|---|---|---|
| Not found | `{ exists: false }` | Normal create proceeds |
| Found, **same customer** | `{ exists: true, sameCustomer: true, user, roleModules, alreadyInModule }` | Cross‑module flow: if `alreadyInModule` → field error; otherwise → confirm popup → assign‑role |
| Found, **different customer** | `{ exists: true, sameCustomer: false }` | Block with neutral message. **No tenant data leaked.** |

#### `POST /api/users/[id]/assign-module-role`

Body: `{ moduleCode: "GRC"\|"TPRM"\|"INTERNAL_AUDIT", roleName: string }`

Adds **one** UserRole row for this user in the given module. Does NOT touch the user's UserRole rows for other modules.

- Runs `assertRoleAllowedForCustomer` + `assertOneRolePerModule`
- Returns `201 { created: true }` or `200 { created: false }` if the exact row already existed (idempotent)
- **TPRM-specific side effect**: when `moduleCode === "TPRM"`, also syncs the legacy `User.tprmRole` and `User.tprmFunctionCategory` fields so the legacy TPRM Users tab (which filters by `tprmRole != null`) sees the user. Mapping baked in:

| System role | `tprmRole` | `tprmFunctionCategory` |
|---|---|---|
| BusinessOwner | Business Owner | Business |
| RelationshipManager | Relationship Manager | Business |
| InternalITTeam | Internal IT Team | Business |
| TPRMAssessor | Assessor | TPRM Team |
| TPRMApprover | Approver | TPRM Team |
| TPRMAuditor | Auditor | TPRM Team |
| AccountManager | Account Manager | (null) |
| TPRMSME | SME | (null) |

### 7.3 Role validators (P3) — error contract

`src/lib/customer-role-validator.ts` exports `RoleAssignmentError` with typed `code` field. All endpoints below return **403** with `{ error, code }`:

| Code | Meaning | UI handling |
|---|---|---|
| `ROLE_NOT_IN_MAP` | Role isn't in `ROLE_MODULES` | Generic error |
| `ROLE_MODULE_MISMATCH` | Role's modules don't include given moduleCode | Toast |
| `MODULE_NOT_SUBSCRIBED` | Customer not subscribed to moduleCode | Toast: "module not subscribed for this customer" |
| `DUPLICATE_ROLE_IN_MODULE` | User already has a role in this module | Toast: "remove existing role first" |

Frontend message map: `src/app/(protected)/organization/users/page.tsx → roleErrorMessage()`, same in TPRM page.

### 7.4 Onboarding (super‑admin)

| Endpoint | Behaviour |
|---|---|
| `POST /api/grc/customer-accounts/onboard` | Creates customer + CustomerAdministrator user. Bug fix in P9.7: creates **one UserRole per enabled module** at user-create time (not a single `moduleCode=null` row). Also calls `assertUserGloballyUnique` for username + email. |
| `PUT /api/grc/customer-accounts/[id]` | Toggles module flags. When a flag flips ON, syncs UserRole rows for existing CustomerAdministrators of this customer. Calls `ensureComplimentarySubscription`. |

---

## 8. User Management UI (Phase 9)

Each module's user-management page has **two tabs**:

### 8.1 `/organization/users` (GRC + Internal Audit)

| Tab | Content |
|---|---|
| **Account Overview** | Hierarchical view (unchanged from pre‑Phase 9) |
| **User Management** | Existing user table. Module filtered via "Function" picker — Business/Security → GRC; Audit → Internal Audit. Phase 4 filters available functions by subscription. |
| **All Users** | Cross-module view (see §8.3) — `currentModule="GRC"` |

### 8.2 `/tprm/user-management` (TPRM)

| Tab | Content |
|---|---|
| **TPRM Users** | Existing TPRM users (filtered by legacy `tprmRole != null`) |
| **All Users** | Cross-module view — `currentModule="TPRM"` |

### 8.3 All Users tab (`src/components/shared/AllUsersTab.tsx`)

Every user of the customer in one table:
- Columns: Name · Username · Email · Department · **Modules** (badges) · **Action**
- Action button shows **"Assign role"** when user not in current module; **"In this module"** (disabled) when they are
- Click "Assign role" → opens `AssignRoleDialog`, scoped to `currentModule`

### 8.4 Smart Add User flow

When admin opens "New User" and submits the form, before the actual POST:

```
1. Compute targetModule from getModulesForRole(form.role)
2. GET /api/users/check-existing?userName=...&email=...&moduleCode=targetModule
3. Switch on response:
   - sameCustomer === false  → block with "username/email already in use"
   - alreadyInModule === true → field error: "this user already exists in this module"
   - Otherwise (cross-module match) → open UserExistsConfirmDialog
4. On confirm → open AssignRoleDialog → POST /api/users/[id]/assign-module-role
```

Both `/organization/users` and `/tprm/user-management` implement this flow.

### 8.5 Reusable components

- `src/components/shared/AssignRoleDialog.tsx` — pick a role for an existing user in a specific module. Role dropdown filtered to `getRolesForModule(moduleCode)`, hides deprecated/internal roles.
- `src/components/shared/UserExistsConfirmDialog.tsx` — shows existing user's details + current modules + the new module to add. Cancel / Confirm callbacks.
- `src/components/shared/AllUsersTab.tsx` — the shared tab component.

---

## 9. Authentication / session

`src/lib/auth.ts` + `src/types/next-auth.d.ts`.

Session shape (relevant fields):

```ts
session.user.id
session.user.roles: string[]                          // role names
session.user.roleModules: ModuleCode[]                 // distinct modules user has roles in
session.user.permissions: UserPermission[]             // expanded permission matrix
session.user.isGrcAdded / isTprmAdded / isInternalAuditEnabled
session.user.customerAccountId
session.user.subscriptionStatus: SubscriptionStatus | null
session.user.subscriptionType: SubscriptionType | null
```

Module flags are derived from `getAccessSnapshot(customerAccountId)` (reads from `Subscription`/`ModuleSubscription`), not from the raw `CustomerAccount` booleans. Falls back to the booleans if the snapshot read fails.

Header (`src/components/layout/header.tsx`) displays the role **for the current workspace**, not just `roles[0]`. Picks the first non‑CustomerAdministrator role whose modules include `currentModule`. So aman shows "Department Reviewer" in GRC and "Business Owner" in TPRM.

---

## 10. End-to-end scenarios

### Scenario A — Single-module customer (GRC only)

- **Customer**: `acme-grc-only`, `isGrcAdded=true`
- **Customer admin onboards "alice"** → Customer admin (one UserRole row, GRC) created via `/api/grc/customer-accounts/onboard`
- **alice logs in** → only one module → directly redirected to `/dashboard` → sidebar shows GRC sections only → no "Switch workspace" button

### Scenario B — Multi-module customer admin (all 4 platforms)

- **Customer**: `globex` with all four modules enabled
- **Customer admin "globex.admin"** is created with four UserRole rows: `CustomerAdministrator/GRC`, `CustomerAdministrator/TPRM`, `CustomerAdministrator/INTERNAL_AUDIT`, `CustomerAdministrator/TECHNICAL_EVIDENCE`
- **globex.admin logs in** → 4 modules available → `/select-module` shows 4 cards in a row (grid auto-widens to `max-w-6xl` at this count)
- Picks Technical Evidence → cookie set → `/technical-evidence/dashboard` → TE sidebar only (Organization + Technical Evidence sections)
- "Switch workspace" button visible → click → back to `/select-module`

### Scenario C — Aman case (cross-module module-specific role)

- **Customer**: `xyz`, GRC + TPRM subscribed
- **aman** created in GRC tab of `/organization/users` with role `DepartmentReviewer/GRC`
- Customer admin goes to `/tprm/user-management` → All Users tab → finds aman → clicks "Assign role" → picks `BusinessOwner` → save
  - `assign-module-role` runs → creates `BusinessOwner/TPRM` row + syncs legacy `tprmRole="Business Owner"` field
  - aman now has 2 UserRole rows; TPRM Users tab also shows him
- **aman logs in** → 2 modules available → `/select-module` → 2 cards
- Picks GRC → lands on `/dashboard`, header shows **"Department Reviewer"**
- Switches to TPRM → lands on `/tprm/bo-dashboard`, header shows **"Business Owner"**

### Scenario D' — Technical Evidence-only customer (added 2026-05-15)

- **Customer**: `tevidence-only`, only `isTechnicalEvidenceEnabled=true` (GRC/TPRM/IA all `false`)
- **Customer admin** with role `CustomerAdministrator/TECHNICAL_EVIDENCE`
- Logs in → 1 module → directly to `/technical-evidence/dashboard` (no picker)
- Sidebar shows only **Organization** (Profile + Subscription & Billing) and **Technical Evidence** (Dashboard + Credential Vault) — no Compliance, Risk, Assets, IA, or TPRM
- If they manually type `/compliance/framework` → layout gate redirects to `/subscription-required?module=GRC`
- Brand label in header reads "Verifai Technical Evidence"

### Scenario D — IA-only customer

- **Customer**: `betacorp`, only `isInternalAuditEnabled=true`
- **Customer admin "beta.admin"** with role `CustomerAdministrator/INTERNAL_AUDIT`
- Logs in → 1 module → directly to `/internal-audit/risk-register` (CustomerAdministrator's IA landing, since they don't have dashboard view permission)
- Sidebar shows only Internal Audit sections
- If beta.admin manually types `/compliance/framework` → layout gate redirects to `/subscription-required?module=GRC`
- Creating a new user in `/organization/users`:
  - Function dropdown shows **only "Audit"** (Business/Security filtered out — no GRC subscription)
  - Role dropdown for Audit: AuditHead / Auditor / AuditUser / Auditee
  - Creating "raj" with role `AuditHead` → one UserRole row, `AuditHead/INTERNAL_AUDIT`

### Scenario E — Cross-customer username collision

- **Customer A** has user `aman` (created first)
- **Customer B's admin** tries to create another `aman`:
  - Form submit → `/api/users/check-existing?userName=aman&...` returns `{ exists: true, sameCustomer: false }`
  - UI shows field error: *"This username or email is already in use. Please choose a different one."*
  - **No mention of Customer A** — no tenant leakage
- Even if UI check is bypassed, `assertUserGloballyUnique` in the POST handler blocks with 409
- Even if that's bypassed, `User.userName @unique` constraint rejects at the DB level

### Scenario F — User assigned a role for a module the customer doesn't have

- Customer A has only `isGrcAdded=true`
- Admin tries to assign `aman` the role `BusinessOwner` (TPRM):
  - `assertRoleAllowedForCustomer("BusinessOwner", "TPRM", customerA.id)` calls `getActiveModules(customerA.id)` → set excludes `TPRM`
  - Throws `RoleAssignmentError` with code `MODULE_NOT_SUBSCRIBED`
  - Frontend toast: *"This module isn't subscribed for this customer."*

### Scenario G — Subscription expires mid-session

- Customer with active subscription → user logs in → JWT issued with `isGrcAdded=true`
- Admin downgrades the customer → subscription marked SUSPENDED
- User clicks around for ~30 minutes (within JWT lifetime) → still has access (stale JWT)
- On next JWT refresh (every 5 min via `updateAge`) the session callback re-reads `getAccessSnapshot()` → returns `isGrcAdded=false`
- Next route render → layout gate redirects to `/subscription-required?module=GRC`

---

## 11. File map (high level)

```
prisma/
  schema.prisma                              — UserRole.moduleCode, @unique userName+email
  schema.sql                                 — regenerated mirror
  seed.ts                                    — module-aware seeding + ensureComplimentary
  seed-customer-bts.ts                       — bts customer + multi-module CustomerAdmin
  migrations/20260509120000_add_module_code_to_user_role/migration.sql
                                             — backfill script (gitignored, local-only)

src/
  app/
    page.tsx                                 — post-login redirect (0/1/2+ modules)
    select-module/page.tsx                   — workspace picker
    subscription-required/page.tsx           — blocking page for non-subscribed modules
    layout.tsx                               — wraps in <ModuleProvider> (P9.4 fix)
    api/
      users/
        route.ts                             — POST: global unique check + assignRoleByName
                                             — GET: ?includeModules support
        [id]/
          route.ts                           — PUT: scoped role replace, global email check
          assign-module-role/route.ts        — cross-module add (idempotent, TPRM legacy sync)
        check-existing/route.ts              — tri-state pre-check
      tprm/user-management/route.ts          — POST + PATCH use global uniqueness
      grc/customer-accounts/
        onboard/route.ts                     — global unique + per-module UserRole rows
        [id]/route.ts                        — module-flag edit + UserRole sync
  components/
    layout/
      main-layout.tsx                        — subscription gate
      sidebar.tsx                            — currentModule filter + Switch workspace btn
      header.tsx                             — module-aware role display
    shared/
      AssignRoleDialog.tsx
      UserExistsConfirmDialog.tsx
      AllUsersTab.tsx
  contexts/
    ModuleContext.tsx                        — currentModule cookie + availableModules
  lib/
    auth.ts                                  — roleModules in session, getAccessSnapshot
    customer-role-validator.ts               — assertRoleAllowedForCustomer, assignRoleByName
    role-module-map.ts                       — ROLE_MODULES single source of truth
    url-module-map.ts                        — getModuleFromPath, moduleHomeForRoles
    user-uniqueness.ts                       — assertUserGloballyUnique
    module-access.ts                         — getActiveModules, getAccessSnapshot
    customer-complimentary.ts                — auto-provision subscription on flag toggle
    permissions.ts                           — expandRolePermissions with module gating
    navigation.ts                            — NavItem.module tag + filter
  types/
    next-auth.d.ts                           — session.user.roleModules type
```

---

## 12. Phase log

| Phase | Goal | Key deliverable |
|---|---|---|
| P1 | Tag UserRole with module | `moduleCode` column + backfill + seed updates |
| P2 | Detach IA gating from GRC | Flip `SUBSCRIPTION_GATING_ENABLED=true` |
| P3 | Cross-module role validators | `role-module-map.ts`, `customer-role-validator.ts`, wired into `/api/users` |
| P4 | UI subscription-aware role picker | Function dropdown filtered by subscription + 403 toast handling |
| P5a | Workspace picker + ModuleContext + nav split | `/select-module`, `ModuleContext`, module-tagged navigation |
| P5b.1 | Subscription ∩ has-role intersection | `session.user.roleModules`, tighter picker filter |
| P5b.2 | URL restructure (`/grc/*`, `/ia/*`) | **Deferred** |
| P6 | Layout subscription gate | `MainLayout` redirect to `/subscription-required` |
| P7 | Cleanup (deprecated roles, legacy branches, env flags) | Dead code removed |
| P8 | Cross-module backend (check-existing, assign-module-role, includeModules) | 3 endpoints + scoped PUT |
| P9 | Cross-module frontend (tabs, dialogs, smart Add User) | 3 reusable components + 2 page integrations |
| P10 | Globally unique userName + email | Schema constraint + helper + UI tri-state |
| P11 | **Technical Evidence as 4th independent platform** (2026-05-15) | Schema column + grandfather backfill + page move (`/compliance/technical-evidence/*` → `/technical-evidence/*`) + permission rename (`compliance.technical-evidence` → `technical-evidence.*`) + 4th picker card + standalone workspace with stripped Organization (Profile + Sub & Billing only) + pricing + Razorpay plans + customer-create toggle + public signup |

---

## 13. Deployment runbook

> Code push alone is **not enough**. The database needs migration + backfill in addition.

### Pre-flight (read-only)

1. Connect to prod DB
2. Audit for duplicate usernames and emails (script: `audit-dupes.ts` pattern)
3. If duplicates found, **back up the DB** before any destructive action

### Deploy

4. **Resolve duplicates** (if any) — use `dedupe-all.ts` pattern (keep earliest by `createdAt`)
5. **Push code** → DO autodeploys the app
6. **Push schema** to prod DB:
   ```bash
   DATABASE_URL=<prod> npx prisma db push --accept-data-loss
   ```
   The flag is needed because Prisma sees the dropped `@@unique([customerAccountId, userName])` and warns — it's constraint replacement, not data deletion.
7. **Backfill `UserRole.moduleCode`** using the SQL from `prisma/migrations/20260509120000_add_module_code_to_user_role/migration.sql` (the UPDATE/INSERT block). **Critical** — without this, every existing user gets the "No active workspaces" picker.
8. **Provision subscriptions** for existing customers via a one-shot script that calls `ensureComplimentarySubscription()` for every `CustomerAccount` with any `is{Module}Enabled=true`.
9. Smoke test: log in as a test user from each customer.

### Rollback contingencies

| If… | …do this |
|---|---|
| App crashes after deploy | Re-deploy previous commit on DO |
| Schema push fails because of duplicates | Restore from backup, run dedupe, retry |
| Users see empty picker | Check `UserRole.moduleCode` rows — backfill probably didn't run |
| Users see `/subscription-required` everywhere | Customer's `Subscription`/`ModuleSubscription` rows missing — run the provisioning script |
| Login picks wrong tenant for a username | Dupes still exist in DB — re-run audit |

---

## 14. Known future cleanup

1. **`TPRMAdmin` role retirement** — still actively used in `tprm/account-overview/page.tsx`, `vendor-management/page.tsx`, and the chatbot. Removing it is a behaviour change, not pure cleanup. Estimated 1 day.
2. **URL restructure (P5b.2)** — collapse GRC routes under `/grc/*`, rename `/internal-audit/*` to `/ia/*`, super-admin to `/grc-admin/*`. Large refactor (~3-4 days). Deferred indefinitely; current `url-module-map.ts` handles the scattered legacy paths.
3. **TPRMCustomerAdmin query filters** — kept in `account-overview/route.ts` and `customer-accounts/route.ts` as a defensive read for any legacy production data. Can be removed once Prod is confirmed clean.

---

## 15. Glossary

| Term | Meaning |
|---|---|
| **Module / Platform** | One of `GRC`, `TPRM`, `INTERNAL_AUDIT`, `TECHNICAL_EVIDENCE`. Four independent products under one login. |
| **Workspace** | Synonym for module from the user's perspective ("I'm in the TPRM workspace"). |
| **moduleCode** | Column on `UserRole` tagging which platform the role applies to. `null` = system-wide. |
| **roleModules** | Distinct set of moduleCodes a user holds at least one role in. On `session.user`. |
| **availableModules** | Intersection of `customerAccount.is*Enabled` and `roleModules`. Drives the picker. |
| **currentModule** | The workspace the user is currently in. Cookie-backed via `ModuleContext`. |
| **System role** | A role with no `moduleCode` (only `GRCAdministrator`). Bypasses all module gates. |
| **Picker** | The `/select-module` page. Shown only when `availableModules.length >= 2`. |
| **Layout gate** | `MainLayout`'s `useEffect` that redirects to `/subscription-required` on deep links to non-subscribed modules. |
| **Smart Add User** | The pre-create existence check in the user form. Returns tri-state (not found / same-customer match / cross-customer match). |

# Permissions Matrix Reference

This document is the authoritative reference for which roles can perform which
actions on which resources. It also explains how to read the matrix, how
permissions are computed, and how to extend the system.

---

## Table of Contents

1. [How to Read This Matrix](#1-how-to-read-this-matrix)
2. [Resource Naming Convention](#2-resource-naming-convention)
3. [Actions Reference](#3-actions-reference)
4. [Scope Reference](#4-scope-reference)
5. [Core GRC Permissions Matrix](#5-core-grc-permissions-matrix)
6. [Internal Audit Permissions Matrix](#6-internal-audit-permissions-matrix)
7. [TPRM Permissions Matrix](#7-tprm-permissions-matrix)
8. [Support Module Matrix](#8-support-module-matrix)
9. [Wildcard Resources and Expansion](#9-wildcard-resources-and-expansion)
10. [Module Flag Filtering Summary](#10-module-flag-filtering-summary)
11. [Permission Scope Hierarchy](#11-permission-scope-hierarchy)
12. [API-Side Permission Pattern](#12-api-side-permission-pattern)
13. [Client-Side Permission Gate Pattern](#13-client-side-permission-gate-pattern)
14. [How to Add a New Permission](#14-how-to-add-a-new-permission)
15. [How to Add a New Role](#15-how-to-add-a-new-role)

---

## 1. How to Read This Matrix

Each table row is a resource. Each column is a role. The cell value uses these symbols:

| Symbol | Meaning |
|--------|---------|
| `VCEDA` | View, Create, Edit, Delete, Approve (full access) |
| `VCED` | View, Create, Edit, Delete (no approve) |
| `VCE` | View, Create, Edit |
| `VE` | View, Edit |
| `VA` | View, Approve |
| `V` | View only |
| `—` | No access |
| `V(dept)` | View only, scoped to own department |
| `VCED(own)` | Full CRUD, scoped to own records |
| `VCE(dept)` | View/Create/Edit, scoped to department |

The scope annotation appears in parentheses. When no annotation is shown, the
scope is `all` (the user can act on any record in their tenant).

---

## 2. Resource Naming Convention

Resources follow a `module.area` dot-notation pattern, defined in
`src/lib/permissions.ts` as the `RESOURCES` constant.

**Module prefixes**:

| Prefix | Module |
|--------|--------|
| `grc.` | GRC platform administration |
| `organization.` | Organization module (customer-side) |
| `compliance.` | Compliance module |
| `qpost-compliance.` | QPost Compliance module |
| `technical-evidence.` | Technical Evidence module |
| `asset.` | Asset Management module |
| `risk.` | Risk Management module |
| `audit.` | Internal Audit module |
| `tprm.` | Third-Party Risk Management module |
| `subscription.` | Subscription management |
| `support.` | Support ticketing module |

**Examples**:
- `compliance.governance` → Governance documents (policies, procedures)
- `audit.fieldwork` → Audit fieldwork (workpapers, test steps)
- `tprm.asr-assessments` → TPRM assessor workspace assessments
- `risk.register` → Risk register (the list of all risks)

---

## 3. Actions Reference

Five actions are defined in `src/lib/permissions.ts`:

| Action | HTTP Methods | Typical Use |
|--------|-------------|-------------|
| `view` | GET | Read lists, read detail pages, download reports |
| `create` | POST | Create new records, upload files |
| `edit` | PUT, PATCH | Edit existing records |
| `delete` | DELETE | Delete records |
| `approve` | POST/PATCH (approval endpoint) | Approve submitted content for publication |

---

## 4. Scope Reference

| Scope | Meaning | Database filter applied |
|-------|---------|------------------------|
| `all` | Access every record in the tenant | No additional WHERE clause |
| `department` | Access only records in user's department | `WHERE departmentId = session.departmentId` |
| `own` | Access only records owned by this user | `WHERE ownerId = session.userId` |

The `getDataScopeFilter()` function in `src/lib/api-auth.ts` translates scopes
to Prisma WHERE clauses for API routes.

---

## 5. Core GRC Permissions Matrix

### Organization Module

| Resource | GRCAdmin | CustAdmin | Reviewer | DeptReviewer | DeptContributor | Contributor |
|----------|----------|-----------|----------|-------------|-----------------|-------------|
| `organization.dashboard` | — | VCEDA | V | V(dept) | V(dept) | V |
| `organization.profile` | — | VCEDA | — | — | — | — |
| `organization.context` | — | VCEDA | VCED | V(dept) | V(dept) | — |
| `organization.users` | — | VCEDA | — | V(dept) | — | — |
| `organization.department` | — | VCEDA | VCED | V(all) | V(all) | — |
| `organization.process` | — | VCEDA | VCED | VA(dept) | VCE(dept) | VCE |
| `organization.settings` | — | VCEDA | — | — | — | — |
| `organization.bia` | — | VCEDA | — | VEA(dept) | — | — |

### Compliance Module

| Resource | GRCAdmin | CustAdmin | Reviewer | DeptReviewer | DeptContributor | Contributor |
|----------|----------|-----------|----------|-------------|-----------------|-------------|
| `compliance.dashboard` | — | VCEDA | V | V(dept) | V(dept) | V |
| `compliance.framework` | VCEDA | VCEDA | VCED | V(dept) | VCED(dept) | V |
| `compliance.controls` | VCEDA | VCEDA | VCED | VEA(dept) | VCE(dept) | VCE |
| `compliance.governance` | VCEDA | VCEDA | VCED | VA(dept) | VCE(dept) | VCE |
| `compliance.evidence` | VCEDA | VCEDA | VCED | VA(dept) | VCE(dept) | VCE |
| `compliance.domain` | VCEDA | VCEDA | — | — | — | — |
| `compliance.artifacts` | — | VCEDA | VCED | — | VCE(dept) | VCE |
| `compliance.exceptions` | — | VCEDA | VCED | VEA(dept) | VCE(dept) | VCE |
| `compliance.kpi` | — | VCEDA | VCED | V(dept) | V(dept) | VCE |
| `compliance.risk-matrix` | — | VCED | VCED | VCED(dept) | — | V |
| `compliance.settings` | — | VCEDA | — | — | — | — |
| `compliance.regulatory-intelligence` | — | VCEDA | — | — | — | — |

### Asset Management Module

| Resource | CustAdmin | Reviewer | DeptReviewer | DeptContributor | Contributor |
|----------|-----------|----------|-------------|-----------------|-------------|
| `asset.dashboard` | VCEDA | V | V(dept) | V(dept) | V |
| `asset.inventory` | VCEDA | VCED | — | — | — |
| `asset.my-inventory` | — | — | VCED(own) | VCED(own) | — |
| `asset.classification` | VCEDA | VCED | V(dept) | V(dept) | VCE |
| `asset.reports` | VCEDA | V | V(dept) | V(dept) | — |
| `asset.settings` | VCEDA | V | — | — | — |

### Risk Management Module

| Resource | CustAdmin | Reviewer | DeptReviewer | DeptContributor | Contributor |
|----------|-----------|----------|-------------|-----------------|-------------|
| `risk.dashboard` | V | V | V(dept) | V(dept) | V |
| `risk.register` | VCED | VCED | VCED(own) | VCED(dept) | VCE |
| `risk.assessment` | VCED | VCED | VCED(own) | VCED(dept) | VCE |
| `risk.response` | VCED | VCEDA | VCA(own) | VCED(dept) | VCE |
| `risk.risk-matrix` | VCED | VCED | VCED(dept) | — | V |
| `risk.settings` | VCED | V | V | V | V |
| `risk.reports` | V | V | V(dept) | V(dept) | — |

Note: `CustomerAdministrator` explicitly **cannot** approve risk responses.
`Reviewer` can. `DepartmentReviewer` can approve their own risk responses.

### Subscription Resources

| Resource | GRCAdmin | CustAdmin |
|----------|----------|-----------|
| `subscription.pricing` | VCEDA | — |
| `subscription.bundle-discounts` | VCEDA | — |
| `subscription.list` | VCEDA | — |
| `subscription.detail` | VCEDA | — |
| `subscription.customer-override` | VCEDA | — |
| `subscription.customer-portal` | — | VCEDA |

---

## 6. Internal Audit Permissions Matrix

| Resource | AuditHead | AuditManager | Auditor | AuditUser | Auditee | CustAdmin |
|----------|-----------|--------------|---------|-----------|---------|-----------|
| `audit.dashboard` | VCEDA | VCEDA | VCEDA | — | — | — |
| `audit.auditables` | VCEDA | VCEDA | VCEDA | V | — | — |
| `audit.charter` | VCEDA | VCEDA | VCEDA | V | — | — |
| `audit.risk-identification` | VCEDA | VCEDA | VCEDA | V | — | — |
| `audit.risk-register` | VCEDA | VCEDA | VCEDA | V | — | VCED |
| `audit.strategic-plan` | VCEDA | V | V | — | — | — |
| `audit.operational-plan` | VCEDA | VCEDA | V | — | — | — |
| `audit.planning` | VCEDA | VCEDA | VCEDA | V | — | — |
| `audit.independence` | VCEDA | VCEDA | VCE | V | — | — |
| `audit.fieldwork` | VCEDA | VCEDA | VCEDA | V | VE(dept) | — |
| `audit.reports` | VCEDA | VCEDA | VCEDA | V | V(dept) | — |
| `audit.capa` | VCEDA | VCEDA | VCEDA | V | VE(dept) | — |
| `audit.documents` | VCEDA | VCEDA | VCEDA | V | — | — |
| `audit.risk-universe` | VCEDA | VCEDA | VCEDA | — | — | — |
| `audit.settings` | V | V | V | — | — | VCED |
| `audit.audit-trail` | V(own) | V(own) | V(own) | V(own) | V(own) | V(all) |
| `audit.account-overview` | — | — | — | — | — | — |

Note: `audit.account-overview` is accessible to **GRCAdministrator** only (cross-tenant view).

---

## 7. TPRM Permissions Matrix

### Client-Side Platform Roles

| Resource | TPRMAdmin | GRCAdmin | CustAdmin | BusinessOwner | RelationshipManager |
|----------|-----------|----------|-----------|---------------|---------------------|
| `tprm.account-overview` | VCEDA | VCEDA | — | — | — |
| `tprm.assessments` | VCEDA | VCEDA | — | VCE | VCE |
| `tprm.task-queue` | VCEDA | VCEDA | — | — | — |
| `tprm.program-monitor` | — | — | V | — | — |
| `tprm.control-center` | — | — | VCEDA | — | — |
| `tprm.user-management` | — | — | VCEDA | — | — |
| `tprm.vendor-management` | — | VD | VCEDA | — | — |
| `tprm.reports` | — | — | V | — | — |
| `tprm.monitoring` | — | — | VCEDA | — | — |
| `tprm.configurations` | — | — | VCEDA | — | — |
| `tprm.master-data` | — | — | VCEDA | V | V |
| `tprm.settings` | — | — | VCEDA | — | — |
| `tprm.support` | — | — | V | — | — |

### Business Owner Workspace

| Resource | BusinessOwner |
|----------|--------------|
| `tprm.bo-dashboard` | VCEDA |
| `tprm.bo-assessments` | VCEDA |
| `tprm.bo-user-management` | VCEDA |
| `tprm.bo-inventory` | VCEDA |
| `tprm.bo-reports` | VCEDA |
| `tprm.bo-issues` | VCEDA |
| `tprm.bo-contracts` | VCEDA |
| `tprm.bo-monitoring` | VCEDA |
| `tprm.bo-support` | VCEDA |

### Assessor/Approver/Auditor Workspace

| Resource | TPRMAssessor | TPRMApprover | TPRMAuditor |
|----------|-------------|--------------|-------------|
| `tprm.asr-dashboard` | VCEDA | VCEDA | V |
| `tprm.asr-assessments` | VCEDA | VCEDA | V |
| `tprm.asr-inventory` | VCEDA | VCEDA | V |
| `tprm.asr-monitoring` | VCEDA | VCEDA | V |
| `tprm.asr-follow-ups` | VCEDA | VCEDA | V |
| `tprm.asr-issue-register` | VCEDA | VCEDA | V |
| `tprm.asr-assessment-factory` | VCEDA | VCEDA | — |
| `tprm.asr-template` | VCEDA | VCEDA | V |
| `tprm.asr-support` | VCEDA | VCEDA | V |
| `tprm.asr-factory-reports` | — | — | V |
| `tprm.assessments` | VE | VEA | V |

### Vendor-Side Roles

| Resource | AccountManager | TPRMSME |
|----------|----------------|---------|
| `tprm.am-assessments` | VCEDA | VCEDA |
| `tprm.am-follow-ups` | VCEDA | VCEDA |
| `tprm.am-sme-management` | VCEDA | — |
| `tprm.am-support` | VCEDA | VCEDA |
| `tprm.assessments` | VE | V |

---

## 8. Support Module Matrix

| Resource | SupportManager | SupportEngineerL3 | SupportSpecialistL2 | SupportAgentL1 |
|----------|---------------|-------------------|---------------------|----------------|
| `support.console` | VCEDA | V | V | V |
| `support.tickets` | VCEDA | VCE | VCE | VCE(own) |
| `support.dashboard` | VCEDA | V | V | V |
| `support.kb` | VCEDA | — | — | — |
| `support.settings` | VCEDA | — | — | — |

---

## 9. Wildcard Resources and Expansion

When a role's permission definition uses a wildcard resource, `expandRolePermissions()`
expands it to every matching resource in the `RESOURCES` map.

Examples of wildcards used in `ROLE_PERMISSIONS`:
- `organization.*` → expands to `organization.dashboard`, `organization.profile`,
  `organization.context`, `organization.users`, `organization.department`,
  `organization.process`, `organization.settings`, `organization.bia`, etc.
- `compliance.*` → expands to all `compliance.X` resources.
- `technical-evidence.*` → expands to all `technical-evidence.X` resources.

The `resourceMatches()` function handles pattern matching:
```typescript
function resourceMatches(pattern: string, resource: string): boolean {
  if (pattern === '*') return true;
  if (pattern === resource) return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return resource.startsWith(prefix + '.');
  }
  return false;
}
```

---

## 10. Module Flag Filtering Summary

When `expandRolePermissions()` is called with module flags, it filters out
resource classes based on subscription state. System-level roles are exempt.

| Module Flag | Resources Filtered When False |
|------------|-------------------------------|
| `isGrcAdded` | `compliance.*`, `asset.*`, `risk.*`, `qpost-compliance.*` |
| `isInternalAuditEnabled` | `audit.*` |
| `isTprmAdded` | `tprm.*` |
| `isTechnicalEvidenceEnabled` | `technical-evidence.*` |
| `isQpostComplianceEnabled` | `qpost-compliance.*` (also when false); `compliance.*` (when true — mutually exclusive) |

This means the same session token for the same user at the same organization can
yield different permission lists depending on which modules are currently active.
The flags are read from the subscription system during login and stored in the JWT.

---

## 11. Permission Scope Hierarchy

The scope hierarchy from most permissive to least:

```
all > department > own
```

When `getPermissionScope()` is called, it returns the most permissive scope
found in the permission list for that resource + action combination.

```typescript
export function getPermissionScope(
  userPermissions: UserPermission[],
  resource: string,
  action: Action
): Scope | null {
  let scope: Scope | null = null;
  for (const perm of userPermissions) {
    if (!resourceMatches(perm.resource, resource)) continue;
    if (perm.action !== action) continue;
    if (perm.scope === 'all') return 'all';          // Short-circuit on most permissive
    if (perm.scope === 'department') scope = 'department';
    if (perm.scope === 'own' && !scope) scope = 'own';
  }
  return scope;
}
```

---

## 12. API-Side Permission Pattern

All API routes are protected with `withAuth` from `src/lib/api-auth.ts`.

**Standard CRUD route:**
```typescript
export const GET    = withAuth(handler, { resource: 'risk.register', action: 'view' });
export const POST   = withAuth(handler, { resource: 'risk.register', action: 'create' });
export const PATCH  = withAuth(handler, { resource: 'risk.register', action: 'edit' });
export const DELETE = withAuth(handler, { resource: 'risk.register', action: 'delete' });
```

**Multi-resource OR check:**
```typescript
export const GET = withAuth(
  handler,
  { resource: ['audit.dashboard', 'audit.fieldwork'], action: 'view' }
);
```

**Auth-only route (logged in, no permission check):**
```typescript
export const GET = withAuthOnly(handler);
```

**Inside a handler, applying tenant isolation:**
```typescript
export const GET = withAuth(async (req, context, session) => {
  const tenantFilter = getTenantFilter(session);
  const risks = await prisma.risk.findMany({
    where: { ...tenantFilter },
  });
  return NextResponse.json(risks);
}, { resource: 'risk.register', action: 'view' });
```

**Applying scope filtering:**
```typescript
export const GET = withAuth(async (req, context, session) => {
  const tenantFilter = getTenantFilter(session);
  const scopeFilter = getDataScopeFilter(session, 'risk.register', 'view');
  const risks = await prisma.risk.findMany({
    where: { ...tenantFilter, ...scopeFilter },
  });
  return NextResponse.json(risks);
}, { resource: 'risk.register', action: 'view' });
```

---

## 13. Client-Side Permission Gate Pattern

**Single permission check:**
```tsx
import { PermissionGate } from '@/components/ui/permission-gate';

<PermissionGate resource="compliance.governance" action="create">
  <Button onClick={handleCreate}>New Policy</Button>
</PermissionGate>

// With a fallback element:
<PermissionGate
  resource="risk.response"
  action="approve"
  fallback={<Button disabled>Approve (No Permission)</Button>}
>
  <Button onClick={handleApprove}>Approve</Button>
</PermissionGate>
```

**Multiple permissions (AND logic):**
```tsx
import { MultiPermissionGate } from '@/components/ui/permission-gate';

<MultiPermissionGate
  permissions={[
    { resource: 'compliance.governance', action: 'edit' },
    { resource: 'compliance.governance', action: 'approve' },
  ]}
>
  <ApproveAndEditButton />
</MultiPermissionGate>
```

**Multiple permissions (OR logic):**
```tsx
<MultiPermissionGate
  permissions={[
    { resource: 'risk.register', action: 'create' },
    { resource: 'risk.register', action: 'edit' },
  ]}
  requireAny
>
  <ModifyRiskButton />
</MultiPermissionGate>
```

**Role-based gate (use sparingly):**
```tsx
import { RoleGate } from '@/components/ui/permission-gate';

<RoleGate roles={['AuditHead', 'CustomerAdministrator']}>
  <AdminOnlySection />
</RoleGate>
```

Note: Prefer `PermissionGate` over `RoleGate` in most cases. `RoleGate` is
appropriate only when the UI layout differs fundamentally by role (not just
which buttons are visible).

**Reading permissions in hooks:**
```typescript
import { usePermissions, useHasPermission, usePermissionScope } from '@/hooks/usePermissions';

// All actions at once:
const { canView, canCreate, canEdit, canDelete, canApprove } =
  usePermissions('audit.fieldwork');

// Single action:
const canCreateStrategicPlan = useHasPermission('audit.strategic-plan', 'create');

// Get scope (for data filtering):
const scope = usePermissionScope('risk.register', 'view');
// scope === 'department' → only show department's risks in the list
```

---

## 14. How to Add a New Permission

To add a new permission to an existing role, edit `src/lib/permissions.ts`:

1. If you are adding a new resource, add it to the `RESOURCES` object:
   ```typescript
   'mymodule.myfeature': '/mymodule/myfeature',
   ```

2. Add the permission to the appropriate role(s) in `ROLE_PERMISSIONS`:
   ```typescript
   CustomerAdministrator: [
     // ... existing permissions ...
     { resource: 'mymodule.myfeature', actions: ['view', 'create', 'edit'], scope: 'all' },
   ],
   ```

3. No migration needed — permissions are computed from the `ROLE_PERMISSIONS`
   matrix on every login and JWT refresh.

4. To protect the API route:
   ```typescript
   export const GET = withAuth(handler, { resource: 'mymodule.myfeature', action: 'view' });
   ```

5. To show/hide UI elements:
   ```tsx
   <PermissionGate resource="mymodule.myfeature" action="create">
     <Button>New Item</Button>
   </PermissionGate>
   ```

---

## 15. How to Add a New Role

To add a new role to the system:

1. Add the role definition to the `ROLES` object in `src/lib/permissions.ts`:
   ```typescript
   MyNewRole: {
     name: 'MyNewRole',
     description: 'Description of what this role does',
   },
   ```

2. Add a `RoleName` entry — the `ROLES` type is `as const`, so TypeScript will
   automatically include the new key in `RoleName`.

3. Add the permission matrix entry to `ROLE_PERMISSIONS`:
   ```typescript
   MyNewRole: [
     { resource: 'organization.dashboard', actions: ['view'], scope: 'all' },
     { resource: 'compliance.framework', actions: ['view', 'create'], scope: 'department' },
   ],
   ```

4. If the role should be available for assignment in the UI, ensure it is NOT
   in the hidden roles list in `AssignRoleDialog`.

5. Create the role record in the database via Prisma (or let it be created
   automatically by `ensureTprmUserRole` if it is a TPRM auto-provisioned role):
   ```typescript
   await prisma.role.create({
     data: { name: 'MyNewRole', description: '...', isSystem: false },
   });
   ```

6. The role's `moduleCode` for `UserRole` assignments should reflect which
   module workspaces the user should have access to.

7. If the new role should bypass module flag filtering (platform-level role),
   add it to the `isSystemRole` check in `expandRolePermissions()`:
   ```typescript
   const isSystemRole = roleNames.some(r =>
     r === 'GRCAdministrator' || r === 'TPRMAdmin' || /* ... */ r === 'MyNewRole'
   );
   ```

# RBAC Feature Guide (User & Developer Perspective)

This document explains how Role-Based Access Control works from the perspective
of both end users (what can I do?) and developers (how do I build new features
with proper access control?).

---

## Table of Contents

1. [Why RBAC Matters for GRC](#1-why-rbac-matters-for-grc)
2. [User Journey: Getting Access](#2-user-journey-getting-access)
3. [Role Assignment by CustomerAdministrator](#3-role-assignment-by-customeradministrator)
4. [What Each Role Can See and Do](#4-what-each-role-can-see-and-do)
5. [Permission Gate in the UI](#5-permission-gate-in-the-ui)
6. [How Modules Are Gated by Subscription](#6-how-modules-are-gated-by-subscription)
7. [How Department Scope Works](#7-how-department-scope-works)
8. [Practical Examples](#8-practical-examples)
9. [Troubleshooting Permission Denied Errors](#9-troubleshooting-permission-denied-errors)
10. [Building a New Feature with Proper Permissions](#10-building-a-new-feature-with-proper-permissions)
11. [The Audit Trail and RBAC](#11-the-audit-trail-and-rbac)

---

## 1. Why RBAC Matters for GRC

A Governance, Risk, and Compliance application handles sensitive information:
risk assessments, internal audit findings, third-party vendor evaluations,
compliance gaps, and evidence of control effectiveness. Not everyone in the
organization should see or modify everything.

Consider a real scenario:
- A **compliance analyst** (DepartmentContributor) should be able to upload
  evidence for controls assigned to their department.
- They should NOT be able to delete audit findings written by the auditors.
- They should NOT be able to see risk assessments from other departments.
- A **vendor** participating in a TPRM assessment should ONLY see their own
  assessment questionnaire — not other vendors' assessments or the organization's
  internal risk register.

RBAC makes these distinctions systematic and auditable. When a compliance
officer asks "who can approve risk responses?", the answer comes from the
permission matrix — not from tribal knowledge or ad-hoc configuration.

---

## 2. User Journey: Getting Access

When a new employee joins and needs to use the GRC application:

```
Step 1: Administrator creates user account
  - Organization > Users > Add User
  - Fills in: Full Name, Email, Username, Department, Password

Step 2: Administrator assigns role(s)
  - Clicks "Assign Role" on the user
  - Selects the appropriate role (e.g., DepartmentContributor)
  - Specifies the module (e.g., GRC)
  - Saves the assignment

Step 3: User receives login credentials (via email or direct communication)

Step 4: User logs in
  - NextAuth authenticates the user
  - JWT token created with their roles, permissions, and module flags
  - User is redirected to the appropriate dashboard for their modules

Step 5: User sees only what they are permitted to see
  - Navigation sidebar shows only accessible pages
  - Action buttons (Create, Edit, Delete, Approve) are visible only where permitted
  - Data is filtered to their department's records (if department-scoped role)
```

---

## 3. Role Assignment by CustomerAdministrator

The `CustomerAdministrator` is the only role that can assign roles to users
within their tenant. (GRCAdministrator can manage all tenants but typically
delegates this to the customer's administrator.)

### Available Roles in the Assignment UI

Not all 25 roles are visible in the role assignment dialog. The following roles
are hidden from the UI (handled automatically or deprecated):
- `Contributor` (deprecated — use `DepartmentContributor`)
- System/platform roles (assigned by GRCAdministrator only)
- `InternalITTeam` (auto-assigned via TPRM configuration)

### Role Assignment Rules

1. A user can have multiple roles simultaneously.
2. Each role assignment is scoped to a module code (`GRC`, `TPRM`,
   `INTERNAL_AUDIT`, `TECHNICAL_EVIDENCE`).
3. TPRM roles (BusinessOwner, RelationshipManager, AccountManager, etc.) are
   typically auto-provisioned via the TPRM user management workflow, not the
   standard role assignment dialog.
4. Internal Audit roles (AuditHead, AuditManager, Auditor, Auditee) are
   assigned by the AuditHead or CustomerAdministrator when setting up the audit
   team.

---

## 4. What Each Role Can See and Do

### CustomerAdministrator: Full Organization Control

The CustomerAdministrator sees the complete application. They can access all
pages except:
- The GRC platform administration pages (these belong to GRCAdministrator).
- The internal audit workflow pages (creating strategic plans belongs to AuditHead).

**Navigation they see**: Organization, Compliance, Risk Management, Asset
Management, Internal Audit Settings, TPRM (if subscribed), Support.

**Typical user profile**: The organization's compliance director or IT risk
manager who oversees the entire GRC program.

### Reviewer: Senior Reviewer Without Admin Access

Reviewers have the same CRUD access as CustomerAdministrators across Compliance,
Risk, and Asset modules — but they cannot access settings pages, user management,
or profile configuration.

**Key differentiator**: Reviewers can **approve risk responses**. CustomerAdministrators
cannot (this is an intentional design decision — the approver role should be
separate from the administrator role).

**Typical user profile**: A department head or senior manager who reviews and
signs off on compliance documents and risk treatments.

### DepartmentReviewer: Scoped Approval Authority

DepartmentReviewers are the department-level equivalent of Reviewers. Their
data access is narrowed in two ways:
1. **Compliance and organization**: view/approve items scoped to their department.
2. **Risk and assets**: manage only records they personally own (`scope: own`).

They have approval authority for items in their scope, which is critical for
workflows where department heads must sign off on their department's risks and controls.

**Typical user profile**: A department manager who approves compliance controls
and risk responses for their team.

### DepartmentContributor: The General Staff Role

This is the most commonly assigned role for employees who contribute to the GRC
program. It provides broad access to create and edit content within their
department's scope, without any approval authority.

**Typical user profile**: A compliance analyst, risk officer, or IT analyst who
manages the day-to-day GRC tasks for their department.

### AuditHead: Complete Audit Authority

The AuditHead has complete authority over the Internal Audit module. They are the
only role that can create Strategic Plans. They can manage every aspect of the
audit lifecycle: universe, charter, planning, fieldwork, reports, CAPA.

**Important**: AuditHeads only see their own team's data. If an organization has
two AuditHeads (e.g., one for IT audit, one for operational audit), each sees
only their own engagements. CustomerAdministrators see data from all AuditHeads.

**Typical user profile**: The Chief Audit Executive or Head of Internal Audit.

### Auditor: The Practitioner Role

Auditors conduct the actual audit work. They can create and manage engagements,
write findings, upload fieldwork evidence, and track CAPA items. They cannot
create Strategic Plans and have read-only access to operational plans.

**Important naming note**: In the application UI, this role is displayed as
"Auditor". The internal system key for this role is `Auditee`. This is a
historical artifact — the old `Auditor` role was retired and replaced. If you
see `Auditee` in database records or API responses, it refers to the practitioner
role displayed as "Auditor" in the UI.

**Typical user profile**: An internal auditor who conducts fieldwork and writes findings.

### Auditee: Department Respondent

The Auditee role is designed for department staff who are being audited. They
receive limited access to respond to audit requests — they can update fieldwork
items assigned to their department and view reports for their department. They
cannot initiate or manage audits.

**Typical user profile**: A department manager or staff member whose work is
being reviewed by the audit team.

### TPRM Vendor Roles (AccountManager, TPRMSME)

These roles are for the vendor organization's staff, not the client organization.
They can only see assessment questionnaires addressed to them. Their data access
is isolated by the vendor's `accountManagerEmail` field — they cannot see any
other vendor's assessments or the client's internal data.

---

## 5. Permission Gate in the UI

The application uses a declarative approach to permission-controlled UI elements.
Instead of writing `if/else` logic throughout components, developers use the
`PermissionGate` component:

### PermissionGate: Single Permission

```tsx
// The "New Risk" button only appears if the user can create risks:
<PermissionGate resource="risk.register" action="create">
  <Button onClick={() => setCreateDialogOpen(true)}>
    {t("Add New")}
  </Button>
</PermissionGate>
```

### PermissionGate with Fallback

```tsx
// Show a disabled button instead of hiding entirely:
<PermissionGate
  resource="risk.response"
  action="approve"
  fallback={
    <Button disabled title="You don't have approve permission">
      {t("Approve")}
    </Button>
  }
>
  <Button onClick={handleApprove} variant="default">
    {t("Approve")}
  </Button>
</PermissionGate>
```

### PermissionGate in Table Action Columns

```tsx
// Action column for each row in a data table:
<TableCell>
  <PermissionGate resource="audit.capa" action="edit">
    <Button size="sm" onClick={() => handleEdit(row.id)}>
      {t("Edit")}
    </Button>
  </PermissionGate>

  <PermissionGate resource="audit.capa" action="delete">
    <Button size="sm" variant="destructive" onClick={() => handleDelete(row.id)}>
      {t("Delete")}
    </Button>
  </PermissionGate>
</TableCell>
```

### RoleGate: Role-Specific UI Sections

For cases where the entire layout differs by role (not just button visibility):

```tsx
import { RoleGate } from '@/components/ui/permission-gate';

// Show a card grid to administrators, a simple list to others:
<RoleGate roles="CustomerAdministrator">
  <FrameworkCardGrid frameworks={frameworks} />
</RoleGate>
<RoleGate roles={['Reviewer', 'DepartmentReviewer']}>
  <FrameworkSimpleList frameworks={frameworks} />
</RoleGate>
```

**Guideline**: Use `PermissionGate` for 90% of cases (hiding/showing action
buttons). Use `RoleGate` only when the page structure itself is fundamentally
different based on role.

---

## 6. How Modules Are Gated by Subscription

Customer organizations subscribe to specific modules. A customer might subscribe
to GRC only, or to GRC + Internal Audit, or to TPRM only. The module flags in
the session determine which modules are accessible.

```
Session flags:
  isGrcAdded: true
  isTprmAdded: false
  isInternalAuditEnabled: true
  isTechnicalEvidenceEnabled: false
```

In this example, the user's permissions are filtered to remove all TPRM and
Technical Evidence resources. Even if the user is assigned the `CustomerAdministrator`
role (which has `tprm.*` in its permission matrix), those TPRM resources are
stripped out by `expandRolePermissions()`.

The navigation sidebar automatically hides menu items for modules the user does
not have permission to access (using the same permission checks via
`canAccessRoute()`). The user never sees a blank page with "Access Denied" — they
simply never see the module in the navigation.

### Module Flags vs. Role Assignment

Module flags and role assignments are both required for access:
- **Module flag**: Controls whether the module's resources appear in the
  permission expansion at all.
- **Role assignment with `moduleCode`**: Controls which workspace the user
  can enter (the module selector screen).

A user with `CustomerAdministrator` role but `isTprmAdded: false` will have no
TPRM permissions. A user with a TPRM role assigned but `isTprmAdded: false` will
also have no TPRM permissions.

---

## 7. How Department Scope Works

Department-scoped permissions (`scope: 'department'`) restrict a user to data
belonging to their department.

### The `departmentId` Field

Every user has a `departmentId` in their session (set from the `UserRole.departmentId`
or the user's assigned department). Every department-scoped resource record has
a `departmentId` field.

When a DepartmentContributor loads the Compliance controls list, the API applies:
```typescript
const scopeFilter = getDataScopeFilter(session, 'compliance.controls', 'view');
// Returns: { departmentId: session.departmentId }
```

The Prisma query becomes:
```typescript
prisma.control.findMany({
  where: {
    customerAccountId: session.customerAccountId,
    departmentId: session.departmentId,  // ← Department filter applied
  },
});
```

### Scope: Own

For the `scope: 'own'` case (e.g., `DepartmentReviewer`'s risk register):
```typescript
const scopeFilter = getDataScopeFilter(session, 'risk.register', 'view');
// Returns: { ownerId: session.userId }
```

The user only sees risks where they are listed as the owner.

### Scope: All (No Filter)

For `scope: 'all'`:
```typescript
const scopeFilter = getDataScopeFilter(session, 'compliance.framework', 'view');
// Returns: {} (empty — no additional filter)
```

The user sees all records in their tenant.

---

## 8. Practical Examples

### Example 1: Auditor Can View/Create Findings but Not Delete

The Auditor role has these permissions for `audit.fieldwork`:
```
{ resource: 'audit.fieldwork', actions: ['*'], scope: 'all' }
```

This means ALL actions including delete. However, the schema comment says "NO
Settings" — and the delete of certain high-privilege audit resources (like
strategic plans) is explicitly limited.

For `audit.capa`:
```
{ resource: 'audit.capa', actions: ['*'], scope: 'all' }
```

So Auditors CAN delete CAPA items. The restriction is on specific resources:
- `audit.strategic-plan`: Auditor can only `view` (not create/edit/delete).
- `audit.settings`: Auditor can only `view` (not create/edit/delete).

In the UI, the Delete button on the CAPA page will be visible to Auditors.
The Delete button on the Strategic Plans page will not appear.

### Example 2: DepartmentReviewer Sees Only Their Department's Data

Maria is a DepartmentReviewer in the Finance department (`departmentId: "dept-finance"`).

She opens the Risk Register. The API is called:
```typescript
export const GET = withAuth(
  async (req, context, session) => {
    const tenantFilter = getTenantFilter(session);
    const scopeFilter = getDataScopeFilter(session, 'risk.register', 'view');
    // For DepartmentReviewer with scope 'own': { ownerId: session.id }
    const risks = await prisma.risk.findMany({
      where: { ...tenantFilter, ...scopeFilter },
    });
    return NextResponse.json(risks);
  },
  { resource: 'risk.register', action: 'view' }
);
```

Maria only sees risks where her user ID is the `ownerId`. Risks owned by other
users are invisible to her, even in the same department.

### Example 3: GRCAdministrator Sees All Tenant Data (With Caveat)

When `getTenantFilter(session)` is called without `globalAccess: true`:
```typescript
if (session.roles.includes('GRCAdministrator')) {
  if (session.customerAccountId) {
    return { customerAccountId: session.customerAccountId };
  }
  return {};
}
```

GRCAdministrators are typically assigned to a specific customer account for
administrative purposes. The filter returns their own tenant ID (not an empty
filter). Only when `globalAccess: true` is explicitly passed (e.g., the customer
accounts management page) do they see all tenants.

### Example 4: AuditHead Creates a Strategic Plan

When Alice (AuditHead) tries to create a Strategic Plan:

1. Alice clicks "New Strategic Plan".
2. The form submits to `POST /api/internal-audit/strategic-plans`.
3. The API route is protected with `withAuth(..., { resource: 'audit.strategic-plan', action: 'create' })`.
4. `hasPermission(session.permissions, 'audit.strategic-plan', 'create')` is called.
5. Alice's permissions include `{ resource: 'audit.strategic-plan', action: 'create', scope: 'all' }`.
6. The check passes. The plan is created.

When Bob (AuditManager) tries the same:
4. `hasPermission(session.permissions, 'audit.strategic-plan', 'create')` is called.
5. Bob's permissions only include `{ resource: 'audit.strategic-plan', action: 'view', scope: 'all' }`.
   There is no `create` permission.
6. The check fails. HTTP 403 is returned.
7. Bob never sees the "New Strategic Plan" button because `PermissionGate` hides it.

---

## 9. Troubleshooting Permission Denied Errors

### HTTP 403 from an API Route

**Symptom**: An API call returns `{ "error": "Permission denied" }` with status 403.

**Diagnosis**:
1. Check which resource and action the route requires:
   ```typescript
   // In the API file, look for:
   export const POST = withAuth(handler, { resource: '...', action: 'create' });
   ```
2. Check the current user's roles and permissions:
   - Open browser DevTools → Application → Cookies → find `authjs.session-token`.
   - The JWT payload (base64-decode the middle section) contains `roles` and `permissions`.
3. Check the permission matrix in `src/lib/permissions.ts` to confirm the role
   has the required resource+action.
4. Check if a module flag is filtering out the resource:
   - If the resource starts with `tprm.` and `isTprmAdded: false`, the permission
     will not appear even if the role definition includes it.

### User Can Log In but Sees No Pages

**Symptom**: User logs in successfully but the dashboard is blank or shows nothing.

**Likely cause**: The user's `customerAccountId` is null or their role has no
permissions after module flag filtering.

**Check**:
1. Verify the user has a `customerAccountId` set (Organization > Users > edit user).
2. Verify the customer account has the correct modules enabled.
3. Verify the user has at least one role assigned (Organization > Users > Roles).

### Permission Gate Hides a Button That Should Be Visible

**Symptom**: A developer expects a button to be visible but it is hidden.

**Debug approach**:
```typescript
// Add temporarily to the component:
const { canCreate, canEdit, canDelete, scope } = usePermissions('resource.name');
console.log({ canCreate, canEdit, canDelete, scope });
```

Also check:
```typescript
const { data: session } = useSession();
console.log(session?.user?.roles, session?.user?.permissions);
```

The `permissions` array on the session object is the expanded flat list. Search
for the specific resource in this array to confirm whether the permission exists.

---

## 10. Building a New Feature with Proper Permissions

When adding a new feature to the GRC application, follow this checklist:

### Step 1: Define the Resource

Add the new resource to the `RESOURCES` map in `src/lib/permissions.ts`:
```typescript
'mymodule.myfeature': '/mymodule/my-feature',
```

### Step 2: Add to Role Permission Matrix

Decide which roles should have access and at what scope. Add entries to
`ROLE_PERMISSIONS`:
```typescript
CustomerAdministrator: [
  // ... existing permissions ...
  { resource: 'mymodule.myfeature', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
],
DepartmentContributor: [
  // ... existing permissions ...
  { resource: 'mymodule.myfeature', actions: ['view', 'create', 'edit'], scope: 'department' },
],
```

### Step 3: Protect the API Routes

```typescript
// src/app/api/mymodule/my-feature/route.ts
export const GET    = withAuth(handler, { resource: 'mymodule.myfeature', action: 'view' });
export const POST   = withAuth(handler, { resource: 'mymodule.myfeature', action: 'create' });
export const PATCH  = withAuth(handler, { resource: 'mymodule.myfeature', action: 'edit' });
export const DELETE = withAuth(handler, { resource: 'mymodule.myfeature', action: 'delete' });
```

### Step 4: Apply Tenant and Scope Filtering

```typescript
export const GET = withAuth(async (req, context, session) => {
  const tenantFilter = getTenantFilter(session);
  const scopeFilter = getDataScopeFilter(session, 'mymodule.myfeature', 'view');
  const items = await prisma.myModel.findMany({
    where: { ...tenantFilter, ...scopeFilter },
  });
  return NextResponse.json(items);
}, { resource: 'mymodule.myfeature', action: 'view' });
```

### Step 5: Gate UI Elements

```tsx
// In the page component:
const { canCreate, canEdit, canDelete } = usePermissions('mymodule.myfeature');

<PermissionGate resource="mymodule.myfeature" action="create">
  <Button>{t("Add New")}</Button>
</PermissionGate>
```

### Step 6: Add to Navigation

```typescript
// In src/lib/navigation.ts:
{
  title: 'My Feature',
  href: '/mymodule/my-feature',
  permission: 'mymodule.myfeature:view',
}
```

### Step 7: Verify

Test with accounts having different roles to confirm:
- CustomerAdministrator can see all items.
- DepartmentContributor sees only their department's items.
- Roles without the permission do not see the page in navigation.
- The page returns 403 if accessed directly via URL by an unauthorized role.

---

## 11. The Audit Trail and RBAC

Every mutation (create, update, delete, approve) performed through a `withAuth`-
wrapped API route is automatically logged to the Audit Trail table:

```
AuditTrail {
  customerAccountId,
  userId,
  userName,
  userRole,      ← Comma-separated list of user's roles
  action,        ← "Create", "Update", "Delete", "Approve"
  module,        ← Derived from resource prefix (e.g., "Compliance")
  recordId,      ← ID of the affected record (from route params)
  ipAddress,
  createdAt,
}
```

This auto-capture is handled by `autoRecordMutation()` in `api-auth.ts`, which
fires asynchronously after every successful mutation response (2xx HTTP status,
non-view action).

**Access to the Audit Trail**:
- `CustomerAdministrator`: `scope: all` — sees all users' activity in the org.
- `AuditHead`, `AuditManager`, `Auditor`, `Auditee`, `AuditUser`: `scope: own` —
  sees only their own activity.
- All other roles: no `audit.audit-trail` permission (cannot access the page).

The combination of RBAC enforcement and audit trail logging means that not only
is access controlled — it is also recorded. If a question arises about who
approved a risk response or who deleted a compliance control, the audit trail
provides a timestamped answer with the responsible user's name and role.

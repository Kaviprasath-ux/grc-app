# Reviewer Role Changes Documentation

## Overview
These changes make the **Reviewer role a mirror image of DepartmentReviewer** for Organization and Risk Management modules, but **without department filtering** (scope: 'all' instead of 'department').

## How to Apply These Changes
```bash
# Apply the patch file
git apply reviewer-role-changes.patch

# Or manually make the changes described below
```

---

## File Changes

### 1. `src/lib/permissions.ts`

**Location:** Lines 263-294 (Reviewer section)

**Changes:**
- Updated comment to clarify Reviewer mirrors DepartmentReviewer
- Added `organization.users` with view action
- Added `organization.department` with view action
- Changed `organization.process` from `['view']` to `['view', 'approve']`
- Changed `risk.register` from `['view']` to `['view', 'create', 'edit', 'delete']`
- Changed `risk.assessment` from `['view']` to `['view', 'create', 'edit', 'delete']`
- Changed `risk.response` from `['view', 'approve']` to `['view', 'create', 'approve']`
- Changed `risk.risk-matrix` from `['view']` to `['view', 'create', 'edit', 'delete']`

**Before:**
```typescript
Reviewer: [
  { resource: 'organization.dashboard', actions: ['view'], scope: 'all' },
  { resource: 'organization.context', actions: ['view'], scope: 'all' },
  { resource: 'organization.process', actions: ['view'], scope: 'all' },
  // ... compliance unchanged ...
  { resource: 'risk.dashboard', actions: ['view'], scope: 'all' },
  { resource: 'risk.register', actions: ['view'], scope: 'all' },
  { resource: 'risk.assessment', actions: ['view'], scope: 'all' },
  { resource: 'risk.response', actions: ['view', 'approve'], scope: 'all' },
  { resource: 'risk.risk-matrix', actions: ['view'], scope: 'all' },
  { resource: 'risk.reports', actions: ['view'], scope: 'all' },
],
```

**After:**
```typescript
Reviewer: [
  { resource: 'organization.dashboard', actions: ['view'], scope: 'all' },
  { resource: 'organization.context', actions: ['view'], scope: 'all' },
  { resource: 'organization.users', actions: ['view'], scope: 'all' },
  { resource: 'organization.department', actions: ['view'], scope: 'all' },
  { resource: 'organization.process', actions: ['view', 'approve'], scope: 'all' },
  // ... compliance unchanged ...
  { resource: 'risk.dashboard', actions: ['view'], scope: 'all' },
  { resource: 'risk.register', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
  { resource: 'risk.assessment', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
  { resource: 'risk.response', actions: ['view', 'create', 'approve'], scope: 'all' },
  { resource: 'risk.risk-matrix', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
  { resource: 'risk.reports', actions: ['view'], scope: 'all' },
],
```

---

### 2. `src/app/(protected)/organization/context/page.tsx`

**Change 1 - Line ~173:** Add Reviewer to `isReadOnlyRole`

```typescript
// Before:
const isReadOnlyRole = userRoles.some(
  (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
);

// After:
const isReadOnlyRole = userRoles.some(
  (role) => role === "Reviewer" || role === "DepartmentReviewer" || role === "DepartmentContributor"
);
```

**Change 2 - Line ~1171:** Remove Reviewer from `isReviewerRole` (CustomerAdmin only reviews actions)

```typescript
// Before:
const isReviewerRole = userRoles.some(
  (role) => role === "CustomerAdministrator" || role === "Reviewer"
);

// After:
// Note: Reviewer mirrors DepartmentReviewer, so they CREATE actions, not review them
const isReviewerRole = userRoles.some(
  (role) => role === "CustomerAdministrator"
);
```

---

### 3. `src/app/(protected)/organization/process/page.tsx`

**Change - Line ~115:** Add `isReviewerType` variable and use it

```typescript
// Add after isDepartmentContributor:
const isReviewerType = userRoles.some((role) => role === "Reviewer" || role === "DepartmentReviewer");

// Change line ~342 from:
if (isDepartmentReviewer) {

// To:
if (isReviewerType) {
```

---

### 4. `src/app/(protected)/organization/process/bia/[processId]/page.tsx`

**Change 1 - Line ~123:** Add `isReviewerType` variable

```typescript
const isReviewerType = userRoles.some((role) => role === "Reviewer" || role === "DepartmentReviewer");
```

**Change 2 - Line ~550-560:** Replace `isDepartmentReviewer` with `isReviewerType`

```typescript
// Before:
const isEditable = isDepartmentReviewer
  ? status === "Pending Approval"
  : status === "Open" || status === "Sent Back";
const showApproveButtons = isDepartmentReviewer && status === "Pending Approval";
const showSubmitButton = !isDepartmentReviewer && (status === "Open" || status === "Sent Back");

// After:
const isEditable = isReviewerType
  ? status === "Pending Approval"
  : status === "Open" || status === "Sent Back";
const showApproveButtons = isReviewerType && status === "Pending Approval";
const showSubmitButton = !isReviewerType && (status === "Open" || status === "Sent Back");
```

**Change 3 - Line ~613:** Replace `isDepartmentReviewer` with `isReviewerType` for Approver dropdown

```typescript
// Before:
disabled={!isEditable || isDepartmentReviewer}

// After:
disabled={!isEditable || isReviewerType}
```

---

### 5. `src/app/(protected)/risks/response/page.tsx`

**Change 1 - Line ~98-106:** Replace `isDepartmentReviewer` with `isReviewerType`

```typescript
// Remove:
const isDepartmentReviewer = userRoles.includes("DepartmentReviewer");

// Add:
const isReviewerType = userRoles.some(
  (role) => role === "Reviewer" || role === "DepartmentReviewer"
);
```

**Change 2 - Line ~112:** Update default progressFilter

```typescript
// Before:
const [progressFilter, setProgressFilter] = useState(isDepartmentReviewer ? "Awaiting Approval" : "Completed");

// After:
const [progressFilter, setProgressFilter] = useState(isReviewerType ? "Awaiting Approval" : "Completed");
```

**Change 3 - Line ~362-368:** Update reviewer filter logic

```typescript
// Before:
const reviewerFilteredRisks = isDepartmentReviewer
  ? departmentFilteredRisks.filter(...)
  : departmentFilteredRisks;

// After:
const reviewerFilteredRisks = isReviewerType
  ? departmentFilteredRisks.filter(...)
  : departmentFilteredRisks;
```

**Change 4 - Line ~415:** Update clearProgressFilter

```typescript
// Before:
const clearProgressFilter = () => setProgressFilter(isDepartmentReviewer ? "Awaiting Approval" : "Completed");

// After:
const clearProgressFilter = () => setProgressFilter(isReviewerType ? "Awaiting Approval" : "Completed");
```

**Change 5 - Line ~480-482:** Update dropdown options visibility

```typescript
// Before:
{!isDepartmentReviewer && <SelectItem value="Open">Open</SelectItem>}
{!isDepartmentReviewer && <SelectItem value="In-Progress">In-Progress</SelectItem>}

// After:
{!isReviewerType && <SelectItem value="Open">Open</SelectItem>}
{!isReviewerType && <SelectItem value="In-Progress">In-Progress</SelectItem>}
```

---

## Key Patterns

### `isDepartmentRole`
- Includes: `DepartmentReviewer`, `DepartmentContributor`
- Purpose: Department-based data filtering
- **Reviewer is NOT included** (sees all data)

### `isReviewerType`
- Includes: `Reviewer`, `DepartmentReviewer`
- Purpose: Same UI behavior (buttons, status filters, etc.)
- **Both roles have identical UI/UX**

---

## Testing Checklist

After applying changes, test the following for Reviewer role:

### Organization Module
- [ ] Can view Organization Dashboard
- [ ] Can view Context page (Issues & Stakeholders) - read-only
- [ ] Can view Users page
- [ ] Can view Process page
- [ ] Can view and approve BIAs (when status is "Pending Approval")
- [ ] Cannot access Profile or Settings pages

### Risk Management Module
- [ ] Can view Risk Dashboard
- [ ] Can view, create, edit, delete risks in Risk Register
- [ ] Can view, create, edit, delete risk assessments
- [ ] Can view Risk Response page with status filter (Awaiting Approval, Sent Back, Completed only)
- [ ] Can approve risk responses
- [ ] Can view Risk Control Matrix
- [ ] Cannot access Risk Settings page

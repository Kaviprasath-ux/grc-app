# Internal Audit — Change Log
**Branch:** GRC-MultiTenant  
**Date:** 2026-06-16  
**Commit:** `4b8c11f1`

---

## 1. Risk Register — Scrollable Controls Section

### What changed
`src/app/(protected)/internal-audit/risk-register/page.tsx`

### Problem
When multiple controls were added inside the **Add Risk** or **Edit Risk** modal, the Controls section would grow infinitely, pushing the rest of the form off-screen.

### Fix
Wrapped the controls list in a scrollable container (`max-h-72 overflow-y-auto`) in **both** the Add and Edit modals. When more than ~2 controls are added, a vertical scrollbar appears automatically.

> The **Linked Processes** section already had `max-h-40 overflow-y-auto` applied — no change needed there.

---

## 2. Internal Audit Process — Process Owner Field (New Feature)

### Files changed
| File | Change |
|---|---|
| `prisma/schema.prisma` | Added `processOwner String?` field to `InternalAuditProcess` model |
| `prisma/schema.sql` | Regenerated to reflect schema change |
| `src/app/api/internal-audit/processes/route.ts` | POST handler accepts and saves `processOwner` |
| `src/app/api/internal-audit/processes/[id]/route.ts` | PATCH handler accepts and updates `processOwner` |
| `src/app/api/internal-audit/users/route.ts` | Added `?role=AuditHead` filter support |
| `src/app/(protected)/internal-audit/organization/process/page.tsx` | UI changes (see below) |

---

### Database
A new optional column `processOwner` (stores the AuditHead user's ID as a string) was added to the `InternalAuditProcess` table. Applied via `prisma db push`.

---

### API

#### GET `/api/internal-audit/users?role=AuditHead`
New query parameter support. Returns only users assigned the **AuditHead** role within the tenant. Combines with the existing `?departmentId=xxx` filter if provided.

#### POST `/api/internal-audit/processes`
Now accepts `processOwner` in the request body and persists it.

#### PATCH `/api/internal-audit/processes/:id`
Now accepts `processOwner` in the request body and updates it.

---

### UI — Add / Edit Process Modal

#### Process Owner Dropdown
- **Type:** Select dropdown (not a free-text field)
- **Options:** Only users with the **AuditHead** role
- **Filtering:** Options are filtered by the selected **Department** — only AuditHead users who belong to the selected department appear
- **Dependency rule:** The Process Owner dropdown is **disabled** until a Department is selected
  - Placeholder reads: *"Select a department first"*
  - Helper text below: *"Please select a department to view available process owners."*
- **Auto-clear:** If the Department is changed, the Process Owner selection is cleared automatically (unless the selected owner also belongs to the new department)
- **Empty state:** If a department is selected but no AuditHead users belong to it, an amber warning is shown: *"No audit heads are assigned to the selected department."*
- **Dropdown label:** Shows "Select" instead of "None" as the clear/reset option

#### Process Table
A new **Process Owner** column was added to the process list table, displaying the resolved AuditHead user's full name.

---

### Behaviour Summary

| State | Process Owner Dropdown |
|---|---|
| No department selected | Disabled — shows *"Select a department first"* |
| Department selected, AuditHeads exist | Enabled — shows filtered AuditHead users |
| Department selected, no AuditHeads | Disabled appearance — amber warning shown |
| Department changed | Previously selected owner is cleared |

---

## 3. Dropdown Label — "Select" Instead of "None"

Both the **Department** and **Process Owner** dropdowns in the Add / Edit Process modal now show **"Select"** (instead of "None") as the label for the clear/reset option at the top of the dropdown list.

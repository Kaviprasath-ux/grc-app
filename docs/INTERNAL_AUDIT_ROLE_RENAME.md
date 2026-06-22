# Internal Audit — "Auditee" Role Rename (Display-Only)

**Date:** 2026-06-22
**Scope:** Internal Audit module only
**Type:** User-facing label change — **NOT** a database/permission rename

---

## 1. What changed (summary)

In the Internal Audit module the role formerly shown as **"Auditee"** is now
presented to users as **"Auditor"**, and the legacy **"Auditor"** role is
**retired / hidden** from all role pickers.

Because the word "Auditor" was already used in the UI and in generated documents
for the person *conducting* the audit (`assignedAuditor`), that conducting role
was relabeled to **"Audit Manager"** to avoid two different things both reading
as "Auditor".

| Concept | Internal key (unchanged) | Old label | New label |
|---|---|---|---|
| The department contact being audited | `Auditee` | "Auditee" | **"Auditor"** |
| The person conducting the audit (`assignedAuditor`) | _(field, not a role)_ | "Auditor" / "Assigned Auditor" | **"Audit Manager"** |
| Legacy auditor role | `Auditor` | "Auditor" | **Hidden / retired** |

---

## 2. Why it was done this way (display-only, no DB rename)

The internal role key `Auditee` is referenced in **80+ places**: the permission
matrix, every `withAuth` check, session expansion, API query params
(`?role=Auditee`), `useHasRole("Auditee")`, the `Auditee` row in the DB `Role`
table, and existing user assignments.

A literal key rename would also **collide** with the existing `Auditor` key.

So we changed **only the presentation layer**. The key stays `Auditee`
everywhere; nothing about permissions, routing, data isolation, or existing
assignments changes. This is the lowest-risk approach and is reversible by
removing one map entry.

---

## 3. The mechanism

Central helper in **`src/lib/permissions.ts`**:

```ts
export const ROLE_DISPLAY_OVERRIDES: Record<string, string> = {
  Auditee: 'Auditor',
};

export function getRoleDisplayName(role: string | null | undefined): string {
  if (!role) return '';
  return ROLE_DISPLAY_OVERRIDES[role] ?? role;
}
```

`getRoleDisplayName()` returns an **English phrase** that callers still pass
through `t()` for i18n, e.g. `t(getRoleDisplayName(user.role))`.

---

## 4. Where the change is applied

### 4.1 Role-identity surfaces (use `getRoleDisplayName`)
- `src/app/(protected)/organization/users/page.tsx` — create/edit dropdowns,
  role filter, role table column, view dialog. Legacy `Auditor` removed from
  `rolesByFunction.Audit` and `allUserRoles`.
- `src/components/shared/AssignRoleDialog.tsx` — role picker label +
  `INTERNAL_AUDIT_HIDDEN_ROLES = { "Auditor" }` so the legacy role is not
  assignable.
- `src/components/layout/header.tsx` — logged-in user's role badge.
- `src/components/organization/org-chart.tsx` — node role fallback label.

### 4.2 Workflow labels (hardcoded `t("…")` strings, edited at source)
All `t("Auditee…")` → `t("Auditor…")` across:
- `internal-audit/fieldwork/[id]/page.tsx`, `fieldwork/add/page.tsx`,
  `fieldwork/FieldworkDetailModal.tsx`
- `internal-audit/audit-engagement/page.tsx`, `add`, `[id]/edit`
- `internal-audit/report/page.tsx`, `report/[id]/page.tsx`
- `internal-audit/capa-tracking/page.tsx`
- `components/internal-audit/FindingsCommunication.tsx`, `AuditAnnouncement.tsx`

### 4.3 Conducting auditor → "Audit Manager" (collision fix)
`t("Auditor")` / `t("Assigned Auditor")` / `t("Select Auditor")` /
`t("Assign Auditors")` that referred to `assignedAuditor` were changed to the
"Audit Manager" variants in:
- `internal-audit/audit-engagement/*`, `dashboard/page.tsx`,
  `operational-plan/[id]/page.tsx`, `fieldwork/*`, `follow-up/page.tsx`,
  `report/*`

### 4.4 Generated documents (PDF)
- `api/internal-audit/report/[id]/download/route.ts`
- `api/internal-audit/engagements/[id]/download/route.ts`
- `api/internal-audit/fieldwork/[id]/ai-workpapers/download/route.ts`

In each: `'Auditee:'` → `'Auditor:'`, and `'Assigned Auditor:'` → `'Audit Manager:'`.

---

## 5. What was deliberately NOT changed (do not "fix" these)

These are internal identifiers / logic, not user-facing labels. Renaming them
**would break the app**:

- DB `Role` key `Auditee` and all existing user assignments
- Permission matrix entry, `withAuth` resource checks, session role expansion
- `useHasRole("Auditee")`, `session.roles.includes('Auditee')`
- API query params: `fetch("…/users?role=Auditee")`
- Schema fields/relations: `auditeeId`, `auditee`, `sharedWithAuditeeAt`,
  `isAuditeeSubmission`, `resolveAuditeeName`, variables like `isAuditee`
- `src/data/help-knowledge-base.ts` chatbot content (separate effort if desired)

**Existing users** who still hold the legacy `Auditor` role keep their access;
the role is simply no longer offered for new assignments. Opening such a user's
edit form shows a blank role (the option is gone) — expected for a retired role.

---

## 6. i18n

The translation source of truth is **`i18n/translations.xlsx`** (read by
`npm run i18n:generate`, which regenerates `locales/{en,ar,lv}.json` on every
build). Editing the JSON alone is **reverted on next build**.

New phrases were added to BOTH `scripts/init-translations.ts` and the xlsx:
- 13 `Auditor*` phrases (e.g. "Auditor Comment", "Assign to Auditor",
  "Internal Notes (Not visible to Auditor)", "Share with auditor", …)
- 4 `Audit Manager*` phrases ("Select Audit Manager", "Assigned Audit Manager",
  "Assigned Audit Managers", "Assign Audit Managers")

To add more later: edit the xlsx (or `init-translations.ts` + `npm run i18n:init`),
then run `npm run i18n:generate` and confirm "Validation passed".

---

## 7. How to reverse / extend

- **Reverse the whole rename:** remove the `Auditee: 'Auditor'` entry from
  `ROLE_DISPLAY_OVERRIDES`, un-hide `Auditor` in `AssignRoleDialog` and the
  Users page lists, and revert the `t("Auditor…")` / `t("Audit Manager…")`
  source strings. Keys never changed, so no data migration is involved.
- **Rename another role's label:** add one entry to `ROLE_DISPLAY_OVERRIDES`.
  That covers every place that already calls `getRoleDisplayName()`. Hardcoded
  `t("RoleName")` strings still need manual editing.

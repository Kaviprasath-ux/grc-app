# TPRM Account Overview — Edit Dialog Implementation Context

## Summary

The **Edit Account dialog** on the TPRM Account Overview page (`/tprm/account-overview`) was rebuilt to match the **Create Account dialog** layout. Previously it was a simple form with only Full Name, Email, Language, Time Zone, and two checkboxes. Now it mirrors all sections of the Create dialog.

---

## Files Modified

### 1. `src/app/(protected)/tprm/account-overview/page.tsx`

**What changed:**
- Removed old `EditUserDialog` component (simple form with 6 fields)
- Added new `EditAccountDialog` component (~300 lines) matching `CreateAccountDialog` layout
- Updated all 4 tab components to use `EditAccountDialog` with proper `tab` and `showIsGrcAdded` props
- Removed `editInitial` state from all tabs (no longer needed — dialog fetches its own data)

**Component: `EditAccountDialog`** (line ~703)
- Props: `open`, `onOpenChange`, `userId`, `tab` ("customers"|"factory"|"superadmin"|"vendor-users"), `showIsGrcAdded`, `onSuccess`
- On open, fetches full user details via `GET /api/tprm/account-overview?tab=user-detail&userId=xxx`
- Shows loading spinner while fetching
- Sections match CreateAccountDialog:
  1. **Account Information**: User Role (disabled), Customer Name*, Full Name*, Username (disabled), Email*
  2. **Settings**: Language, Time Zone, Blocked (radio), Active (radio), Is Local User (radio), Is GRC Added (radio — only if `showIsGrcAdded`)
  3. **Password**: Optional — "Leave blank to keep current password" hint, New Password, Confirm Password
  4. **Subscription Plans**: Shows existing + pending plans table, delete button per plan, "Subscription Plan" button in footer opens sub-dialog to add new plans (only for customers/factory tabs)
- Save calls `PATCH /api/tprm/account-overview` with all fields

**Tab-specific usage:**

| Tab | Component | `tab` prop | `showIsGrcAdded` | Notes |
|-----|-----------|-----------|-----------------|-------|
| Customer Accounts | `CustomerAccountsTab` | `"customers"` | `true` | Uses `row.original.userId` for edit |
| Vendor Accounts | `VendorAccountsTab` | `"vendor-users"` | `false` | Uses `row.original.id` (user ID directly) |
| Assessment Factory | `AssessmentFactoryTab` | `"factory"` | `false` | Uses `row.original.userId` for edit |
| Super Admin | `SuperAdminTab` | `"superadmin"` | `false` | Uses `row.original.id` (user ID directly) |

### 2. `src/app/api/tprm/account-overview/route.ts`

**New: `user-detail` tab in GET handler** (~line 365)
- Query: `GET /api/tprm/account-overview?tab=user-detail&userId=xxx`
- Returns:
  ```json
  {
    "user": {
      "id", "fullName", "userName", "email",
      "language", "timeZone", "blocked", "active", "role"
    },
    "customerAccount": {
      "id", "name", "isGrcAdded"
    } | null,
    "subscriptionPlans": [
      {
        "id", "startDate", "expiryDate",
        "maxFrameworks", "maxAccounts",
        "assessmentLimit", "vendorLimit", "status"
      }
    ]
  }
  ```
- Fetches `isGrcAdded` via raw SQL (Prisma client may not have the column yet)
- Fetches `assessmentLimit`/`vendorLimit` per subscription plan via raw SQL

**Updated: PATCH handler** (~line 640)
- Now accepts additional fields beyond the original `userId, fullName, email, language, timeZone, blocked, active`:
  - `customerName` — updates `CustomerAccount.name`
  - `isGrcAdded` — updates via raw SQL `UPDATE "CustomerAccount" SET "isGrcAdded" = $1`
  - `password` — hashes with bcrypt and updates `User.password`
  - `deleteSubscriptionPlanIds` — array of plan IDs to delete
  - `addSubscriptionPlans` — array of new plans to create (same format as POST)
- Wrapped in `prisma.$transaction` for atomicity
- Subscription plan creation uses raw SQL for `assessmentLimit`/`vendorLimit` (same as POST handler)

---

## Database Notes

### Raw SQL Workarounds
The following fields are managed via `prisma.$queryRawUnsafe` / `$executeRawUnsafe` because they may not be in the generated Prisma client yet:

| Table | Field | Reason |
|-------|-------|--------|
| `CustomerAccount` | `isGrcAdded` | Added to schema but Prisma client not regenerated with server stopped |
| `CustomerAccount` | `isTprmAdded` | Same |
| `SubscriptionPlan` | `assessmentLimit` | Same |
| `SubscriptionPlan` | `vendorLimit` | Same |

To fix: stop dev server, run `npx prisma generate`, restart. Then raw SQL can be replaced with typed Prisma queries.

### Schema Models Involved
- `User` — fullName, userName, email, password, language, timezone, isBlocked, isActive, role, customerAccountId
- `CustomerAccount` — name, isActive, isGrcAdded (raw), isTprmAdded (raw)
- `SubscriptionPlan` — customerAccountId, startDate, expiryDate, maxFrameworksAllowed, maxAccountsAllowed, status, assessmentLimit (raw), vendorLimit (raw)

---

## UI/UX Details

### Edit vs Create Differences
| Feature | Create | Edit |
|---------|--------|------|
| Username field | Editable (required) | Disabled (read-only) |
| Password fields | Required | Optional ("Leave blank to keep current") |
| Subscription plans | Only pending (new) plans | Shows existing plans from DB + pending new plans |
| Data source | Empty form | Fetches from `user-detail` API on open |
| Title | Tab-specific (e.g., "Create New TPRM Customer Account") | Generic "Edit Account" |

### Radio Button Name Conflicts
Edit dialog uses `edit-` prefix for radio button names (e.g., `edit-blocked-customers`, `edit-active-customers`) to avoid conflicts with Create dialog radio buttons which use plain names (e.g., `blocked-customers`).

---

## Existing Constants (shared between Create and Edit)

```typescript
const LANGUAGES = [
  { value: "en-US", label: "English, United States" },
  { value: "ar-QA", label: "Arabic, Qatar" },
];

const TIME_ZONES = [
  { value: "UTC", label: "UTC" },
  { value: "Asia/Qatar", label: "Asia/Qatar" },
  // ... 15 more entries
];

const ROLE_LABELS: Record<string, string> = {
  customers: "TPRMCustomerAdmin",
  factory: "FactoryAdmin",
  superadmin: "TPRMAdmin",
};
```

---

## Testing Status

- **Customer Accounts tab**: Edit button opens dialog, pre-populates all fields including subscription plans — **verified working**
- **Vendor Accounts tab**: Edit button wired up — **code complete, not browser-tested this session**
- **Assessment Factory tab**: Edit button wired up — **code complete, not browser-tested this session**
- **Super Admin tab**: Edit button wired up — **code complete, not browser-tested this session**
- **Save functionality**: PATCH API updated to handle all new fields — **code complete, not browser-tested with new dialog**
- **TypeScript**: `npx tsc --noEmit` passes with zero errors

---

## Known Issues / TODO

1. **Missing i18n translations**: Many new strings (e.g., "Account Information", "Customer Name", "Leave blank to keep current password", "Subscription Plan", etc.) show translation warnings. Need to add to `i18n/translations.xlsx` and run `npm run i18n:generate`.
2. **Delete button (Trash2) on Super Admin tab**: Still has no `onClick` handler — placeholder only.
3. **Raw SQL workarounds**: Should be converted to typed Prisma queries after regenerating the client.
4. **Vendor Accounts tab**: The `editVendorId` state variable exists but isn't used by `EditAccountDialog` — can be removed if not needed elsewhere.

---

## Branch & Git Status

- **Branch**: `GRC-MultiTenant`
- **Uncommitted changes**: Both files above have unstaged modifications
- **No commits made this session** — user has not requested a commit

---

## How to Continue

1. To test remaining tabs, navigate to `http://localhost:3000/tprm/account-overview`, switch to each tab, and click edit buttons
2. To test save: modify a field in the edit dialog, click Save, verify the table refreshes with updated data
3. To add translations: edit `i18n/translations.xlsx`, add the missing phrases, run `npm run i18n:generate`
4. To fix raw SQL: stop dev server → `npx prisma generate` → restart → replace `$queryRawUnsafe`/`$executeRawUnsafe` calls with typed Prisma methods

# Database Seeding

**Document:** Database Seeding Reference  
**Application:** GRC (Governance, Risk, and Compliance) Platform  
**Last Updated:** 2026-06-29

---

## Table of Contents

1. [What Is Database Seeding?](#1-what-is-database-seeding)
2. [Why Seeding Is Needed](#2-why-seeding-is-needed)
3. [Main Seed File: `prisma/seed.ts`](#3-main-seed-file-prismaseeds)
4. [What Gets Seeded](#4-what-gets-seeded)
   - [4.1 SuperAdmin CustomerAccount](#41-superadmin-customeraccount)
   - [4.2 SubscriptionPlan (Superadmin)](#42-subscriptionplan-superadmin)
   - [4.3 22 RBAC System Roles](#43-22-rbac-system-roles)
   - [4.4 SuperAdmin User](#44-superadmin-user)
   - [4.5 Email Templates (73 templates)](#45-email-templates-73-templates)
   - [4.6 Subscription Catalog (Tier Pricing)](#46-subscription-catalog-tier-pricing)
5. [Additional Seed Files](#5-additional-seed-files)
6. [Running Seeds](#6-running-seeds)
7. [Seeding Production Neon Database](#7-seeding-production-neon-database)
8. [Full Database Reset and Reseed](#8-full-database-reset-and-reseed)
9. [Adding New Seed Data](#9-adding-new-seed-data)
10. [Idempotency — Why Seeds Must Be Safe to Run Twice](#10-idempotency--why-seeds-must-be-safe-to-run-twice)

---

## 1. What Is Database Seeding?

Consider a new smartphone. When you turn it on for the first time, it is not completely empty — it already has:
- An operating system.
- Default app icons.
- A Settings app with sensible defaults.
- A camera with default exposure settings.

The manufacturer has **pre-loaded** the device with everything it needs to be usable immediately. Without this, you could not even get to the screen where you create your user account.

**Database seeding** is the equivalent process for software: pre-loading the database with the initial data that the application needs to function before any real user has created anything.

---

## 2. Why Seeding Is Needed

The GRC application cannot work without certain data existing in the database. Specifically:

| Category | Why It Must Exist at Startup |
|----------|------------------------------|
| **Roles** | Without roles, no user can be assigned a role. A user with no role cannot log in or access any feature. |
| **Permissions** | Without permissions assigned to roles, the RBAC system would deny all access to all users. |
| **SuperAdmin Account** | The first user who creates customer accounts must have a user account to log in with. This bootstraps the system. |
| **Email Templates** | The email notification system requires templates to exist before events occur. Without templates, email sending fails. |
| **Subscription Catalog** | Without pricing tiers, the admin cannot set up subscriptions for customers. |

Seeding is the mechanism that populates all of this bootstrap data.

---

## 3. Main Seed File: `prisma/seed.ts`

The main seed file is `prisma/seed.ts`. It is the entry point called by `npm run db:seed`.

`package.json` registers it as the Prisma seed command:

```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

The seed file does the following operations in order:

```
1. Hash the superadmin password
2. Create/upsert the SUPERADMIN_001 CustomerAccount
3. Create/upsert the superadmin SubscriptionPlan
4. Create/upsert all 22 RBAC roles
5. Create/upsert the superadmin User (superadmin / 1)
6. Assign GRCAdministrator role to the superadmin User
7. Call seedEmailTemplates() → seeds 73 email templates
8. Call seedSubscriptionCatalog() → seeds tier pricing (9 rows) + bundle discount
```

---

## 4. What Gets Seeded

### 4.1 SuperAdmin CustomerAccount

The system's own tenant is created first. It acts as the container for the superadmin user and provides the foundation for platform administration:

```typescript
const superadminCustomerAccount = await prisma.customerAccount.upsert({
  where: { code: "SUPERADMIN_001" },
  update: {},  // no updates — idempotent: if it exists, leave it
  create: {
    id: "superadmin-account-1",   // stable, predictable ID
    code: "SUPERADMIN_001",
    name: "Super Admin Account",
    isActive: true,
    isGrcAdded: true,
    isTprmAdded: true,
  }
});
```

| Field | Value | Purpose |
|-------|-------|---------|
| `id` | `"superadmin-account-1"` | Stable hardcoded ID ensures no race conditions |
| `code` | `"SUPERADMIN_001"` | Human-readable identifier |
| `isGrcAdded` | `true` | Superadmin can access GRC module |
| `isTprmAdded` | `true` | Superadmin can access TPRM module |

---

### 4.2 SubscriptionPlan (Superadmin)

A legacy subscription plan record is created for the superadmin account with all limits set to 999 (effectively unlimited):

```typescript
await prisma.subscriptionPlan.upsert({
  where: { id: "subscription-plan-superadmin" },
  update: { expiryDate: new Date("2030-12-31"), status: "Active" },
  create: {
    id: "subscription-plan-superadmin",
    customerAccountId: superadminCustomerAccount.id,
    startDate: new Date(),
    expiryDate: new Date("2030-12-31"),
    maxFrameworksAllowed: 999,
    maxAccountsAllowed: 999,
    assessmentLimit: 999,
    vendorLimit: 999,
    frameworksUsed: 0,
    accountsUsed: 0,
    status: "Active",
  }
});
```

---

### 4.3 22 RBAC System Roles

All 22 system roles are created using a loop:

```typescript
const roleDefinitions = [
  // Core GRC roles
  { name: "GRCAdministrator",     description: "Full system access, all modules, all data",          isSystem: true },
  { name: "CustomerAdministrator", description: "Organization-level admin, manages users and settings", isSystem: true },
  { name: "AuditHead",            description: "Full access to Internal Audit module, all audit data",  isSystem: true },
  { name: "AuditManager",         description: "Manages audits, assigns auditors, reviews findings",    isSystem: true },
  { name: "Auditor",              description: "Conducts audits, creates findings",                    isSystem: true },
  { name: "Auditee",              description: "Receives audit requests, responds to findings",        isSystem: true },
  { name: "Reviewer",             description: "Reviews and approves compliance, risk, and asset",     isSystem: true },
  { name: "Contributor",          description: "Creates and edits content across modules",             isSystem: true },
  { name: "DepartmentReviewer",   description: "Reviews content within own department",               isSystem: true },
  { name: "DepartmentContributor",description: "Creates/edits content within own department",         isSystem: true },

  // TPRM roles
  { name: "TPRMCustomerAdmin",    description: "Customer-level TPRM administrator",                   isSystem: true },
  { name: "FactoryAdmin",         description: "Assessment Factory administrator",                    isSystem: true },
  { name: "TPRMAdmin",            description: "TPRM super administrator",                            isSystem: true },
  { name: "BusinessOwner",        description: "Business Owner role in TPRM",                        isSystem: true },
  { name: "RelationshipManager",  description: "Relationship Manager role in TPRM",                  isSystem: true },
  { name: "TPRMAssessor",         description: "Assessor role in TPRM",                              isSystem: true },
  { name: "TPRMApprover",         description: "Approver role in TPRM",                              isSystem: true },
  { name: "TPRMAuditor",          description: "Auditor role in TPRM",                               isSystem: true },

  // Support roles
  { name: "SupportAgentL1",       description: "Level 1 support agent",                             isSystem: true },
  { name: "SupportSpecialistL2",  description: "Level 2 functional/domain specialist",              isSystem: true },
  { name: "SupportEngineerL3",    description: "Level 3 engineering support",                       isSystem: true },
  { name: "SupportManager",       description: "Support manager — full ticket access",              isSystem: true },
];
```

Each role is created using `upsert` with the role `name` as the unique key, so re-running the seed does not create duplicate roles.

The **Permission** records and **RolePermission** assignments are NOT seeded in `seed.ts`. They are managed by `prisma/seed-rbac.ts`, which reads the permission matrix from `src/lib/permissions.ts` and seeds corresponding database records.

---

### 4.4 SuperAdmin User

```typescript
const superadminUser = await prisma.user.upsert({
  where: {
    customerAccountId_userId: {
      customerAccountId: superadminCustomerAccount.id,
      userId: "SUPERADMIN-001"
    }
  },
  update: { password: hashedPassword },
  create: {
    userId:           "SUPERADMIN-001",
    userName:         "superadmin",
    email:            "superadmin@baarez.com",
    password:         hashedPassword,   // bcrypt hash of "1"
    firstName:        "Super",
    lastName:         "Admin",
    fullName:         "Super Admin",
    designation:      "System Administrator",
    role:             "GRCAdministrator",
    function:         "Administration",
    isActive:         true,
    isBlocked:        false,
    customerAccountId: superadminCustomerAccount.id,
  }
});
```

**Login credentials:**
- Username: `superadmin`
- Password: `1`

**Security note:** The password `1` is intentionally trivial for development and demo purposes. In production, this user's password should be changed immediately after setup.

**Password hashing:** The password `"1"` is hashed using `bcrypt` with 10 salt rounds before being stored. The database never stores plaintext passwords.

---

### 4.5 Email Templates (73 templates)

The `seedEmailTemplates()` function in `prisma/seed-email-templates.ts` creates 73 HTML email templates. These templates are stored in the `EmailTemplate` model and used by `src/lib/email-service.ts` to send notifications.

**Template distribution by category:**

| Category | Count | Examples |
|----------|-------|---------|
| Internal Audit | 22 | Engagement created, Finding raised, CAPA due, Report shared |
| Governance & Policy | 8 | Policy uploaded, Policy approved, Policy review due |
| Evidence Management | 4 | Evidence uploaded, Evidence validated, Evidence due |
| Exception Management | 8 | Exception submitted, Exception approved, Exception expiring |
| Risk Management | 4 | Risk assigned, Risk assessment due, Risk status changed |
| Control Management | 3 | Control assigned, Control compliance changed |
| Issue/Finding Tracking | 7 | Issue created, Issue assigned, Issue closed |
| Planned Actions | 4 | Action created, Action overdue |
| KPI | 2 | KPI review due, KPI off track |
| User & System | 2 | New user created, Password reset |
| Reminders & Escalations | 6 | Due date reminders, overdue escalations |
| General Workflow | 3 | Generic approval, rejection, assignment |

Each template is a complete HTML email with:
- A consistent header and footer.
- Colour-coded status indicators (blue for info, green for success, yellow for warning, red for danger).
- A table of relevant data fields (e.g., risk name, due date, assigned to).
- An action button that links to the relevant page in the application.

Templates are seeded using `upsert` keyed on the `eventType` field, making the operation idempotent.

---

### 4.6 Subscription Catalog (Tier Pricing)

The `seedSubscriptionCatalog()` function in `prisma/seed-subscription-catalog.ts` seeds 9 pricing rows — 3 modules × 3 tiers — and one inactive bundle discount example:

| Module | Tier | Monthly (INR) | Yearly (INR) | User Limit |
|--------|------|--------------|--------------|------------|
| GRC | BASIC | ₹5,000 | ₹50,000 | 5 |
| GRC | MEDIUM | ₹10,000 | ₹1,00,000 | 15 |
| GRC | PRO | ₹20,000 | ₹2,00,000 | 50 |
| TPRM | BASIC | ₹5,000 | ₹50,000 | 5 (10 vendors) |
| TPRM | MEDIUM | ₹10,000 | ₹1,00,000 | 15 (50 vendors) |
| TPRM | PRO | ₹20,000 | ₹2,00,000 | 50 (250 vendors) |
| INTERNAL_AUDIT | BASIC | ₹5,000 | ₹50,000 | 5 (5 audits) |
| INTERNAL_AUDIT | MEDIUM | ₹10,000 | ₹1,00,000 | 15 (20 audits) |
| INTERNAL_AUDIT | PRO | ₹20,000 | ₹2,00,000 | 50 (unlimited audits) |

These prices can be adjusted by the GRCAdministrator via the subscription pricing management page.

---

## 5. Additional Seed Files

Beyond `seed.ts`, the project includes many specialised seed files in `prisma/`:

| File | Purpose | When to Run |
|------|---------|-------------|
| `seed-rbac.ts` | Seed role-permission assignments from the permissions matrix | After adding new permissions in `permissions.ts` |
| `seed-email-templates.ts` | Seeds all 73 email templates (called by `seed.ts`) | Auto-run by `npm run db:seed` |
| `seed-subscription-catalog.ts` | Seeds tier pricing catalog (called by `seed.ts`) | Auto-run by `npm run db:seed` |
| `seed-risk-settings.ts` | Seeds risk categories, types, likelihood/impact ratings | Customer account setup |
| `seed-bia-settings.ts` | Seeds BIA categories, scoring config, and rating ranges | Customer account setup |
| `seed-audit-settings.ts` | Seeds audit categories and audit types | Customer account setup |
| `seed-internal-audit.ts` | Seeds sample audit engagements, findings, CAPAs | Demo data only |
| `seed-tprm.ts` | Seeds TPRM configuration and master questions | TPRM module setup |
| `seed-scheduled-tasks.ts` | Seeds scheduled task configuration records | System configuration |
| `seed-customer-bts.ts` | Seeds BTS customer-specific demo data | Customer-specific setup |
| `seed-customer-faa.ts` | Seeds FAA customer-specific demo data | Customer-specific setup |
| `seed-ah-users.ts` | Seeds Audit Head users and their team | Demo user setup |
| `seed-evidence.ts` | Seeds sample evidence items | Demo data only |
| `seed-artifacts.ts` | Seeds sample compliance artifacts | Demo data only |
| `seed-requirements.ts` | Seeds framework requirements (ISO 27001, etc.) | Framework setup |
| `seed-qpost.ts` | Seeds QPost compliance module data | QPost module setup |
| `seed-monitoring.ts` | Seeds TPRM monitoring configuration | TPRM monitoring setup |

### Running Individual Seed Files

Any seed file can be run independently using `npx tsx`:

```bash
npx tsx prisma/seed-rbac.ts
npx tsx prisma/seed-risk-settings.ts
npx tsx prisma/seed-email-templates.ts
```

Most seed files accept an optional `customerAccountId` parameter or default to the `SUPERADMIN_001` account.

---

## 6. Running Seeds

### Primary Seed Command

Runs `prisma/seed.ts` — the main seed that creates roles, superadmin user, email templates, and subscription catalog:

```bash
npm run db:seed
```

This is equivalent to:

```bash
npx tsx prisma/seed.ts
```

### Customer-Specific Seed

For seeding customer-specific demo data (predefined in `seed-customer-bts.ts`):

```bash
npm run db:seed-bts
```

### Full Reset and Reseed

To completely wipe the local database and start fresh:

```bash
npm run db:reset
```

This runs `prisma migrate reset --force` which:
1. Drops all tables.
2. Recreates the schema from `schema.prisma`.
3. Runs `prisma/seed.ts` automatically.

---

## 7. Seeding Production Neon Database

The production Neon PostgreSQL database requires the same bootstrap data. Use these exact commands when setting up the Neon database for the first time, or after a full reset:

### Step 1: Reset Neon Schema (DESTROYS ALL DATA)

```bash
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  npx prisma db push --force-reset
```

**Warning:** `--force-reset` permanently deletes everything. Only run this when intentionally resetting.

### Step 2: Seed Main Data

```bash
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  npx tsx prisma/seed.ts
```

### Step 3: Seed RBAC Permissions (Optional)

If you also want to seed the permission matrix (Role → Permission assignments) into the database:

```bash
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  npx tsx prisma/seed-rbac.ts
```

### After Seeding

- Log in to `https://grc-app-ba-testing.vercel.app` with `superadmin` / `1`.
- Create a new customer account via the GRC Admin panel.
- Add users and configure the customer account.
- Run customer-specific seeds if needed.

---

## 8. Full Database Reset and Reseed

### Local Development Reset

```bash
# Wipe database + reseed (runs seed.ts automatically)
npm run db:reset

# Or manually:
npx prisma migrate reset --force
# This automatically runs seed.ts via the "prisma.seed" package.json entry
```

### Neon Cloud Reset

```bash
# Step 1: Wipe and recreate schema
DATABASE_URL="<neon_url>" npx prisma db push --force-reset

# Step 2: Seed baseline data
DATABASE_URL="<neon_url>" npx tsx prisma/seed.ts

# Step 3: (Optional) Seed RBAC
DATABASE_URL="<neon_url>" npx tsx prisma/seed-rbac.ts
```

Where `<neon_url>` is the full Neon connection string from the project's environment variables.

---

## 9. Adding New Seed Data

### When to Add to `seed.ts` vs a Separate File

| Scenario | Where to Add |
|----------|-------------|
| Data required on every fresh install | `prisma/seed.ts` |
| Module-specific configuration (risk categories, audit types) | New `seed-<module>.ts` file |
| Customer-specific demo data | New `seed-customer-<name>.ts` file |
| Framework content (requirements, controls) | New `seed-requirements.ts` or similar |

### Writing a New Seed Function

1. Create `prisma/seed-my-feature.ts`.
2. Use `upsert` (not `create`) for all records to ensure idempotency.
3. Target a specific customer account when the data is tenant-specific.
4. Export a main function that can be called independently or from `seed.ts`.
5. Add a `main()` wrapper for standalone execution.

**Template:**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedMyFeatureData(customerAccountId: string) {
  console.log(`🌱 Seeding my feature data for ${customerAccountId}...`);

  await prisma.myModel.upsert({
    where: {
      // Use a unique constraint as the upsert key
      customerAccountId_code: { customerAccountId, code: "MY-001" }
    },
    update: {},  // Don't overwrite on re-run
    create: {
      customerAccountId,
      code:        "MY-001",
      name:        "My First Record",
      description: "Created by seed",
      status:      "Active",
    }
  });

  console.log("✅ My feature data seeded");
}

// Standalone entry point
async function main() {
  const customerAccountId = process.env.CUSTOMER_ACCOUNT_ID || "superadmin-account-1";
  await seedMyFeatureData(customerAccountId);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

**Run it:**

```bash
npx tsx prisma/seed-my-feature.ts
# or with a specific customer:
CUSTOMER_ACCOUNT_ID="cust-acme-001" npx tsx prisma/seed-my-feature.ts
```

---

## 10. Idempotency — Why Seeds Must Be Safe to Run Twice

**Idempotency** (pronounced: eye-DEM-po-ten-see) means that performing an operation multiple times has the same result as performing it once.

**Why seeds must be idempotent:** Seeds may be run:
- On every developer machine during setup.
- During CI/CD pipeline tests.
- On the production database after a reset.
- Accidentally run a second time by mistake.

If a seed creates records without checking for duplicates, re-running it would either:
- Fail with a unique constraint violation error.
- Create duplicate records (two "AuditHead" roles, two superadmin users), breaking the application.

### How to Achieve Idempotency

**Use `upsert` instead of `create`:**

```typescript
// WRONG — fails on second run with "Unique constraint failed"
await prisma.role.create({
  data: { name: "AuditHead", isSystem: true }
});

// CORRECT — safe to run multiple times
await prisma.role.upsert({
  where: { name: "AuditHead" },   // the unique key to check
  update: {},                      // nothing to update if exists
  create: { name: "AuditHead", isSystem: true }
});
```

**Use `update: {}` when you don't want to overwrite:** Passing an empty `update: {}` means "if the record already exists, leave it unchanged." This is important for records like email templates — you don't want to overwrite a customised template on re-run.

**Use `update: { password: hashedPassword }` selectively:** For the superadmin user, the password hash is updated on re-run. This is intentional — it resets the password to `1` if it was changed.

**Check before creating for nullable unique constraints:**

```typescript
// For compound unique constraints involving nullable fields (Prisma can't upsert these)
const existing = await prisma.userRole.findFirst({
  where: { userId: superadminUser.id, roleId: createdRoles["GRCAdministrator"], moduleCode: null }
});
if (!existing) {
  await prisma.userRole.create({
    data: { userId: superadminUser.id, roleId: createdRoles["GRCAdministrator"], moduleCode: null }
  });
}
```

Prisma's `upsert` cannot handle `null` in a compound unique constraint, so the `findFirst` + conditional `create` pattern is used instead.

---

*For migration procedures, see [Migrations.md](Migrations.md). For schema details, see [Schema-Reference.md](Schema-Reference.md).*

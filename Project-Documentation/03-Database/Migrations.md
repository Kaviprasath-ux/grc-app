# Database Migrations

**Document:** Database Migration Procedures  
**Application:** GRC (Governance, Risk, and Compliance) Platform  
**Last Updated:** 2026-06-29

---

## Table of Contents

1. [What Is a Database Migration?](#1-what-is-a-database-migration)
2. [Prisma's Migration System](#2-prismas-migration-system)
3. [Development Workflow: `prisma db push`](#3-development-workflow-prisma-db-push)
4. [Production Workflow: `prisma migrate dev`](#4-production-workflow-prisma-migrate-dev)
5. [Why This Project Uses `db push`](#5-why-this-project-uses-db-push)
6. [How to Add a New Field to an Existing Model](#6-how-to-add-a-new-field-to-an-existing-model)
7. [How to Add a New Model](#7-how-to-add-a-new-model)
8. [Regenerating the SQL Schema File](#8-regenerating-the-sql-schema-file)
9. [Deploying Schema Changes to Production](#9-deploying-schema-changes-to-production)
10. [Rolling Back Changes](#10-rolling-back-changes)
11. [Common Migration Errors and Fixes](#11-common-migration-errors-and-fixes)

---

## 1. What Is a Database Migration?

Imagine you have a spreadsheet with columns: Name, Email, Status. Thousands of rows of data already exist. Now your team decides to add a new column: "Phone Number".

A **database migration** is the formal process of making schema changes (adding/removing columns, creating/dropping tables, changing data types) to a live database that already contains data — without losing any existing data.

Migrations answer a critical question: **How do we change the shape of the database in a controlled, repeatable, reversible way?**

### Why Migrations Are Necessary

Without migrations, making a schema change would require:
1. Stopping the application.
2. Manually writing SQL to alter the database.
3. Hoping no one else does the same thing from a different machine.
4. Having no record of what changed or why.

Migrations solve this by:
- **Recording** every schema change as a versioned file.
- **Tracking** which migrations have been applied to each database.
- **Applying** unapplied migrations in order when the application starts.
- **Providing a history** so you can see exactly how the schema evolved.

### Types of Schema Changes

| Change Type | Safe? | Notes |
|-------------|-------|-------|
| Add nullable column | Safe | Existing rows get `NULL` |
| Add column with default value | Safe | Existing rows get the default |
| Add a new table | Safe | No effect on existing data |
| Add an index | Safe (but slow) | Can take time on large tables |
| Remove a nullable column | Irreversible | Data lost permanently |
| Rename a column | Dangerous | Applications using old name break |
| Change column type | Risky | Type conversion may fail or lose precision |
| Add a NOT NULL column without default | Requires care | Existing rows have no value for it |

**Golden rule:** Migrations are mostly additive (adding things is safe). Removals are irreversible. Always make schema changes backward-compatible when possible.

---

## 2. Prisma's Migration System

Prisma provides two commands for schema changes:

| Command | Purpose | Use Case |
|---------|---------|----------|
| `prisma db push` | Syncs schema directly to DB | Development and rapid prototyping |
| `prisma migrate dev` | Creates migration file + applies it | Production-ready, versioned migrations |
| `prisma migrate deploy` | Applies pending migrations | CI/CD, production deployments |
| `prisma migrate reset` | Drops and recreates DB, runs all migrations | Local reset only |

### The Migration Files

When you use `prisma migrate dev`, Prisma creates files in `prisma/migrations/`:

```
prisma/migrations/
├── 20260101_000000_init/
│   └── migration.sql          ← Initial schema
├── 20260610_143022_add_audit_trail/
│   └── migration.sql          ← ALTER TABLE statements
└── migration_lock.toml        ← Tracks which migrations apply to which provider
```

Each migration file contains the SQL statements that transform the database from its previous state to the new state.

---

## 3. Development Workflow: `prisma db push`

**`prisma db push`** is the "just make it work" command for development. It:

1. Reads `prisma/schema.prisma`.
2. Compares it to the current database schema.
3. Generates and applies the necessary SQL DDL statements directly.
4. Does **not** create migration files.

```bash
# Apply schema changes to your local database
npx prisma db push

# Apply schema changes and reset (drops + recreates) the database
npx prisma db push --force-reset
```

### When to Use `db push`

- During active development when schema is changing frequently.
- When testing a new model or field and you may change it again.
- For rapid prototyping without committing to a migration history.

### Limitations of `db push`

- No migration history — you cannot replay changes on another machine.
- No rollback — if you push a bad change, there's no undo.
- **Do not use on production databases with real data.** Data loss risk is high.

---

## 4. Production Workflow: `prisma migrate dev`

**`prisma migrate dev`** is the correct workflow for changes that will reach production:

1. You edit `prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name add_phone_to_user`.
3. Prisma computes the diff between the current schema and the last migration.
4. Prisma generates a `migration.sql` file containing the necessary SQL.
5. Prisma applies that SQL to your local development database.
6. You commit the migration file to git.
7. In production, `npx prisma migrate deploy` applies any unapplied migrations.

```bash
# Create and apply a new migration
npx prisma migrate dev --name descriptive_migration_name

# Apply pending migrations (used in CI/CD, does not generate new migrations)
npx prisma migrate deploy

# View migration status
npx prisma migrate status
```

### Migration File Naming

Use descriptive names that explain what changed:

```bash
npx prisma migrate dev --name add_aiReviewStatus_to_evidence
npx prisma migrate dev --name create_audit_declaration_model
npx prisma migrate dev --name add_index_to_notification_module
```

The timestamp prefix is added automatically by Prisma.

---

## 5. Why This Project Uses `db push`

The GRC project uses `prisma db push` rather than `prisma migrate dev` because:

1. **Neon PostgreSQL with `db push`:** Neon supports `db push` natively and it is the recommended approach for rapid development against Neon databases.

2. **Single environment:** The cloud deployment always seeds from scratch (`db push --force-reset` then `db:seed`) rather than maintaining a migration history.

3. **Schema velocity:** The schema evolves rapidly during development. Maintaining hundreds of migration files would create significant overhead without providing meaningful benefits given the reset-and-reseed deployment pattern.

4. **Neon branching as alternative:** Neon's database branching feature (creating a copy-on-write snapshot) provides a safer alternative to migrations for testing schema changes against production data.

**Important:** If the project ever moves to a deployment model where existing production data must be preserved across schema changes without a full reset, migrating to `prisma migrate dev` would be necessary.

---

## 6. How to Add a New Field to an Existing Model

### Step 1: Edit the Schema

Open `prisma/schema.prisma` and add the field to the appropriate model:

```prisma
model Risk {
  id                String  @id @default(cuid())
  customerAccountId String
  name              String
  // ... existing fields ...

  // NEW FIELD: add review notes capability
  reviewNotes       String?  // Optional text notes from the reviewer
}
```

**Best practices when adding fields:**
- Make new fields **nullable** (`String?`) or give them a **default value** (`@default(false)`). Adding a required field without a default value fails for existing rows that have no value for it.
- Add a comment explaining the field's purpose.
- If the field will be used in `where` clauses frequently, add an index.

### Step 2: Push the Schema to Development Database

```bash
npx prisma db push
```

This applies the schema change to your local database. Existing rows in the `Risk` table will have `reviewNotes = NULL`.

### Step 3: Regenerate Prisma Client

After a schema change, Prisma Client types must be regenerated so TypeScript knows about the new field:

```bash
npx prisma generate
```

In practice, `prisma db push` usually runs `prisma generate` automatically. If your editor's TypeScript still shows errors, restart the TypeScript server.

### Step 4: Regenerate the SQL Schema File

Per `CLAUDE.md`, after every schema change regenerate `prisma/schema.sql`:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql
```

### Step 5: Update Application Code

Now use the new field in the relevant API route:

```typescript
// In the PATCH handler for /api/risks/[id]/route.ts
const { reviewNotes, ...otherFields } = body;

await prisma.risk.update({
  where: { id, customerAccountId },
  data: { reviewNotes, ...otherFields }
});
```

And in the client-side form:

```typescript
// In the risk edit form component
<FormField
  control={form.control}
  name="reviewNotes"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t("Review Notes")}</FormLabel>
      <FormControl>
        <Textarea {...field} />
      </FormControl>
    </FormItem>
  )}
/>
```

### Step 6: Add i18n for Any New UI Labels

Per `CLAUDE.md`, add new UI strings to `scripts/init-translations.ts` and run:

```bash
npx tsx scripts/generate-translations.ts
```

---

## 7. How to Add a New Model

### Step 1: Design the Model

Before writing code, answer these questions:
1. Does this model belong to a specific tenant? If yes, it needs `customerAccountId`.
2. Should it be soft-deleted or hard-deleted?
3. What other models does it relate to?
4. What indexes are needed?

### Step 2: Add the Model to the Schema

```prisma
// Add in the appropriate section of prisma/schema.prisma
// Use comments to mark section boundaries

// ==================== COMPLIANCE MODULE ====================

model PolicyReview {
  id                String          @id @default(cuid())
  // Multi-tenant: Link to customer account
  customerAccountId String
  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id])
  
  // The policy being reviewed
  policyId          String
  policy            Policy          @relation(fields: [policyId], references: [id], onDelete: Cascade)
  
  // Review details
  reviewCycle       String          // "Annual", "Biannual", "Ad-hoc"
  reviewedBy        String?
  reviewNotes       String?
  decision          String          @default("Pending") // Pending, Approved, Rejected, NeedsUpdate
  
  // Timestamps
  reviewedAt        DateTime?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  
  @@index([customerAccountId])
  @@index([policyId])
}
```

### Step 3: Add the Relation to the Parent Model

Prisma requires both sides of a relation to be declared:

```prisma
model Policy {
  // ... existing fields ...
  
  // ADD THIS LINE to the Policy model
  reviews         PolicyReview[]
}
```

Also add to `CustomerAccount`:
```prisma
model CustomerAccount {
  // ... existing fields ...
  policyReviews   PolicyReview[]
}
```

### Step 4: Push Schema and Generate Client

```bash
npx prisma db push
npx prisma generate
```

### Step 5: Regenerate SQL Schema File

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql
```

### Step 6: Create the API Routes

Follow the standard API route pattern:

```
src/app/api/compliance/policy-reviews/
├── route.ts           ← GET (list) + POST (create)
└── [id]/
    └── route.ts       ← GET + PATCH + DELETE
```

```typescript
// src/app/api/compliance/policy-reviews/route.ts
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(
  async (req, context, session) => {
    const reviews = await prisma.policyReview.findMany({
      where: { customerAccountId: session.user.customerAccountId }
    });
    return Response.json(reviews);
  },
  { resource: 'compliance.governance', action: 'view' }
);

export const POST = withAuth(
  async (req, context, session) => {
    const body = await req.json();
    const review = await prisma.policyReview.create({
      data: { ...body, customerAccountId: session.user.customerAccountId }
    });
    return Response.json(review, { status: 201 });
  },
  { resource: 'compliance.governance', action: 'create' }
);
```

### Step 7: Add Navigation (if needed)

If the new model has its own page, add a navigation entry in `src/lib/navigation.ts`:

```typescript
{
  name: "Policy Reviews",
  href: "/compliance/policy-reviews",
  permission: "compliance.governance:view"
}
```

---

## 8. Regenerating the SQL Schema File

The `prisma/schema.sql` file is an SQL version of `prisma/schema.prisma`. It is kept in sync for documentation purposes, for database administrators who prefer SQL, and for manual review of schema changes.

**Command:**

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script \
  > prisma/schema.sql
```

**What this does:**
- `--from-empty` — compute the diff from an empty database.
- `--to-schema-datamodel prisma/schema.prisma` — to the current schema.
- `--script` — output as executable SQL (CREATE TABLE, CREATE INDEX, etc.).

**When to run:** Every time `prisma/schema.prisma` is modified.

---

## 9. Deploying Schema Changes to Production

The production database is Neon PostgreSQL. The deployment process uses `db push` with a force-reset, then re-seeds:

### Standard Deployment (reset + reseed)

This is appropriate when the data volume is small (UAT environment, early production):

```bash
# Step 1: Push schema to Neon (force-reset drops and recreates all tables)
DATABASE_URL="postgresql://neondb_owner:<password>@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  npx prisma db push --force-reset

# Step 2: Re-seed the database with baseline data
DATABASE_URL="postgresql://neondb_owner:<password>@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  npx tsx prisma/seed.ts
```

**Warning:** `--force-reset` **permanently deletes all data**. Only use it when:
- The environment is a staging/testing environment.
- Or you have an accepted migration plan for production data.

### Additive-Only Deployment (preserving data)

When preserving existing production data is critical, use additive-only changes with `db push` (without `--force-reset`):

```bash
# Apply only the new tables/columns, without dropping anything
DATABASE_URL="<neon_connection_string>" npx prisma db push
```

This works safely for:
- Adding new nullable columns.
- Adding new tables.
- Adding new indexes.

It will **fail** for destructive changes (removing columns, changing types) that conflict with existing data.

---

## 10. Rolling Back Changes

### Rolling Back a `db push`

`prisma db push` has no built-in rollback. To undo a `db push`:

1. **Revert `schema.prisma`** to the previous version.
2. **Run `db push` again** — Prisma will attempt to undo the changes.

**Warning:** If you removed a column and data was deleted, that data is gone. Prisma will not re-create the column with its old data. This is why `db push` should only be used in development.

### Rolling Back on Neon

Neon supports **Point-in-Time Recovery** (PITR). If a bad migration was applied to production:

1. Log in to the Neon console.
2. Create a branch from a point in time before the bad migration.
3. Redirect the application's `DATABASE_URL` to the branch.
4. Fix the schema change.
5. Re-apply the corrected migration.

### Preventing Data Loss

For critical schema changes, always:

1. Test the change in a local environment first.
2. Test in a Neon branch (copy of production data).
3. Verify the application works correctly.
4. Apply to production only after successful verification.

---

## 11. Common Migration Errors and Fixes

### Error: "The migration `20260610_143022` failed to apply"

**Cause:** A SQL error in the migration file (e.g., a column referenced in a constraint doesn't exist).

**Fix:** 
1. Review the error message carefully.
2. Fix the SQL in the migration file.
3. If using `db push`, fix the schema and re-push.

---

### Error: "Unique constraint violation"

```
Unique constraint failed on the fields: (`customerAccountId`, `controlCode`)
```

**Cause:** The schema has a `@@unique` constraint, and a seed or migration tried to insert a duplicate.

**Fix:** 
- In seeds, use `upsert` instead of `create`.
- Ensure seed data doesn't create duplicate records on re-runs.

---

### Error: "Foreign key constraint failed"

```
Foreign key constraint failed on the field: `departmentId`
```

**Cause:** Tried to create a record referencing a `departmentId` that doesn't exist in the `Department` table.

**Fix:**
- Verify the referenced record exists before creating the child record.
- In seeds, create parent records (departments) before child records (risks).

---

### Error: "NOT NULL constraint failed"

```
Argument `name` is missing.
```

**Cause:** Added a new `String` (non-nullable) column without a `@default` value, and existing rows have no value for it.

**Fix:** Either:
- Make the field nullable: `name String?`
- Provide a default: `name String @default("")`
- Use a migration that fills existing rows before adding the NOT NULL constraint.

---

### Error: "Can't reach database server at localhost"

**Cause:** `DATABASE_URL` is pointing to a local PostgreSQL instance that isn't running, or the port is wrong.

**Fix:**
- Verify PostgreSQL is running: `pg_isready -h localhost -p 5432`
- Check `DATABASE_URL` in your `.env` file.
- For local development: start PostgreSQL or use the SQLite URL.

---

### Error: Prisma Client not updated after schema change

**Symptom:** TypeScript shows "Property 'reviewNotes' does not exist on type 'Risk'" even though you added the field to the schema.

**Fix:** Regenerate the Prisma Client:

```bash
npx prisma generate
```

Then restart the TypeScript server in your editor (VS Code: `Ctrl+Shift+P` → "TypeScript: Restart TS Server").

---

*For seeding procedures, see [Seeding.md](Seeding.md). For database concepts, see [Database-Overview.md](Database-Overview.md).*

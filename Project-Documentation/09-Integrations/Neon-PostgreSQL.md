# Neon PostgreSQL

## Table of Contents

1. [Overview](#overview)
2. [What Is Neon?](#what-is-neon)
3. [Why Neon Over Traditional PostgreSQL?](#why-neon-over-traditional-postgresql)
4. [Serverless Scaling and Cold Starts](#serverless-scaling-and-cold-starts)
5. [Connection String Format](#connection-string-format)
6. [Connecting from Next.js](#connecting-from-nextjs)
7. [Prisma with Neon](#prisma-with-neon)
8. [Database Branching](#database-branching)
9. [Database Operations Reference](#database-operations-reference)
10. [Neon Console](#neon-console)
11. [Free Tier Limits](#free-tier-limits)
12. [Backup and Restore](#backup-and-restore)
13. [Migration Strategy](#migration-strategy)
14. [Troubleshooting](#troubleshooting)

---

## Overview

Neon is the PostgreSQL database powering the GRC application in the cloud (Vercel production environment). It provides serverless PostgreSQL hosting with features designed for modern cloud-native applications: automatic scaling, connection pooling, and database branching.

**Connection details:**
- **Project Name:** `grc-app-ba-testing`
- **Region:** `aws-us-east-1` (US East)
- **PostgreSQL Version:** 16
- **Connection Endpoint:** `ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech`

---

## What Is Neon?

Neon is a fully managed, serverless PostgreSQL database service. "Serverless" in the context of databases means:

- **No servers to manage** — Neon handles all PostgreSQL infrastructure, including patching, backups, and high availability
- **Automatic scaling** — compute scales based on demand, from zero (when idle) to your configured maximum
- **Pay-per-use** — on the free tier, you are not paying for idle compute time (the database autosuspends)

Neon is built on standard PostgreSQL, which means:

- All PostgreSQL features work as expected (JSONB, full-text search, window functions, etc.)
- All PostgreSQL clients and ORMs (including Prisma) connect to Neon using standard PostgreSQL connection strings
- Standard PostgreSQL knowledge applies to Neon

### Architecture Overview

Neon separates compute from storage:

- **Storage** — your data is stored in Neon's distributed storage layer (always running, always durable)
- **Compute** — a PostgreSQL compute instance processes queries; this can start and stop independently

This separation enables the autosuspend feature: the storage is always available, but the compute is only running when actively processing queries.

---

## Why Neon Over Traditional PostgreSQL?

### Comparison

| Feature | Traditional PostgreSQL | Neon Serverless |
|---|---|---|
| Setup | Install, configure, manage server | Sign up, get a connection string |
| Scaling | Manual vertical/horizontal scaling | Automatic scale-to-zero |
| Idle cost | Server runs and costs money 24/7 | Autosuspend eliminates idle cost |
| Backups | Manual setup required | Automatic, continuous backups |
| Branching | Complex with pg_dump/restore | Built-in database branches (like Git branches) |
| High availability | Manual replica setup | Built-in redundancy |
| Maintenance | Manual version upgrades, patching | Managed by Neon |
| Free tier | None (self-hosting still costs) | Generous free tier (0.5 GB, 1 project) |

### For This Project

The GRC application uses Neon for the production (Vercel) environment because:

- **Zero operational overhead** — no database server to manage
- **Cost-effective for early-stage** — free tier covers the BA testing environment
- **Native Vercel integration** — Vercel and Neon are designed to work together; Vercel's deployment workflows assume Neon
- **Compatible with Prisma** — Neon is fully compatible with Prisma ORM out of the box

---

## Serverless Scaling and Cold Starts

### Autosuspend

Neon's free tier enables autosuspend: after 5 minutes of inactivity, the PostgreSQL compute instance suspends. The storage remains intact, but no compute is running.

**Impact on the application:**

When the application receives a request after the database has been suspended, the first query experiences a **cold start delay** of approximately 500ms – 3000ms while the compute instance resumes. Subsequent queries within the active session are unaffected.

**User experience:**

The first user to interact with a suspended database will experience a slow page load. Pages that make multiple API calls will see the first call delayed and subsequent calls normal.

### Mitigation Strategies

**Option 1: Accept cold starts (current approach)**

For a BA testing environment with low and sporadic traffic, cold starts are acceptable. Users occasionally experience a slow first load, but normal usage is fast.

**Option 2: Keep-alive pings**

Send a lightweight query every 4 minutes to prevent autosuspend:

```bash
# Example cron job (not currently configured)
curl https://grc-app-ba-testing.vercel.app/api/health
```

The `/api/health` endpoint should execute a simple `SELECT 1` query to keep the connection alive.

**Option 3: Upgrade to Neon paid tier**

Neon's paid tiers allow disabling autosuspend, keeping compute always running. This eliminates cold starts entirely.

### Scale-to-Zero vs. Always-On

| Mode | Cost | Cold Start | Use Case |
|---|---|---|---|
| Autosuspend (free) | $0 idle | Yes (0.5–3s) | BA testing, development |
| Autosuspend (paid, 5 min) | Low | Yes (0.5–3s) | Staging environments |
| Always-on | Higher | No | Production with SLA requirements |

---

## Connection String Format

### Standard Connection String

```
postgresql://<user>:<password>@<host>/<dbname>?sslmode=require
```

**Production connection string:**
```
postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Components:
- `neondb_owner` — database username (the owner role)
- `npg_TESP3ed8wYvZ` — password
- `ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech` — Neon endpoint hostname
- `neondb` — database name
- `sslmode=require` — enforce TLS encryption in transit (required for Neon)

### Pooled Connection String (for serverless)

When deploying to Vercel, use the pooled connection string to go through PgBouncer:

```
postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p-pooler.c-3.us-east-1.aws.neon.tech/neondb?pgbouncer=true&connect_timeout=15&sslmode=require
```

Note the `-pooler` suffix in the hostname and the `pgbouncer=true` parameter.

### Direct Connection String (for migrations)

Use the direct (non-pooled) connection for Prisma migrations, which require a persistent connection:

```
postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

---

## Connecting from Next.js

### Environment Variable

The connection string is stored in the `DATABASE_URL` environment variable. In production (Vercel), this is set in the Vercel dashboard. Locally, it is set in `.env.local`.

**Local development uses a local PostgreSQL instance, not Neon.** This keeps cloud costs at zero during development and ensures local changes are isolated from the cloud environment.

```bash
# .env.local (local development — NOT committed to git)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/grc_app"

# Production (set in Vercel dashboard, not in .env files)
DATABASE_URL="postgresql://neondb_owner:password@ep-xxx.neon.tech/neondb?sslmode=require"
```

### Prisma Client Singleton

The Prisma client is instantiated as a singleton in `src/lib/prisma.ts`. In development, it reuses the existing client across hot-reloads to prevent connection exhaustion:

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

The `globalForPrisma` pattern prevents creating a new `PrismaClient` on every hot-reload in development (which would exhaust the connection pool).

---

## Prisma with Neon

### Schema Management

The database schema is defined in `prisma/schema.prisma`. To apply schema changes:

**Local development (creates a migration file):**
```bash
npx prisma migrate dev --name "description-of-change"
```

**Cloud (push schema directly without migration files):**
```bash
DATABASE_URL="postgresql://..." npx prisma db push
```

**Why db push for cloud?** `prisma migrate deploy` requires migration history to be consistent between local and cloud. For a BA testing environment with frequent schema resets, `db push` is simpler: it applies whatever schema is in `schema.prisma`, regardless of migration history.

### Generating the Prisma Client

After any schema change, regenerate the Prisma client:

```bash
npx prisma generate
```

This is run automatically as part of `npm run build`. However, after a schema change in development, you must run it manually to update TypeScript types.

### Schema SQL Sync

The project maintains a `prisma/schema.sql` file for documentation and PostgreSQL-native use. After every change to `prisma/schema.prisma`, regenerate it:

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/schema.sql
```

---

## Database Branching

### What Are Neon Branches?

Neon supports database branching — creating a copy of your database that starts from the same point in time as the parent branch, with independent storage. Changes to a branch do not affect the parent, and vice versa.

This is similar to Git branches: you branch off, make changes, test them, and optionally merge back.

### Use Cases for Branching

**Testing schema migrations:**
Before applying a Prisma migration to production, create a branch, apply the migration there, and verify it works without data loss.

```bash
# In Neon console: create branch "migration-test" from main
# Point a test DATABASE_URL to the branch endpoint
DATABASE_URL="postgresql://...branch-endpoint.../neondb?sslmode=require" \
  npx prisma migrate deploy

# Run integration tests against the branch
# If successful, apply the migration to the main branch
```

**Staging environment:**
Use a branch as a staging database with the same data as production. Deploy the staging application to a Vercel preview deployment pointed at the Neon branch.

**Developer isolation:**
Each developer can have their own database branch, making it safe to experiment without affecting shared environments.

### Creating a Branch

Via Neon Console:
1. Navigate to your Neon project
2. Click **Branches** in the left sidebar
3. Click **New Branch**
4. Select the parent branch (usually `main`) and the point in time to branch from
5. Neon instantly creates the branch by leveraging copy-on-write storage (no data is actually copied until changes are made)

---

## Database Operations Reference

### Check Schema Status

```bash
# View current migration status
npx prisma migrate status

# Open Prisma Studio (GUI for browsing data)
npx prisma studio
```

### Apply Schema to Cloud Database

```bash
# Push current schema.prisma to Neon (no migration files)
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  npx prisma db push
```

### Seed the Cloud Database

```bash
# Seed with initial data (superadmin user, default settings)
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  npx tsx prisma/seed.ts
```

### Full Reset and Reseed

Use this when you need a clean slate (e.g., after major schema changes that break existing data):

```bash
# Step 1: Reset — drops and recreates all tables
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  npx prisma db push --force-reset

# Step 2: Seed with fresh data
DATABASE_URL="postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  npx tsx prisma/seed.ts
```

**Warning:** `--force-reset` permanently deletes all data. Only use on BA testing environments, never on production with real customer data.

### Seed Customer-Specific Data

```bash
# Seed BTS customer-specific data
DATABASE_URL="postgresql://..." npx tsx prisma/seed-bts.ts
```

### Run a One-Off SQL Query

```bash
# Using psql directly
psql "postgresql://neondb_owner:npg_TESP3ed8wYvZ@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  -c "SELECT COUNT(*) FROM \"CustomerAccount\";"
```

### Check Row Counts

```bash
psql "$DATABASE_URL" -c "
SELECT
  table_name,
  (xpath('/row/cnt/text()', xml_count))[1]::text::int AS row_count
FROM (
  SELECT table_name,
    query_to_xml(
      format('SELECT COUNT(*) AS cnt FROM %I', table_name),
      false, true, ''
    ) AS xml_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
) subq
ORDER BY row_count DESC;
"
```

---

## Neon Console

The Neon Console is the web dashboard for managing your database at: https://console.neon.tech

### Key Sections

**Dashboard:**
Shows compute utilization, storage usage, and connection counts. Useful for monitoring whether the database is hitting limits.

**Query Editor:**
A browser-based SQL editor for running ad-hoc queries directly against the database. Useful for quick debugging without needing psql or a GUI tool.

**Tables:**
Browse the database schema and table structure. See column types, indexes, and constraints.

**Monitoring:**
- **Connections** — current active connections and historical connection count
- **Queries** — slow query log (queries taking more than a configurable threshold)
- **Storage** — storage usage over time

**Branches:**
Create, view, and delete database branches.

**Settings:**
- Change autosuspend configuration
- View and copy connection strings
- Manage roles and passwords
- Configure IP allowlists

---

## Free Tier Limits

Understanding the free tier limits prevents unexpected behavior:

| Resource | Free Tier Limit | Notes |
|---|---|---|
| Storage | 0.5 GB | Includes all branches |
| Compute | 191.9 compute hours/month | Shared across all branches |
| Projects | 1 project | One Neon project per free account |
| Branches | Up to 10 | |
| Autosuspend | 5 minutes idle | Cannot disable on free tier |
| Connections | 50 simultaneous | Shared across all branches |
| Transfer | 5 GB/month | Data transferred in/out |

### Staying Within Limits

**Storage:** The GRC application stores mostly text data (JSON, strings) and small file attachments. 0.5 GB is typically sufficient for hundreds of customer organizations with full GRC data. Monitor storage in the Neon Console.

**Compute hours:** 191.9 hours/month = ~6.4 hours/day. With autosuspend, the database only consumes compute when actively serving queries. For a testing environment, this is more than sufficient.

**Connection limit:** With Prisma's connection pooling and Neon's PgBouncer, the 50-connection limit is manageable even under concurrent load.

### Storage Optimization

If approaching the 0.5 GB limit:

- Archive old/unused customer accounts
- Purge old audit trail records (configurable retention policy)
- Remove large file attachments stored in the database
- Delete unused translation records for deleted data

---

## Backup and Restore

### Automatic Backups

Neon provides continuous point-in-time recovery (PITR). All write operations are logged, and you can restore to any point in time within the retention window:

- **Free tier:** 7-day PITR window
- **Paid tiers:** Up to 30-day PITR window

### Restoring from Backup

1. Go to the Neon Console → Branches
2. Click **New Branch**
3. Select "Create from history" and choose a point in time
4. Neon creates a new branch at that point in time
5. Connect to the branch to verify the data
6. If correct, either use the branch as the new main or export and reimport the data

### Manual Export

```bash
# Export the entire database
pg_dump "postgresql://neondb_owner:password@ep-xxx.neon.tech/neondb?sslmode=require" \
  --no-owner --no-privileges \
  -f backup-$(date +%Y%m%d).sql

# Export a single table
pg_dump "postgresql://..." \
  --no-owner --no-privileges \
  --table="Risk" \
  -f risk-backup.sql
```

### Manual Import

```bash
# Restore from a SQL dump
psql "postgresql://..." -f backup-2026-01-01.sql
```

---

## Migration Strategy

### Development → Cloud

The workflow for applying database changes:

1. **Develop locally:** Make changes to `prisma/schema.prisma`
2. **Create local migration:** `npx prisma migrate dev --name "my-change"`
3. **Test locally:** Verify the application works with the new schema
4. **Apply to cloud:** `DATABASE_URL="neon-url" npx prisma db push`
5. **Verify cloud:** Check the Neon Console to confirm the schema changes

### Handling Breaking Changes

Schema changes that break existing data (e.g., renaming a column, changing a NOT NULL constraint) require careful handling:

1. Create a Neon branch from the current production data
2. Apply the migration to the branch
3. Write and run a data migration script to transform existing data
4. Verify the application works on the branch
5. Apply the same migration and script to production during a maintenance window

---

## Troubleshooting

### Database Not Responding (Cold Start)

**Symptom:** First request after idle period takes 3–5 seconds; subsequent requests are fast.

**Cause:** Neon autosuspend. Compute is resuming after the idle period.

**Solution:** This is expected behavior on the free tier. If unacceptable, implement keep-alive pings or upgrade to a paid tier with autosuspend disabled.

### Too Many Connections

**Symptom:** Error: `FATAL: sorry, too many clients already`

**Cause:** The 50-connection limit has been hit, typically because multiple serverless instances each opened their own connections.

**Solution:**
1. Ensure `DATABASE_URL` uses the pooled connection string (with `-pooler` hostname and `pgbouncer=true`)
2. Set `connection_limit=1` in the Prisma datasource for serverless environments
3. Restart the Vercel deployment to clear stale connections

### Schema Out of Sync

**Symptom:** Prisma throws `Unknown field` or `Required field` errors at runtime.

**Cause:** The deployed code has a different schema than what is in the Neon database, usually because `prisma db push` was not run after a schema change.

**Solution:**
```bash
DATABASE_URL="..." npx prisma db push
```

Then redeploy the application.

### Password Rotation

If the Neon database password needs to be changed:

1. Go to Neon Console → Settings → Roles
2. Generate a new password for `neondb_owner`
3. Update `DATABASE_URL` in the Vercel environment variables
4. Redeploy the application

---

*Last updated: 2026-06-29*
*Module version: GRC App — GRC-MultiTenant branch*

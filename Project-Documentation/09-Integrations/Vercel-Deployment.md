# Vercel Deployment

## Table of Contents

1. [Overview](#overview)
2. [Vercel Platform Fundamentals](#vercel-platform-fundamentals)
3. [Project Setup](#project-setup)
4. [Environment Variables](#environment-variables)
5. [Git Integration and Auto-Deploy](#git-integration-and-auto-deploy)
6. [Build Process](#build-process)
7. [Build Failures: Prevention and Diagnosis](#build-failures-prevention-and-diagnosis)
8. [Vercel CLI Reference](#vercel-cli-reference)
9. [Cron Jobs (vercel.json)](#cron-jobs-verceljson)
10. [Serverless Function Limitations](#serverless-function-limitations)
11. [Database Connection Pooling](#database-connection-pooling)
12. [Deployment URLs](#deployment-urls)
13. [Custom Domain Setup](#custom-domain-setup)
14. [Rollback and Redeploy](#rollback-and-redeploy)
15. [Monitoring and Logs](#monitoring-and-logs)

---

## Overview

Vercel is the hosting platform that runs the GRC application in production. It is a cloud platform purpose-built for Next.js, providing:

- Automated builds triggered by Git pushes
- Serverless function execution for Next.js API routes
- Global CDN for static assets
- Managed cron job scheduling
- Integrated deployment previews for pull requests

The live deployment is at: **https://grc-app-ba-testing.vercel.app**

Vercel project: `omjc44-8839s-projects/grc-app-ba-testing`

---

## Vercel Platform Fundamentals

### How Vercel Works with Next.js

When you push code to the Git repository, Vercel automatically:

1. Detects the change via a Git webhook
2. Clones the repository
3. Runs the build command (`npm run build`)
4. If the build succeeds, deploys the new version to Vercel's edge network
5. Routes traffic to the new deployment (zero-downtime deploy)
6. The old deployment remains available for instant rollback

### Serverless Architecture

Unlike a traditional Node.js server that runs continuously, Vercel executes Next.js API routes as **serverless functions**. This means:

- Each API route is its own isolated function
- Functions spin up on demand and shut down after idle periods
- There is no persistent in-memory state between requests (use a database)
- Cold starts can add 100–500ms latency for the first request after idle
- Each function has its own memory limit (default 1GB) and timeout (default 10 seconds)

### Deployment Units

Every push to the repository creates a new **deployment** — an immutable snapshot of the application at that commit. Deployments have unique URLs (e.g., `grc-app-abc123-team.vercel.app`). The "production" deployment is the one currently receiving traffic at the main domain.

---

## Project Setup

### Linking to Vercel

The project is already linked to Vercel. The link is stored in `.vercel/project.json`:

```json
{
  "orgId": "omjc44-8839s-projects",
  "projectId": "prj_..."
}
```

Do not commit changes to `.vercel/project.json` or `.vercel/`. This directory is gitignored.

### Vercel Project Settings

Access the Vercel dashboard at: https://vercel.com/omjc44-8839s-projects/grc-app-ba-testing

Key settings to be aware of:

- **Framework Preset:** Next.js (auto-detected)
- **Build Command:** `npm run build` (overridden to include pre-build steps — see Build Process)
- **Output Directory:** `.next` (Next.js default)
- **Node.js Version:** 20.x (configured to match local development environment)
- **Root Directory:** `.` (project root)

### Team and Access

The project belongs to the `omjc44-8839s-projects` Vercel team. Team members can access the dashboard, view logs, and manage deployments.

---

## Environment Variables

Environment variables are set in the Vercel dashboard under **Project Settings → Environment Variables**. They are NOT stored in the repository (except non-sensitive example values in `.env.example`).

### Setting Environment Variables

1. Go to the Vercel dashboard
2. Navigate to your project
3. Click **Settings → Environment Variables**
4. Add or edit variables
5. Set the target environment(s): Production, Preview, and/or Development

### Required Environment Variables

| Variable | Description | Sensitivity |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | Secret |
| `NEXTAUTH_SECRET` | NextAuth JWT signing secret (random 32+ chars) | Secret |
| `NEXTAUTH_URL` | Full public URL of the app | Not secret |
| `FIELD_ENCRYPTION_KEY` | AES-256-GCM encryption key (base64, 32 bytes) | Secret |
| `ENCRYPTION_ENABLED` | Enable/disable field encryption (`true` or `false`) | Not secret |
| `PYTHON_API_URL` | Python translation service endpoint | Not secret |
| `PYTHON_API_SECRET` | Bearer token for Python API authentication | Secret |
| `SMTP_HOST` | Email server hostname | Not secret |
| `SMTP_PORT` | Email server port | Not secret |
| `SMTP_USER` | Email server username | Secret |
| `SMTP_PASS` | Email server password | Secret |
| `SMTP_FROM` | Sender email address | Not secret |
| `CRON_SECRET` | Bearer token for cron endpoint authentication | Secret |

### Optional Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public app URL for client-side links | Same as `NEXTAUTH_URL` |
| `LOG_LEVEL` | Logging verbosity (`error`, `warn`, `info`, `debug`) | `warn` |

### Environment-Specific Configuration

Vercel supports different variable values for different environments:

- **Production** — runs at the main domain (`grc-app-ba-testing.vercel.app`)
- **Preview** — runs at auto-generated preview URLs for pull requests
- **Development** — used by `vercel dev` (local development via Vercel CLI)

For this project, all environments use the same Neon PostgreSQL database. If you need separate databases for staging vs. production, create separate Neon projects and set different `DATABASE_URL` values per environment.

### Never Commit Secrets

Never put secret values in:
- `.env` files committed to the repository
- `next.config.ts` hardcoded values
- Source code files

Use Vercel encrypted environment variables exclusively for secrets.

---

## Git Integration and Auto-Deploy

### How Auto-Deploy Works

The Vercel project is connected to the Git repository. When you push to certain branches, Vercel automatically triggers a build:

| Branch | Deploy Type | URL |
|---|---|---|
| `main` / `GRC-MultiTenant` | Production | https://grc-app-ba-testing.vercel.app |
| All other branches | Preview | https://grc-app-[branch]-team.vercel.app |

### Push Workflow

```bash
# Standard code push (triggers auto-deploy)
git add <changed-files>
git commit -m "Description of changes"
git push
# Vercel webhook fires automatically
# Monitor build at: https://vercel.com/omjc44-8839s-projects/grc-app-ba-testing
```

### Disabling Auto-Deploy

If you need to push code without triggering a deployment (e.g., updating documentation only), add `[skip ci]` to the commit message:

```bash
git commit -m "Update CLAUDE.md [skip ci]"
```

---

## Build Process

### Build Steps in Order

Vercel runs the following commands in sequence:

```bash
# Step 1: Install dependencies
npm ci

# Step 2: Run build command (configured in package.json "build" script)
npm run build
```

The `npm run build` script in `package.json` expands to:

```bash
# Step 2a: Generate locale JSON files from init-translations.ts
npm run i18n:generate

# Step 2b: Generate Prisma client
prisma generate

# Step 2c: Build Next.js (TypeScript compilation + production bundle)
next build
```

### Why Each Step Matters

**i18n:generate:** Runs `npx tsx scripts/generate-translations.ts`, which reads `scripts/init-translations.ts` and outputs locale JSON files (e.g., `locales/ar.json`, `locales/lv.json`). These files are imported by the LanguageContext at runtime. If this step fails, Arabic and Latvian translations will be missing.

**prisma generate:** Generates the Prisma client from `prisma/schema.prisma`. This step creates the TypeScript types for all database models. Without it, TypeScript would fail to find Prisma types. The generated client is not committed to the repository — it is regenerated on every build.

**next build:** Compiles TypeScript to JavaScript, runs static analysis, and produces an optimized production bundle. This step runs the TypeScript compiler with strict settings. Errors that are silently ignored by `next dev` will fail the production build.

### Build Duration

Typical build time: 3–5 minutes on Vercel's build infrastructure. Monitoring:

```bash
vercel logs --since 30m  # View recent build logs
```

---

## Build Failures: Prevention and Diagnosis

### Run Local Build Before Every Push

The single most effective way to prevent Vercel build failures is to run the build locally before pushing:

```bash
cd "D:\GRC\grc-app"
npm run build
```

If the local build fails, it will fail on Vercel. Fix all local build errors before pushing.

### Common TypeScript Build Errors

**Null vs Undefined Mismatch:**
```typescript
// Error: Type 'null' is not assignable to type 'string | undefined'
const name: string | undefined = record.name || null; // Wrong: null not allowed

// Fix:
const name: string | undefined = record.name || undefined;
```

**Missing Interface Properties:**
```typescript
// Error: Property 'updatedAt' is missing in type '{ id: string; name: string; }'
const risk: Risk = { id: '1', name: 'test' }; // Missing required fields

// Fix: include all required fields
const risk: Risk = { id: '1', name: 'test', updatedAt: new Date(), /* ... */ };
```

**Prisma Select/Include Conflict:**
```typescript
// Error: Cannot use both select and include simultaneously
const risk = await prisma.risk.findUnique({
  where: { id },
  select: { name: true },
  include: { department: true }, // Conflict!
});

// Fix: use select with nested select, or use include only
const risk = await prisma.risk.findUnique({
  where: { id },
  include: { department: true }, // OK
});
```

**Implicit Any:**
```typescript
// Error: Parameter 'event' implicitly has an 'any' type.
const handler = (event) => event.preventDefault(); // Wrong

// Fix:
const handler = (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault();
```

**Next.js 16 Async Params:**
```typescript
// Error in Next.js 16: params must be awaited
// Wrong:
const { id } = context.params;

// Correct:
const { id } = await context.params;
```

### Diagnosing a Failed Build

1. Open the Vercel dashboard
2. Navigate to the failed deployment
3. Click "View Build Logs"
4. Scroll to the first error (errors cascade — fix the first one first)
5. Reproduce locally with `npm run build`
6. Fix, commit, push

---

## Vercel CLI Reference

### Installation and Login

```bash
npm install -g vercel
vercel login  # Opens browser for authentication
```

### Common Commands

```bash
# List recent deployments
vercel ls grc-app-ba-testing

# View deployment logs
vercel logs https://grc-app-xyz.vercel.app

# View recent logs for production
vercel logs grc-app-ba-testing --since 1h

# Redeploy the latest production deployment (without rebuilding code)
vercel redeploy <deployment-url>

# Deploy manually from current directory
vercel --prod

# Check current deployment status
vercel inspect <deployment-url>

# Pull environment variables to local .env.local file
vercel env pull .env.local

# Add an environment variable
vercel env add DATABASE_URL production

# Remove an environment variable
vercel env rm DATABASE_URL production
```

### The Temp Directory Deployment Approach

Due to git author permission issues with Vercel's git integration, manual deployments use a temp directory:

```bash
# Copy project files (excluding .git directory)
mkdir -p /c/temp/grc-deploy
cp -r src package.json package-lock.json tsconfig.json next.config.ts \
      postcss.config.mjs prisma components.json public .vercel \
      scripts locales i18n /c/temp/grc-deploy/

# Deploy from temp directory
cd /c/temp/grc-deploy
vercel --prod
```

This approach works around git author mismatch errors by deploying the source files directly rather than relying on the git integration.

---

## Cron Jobs (vercel.json)

### What Are Vercel Cron Jobs?

Vercel Cron Jobs are scheduled HTTP requests that Vercel sends to your API routes on a defined schedule. They are configured in `vercel.json` at the project root.

### Current Cron Configuration

Located at `D:\GRC\grc-app\vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/due-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

This configures Vercel to call `GET /api/cron/due-reminders` every day at 8:00 AM UTC.

### Cron Authentication

Cron job endpoints are protected by a Bearer token to prevent unauthorized triggers:

```typescript
// In the API route handler
const authHeader = request.headers.get('Authorization');
if (process.env.NODE_ENV === 'production') {
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

Set `CRON_SECRET` in the Vercel environment variables. Vercel passes this automatically when making cron requests (it reads the `CRON_SECRET` env var and sends it as the Authorization header).

### Testing Cron Jobs Locally

```bash
# Test without authentication (development mode bypasses auth)
curl http://localhost:3000/api/cron/due-reminders

# Test with authentication (as Vercel would call it)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     http://localhost:3000/api/cron/due-reminders
```

### Cron Schedule Syntax

Vercel uses standard cron expression format: `minute hour day-of-month month day-of-week`

| Expression | Meaning |
|---|---|
| `0 8 * * *` | Every day at 8:00 AM UTC |
| `0 */6 * * *` | Every 6 hours |
| `0 9 * * 1` | Every Monday at 9:00 AM UTC |
| `0 0 1 * *` | First day of every month at midnight |

**Note:** Vercel Cron is only available on paid Vercel plans. On the free tier, crons defined in `vercel.json` are not executed. Test cron endpoints manually or upgrade to a paid plan for automated execution.

---

## Serverless Function Limitations

### Timeout

Default function timeout on Vercel's free (Hobby) tier: **10 seconds**.

Long-running operations that exceed this limit:
- Large report generation
- Bulk data exports
- Complex aggregation queries

**Solutions:**
- Break operations into smaller chunks
- Use background jobs (store job status, poll for completion)
- Upgrade to Vercel Pro for 60-second timeouts

### Memory

Default memory per function: **1024 MB (1 GB)**.

This is sufficient for most GRC operations. Memory-intensive operations like large file processing or in-memory sorting of thousands of records could hit this limit.

### Cold Starts

When a serverless function has not been called recently (typically after 5+ minutes of inactivity), the next request triggers a cold start. A cold start initializes the Node.js runtime, loads the Next.js server module, and establishes the database connection.

Typical cold start time: 500ms – 2000ms.

After the cold start, subsequent requests are served from the warm function and respond in 50–200ms.

### Statelessness

Serverless functions do not retain state between invocations. This means:
- Do not use in-memory caches (variables set in one request are gone for the next)
- Do not use file system storage for persistent data (`/tmp` is ephemeral and not shared between instances)
- All state must be in the database or an external cache (Redis)

---

## Database Connection Pooling

### The Problem

Traditional PostgreSQL connections are persistent and stateful. Each connection consumes server resources (typically 5–15 MB of RAM on the PostgreSQL server). A traditional Node.js server might maintain a pool of 10–20 connections.

In a serverless environment, every function instance maintains its own connection(s). During a traffic spike, hundreds of serverless function instances could each try to open their own connection, overwhelming the database server's connection limit.

Neon PostgreSQL's free tier allows a maximum of **50 simultaneous connections**.

### The Solution: PgBouncer / Neon Pooled Connection

Neon provides a pooled connection endpoint that routes requests through PgBouncer (a connection pooler). PgBouncer maintains a smaller pool of actual PostgreSQL connections and multiplexes many client connections over them.

**Use the pooled connection string** in the `DATABASE_URL` environment variable for production:

```
postgresql://user:password@ep-xxx.pooler.neon.tech/dbname?pgbouncer=true&connect_timeout=15
```

Note: `pooler.neon.tech` vs `neon.tech` — the pooler endpoint goes through PgBouncer.

### Prisma with Connection Pooling

When using Prisma with PgBouncer, add the `pgbouncer=true` parameter to the connection string and set `connection_limit=1` in the Prisma datasource:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Optionally, for explicit pool config:
  // directUrl = env("DIRECT_URL")  // Direct connection for migrations
}
```

For running Prisma migrations, use a direct (non-pooled) connection string, because migrations require persistent connections and are not serverless-safe through PgBouncer.

---

## Deployment URLs

### URL Structure

Every deployment gets a unique URL:

```
https://grc-app-ba-testing-[git-hash]-[team].vercel.app
```

The production URL (stable, always points to the latest production deployment):

```
https://grc-app-ba-testing.vercel.app
```

Preview deployments (created for pull requests and non-main branches):

```
https://grc-app-ba-testing-git-[branch-name]-[team].vercel.app
```

### NEXTAUTH_URL Configuration

NextAuth requires `NEXTAUTH_URL` to be set to the canonical URL of the application. In production, this must be:

```
NEXTAUTH_URL=https://grc-app-ba-testing.vercel.app
```

If this is set incorrectly, OAuth callbacks and session redirects will fail.

---

## Custom Domain Setup

### Adding a Custom Domain

1. In the Vercel dashboard, navigate to your project
2. Go to **Settings → Domains**
3. Enter your custom domain (e.g., `grc.acme.com`)
4. Configure the DNS record as instructed:
   - For root domains: add an A record pointing to Vercel's IP
   - For subdomains: add a CNAME record pointing to `cname.vercel-dns.com`
5. Vercel automatically provisions and renews an SSL certificate (Let's Encrypt)

### Updating NEXTAUTH_URL for Custom Domains

After adding a custom domain, update the `NEXTAUTH_URL` environment variable:

```
NEXTAUTH_URL=https://grc.acme.com
```

Redeploy after changing environment variables for the change to take effect.

---

## Rollback and Redeploy

### Instant Rollback

If a deployment introduces a bug, you can instantly roll back to the previous deployment:

1. In the Vercel dashboard, go to **Deployments**
2. Find the last good deployment
3. Click the three-dot menu → **Promote to Production**

This takes effect immediately without any rebuild.

### Redeploy Without New Code

To redeploy the current production deployment (useful when only environment variables have changed):

```bash
# Find the current deployment URL
vercel ls grc-app-ba-testing

# Redeploy it
vercel redeploy https://grc-app-ba-testing-xyz.vercel.app
```

---

## Monitoring and Logs

### Runtime Logs

View real-time function execution logs:

```bash
# Stream logs live
vercel logs grc-app-ba-testing --follow

# View logs from the last hour
vercel logs grc-app-ba-testing --since 1h

# View logs for a specific deployment
vercel logs https://grc-app-ba-testing-xyz.vercel.app
```

Logs include:
- Function execution start and end
- `console.log` / `console.error` output from API routes
- HTTP request details (method, path, status, duration)

### Vercel Analytics

Vercel provides a built-in analytics dashboard showing:
- Real user performance metrics (Core Web Vitals)
- Page load times
- API response times

Access at: **Vercel Dashboard → Analytics**

### Error Tracking

For production error monitoring beyond Vercel's built-in logs, integrate an error tracking service (Sentry, Datadog) by installing the respective SDK and configuring the DSN in environment variables.

---

*Last updated: 2026-06-29*
*Module version: GRC App — GRC-MultiTenant branch*

# Deployment Guide

## Overview

This guide explains how to deploy the GRC application to production using **Vercel** (hosting) and **Neon PostgreSQL** (database). It covers the full process from first-time setup through ongoing deployments, database management, rollbacks, and monitoring.

**Prerequisites:** You must have a working local setup (see **Local Setup** guide), and your changes must pass a local production build (`npm run build`) before you attempt to deploy.

---

## 1. What is Vercel?

### The Simple Explanation

Vercel is a cloud platform that takes your Next.js application code (from a Git repository) and runs it on servers around the world, making it accessible at a public URL. Instead of managing your own servers, configuring web servers, handling SSL certificates, or worrying about traffic scaling — Vercel does all of that automatically.

**Key characteristics:**

| Feature | What It Means for You |
|---------|----------------------|
| **Git-based deployments** | Every `git push` automatically triggers a new deployment |
| **Preview deployments** | Every pull request gets its own temporary URL for testing |
| **Global CDN** | Static files are served from data centers near each user |
| **Serverless functions** | API routes run as on-demand functions, not a persistent server |
| **Free tier** | Generous free tier suitable for development and small production apps |
| **Zero configuration** | Detects Next.js automatically; no config files needed |

### The Live URL

The GRC application is deployed at:
```
https://grc-app-ba-testing.vercel.app
```

This URL is always the latest production deployment.

---

## 2. What is Neon PostgreSQL?

### The Simple Explanation

Neon is a "serverless" PostgreSQL database service. Like Vercel for hosting, Neon manages the database server so you do not have to.

**What "serverless" means for a database:**
- The database scales to zero when not in use (no constant cost)
- It wakes up automatically when a connection is made (takes ~500ms on cold start)
- You connect to it over the internet using a standard PostgreSQL connection string
- Neon provides automatic backups, branching (like Git branches for databases), and monitoring

**Why not use SQLite in production?**
SQLite stores data as a local file. Vercel's serverless functions run in read-only file systems — they cannot write to the disk. Also, with serverless functions, each request may run on a different server, so there is no shared local file. PostgreSQL is a proper client-server database that all function instances connect to over the network.

**Project details:**
- Provider: Neon PostgreSQL
- Project name: `grc-app-ba-testing`
- Region: US East (`aws-us-east-1`)
- Free tier: 0.5GB storage limit
- Connection: `postgresql://neondb_owner:...@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require`

---

## 3. First-Time Setup

### 3.1 — Create a Vercel Account

1. Go to `https://vercel.com`
2. Click **Sign Up**.
3. Recommended: sign up with your GitHub account (this simplifies connecting your repository).
4. Choose the **Hobby** plan (free tier) when prompted.

### 3.2 — Create a Neon Account

1. Go to `https://console.neon.tech`
2. Click **Sign Up**.
3. Create a new project. Name it something like `grc-app-ba-testing`.
4. Select the region closest to your Vercel deployment (US East for this project).
5. After creation, go to **Connection Details** and copy the connection string. It looks like:
   ```
   postgresql://neondb_owner:YOUR_PASSWORD@ep-SOMETHING.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
6. Save this connection string — you will need it when configuring Vercel.

### 3.3 — Install the Vercel CLI

The Vercel CLI allows you to deploy from the command line and manage your projects.

```bash
npm install -g vercel
```

Verify the installation:
```bash
vercel --version
```

### 3.4 — Log In to Vercel CLI

```bash
vercel login
```

This opens a browser window to authenticate. After completing authentication, the CLI is linked to your Vercel account.

### 3.5 — Link the Project

Navigate to the project folder and link it to your Vercel project:

```bash
cd D:\GRC\grc-app
vercel link
```

The CLI will ask:
- **Set up and deploy?** Press Enter (yes).
- **Which scope?** Select your account or team.
- **Link to existing project?** If the project already exists on Vercel, select **yes** and choose `grc-app-ba-testing`. If it does not exist, select **no** and the CLI creates it.

This creates a `.vercel/` folder in your project with configuration files. These files are safe to commit.

---

## 4. Configuring Environment Variables in Vercel

Environment variables must be configured in the Vercel dashboard before your first deployment. The production app cannot start without them.

### Via Vercel Dashboard (Recommended)

1. Go to `https://vercel.com/dashboard`.
2. Select the **grc-app-ba-testing** project.
3. Click the **Settings** tab.
4. Click **Environment Variables** in the left sidebar.
5. Add each variable:

| Variable | Value | Environments |
|----------|-------|-------------|
| `DATABASE_URL` | Your Neon connection string | Production, Preview |
| `NEXTAUTH_SECRET` | Random 32+ char string (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) | Production, Preview |
| `NEXTAUTH_URL` | `https://grc-app-ba-testing.vercel.app` | Production |
| `ENCRYPTION_ENABLED` | `true` | Production |
| `FIELD_ENCRYPTION_KEY` | Random 32-byte base64 (same generator as above) | Production |
| `CRON_SECRET` | Random hex string | Production |
| `PYTHON_API_URL` | Your Python service URL | Production, Preview |
| `PYTHON_API_SECRET` | Your Python API secret | Production, Preview |
| `EMAIL_HOST` | Your SMTP server | Production |
| `EMAIL_PORT` | `587` | Production |
| `EMAIL_USER` | Your SMTP username | Production |
| `EMAIL_PASS` | Your SMTP password | Production |

6. Click **Save** after each variable.

### Via Vercel CLI (Alternative)

```bash
# Add each variable interactively:
vercel env add DATABASE_URL production
# Paste the value when prompted

vercel env add NEXTAUTH_SECRET production
# Paste the value when prompted

# ... repeat for each variable
```

To list all current variables:
```bash
vercel env ls
```

---

## 5. The CI/CD Pipeline (Automatic Deployments)

### What is CI/CD?

**CI/CD** stands for Continuous Integration / Continuous Deployment. It is a practice where code changes are automatically tested and deployed without manual steps.

In this project, the pipeline works as follows:

```
Developer writes code
        ↓
git add + git commit
        ↓
git push (to GitHub/GitLab)
        ↓
Vercel detects the push
        ↓
Vercel downloads the latest code
        ↓
Vercel runs: npm run i18n:generate && prisma generate && next build
        ↓
If build PASSES → deploys to production URL
If build FAILS  → deployment is aborted, previous version stays live
```

### Trigger Automatic Deployment

Simply push your code:

```bash
# Step 1: Always fetch and check status first
git fetch origin
git status

# Step 2: If behind, pull latest changes
git pull

# Step 3: Stage your changes
git add src/path/to/changed-file.tsx

# Step 4: Commit
git commit -m "Fix: correct validation in risk assessment form"

# Step 5: Push
git push
```

Within 1–3 minutes, Vercel begins building. You can monitor the progress in the Vercel dashboard.

---

## 6. CRITICAL: Run a Local Build Before Every Deployment

**This step must never be skipped.**

Before pushing code intended for production deployment, run:

```bash
npm run build
```

**Why this is critical:**

1. **Vercel runs stricter TypeScript checking** than the development server. TypeScript errors that do not cause visible problems in `npm run dev` will fail the Vercel build.
2. **Common issues caught by build:**
   - Using `null` where `undefined` is expected (TypeScript strict mode)
   - Missing required interface properties
   - Implicit `any` types
   - Prisma `select` and `include` used together (not allowed)
   - Missing i18n translation keys
3. **A failed Vercel build wastes time** — it takes 3–5 minutes to fail on Vercel. Finding the error locally takes 30 seconds.

Fix every error shown by `npm run build` before pushing.

---

## 7. Manual Deployment (Without Auto-Deploy)

If you need to deploy manually (e.g., auto-deploy is disabled or you want to deploy from a local branch):

### Using Vercel CLI

```bash
# Deploy to production
vercel --prod
```

You will see progress output:
```
Vercel CLI 34.x.x
▲ vercel --prod
? Set up and deploy "D:\GRC\grc-app"? Yes
...
Linked to omjc44-8839s-projects/grc-app-ba-testing
Inspect: https://vercel.com/omjc44-8839s-projects/grc-app-ba-testing/DEPLOYMENT_ID
✓ Production: https://grc-app-ba-testing.vercel.app [3m 12s]
```

### Deploying from a Temp Directory (If Git Author Permission Issues Occur)

If Vercel rejects the deployment due to Git author permission issues, use this workaround:

**Windows PowerShell:**
```powershell
# Step 1: Create a temp directory
Remove-Item -Recurse -Force C:\temp\grc-deploy -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path C:\temp\grc-deploy

# Step 2: Copy project files (excluding .git)
$source = "D:\GRC\grc-app"
$dest = "C:\temp\grc-deploy"
$items = @("src", "package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs", "prisma", "components.json", "public", ".vercel", "scripts", "locales", "i18n", "vercel.json")
foreach ($item in $items) {
    Copy-Item -Recurse -Force "$source\$item" "$dest\"
}

# Step 3: Deploy from temp directory
Set-Location C:\temp\grc-deploy
vercel --prod
```

**macOS/Linux:**
```bash
# Step 1: Create temp directory
rm -rf /tmp/grc-deploy
mkdir -p /tmp/grc-deploy

# Step 2: Copy files
cd /path/to/grc-app
cp -r src package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs prisma components.json public .vercel scripts locales i18n vercel.json /tmp/grc-deploy/

# Step 3: Deploy
cd /tmp/grc-deploy
vercel --prod
```

---

## 8. Database Management in Production

### 8.1 — Pushing Schema Changes to Production

When you modify `prisma/schema.prisma`, the production database must be updated to match the new schema.

**Command:**
```bash
DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx prisma db push
```

Replace `PASSWORD` with the actual Neon database password.

This command applies schema changes **non-destructively** — it adds new tables and columns but does not delete data. If you need to make breaking changes (renaming or deleting columns), follow Prisma's migration workflow with `npx prisma migrate dev` instead.

**Important:** Run this BEFORE deploying code that depends on the new schema. If you deploy code first and the schema hasn't been updated, the app will crash on queries that reference non-existent columns.

### 8.2 — Full Database Reset (Staging / Testing Only)

This command **deletes all data** and recreates the schema from scratch. Only use it in non-production environments or when you explicitly want to wipe all data.

```bash
DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx prisma db push --force-reset
```

### 8.3 — Seeding the Production Database

After a reset, reseed the database:

```bash
# Seed with the main superadmin user and sample data
DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require" npx tsx prisma/seed.ts
```

For the full BA testing dataset:
```bash
# First, seed the main data
DATABASE_URL="..." npx tsx prisma/seed.ts

# Then, seed the BTS-specific data
DATABASE_URL="..." npx tsx prisma/seed-bts.ts
```

### 8.4 — Running Database Operations Safely

| Operation | Command | Risk Level | Notes |
|-----------|---------|-----------|-------|
| Apply schema changes | `db push` | Low | Non-destructive |
| Reset all data | `db push --force-reset` | HIGH | Deletes all data |
| Seed initial data | `npx tsx prisma/seed.ts` | Low | Idempotent |
| Browse database | `prisma studio` | None | Read/write GUI |

---

## 9. Vercel CLI Reference

### Most-Used Commands

```bash
# List all deployments for the project
vercel ls grc-app-ba-testing
```
Output shows all deployments with their URLs, status, creation time, and Git branch.

```bash
# Show details about a specific deployment
vercel inspect DEPLOYMENT_URL
```

```bash
# Redeploy an existing deployment (uses cached build — no new code)
vercel redeploy DEPLOYMENT_URL
```
Use this when you want to redeploy the same code without pushing a new commit (e.g., after updating an environment variable).

```bash
# Deploy to production
vercel --prod
```

```bash
# Deploy a preview (not production)
vercel
```
This creates a preview deployment at a unique URL like `grc-app-ba-testing-HASH-omjc44.vercel.app`.

```bash
# View build logs for the latest deployment
vercel logs grc-app-ba-testing
```

```bash
# Pull production environment variables to a local .env.production.local file
vercel env pull .env.production.local
```
Useful if you want to run the app locally with production environment variables for debugging.

---

## 10. Monitoring Deployments in the Vercel Dashboard

### Viewing Deployment Status

1. Go to `https://vercel.com/dashboard`
2. Click on the **grc-app-ba-testing** project
3. The **Deployments** tab shows all deployments:
   - **Ready** (green checkmark) — deployment succeeded and is live
   - **Building** (spinning indicator) — deployment in progress
   - **Error** (red X) — deployment failed

### Viewing Build Logs

1. Click on any deployment in the list
2. Click **"View Build Logs"**
3. Scroll through the logs to find errors. TypeScript errors will appear in the build phase:
   ```
   ./src/app/(protected)/risk/page.tsx
   Type error: Property 'riskLevel' does not exist on type '{ id: string; name: string; }'
   ```
   Click the file path to see the exact error location.

### Viewing Runtime Logs (Serverless Function Logs)

1. In the Vercel dashboard, go to the project
2. Click **Functions** tab (or **Logs** tab depending on your plan)
3. You can see `console.log` output from API routes and server components

**Note:** On the free Hobby plan, runtime logs have limited retention (1 hour). For longer retention, upgrade to Pro or add a logging service.

---

## 11. Rollback Procedure

If a deployment introduces a critical bug and you need to revert to the previous version quickly:

### Option 1 — Instant Rollback via Vercel Dashboard

1. Go to the Vercel dashboard → **grc-app-ba-testing** → **Deployments**
2. Find the last known-good deployment (the one before the broken deployment)
3. Click the three-dot menu (**...**) next to that deployment
4. Click **"Promote to Production"**
5. The previous deployment becomes the live production version within seconds
6. No code changes, no rebuilding — the old build is reactivated instantly

### Option 2 — Revert via Git and Push

If you want to permanently undo the changes in your Git history:

```bash
# View recent commits to find the last good one
git log --oneline -10

# Create a revert commit (safe — does not rewrite history)
git revert HEAD
# This opens a text editor for the commit message — save and close it

# Push the revert commit
git push
```

Vercel detects the push and rebuilds from the reverted code. This takes 3–5 minutes.

---

## 12. Cron Job Configuration

The application includes a scheduled job that sends due date reminders.

### vercel.json Configuration

The cron is configured in `vercel.json`:

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

**Explanation:**
- `"path"`: The API endpoint to call on the schedule
- `"schedule"`: A cron expression in UTC time. `"0 8 * * *"` means "at 8:00 AM UTC every day"

**How cron expressions work:**
```
┌─── minute (0–59)
│  ┌── hour (0–23, UTC)
│  │  ┌─ day of month (1–31)
│  │  │  ┌ month (1–12)
│  │  │  │  ┌ day of week (0–6, Sun=0)
│  │  │  │  │
0  8  *  *  *   = 8:00 AM UTC every day
0  */6  *  *  *  = every 6 hours
0  8  *  *  1   = 8:00 AM UTC every Monday
```

**To convert to your local timezone:** 8:00 AM UTC = 1:30 PM IST (UTC+5:30).

### How Vercel Runs the Cron

When the scheduled time arrives:
1. Vercel makes an HTTP GET request to `https://grc-app-ba-testing.vercel.app/api/cron/due-reminders`
2. The request includes the header `Authorization: Bearer <CRON_SECRET>`
3. The API route verifies the secret, then sends email reminders for items due in the next 24 hours
4. The API route returns a 200 response with a JSON summary

### Testing the Cron Locally

```bash
# No auth required in development mode
curl http://localhost:3000/api/cron/due-reminders

# With auth header (if CRON_SECRET is set in .env.local)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/due-reminders
```

### Checking Cron Run History

In the Vercel dashboard, go to **Functions** → **Cron Jobs** to see:
- When the cron last ran
- Whether it succeeded or failed
- The response it returned

---

## 13. Production Build Checklist

Before every production deployment, work through this checklist:

**Code Quality:**
- [ ] `npm run build` completes with no errors
- [ ] `npm run lint` shows no errors (warnings are acceptable)
- [ ] All new TypeScript types are explicit (no `any` where it can be avoided)

**Database:**
- [ ] If `prisma/schema.prisma` was modified: run `npx prisma db push` on the Neon database before deploying
- [ ] If new seed data is needed: run the seed script on Neon

**Environment Variables:**
- [ ] All new environment variables are added to the Vercel dashboard
- [ ] `NEXTAUTH_URL` is set to the production URL (not localhost)
- [ ] `ENCRYPTION_ENABLED` is set to `"true"` in production

**Testing:**
- [ ] Core login flow works locally
- [ ] The affected module(s) work correctly locally
- [ ] E2E tests pass (`npm run test:e2e`) — especially for changed features

**Git:**
- [ ] Pulled the latest changes (`git pull`) before committing
- [ ] No `.env` files accidentally staged (`git status` check)
- [ ] Commit message is descriptive

**Post-deployment verification:**
- [ ] Check the Vercel deployment dashboard — status is "Ready"
- [ ] Log in at `https://grc-app-ba-testing.vercel.app` with `superadmin` / `1`
- [ ] Navigate to the affected module and verify the feature works
- [ ] Check Vercel logs for unexpected errors in the first few minutes

---

## 14. Vercel Project Details

| Detail | Value |
|--------|-------|
| Project name | `grc-app-ba-testing` |
| Vercel scope | `omjc44-8839s-projects` |
| Production URL | `https://grc-app-ba-testing.vercel.app` |
| Git branch (production) | `GRC-MultiTenant` (main branch) |
| Framework | Next.js (auto-detected by Vercel) |
| Build command | `npm run i18n:generate && prisma generate && next build` |
| Output directory | `.next` (auto-detected) |

---

## 15. Key Differences: Local vs. Production

| Aspect | Local Development | Production (Vercel) |
|--------|------------------|-------------------|
| Database | SQLite (`prisma/dev.db`) | Neon PostgreSQL |
| URL | `http://localhost:3000` | `https://grc-app-ba-testing.vercel.app` |
| Encryption | Disabled (`ENCRYPTION_ENABLED=false`) | Enabled (`ENCRYPTION_ENABLED=true`) |
| Hot reload | Yes | No |
| Error details | Full stack traces in browser | Generic error messages |
| Environment | `.env.local` file | Vercel dashboard environment variables |
| Server | Persistent Node.js process | Serverless functions (scale to zero) |
| File system | Read-write | Read-only |

---

## 16. Troubleshooting Common Deployment Errors

### "Build failed: Type error"

Read the build log carefully. Fix the TypeScript error locally, run `npm run build` again to confirm it is fixed, then push again.

### "Application error: a server-side exception has occurred"

Check the Vercel Function logs. The error message in the log will identify the exact issue. Common causes:
- Missing environment variable in production
- Database connection failure (wrong `DATABASE_URL`)
- Code that works locally but fails in the serverless environment

### "404 Not Found" for API Routes

Verify the file exists in `src/app/api/...` and is named `route.ts`. Check the Vercel build logs to confirm the route was included in the build.

### Deployment Seems Stuck at "Building"

Vercel builds usually take 3–5 minutes. If it takes more than 15 minutes, it may have hung. Cancel the deployment in the dashboard and retry.

### Environment Variable Not Picked Up

After adding or changing an environment variable in the Vercel dashboard, you must trigger a new deployment for it to take effect. Vercel does NOT hot-reload environment variables. Use **Redeploy** in the dashboard or push a commit.

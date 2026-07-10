# Cron Jobs (Scheduled Tasks)

## Table of Contents

1. [What is a Cron Job?](#what-is-a-cron-job)
2. [Cron Syntax Explained](#cron-syntax-explained)
3. [How Vercel Cron Works](#how-vercel-cron-works)
4. [vercel.json Configuration](#verceljson-configuration)
5. [All 7 Cron Jobs](#all-7-cron-jobs)
6. [Due Reminders Deep Dive](#due-reminders-deep-dive)
7. [CRON_SECRET Authentication](#cron_secret-authentication)
8. [Local Testing](#local-testing)
9. [How to Add a New Cron Job](#how-to-add-a-new-cron-job)
10. [Monitoring and Logging](#monitoring-and-logging)

---

## What is a Cron Job?

A **cron job** is a task that runs automatically at a scheduled time, without any human clicking a button. Think of it like a kitchen timer: you set it once, and it goes off at the same time every day (or every hour, every Monday, etc.).

### Why Applications Need Cron Jobs

Most web application logic is **reactive** — it runs only when a user performs an action (clicks a button, submits a form). But some business logic needs to run on a schedule regardless of user activity:

- **Send reminder emails** before deadlines pass.
- **Escalate overdue items** to managers when nobody acted in time.
- **Check SLA timers** on support tickets.
- **Trigger periodic reassessments** of risks and controls.

Without cron jobs, these tasks would simply never happen unless a user manually triggered them.

### The Clock Analogy

Imagine a wall clock with an alarm. The alarm is set to ring at 8:00 AM every day. When it rings, someone (the cron system) knocks on the application's door (makes an HTTP request) and says "time to run the daily reminders." The application wakes up, does its work, and goes back to sleep until the next alarm.

---

## Cron Syntax Explained

Cron schedules use a compact notation with five fields separated by spaces:

```
┌───────── minute (0–59)
│ ┌───────── hour (0–23, UTC)
│ │ ┌───────── day of month (1–31)
│ │ │ ┌───────── month (1–12)
│ │ │ │ ┌───────── day of week (0–7, 0=Sunday, 7=Sunday)
│ │ │ │ │
* * * * *
```

### Reading the Schedule Examples

| Expression | Meaning |
|-----------|---------|
| `0 8 * * *` | Every day at 08:00 UTC |
| `0 9 * * *` | Every day at 09:00 UTC |
| `0 1 * * *` | Every day at 01:00 UTC (1am) |
| `0 7 * * *` | Every day at 07:00 UTC |
| `*/15 * * * *` | Every 15 minutes, all day |
| `0 8 * * 1` | Every Monday at 08:00 UTC |
| `0 0 1 * *` | First day of every month at midnight |

### The `*` Wildcard

An asterisk `*` means "every valid value". So `* * * * *` means "every minute of every hour of every day". The cron string `0 8 * * *` reads: "at minute 0, hour 8, every day of the month, every month, every day of the week" — which means daily at 8:00 AM UTC.

### The `*/N` Step Syntax

`*/15` in the minutes field means "every 15 minutes". The system reads it as "start at 0, then step by 15": runs at :00, :15, :30, :45 of every hour.

---

## How Vercel Cron Works

Vercel Cron is a feature of the Vercel hosting platform that:

1. Reads the cron schedule definitions from `vercel.json` when you deploy.
2. Maintains an internal scheduler that fires at the defined intervals.
3. Makes an **HTTP GET request** to the specified path (e.g., `GET /api/cron/due-reminders`) on your deployed application.
4. Your API route handler runs, performs its work, and returns a JSON response.
5. Vercel logs whether the request succeeded or failed.

### Important Characteristics

- Cron requests come from Vercel's infrastructure, not from a real user browser. They do not have a session cookie.
- Cron jobs run in **UTC time zone**. Factor this in when planning local-time schedules.
- Vercel Free tier supports up to 2 cron jobs. The Pro tier supports more. The project uses a Pro plan or equivalent for all 7 jobs.
- Cron jobs do not run when the app is not deployed (e.g., during a build failure).
- A cron invocation has a maximum execution time (typically 10–15 seconds on serverless; up to 5 minutes on Pro). Long-running jobs must be efficient.

---

## vercel.json Configuration

The cron schedule is defined in `vercel.json` at the project root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/due-reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/escalation",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/cadence-reassessment",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/remediation-reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/subscription-alerts",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/plan-transitions",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/cron/ticket-sla",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Each entry has:
- `path` — The URL path that Vercel will call. Must be a valid API route in the application.
- `schedule` — A standard cron expression in UTC.

---

## All 7 Cron Jobs

### 1. Due Date Reminders — `/api/cron/due-reminders`

**Schedule:** `0 8 * * *` — Daily at 08:00 UTC (approx. 10:00 AM in BST / 4:00 AM in US Eastern)

**Purpose:** Scan the database for items due within the next 24 hours and send reminder notifications to responsible users.

**What it processes:**
1. Evidence items due tomorrow (not yet approved) — sends `EVIDENCE_DUE_REMINDER` to assignee.
2. CAPA actions due tomorrow (not yet completed) — sends `CAPA_DUE_REMINDER` to responsible person.
3. Policy/governance document reviews due tomorrow — sends `REVIEW_DUE_REMINDER` to assignee.
4. TPRM vendor remediations due tomorrow — sends `TPRM_REMEDIATION_DUE` to vendor contact.
5. TPRM vendor contracts expiring — sends `TPRM_CONTRACT_EXPIRY` to relationship owner.
6. TPRM vendor assessments due — sends `TPRM_ASSESSMENT_DUE` to assessor.
7. TPRM SME reviews due — sends `TPRM_SME_REMINDER` to SME.

**Counts returned:**
```json
{
  "success": true,
  "counts": {
    "evidence": 3,
    "capa": 1,
    "review": 2,
    "tprmRemediation": 0,
    "tprmContract": 1,
    "tprmAssessment": 0,
    "tprmSme": 0
  },
  "errors": []
}
```

See [Due Reminders Deep Dive](#due-reminders-deep-dive) for full implementation details.

---

### 2. Risk and Issue Escalation — `/api/cron/escalation`

**Schedule:** `0 9 * * *` — Daily at 09:00 UTC

**Purpose:** Automatically escalate risks and issues that have remained unresolved beyond their configured escalation thresholds.

**Logic:**
- Queries risks with `status = 'Open'` whose `dueDate` has passed and have not been escalated yet.
- Moves escalation state to the next level (e.g., Analyst → Manager → Director).
- Sends `RISK_ESCALATED` notification to the new responsible person.
- Also handles issue escalation for items in the issue register.

**Business Rule Example:**
- A High-severity risk unaddressed for 7 days escalates to the Risk Manager.
- A Critical risk unaddressed for 3 days escalates to the CISO.
- Thresholds are configurable per tenant via escalation configuration settings.

**Escalation config location:** `src/app/api/internal-audit/escalation-config/`

---

### 3. Audit Plan Transitions — `/api/cron/plan-transitions`

**Schedule:** `0 1 * * *` — Daily at 01:00 UTC (runs overnight, off-peak)

**Purpose:** Automatically advance audit plans and operational plans to the next stage when their scheduled dates are reached.

**What it does:**
- Checks `AuditOperationalPlan` records with `status = 'Draft'` whose planned start date has arrived — transitions them to `Active`.
- Checks `AuditStrategicPlan` records for year-boundary transitions.
- Handles auto-archiving of plans that have passed their end date.
- Sends notifications to Audit Heads and Audit Managers when plan status changes.

**Why it runs at 1:00 AM:** Plan transitions are low-urgency and non-interactive. Running at 1:00 AM minimises overlap with the 7:00–9:00 AM cluster of other cron jobs and avoids peak user traffic hours.

---

### 4. TPRM Remediation Reminders — `/api/cron/remediation-reminders`

**Schedule:** `0 8 * * *` — Daily at 08:00 UTC

**Purpose:** Send targeted reminders to third-party vendors and internal relationship owners about pending remediation actions from vendor risk assessments.

**What it processes:**
- TPRM remediation items with `dueDate` within the next 48 hours.
- Sends reminder emails to the internal owner and (if configured) the vendor contact.
- Escalates overdue remediation items to the vendor risk programme manager.

**Note:** This is separate from `due-reminders` because TPRM remediations have a different escalation path and require sending emails to external parties (vendors), not just internal users.

---

### 5. Subscription Alerts — `/api/cron/subscription-alerts`

**Schedule:** `0 9 * * *` — Daily at 09:00 UTC

**Purpose:** Monitor subscription expiry dates and send proactive alerts to Customer Administrators before licences lapse.

**Alert timeline:**
- **60 days before expiry:** Informational notice sent to Customer Admin.
- **30 days before expiry:** Warning notice with renewal instructions.
- **14 days before expiry:** Urgent warning escalated to both Customer Admin and GRC Administrator.
- **7 days before expiry:** Critical alert; access may be suspended.
- **On expiry:** `SUBSCRIPTION_EXPIRED` notification; account is flagged.

**Subscription models:**
- Module-based subscriptions (tracked in the `Subscription` table).
- Legacy plan overrides (`CustomerPlanOverride` table).
- Both are checked.

---

### 6. Ticket SLA Tracking — `/api/cron/ticket-sla`

**Schedule:** `*/15 * * * *` — Every 15 minutes, 24 hours a day

**Purpose:** This is the highest-frequency cron job. It continuously monitors open support tickets against their SLA (Service Level Agreement) response and resolution deadlines.

**What it does:**
- Fetches all `Open` and `In Progress` support tickets.
- Calculates elapsed time since creation or last activity.
- Checks against the SLA tier defined for the ticket priority (Critical, High, Medium, Low).
- Sends `TICKET_SLA_BREACH` notification if an SLA deadline passes.
- Updates the ticket's `slaBreach` flag in the database.

**Why 15 minutes?** SLA breaches need to be detected quickly (within the same working hour). Checking every 15 minutes gives adequate responsiveness without hammering the database. This frequency is acceptable because the query is indexed on `status` and `slaDeadline`.

---

### 7. Cadence Reassessment — `/api/cron/cadence-reassessment`

**Schedule:** `0 7 * * *` — Daily at 07:00 UTC (first job of the morning cluster)

**Purpose:** Trigger periodic reassessment workflows for risks, controls, and assets based on their configured reassessment cadence (monthly, quarterly, annually).

**What it does:**
- Queries risks where `nextAssessmentDate <= today` and `status != 'Under Review'`.
- Creates a new `RiskAssessment` record and sets the risk status to `Pending Review`.
- Notifies the risk owner that a reassessment is due.
- Does the same for `Evidence` items with overdue periodic review dates.
- Queues asset reviews for assets whose `nextReviewDate` has arrived.

**Cadence values:** Configurable per record. Common values: `Monthly`, `Quarterly`, `BiAnnual`, `Annual`.

---

## Due Reminders Deep Dive

This section provides full implementation details for the most complex cron job.

### Processing Flow

```
GET /api/cron/due-reminders
        |
        v
Authenticate (CRON_SECRET check)
        |
        v
startCronRun() → logs run start to CronRunLog table
        |
        v
Calculate date range: today 00:00 UTC → tomorrow 23:59 UTC
        |
        ┌─────────────────────────────────────────┐
        │  Process each category independently:  │
        │  1. Evidence                            │
        │  2. CAPA (Internal Audit)               │
        │  3. Policy Reviews                      │
        │  4. TPRM Remediation                    │
        │  5. TPRM Contracts                      │
        │  6. TPRM Assessments                    │
        │  7. TPRM SME Reviews                    │
        └─────────────────────────────────────────┘
        |
        | (for each item in each category)
        v
notificationService.sendNotification(...)
  → Creates Notification row (in-app)
  → Sends email via Nodemailer (if configured)
        |
        v
finishCronRun() → logs run completion, total counts, errors
        |
        v
Return JSON response with counts and errors
```

### Error Tracking Per Entity

Each notification is attempted independently. A single failure does not stop the batch:

```typescript
const errors: ReminderError[] = [];

for (const evidence of evidencesDueSoon) {
  try {
    await notificationService.sendNotification({ ... });
    counts.evidence++;
  } catch (err) {
    errors.push({
      entityType: 'Evidence',
      entityId: evidence.id,
      error: String(err),
    });
  }
}
```

This pattern ensures that if one user's email address is invalid, the remaining 99 notifications still go out. Errors are collected and included in:
- The JSON response body.
- The `CronRunLog` database record for post-run analysis.

### Multi-Channel Delivery

Each reminder fires both channels:
- **In-app notification** — created in the `Notification` table.
- **Email notification** — sent via the tenant's SMTP configuration.

If a tenant has no SMTP settings configured, the in-app notification is still created and email is silently skipped.

### Cron Run Logging

The `startCronRun()` and `finishCronRun()` functions (from `src/lib/cron-logger.ts`) write to a `CronRunLog` table:

```prisma
model CronRunLog {
  id            String    @id @default(cuid())
  taskFunction  String    // e.g., "due-reminders"
  name          String    // Human-readable name
  schedule      String    // Cron expression
  triggeredBy   String    // "schedule" or "manual"
  startedAt     DateTime  @default(now())
  finishedAt    DateTime?
  status        String    // "running", "success", "error"
  counts        Json?     // { evidence: 3, capa: 1, ... }
  errors        Json?     // Array of error objects
  durationMs    Int?      // Total execution time
}
```

This table is queryable in Prisma Studio or via admin API routes for monitoring purposes.

---

## CRON_SECRET Authentication

### Why It Matters

Cron endpoints are HTTP routes. Without authentication, anyone who knows the URL could trigger them at will — potentially flooding users with notifications or causing expensive database operations.

### How It Works

1. Set the `CRON_SECRET` environment variable in Vercel (or your `.env` file).
2. Each cron handler checks the `Authorization` header:

```typescript
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... proceed with cron logic
}
```

3. Vercel automatically injects the `Authorization: Bearer <CRON_SECRET>` header when it triggers cron jobs.

### Setting the Secret

In Vercel dashboard: **Project → Settings → Environment Variables → Add `CRON_SECRET`**

Generate a strong random value:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

In local `.env`:
```env
CRON_SECRET=your-random-secret-here
```

If `CRON_SECRET` is not set, the check is skipped (useful in development where you want to test freely).

---

## Local Testing

### Testing Without Authentication (Development)

In local development, `CRON_SECRET` is typically unset, so any GET request works:

```bash
# Test due reminders
curl http://localhost:3000/api/cron/due-reminders

# Test escalation
curl http://localhost:3000/api/cron/escalation

# Test subscription alerts
curl http://localhost:3000/api/cron/subscription-alerts

# Test ticket SLA
curl http://localhost:3000/api/cron/ticket-sla

# Test cadence reassessment
curl http://localhost:3000/api/cron/cadence-reassessment

# Test plan transitions
curl http://localhost:3000/api/cron/plan-transitions

# Test TPRM remediation reminders
curl http://localhost:3000/api/cron/remediation-reminders
```

### Testing With the Secret Set

```bash
curl -H "Authorization: Bearer your-cron-secret" \
  https://grc-app-ba-testing.vercel.app/api/cron/due-reminders
```

### Marking a Manual Trigger

When testing manually, pass `x-triggered-by: manual` so the cron log records the correct trigger source:

```bash
curl -H "x-triggered-by: manual" http://localhost:3000/api/cron/due-reminders
```

### Checking Results

The cron response includes processing counts and any errors:

```json
{
  "success": true,
  "message": "Due date reminders processed successfully",
  "counts": {
    "evidence": 2,
    "capa": 0,
    "review": 1,
    "tprmRemediation": 0,
    "tprmContract": 0,
    "tprmAssessment": 0,
    "tprmSme": 0
  },
  "errors": [],
  "runId": "clx_cron_run_abc123"
}
```

---

## How to Add a New Cron Job

Follow these steps to add a new scheduled task:

### Step 1: Create the API Route

Create the file `src/app/api/cron/my-new-task/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { startCronRun, finishCronRun } from '@/lib/cron-logger';

export async function GET(req: NextRequest) {
  // Authenticate
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const triggeredBy = req.headers.get('x-triggered-by') === 'manual' ? 'manual' : 'schedule';
  const runId = await startCronRun({
    taskFunction: 'my-new-task',
    name: 'My New Scheduled Task',
    schedule: '0 10 * * *',
    triggeredBy,
  });

  const counts = { processed: 0 };
  const errors: Array<{ entityType: string; entityId: string; error: string }> = [];

  try {
    // --- YOUR LOGIC HERE ---
    const items = await prisma.someModel.findMany({ where: { /* filter */ } });

    for (const item of items) {
      try {
        // process item
        counts.processed++;
      } catch (err) {
        errors.push({ entityType: 'SomeModel', entityId: item.id, error: String(err) });
      }
    }
    // --- END YOUR LOGIC ---
  } catch (err) {
    await finishCronRun(runId, 'error', counts, errors);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }

  await finishCronRun(runId, 'success', counts, errors);
  return NextResponse.json({ success: true, counts, errors });
}
```

### Step 2: Add to vercel.json

```json
{
  "crons": [
    { "path": "/api/cron/my-new-task", "schedule": "0 10 * * *" },
    // ... existing entries
  ]
}
```

### Step 3: Test Locally

```bash
curl http://localhost:3000/api/cron/my-new-task
```

### Step 4: Deploy

```bash
git add vercel.json src/app/api/cron/my-new-task/route.ts
git commit -m "Add my-new-task cron job"
git push
```

Vercel will pick up the new cron definition from `vercel.json` on the next deployment.

---

## Monitoring and Logging

### CronRunLog Table

All cron runs are persisted in the `CronRunLog` table. Query it in Prisma Studio:

```bash
npx prisma studio
# Navigate to CronRunLog table
# Filter by taskFunction, sort by startedAt DESC
```

### Vercel Cron Dashboard

In the Vercel project dashboard:
1. Go to **Project → Cron Jobs** tab.
2. See the last run time and status for each cron job.
3. Click a job to see its execution log.

### Alerts for Cron Failures

If a cron job returns a non-200 HTTP status, Vercel records it as a failure. Set up Vercel's alerting (or an external uptime monitor like BetterUptime) to notify on consecutive failures.

### Response Time Expectations

| Cron Job | Expected Duration |
|----------|-----------------|
| `due-reminders` | 2–10 seconds (depends on tenant count and item volume) |
| `escalation` | 1–5 seconds |
| `plan-transitions` | 1–3 seconds |
| `remediation-reminders` | 2–8 seconds |
| `subscription-alerts` | 1–2 seconds |
| `ticket-sla` | < 1 second (small query, runs often) |
| `cadence-reassessment` | 3–15 seconds (may create many reassessment records) |

If a cron job consistently exceeds 10 seconds, investigate query performance and add database indexes.

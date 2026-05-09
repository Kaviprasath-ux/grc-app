/**
 * In-process cron scheduler.
 *
 * DigitalOcean App Platform has no native cron, and vercel.json is ignored
 * outside Vercel. This module registers all daily background jobs as
 * in-process cron tasks via node-cron. Each task hits the matching
 * /api/cron/* endpoint over loopback HTTP — same code path the route would
 * see from any external scheduler.
 *
 * Wired in src/instrumentation.ts so it runs once on server boot.
 *
 * Schedules use UTC (timezone option). Match what was previously declared in
 * vercel.json so behaviour is identical to a Vercel deploy.
 *
 * Caveats:
 *   - Multi-instance: every instance would run its own schedule. If DO scales
 *     above 1 web instance, add a per-job DB advisory lock here. Today the
 *     web component runs single-instance.
 *   - Dev HMR: instrumentation.ts may re-execute on hot reload. The
 *     module-level `initialized` flag prevents double-registration.
 */

import cron, { type ScheduledTask } from "node-cron";

interface JobSpec {
  name: string;
  path: string; // /api/cron/...
  schedule: string; // standard cron expression
}

const JOBS: JobSpec[] = [
  { name: "due-reminders",          path: "/api/cron/due-reminders",          schedule: "0 8 * * *" },
  { name: "escalation",             path: "/api/cron/escalation",             schedule: "0 9 * * *" },
  { name: "cadence-reassessment",   path: "/api/cron/cadence-reassessment",   schedule: "0 7 * * *" },
  { name: "remediation-reminders",  path: "/api/cron/remediation-reminders",  schedule: "0 8 * * *" },
  { name: "subscription-alerts",    path: "/api/cron/subscription-alerts",    schedule: "0 9 * * *" },
  { name: "plan-transitions",       path: "/api/cron/plan-transitions",       schedule: "0 1 * * *" },
];

let initialized = false;
const tasks: ScheduledTask[] = [];

function appBaseUrl(): string {
  // In the running container, hit ourselves on loopback. PORT is set by DO.
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}

async function fireJob(job: JobSpec): Promise<void> {
  const url = `${appBaseUrl()}${job.path}`;
  const headers: Record<string, string> = {};
  if (process.env.CRON_SECRET) {
    headers["Authorization"] = `Bearer ${process.env.CRON_SECRET}`;
  }
  headers["x-triggered-by"] = "schedule";

  const startedAt = Date.now();
  try {
    const res = await fetch(url, { method: "GET", headers });
    const ms = Date.now() - startedAt;
    if (!res.ok) {
      const body = await res.text().catch(() => "<unreadable>");
      console.error(`[CronScheduler] ${job.name} failed (${res.status}) in ${ms}ms: ${body.slice(0, 200)}`);
      return;
    }
    console.log(`[CronScheduler] ${job.name} ok in ${ms}ms`);
  } catch (e) {
    const ms = Date.now() - startedAt;
    console.error(`[CronScheduler] ${job.name} threw after ${ms}ms:`, (e as Error).message);
  }
}

export function startCronScheduler(): void {
  if (initialized) {
    console.log("[CronScheduler] Already initialized — skipping");
    return;
  }
  initialized = true;

  for (const job of JOBS) {
    const task = cron.schedule(
      job.schedule,
      () => { void fireJob(job); },
      { timezone: "UTC" }
    );
    tasks.push(task);
    console.log(`[CronScheduler] Registered ${job.name} on '${job.schedule}' UTC`);
  }
  console.log(`[CronScheduler] ${JOBS.length} jobs armed.`);
}

/**
 * Used by tests + graceful shutdown — stops every registered task.
 */
export function stopCronScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  initialized = false;
}

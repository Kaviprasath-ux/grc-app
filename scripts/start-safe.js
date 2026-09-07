"use strict";
/**
 * Boot script for DigitalOcean.
 *
 * Runs `prisma db push --skip-generate` (schema sync) with a hard
 * timeout, then unconditionally launches `next start`. If the schema
 * sync fails or hangs, we still boot Next.js — a schema drift is
 * degraded state, not "container dead". DO's health check on
 * `/api/health` will see 200 the moment Next.js binds the port, which
 * is what the check is actually asking.
 *
 * Prior behavior chained the two with `&&`, so a slow/refused
 * `db push` on Neon Postgres (destructive-change refusal, cold-start
 * latency, transient auth) meant the container never got to
 * `next start` and DO reported "container did not respond to health
 * checks" — which is exactly the deploy failure we just spent time
 * chasing.
 */

const { spawnSync, spawn } = require("child_process");

const DB_PUSH_TIMEOUT_MS = 60_000;

function runDbPush() {
  console.log(`[start-safe] prisma db push --skip-generate (timeout ${DB_PUSH_TIMEOUT_MS}ms)`);
  const started = Date.now();
  const result = spawnSync(
    "npx",
    ["prisma", "db", "push", "--skip-generate"],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      timeout: DB_PUSH_TIMEOUT_MS,
    },
  );
  const elapsed = Date.now() - started;

  if (result.error) {
    console.warn(`[start-safe] db push errored after ${elapsed}ms: ${result.error.message}. Continuing to next start.`);
    return;
  }
  if (result.signal) {
    console.warn(`[start-safe] db push killed by signal ${result.signal} after ${elapsed}ms. Continuing to next start.`);
    return;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    console.warn(`[start-safe] db push exited ${result.status} after ${elapsed}ms. Continuing to next start.`);
    return;
  }
  console.log(`[start-safe] db push OK in ${elapsed}ms.`);
}

function runNextStart() {
  console.log("[start-safe] next start");
  const child = spawn("npx", ["next", "start"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`[start-safe] next start killed by ${signal}`);
      process.exit(1);
    }
    process.exit(code == null ? 0 : code);
  });
  const forward = (sig) => {
    try { child.kill(sig); } catch { /* noop */ }
  };
  process.on("SIGINT", () => forward("SIGINT"));
  process.on("SIGTERM", () => forward("SIGTERM"));
}

runDbPush();
runNextStart();

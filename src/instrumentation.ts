/**
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * Used here to start the in-process cron scheduler. The scheduler then keeps
 * the event loop occupied with timers; node-cron handles the per-minute tick.
 *
 * Edge runtime is intentionally not handled — schedulers don't make sense in
 * an edge worker (no long-lived process).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Skip during `next build` so the build step doesn't spin up a scheduler
  // that gets immediately torn down.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Dynamic import so the cron deps don't pull into the edge bundle.
  const { startCronScheduler } = await import("./lib/cron-scheduler");
  startCronScheduler();
}

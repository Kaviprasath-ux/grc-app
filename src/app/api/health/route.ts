import { NextResponse } from 'next/server';

/**
 * Boot-safe health check for DigitalOcean.
 *
 * Returns 200 immediately with no database or third-party calls. The
 * container is "healthy" the moment Next.js can serve HTTP — that is
 * exactly what DO's health check is asking. Anything heavier here
 * (Prisma probe, session read, filesystem stat) risks the same
 * "container did not respond to health checks" failure this endpoint
 * exists to prevent.
 *
 * Configure DO's HTTP health check to hit `/api/health` on the app's
 * public port. Default DO health-check behavior — pinging `/` — reaches
 * a route that redirects unauthenticated traffic to /login and may not
 * count as healthy on all DO plans.
 *
 * force-dynamic tells Next not to try to precompile a static response
 * (it can't, we generate the timestamp per-call), so the endpoint
 * behaves the same on cold boot as on warm ones.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json(
    { ok: true, service: 'grc-app', now: new Date().toISOString() },
    { status: 200 },
  );
}

export function HEAD() {
  return new NextResponse(null, { status: 200 });
}

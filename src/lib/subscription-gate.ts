/**
 * API-level subscription gate for handlers that need to enforce read-only
 * mode during GRACE_PERIOD or block writes when SUSPENDED.
 *
 * Middleware handles the UI redirect for SUSPENDED, but middleware excludes
 * `/api/*` from its matcher (intentional — APIs run their own auth via
 * withAuth). Module APIs that mutate data should call this helper to prevent
 * direct API access from bypassing the read-only restriction.
 *
 * Usage:
 *   export const POST = withAuth(async (req, ctx, session) => {
 *     const gate = await checkSubscriptionGate(session, "write");
 *     if (!gate.allowed) return gate.response;
 *     // ... handler body
 *   }, { resource: "...", action: "create" });
 *
 * No-op when SUBSCRIPTION_GATING_ENABLED=false.
 */

import { NextResponse } from "next/server";
import { getAccessSnapshot } from "@/lib/module-access";

const SUBSCRIPTION_GATING_ENABLED = process.env.SUBSCRIPTION_GATING_ENABLED === "true";

export interface GateResult {
  allowed: boolean;
  response?: NextResponse;
}

/**
 * Check whether the session can perform the requested op.
 *   intent="read"  → only blocks SUSPENDED
 *   intent="write" → blocks SUSPENDED *and* GRACE_PERIOD (read-only)
 *
 * Bypassed entirely when feature flag is off (preserves current behavior).
 */
export async function checkSubscriptionGate(
  session: { customerAccountId?: string | null; subscriptionStatus?: string | null },
  intent: "read" | "write" = "write",
): Promise<GateResult> {
  if (!SUBSCRIPTION_GATING_ENABLED) return { allowed: true };
  if (!session.customerAccountId) return { allowed: true }; // System users (no customer)

  // Prefer the JWT-cached status (avoids a DB round-trip per request).
  // Fall back to a fresh read if the field hasn't been populated yet.
  let status = session.subscriptionStatus ?? null;
  if (!status) {
    try {
      const snap = await getAccessSnapshot(session.customerAccountId);
      status = snap.subscriptionStatus;
    } catch {
      return { allowed: true }; // Defensive: don't lock people out on a DB blip
    }
  }

  if (status === "SUSPENDED") {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Subscription suspended. Renew to restore access.", subscriptionStatus: status },
        { status: 402 }
      ),
    };
  }

  if (intent === "write" && status === "GRACE_PERIOD") {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Subscription expired — read-only mode. Renew to restore write access.", subscriptionStatus: status },
        { status: 402 }
      ),
    };
  }

  return { allowed: true };
}

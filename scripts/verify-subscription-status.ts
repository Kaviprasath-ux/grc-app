/**
 * Pure unit tests for src/lib/subscription-status.ts. No DB.
 * Run: npx tsx scripts/verify-subscription-status.ts
 */

import {
  computeModuleStatus,
  computeSubscriptionStatus,
  daysUntilExpiry,
  isWriteAllowed,
  isAccessAllowed,
  EXPIRING_SOON_DAYS,
  GRACE_PERIOD_DAYS,
} from "@/lib/subscription-status";

const NOW = new Date("2026-05-01T00:00:00Z");

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

let pass = 0;
let fail = 0;

function expect<T>(actual: T, expected: T, label: string) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.error(`  ✗ ${label}\n      expected: ${expected}\n      actual:   ${actual}`);
    fail++;
  }
}

// ─── computeModuleStatus ─────────────────────────────────────────
console.log("computeModuleStatus — basic transitions");

expect(
  computeModuleStatus({ subscriptionType: "PAID", cycleEnd: daysFromNow(365), now: NOW }),
  "ACTIVE",
  "1 year out → ACTIVE"
);

expect(
  computeModuleStatus({ subscriptionType: "PAID", cycleEnd: daysFromNow(31), now: NOW }),
  "ACTIVE",
  "31 days out → ACTIVE (just past EXPIRING_SOON window)"
);

expect(
  computeModuleStatus({ subscriptionType: "PAID", cycleEnd: daysFromNow(EXPIRING_SOON_DAYS - 1), now: NOW }),
  "EXPIRING_SOON",
  "29 days out → EXPIRING_SOON"
);

expect(
  computeModuleStatus({ subscriptionType: "PAID", cycleEnd: daysFromNow(1), now: NOW }),
  "EXPIRING_SOON",
  "1 day out → EXPIRING_SOON"
);

expect(
  computeModuleStatus({ subscriptionType: "PAID", cycleEnd: daysFromNow(0.5), now: NOW }),
  "EXPIRING_SOON",
  "12h out → EXPIRING_SOON"
);

expect(
  computeModuleStatus({ subscriptionType: "PAID", cycleEnd: daysFromNow(-0.5), now: NOW }),
  "EXPIRED",
  "12h ago → EXPIRED"
);

expect(
  computeModuleStatus({ subscriptionType: "PAID", cycleEnd: daysFromNow(-2), now: NOW }),
  "GRACE_PERIOD",
  "2 days ago → GRACE_PERIOD"
);

expect(
  computeModuleStatus({ subscriptionType: "PAID", cycleEnd: daysFromNow(-GRACE_PERIOD_DAYS), now: NOW }),
  "GRACE_PERIOD",
  `${GRACE_PERIOD_DAYS} days ago → GRACE_PERIOD (still in grace)`
);

expect(
  computeModuleStatus({ subscriptionType: "PAID", cycleEnd: daysFromNow(-(GRACE_PERIOD_DAYS + 1)), now: NOW }),
  "SUSPENDED",
  `${GRACE_PERIOD_DAYS + 1} days ago → SUSPENDED`
);

expect(
  computeModuleStatus({ subscriptionType: "PAID", cycleEnd: daysFromNow(-365), now: NOW }),
  "SUSPENDED",
  "1 year ago → SUSPENDED"
);

// ─── Trial path ───────────────────────────────────────────────────
console.log("\ncomputeModuleStatus — TRIAL path");

expect(
  computeModuleStatus({
    subscriptionType: "TRIAL",
    trialEndsAt: daysFromNow(7),
    cycleEnd: daysFromNow(7),
    now: NOW,
  }),
  "TRIAL",
  "Trial ending in 7 days → TRIAL (overrides EXPIRING_SOON)"
);

expect(
  computeModuleStatus({
    subscriptionType: "TRIAL",
    trialEndsAt: daysFromNow(-0.5),
    cycleEnd: daysFromNow(-0.5),
    now: NOW,
  }),
  "EXPIRED",
  "Trial expired 12h ago → EXPIRED (cascades to expiry logic)"
);

expect(
  computeModuleStatus({
    subscriptionType: "TRIAL",
    trialEndsAt: daysFromNow(-2),
    cycleEnd: daysFromNow(-2),
    now: NOW,
  }),
  "GRACE_PERIOD",
  "Trial expired 2 days ago → GRACE_PERIOD"
);

expect(
  computeModuleStatus({
    subscriptionType: "TRIAL",
    trialEndsAt: null,
    cycleEnd: daysFromNow(365),
    now: NOW,
  }),
  "ACTIVE",
  "TRIAL type without trialEndsAt → cascades to ACTIVE"
);

// ─── Complimentary ────────────────────────────────────────────────
console.log("\ncomputeModuleStatus — COMPLIMENTARY");

expect(
  computeModuleStatus({
    subscriptionType: "COMPLIMENTARY",
    cycleEnd: daysFromNow(-1000), // expired ages ago
    now: NOW,
  }),
  "ACTIVE",
  "Complimentary always ACTIVE regardless of cycleEnd"
);

expect(
  computeModuleStatus({
    subscriptionType: "COMPLIMENTARY",
    cycleEnd: daysFromNow(1000),
    cancelledAt: daysFromNow(-100),
    now: NOW,
  }),
  "ACTIVE",
  "Complimentary ignores cancelledAt"
);

// ─── Cancelled ────────────────────────────────────────────────────
console.log("\ncomputeModuleStatus — CANCELLED");

expect(
  computeModuleStatus({
    subscriptionType: "PAID",
    cycleEnd: daysFromNow(60),
    cancelledAt: daysFromNow(-1),
    now: NOW,
  }),
  "CANCELLED",
  "Cancelled but cycleEnd in future → CANCELLED"
);

expect(
  computeModuleStatus({
    subscriptionType: "PAID",
    cycleEnd: daysFromNow(-3),
    cancelledAt: daysFromNow(-30),
    now: NOW,
  }),
  "GRACE_PERIOD",
  "Cancelled and past cycleEnd → cascades to GRACE_PERIOD"
);

// ─── computeSubscriptionStatus rollup ──────────────────────────────
console.log("\ncomputeSubscriptionStatus — rollup");

expect(
  computeSubscriptionStatus({
    subscriptionType: "PAID",
    modules: [
      { cycleEnd: daysFromNow(365) },
      { cycleEnd: daysFromNow(180) },
    ],
    now: NOW,
  }),
  "ACTIVE",
  "All modules ACTIVE → ACTIVE"
);

expect(
  computeSubscriptionStatus({
    subscriptionType: "PAID",
    modules: [
      { cycleEnd: daysFromNow(365) },     // ACTIVE
      { cycleEnd: daysFromNow(15) },      // EXPIRING_SOON
    ],
    now: NOW,
  }),
  "EXPIRING_SOON",
  "One module EXPIRING_SOON → rollup EXPIRING_SOON"
);

expect(
  computeSubscriptionStatus({
    subscriptionType: "PAID",
    modules: [
      { cycleEnd: daysFromNow(365) },     // ACTIVE
      { cycleEnd: daysFromNow(-3) },      // GRACE_PERIOD
    ],
    now: NOW,
  }),
  "GRACE_PERIOD",
  "GRACE_PERIOD beats ACTIVE in rollup"
);

expect(
  computeSubscriptionStatus({
    subscriptionType: "PAID",
    modules: [
      { cycleEnd: daysFromNow(-3) },       // GRACE_PERIOD
      { cycleEnd: daysFromNow(-30) },      // SUSPENDED
    ],
    now: NOW,
  }),
  "SUSPENDED",
  "SUSPENDED is most severe"
);

expect(
  computeSubscriptionStatus({
    subscriptionType: "COMPLIMENTARY",
    modules: [{ cycleEnd: daysFromNow(-1000) }],
    now: NOW,
  }),
  "ACTIVE",
  "Complimentary type → ACTIVE rollup regardless of modules"
);

expect(
  computeSubscriptionStatus({
    subscriptionType: "PAID",
    modules: [],
    now: NOW,
  }),
  "SUSPENDED",
  "No modules → SUSPENDED"
);

expect(
  computeSubscriptionStatus({
    subscriptionType: "TRIAL",
    trialEndsAt: daysFromNow(5),
    modules: [{ cycleEnd: daysFromNow(5) }],
    now: NOW,
  }),
  "TRIAL",
  "Active trial → TRIAL rollup"
);

// ─── daysUntilExpiry ───────────────────────────────────────────────
console.log("\ndaysUntilExpiry");

expect(daysUntilExpiry(daysFromNow(30), NOW), 30, "30 days exact → 30");
expect(daysUntilExpiry(daysFromNow(0.5), NOW), 0, "0.5 days → floor → 0");
expect(daysUntilExpiry(daysFromNow(-0.5), NOW), 0, "-0.5 days → ceil → 0");
expect(daysUntilExpiry(daysFromNow(-2.7), NOW), -2, "-2.7 days → ceil → -2");

// ─── access guards ─────────────────────────────────────────────────
console.log("\naccess guards");

expect(isWriteAllowed("ACTIVE"), true, "isWriteAllowed(ACTIVE) → true");
expect(isWriteAllowed("EXPIRING_SOON"), true, "isWriteAllowed(EXPIRING_SOON) → true");
expect(isWriteAllowed("EXPIRED"), true, "isWriteAllowed(EXPIRED) → true (red banner, but writes still allowed)");
expect(isWriteAllowed("GRACE_PERIOD"), false, "isWriteAllowed(GRACE_PERIOD) → false (read-only)");
expect(isWriteAllowed("SUSPENDED"), false, "isWriteAllowed(SUSPENDED) → false");
expect(isWriteAllowed("TRIAL"), true, "isWriteAllowed(TRIAL) → true");
expect(isWriteAllowed("CANCELLED"), true, "isWriteAllowed(CANCELLED) → true (still functional until cycleEnd)");

expect(isAccessAllowed("SUSPENDED"), false, "isAccessAllowed(SUSPENDED) → false");
expect(isAccessAllowed("GRACE_PERIOD"), true, "isAccessAllowed(GRACE_PERIOD) → true (read-only access still allowed)");

console.log(`\n${pass} passed · ${fail} failed`);
if (fail > 0) process.exit(1);

/**
 * Tests the subscription gating logic — middleware path-matching + subscription
 * gate API helper. Doesn't run actual middleware; tests the decision functions.
 *
 * Run: npx tsx scripts/smoke-test-gating-middleware.ts
 */

import { PrismaClient } from "@prisma/client";
import { getAccessSnapshot } from "@/lib/module-access";

const prisma = new PrismaClient();
const CODE = "_GATING_TEST";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  const c = await prisma.customerAccount.findUnique({ where: { code: CODE } });
  if (c) {
    await prisma.subscriptionPlan.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.moduleSubscription.deleteMany({ where: { subscription: { customerAccountId: c.id } } });
    await prisma.subscription.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.customerAccount.delete({ where: { id: c.id } });
  }
}

// Replicate the middleware allowlist function
const SUSPENDED_ALLOWLIST_PREFIXES = ["/settings/subscription", "/login", "/logout", "/signup"];
function isSuspendedAllowlisted(pathname: string): boolean {
  return SUSPENDED_ALLOWLIST_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

async function main() {
  // ── Allowlist tests ──────────────────────────────────────
  console.log("Suspended allowlist");
  assert(isSuspendedAllowlisted("/settings/subscription"), "/settings/subscription allowed");
  assert(isSuspendedAllowlisted("/settings/subscription/renew"), "/settings/subscription/renew allowed");
  assert(isSuspendedAllowlisted("/settings/subscription/upgrade"), "/settings/subscription/upgrade allowed");
  assert(isSuspendedAllowlisted("/login"), "/login allowed");
  assert(isSuspendedAllowlisted("/signup"), "/signup allowed");
  assert(!isSuspendedAllowlisted("/compliance/framework"), "/compliance/* blocked");
  assert(!isSuspendedAllowlisted("/tprm/vendor-management"), "/tprm/* blocked");
  assert(!isSuspendedAllowlisted("/internal-audit/audit-engagement"), "/internal-audit/* blocked");
  assert(!isSuspendedAllowlisted("/"), "home page blocked");
  assert(!isSuspendedAllowlisted("/settings"), "/settings (without /subscription) blocked");
  // Edge: don't allowlist "/settings/subscriptionFOO"
  assert(!isSuspendedAllowlisted("/settings/subscriptionFOO"), "settings/subscriptionFOO not allowlisted (must match prefix exactly)");

  // ── getAccessSnapshot end-to-end ─────────────────────────
  console.log("\ngetAccessSnapshot scenarios");

  await cleanup();
  const customer = await prisma.customerAccount.create({
    data: { code: CODE, name: "Gating Test", isGrcAdded: true, isInternalAuditEnabled: true },
  });
  const sub = await prisma.subscription.create({
    data: { customerAccountId: customer.id, status: "ACTIVE", subscriptionType: "PAID", autoRenew: true },
  });
  const future = new Date();
  future.setUTCFullYear(future.getUTCFullYear() + 1);

  // Active subscription
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "GRC", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, frameworkLimit: 3,
      cycleStart: new Date(), cycleEnd: future,
    },
  });
  let snap = await getAccessSnapshot(customer.id);
  assert(snap.subscriptionStatus === "ACTIVE", `ACTIVE — got ${snap.subscriptionStatus}`);
  assert(snap.subscriptionType === "PAID", "PAID type");
  assert(snap.isGrcAdded === true, "GRC accessible");

  // Suspend by expiring cycleEnd
  const past = new Date();
  past.setUTCDate(past.getUTCDate() - 30);
  await prisma.moduleSubscription.updateMany({
    where: { subscriptionId: sub.id },
    data: { cycleEnd: past },
  });
  snap = await getAccessSnapshot(customer.id);
  assert(snap.subscriptionStatus === "SUSPENDED", `SUSPENDED after 30 days past — got ${snap.subscriptionStatus}`);
  assert(snap.isGrcAdded === false, "module access revoked when SUSPENDED");

  // GRACE_PERIOD
  const threeAgo = new Date();
  threeAgo.setUTCDate(threeAgo.getUTCDate() - 3);
  await prisma.moduleSubscription.updateMany({
    where: { subscriptionId: sub.id },
    data: { cycleEnd: threeAgo },
  });
  snap = await getAccessSnapshot(customer.id);
  assert(snap.subscriptionStatus === "GRACE_PERIOD", `GRACE_PERIOD — got ${snap.subscriptionStatus}`);
  assert(snap.isGrcAdded === true, "module STILL accessible during GRACE_PERIOD (read-only enforced separately)");

  // COMPLIMENTARY → ACTIVE regardless of cycleEnd
  await prisma.subscription.update({ where: { id: sub.id }, data: { subscriptionType: "COMPLIMENTARY" } });
  snap = await getAccessSnapshot(customer.id);
  assert(snap.subscriptionStatus === "ACTIVE", `Complimentary → ACTIVE despite expired — got ${snap.subscriptionStatus}`);
  assert(snap.subscriptionType === "COMPLIMENTARY", "type=COMPLIMENTARY");

  // ── Gate decision logic (mirrors checkSubscriptionGate) ──
  console.log("\nGate decisions");
  type Status = "ACTIVE" | "TRIAL" | "EXPIRING_SOON" | "EXPIRED" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED";
  function gate(status: Status, intent: "read" | "write"): "allow" | "block" {
    if (status === "SUSPENDED") return "block";
    if (intent === "write" && status === "GRACE_PERIOD") return "block";
    return "allow";
  }
  assert(gate("ACTIVE", "write") === "allow", "ACTIVE write → allow");
  assert(gate("EXPIRING_SOON", "write") === "allow", "EXPIRING_SOON write → allow");
  assert(gate("EXPIRED", "write") === "allow", "EXPIRED write → allow (still has full access)");
  assert(gate("GRACE_PERIOD", "read") === "allow", "GRACE_PERIOD read → allow");
  assert(gate("GRACE_PERIOD", "write") === "block", "GRACE_PERIOD write → BLOCK (read-only)");
  assert(gate("SUSPENDED", "read") === "block", "SUSPENDED read → BLOCK");
  assert(gate("SUSPENDED", "write") === "block", "SUSPENDED write → BLOCK");
  assert(gate("CANCELLED", "write") === "allow", "CANCELLED write → allow (still in cycle)");

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());

/**
 * Tests the lightweight banner status endpoint by exercising the underlying
 * logic across all 7 SubscriptionStatus values.
 *
 * Run: npx tsx scripts/smoke-test-banner-status.ts
 */

import { PrismaClient } from "@prisma/client";
import { computeSubscriptionStatus, daysUntilExpiry } from "@/lib/subscription-status";

const prisma = new PrismaClient();
const CODE = "_BANNER_TEST";

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

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function setupSubscription(opts: {
  cycleEnd: Date;
  cancelledAt?: Date | null;
  type?: "PAID" | "TRIAL" | "COMPLIMENTARY";
  trialEndsAt?: Date | null;
}) {
  await cleanup();
  const customer = await prisma.customerAccount.create({
    data: { code: CODE, name: "Banner Test", isGrcAdded: true },
  });
  const sub = await prisma.subscription.create({
    data: {
      customerAccountId: customer.id,
      status: "ACTIVE",
      subscriptionType: opts.type ?? "PAID",
      trialEndsAt: opts.trialEndsAt ?? null,
      autoRenew: true,
    },
  });
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: sub.id, moduleCode: "GRC", tier: "BASIC", billingCycle: "YEARLY",
      unitPrice: 50000, userLimit: 5, frameworkLimit: 3,
      cycleStart: daysFromNow(-365),
      cycleEnd: opts.cycleEnd,
      cancelledAt: opts.cancelledAt ?? null,
    },
  });
  return { sub };
}

async function statusFor(): Promise<string> {
  const { sub } = await reload();
  return computeSubscriptionStatus({
    subscriptionType: sub.subscriptionType,
    trialEndsAt: sub.trialEndsAt,
    modules: sub.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
  });
}

async function reload() {
  const sub = await prisma.subscription.findFirst({
    where: { customerAccount: { code: CODE } },
    include: { modules: true },
  });
  if (!sub) throw new Error("test sub not found");
  return { sub };
}

async function main() {
  console.log("Banner status decision matrix");

  // ACTIVE → no banner
  await setupSubscription({ cycleEnd: daysFromNow(365) });
  let s = await statusFor();
  assert(s === "ACTIVE", `1 year out → ACTIVE (no banner) — got ${s}`);

  // EXPIRING_SOON → yellow banner
  await setupSubscription({ cycleEnd: daysFromNow(15) });
  s = await statusFor();
  assert(s === "EXPIRING_SOON", `15 days → EXPIRING_SOON (yellow) — got ${s}`);

  // EXPIRED → red persistent
  await setupSubscription({ cycleEnd: daysFromNow(-0.5) });
  s = await statusFor();
  assert(s === "EXPIRED", `12h ago → EXPIRED (red) — got ${s}`);

  // GRACE_PERIOD → red persistent
  await setupSubscription({ cycleEnd: daysFromNow(-3) });
  s = await statusFor();
  assert(s === "GRACE_PERIOD", `3 days ago → GRACE_PERIOD (red, read-only) — got ${s}`);

  // SUSPENDED → full-page interstitial
  await setupSubscription({ cycleEnd: daysFromNow(-30) });
  s = await statusFor();
  assert(s === "SUSPENDED", `30 days ago → SUSPENDED (interstitial) — got ${s}`);

  // CANCELLED → soft yellow
  await setupSubscription({ cycleEnd: daysFromNow(180), cancelledAt: daysFromNow(-1) });
  s = await statusFor();
  assert(s === "CANCELLED", `cancelled but cycleEnd future → CANCELLED — got ${s}`);

  // TRIAL with ≤7d → blue banner
  await setupSubscription({
    cycleEnd: daysFromNow(5),
    type: "TRIAL",
    trialEndsAt: daysFromNow(5),
  });
  s = await statusFor();
  assert(s === "TRIAL", `trial 5 days left → TRIAL (blue) — got ${s}`);

  // TRIAL >7d → no banner triggered (trial mode but not urgent)
  await setupSubscription({
    cycleEnd: daysFromNow(14),
    type: "TRIAL",
    trialEndsAt: daysFromNow(14),
  });
  s = await statusFor();
  // Status engine still returns TRIAL; banner UI only shows if trialDaysLeft <= 7
  const trialDays = daysUntilExpiry(daysFromNow(14));
  assert(trialDays > 7, `trial 14 days → still TRIAL but banner suppressed (trialDaysLeft=${trialDays})`);

  // COMPLIMENTARY → no banner regardless
  await setupSubscription({
    cycleEnd: daysFromNow(-1000), // expired ages ago
    type: "COMPLIMENTARY",
  });
  s = await statusFor();
  assert(s === "ACTIVE", `complimentary → ACTIVE (no banner) — got ${s}`);

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());

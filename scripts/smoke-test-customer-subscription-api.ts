/**
 * Exercises the GET /api/settings/subscription handler logic against a real
 * migrated customer (Baarez / GRC_001).
 *
 * Run: npx tsx scripts/smoke-test-customer-subscription-api.ts
 */

import { PrismaClient } from "@prisma/client";
import { computeSubscriptionStatus, computeModuleStatus } from "@/lib/subscription-status";

const prisma = new PrismaClient();

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function main() {
  const baarez = await prisma.customerAccount.findUnique({ where: { code: "GRC_001" } });
  if (!baarez) throw new Error("Test prerequisite: GRC_001 customer not found");

  const sub = await prisma.subscription.findUnique({
    where: { customerAccountId: baarez.id },
    include: { modules: { orderBy: { moduleCode: "asc" } }, invoices: true },
  });
  assert(sub !== null, "Subscription found for Baarez");
  assert(sub!.subscriptionType === "PAID", "Type=PAID");

  const now = new Date();
  const status = computeSubscriptionStatus({
    subscriptionType: sub!.subscriptionType,
    trialEndsAt: sub!.trialEndsAt,
    modules: sub!.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
    now,
  });
  assert(status === "ACTIVE", `Status=ACTIVE (got ${status})`);

  // Total amount aggregation
  let totalYearly = 0;
  for (const m of sub!.modules) {
    if (m.cancelledAt || m.cycleEnd <= now) continue;
    if (m.billingCycle === "YEARLY") totalYearly += Number(m.unitPrice);
  }
  assert(totalYearly === 100000, `totalYearly=100000 (2 modules × ₹50K, got ${totalYearly})`);

  // Earliest cycleEnd
  const futureEnds = sub!.modules
    .filter((m) => !m.cancelledAt && m.cycleEnd > now)
    .map((m) => m.cycleEnd);
  const nextRenewal = new Date(Math.min(...futureEnds.map((d) => d.getTime())));
  assert(nextRenewal.getUTCFullYear() >= 2028, `nextRenewal in 2028+ (got ${nextRenewal.toISOString()})`);

  // Per-module status
  for (const m of sub!.modules) {
    const ms = computeModuleStatus({
      subscriptionType: sub!.subscriptionType,
      trialEndsAt: sub!.trialEndsAt,
      cycleEnd: m.cycleEnd,
      cancelledAt: m.cancelledAt,
      now,
    });
    assert(ms === "ACTIVE", `${m.moduleCode} module status = ACTIVE`);
  }

  // Usage counts (live)
  const COUNTED_GRC_ROLES = ["CustomerAdministrator", "Reviewer", "Contributor", "DepartmentReviewer", "DepartmentContributor"];
  const grcUsers = await prisma.user.count({
    where: { customerAccountId: baarez.id, userRoles: { some: { role: { name: { in: COUNTED_GRC_ROLES } } } } },
  });
  console.log(`  ℹ Live GRC user count: ${grcUsers}`);
  const frameworks = await prisma.framework.count({ where: { customerAccountId: baarez.id } });
  console.log(`  ℹ Live framework count: ${frameworks}`);

  // Override on a complimentary subscription
  console.log("\nComplimentary scenario");
  const tempCode = "_CUST_SUB_API_TEST";
  const c = await prisma.customerAccount.create({
    data: { code: tempCode, name: "API Test", isGrcAdded: true, isInternalAuditEnabled: true },
  });
  const compSub = await prisma.subscription.create({
    data: { customerAccountId: c.id, status: "ACTIVE", subscriptionType: "COMPLIMENTARY", autoRenew: false },
  });
  const longAgo = new Date("2020-01-01Z");
  await prisma.moduleSubscription.create({
    data: {
      subscriptionId: compSub.id, moduleCode: "GRC", tier: "PRO", billingCycle: "YEARLY",
      unitPrice: 200000, userLimit: 50, frameworkLimit: null,
      cycleStart: longAgo, cycleEnd: longAgo,
    },
  });

  const compFresh = await prisma.subscription.findUnique({
    where: { customerAccountId: c.id }, include: { modules: true },
  });
  const compStatus = computeSubscriptionStatus({
    subscriptionType: compFresh!.subscriptionType,
    trialEndsAt: compFresh!.trialEndsAt,
    modules: compFresh!.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
  });
  assert(compStatus === "ACTIVE", "Complimentary returns ACTIVE despite expired cycleEnd");

  // Cleanup
  await prisma.moduleSubscription.deleteMany({ where: { subscriptionId: compSub.id } });
  await prisma.subscription.delete({ where: { id: compSub.id } });
  await prisma.customerAccount.delete({ where: { id: c.id } });

  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

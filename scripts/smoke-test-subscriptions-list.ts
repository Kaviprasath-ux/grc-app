/**
 * Exercises the same code paths as /api/grc/subscriptions and /stats against
 * live migrated DB data. No HTTP layer.
 *
 * Run: npx tsx scripts/smoke-test-subscriptions-list.ts
 */

import { PrismaClient } from "@prisma/client";
import { computeSubscriptionStatus } from "@/lib/subscription-status";

const prisma = new PrismaClient();

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function main() {
  // ── List endpoint logic ──────────────────────────────────────
  console.log("List endpoint");
  const subs = await prisma.subscription.findMany({
    include: {
      customerAccount: { select: { code: true, name: true } },
      modules: true,
    },
  });

  const now = new Date();
  const rows = subs.map((s) => {
    const status = computeSubscriptionStatus({
      subscriptionType: s.subscriptionType,
      trialEndsAt: s.trialEndsAt,
      modules: s.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
      now,
    });
    let mrr = 0;
    if (s.subscriptionType === "PAID") {
      for (const m of s.modules) {
        if (m.cancelledAt || m.cycleEnd <= now) continue;
        const price = Number(m.unitPrice);
        mrr += m.billingCycle === "MONTHLY" ? price : price / 12;
      }
    }
    return { code: s.customerAccount.code, status, mrr, modules: s.modules.length };
  });

  assert(rows.length >= 5, `at least 5 subscriptions migrated (got ${rows.length})`);

  const baarez = rows.find((r) => r.code === "GRC_001");
  assert(baarez !== undefined, "Baarez (GRC_001) present");
  assert(baarez!.status === "ACTIVE", "Baarez status ACTIVE");
  assert(baarez!.modules === 2, "Baarez has 2 modules (GRC + IA)");
  assert(baarez!.mrr > 0, `Baarez MRR > 0 (got ${baarez!.mrr})`);

  // ── Stats logic ──────────────────────────────────────────────
  console.log("\nStats endpoint");
  let totalCustomers = 0, activePaying = 0, trialCount = 0, complimentaryCount = 0;
  let suspendedCount = 0, expiringSoonCount = 0, mrr = 0;
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const s of subs) {
    totalCustomers++;
    const status = computeSubscriptionStatus({
      subscriptionType: s.subscriptionType,
      trialEndsAt: s.trialEndsAt,
      modules: s.modules.map((m) => ({ cycleEnd: m.cycleEnd, cancelledAt: m.cancelledAt })),
      now,
    });
    if (s.subscriptionType === "TRIAL") trialCount++;
    else if (s.subscriptionType === "COMPLIMENTARY") complimentaryCount++;
    else if (status === "ACTIVE" || status === "EXPIRING_SOON" || status === "TRIAL") activePaying++;
    if (status === "SUSPENDED") suspendedCount++;

    const hasExpiring = s.modules.some((m) =>
      !m.cancelledAt && m.cycleEnd > now && m.cycleEnd <= in30Days
    );
    if (hasExpiring && s.subscriptionType === "PAID") expiringSoonCount++;

    if (s.subscriptionType === "PAID") {
      for (const m of s.modules) {
        if (m.cancelledAt || m.cycleEnd <= now) continue;
        const price = Number(m.unitPrice);
        mrr += m.billingCycle === "MONTHLY" ? price : price / 12;
      }
    }
  }

  assert(totalCustomers === subs.length, `totalCustomers=${subs.length}`);
  assert(activePaying === 5, `activePaying=5 (got ${activePaying})`);
  assert(trialCount === 0, "trialCount=0");
  assert(complimentaryCount === 0, "complimentaryCount=0");
  assert(suspendedCount === 0, "suspendedCount=0");
  assert(mrr > 0, `mrr > 0 (got ${Math.round(mrr)})`);

  console.log(`\n  → MRR: ₹${Math.round(mrr).toLocaleString("en-IN")}`);
  console.log(`  → ARR: ₹${Math.round(mrr * 12).toLocaleString("en-IN")}`);

  // ── Filter logic ──────────────────────────────────────────────
  console.log("\nFilter logic");
  const grcOnly = rows.filter((r) => r.modules >= 1);
  assert(grcOnly.length === rows.length, "all rows have modules");

  const sorted = [...rows].sort((a, b) => {
    const ORDER: Record<string, number> = { SUSPENDED: 0, GRACE_PERIOD: 1, EXPIRED: 2, EXPIRING_SOON: 3, CANCELLED: 4, TRIAL: 5, ACTIVE: 6 };
    return (ORDER[a.status] ?? 99) - (ORDER[b.status] ?? 99);
  });
  // ACTIVE rows should be at the end
  assert(sorted[sorted.length - 1].status === "ACTIVE", "ACTIVE sorted last (least urgent)");

  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

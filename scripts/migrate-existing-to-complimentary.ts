/**
 * Phase 8 — Migrate every pre-V2 customer to a COMPLIMENTARY plan.
 *
 * Per management decision: existing customers (those onboarded before the V2
 * BASE/GENERAL model) are not retro-charged or auto-flipped. They keep
 * their access via a COMPLIMENTARY override that bypasses both BASE and
 * GENERAL pricing and contract enforcement.
 *
 * What "pre-V2 customer" means here:
 *   A Subscription whose every ModuleSubscription has planType=NULL.
 *   - Mixed-state Subscriptions (some V2, some V1) are skipped with a warning
 *     so we don't accidentally clobber a partial V2 setup.
 *   - Customers already on COMPLIMENTARY are skipped (idempotent).
 *
 * What this script does for each migrated customer:
 *   1. Subscription envelope:
 *        subscriptionType = COMPLIMENTARY
 *        autoRenew = false (no renewal needed)
 *        notes append migration timestamp
 *   2. Each ModuleSubscription:
 *        planType = COMPLIMENTARY
 *        Clears all V2 lifecycle fields (contract, mandate, queue)
 *        cycleEnd pushed to today + 10 years (status engine reads ACTIVE)
 *        cancelledAt cleared (in case)
 *   3. Open invoices (status DRAFT or ISSUED) marked VOIDED — no charges
 *   4. Re-sync legacy SubscriptionPlan via syncSubscriptionPlan(); the
 *      COMPLIMENTARY branch in that helper writes UNLIMITED_LEGACY_VALUE
 *      for every limit, so the 16 V1 enforcement files become permissive.
 *
 * Idempotent: a second run finds zero candidates and no-ops.
 *
 * Run:
 *   npx tsx scripts/migrate-existing-to-complimentary.ts
 *   npx tsx scripts/migrate-existing-to-complimentary.ts --dry-run  (preview only)
 */

import prisma from "../src/lib/prisma";
import { syncSubscriptionPlan } from "../src/lib/subscription-plan-sync";

const DRY_RUN = process.argv.includes("--dry-run");

interface Outcome {
  customerCode: string;
  customerName: string;
  modules: number;
  invoicesVoided: number;
  status: "migrated" | "skipped-already-comp" | "skipped-mixed-state" | "skipped-already-v2";
}

function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + n);
  return r;
}

async function run() {
  console.log(`=== Migrating pre-V2 customers to COMPLIMENTARY ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  const subs = await prisma.subscription.findMany({
    include: {
      customerAccount: { select: { code: true, name: true } },
      modules: true,
    },
  });

  const outcomes: Outcome[] = [];
  const farFuture = addYears(new Date(), 10);
  const now = new Date();

  for (const sub of subs) {
    const customerCode = sub.customerAccount.code;
    const customerName = sub.customerAccount.name;

    // Already COMPLIMENTARY at the envelope level -> skip.
    if (sub.subscriptionType === "COMPLIMENTARY") {
      outcomes.push({ customerCode, customerName, modules: sub.modules.length, invoicesVoided: 0, status: "skipped-already-comp" });
      continue;
    }

    if (sub.modules.length === 0) {
      // Nothing to do — leave envelope alone.
      continue;
    }

    const v1Modules = sub.modules.filter(m => m.planType === null);
    const v2Modules = sub.modules.filter(m => m.planType === "BASE" || m.planType === "GENERAL");
    const compModules = sub.modules.filter(m => m.planType === "COMPLIMENTARY");

    // Pure V2 customer (already on BASE/GENERAL) — skip.
    if (v1Modules.length === 0 && v2Modules.length > 0) {
      outcomes.push({ customerCode, customerName, modules: sub.modules.length, invoicesVoided: 0, status: "skipped-already-v2" });
      continue;
    }

    // Mixed: some V1, some V2 — refuse to migrate without operator review.
    if (v1Modules.length > 0 && v2Modules.length > 0) {
      console.warn(`  ! ${customerCode} (${customerName}): mixed V1+V2 modules — manual review needed, skipped`);
      outcomes.push({ customerCode, customerName, modules: sub.modules.length, invoicesVoided: 0, status: "skipped-mixed-state" });
      continue;
    }

    // Otherwise: every module is either V1 (planType=null) or already COMPLIMENTARY.
    // We'll re-bake the COMPLIMENTARY-marked ones too in case they have stale V2 fields.
    const targetModuleIds = [...v1Modules, ...compModules].map(m => m.id);
    if (targetModuleIds.length === 0) {
      continue;
    }

    if (DRY_RUN) {
      const openInvCount = await prisma.invoice.count({
        where: { subscriptionId: sub.id, status: { in: ["DRAFT", "ISSUED"] } },
      });
      console.log(`  ~ [DRY] ${customerCode}: ${targetModuleIds.length} module(s), ${openInvCount} open invoice(s) would be voided`);
      outcomes.push({ customerCode, customerName, modules: targetModuleIds.length, invoicesVoided: openInvCount, status: "migrated" });
      continue;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Envelope
      const stamp = now.toISOString();
      const note = `[${stamp}] System: migrated to COMPLIMENTARY (Phase 8)`;
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          subscriptionType: "COMPLIMENTARY",
          autoRenew: false,
          notes: sub.notes ? `${sub.notes}\n${note}` : note,
        },
      });

      // 2. Modules — clear V2 lifecycle, push cycleEnd far out
      await tx.moduleSubscription.updateMany({
        where: { id: { in: targetModuleIds } },
        data: {
          planType: "COMPLIMENTARY",
          nextPlanType: null,
          baseStartDate: null,
          baseEndDate: null,
          contractStartDate: null,
          contractEndDate: null,
          generalBillingCycle: null,
          generalStartDate: null,
          mandateId: null,
          mandateStatus: null,
          cancellationRequestedAt: null,
          cancelledAt: null,
          cycleEnd: farFuture,
        },
      });

      // 3. Void any open invoices
      const openInvoices = await tx.invoice.findMany({
        where: { subscriptionId: sub.id, status: { in: ["DRAFT", "ISSUED"] } },
        select: { id: true },
      });
      if (openInvoices.length > 0) {
        await tx.invoice.updateMany({
          where: { id: { in: openInvoices.map(i => i.id) } },
          data: { status: "REFUNDED" }, // closest to "voided" in current InvoiceStatus enum
        });
      }
      return { invoicesVoided: openInvoices.length };
    });

    // 4. Sync legacy SubscriptionPlan rows (outside the txn — uses its own writes)
    for (const mid of targetModuleIds) {
      try {
        await syncSubscriptionPlan(mid);
      } catch (e) {
        console.warn(`  ! Sync failed for ms ${mid}:`, (e as Error).message);
      }
    }

    console.log(`  + ${customerCode} (${customerName}): ${targetModuleIds.length} module(s) -> COMPLIMENTARY, ${result.invoicesVoided} invoice(s) voided`);
    outcomes.push({ customerCode, customerName, modules: targetModuleIds.length, invoicesVoided: result.invoicesVoided, status: "migrated" });
  }

  // Summary
  const counts = outcomes.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\nTotal subscriptions scanned: ${subs.length}`);
  console.log(`  migrated:               ${counts["migrated"] ?? 0}`);
  console.log(`  skipped-already-comp:   ${counts["skipped-already-comp"] ?? 0}`);
  console.log(`  skipped-already-v2:     ${counts["skipped-already-v2"] ?? 0}`);
  console.log(`  skipped-mixed-state:    ${counts["skipped-mixed-state"] ?? 0}`);

  if (DRY_RUN) console.log("\n(Dry run — no changes written)");
}

run()
  .catch(e => { console.error("FATAL:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

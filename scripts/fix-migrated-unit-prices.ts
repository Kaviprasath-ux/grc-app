/**
 * One-shot fix: existing migrated ModuleSubscription rows had unitPrice set to
 * the monthly catalog price even though billingCycle=YEARLY. Correct value is
 * the yearly catalog price (matches "amount charged per billing period").
 *
 * Re-running is safe — it only rewrites rows whose unitPrice is suspiciously
 * close to the monthly catalog value (within 1%) for their tier+cycle.
 *
 * Run: npx tsx scripts/fix-migrated-unit-prices.ts
 *      Add --dry-run to preview.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`🔧 Fixing migrated unit prices${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const tierPricing = await prisma.moduleTierPricing.findMany();
  const tierMap = new Map<string, { monthly: number; yearly: number }>();
  for (const t of tierPricing) {
    tierMap.set(`${t.moduleCode}:${t.tier}`, {
      monthly: Number(t.monthlyPrice),
      yearly: Number(t.yearlyPrice),
    });
  }

  const moduleSubscriptions = await prisma.moduleSubscription.findMany({
    include: { subscription: { select: { customerAccountId: true, customerAccount: { select: { code: true } } } } },
  });

  let fixed = 0, ok = 0, skipped = 0;
  for (const ms of moduleSubscriptions) {
    const key = `${ms.moduleCode}:${ms.tier}`;
    const catalog = tierMap.get(key);
    if (!catalog) {
      console.log(`  ⊘ ${ms.subscription.customerAccount.code} ${ms.moduleCode} ${ms.tier}: no catalog row`);
      skipped++;
      continue;
    }

    const current = Number(ms.unitPrice);
    const expected = ms.billingCycle === "MONTHLY" ? catalog.monthly : catalog.yearly;

    if (Math.abs(current - expected) < 0.01) {
      ok++;
      continue;
    }

    // Only auto-fix if current matches the OPPOSITE-cycle catalog price (i.e., the bug shape).
    const otherCyclePrice = ms.billingCycle === "MONTHLY" ? catalog.yearly : catalog.monthly;
    if (Math.abs(current - otherCyclePrice) < 0.01) {
      console.log(`  ✓ ${ms.subscription.customerAccount.code} ${ms.moduleCode} ${ms.tier} ${ms.billingCycle}: ${current} → ${expected}`);
      if (!DRY_RUN) {
        await prisma.moduleSubscription.update({
          where: { id: ms.id },
          data: { unitPrice: expected },
        });
      }
      fixed++;
    } else {
      // Custom override-style price; leave alone
      console.log(`  ↷ ${ms.subscription.customerAccount.code} ${ms.moduleCode} ${ms.tier} ${ms.billingCycle}: custom price ${current}, leaving as-is`);
      skipped++;
    }
  }

  console.log(`\n${fixed} fixed · ${ok} already correct · ${skipped} skipped`);
  if (DRY_RUN) console.log("(dry run — no changes written)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

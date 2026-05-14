/**
 * Phase 2 backfill: ensure every CustomerAccount has Subscription +
 * ModuleSubscription rows for its active module flags.
 *
 * Customers onboarded before commit 6ff80b7 may not have Subscription rows.
 * Without them, getAccessSnapshot() returns all-false, and users see
 * /subscription-required. Run this BEFORE users log in (after db push).
 *
 * Idempotent — uses ensureComplimentarySubscription which skips already-active rows.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "<direct-url>"
 *   npx tsx scripts/prod-provision-subscriptions.ts
 */
import { PrismaClient } from "@prisma/client";
import { ensureComplimentarySubscription, type ModuleCode } from "../src/lib/customer-complimentary";

const p = new PrismaClient();

async function main() {
  const customers = await p.customerAccount.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      isGrcAdded: true,
      isTprmAdded: true,
      isInternalAuditEnabled: true,
    },
  });
  console.log(`\nProvisioning subscriptions for ${customers.length} customer(s)…\n`);

  let provisioned = 0;
  let skipped = 0;
  for (const c of customers) {
    const modules: ModuleCode[] = [];
    if (c.isGrcAdded) modules.push("GRC");
    if (c.isTprmAdded) modules.push("TPRM");
    if (c.isInternalAuditEnabled) modules.push("INTERNAL_AUDIT");

    if (modules.length === 0) {
      console.log(`  ⊝ ${c.code} (${c.name}) — no active module flags, skipping`);
      skipped++;
      continue;
    }

    try {
      const result = await ensureComplimentarySubscription(c.id, modules);
      console.log(
        `  ✓ ${c.code} (${c.name}) — ensured: [${result.ensured.join(", ") || "all already active"}]`,
      );
      provisioned++;
    } catch (e) {
      console.error(`  ✗ ${c.code} (${c.name}) — failed: ${(e as Error).message}`);
    }
  }

  console.log(`\nDone. Provisioned: ${provisioned}, skipped: ${skipped}.`);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

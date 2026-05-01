/**
 * Exercises the per-customer pricing override CRUD against DB.
 * Run: npx tsx scripts/smoke-test-customer-override-api.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TEST_CODE = "_OVERRIDE_TEST";

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  const c = await prisma.customerAccount.findUnique({ where: { code: TEST_CODE } });
  if (c) {
    await prisma.customerPlanOverride.deleteMany({ where: { customerAccountId: c.id } });
    await prisma.customerAccount.delete({ where: { id: c.id } });
  }
}

async function main() {
  await cleanup();

  // Setup test customer
  const customer = await prisma.customerAccount.create({
    data: { code: TEST_CODE, name: "Override Test", isGrcAdded: true, isTprmAdded: true, isInternalAuditEnabled: true },
  });

  // ── PUT (create) ──────────────────────────────────────────
  console.log("PUT — create override");
  const created = await prisma.customerPlanOverride.upsert({
    where: { customerAccountId_moduleCode: { customerAccountId: customer.id, moduleCode: "GRC" } },
    update: {},
    create: {
      customerAccountId: customer.id,
      moduleCode: "GRC",
      tier: "MEDIUM",
      monthlyPrice: 7777,
      yearlyPrice: 77777,
      reason: "Strategic partner",
      isActive: true,
      createdBy: "smoke-test",
    },
  });
  assert(created.id !== undefined, "row created");
  assert(Number(created.monthlyPrice) === 7777, "monthlyPrice=7777");
  assert(created.tier === "MEDIUM", "tier=MEDIUM");

  // ── PUT (update existing — upsert behavior) ───────────────
  console.log("\nPUT — update via upsert");
  const updated = await prisma.customerPlanOverride.upsert({
    where: { customerAccountId_moduleCode: { customerAccountId: customer.id, moduleCode: "GRC" } },
    update: { monthlyPrice: 8888 },
    create: {
      customerAccountId: customer.id,
      moduleCode: "GRC",
      monthlyPrice: 8888,
      isActive: true,
      createdBy: "smoke-test",
    },
  });
  assert(updated.id === created.id, "same row updated (no duplicate)");
  assert(Number(updated.monthlyPrice) === 8888, "monthlyPrice=8888");

  // ── GET — list overrides for customer ────────────────────
  console.log("\nGET — list overrides");
  const all = await prisma.customerPlanOverride.findMany({
    where: { customerAccountId: customer.id },
    orderBy: { moduleCode: "asc" },
  });
  assert(all.length === 1, "1 override row");

  // Add a second module override
  await prisma.customerPlanOverride.create({
    data: {
      customerAccountId: customer.id,
      moduleCode: "TPRM",
      tier: "PRO",
      monthlyPrice: 15000,
      yearlyPrice: 150000,
      vendorLimit: 500,
      isActive: true,
      createdBy: "smoke-test",
    },
  });
  const all2 = await prisma.customerPlanOverride.findMany({
    where: { customerAccountId: customer.id },
  });
  assert(all2.length === 2, "2 overrides after adding TPRM");

  // ── DELETE ───────────────────────────────────────────────
  console.log("\nDELETE — reset GRC override");
  await prisma.customerPlanOverride.delete({
    where: { customerAccountId_moduleCode: { customerAccountId: customer.id, moduleCode: "GRC" } },
  });
  const remaining = await prisma.customerPlanOverride.findMany({
    where: { customerAccountId: customer.id },
  });
  assert(remaining.length === 1, "1 override remaining (only TPRM)");
  assert(remaining[0].moduleCode === "TPRM", "remaining is TPRM");

  // ── Pricing engine integration: override actually used by computeQuote ──
  console.log("\nIntegration — pricing engine respects override");
  const { computeQuote } = await import("@/lib/pricing");
  const quote = await computeQuote({
    customerAccountId: customer.id,
    lines: [{ moduleCode: "TPRM", tier: "PRO" }],
    cycle: "YEARLY",
  });
  assert(quote.lineItems[0].priceSource === "OVERRIDE", "TPRM line uses OVERRIDE");
  assert(quote.lineItems[0].fullCyclePrice === 150000, "override yearly price 150000 used");

  // GRC line (no override since deleted) → STANDARD
  const quote2 = await computeQuote({
    customerAccountId: customer.id,
    lines: [{ moduleCode: "GRC", tier: "BASIC" }],
    cycle: "YEARLY",
  });
  assert(quote2.lineItems[0].priceSource === "STANDARD", "GRC line uses STANDARD (override deleted)");
  assert(quote2.lineItems[0].fullCyclePrice === 50000, "standard yearly price 50000");

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());

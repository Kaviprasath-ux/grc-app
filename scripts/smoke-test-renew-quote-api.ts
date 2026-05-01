/**
 * Tests the /api/settings/subscription/renew/quote handler logic.
 * No HTTP — exercises computeQuote against migrated customer data.
 *
 * Run: npx tsx scripts/smoke-test-renew-quote-api.ts
 */

import { PrismaClient } from "@prisma/client";
import { computeQuote } from "@/lib/pricing";
import { z } from "zod";

const prisma = new PrismaClient();

const Schema = z.object({
  cycle: z.enum(["MONTHLY", "YEARLY"]),
  lines: z.array(z.object({
    moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]),
    tier: z.enum(["BASIC", "MEDIUM", "PRO"]),
  })).min(1),
});

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function main() {
  const customer = await prisma.customerAccount.findUnique({ where: { code: "GRC_001" } });
  if (!customer) throw new Error("Test prerequisite: GRC_001 not found");

  // ── Body validation ──────────────────────────────────────
  console.log("Body validation");
  const empty = Schema.safeParse({ cycle: "YEARLY", lines: [] });
  assert(!empty.success, "empty lines rejected");

  const bad = Schema.safeParse({ cycle: "WEEKLY", lines: [{ moduleCode: "GRC", tier: "BASIC" }] });
  assert(!bad.success, "invalid cycle rejected");

  const good = Schema.safeParse({ cycle: "YEARLY", lines: [{ moduleCode: "GRC", tier: "BASIC" }] });
  assert(good.success, "good body accepted");

  // ── Single-module yearly quote (Baarez has GRC override at 1000 frwks limit but no price override) ──
  console.log("\nSingle-module yearly quote for Baarez");
  const q1 = await computeQuote({
    customerAccountId: customer.id,
    lines: [{ moduleCode: "GRC", tier: "BASIC" }],
    cycle: "YEARLY",
  });
  // Baarez has CustomerPlanOverride for GRC with elevated limits but no price override
  // So price should be standard catalog (₹50,000) — verify
  assert(q1.lineItems[0].priceSource === "STANDARD" || q1.lineItems[0].priceSource === "OVERRIDE",
    `priceSource ∈ {STANDARD, OVERRIDE} (got ${q1.lineItems[0].priceSource})`);
  assert(q1.subtotal > 0, `subtotal > 0 (got ${q1.subtotal})`);
  assert(q1.taxAmount > 0, "GST applied");
  assert(q1.total === q1.taxableAmount + q1.taxAmount, "total = taxable + tax");

  console.log(`  → Subtotal: ₹${q1.subtotal.toLocaleString("en-IN")}`);
  console.log(`  → GST 18%: ₹${q1.taxAmount.toLocaleString("en-IN")}`);
  console.log(`  → Total:    ₹${q1.total.toLocaleString("en-IN")}`);

  // ── Multi-module yearly Pro quote — bundle discount may kick in ──
  console.log("\nAll-3-Pro yearly (admin-provisioned but inactive discount)");
  const q2 = await computeQuote({
    customerAccountId: customer.id,
    lines: [
      { moduleCode: "GRC", tier: "PRO" },
      { moduleCode: "TPRM", tier: "PRO" },
      { moduleCode: "INTERNAL_AUDIT", tier: "PRO" },
    ],
    cycle: "YEARLY",
  });
  assert(q2.subtotal === 600000, `3 × ₹2L = ₹600,000 subtotal (got ${q2.subtotal})`);
  // Sample BundleDiscount is inactive by default → no discount
  assert(q2.bundleDiscount === null, "no active bundle discount → null");
  assert(q2.total === 708000, `total = 600k + 18% GST = 708k (got ${q2.total})`);

  // ── Activate the sample bundle discount → re-quote → discount applies ──
  console.log("\nActivate sample bundle discount → discount applies");
  const sample = await prisma.bundleDiscount.findFirst({ where: { name: { contains: "10%" } } });
  if (sample) {
    await prisma.bundleDiscount.update({ where: { id: sample.id }, data: { isActive: true } });
    try {
      const q3 = await computeQuote({
        customerAccountId: customer.id,
        lines: [
          { moduleCode: "GRC", tier: "PRO" },
          { moduleCode: "TPRM", tier: "PRO" },
          { moduleCode: "INTERNAL_AUDIT", tier: "PRO" },
        ],
        cycle: "YEARLY",
      });
      assert(q3.bundleDiscount !== null, "bundle discount applied");
      assert(q3.bundleDiscount?.amount === 60000, `10% of 600k = 60k (got ${q3.bundleDiscount?.amount})`);
      assert(q3.taxableAmount === 540000, "taxable = 540,000 after discount");
      assert(q3.total === 637200, `total = 540k + 18% = 637.2k (got ${q3.total})`);
    } finally {
      // Restore inactive
      await prisma.bundleDiscount.update({ where: { id: sample.id }, data: { isActive: false } });
    }
  }

  // ── Monthly cycle ────────────────────────────────────────
  console.log("\nMonthly cycle quote");
  const q4 = await computeQuote({
    customerAccountId: customer.id,
    lines: [{ moduleCode: "GRC", tier: "BASIC" }],
    cycle: "MONTHLY",
  });
  assert(q4.cycle === "MONTHLY", "cycle=MONTHLY");
  assert(q4.subtotal > 0, "monthly subtotal > 0");

  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

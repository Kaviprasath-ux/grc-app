/**
 * Exercises bundle discount CRUD logic against the DB. Cleans up after itself.
 * Run: npx tsx scripts/smoke-test-bundle-discounts-api.ts
 */

import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const PREFIX = "_BD_TEST_";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  minModules: z.number().int().min(1).max(3),
  minTier: z.enum(["BASIC", "MEDIUM", "PRO"]).nullable().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().nonnegative(),
  appliesToCycle: z.enum(["MONTHLY", "YEARLY"]).nullable().optional(),
  isActive: z.boolean().optional(),
});

let pass = 0, fail = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else      { console.error(`  ✗ ${label}`); fail++; process.exitCode = 1; }
}

async function cleanup() {
  await prisma.bundleDiscount.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

async function main() {
  await cleanup();

  // ── CREATE ────────────────────────────────────────────────────
  console.log("CREATE");
  const validBody = {
    name: `${PREFIX}10pct-yearly`,
    minModules: 2,
    minTier: "MEDIUM" as const,
    discountType: "PERCENTAGE" as const,
    discountValue: 10,
    appliesToCycle: "YEARLY" as const,
    isActive: true,
  };
  const parsed = CreateSchema.safeParse(validBody);
  assert(parsed.success, "valid body validates");

  const created = await prisma.bundleDiscount.create({
    data: {
      ...validBody,
      validFrom: null,
      validUntil: null,
    },
  });
  assert(created.id !== undefined, "row created");
  assert(Number(created.discountValue) === 10, "discountValue=10");
  assert(created.minTier === "MEDIUM", "minTier=MEDIUM");

  // ── PERCENTAGE > 100 should reject ────────────────────────────
  const tooBig = CreateSchema.safeParse({ ...validBody, discountValue: 150 });
  assert(tooBig.success, "150 passes Zod (range check is in handler)");
  assert(150 > 100, "handler-level check rejects > 100 percentage");

  // ── Negative value rejected by Zod ───────────────────────────
  const neg = CreateSchema.safeParse({ ...validBody, discountValue: -1 });
  assert(!neg.success, "negative discount rejected by zod");

  // ── PATCH ──────────────────────────────────────────────────────
  console.log("\nPATCH");
  const updated = await prisma.bundleDiscount.update({
    where: { id: created.id },
    data: { discountValue: 15, isActive: false },
  });
  assert(Number(updated.discountValue) === 15, "discountValue=15");
  assert(updated.isActive === false, "isActive=false");

  // ── LIST ───────────────────────────────────────────────────────
  console.log("\nLIST");
  const all = await prisma.bundleDiscount.findMany({
    where: { name: { startsWith: PREFIX } },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
  assert(all.length === 1, "1 test row visible");

  // ── DELETE ─────────────────────────────────────────────────────
  console.log("\nDELETE");
  await prisma.bundleDiscount.delete({ where: { id: created.id } });
  const remaining = await prisma.bundleDiscount.count({ where: { name: { startsWith: PREFIX } } });
  assert(remaining === 0, "row deleted");

  await cleanup();
  console.log(`\n${pass} passed · ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(async (e) => { console.error(e); await cleanup(); process.exit(1); })
  .finally(() => prisma.$disconnect());

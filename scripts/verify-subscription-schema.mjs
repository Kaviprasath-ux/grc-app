import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tables = [
  "ModuleTierPricing",
  "Subscription",
  "ModuleSubscription",
  "CustomerPlanOverride",
  "BundleDiscount",
  "Invoice",
  "InvoiceItem",
  "Payment",
];

const results = await Promise.all(
  tables.map(async (t) => {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c FROM "${t}"`
      );
      return `${t}: OK (${rows[0].c} rows)`;
    } catch (e) {
      return `${t}: MISSING - ${e.message.split("\n")[0]}`;
    }
  })
);
results.forEach((r) => console.log(r));

// Verify isInternalAuditEnabled column
try {
  const sample = await prisma.$queryRawUnsafe(
    `SELECT "isInternalAuditEnabled" FROM "CustomerAccount" LIMIT 1`
  );
  console.log("CustomerAccount.isInternalAuditEnabled: OK");
} catch (e) {
  console.log("CustomerAccount.isInternalAuditEnabled: MISSING -", e.message.split("\n")[0]);
}

// Verify SubscriptionPlan additions
try {
  await prisma.$queryRawUnsafe(
    `SELECT "moduleCode", "tier" FROM "SubscriptionPlan" LIMIT 1`
  );
  console.log("SubscriptionPlan.moduleCode + tier: OK");
} catch (e) {
  console.log("SubscriptionPlan additions: MISSING -", e.message.split("\n")[0]);
}

await prisma.$disconnect();

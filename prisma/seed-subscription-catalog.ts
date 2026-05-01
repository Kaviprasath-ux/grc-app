import { PrismaClient, PlanTier, BillingCycle, DiscountType } from "@prisma/client";

/**
 * Seeds the default tier pricing catalog (9 rows: 3 modules × 3 tiers)
 * and one example inactive bundle discount.
 *
 * Idempotent — uses upsert keyed on (moduleCode, tier).
 *
 * Default pricing (admin can change later via /grc/subscription-pricing):
 *   Basic:  ₹5,000/mo  · ₹50,000/yr
 *   Medium: ₹10,000/mo · ₹1,00,000/yr
 *   Pro:    ₹20,000/mo · ₹2,00,000/yr
 *
 * Limit conventions:
 *   - null  → unlimited (UI displays "Unlimited")
 *   - field omitted (undefined) → not applicable to that module
 */

type CatalogRow = {
  moduleCode: "GRC" | "TPRM" | "INTERNAL_AUDIT";
  tier: PlanTier;
  monthlyPrice: number;
  yearlyPrice: number;
  userLimit: number;
  vendorLimit?: number | null;
  assessmentLimit?: number | null;
  frameworkLimit?: number | null;
  auditLimit?: number | null;
};

const CATALOG: CatalogRow[] = [
  // ─── GRC ──────────────────────────────────────────────────────
  { moduleCode: "GRC", tier: "BASIC",  monthlyPrice:  5000, yearlyPrice:  50000, userLimit:  5, frameworkLimit: 3 },
  { moduleCode: "GRC", tier: "MEDIUM", monthlyPrice: 10000, yearlyPrice: 100000, userLimit: 15, frameworkLimit: 10 },
  { moduleCode: "GRC", tier: "PRO",    monthlyPrice: 20000, yearlyPrice: 200000, userLimit: 50, frameworkLimit: null /* unlimited */ },

  // ─── TPRM ─────────────────────────────────────────────────────
  { moduleCode: "TPRM", tier: "BASIC",  monthlyPrice:  5000, yearlyPrice:  50000, userLimit:  5, vendorLimit:  10, assessmentLimit:  20 },
  { moduleCode: "TPRM", tier: "MEDIUM", monthlyPrice: 10000, yearlyPrice: 100000, userLimit: 15, vendorLimit:  50, assessmentLimit: 100 },
  { moduleCode: "TPRM", tier: "PRO",    monthlyPrice: 20000, yearlyPrice: 200000, userLimit: 50, vendorLimit: 250, assessmentLimit: 500 },

  // ─── INTERNAL_AUDIT ──────────────────────────────────────────
  { moduleCode: "INTERNAL_AUDIT", tier: "BASIC",  monthlyPrice:  5000, yearlyPrice:  50000, userLimit:  5, auditLimit: 5 },
  { moduleCode: "INTERNAL_AUDIT", tier: "MEDIUM", monthlyPrice: 10000, yearlyPrice: 100000, userLimit: 15, auditLimit: 20 },
  { moduleCode: "INTERNAL_AUDIT", tier: "PRO",    monthlyPrice: 20000, yearlyPrice: 200000, userLimit: 50, auditLimit: null /* unlimited */ },
];

export async function seedSubscriptionCatalog(prisma: PrismaClient) {
  console.log("🌱 Seeding subscription catalog (tier pricing + bundle discount)...");

  for (const row of CATALOG) {
    await prisma.moduleTierPricing.upsert({
      where: { moduleCode_tier: { moduleCode: row.moduleCode, tier: row.tier } },
      update: {
        monthlyPrice: row.monthlyPrice,
        yearlyPrice: row.yearlyPrice,
        userLimit: row.userLimit,
        vendorLimit: row.vendorLimit ?? null,
        assessmentLimit: row.assessmentLimit ?? null,
        frameworkLimit: row.frameworkLimit ?? null,
        auditLimit: row.auditLimit ?? null,
        currency: "INR",
        isActive: true,
      },
      create: {
        moduleCode: row.moduleCode,
        tier: row.tier,
        monthlyPrice: row.monthlyPrice,
        yearlyPrice: row.yearlyPrice,
        userLimit: row.userLimit,
        vendorLimit: row.vendorLimit ?? null,
        assessmentLimit: row.assessmentLimit ?? null,
        frameworkLimit: row.frameworkLimit ?? null,
        auditLimit: row.auditLimit ?? null,
        currency: "INR",
        isActive: true,
      },
    });
  }
  console.log(`  ✓ Upserted ${CATALOG.length} ModuleTierPricing rows`);

  // Sample inactive bundle discount — admin can activate later
  const sampleDiscountName = "All-3 modules · 10% off · yearly · min Pro";
  const existing = await prisma.bundleDiscount.findFirst({ where: { name: sampleDiscountName } });
  if (!existing) {
    await prisma.bundleDiscount.create({
      data: {
        name: sampleDiscountName,
        minModules: 3,
        minTier: "PRO",
        discountType: "PERCENTAGE",
        discountValue: 10,
        appliesToCycle: "YEARLY",
        isActive: false,
      },
    });
    console.log("  ✓ Created sample BundleDiscount (inactive — admin can activate)");
  } else {
    console.log("  ✓ Sample BundleDiscount already exists, skipping");
  }

  console.log("✅ Subscription catalog seeded");
}

// Allow running this file standalone: `npx tsx prisma/seed-subscription-catalog.ts`
if (require.main === module) {
  const prisma = new PrismaClient();
  seedSubscriptionCatalog(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

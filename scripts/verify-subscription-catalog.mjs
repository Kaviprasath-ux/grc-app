import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const rows = await prisma.moduleTierPricing.findMany({
  orderBy: [{ moduleCode: "asc" }, { tier: "asc" }],
});

console.log("\nModuleTierPricing rows:");
console.log("─".repeat(100));
console.log(
  "Module".padEnd(18) +
    "Tier".padEnd(10) +
    "Monthly".padStart(12) +
    "Yearly".padStart(14) +
    "Users".padStart(8) +
    "Vendors".padStart(10) +
    "Assess.".padStart(10) +
    "Frwks".padStart(8) +
    "Audits".padStart(10)
);
console.log("─".repeat(100));
rows.forEach((r) => {
  console.log(
    r.moduleCode.padEnd(18) +
      r.tier.padEnd(10) +
      `₹${Number(r.monthlyPrice).toLocaleString("en-IN")}`.padStart(12) +
      `₹${Number(r.yearlyPrice).toLocaleString("en-IN")}`.padStart(14) +
      String(r.userLimit).padStart(8) +
      String(r.vendorLimit ?? "—").padStart(10) +
      String(r.assessmentLimit ?? "—").padStart(10) +
      String(r.frameworkLimit ?? "∞").padStart(8) +
      String(r.auditLimit ?? "∞").padStart(10)
  );
});

const discounts = await prisma.bundleDiscount.findMany();
console.log("\nBundleDiscount rows:");
discounts.forEach((d) =>
  console.log(
    `  ${d.name} | ${d.discountType} ${d.discountValue}% | active=${d.isActive}`
  )
);

console.log(`\nTotals: ${rows.length} pricing rows · ${discounts.length} discount rows`);
await prisma.$disconnect();

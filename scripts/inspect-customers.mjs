import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const customers = await prisma.customerAccount.findMany({
  select: {
    id: true,
    code: true,
    name: true,
    isGrcAdded: true,
    isTprmAdded: true,
    isInternalAuditEnabled: true,
    isQpostComplianceEnabled: true,
    subscription: { select: { id: true } },
    subscriptionPlans: {
      where: { status: "Active" },
      select: {
        id: true,
        startDate: true,
        expiryDate: true,
        maxFrameworksAllowed: true,
        maxAccountsAllowed: true,
        vendorLimit: true,
        assessmentLimit: true,
        frameworksUsed: true,
        accountsUsed: true,
      },
    },
  },
});

console.log(`Total customers: ${customers.length}\n`);
for (const c of customers) {
  const flags = [
    c.isGrcAdded ? "GRC" : null,
    c.isTprmAdded ? "TPRM" : null,
    c.isInternalAuditEnabled ? "IA" : null,
    c.isQpostComplianceEnabled ? "QPost" : null,
  ].filter(Boolean).join("+") || "(none)";
  const planLimits = c.subscriptionPlans.length
    ? c.subscriptionPlans
        .map(p => `frwks=${p.maxFrameworksAllowed},accts=${p.maxAccountsAllowed},vendors=${p.vendorLimit},assess=${p.assessmentLimit},exp=${p.expiryDate.toISOString().slice(0,10)}`)
        .join(" | ")
    : "(no active plans)";
  console.log(`${c.code.padEnd(12)} | ${c.name.padEnd(38)} | ${flags.padEnd(20)} | sub=${c.subscription ? "Y" : "N"} | ${planLimits}`);
}

await prisma.$disconnect();

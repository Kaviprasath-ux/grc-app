import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const subs = await prisma.subscription.findMany({
  include: {
    customerAccount: { select: { code: true, name: true, isGrcAdded: true, isTprmAdded: true, isInternalAuditEnabled: true } },
    modules: { orderBy: { moduleCode: "asc" } },
  },
  orderBy: { createdAt: "asc" },
});

const overrides = await prisma.customerPlanOverride.count();
const moduleSubs = await prisma.moduleSubscription.count();

console.log(`Subscriptions: ${subs.length}`);
console.log(`ModuleSubscriptions: ${moduleSubs}`);
console.log(`CustomerPlanOverrides: ${overrides}\n`);

for (const s of subs) {
  console.log(`${s.customerAccount.code} (${s.customerAccount.name})`);
  console.log(`  flags: GRC=${s.customerAccount.isGrcAdded} TPRM=${s.customerAccount.isTprmAdded} IA=${s.customerAccount.isInternalAuditEnabled}`);
  console.log(`  status=${s.status} type=${s.subscriptionType} autoRenew=${s.autoRenew} notes="${s.notes ?? ""}"`);
  for (const m of s.modules) {
    console.log(`    └ ${m.moduleCode.padEnd(16)} ${m.tier} ${m.billingCycle} · users=${m.userLimit} vendors=${m.vendorLimit ?? "—"} frwks=${m.frameworkLimit === null ? "∞" : m.frameworkLimit ?? "—"} audits=${m.auditLimit === null ? "∞" : m.auditLimit ?? "—"} · cycleEnd=${m.cycleEnd.toISOString().slice(0,10)}`);
  }
}

console.log("\nCustomerPlanOverride rows:");
const ovs = await prisma.customerPlanOverride.findMany({
  include: { customerAccount: { select: { code: true } } },
  orderBy: [{ customerAccountId: "asc" }, { moduleCode: "asc" }],
});
for (const o of ovs) {
  console.log(`  ${o.customerAccount.code} · ${o.moduleCode} · users=${o.userLimit} vendors=${o.vendorLimit ?? "—"} frwks=${o.frameworkLimit ?? "—"} · "${o.reason}"`);
}

await prisma.$disconnect();

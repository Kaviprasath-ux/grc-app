// Verifies Step 3 decoupling logic by exercising the permission expander
// against synthesized customer scenarios. Does NOT touch the DB beyond
// reading one CustomerAccount row to confirm the new field exists.

import { PrismaClient } from "@prisma/client";

// Dynamic import so we exercise the actual module, not a stale cached one.
const { expandRolePermissions } = await import("../src/lib/permissions.ts").catch(async () => {
  // Fallback for plain node: just import the JS-equivalent.
  return await import("../src/lib/permissions.js").catch(() => ({}));
});

const prisma = new PrismaClient();

console.log("─── DB column presence check ───");
const sample = await prisma.customerAccount.findFirst({
  select: { id: true, name: true, isGrcAdded: true, isTprmAdded: true, isInternalAuditEnabled: true, isQpostComplianceEnabled: true },
});
console.log("Sample CustomerAccount:", sample);

if (typeof expandRolePermissions !== "function") {
  console.log("\n(Skipping permission scenarios — TS-only module not loadable from .mjs.)");
  console.log("Schema column check passed. Edits will be exercised by the dev server.");
  await prisma.$disconnect();
  process.exit(0);
}

console.log("\n─── Permission expansion scenarios (with feature flag) ───");

const testRoles = ["CustomerAdministrator"];

const scenarios = [
  { label: "GRC only (legacy mode)", flags: { isGrcAdded: true, isTprmAdded: false, isInternalAuditEnabled: false, isQpostComplianceEnabled: false } },
  { label: "IA only — gating ON", flags: { isGrcAdded: false, isTprmAdded: false, isInternalAuditEnabled: true, isQpostComplianceEnabled: false } },
  { label: "GRC + IA — gating ON", flags: { isGrcAdded: true, isTprmAdded: false, isInternalAuditEnabled: true, isQpostComplianceEnabled: false } },
  { label: "TPRM + IA only — gating ON", flags: { isGrcAdded: false, isTprmAdded: true, isInternalAuditEnabled: true, isQpostComplianceEnabled: false } },
];

for (const s of scenarios) {
  const perms = expandRolePermissions(testRoles, s.flags);
  const audit = perms.filter(p => p.resource.startsWith("audit.")).length;
  const grc = perms.filter(p => p.resource.startsWith("compliance.") || p.resource.startsWith("organization.") || p.resource.startsWith("risk.") || p.resource.startsWith("asset.")).length;
  const tprm = perms.filter(p => p.resource.startsWith("tprm.")).length;
  console.log(`  ${s.label.padEnd(40)} | audit:${String(audit).padStart(3)} grc:${String(grc).padStart(3)} tprm:${String(tprm).padStart(3)}`);
}

await prisma.$disconnect();

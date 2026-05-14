/**
 * Phase 1 backfill: populate UserRole.moduleCode for existing rows.
 *
 * Without this, every existing user gets "No active workspaces" on login.
 * Run this AFTER `npx prisma db push --accept-data-loss` (which adds the
 * column) and BEFORE users log in.
 *
 * Logic:
 *   - System roles (GRCAdministrator, TPRMAdmin)            → keep moduleCode=NULL
 *   - AuditHead / Auditor / AuditUser / Auditee             → INTERNAL_AUDIT
 *   - TPRM-family (BusinessOwner, RelationshipManager, etc) → TPRM
 *   - Reviewer / Contributor / Dept*                        → GRC
 *   - CustomerAdministrator → derive from customer's is*Enabled flags;
 *                              clone one row per active module
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "<direct-url>"
 *   npx tsx scripts/prod-backfill-module-code.ts
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

const IA_ROLES = new Set(["AuditHead", "Auditor", "AuditUser", "Auditee"]);
const TPRM_ROLES = new Set([
  "TPRMCustomerAdmin",
  "FactoryAdmin",
  "FactoryAssessor",
  "BusinessOwner",
  "RelationshipManager",
  "TPRMAssessor",
  "TPRMApprover",
  "TPRMAuditor",
  "AccountManager",
  "TPRMSME",
  "InternalITTeam",
]);
const GRC_ROLES = new Set([
  "Reviewer",
  "Contributor",
  "DepartmentReviewer",
  "DepartmentContributor",
]);
const SYSTEM_ROLES = new Set(["GRCAdministrator", "TPRMAdmin"]);

async function main() {
  console.log("\nBackfilling UserRole.moduleCode…\n");

  // 1. Single-module roles (deterministic from role name)
  const rows = await p.userRole.findMany({
    where: { moduleCode: null },
    include: { role: { select: { name: true } }, user: { select: { customerAccountId: true } } },
  });
  console.log(`Found ${rows.length} UserRole row(s) with moduleCode=NULL.\n`);

  let iaCount = 0;
  let tprmCount = 0;
  let grcCount = 0;
  let systemKept = 0;
  let customerAdminProcessed = 0;
  let cloned = 0;

  for (const ur of rows) {
    const name = ur.role.name;

    if (SYSTEM_ROLES.has(name)) {
      // Leave NULL — system role
      systemKept++;
      continue;
    }

    if (IA_ROLES.has(name)) {
      await p.userRole.update({ where: { id: ur.id }, data: { moduleCode: "INTERNAL_AUDIT" } });
      iaCount++;
      continue;
    }

    if (TPRM_ROLES.has(name)) {
      await p.userRole.update({ where: { id: ur.id }, data: { moduleCode: "TPRM" } });
      tprmCount++;
      continue;
    }

    if (GRC_ROLES.has(name)) {
      await p.userRole.update({ where: { id: ur.id }, data: { moduleCode: "GRC" } });
      grcCount++;
      continue;
    }

    if (name === "CustomerAdministrator") {
      // Customer admin — clone into one row per active customer module.
      // Priority: GRC > INTERNAL_AUDIT > TPRM (matches existing migration SQL).
      if (!ur.user.customerAccountId) {
        console.warn(`  ! CustomerAdministrator row ${ur.id} has no customerAccountId; skipping.`);
        continue;
      }
      const customer = await p.customerAccount.findUnique({
        where: { id: ur.user.customerAccountId },
        select: { isGrcAdded: true, isInternalAuditEnabled: true, isTprmAdded: true },
      });
      if (!customer) continue;

      const modulesToTag: ("GRC" | "INTERNAL_AUDIT" | "TPRM")[] = [];
      if (customer.isGrcAdded) modulesToTag.push("GRC");
      if (customer.isInternalAuditEnabled) modulesToTag.push("INTERNAL_AUDIT");
      if (customer.isTprmAdded) modulesToTag.push("TPRM");

      if (modulesToTag.length === 0) {
        // No active flags — default to GRC so the row isn't orphaned
        modulesToTag.push("GRC");
      }

      // Update the existing row to the first module
      await p.userRole.update({
        where: { id: ur.id },
        data: { moduleCode: modulesToTag[0] },
      });

      // Insert additional rows for the rest
      for (let i = 1; i < modulesToTag.length; i++) {
        const exists = await p.userRole.findFirst({
          where: { userId: ur.userId, roleId: ur.roleId, moduleCode: modulesToTag[i] },
        });
        if (!exists) {
          await p.userRole.create({
            data: { userId: ur.userId, roleId: ur.roleId, moduleCode: modulesToTag[i] },
          });
          cloned++;
        }
      }
      customerAdminProcessed++;
      continue;
    }

    console.warn(`  ? Unknown role "${name}" on row ${ur.id} — leaving moduleCode=NULL`);
  }

  console.log("\nSummary:");
  console.log(`  INTERNAL_AUDIT tagged: ${iaCount}`);
  console.log(`  TPRM tagged:           ${tprmCount}`);
  console.log(`  GRC tagged:            ${grcCount}`);
  console.log(`  System kept NULL:      ${systemKept}`);
  console.log(`  CustomerAdmin updated: ${customerAdminProcessed}`);
  console.log(`  CustomerAdmin cloned:  ${cloned} (additional rows for multi-module customers)`);

  // Verification
  const remaining = await p.userRole.count({ where: { moduleCode: null } });
  console.log(`\nUserRole rows still with moduleCode=NULL: ${remaining}`);
  console.log(`  (expected: just system roles — GRCAdministrator/TPRMAdmin)`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

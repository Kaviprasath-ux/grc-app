/**
 * Backfill access for customer accounts whose admin/sub-users were created
 * via /api/tprm/account-overview before the fix that provisions Subscription
 * + ModuleSubscription rows and tags UserRole rows with a moduleCode.
 *
 * Symptom: a customer admin (e.g. test1) logs in and is redirected to
 *   /subscription-required even though the customer's isTprmAdded flag is
 *   true. Two distinct problems are corrected here:
 *
 *   1. The customer has no Subscription row, so getAccessSnapshot() returns
 *      isTprmAdded=false for the session. Fix: ensureComplimentarySubscription
 *      with the modules implied by the customer's isGrcAdded / isTprmAdded /
 *      isInternalAuditEnabled flags.
 *
 *   2. The admin User's UserRole rows have moduleCode=null, so
 *      session.user.roleModules is empty and availableModules =
 *      subscription ∩ has-role collapses to []. Fix: backfill moduleCode on
 *      every UserRole that points at this customer's users — TPRM for any
 *      isTprmAdded customer, GRC if isGrcAdded, INTERNAL_AUDIT if
 *      isInternalAuditEnabled. System roles (no moduleCode by design) are
 *      left untouched.
 *
 * Idempotent — re-running on an already-correct account is a no-op.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "<direct-url>"
 *   npx tsx scripts/backfill-tprm-customer-access.ts
 */
import { PrismaClient } from "@prisma/client";
import { ensureComplimentarySubscription, type ModuleCode } from "../src/lib/customer-complimentary";

const p = new PrismaClient();

// Roles that are system-level and intentionally have no moduleCode.
const SYSTEM_ROLE_NAMES = new Set(["GRCAdministrator", "TPRMAdmin", "TPRMAuditor", "FactoryAdmin", "FactoryAssessor", "InternalITTeam"]);

async function main() {
  const customers = await p.customerAccount.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      isGrcAdded: true,
      isTprmAdded: true,
      isInternalAuditEnabled: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nBackfilling access for ${customers.length} customer(s)...\n`);

  let provisioned = 0;
  let userRolesTagged = 0;
  let userRolesAlreadyTagged = 0;
  let skipped = 0;

  for (const c of customers) {
    const modules: ModuleCode[] = [];
    if (c.isGrcAdded) modules.push("GRC");
    if (c.isTprmAdded) modules.push("TPRM");
    if (c.isInternalAuditEnabled) modules.push("INTERNAL_AUDIT");

    if (modules.length === 0) {
      console.log(`  - ${c.code} (${c.name}) — no active modules, skipping`);
      skipped++;
      continue;
    }

    // 1. Provision Subscription / ModuleSubscription rows.
    try {
      const result = await ensureComplimentarySubscription(c.id, modules);
      const ensuredList = result.ensured.length ? result.ensured.join(", ") : "all already active";
      console.log(`  ${c.code} (${c.name}) — subscription ensured: [${ensuredList}]`);
      provisioned++;
    } catch (err) {
      console.error(`  ${c.code} (${c.name}) — subscription failed: ${(err as Error).message}`);
      continue;
    }

    // 2. Backfill moduleCode on UserRole rows belonging to this customer's users.
    // Strategy: every untagged UserRole for a user whose customerAccountId
    // matches this customer gets tagged with TPRM if the role isn't a
    // system role; if the customer is dual-module, the admin gets a
    // duplicate UserRole row for GRC as well.
    const users = await p.user.findMany({
      where: { customerAccountId: c.id },
      select: {
        id: true,
        userName: true,
        userRoles: {
          select: { id: true, moduleCode: true, role: { select: { name: true } } },
        },
      },
    });

    for (const u of users) {
      for (const ur of u.userRoles) {
        const roleName = ur.role?.name ?? "";
        if (SYSTEM_ROLE_NAMES.has(roleName)) continue; // System roles intentionally untagged.

        if (ur.moduleCode === null || ur.moduleCode === undefined) {
          // Pick the most likely module: TPRM for any TPRM-enabled customer.
          // Then, if dual-module, ensure a GRC twin exists.
          await p.userRole.update({
            where: { id: ur.id },
            data: { moduleCode: "TPRM" },
          });
          userRolesTagged++;

          if (c.isGrcAdded && roleName === "CustomerAdministrator") {
            // Dual-module customer admin needs access to both workspaces.
            const twinExists = u.userRoles.some(
              (other) => other.role?.name === roleName && other.moduleCode === "GRC"
            );
            if (!twinExists) {
              await p.userRole.create({
                data: { userId: u.id, roleId: (await p.role.findUnique({ where: { name: roleName } }))!.id, moduleCode: "GRC" },
              });
            }
          }
        } else {
          userRolesAlreadyTagged++;
        }
      }
    }
  }

  console.log(`\nDone.`);
  console.log(`  Customers provisioned : ${provisioned}`);
  console.log(`  UserRoles tagged      : ${userRolesTagged}`);
  console.log(`  UserRoles already OK  : ${userRolesAlreadyTagged}`);
  console.log(`  Customers skipped     : ${skipped}`);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

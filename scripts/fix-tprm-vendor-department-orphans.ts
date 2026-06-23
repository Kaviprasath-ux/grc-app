/**
 * One-off DB repair: null out TPRMVendor.departmentId values that no
 * longer reference a row in the renamed TPRMDepartment table.
 *
 * Why: a recent schema change repointed TPRMVendor.department from the
 * GRC Department table to a new TPRMDepartment table. Existing vendor
 * rows still hold IDs from the old (GRC) Department table, which makes
 * Prisma migrate fail when it tries to add the new FK constraint.
 *
 * Run:  npx tsx scripts/fix-tprm-vendor-department-orphans.ts
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const orphans = await p.$queryRawUnsafe<Array<{ id: string; departmentId: string; name: string }>>(
    `SELECT v.id, v."departmentId", v.name
     FROM "TPRMVendor" v
     LEFT JOIN "TPRMDepartment" d ON d.id = v."departmentId"
     WHERE v."departmentId" IS NOT NULL AND d.id IS NULL`
  );
  console.log(`Orphan rows: ${orphans.length}`);
  for (const o of orphans) console.log(`  ${o.id} → ${o.departmentId}  (vendor: ${o.name})`);

  if (orphans.length === 0) {
    console.log("Nothing to fix.");
    await p.$disconnect();
    return;
  }

  const updated = await p.$executeRawUnsafe(
    `UPDATE "TPRMVendor"
     SET "departmentId" = NULL
     WHERE "departmentId" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "TPRMDepartment" d WHERE d.id = "TPRMVendor"."departmentId")`
  );
  console.log(`Nulled ${updated} row(s).`);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

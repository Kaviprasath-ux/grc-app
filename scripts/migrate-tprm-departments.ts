/**
 * One-time migration: separate TPRM departments from GRC departments.
 *
 * Background
 * ----------
 * Historically `User.departmentId` (for TPRM Business Owner / Relationship
 * Manager users) and `TPRMVendor.departmentId` were foreign keys to the GRC
 * `Department` table. TPRM department picks were therefore written into the
 * GRC Department list, leaking them into every GRC department dropdown.
 *
 * The schema now points both at `TPRMDepartment`:
 *   - User.tprmDepartmentId  -> TPRMDepartment   (new column)
 *   - TPRMVendor.departmentId -> TPRMDepartment  (re-targeted FK)
 *
 * This script moves the existing live data onto the new model and removes the
 * GRC Department rows that were only ever created by TPRM.
 *
 * Safe ordering (run while the DB is still on the OLD foreign keys):
 *   1. Drop the old TPRMVendor -> Department FK so we can re-point values.
 *   2. Add the User.tprmDepartmentId column so we can backfill it.
 *   3. Backfill: for every TPRM user / vendor that references a GRC Department,
 *      find-or-create the matching TPRMDepartment (by name, per customer) and
 *      store its id; clear the GRC reference on users.
 *   4. Delete the now-unreferenced GRC Department rows that match a
 *      TPRMDepartment name (the leaked ones). Real GRC departments that are
 *      still referenced elsewhere are left untouched (delete is best-effort).
 *
 * After this script, run `npx prisma db push` to add the new foreign keys.
 *
 * Idempotent: safe to re-run.
 */
import prisma from '../src/lib/prisma';

async function main() {
  console.log('--- TPRM department separation migration ---');

  // 1. Drop the old TPRMVendor -> Department foreign key (if still present) so
  //    we can re-point departmentId values to TPRMDepartment ids.
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "TPRMVendor" DROP CONSTRAINT IF EXISTS "TPRMVendor_departmentId_fkey";'
  );
  console.log('1. Dropped old TPRMVendor.departmentId FK (if it existed).');

  // 2. Make sure the new User.tprmDepartmentId column exists before we backfill.
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tprmDepartmentId" TEXT;'
  );
  console.log('2. Ensured User.tprmDepartmentId column exists.');

  // Build a per-(customer,name) cache so we only create each TPRMDepartment once.
  const tprmDeptCache = new Map<string, string>(); // key: `${customerAccountId}::${lowerName}`
  async function ensureTprmDept(customerAccountId: string, name: string): Promise<string> {
    const key = `${customerAccountId}::${name.trim().toLowerCase()}`;
    const cached = tprmDeptCache.get(key);
    if (cached) return cached;

    const existing = await prisma.tPRMDepartment.findFirst({
      where: { customerAccountId, name: { equals: name.trim(), mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      tprmDeptCache.set(key, existing.id);
      return existing.id;
    }
    const created = await prisma.tPRMDepartment.create({
      data: { customerAccountId, name: name.trim() },
      select: { id: true },
    });
    tprmDeptCache.set(key, created.id);
    return created.id;
  }

  // Load all GRC departments once (id -> {customerAccountId, name}).
  const grcDepartments = await prisma.department.findMany({
    select: { id: true, customerAccountId: true, name: true },
  });
  const grcById = new Map(grcDepartments.map((d) => [d.id, d]));

  // 3a. Backfill TPRM users (Business Owner / Relationship Manager) that still
  //     point at a GRC Department via the legacy departmentId column.
  const tprmUsers = await prisma.user.findMany({
    where: { tprmRole: { not: null }, departmentId: { not: null } },
    select: { id: true, customerAccountId: true, departmentId: true, tprmDepartmentId: true },
  });
  let usersMoved = 0;
  for (const u of tprmUsers) {
    const grc = u.departmentId ? grcById.get(u.departmentId) : null;
    if (!grc) {
      // Dangling GRC reference — just clear it.
      await prisma.user.update({ where: { id: u.id }, data: { departmentId: null } });
      continue;
    }
    const tprmId = u.tprmDepartmentId ?? (await ensureTprmDept(grc.customerAccountId, grc.name));
    await prisma.user.update({
      where: { id: u.id },
      data: { tprmDepartmentId: tprmId, departmentId: null },
    });
    usersMoved++;
  }
  console.log(`3a. Moved ${usersMoved} TPRM user department reference(s) to TPRMDepartment.`);

  // 3b. Re-point TPRMVendor.departmentId values. A value may already be a
  //     TPRMDepartment id (newer form submissions) — leave those. A value that
  //     matches a GRC Department id is remapped by name. Anything else is cleared.
  const tprmDeptIds = new Set(
    (await prisma.tPRMDepartment.findMany({ select: { id: true } })).map((d) => d.id)
  );
  const vendors = await prisma.tPRMVendor.findMany({
    where: { departmentId: { not: null } },
    select: { id: true, customerAccountId: true, departmentId: true },
  });
  let vendorsRemapped = 0;
  let vendorsCleared = 0;
  for (const v of vendors) {
    const deptId = v.departmentId!;
    if (tprmDeptIds.has(deptId)) continue; // already a TPRMDepartment id

    const grc = grcById.get(deptId);
    if (grc) {
      const tprmId = await ensureTprmDept(grc.customerAccountId, grc.name);
      await prisma.tPRMVendor.update({ where: { id: v.id }, data: { departmentId: tprmId } });
      vendorsRemapped++;
    } else {
      await prisma.tPRMVendor.update({ where: { id: v.id }, data: { departmentId: null } });
      vendorsCleared++;
    }
  }
  console.log(
    `3b. Vendors remapped to TPRMDepartment: ${vendorsRemapped}, cleared (dangling): ${vendorsCleared}.`
  );

  // 4. Delete leaked GRC Department rows: those whose name matches a
  //    TPRMDepartment for the same customer. Best-effort — if a row is still
  //    referenced by a genuine GRC entity the delete is skipped, so real GRC
  //    departments that happen to share a name are preserved.
  const allTprmDepts = await prisma.tPRMDepartment.findMany({
    select: { customerAccountId: true, name: true },
  });
  const tprmNameSet = new Set(
    allTprmDepts.map((d) => `${d.customerAccountId}::${d.name.trim().toLowerCase()}`)
  );
  let deleted = 0;
  let skipped = 0;
  for (const d of grcDepartments) {
    const key = `${d.customerAccountId}::${d.name.trim().toLowerCase()}`;
    if (!tprmNameSet.has(key)) continue; // not a TPRM-origin name, leave it
    try {
      await prisma.department.delete({ where: { id: d.id } });
      deleted++;
    } catch {
      // Still referenced by a real GRC relation — keep it.
      skipped++;
    }
  }
  console.log(`4. Leaked GRC Department rows deleted: ${deleted}, kept (still referenced): ${skipped}.`);

  console.log('--- Done. Now run: npx prisma db push ---');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

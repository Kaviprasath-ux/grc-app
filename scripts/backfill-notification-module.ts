/**
 * Backfill `Notification.module` for existing rows.
 *
 * The per-workspace notification inbox scopes notifications by `module`. Rows
 * created before that column existed have `module = null`. This script derives
 * the module for those rows from:
 *   1. the event `type` prefix (e.g. TPRM_* → TPRM), then
 *   2. the stored `link` URL prefix (e.g. /tprm/... → TPRM) via getModuleFromPath.
 *
 * Rows whose module can't be determined are left null (shown in every
 * workspace), which is the safe fallback.
 *
 * Idempotent: only touches rows where module IS NULL.
 *
 * Run:  npx tsx scripts/backfill-notification-module.ts
 */
import { prisma } from '../src/lib/prisma';
import { getModuleFromPath, type ModuleCode } from '../src/lib/url-module-map';

function deriveModule(type: string | null, link: string | null): ModuleCode | null {
  // 1. Event-type prefix is the strongest signal for link-less notifications.
  if (type) {
    if (type.startsWith('TPRM_')) return 'TPRM';
    if (type.startsWith('AUDIT_') || type.startsWith('FIELDWORK_') || type.startsWith('ENGAGEMENT')) {
      return 'INTERNAL_AUDIT';
    }
  }
  // 2. Fall back to the link URL prefix.
  if (link) {
    const fromLink = getModuleFromPath(link);
    if (fromLink && fromLink !== 'SYSTEM') return fromLink;
  }
  return null;
}

async function main() {
  const rows = await prisma.notification.findMany({
    where: { module: null },
    select: { id: true, type: true, link: true },
  });

  console.log(`Found ${rows.length} notifications with no module. Deriving…`);

  const counts: Record<string, number> = {};
  let updated = 0;

  for (const row of rows) {
    const module = deriveModule(row.type, row.link);
    if (!module) {
      counts['(left null)'] = (counts['(left null)'] ?? 0) + 1;
      continue;
    }
    await prisma.notification.update({
      where: { id: row.id },
      data: { module },
    });
    counts[module] = (counts[module] ?? 0) + 1;
    updated++;
  }

  console.log('Backfill complete.');
  console.log(`  Updated: ${updated}`);
  console.table(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

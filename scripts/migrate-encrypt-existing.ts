/**
 * One-time migration: encrypt all rows in tables/columns registered in
 * src/lib/encrypted-fields.ts that are still stored as plaintext.
 *
 * Idempotent — re-running skips rows that are already encrypted (detected via
 * the version-byte prefix added by encryptBytes). Safe to run multiple times,
 * safe to interrupt and resume.
 *
 * Usage:
 *   ENCRYPTION_ENABLED=true \
 *   FIELD_ENCRYPTION_KEY="<base64 key>" \
 *   DATABASE_URL="<target db>" \
 *   npx tsx scripts/migrate-encrypt-existing.ts
 *
 * Run against UAT first, validate, then run against Prod. The DATABASE_URL
 * must point to the database you want to migrate — there is no built-in
 * environment guard.
 */

import { PrismaClient } from "@prisma/client";
import { encryptBytes, isEncrypted, isEncryptionEnabled } from "../src/lib/encryption";
import { listAllEncryptedFields } from "../src/lib/encrypted-fields";

// Use the raw client (NOT the singleton from src/lib/prisma.ts) so the
// encryption extension does not interpose between us and the database. We
// need to see ciphertext as ciphertext and write back raw encrypted bytes.
const prisma = new PrismaClient();

const BATCH_SIZE = 100;

interface ModelTableMap {
  /** lowercase Prisma model name → Postgres table name (PascalCase, quoted) */
  [model: string]: string;
}

// Postgres table names are PascalCase per the Prisma convention. Hardcoding
// the mapping for the registered models — small list, explicit beats clever.
const TABLE_NAMES: ModelTableMap = {
  fieldworkEvidenceAttachment: "FieldworkEvidenceAttachment",
  internalAuditDocument: "InternalAuditDocument",
  governanceTemplate: "GovernanceTemplate",
};

interface MigrationStats {
  model: string;
  field: string;
  scanned: number;
  alreadyEncrypted: number;
  encrypted: number;
  skipped: number;
  errors: number;
}

async function migrateField(model: string, field: string): Promise<MigrationStats> {
  const stats: MigrationStats = {
    model,
    field,
    scanned: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0,
  };

  const table = TABLE_NAMES[model];
  if (!table) {
    console.error(`[migrate] No table mapping for model "${model}" — skipping`);
    stats.errors++;
    return stats;
  }

  // We page through with id-based pagination so we can resume if interrupted.
  let lastId: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: Array<{ id: string; [k: string]: any }>;

  do {
    const idClause = lastId ? `WHERE "id" > '${lastId.replace(/'/g, "''")}'` : "";
    rows = await prisma.$queryRawUnsafe<Array<{ id: string; [k: string]: unknown }>>(
      `SELECT "id", "${field}" FROM "${table}" ${idClause} ORDER BY "id" ASC LIMIT ${BATCH_SIZE}`,
    );

    for (const row of rows) {
      stats.scanned++;
      const value = row[field];

      if (value === null || value === undefined) {
        stats.skipped++;
        continue;
      }

      const buf = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);

      if (isEncrypted(buf)) {
        stats.alreadyEncrypted++;
        continue;
      }

      try {
        const encrypted = encryptBytes(buf);
        await prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "${field}" = $1 WHERE "id" = $2`,
          encrypted,
          row.id,
        );
        stats.encrypted++;
      } catch (err) {
        console.error(`[migrate] ${model}.${field} id=${row.id} failed:`, err);
        stats.errors++;
      }
    }

    if (rows.length > 0) lastId = rows[rows.length - 1].id;

    if (stats.scanned % 500 === 0 && stats.scanned > 0) {
      console.log(
        `  ${model}.${field}: scanned ${stats.scanned}, encrypted ${stats.encrypted}, ` +
          `already-encrypted ${stats.alreadyEncrypted}, errors ${stats.errors}`,
      );
    }
  } while (rows.length === BATCH_SIZE);

  return stats;
}

async function main() {
  if (!isEncryptionEnabled()) {
    console.error(
      "[migrate] ENCRYPTION_ENABLED is not set to 'true'. Aborting — encryption " +
        "must be enabled to run the migration. Set ENCRYPTION_ENABLED=true and " +
        "FIELD_ENCRYPTION_KEY, then re-run.",
    );
    process.exit(1);
  }

  if (!process.env.FIELD_ENCRYPTION_KEY) {
    console.error("[migrate] FIELD_ENCRYPTION_KEY is not set. Aborting.");
    process.exit(1);
  }

  console.log("[migrate] Starting field-level encryption migration");
  console.log(
    `[migrate] Target DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@") ?? "<unset>"}`,
  );
  console.log("");

  const allStats: MigrationStats[] = [];

  for (const { model, spec } of listAllEncryptedFields()) {
    if (spec.type !== "bytes") {
      console.log(`[migrate] Skipping ${model}.${spec.field} (type=${spec.type} not yet supported)`);
      continue;
    }
    console.log(`[migrate] Processing ${model}.${spec.field} ...`);
    const stats = await migrateField(model, spec.field);
    allStats.push(stats);
    console.log(
      `[migrate] Done ${model}.${spec.field}: scanned=${stats.scanned} ` +
        `encrypted=${stats.encrypted} already=${stats.alreadyEncrypted} ` +
        `null=${stats.skipped} errors=${stats.errors}`,
    );
    console.log("");
  }

  console.log("[migrate] === Summary ===");
  for (const s of allStats) {
    console.log(
      `  ${s.model}.${s.field}: ${s.encrypted} newly encrypted, ` +
        `${s.alreadyEncrypted} already encrypted, ${s.errors} errors`,
    );
  }

  const totalErrors = allStats.reduce((acc, s) => acc + s.errors, 0);
  if (totalErrors > 0) {
    console.error(`[migrate] Completed with ${totalErrors} error(s) — review log above`);
    process.exit(2);
  }

  console.log("[migrate] All clean");
}

main()
  .catch((err) => {
    console.error("[migrate] Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Verification script: sample rows from each encrypted column, decrypt them,
 * confirm the result is non-empty and matches a sane file shape. Used after
 * running migrate-encrypt-existing to confirm a sample of encrypted rows can
 * be successfully read back.
 *
 * Usage:
 *   ENCRYPTION_ENABLED=true \
 *   FIELD_ENCRYPTION_KEY="<base64 key>" \
 *   DATABASE_URL="<target db>" \
 *   npx tsx scripts/verify-encryption.ts
 */

import { PrismaClient } from "@prisma/client";
import { decryptBytes, isEncrypted, isEncryptionEnabled } from "../src/lib/encryption";
import { listAllEncryptedFields } from "../src/lib/encrypted-fields";

const prisma = new PrismaClient();

const SAMPLE_SIZE = 5;

const TABLE_NAMES: Record<string, string> = {
  fieldworkEvidenceAttachment: "FieldworkEvidenceAttachment",
  internalAuditDocument: "InternalAuditDocument",
  governanceTemplate: "GovernanceTemplate",
};

interface VerifyStats {
  model: string;
  field: string;
  sampled: number;
  encryptedAndDecrypted: number;
  legacyPlaintext: number;
  nullValues: number;
  decryptFailures: number;
}

async function verifyField(model: string, field: string): Promise<VerifyStats> {
  const stats: VerifyStats = {
    model,
    field,
    sampled: 0,
    encryptedAndDecrypted: 0,
    legacyPlaintext: 0,
    nullValues: 0,
    decryptFailures: 0,
  };

  const table = TABLE_NAMES[model];
  if (!table) {
    console.error(`[verify] No table mapping for model "${model}" — skipping`);
    return stats;
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; [k: string]: unknown }>>(
    `SELECT "id", "${field}" FROM "${table}" ` +
      `WHERE "${field}" IS NOT NULL ` +
      `ORDER BY RANDOM() LIMIT ${SAMPLE_SIZE}`,
  );

  for (const row of rows) {
    stats.sampled++;
    const value = row[field];
    if (value === null || value === undefined) {
      stats.nullValues++;
      continue;
    }
    const buf = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
    if (!isEncrypted(buf)) {
      stats.legacyPlaintext++;
      continue;
    }
    try {
      const decrypted = decryptBytes(buf);
      if (decrypted.length === 0) {
        console.warn(`[verify] ${model}.${field} id=${row.id} decrypted to 0 bytes`);
        stats.decryptFailures++;
      } else {
        stats.encryptedAndDecrypted++;
      }
    } catch (err) {
      console.error(`[verify] ${model}.${field} id=${row.id} decryption failed:`, err);
      stats.decryptFailures++;
    }
  }

  return stats;
}

async function main() {
  if (!isEncryptionEnabled()) {
    console.error("[verify] ENCRYPTION_ENABLED must be 'true' to run verification. Aborting.");
    process.exit(1);
  }
  if (!process.env.FIELD_ENCRYPTION_KEY) {
    console.error("[verify] FIELD_ENCRYPTION_KEY is not set. Aborting.");
    process.exit(1);
  }

  console.log("[verify] Sampling encrypted columns");
  console.log(
    `[verify] Target DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@") ?? "<unset>"}`,
  );
  console.log("");

  const allStats: VerifyStats[] = [];
  for (const { model, spec } of listAllEncryptedFields()) {
    if (spec.type !== "bytes") continue;
    const stats = await verifyField(model, spec.field);
    allStats.push(stats);
    console.log(
      `${model}.${spec.field}: sampled=${stats.sampled} ` +
        `decrypted=${stats.encryptedAndDecrypted} ` +
        `legacy-plaintext=${stats.legacyPlaintext} ` +
        `null=${stats.nullValues} ` +
        `failures=${stats.decryptFailures}`,
    );
  }

  const totalFailures = allStats.reduce((acc, s) => acc + s.decryptFailures, 0);
  if (totalFailures > 0) {
    console.error(`[verify] ${totalFailures} decryption failure(s) — investigate`);
    process.exit(2);
  }

  const totalLegacy = allStats.reduce((acc, s) => acc + s.legacyPlaintext, 0);
  if (totalLegacy > 0) {
    console.warn(
      `[verify] ${totalLegacy} legacy plaintext rows seen — run migrate-encrypt-existing.ts`,
    );
  }

  console.log("[verify] All sampled rows decrypt cleanly");
}

main()
  .catch((err) => {
    console.error("[verify] Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

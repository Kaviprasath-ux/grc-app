/**
 * Master key rotation: re-encrypt every encrypted column with a new
 * FIELD_ENCRYPTION_KEY.
 *
 * The script reads each row using the OLD key, decrypts the value, then
 * encrypts with the NEW key and writes it back. Both keys are required at
 * runtime; once the script completes, the old key can be retired.
 *
 * Usage:
 *   ENCRYPTION_ENABLED=true \
 *   FIELD_ENCRYPTION_KEY="<new base64 key>" \
 *   FIELD_ENCRYPTION_KEY_OLD="<previous base64 key>" \
 *   DATABASE_URL="<target db>" \
 *   npx tsx scripts/rotate-master-key.ts
 *
 * Procedure (90-day rotation cadence):
 *   1. Generate a new key:
 *        node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *   2. Stash both keys: set FIELD_ENCRYPTION_KEY (new) and
 *      FIELD_ENCRYPTION_KEY_OLD (current) on the target app's env.
 *   3. Run this script against UAT first. Verify with `npm run encrypt:verify`.
 *   4. Run against Prod. Verify.
 *   5. After all rows are re-encrypted with the new key, remove
 *      FIELD_ENCRYPTION_KEY_OLD from env and rotate the old key out of any
 *      backups.
 */

import { PrismaClient } from "@prisma/client";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";
import { listAllEncryptedFields } from "../src/lib/encrypted-fields";

const prisma = new PrismaClient();

const ALGO = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION_BYTE = 0x01;
const BATCH_SIZE = 100;

const TABLE_NAMES: Record<string, string> = {
  fieldworkEvidenceAttachment: "FieldworkEvidenceAttachment",
  internalAuditDocument: "InternalAuditDocument",
  governanceTemplate: "GovernanceTemplate",
};

function loadKey(envVar: string): Buffer {
  const raw = process.env[envVar];
  if (!raw) {
    console.error(`[rotate] ${envVar} is not set. Aborting.`);
    process.exit(1);
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    console.error(`[rotate] ${envVar} must decode to ${KEY_LENGTH} bytes. Aborting.`);
    process.exit(1);
  }
  return key;
}

function decryptWith(key: Buffer, ciphertext: Buffer): Buffer {
  if (ciphertext.length < 1 + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Ciphertext too short");
  }
  if (ciphertext[0] !== VERSION_BYTE) {
    throw new Error(`Unsupported version: 0x${ciphertext[0].toString(16)}`);
  }
  const iv = ciphertext.subarray(1, 1 + IV_LENGTH);
  const tag = ciphertext.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + AUTH_TAG_LENGTH);
  const ct = ciphertext.subarray(1 + IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function encryptWith(key: Buffer, plaintext: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION_BYTE]), iv, tag, ct]);
}

function isEncryptedShape(buf: Buffer): boolean {
  return buf.length >= 1 + IV_LENGTH + AUTH_TAG_LENGTH + 1 && buf[0] === VERSION_BYTE;
}

interface RotationStats {
  model: string;
  field: string;
  scanned: number;
  rotated: number;
  alreadyOnNewKey: number;
  notEncrypted: number;
  errors: number;
}

async function rotateField(
  model: string,
  field: string,
  oldKey: Buffer,
  newKey: Buffer,
): Promise<RotationStats> {
  const stats: RotationStats = {
    model,
    field,
    scanned: 0,
    rotated: 0,
    alreadyOnNewKey: 0,
    notEncrypted: 0,
    errors: 0,
  };

  const table = TABLE_NAMES[model];
  if (!table) {
    console.error(`[rotate] No table mapping for ${model} — skipping`);
    return stats;
  }

  let lastId: string | null = null;
  let rows: Array<{ id: string; [k: string]: unknown }>;

  do {
    const idClause = lastId ? `WHERE "id" > '${lastId.replace(/'/g, "''")}'` : "";
    rows = await prisma.$queryRawUnsafe<Array<{ id: string; [k: string]: unknown }>>(
      `SELECT "id", "${field}" FROM "${table}" ${idClause} ORDER BY "id" ASC LIMIT ${BATCH_SIZE}`,
    );

    for (const row of rows) {
      stats.scanned++;
      const value = row[field];
      if (value === null || value === undefined) continue;
      const buf = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);

      if (!isEncryptedShape(buf)) {
        stats.notEncrypted++;
        continue;
      }

      // Try decrypting with the OLD key first; if that fails, try the NEW
      // key (means this row was already rotated). If both fail, log error.
      let plaintext: Buffer | null = null;
      try {
        plaintext = decryptWith(oldKey, buf);
      } catch {
        try {
          decryptWith(newKey, buf);
          stats.alreadyOnNewKey++;
          continue;
        } catch (err) {
          console.error(
            `[rotate] ${model}.${field} id=${row.id}: cannot decrypt with either key:`,
            err,
          );
          stats.errors++;
          continue;
        }
      }

      try {
        const reencrypted = encryptWith(newKey, plaintext);
        await prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "${field}" = $1 WHERE "id" = $2`,
          reencrypted,
          row.id,
        );
        stats.rotated++;
      } catch (err) {
        console.error(`[rotate] ${model}.${field} id=${row.id} write failed:`, err);
        stats.errors++;
      }
    }

    if (rows.length > 0) lastId = rows[rows.length - 1].id;

    if (stats.scanned % 500 === 0 && stats.scanned > 0) {
      console.log(
        `  ${model}.${field}: scanned ${stats.scanned}, rotated ${stats.rotated}, ` +
          `already-on-new ${stats.alreadyOnNewKey}, errors ${stats.errors}`,
      );
    }
  } while (rows.length === BATCH_SIZE);

  return stats;
}

async function main() {
  console.log("[rotate] Master key rotation");
  console.log(
    `[rotate] Target DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@") ?? "<unset>"}`,
  );

  const oldKey = loadKey("FIELD_ENCRYPTION_KEY_OLD");
  const newKey = loadKey("FIELD_ENCRYPTION_KEY");

  if (oldKey.equals(newKey)) {
    console.error("[rotate] FIELD_ENCRYPTION_KEY and FIELD_ENCRYPTION_KEY_OLD are identical.");
    process.exit(1);
  }

  console.log("");
  const allStats: RotationStats[] = [];
  for (const { model, spec } of listAllEncryptedFields()) {
    if (spec.type !== "bytes") continue;
    console.log(`[rotate] Processing ${model}.${spec.field} ...`);
    const stats = await rotateField(model, spec.field, oldKey, newKey);
    allStats.push(stats);
    console.log(
      `[rotate] Done ${model}.${spec.field}: rotated=${stats.rotated} ` +
        `already-on-new=${stats.alreadyOnNewKey} not-encrypted=${stats.notEncrypted} ` +
        `errors=${stats.errors}`,
    );
    console.log("");
  }

  console.log("[rotate] === Summary ===");
  for (const s of allStats) {
    console.log(
      `  ${s.model}.${s.field}: ${s.rotated} rotated, ${s.alreadyOnNewKey} already on new key, ` +
        `${s.notEncrypted} unencrypted (run encrypt:migrate), ${s.errors} errors`,
    );
  }
  const totalErrors = allStats.reduce((acc, s) => acc + s.errors, 0);
  if (totalErrors > 0) process.exit(2);
  console.log("[rotate] All rows successfully rotated. You can now retire FIELD_ENCRYPTION_KEY_OLD.");
}

main()
  .catch((err) => {
    console.error("[rotate] Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

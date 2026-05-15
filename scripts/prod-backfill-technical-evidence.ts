/**
 * Technical Evidence platform grandfathering backfill.
 *
 * Run this AFTER `prisma db push` (which adds the new column
 * isTechnicalEvidenceEnabled defaulting to false) and BEFORE existing
 * customers reload — otherwise grandfathered GRC customers will lose
 * Technical Evidence access at next login.
 *
 * What it does:
 *   1. UPDATE CustomerAccount SET isTechnicalEvidenceEnabled = true
 *      WHERE isGrcAdded = true        (grandfather)
 *
 *   2. INSERT a CustomerAdministrator UserRole row with
 *      moduleCode='TECHNICAL_EVIDENCE' for every grandfathered customer's
 *      existing CustomerAdministrator (so the picker shows the TE card —
 *      availableModules requires subscription AND a role-row in the module)
 *
 * Idempotent: safe to run multiple times.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "<direct-url>"
 *   npx tsx scripts/prod-backfill-technical-evidence.ts
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  console.log("[TE-backfill] Starting Technical Evidence grandfather backfill...");

  // Step 1 — flip the flag for existing GRC customers.
  const flipped = await p.$executeRawUnsafe(
    `UPDATE "CustomerAccount"
        SET "isTechnicalEvidenceEnabled" = TRUE
      WHERE "isGrcAdded" = TRUE
        AND "isTechnicalEvidenceEnabled" = FALSE`
  );
  console.log(`[TE-backfill] Flipped isTechnicalEvidenceEnabled on ${flipped} customer(s).`);

  // Step 2 — clone CustomerAdministrator UserRole into TECHNICAL_EVIDENCE.
  // Only for customers where the flag is now true and they don't already have
  // a TECHNICAL_EVIDENCE CustomerAdministrator row.
  const inserted = await p.$executeRawUnsafe(
    `INSERT INTO "UserRole" (id, "userId", "roleId", "moduleCode", "createdAt")
     SELECT
       'cmte_' || substr(md5(random()::text || ur.id), 1, 21),
       ur."userId",
       ur."roleId",
       'TECHNICAL_EVIDENCE',
       NOW()
     FROM "UserRole" ur
     JOIN "Role" r ON ur."roleId" = r.id
     JOIN "User" u ON ur."userId" = u.id
     JOIN "CustomerAccount" ca ON u."customerAccountId" = ca.id
     WHERE r.name = 'CustomerAdministrator'
       AND ur."moduleCode" = 'GRC'
       AND ca."isTechnicalEvidenceEnabled" = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM "UserRole" ur2
         WHERE ur2."userId" = ur."userId"
           AND ur2."roleId" = ur."roleId"
           AND ur2."moduleCode" = 'TECHNICAL_EVIDENCE'
       )`
  );
  console.log(`[TE-backfill] Inserted ${inserted} TECHNICAL_EVIDENCE CustomerAdministrator row(s).`);

  console.log("[TE-backfill] Done.");
}

main()
  .catch((e) => {
    console.error("[TE-backfill] FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await p.$disconnect();
  });

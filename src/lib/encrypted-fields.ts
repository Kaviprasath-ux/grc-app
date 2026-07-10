/**
 * Registry of Prisma model fields that should be transparently encrypted by
 * the client extension in `prisma.ts`.
 *
 * Phase 2 scope: file-blob columns only (fileData Bytes? on the 3 models that
 * actually store binaries in the database). These columns are never used in
 * WHERE clauses, ORDER BY, or aggregations, so encrypting them has zero impact
 * on querying.
 *
 * Future phases will add PII (vendor contact emails, user phone numbers) and
 * payment metadata. Those require careful audit because they may be searched.
 *
 * To add a new field to encryption:
 *   1. Add the field name to the matching model entry below.
 *   2. Confirm the field is NEVER used in: WHERE filters, ORDER BY, GROUP BY,
 *      DISTINCT, raw SQL string interpolation, full-text search.
 *   3. Run `npm run encrypt:migrate` to encrypt existing rows.
 *   4. Update docs/SECURITY.md and docs/encryption-raw-sql-audit.md.
 */

/**
 * Field type for runtime decryption — string for `String` columns (base64
 * ciphertext) or bytes for `Bytes` columns (raw binary ciphertext).
 */
export type EncryptedFieldType = "bytes" | "string";

export interface EncryptedFieldSpec {
  /** Prisma field name */
  field: string;
  /** Underlying column type — drives which encrypt/decrypt helper to use */
  type: EncryptedFieldType;
}

/**
 * Map of Prisma model name → list of fields to encrypt on that model.
 * Model names match the lowercased Prisma client property name
 * (e.g. `prisma.fieldworkEvidenceAttachment`).
 */
export const ENCRYPTED_FIELDS: Record<string, EncryptedFieldSpec[]> = {
  fieldworkEvidenceAttachment: [{ field: "fileData", type: "bytes" }],
  internalAuditDocument: [{ field: "fileData", type: "bytes" }],
  governanceTemplate: [{ field: "fileData", type: "bytes" }],
  auditEngagementAPMAttachment: [{ field: "fileData", type: "bytes" }],
};

/**
 * Helper for the Prisma extension — fast lookup of fields per model.
 */
export function getEncryptedFields(modelName: string): EncryptedFieldSpec[] {
  return ENCRYPTED_FIELDS[modelName] ?? [];
}

/**
 * List every (model, field) pair — used by the migration and verification
 * scripts to iterate over all encryptable data.
 */
export function listAllEncryptedFields(): Array<{ model: string; spec: EncryptedFieldSpec }> {
  const out: Array<{ model: string; spec: EncryptedFieldSpec }> = [];
  for (const [model, specs] of Object.entries(ENCRYPTED_FIELDS)) {
    for (const spec of specs) out.push({ model, spec });
  }
  return out;
}

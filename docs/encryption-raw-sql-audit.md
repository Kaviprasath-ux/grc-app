# Raw SQL Audit — Field-Level Encryption (Phase 2)

This document records the audit of every `$queryRaw` / `$executeRaw` site in
the codebase, identifying which ones touch fields registered in
`src/lib/encrypted-fields.ts` and the action taken to keep encryption
transparent at those sites.

**Encrypted fields (Phase 2 scope):**

| Model | Field | Postgres table | Type |
|---|---|---|---|
| `fieldworkEvidenceAttachment` | `fileData` | `FieldworkEvidenceAttachment` | `Bytes?` |
| `internalAuditDocument` | `fileData` | `InternalAuditDocument` | `Bytes?` |
| `governanceTemplate` | `fileData` | `GovernanceTemplate` | `Bytes?` |

**Why raw SQL is special:**
The Prisma client extension in `src/lib/prisma.ts` intercepts `create`,
`update`, `findUnique`, etc. via `$extends`. It does NOT intercept
`$queryRaw` / `$executeRaw` because those bypass the model query layer. So
every raw-SQL site that touches an encrypted field must wrap its value with
`maybeEncryptBytes` (writes) or `maybeDecryptBytes` (reads) explicitly.

## Audit results

### Files that touch encrypted fields — fixed

| File | Operation | Encrypted field | Fix applied |
|---|---|---|---|
| `src/app/api/internal-audit/fieldwork/[id]/upload/route.ts` (line 92) | WRITE | `FieldworkEvidenceAttachment.fileData` | Wrapped with `maybeEncryptBytes(Buffer.from(buffer))` |
| `src/app/api/internal-audit/fieldwork/[id]/upload/route.ts` (line 140) | WRITE | `FieldworkEvidenceAttachment.fileData` | Same wrap |
| `src/app/api/internal-audit/fieldwork/[id]/evidence-requests/[requestId]/attachments/route.ts` (line 109) | WRITE | `FieldworkEvidenceAttachment.fileData` | Same wrap |
| `src/app/api/internal-audit/documents/route.ts` (line 221) | WRITE | `InternalAuditDocument.fileData` | Same wrap |
| `src/app/api/internal-audit/documents/[id]/download/route.ts` (line 32) | READ | `InternalAuditDocument.fileData` | Decrypt with `maybeDecryptBytes(Buffer.from(rows[0].fileData))` |
| `src/app/api/internal-audit/documents/ingest/route.ts` (line 138) | READ | `InternalAuditDocument.fileData` | Same decrypt |

### Files using raw SQL but NOT touching encrypted fields — no action needed

These files use `$queryRaw` / `$executeRaw` for unrelated reasons (tenant
filtering, complex aggregations, customer onboarding flows). They do NOT
read or write any field in the encryption registry, so the extension is not
in scope for them.

| File | Why raw SQL | Encrypted-field touch? |
|---|---|---|
| `src/app/api/grc/customer-accounts/route.ts` | Customer account aggregation queries | NO |
| `src/app/api/grc/customer-accounts/onboard/route.ts` | Multi-step onboarding flow | NO |
| `src/app/api/grc/customer-accounts/[id]/route.ts` | Customer detail queries | NO |
| `src/app/api/grc/customer-accounts/[id]/subscription-plans/route.ts` | Subscription plan joins | NO |
| `src/app/api/tprm/account-overview/route.ts` | Account overview aggregation | NO |

If any of these files are later modified to read/write `fileData` (or any
other registered encrypted field), the same wrap pattern must be applied.

### Files that read/write `fileData` via Prisma client API — auto-handled

These access encrypted fields through the Prisma client's model API
(`prisma.governanceTemplate.create`, `prisma.internalAuditDocument.findMany`,
etc.). The client extension transparently encrypts and decrypts — no manual
work needed.

| File | Encrypted field accessed | Mechanism |
|---|---|---|
| `src/app/api/governance-templates/route.ts` | `governanceTemplate.fileData` | `prisma.governanceTemplate.create({ data: { fileData: ... } })` |
| `src/app/api/governance-templates/[id]/download/route.ts` | `governanceTemplate.fileData` | `prisma.governanceTemplate.findUnique({ select: { fileData: true } })` |
| `src/app/api/qpost-compliance/governance-templates/route.ts` | `governanceTemplate.fileData` | Prisma create |
| `src/app/api/qpost-compliance/governance-templates/[id]/download/route.ts` | `governanceTemplate.fileData` | Prisma findUnique |
| `src/app/api/ai/governance/generate-policy/route.ts` | `governanceTemplate.fileData` | Prisma findUnique with select |
| `src/app/api/ai/governance/review-policy/route.ts` | (uses `fileData` as a local var name only — not a DB field) | N/A |
| `src/app/api/internal-audit/documents/route.ts` (LIST queries) | `InternalAuditDocument.fileData` | Prisma findMany — list queries explicitly omit fileData via select |
| `src/app/api/governance-vault/route.ts` | `GovernanceVaultDocument.filePath` only | N/A — this model has no fileData field |
| `src/components/layout/header.tsx` | (local file processing — not DB read) | N/A |

### Adding a new encrypted field

When adding a field to `src/lib/encrypted-fields.ts`:

1. Run `grep -rn "<field-name>" src/` to find every reference.
2. For each `$queryRaw` / `$executeRaw` site that reads/writes the field,
   wrap with `maybeEncryptBytes` / `maybeDecryptBytes`.
3. For each Prisma client API site, no action needed — the extension handles it.
4. Update this document with the new file list.
5. Run `npm run encrypt:migrate` to encrypt existing rows.
6. Run `npm run encrypt:verify` to confirm decryption works.

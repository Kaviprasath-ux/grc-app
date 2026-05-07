# Security & Encryption

This document describes the encryption controls in the GRC application —
algorithms used, where keys live, how to rotate them, how to add new
encrypted fields, and how each control maps to common compliance frameworks.
It is the canonical reference for auditors and contributors.

---

## 1. Encryption at rest

### 1.1 Database (PostgreSQL on DigitalOcean Managed Database)

All database content is encrypted at rest by DigitalOcean's underlying
storage layer:

- **Cipher:** AES-256
- **Key custody:** DO-managed (transparent to the application)
- **Backup encryption:** DO automated daily backups are also encrypted at rest
- **Operator access:** restricted via DO console RBAC + 2FA

This protects against physical disk theft and infrastructure-level
compromise but does NOT protect against application-layer threats (a
compromised app account, leaked DB credentials, or a misconfigured
endpoint will still expose plaintext to whoever can run a query).

### 1.2 Application-layer field encryption

Sensitive columns that warrant defence in depth are additionally encrypted
at the application layer with AES-256-GCM. Even an attacker who obtains
the database (via SQL injection, a leaked DB password, or a stolen backup
from outside DO's perimeter) sees only ciphertext.

#### Algorithm

- **Cipher:** AES-256-GCM (authenticated encryption — detects tampering)
- **Key length:** 32 bytes (256 bit)
- **IV length:** 12 bytes (96 bit, GCM standard) — random per encryption
- **Auth tag length:** 16 bytes (128 bit)
- **On-disk format:** `[1B version][12B IV][16B auth tag][N bytes ciphertext]`

The 1-byte version prefix lets the migration script distinguish
plaintext from ciphertext (idempotent re-runs) and lets us add a new key
or algorithm version in the future without breaking existing rows.

#### Why GCM, not CBC

GCM provides authenticated encryption — any tampering with the ciphertext
is detected at decryption time and throws. CBC alone leaves you open to
padding-oracle attacks and silent corruption.

#### Currently encrypted fields

| Model | Field | Postgres table | Type |
|---|---|---|---|
| `fieldworkEvidenceAttachment` | `fileData` | `FieldworkEvidenceAttachment` | `Bytes?` |
| `internalAuditDocument` | `fileData` | `InternalAuditDocument` | `Bytes?` |
| `governanceTemplate` | `fileData` | `GovernanceTemplate` | `Bytes?` |

These three columns store the raw binary contents of uploaded files
(audit evidence, internal audit documents, governance templates). Phase 2
focused on these because they are the highest-value targets and are
never used in `WHERE`, `ORDER BY`, or `GROUP BY` clauses, so encrypting
them has zero impact on querying.

Future phases will extend this list to PII (vendor contact email/phone,
user phone numbers) and payment metadata. Those require careful audit
because some are used in lookups.

#### Implementation

- `src/lib/encryption.ts` — AES-256-GCM helpers, kill switch reader,
  ciphertext detection.
- `src/lib/encrypted-fields.ts` — typed registry of (model, field) pairs.
  Single source of truth.
- `src/lib/prisma.ts` — Prisma client extension via `$extends`. Always
  applied (so the exported type is stable); each query handler
  short-circuits when the kill switch is off, making the extension
  byte-identical to an unwrapped client.
- Raw SQL paths bypass the extension and are wrapped manually with
  `maybeEncryptBytes` / `maybeDecryptBytes`. See
  `docs/encryption-raw-sql-audit.md` for the audit log.

#### Kill switch

`ENCRYPTION_ENABLED` is a per-app environment variable. When unset or
`"false"`, the extension passes data through untouched. This is how the
single-branch deployment topology stages encryption: UAT and Prod both
run the same code, but only the app whose env var is set to `"true"`
applies encryption. Lets us validate UAT for 24-48h before flipping
production.

### 1.3 Password storage

User passwords are hashed with bcrypt (`bcryptjs`) before storage —
never stored in plaintext, never reversible.

- **Algorithm:** bcrypt
- **Cost factor:** 10 (OWASP minimum acceptable as of 2024)
- **Salt:** per-password random (handled internally by bcrypt)
- **Comparison:** constant-time via `bcrypt.compare`

> Backlog: raise cost factor to 12 across all hash sites
> (`npm run lint` will not catch this — search `bcrypt.hash` to find
> all 18 call sites). Coordinate with a maintenance window because
> existing user logins are unaffected (bcrypt verifies regardless of
> cost factor) but new hashes will be ~4× slower.

---

## 2. Encryption in transit

### 2.1 Browser ↔ Application

- **TLS:** managed by DigitalOcean App Platform's edge proxy (Let's
  Encrypt, auto-renewed)
- **Force HTTPS:** enabled in App Platform → Settings → Domains
- **HSTS:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- **Belt-and-suspenders redirect:** `src/middleware.ts` returns 301 if
  `x-forwarded-proto === "http"` in production
- **Other security headers:** see `next.config.ts` (X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP in
  Report-Only mode)

### 2.2 Application ↔ PostgreSQL

The DB connection requires TLS:

```
DATABASE_URL=postgresql://...?sslmode=verify-full&sslrootcert=...
```

`verify-full` validates the server certificate against DigitalOcean's
CA — preventing MITM. Until this is enabled per-app via env vars, the
app falls back to whatever the URL specifies (the legacy URL used
`sslmode=require` which encrypts the channel but does NOT verify the
cert).

### 2.3 Application ↔ Python AI backend

The Python AI backend (deployed as a separate DO service, MongoDB-backed)
is reached via HTTPS:

- `src/lib/ai-config.ts` enforces `https://` for `AI_API_BASE_URL` in
  production — the app refuses to start if misconfigured
- Authentication: shared secret via custom `auth` header
  (`PYTHON_API_SECRET`)
- Both services should be in the same DO VPC for additional defence

---

## 3. Key custody

| Key | Where it lives | Who has access |
|---|---|---|
| `NEXTAUTH_SECRET` | DO App Platform encrypted env var | App admins |
| `FIELD_ENCRYPTION_KEY` | DO App Platform encrypted env var (per-app) + offline backup in 1Password | App admins + key custodian |
| `FIELD_ENCRYPTION_KEY_OLD` | Set only during rotation window (~24h) | Same |
| `PYTHON_API_SECRET` | DO App Platform encrypted env var (both Next.js + Python apps) | App admins |
| `DB_CA_CERT` | DO App Platform env var (PEM content) | App admins |
| Database password | DO App Platform encrypted env var (`DATABASE_URL`) | DBA + app admins |

### Critical rules

- **Never** commit any of these to the git repo, including in `.env`
  (`.env` is gitignored; double-check before committing).
- **Never** print these in logs (`safe-log.ts` redactor scrubs known
  sensitive keys, but always pass them through it).
- **Never** share via email, Slack, or screenshot.
- **Always** use DO's "Encrypted" env var checkbox so values are
  encrypted at rest in the App Platform control plane.
- **Always** use DIFFERENT `FIELD_ENCRYPTION_KEY` values for UAT and
  Prod, so a UAT compromise does not expose Prod data.
- Master key loss = permanent loss of access to encrypted data.
  Maintain at least two backups (DO env var + offline encrypted vault).

---

## 4. Key rotation runbook

### 4.1 `FIELD_ENCRYPTION_KEY` (90-day cadence)

1. Generate a new key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. In DO App Platform → UAT app → Env vars:
   - Set `FIELD_ENCRYPTION_KEY_OLD` = current value of `FIELD_ENCRYPTION_KEY`
   - Set `FIELD_ENCRYPTION_KEY` = new value
3. Restart UAT app.
4. Run rotation script against UAT:
   ```bash
   ENCRYPTION_ENABLED=true \
   FIELD_ENCRYPTION_KEY="<new>" \
   FIELD_ENCRYPTION_KEY_OLD="<old>" \
   DATABASE_URL="<uat>" \
   npm run encrypt:rotate-key
   ```
5. Run `npm run encrypt:verify` against UAT — confirm sample rows decrypt.
6. Smoke test UAT for 24h.
7. Repeat 2-5 against Prod.
8. After successful Prod rotation, REMOVE `FIELD_ENCRYPTION_KEY_OLD` from
   both apps' env vars and rotate the old key out of all backups.
9. Update the key custodian's password manager entry.

### 4.2 `NEXTAUTH_SECRET`

Rotation forces all users to re-authenticate (existing JWT cookies invalid).

1. Generate: `openssl rand -base64 32`
2. Update env var in both UAT and Prod.
3. Restart apps.
4. Notify users: "Please log in again."

### 4.3 `PYTHON_API_SECRET`

Coordinated rotation across two services (brief AI feature downtime).

1. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
2. Update on Python backend → restart Python.
3. Immediately update on Next.js → restart Next.js.
4. Verify AI features (translation, policy generation) work.

### 4.4 Database password

1. DO Dashboard → Databases → cluster → Users & Databases → Reset Password.
2. Update `DATABASE_URL` env var on both UAT and Prod (with the same
   pooled host; use `verify-full` + CA cert).
3. Restart both apps.
4. Verify a login.

---

## 5. Adding a new encrypted field

When a new column needs encryption (e.g. vendor contact email):

1. Confirm the field is **NEVER** used in:
   - `WHERE` filters / `findFirst({ where: ... })`
   - `ORDER BY`
   - `GROUP BY`
   - `DISTINCT`
   - `String contains:` / full-text search
   - Raw SQL string interpolation
2. If any of the above apply, the field is not a candidate for
   plain field-level encryption. Consider deterministic encryption
   with a separate searchable hash column instead, or skip encryption.
3. Add the field to `src/lib/encrypted-fields.ts`:
   ```typescript
   tprmVendor: [{ field: "contactEmail", type: "string" }],
   ```
4. Run `grep -rn "contactEmail" src/` to find every reference.
5. For each `$queryRaw` / `$executeRaw` site that touches the field,
   wrap with `maybeEncryptBytes` / `maybeDecryptBytes`
   (or `encryptString` / `decryptString` for `String` columns).
6. Update `docs/encryption-raw-sql-audit.md`.
7. Run `npm run encrypt:migrate` against UAT, validate, then Prod.
8. Run `npm run encrypt:verify` to confirm.

---

## 6. Compliance mapping

| Framework | Control | Satisfied by |
|---|---|---|
| **ISO 27001:2022** | A.8.24 — Use of cryptography | Sections 1.1, 1.2, 1.3, 2 |
| ISO 27001:2022 | A.5.10 — Acceptable use | Section 3 |
| ISO 27001:2022 | A.8.5 — Secure authentication | Section 1.3 (bcrypt), 2.1 (TLS), `src/lib/auth.ts` |
| **SOC 2** | CC6.1 — Logical access controls | RBAC in `src/lib/permissions.ts` + Section 3 |
| SOC 2 | CC6.7 — Encryption in transit | Section 2 |
| SOC 2 | CC6.8 — Encryption at rest | Sections 1.1, 1.2 |
| **GDPR** | Art. 32 — Security of processing | Sections 1.2 (PII encryption planned), 2 |
| GDPR | Art. 25 — Data protection by design | Field-level encryption registry pattern |
| **PCI DSS 4.0** | Req. 3.5 — Protect cryptographic keys | Section 3 |
| PCI DSS 4.0 | Req. 3.6 — Cryptographic key management | Section 4 (rotation runbook) |
| PCI DSS 4.0 | Req. 4.1 — Strong cryptography in transit | Section 2 |

---

## 7. Incident response

### 7.1 Suspected master-key leak

1. **Immediately** rotate `FIELD_ENCRYPTION_KEY` (Section 4.1).
2. Audit DO access logs: who pulled the env var, from where, when.
3. Review git history for any accidental commit of the key.
4. Force re-authentication of all admin sessions.
5. Notify security stakeholders and (if regulated) regulator within
   the required disclosure window.

### 7.2 Decryption failures cluster (multiple rows fail to decrypt)

Possible causes:
- Master key was rotated but migration didn't complete
- Backup restored over a key change
- DB corruption

Steps:
1. Run `npm run encrypt:verify` and capture failing IDs.
2. Check whether `FIELD_ENCRYPTION_KEY_OLD` is set — if so, complete
   rotation.
3. Restore most recent good DB backup if cluster is widespread.
4. Investigate root cause before flipping `ENCRYPTION_ENABLED=false`
   (which masks the problem rather than fixing it).

### 7.3 Suspected ciphertext exfiltration (DB dump leaked)

1. Verify the leak is genuine.
2. Confirm encryption was enabled at the time of the dump
   (`ENCRYPTION_ENABLED=true` and rows have version-byte prefix).
3. If yes — rotate `FIELD_ENCRYPTION_KEY` to invalidate the leaked
   ciphertext (anyone with the dump still cannot decrypt without the
   key).
4. If no — assume plaintext exposure, follow regulator notification
   requirements.

### 7.4 Database password leak

1. Reset password on DO Dashboard.
2. Update `DATABASE_URL` env var on both apps.
3. Restart both apps.
4. Audit DO query logs for unexpected access during the leak window.

---

## 8. Audit evidence pack

Snapshots/exports to capture for compliance audits:

- [ ] SSL Labs A/A+ scan (https://www.ssllabs.com/ssltest/)
- [ ] DO Managed PG encryption-at-rest setting (dashboard screenshot)
- [ ] DO automated backup retention setting (screenshot)
- [ ] Force HTTPS toggle enabled (screenshot)
- [ ] Encrypted env var lock icons visible (screenshot)
- [ ] DB Trusted Sources restricted (screenshot)
- [ ] `psql` proof: `SELECT substring("fileData" FROM 1 FOR 30) FROM "InternalAuditDocument" LIMIT 1;` returns ciphertext bytes
- [ ] `curl -I https://...` showing security headers
- [ ] This document (`docs/SECURITY.md`)
- [ ] Raw SQL audit (`docs/encryption-raw-sql-audit.md`)
- [ ] Code review of `src/lib/encryption.ts` and `src/lib/prisma.ts`
- [ ] Mapping table (Section 6)

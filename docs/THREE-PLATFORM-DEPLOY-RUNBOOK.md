# Three-Platform Migration — Production Deploy Runbook

**Use this runbook when deploying the three-platform changes (commit `c4b1ea23` and onwards) to a fresh environment** (Prod, additional UAT cluster, dev mirror, etc.). The local UAT deploy of 2026-05-13 used these exact steps.

> **Read `docs/THREE-PLATFORM-ARCHITECTURE.md` first** for what the migration does. This runbook is the "how to apply it" — not the "what". 30-40 minutes of focused work.

---

## 0. When you DO and DON'T use this

| Use this | Skip this |
|---|---|
| Deploying the three-platform feature for the first time on a target environment | Routine code-only deploys (no schema changes) |
| Migrating UAT → Prod after stabilising on UAT | Hotfixes that don't touch `UserRole`, `User.userName`, or `User.email` |
| Spinning up a new DO env that needs the latest schema | Local-dev resets (just use `prisma db push --force-reset` + seeds) |

This runbook assumes:
- The target environment is on **DigitalOcean Managed PostgreSQL** (same as UAT)
- Code is pushed to the deploy branch (autodeploy triggered)
- You have the DB admin credentials and console access
- Your local machine has Node, npm, and Git

---

## 1. Pre-flight (T-30 min before users come back online)

### 1.1 Communicate
- Notify the team / customers if there's a maintenance window
- Confirm no one is mid-onboarding a critical customer

### 1.2 Get the artifacts in your working tree
```powershell
cd E:\VSCode\GRC-AI\grc-app
git fetch origin
git status                 # working tree should be clean
git pull                   # pull the deploy branch (e.g. GRC-MultiTenant)
```

You need these scripts present locally (created during the UAT migration, committed to the repo):
- `scripts/prod-audit-dupes.ts`
- `scripts/prod-backfill-module-code.ts`
- `scripts/prod-provision-subscriptions.ts`

Verify:
```powershell
Test-Path scripts/prod-audit-dupes.ts, scripts/prod-backfill-module-code.ts, scripts/prod-provision-subscriptions.ts
# All three should print: True
```

### 1.3 Add your IP to DO Trusted Sources
DO Managed DBs block all connections by default. Your local machine needs to be whitelisted.

1. DO Console → Databases → your target cluster → **Settings** tab
2. Scroll to **Trusted Sources** → **Add Trusted Source**
3. Click "Add my IP" (or paste your IP from `(Invoke-RestMethod -Uri "https://api.ipify.org")`)
4. Save → **wait 60 seconds** for the firewall change to propagate

### 1.4 Get the direct DB connection URL
The pool URL (port 25061, db `grc-pool`) does **not** work for `prisma db push`. You need the direct URL.

1. DO Console → your DB cluster → **Connection details** button (top right)
2. In the dropdown: change **Connection mode** to **Public network** + **Database: defaultdb**
3. The host will be `<cluster-name>-do-user-XXX.m.db.ondigitalocean.com` (same host as pool, but DIFFERENT port + db)
4. Port: `25060`
5. Database: `defaultdb`
6. Full URL pattern:
   ```
   postgresql://doadmin:<PASSWORD>@<cluster>.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require
   ```

> **Gotcha**: DO also shows a `.b.db.` hostname for "private network". That hostname **does not resolve publicly** — only inside a DO VPC. From your local machine, always use `.m.db.` on port 25060.

### 1.5 Verify connectivity BEFORE starting

```powershell
Test-NetConnection "<cluster>.m.db.ondigitalocean.com" -Port 25060
```

Expected: `TcpTestSucceeded : True`. If `False`:
- Re-check Trusted Sources (your IP may have changed)
- Wait another 60s — firewall propagation can lag

### 1.6 Take a backup
Two layers:

**A. Confirm DO automated backups exist**
DO console → DB cluster → Actions → **Restore from backup**. Just open the dialog to confirm at least 1 backup is listed in the last 7 days. Close without restoring.

**B. Take your own `pg_dump` (recommended)**
```powershell
$env:DATABASE_URL = "postgresql://doadmin:<PASSWORD>@<cluster>.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require"

pg_dump $env:DATABASE_URL `
  --format=custom `
  --no-owner `
  --no-acl `
  --file=grc-prod-backup-$(Get-Date -Format yyyy-MM-dd).dump
```

Verify the dump file is non-empty:
```powershell
Get-Item *.dump | Select-Object Name, Length
```
Length should be at least a few MB. **Keep this file off the deploy machine** (cloud drive, encrypted vault).

If `pg_dump` is not installed: install PostgreSQL client tools, or rely on DO's automated daily backups (still a working safety net).

---

## 2. Code deploy

### 2.1 Push the deploy branch
Either already done (if you're following on from a UAT push) or:
```powershell
git push origin GRC-MultiTenant     # or your branch name
```

### 2.2 Wait for DO build to complete
- DO App Platform → your app → **Deployments** tab
- Wait until status = **Deployed** (not "Building" or "Deploying")
- Typical build time: 2-5 minutes

If build fails:
- Check Build Logs for errors
- Common cause: missing or stale env vars on the app — verify `DATABASE_URL` (app should be using the pool URL on port 25061), `NEXTAUTH_SECRET`, etc.

> **The app is now serving the new code, BUT the DB hasn't been migrated yet. Existing users WILL see "No active workspaces" until you complete steps 3-5.** This is by design — fail fast, fix fast.

---

## 3. DB connection setup (PowerShell session)

Open a fresh PowerShell window in the project directory.

### 3.1 Set DATABASE_URL to the DIRECT URL

```powershell
$env:DATABASE_URL = "postgresql://doadmin:<PASSWORD>@<cluster>.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require"
```

> **PowerShell trap**: `VAR=value command` is bash syntax. PowerShell needs `$env:VAR = "value"` as a separate statement. The env var stays set for the whole PowerShell session — set once, run all commands.

### 3.2 Verify it's set correctly

```powershell
$env:DATABASE_URL
```

Expected: the URL with `.m.db.`, port `25060`, db `defaultdb`. Note: Prisma reads `.env` first, but shell env vars override. Confirm by what the next prisma command logs.

### 3.3 Test the connection

```powershell
npx prisma db pull --print 2>&1 | Select-Object -First 15
```

Expected: lines of Prisma schema like:
```
generator client {
  provider = "prisma-client-js"
  ...
}
model CustomerAccount {
  ...
```

If `P1001 Can't reach database server`:
- Trusted Sources still wrong → repeat 1.3
- Wrong URL — re-check 1.4

---

## 4. Migration steps (5 commands, run in order)

### 4.1 — Audit duplicate usernames/emails (READ-ONLY)

```powershell
npx tsx scripts/prod-audit-dupes.ts
```

Expected output (clean case):
```
Scanned N user(s).
=== userName duplicates ===
  (none)
=== email duplicates ===
  (none)
Summary: 0 duplicate userName(s), 0 duplicate email(s).
```

**If duplicates are found**:
- Script exits with code 2 (intentional)
- Dedupe before proceeding. Keep the earliest by `createdAt`:
  ```powershell
  # Inspect manually
  npx prisma studio    # filter User table, sort by userName, find dupes
  # Delete the later one(s)
  ```
- Re-run the audit until 0 dupes
- **Do NOT** skip this step. Step 4.3 will fail otherwise.

### 4.2 — Test connection one more time (READ-ONLY, optional but reassuring)

```powershell
npx prisma db pull --print 2>&1 | Select-Object -First 5
```

Expected: schema preview. Confirms environment is still good before destructive operations.

### 4.3 — Push schema (DESTRUCTIVE — applies constraint changes)

```powershell
npx prisma db push --accept-data-loss
```

Expected output (~5 seconds):
```
Datasource "db": PostgreSQL database "defaultdb", schema "public" at "..."

⚠️  There might be data loss when applying the changes:
  • A unique constraint covering the columns `[userName]` ...
  • A unique constraint covering the columns `[email]` ...
  • A unique constraint covering the columns `[userId,roleId,moduleCode]` ...

🚀  Your database is now in sync with your Prisma schema. Done in N.Ns
✔ Generated Prisma Client (...)
```

The "data loss" warning is about **constraint changes**, not row deletion. The `--accept-data-loss` flag is required to acknowledge.

What this changes:
- `User.userName` becomes globally `@unique`
- `User.email` becomes globally `@unique`
- `UserRole.moduleCode` column added (nullable)
- Composite unique on `UserRole(userId, roleId, moduleCode)` added
- Old `@@unique([customerAccountId, userName])` and `@@unique([customerAccountId, email])` dropped
- Old `@@unique([userId, roleId])` dropped

If it fails with "duplicate values":
- Step 4.1 missed something. Re-run audit.
- Or production data has dupes from a different source. Either way, stop and resolve.

### 4.4 — Backfill UserRole.moduleCode (CRITICAL)

```powershell
npx tsx scripts/prod-backfill-module-code.ts
```

Expected output:
```
Backfilling UserRole.moduleCode…
Found N UserRole row(s) with moduleCode=NULL.

Summary:
  INTERNAL_AUDIT tagged: X
  TPRM tagged:           X
  GRC tagged:            X
  System kept NULL:      X   ← should equal count of GRCAdministrator/TPRMAdmin users (usually 1-3)
  CustomerAdmin updated: X
  CustomerAdmin cloned:  X   ← extra rows for multi-module customer admins

UserRole rows still with moduleCode=NULL: X
  (expected: just system roles — GRCAdministrator/TPRMAdmin)
```

**Critical check**: the final "rows still with moduleCode=NULL" line should ONLY equal the count of super-admins. If it's higher → unknown role names were encountered. Re-read script output for `? Unknown role "..."` warnings and add those role names to the script's known buckets if needed.

This step takes 1-5 seconds depending on user count. **Without it, every existing user sees "No active workspaces" on login.**

### 4.5 — Provision Subscription rows (CRITICAL)

```powershell
npx tsx scripts/prod-provision-subscriptions.ts
```

Expected output:
```
Provisioning subscriptions for N customer(s)…
  ✓ GRC_001 (Acme Corp) — ensured: [GRC]
  ✓ GRC_002 (Globex) — ensured: [GRC, TPRM]
  ⊝ TEST_001 (no flags) — no active module flags, skipping
Done. Provisioned: N, skipped: N.
```

Each customer with active module flags gets a `COMPLIMENTARY` `Subscription` envelope + `ModuleSubscription` rows. Already-active subscriptions are skipped (idempotent).

If any customers show `✗ ... failed: ...` → paste the error, investigate. Usually means a stale data issue (e.g. cancelled subscription that can't be re-activated cleanly).

**Without this**: customers without Subscription rows hit `/subscription-required` because `getAccessSnapshot()` returns all-false.

---

## 5. Smoke tests (browser, ~10 minutes)

Open the app URL in **incognito mode** (so you don't have stale cookies from before the deploy).

### 5.1 Super admin
Login as a `GRCAdministrator` (e.g. superadmin).
- ✅ Lands directly on `/grc`
- ✅ Sees super-admin sidebar (Customer Accounts, Subscription, Email)
- ✅ No workspace picker
- ✅ "Switch workspace" button NOT visible (system bypass)

### 5.2 Multi-module customer admin
Login as a `CustomerAdministrator` whose customer has 2+ modules.
- ✅ Lands on `/select-module` workspace picker
- ✅ Sees cards for each subscribed module
- ✅ Click a card → cookie set → lands on that module's home
- ✅ Sidebar shows only that module's nav (no cross-module leakage)
- ✅ "Switch workspace" button visible at top of sidebar
- ✅ Click Switch Workspace → back to picker → can swap modules

### 5.3 Single-module customer admin
Login as a `CustomerAdministrator` whose customer has only 1 module.
- ✅ Lands directly on the module's home (no picker)
- ✅ No "Switch workspace" button (only 1 module available)

### 5.4 Module-role user
Login as e.g. an `Auditor` (IA only) on a customer with multiple modules.
- ✅ Lands directly on `/internal-audit/dashboard` (single available module)
- ✅ Sees only IA sidebar items

### 5.5 Layout subscription gate
Login as a GRC-only customer admin. Manually paste a non-subscribed URL:
- ✅ `/tprm/program-monitor` → redirects to `/subscription-required?module=TPRM`
- ✅ `/internal-audit/dashboard` → redirects to `/subscription-required?module=INTERNAL_AUDIT`

### 5.6 Header role display
Login as a user with roles in 2 modules.
- ✅ In GRC workspace: header shows their GRC role (e.g. "Department Reviewer")
- ✅ Switch to other workspace: header shows their role for THAT workspace (e.g. "Business Owner")

### 5.7 Cross-module Add User
In `/organization/users` → **All Users** tab:
- ✅ Table shows users from every module with badge column
- ✅ Click "Assign role" on a user not in current module → AssignRoleDialog opens
- ✅ Pick a role → save → refresh → user now has 2 module badges
- ✅ Try assigning the same module again → "In this module" button disabled

### 5.8 Smart Add User cross-customer collision
In `/organization/users` → **Add User**:
- ✅ Try entering a username/email that exists on a different customer
- ✅ See validation error "This username/email is already in use" (no tenant info leaked)

### 5.9 Username collision in same customer
- ✅ Enter username that exists in current customer in a different module → confirmation popup appears with that user's details
- ✅ Confirm → AssignRoleDialog opens scoped to the chosen module

---

## 6. Post-deploy

### 6.1 Rotate the DB password (if password was exposed)
If you pasted the DB password in chat / scripts / commits at any point during this runbook, rotate it now:
1. DO console → DB → Users & Databases tab → ... → Reset Password
2. Update `DATABASE_URL` in DO App Platform env vars
3. Trigger app re-deploy (the app needs the new URL)
4. Verify the app reconnects

### 6.2 Soak time
- UAT: let it soak 24-48 hours before deploying to Prod
- Prod: monitor logs for ~7 days, then archive the backup

### 6.3 Clean up
After 30 days of stable Prod operation:
- Delete the local `pg_dump` backup file
- Delete the forked DB cluster (if you made one)
- Remove your IP from DO Trusted Sources if you don't need ongoing direct DB access

---

## 7. Rollback

If something goes wrong, in order of preference:

### 7a. Re-run the missing step
Most issues are "skipped a step", not "data corruption". Try re-running the suspect step:
- Users see "No active workspaces" → re-run **Step 4.4** (backfill)
- Users see "Subscription required" → re-run **Step 4.5** (provisioning)
- Login picks wrong tenant → re-run **Step 4.1** (audit) — dupes remain

### 7b. Roll back the code only
- DO App Platform → Deployments → find the previous successful deployment → **Re-deploy**
- Schema migration is forward-compatible with the old code for ~most~ operations:
  - Old code reads `UserRole` without `moduleCode` → just ignores the column ✓
  - Old code doesn't read `roleModules` from session → harmless ✓
  - But the new `@unique` on userName/email is permanent — old code that tries to create cross-tenant duplicates will get DB errors
- Workable as a temporary measure while you investigate

### 7c. Restore from backup (last resort)
- **Time cost**: 5-15 minutes to swap connection strings
- DO console → DB → Actions → **Restore from backup** → pick a backup from before the migration
- OR restore the local `pg_dump`:
  ```powershell
  pg_restore --no-owner --no-acl `
    --dbname=$env:DATABASE_URL `
    grc-prod-backup-2026-05-13.dump
  ```
- Note: restoring rolls back **everything** — including new customer signups, payments, audit records. Only restore if data corruption is confirmed and the alternative is worse.

---

## 8. Troubleshooting

### `P1001 Can't reach database server`
- Trusted Sources missing your IP — go to DO console, add it, wait 60s
- Using `.b.db.` host — switch to `.m.db.` (see Section 1.4)
- Using wrong port (25061 = pool, 25060 = direct) — use 25060 for migration commands

### `prisma db push` says "duplicate values exist"
- Audit step (4.1) missed something. Connect via Prisma Studio and find the dupe manually.
- May be a duplicate that was created between Step 4.1 and Step 4.3 (new signups during migration). Halt new signups during migration window if possible.

### "rows still with moduleCode=NULL" > expected count
- The backfill script encountered unknown role names. Re-read the script output for warning lines like `? Unknown role "..."`.
- Add those role names to the appropriate bucket in `prod-backfill-module-code.ts` (IA_ROLES, TPRM_ROLES, GRC_ROLES, or SYSTEM_ROLES) and re-run.

### Users see "No active workspaces" after all migration steps
- Check that user's `UserRole` rows: `npx prisma studio` → User table → click user → click UserRole relation
- Each module-specific role should have `moduleCode` set (not null)
- System roles can have null moduleCode — that's fine, but those users should have `GRCAdministrator` and bypass the picker
- If a user has only NULL moduleCode rows for non-system roles, the backfill missed them — re-run 4.4

### `pg_dump` not found
- Install PostgreSQL client tools from postgresql.org/download
- Make sure the install added `pg_dump` to your PATH
- Alternative: rely on DO's automated daily backups (still a valid safety net)

### Stale JWT cookies — users hit a half-working UI
- Existing JWT cookies don't include `roleModules` (new field). Users need to log out + log in.
- To force-invalidate ALL sessions cluster-wide: rotate `NEXTAUTH_SECRET` env var on DO App Platform → app re-deploys → all existing JWTs become invalid.
- Disruptive but clean. Use during a planned maintenance window only.

### Direct port 25060 not externally reachable
Some DO PG clusters only expose the pool URL externally. In that case:
- Try the pool URL for `prisma db push` (pgbouncer in transaction mode can accept DDL):
  ```powershell
  $env:DATABASE_URL = "postgresql://doadmin:PASS@<host>.m.db.ondigitalocean.com:25061/grc-pool?sslmode=require"
  npx prisma db push --accept-data-loss
  ```
- If pool also fails: spin up a temporary droplet in the same VPC, install Node + Prisma, run migration from there.

---

## 9. Cheat sheet (the 5 commands)

After the pre-flight, the migration is just five commands:

```powershell
# 1. Set the connection
$env:DATABASE_URL = "postgresql://doadmin:<PASS>@<host>.m.db.ondigitalocean.com:25060/defaultdb?sslmode=require"

# 2. Backup (optional but recommended)
pg_dump $env:DATABASE_URL --format=custom --no-owner --no-acl --file=backup-$(Get-Date -Format yyyy-MM-dd).dump

# 3-7. Migration
npx tsx scripts/prod-audit-dupes.ts                # READ-ONLY — verifies no dupes
npx prisma db push --accept-data-loss              # Applies schema (~5s)
npx tsx scripts/prod-backfill-module-code.ts       # Tags UserRole.moduleCode
npx tsx scripts/prod-provision-subscriptions.ts    # Ensures Subscription rows

# 8. Smoke test in browser (incognito)
```

Total wall-clock time including waits: ~30 minutes.

---

## 10. Reference

- Architecture overview: `docs/THREE-PLATFORM-ARCHITECTURE.md`
- Code commit: `c4b1ea23` (Three-Platform Architecture P1-P10)
- Affected DB tables: `User`, `UserRole`, `Subscription`, `ModuleSubscription`, `CustomerAccount`
- Affected env vars: none (legacy `SUBSCRIPTION_GATING_ENABLED` and `MULTI_MODULE_PICKER_ENABLED` removed in P7)
- Migration scripts: `scripts/prod-audit-dupes.ts`, `scripts/prod-backfill-module-code.ts`, `scripts/prod-provision-subscriptions.ts`

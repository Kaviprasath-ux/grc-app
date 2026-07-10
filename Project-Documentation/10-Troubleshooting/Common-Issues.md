# Common Issues and Troubleshooting Guide

## Table of Contents

1. [How to Use This Guide](#how-to-use-this-guide)
2. [Issue 1: Translation Validation Errors](#issue-1-translation-validation-errors)
3. [Issue 2: Permission Denied (403)](#issue-2-permission-denied-403)
4. [Issue 3: Database Connection Errors](#issue-3-database-connection-errors)
5. [Issue 4: TypeScript Build Failures](#issue-4-typescript-build-failures)
6. [Issue 5: Vercel Deployment Failures](#issue-5-vercel-deployment-failures)
7. [Issue 6: Cron Jobs Not Running](#issue-6-cron-jobs-not-running)
8. [Issue 7: File Encryption Errors](#issue-7-file-encryption-errors)
9. [Issue 8: Dynamic Translations Not Appearing](#issue-8-dynamic-translations-not-appearing)
10. [Issue 9: SSO Login Failures](#issue-9-sso-login-failures)
11. [Issue 10: Audit Trail Not Recording](#issue-10-audit-trail-not-recording)
12. [Issue 11: Arabic RTL Layout Issues](#issue-11-arabic-rtl-layout-issues)
13. [Issue 12: Email Not Sending](#issue-12-email-not-sending)
14. [Issue 13: Prisma Client Not Generated](#issue-13-prisma-client-not-generated)
15. [Issue 14: Hot Reload Not Working](#issue-14-hot-reload-not-working)
16. [Issue 15: Port 3000 Already in Use](#issue-15-port-3000-already-in-use)
17. [Issue 16: Missing Environment Variables](#issue-16-missing-environment-variables)
18. [Issue 17: Neon Database Cold Start](#issue-17-neon-database-cold-start)
19. [Issue 18: Module Access Denied](#issue-18-module-access-denied)
20. [Issue 19: File Upload Failures](#issue-19-file-upload-failures)
21. [Issue 20: Session Expiry Issues](#issue-20-session-expiry-issues)
22. [Debug Commands Reference](#debug-commands-reference)
23. [Log Locations](#log-locations)
24. [Enabling Debug Mode](#enabling-debug-mode)

---

## How to Use This Guide

Each issue is documented with three sections:

- **Symptom** — what you observe (error messages, incorrect behavior, missing UI elements)
- **Cause** — the root cause of the issue
- **Solution** — step-by-step resolution

Start by identifying the symptom, then confirm the cause, then apply the solution. If you resolve an issue, also check whether the cause could affect other parts of the system.

---

## Issue 1: Translation Validation Errors

### Symptom

Running `npm run build` or `npm run i18n:generate` fails with an error like:

```
Error: Duplicate phrase found: "Save"
Translation validation failed: 3 duplicate phrase(s) detected
Build failed
```

Or the build output includes warnings:

```
[i18n] WARNING: Duplicate key detected: "Save Changes" appears 2 times
```

### Cause

The `scripts/init-translations.ts` file contains the same English phrase more than once. Every phrase in the `phrases` array must be unique. When duplicates exist, the translation generator cannot determine which Arabic/Latvian translation to use for the phrase, and the build fails.

This typically happens when:
- A developer adds a new translation entry without checking whether the phrase already exists
- A merge/rebase introduces duplicate entries from two branches that both added the same phrase

### Solution

1. Run the i18n generation script to see the full list of errors:
   ```bash
   npx tsx scripts/generate-translations.ts 2>&1 | grep -i duplicate
   ```

2. Open `scripts/init-translations.ts`

3. Search for the duplicate phrase (e.g., `"Save"`) — use your editor's find-all feature

4. Remove the duplicate entry, keeping only one. If the translations differ between the two entries, merge the best translations into the single entry.

5. Re-run:
   ```bash
   npm run i18n:generate
   ```

6. Confirm the build passes:
   ```bash
   npm run build
   ```

**Prevention:** Before adding a new phrase to `init-translations.ts`, search for the phrase first to ensure it does not already exist.

---

## Issue 2: Permission Denied (403)

### Symptom

An API call returns HTTP 403 with a response body like:

```json
{ "error": "Forbidden", "message": "You do not have permission to perform this action" }
```

Or in the UI, a page shows "Access Denied" or does not render certain buttons (Create, Edit, Delete) that other users can see.

### Cause

The most common causes:

**A) The user's role does not include the required permission.** The permission check in the API route is for a resource/action pair (e.g., `{ resource: 'compliance.governance', action: 'create' }`), and the user's role does not have this permission in `src/lib/permissions.ts`.

**B) The user has not been assigned any role.** A new user account was created without a role assignment.

**C) The module subscription flag is not set.** Some modules (TPRM, for example) require a subscription flag on the `CustomerAccount` record to be enabled. Without it, all APIs for that module return 403.

**D) A new permission was added to the route but not to the permissions matrix.** A developer added `withAuth(handler, { resource: 'new.feature', action: 'view' })` to an API route but did not add `new.feature` to `src/lib/permissions.ts`.

### Solution

**Check the user's role:**
1. Log in as superadmin
2. Navigate to the User Management page
3. Find the user and check their assigned roles
4. Assign the appropriate role if missing

**Check the permissions matrix:**
1. Open `src/lib/permissions.ts`
2. Find the resource being blocked (e.g., `compliance.governance`)
3. Verify the action is listed for the user's role
4. If missing, add the permission mapping and redeploy

**Check the subscription flag (for TPRM):**
1. Log in as superadmin
2. Navigate to Customer Accounts
3. Open the customer's account
4. Verify the TPRM module flag is enabled

**Check the API route:**
1. Find the API route file for the failing endpoint
2. Verify the `withAuth` call has the correct resource and action
3. Use the network tab in browser DevTools to see the exact 403 response body, which may include a more specific error message

---

## Issue 3: Database Connection Errors

### Symptom

```
PrismaClientInitializationError: Can't reach database server at `localhost:5432`
```

Or:

```
Error: P1001: Can't reach database server at `ep-xxx.neon.tech:5432`
```

Or (Neon-specific):

```
NeonDbError: endpoint is disabled
```

Or pages load very slowly (3–10 seconds) before responding normally.

### Cause

**Local development:** The local PostgreSQL service is not running, or `DATABASE_URL` in `.env.local` is wrong.

**Production (Neon):** The Neon database has autosuspended (free tier) and is in the process of waking up. The "endpoint is disabled" error appears when the compute is in a transitional suspended state. Subsequent requests will succeed after 1–5 seconds.

**Wrong connection string:** `DATABASE_URL` contains a typo, wrong password, or is pointing to the wrong environment.

### Solution

**For local development:**

```bash
# Check if PostgreSQL is running (Windows)
Get-Service -Name postgresql*

# Start it if stopped
Start-Service -Name postgresql-x64-16  # adjust service name

# Verify connection
psql "postgresql://postgres:postgres@localhost:5432/grc_app" -c "SELECT 1;"
```

**For Neon cold start:**

This is expected behavior on the free tier. Wait 2–5 seconds and retry the request. If it happens on every first request after idle, implement a keep-alive endpoint.

**For wrong connection string:**

```bash
# Test the connection string
psql "$DATABASE_URL" -c "SELECT version();"

# Check the DATABASE_URL is set
echo $DATABASE_URL  # Linux/Mac
$env:DATABASE_URL   # PowerShell
```

**Check Neon Console:**
1. Go to https://console.neon.tech
2. Navigate to your project
3. Check the compute status (Active vs. Suspended)
4. Verify the endpoint hostname and credentials in Settings → Roles

---

## Issue 4: TypeScript Build Failures

### Symptom

`npm run build` fails with TypeScript errors:

```
Type error: Type 'null' is not assignable to type 'string | undefined'.
Type error: Object is possibly 'null'.
Type error: Property 'X' does not exist on type 'Y'.
```

### Cause

Next.js production builds run strict TypeScript checking. Errors that TypeScript may skip in development (`next dev`) are enforced in production builds (`next build`). Common causes:

- `null` used where `undefined` is expected (TypeScript distinguishes these)
- Prisma query result fields that can be null not being null-checked before use
- Missing fields when constructing objects that match an interface
- Using `any` implicitly (no type annotation on function parameters)
- Awaiting `context.params` (required in Next.js 16) vs. accessing it directly

### Solution

**Always run `npm run build` locally before pushing to Vercel.** This catches TypeScript errors before they become deployment failures.

**Common fixes:**

```typescript
// Null vs undefined
// Error: Type 'null' is not assignable to type 'string | undefined'
const name = record.name || null;  // Wrong
const name = record.name || undefined;  // Correct

// Null checks on Prisma results
// Error: Object is possibly null
const risk = await prisma.risk.findUnique({ where: { id } });
risk.name;  // Wrong: risk could be null
if (!risk) return notFound();
risk.name;  // Correct: TypeScript now knows risk is not null

// Next.js 16 params
// Error: Property 'id' does not exist on type 'Promise<{ id: string }>'
const { id } = context.params;  // Wrong
const { id } = await context.params;  // Correct

// Explicit type annotations
const handler = (event) => {};  // Wrong: implicit any
const handler = (event: React.MouseEvent) => {};  // Correct
```

**Finding all TypeScript errors at once:**

```bash
npx tsc --noEmit 2>&1 | head -50
```

This runs TypeScript without producing output files, showing all type errors. Fix them from top to bottom (errors cascade — fixing early ones often resolves later ones).

---

## Issue 5: Vercel Deployment Failures

### Symptom

A push to the main branch triggers a Vercel build, but the deployment fails. The Vercel dashboard shows the deployment in "Error" state.

### Cause

The most common cause is a build error (TypeScript errors, missing dependencies, broken imports). Rarely, it can be a Vercel infrastructure issue or an environment variable problem.

### Solution

1. **Check build logs in the Vercel dashboard:**
   - Open the failed deployment
   - Click "View Build Logs"
   - Scroll to the first red error line

2. **Reproduce locally:**
   ```bash
   npm run build
   ```
   If the local build fails, fix it before pushing again.

3. **Check for common issues:**
   - A new `npm` package was added but `package-lock.json` was not committed
   - An import path is wrong (works on Windows, fails on Linux due to case sensitivity)
   - A newly added file references an environment variable that is not set in Vercel

4. **Verify environment variables are set:**
   - In Vercel dashboard, check that all required env vars are present for the Production environment
   - A missing env var (e.g., `NEXTAUTH_SECRET`) will cause a build or runtime failure

5. **Case sensitivity (Windows vs. Linux):**
   Vercel builds on Linux, which has case-sensitive file paths. Windows is case-insensitive. An import like `import { Button } from '@/components/ui/button'` might work on Windows but fail on Vercel if the file is actually named `Button.tsx`.

   ```bash
   # Find case mismatches (run on Linux/WSL)
   git ls-files | sort -f | uniq -di
   ```

---

## Issue 6: Cron Jobs Not Running

### Symptom

The daily due-reminder emails are not being sent. Or, when testing the cron endpoint manually, it responds with 401 Unauthorized.

### Cause

**A) `CRON_SECRET` environment variable is not set in Vercel.** The cron endpoint requires a bearer token. Without `CRON_SECRET`, the authentication check fails.

**B) Free Vercel tier.** Vercel Cron Jobs require a Pro plan. On the free (Hobby) tier, crons defined in `vercel.json` are not executed.

**C) `vercel.json` is not deployed.** If `vercel.json` was added or modified but a new deployment has not been triggered since, the cron configuration is not active.

**D) The cron route itself has a bug.** The endpoint is called but throws an error.

### Solution

**Verify CRON_SECRET:**
```bash
# Test the endpoint with the correct secret
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://grc-app-ba-testing.vercel.app/api/cron/due-reminders
```

**Test locally (no auth required in development):**
```bash
curl http://localhost:3000/api/cron/due-reminders
```

**Check Vercel plan:**
Log in to the Vercel dashboard and check if the project is on a Hobby or Pro plan. Cron Jobs only execute on Pro plans.

**Manual trigger (workaround for free tier):**
If cron execution is needed on the free tier, use an external cron service (cron-job.org, GitHub Actions, etc.) to send HTTP requests to the endpoint on a schedule.

**Check cron logs:**
```bash
vercel logs grc-app-ba-testing --since 24h | grep cron
```

---

## Issue 7: File Encryption Errors

### Symptom

When uploading a file or accessing a page that reads encrypted files:

```
Error: FIELD_ENCRYPTION_KEY is not set
```

Or:

```
Error: Decryption failed: invalid key or corrupted data
```

Or files download as garbled binary content instead of readable data.

### Cause

**A) `FIELD_ENCRYPTION_KEY` is not set.** The AES-256-GCM encryption requires a 32-byte key encoded in base64. If the variable is missing, the encryption extension cannot function.

**B) `FIELD_ENCRYPTION_KEY` is in the wrong format.** The key must be exactly 32 bytes, base64-encoded. A common mistake is using a plain-text passphrase instead of a proper binary key.

**C) The key was rotated but old data was not re-encrypted.** After rotating the encryption key, all existing encrypted records must be re-encrypted with the new key before the old key is removed.

**D) `ENCRYPTION_ENABLED` is set to `true` in one environment but `false` in another.** Records encrypted when `ENCRYPTION_ENABLED=true` cannot be read when `ENCRYPTION_ENABLED=false` (they will be returned as raw encrypted bytes).

### Solution

**Generate a correct encryption key:**
```bash
# Generate a 32-byte random key, base64-encoded
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Set the key:**
Add the output as `FIELD_ENCRYPTION_KEY` in your `.env.local` (local) or Vercel environment variables (production).

**For key rotation:**
```bash
npm run encrypt:rotate-key
```

This script re-encrypts all existing data with the new key. Run it before removing the old key.

**Verify encryption is working:**
```bash
npm run encrypt:verify
```

This samples encrypted records and decrypts them, confirming the key and data are consistent.

**Check the kill switch:**
Verify that `ENCRYPTION_ENABLED` is set to the same value in all environments. If local is `false` and production is `true`, data created locally will not be encrypted, but production expects it to be.

---

## Issue 8: Dynamic Translations Not Appearing

### Symptom

A user switches to Arabic or Latvian. Records that were created display in English (untranslated) instead of the language the user selected. The static UI labels are correctly translated, but the data content (risk names, control descriptions, etc.) is not.

### Cause

**A) `triggerTranslation()` is not called on the page that creates/edits the record.** The client-side translation trigger is missing.

**B) `translateRecord()` is not called in the API route handler.** The server-side translation trigger is missing.

**C) The Python API is down or misconfigured.** Translation requests are being sent but failing silently.

**D) `useTranslatedData()` is not used on the list page.** The component is rendering the raw (untranslated) records instead of the translated copies.

**E) The model is not registered in `translation-config.ts`.** The translation system does not know which fields of this model to translate.

**F) The user created the record before translation was wired up.** Records created before translation was implemented have no translations in the DB. They will remain untranslated until edited.

### Solution

**Check the DB for existing translations:**
```sql
-- In Neon Console or psql
SELECT * FROM "DynamicTranslation"
WHERE "modelName" = 'Risk'
LIMIT 10;
```

If this returns no rows, no translations exist yet for Risk records.

**Trace the translation call:**

1. Open the API route handler for the relevant create/edit endpoint
2. Verify `translateRecord()` is called after the DB write:
   ```typescript
   if (customerAccountId) {
     void translateRecord(customerAccountId, 'Risk', risk.id, {
       name: risk.name,
       description: risk.description
     });
   }
   ```

3. Open the page component for the create/edit form
4. Verify `triggerTranslation()` is called after a successful save:
   ```typescript
   triggerTranslation('Risk', savedRisk.id, { name: savedRisk.name, description: savedRisk.description });
   ```

5. Open the list page component
6. Verify `useTranslatedData()` is used:
   ```typescript
   const { data: translatedRisks } = useTranslatedData(risks, { modelName: 'Risk' });
   // Make sure translatedRisks is used for rendering, not the raw risks
   ```

**Test the Python API:**
```bash
curl -X POST "$PYTHON_API_URL/api/translate" \
  -H "Authorization: Bearer $PYTHON_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello World", "source_language": "en", "target_language": "ar"}'
```

---

## Issue 9: SSO Login Failures

### Symptom

Clicking "Login with Microsoft" (or another OAuth provider) redirects to the provider's login page, but after authentication, the user is redirected back with an error:

```
Error: OAuth callback URL mismatch
```

Or:

```
NextAuthError: redirect_uri_mismatch
```

Or the login completes at the provider but the user is redirected to an error page in the application.

### Cause

**A) The callback URL registered with the OAuth provider does not match the actual callback URL.** NextAuth handles OAuth callbacks at `/api/auth/callback/[provider]`. The provider (Microsoft Azure AD, Google, etc.) must have this exact URL registered as an allowed redirect URI.

**B) `NEXTAUTH_URL` is set incorrectly.** NextAuth uses `NEXTAUTH_URL` to construct callback URLs. If `NEXTAUTH_URL` is `http://localhost:3000` but the application is running on `https://grc-app-ba-testing.vercel.app`, the callback URL will not match.

**C) OAuth credentials (client ID / client secret) are incorrect or expired.** The OAuth application registration has been deleted, the secret has expired, or the credentials were copied incorrectly.

### Solution

**Verify NEXTAUTH_URL:**
- Local: `NEXTAUTH_URL=http://localhost:3000`
- Production: `NEXTAUTH_URL=https://grc-app-ba-testing.vercel.app`

**Register the callback URL with the provider:**

For Microsoft Azure AD:
1. Go to Azure Portal → Azure Active Directory → App Registrations
2. Open your app registration
3. Navigate to Authentication → Redirect URIs
4. Add: `https://grc-app-ba-testing.vercel.app/api/auth/callback/azure-ad`

For Google:
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Open your OAuth 2.0 Client
3. Add authorized redirect URIs: `https://grc-app-ba-testing.vercel.app/api/auth/callback/google`

**Verify credentials in `.env.local` / Vercel:**
Check that `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` (or equivalent for your provider) are correctly set.

---

## Issue 10: Audit Trail Not Recording

### Symptom

The Audit Trail page in Internal Audit shows no activity, or specific actions (create, update, delete) are not appearing in the trail even though users are performing those actions.

### Cause

**A) The API route is not wrapped with `withAuth`.** The audit trail is recorded by the `withAuth` middleware. Routes that use raw `NextResponse` handlers (not going through `withAuth`) do not automatically record to the audit trail.

**B) The audit trail record is filtered to a `customerAccountId` that does not match.** The audit trail query filters by the current user's `customerAccountId`. If a route records the audit log with a different ID (or without one), the record exists but is not visible.

**C) The audit trail DB write failed silently.** Audit trail writes are secondary operations; if they fail, the primary operation still succeeds. Check the server logs for audit trail write errors.

### Solution

**Verify API routes use `withAuth`:**
```typescript
// Correct pattern — audit trail recorded automatically
export const POST = withAuth(
  async (req, context, session) => { /* ... */ },
  { resource: 'module.resource', action: 'create' }
);

// Missing audit trail — do NOT use for authenticated routes
export async function POST(req: NextRequest) { /* ... */ }
```

Every API route that performs actions requiring an audit trail must use `withAuth`. If the route is currently a raw handler, refactor it to use `withAuth`.

**Check server logs:**
```bash
vercel logs grc-app-ba-testing --since 1h | grep -i "audit"
```

---

## Issue 11: Arabic RTL Layout Issues

### Symptom

When the user switches to Arabic:
- Buttons and icons are in the wrong position (left-aligned instead of right)
- Text overflows or is cut off
- Icons such as chevrons (arrows) point in the wrong direction
- Layout elements overlap

### Cause

Components were written without RTL support. Tailwind utility classes like `ml-4` (margin-left: 16px) are directional and do not automatically reverse for RTL layouts.

### Solution

Use Tailwind's `ltr:` and `rtl:` variants for directional styles:

```tsx
// Wrong: only works for LTR
<div className="ml-4">...</div>

// Correct: margin-left for LTR, margin-right for RTL
<div className="ltr:ml-4 rtl:mr-4">...</div>

// Icons that indicate direction (chevrons, arrows)
<ChevronRight className="ltr:rotate-0 rtl:rotate-180" />

// Padding
<div className="ltr:pl-4 rtl:pr-4">...</div>

// Text alignment
<p className="ltr:text-left rtl:text-right">...</p>

// Flex row direction
<div className="flex ltr:flex-row rtl:flex-row-reverse">...</div>
```

The `dir="rtl"` attribute is set on the `<html>` element by the LanguageContext when Arabic is selected. Tailwind's `rtl:` variants respond to this attribute.

**Test RTL layouts:** Always test pages in Arabic language mode, not just in English. Switch to Arabic in the language selector and visually inspect all UI elements.

---

## Issue 12: Email Not Sending

### Symptom

Users are not receiving email notifications (due reminders, audit assignments, CAPA notifications). No errors appear on screen (the action completes successfully), but emails never arrive.

### Cause

**A) SMTP environment variables are not set or are incorrect.** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` must all be set correctly.

**B) SMTP server is blocking the connection.** Port 25 is blocked by many cloud providers (including Vercel/AWS). Use port 587 (STARTTLS) or 465 (SSL/TLS).

**C) The email template is broken.** A bug in the email template causes the Nodemailer call to fail silently.

**D) Rate limiting by the SMTP provider.** Too many emails sent in a short period triggered rate limiting.

### Solution

**Test SMTP connection locally:**
```javascript
// test-smtp.js — run with: node test-smtp.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) console.error('SMTP Error:', error);
  else console.log('SMTP connection OK');
});
```

**Check server logs for email errors:**
```bash
vercel logs grc-app-ba-testing --since 1h | grep -i "smtp\|email\|nodemailer"
```

**Common SMTP port settings:**
- Port 587: STARTTLS (recommended for most providers)
- Port 465: SSL/TLS
- Port 25: Not recommended (blocked by cloud providers)

**Verify email templates:**
Test email sending from a simple endpoint before blaming the SMTP configuration. If the SMTP test passes but specific emails still don't send, the issue is in the template or trigger code.

---

## Issue 13: Prisma Client Not Generated

### Symptom

TypeScript errors referencing Prisma types:

```
Module '"@prisma/client"' has no exported member 'Risk'.
Cannot find module '.prisma/client' or its corresponding type declarations.
```

Or at runtime:

```
PrismaClientKnownRequestError: The table `Risk` does not exist in the current database.
```

### Cause

The Prisma client (`node_modules/.prisma/client`) has not been generated after the latest schema changes. This happens when:

- `prisma/schema.prisma` was modified but `npx prisma generate` was not run
- `node_modules` was deleted and reinstalled but `prisma generate` was not run afterward
- The Prisma version was upgraded

### Solution

```bash
# Regenerate the Prisma client
npx prisma generate

# If that doesn't help, also push the schema changes to the database
npx prisma db push  # For local development
```

If you deleted `node_modules`:
```bash
npm install          # Reinstalls packages
npx prisma generate  # Regenerates client
```

**Prevention:** The project's `postinstall` script (or build script) should include `prisma generate`. Verify `package.json` has:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

---

## Issue 14: Hot Reload Not Working

### Symptom

After saving a file during `npm run dev`, the browser does not automatically update. You must manually refresh the page to see changes.

### Cause

**A) Turbopack issue.** The project uses Turbopack (Next.js 16's bundler). Occasional bugs in Turbopack can cause hot reload to stop working.

**B) File system events not being detected.** On Windows with some anti-virus software or network drives, file system events may not trigger properly.

**C) The dev server crashed.** The terminal running `npm run dev` may have an error, or the process may have silently crashed.

### Solution

1. Check the terminal running `npm run dev` for error messages
2. Restart the dev server:
   ```bash
   # Stop the dev server (Ctrl+C)
   # Then restart
   npm run dev
   ```
3. Clear the Next.js cache:
   ```bash
   # Remove .next directory and restart
   rm -rf .next
   npm run dev
   ```
4. If using Windows Defender, add the project directory to the exclusion list for real-time scanning

---

## Issue 15: Port 3000 Already in Use

### Symptom

```
Error: listen EADDRINUSE: address already in use :::3000
```

### Cause

Another process is already using port 3000. This is usually a previous `npm run dev` process that was not properly terminated, or another application using port 3000.

### Solution

```bash
# Find the process using port 3000 (PowerShell)
netstat -ano | findstr :3000
# Note the PID in the last column

# Kill the process
taskkill /PID <PID> /F

# Or use a different port
npm run dev -- --port 3001
```

After killing the process, run `npm run dev` again.

---

## Issue 16: Missing Environment Variables

### Symptom

The application starts, but features fail with errors like:

```
TypeError: Cannot read properties of undefined (reading 'split')
```

Or API calls fail with 500 errors that, when inspected in server logs, show:

```
Error: NEXTAUTH_SECRET is not set
Error: DATABASE_URL is not defined
```

### Cause

A required environment variable is not defined in the current environment. In local development, this means `.env.local` is missing or incomplete. In production, it means a Vercel environment variable was not set.

### Solution

**For local development:**

1. Check if `.env.local` exists: `ls .env.local`
2. If it does not exist, create it from the example:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with actual values
   ```
3. Ensure all required variables are set (see the Required Environment Variables section in the Vercel Deployment guide)

**For production:**

```bash
# Check which env vars are set in Vercel
vercel env ls
```

Add any missing variables:
```bash
vercel env add MISSING_VARIABLE_NAME production
```

**Finding missing variables at build time:**

The project should validate required environment variables at startup. If this check is not implemented, add a startup check to `src/lib/env-validation.ts`.

---

## Issue 17: Neon Database Cold Start

### Symptom

The first request after a period of inactivity (typically more than 5 minutes on Neon free tier) takes 3–10 seconds. Subsequent requests respond in under 1 second.

Users may see a loading spinner or the page may appear to hang briefly.

### Cause

Neon's free tier autosuspends the database compute after 5 minutes of inactivity. The first query after suspension must wait for the compute instance to resume. This is by design and expected behavior on the free tier.

### Solution

**Accept it (current approach):**
For a BA testing environment, cold starts are tolerable. Document that the first load after idle may take a few seconds.

**Prevent autosuspend with keep-alive pings:**
Set up a cron job (external or via Vercel if on Pro) that sends a lightweight request every 4 minutes:

```bash
# Keep-alive endpoint to add: GET /api/health
# Returns: { "status": "ok", "db": "connected" }
# Cron: every 4 minutes
```

**Upgrade Neon:**
Paid Neon plans allow disabling autosuspend. This eliminates cold starts entirely. For a production environment with SLA requirements, upgrade is recommended.

**Show a loading indicator:**
If cold starts cannot be eliminated, improve UX by showing a meaningful loading state and a "Connecting to database..." message for the first load.

---

## Issue 18: Module Access Denied

### Symptom

A user with what appears to be the correct role cannot access a specific module (e.g., TPRM, Internal Audit). The sidebar item may not appear, or accessing the URL directly shows "Access Denied."

### Cause

Some modules require a feature flag (subscription flag) to be enabled on the `CustomerAccount` record in the database. This is separate from the user's role. Even if the user has the correct role, if the module flag is off, access is denied.

Flags include:
- `enableTPRM` — for Third-Party Risk Management module
- `enableInternalAudit` — for Internal Audit module
- Others as the product expands

### Solution

1. Log in as superadmin
2. Navigate to **Admin → Customer Accounts**
3. Find and open the customer account
4. Enable the relevant module flag (e.g., `Enable TPRM`)
5. Save the changes

The change takes effect on the user's next page navigation or login.

**Verify in the database:**
```sql
SELECT "enableTPRM", "enableInternalAudit" FROM "CustomerAccount"
WHERE id = 'customer-account-id';
```

---

## Issue 19: File Upload Failures

### Symptom

When attempting to upload a file (compliance evidence, governance document, audit working paper), the upload fails with:

```
Error: File upload failed
```

Or a 500 error in the network tab without a clear message.

### Cause

**A) File size exceeds limit.** The default Next.js body size limit is 4MB. Large files (PDFs, spreadsheets) may exceed this.

**B) The `uploads/` directory does not exist or has no write permissions.**

**C) The file's MIME type is not in the allowed list.**

**D) Encryption error.** If `FIELD_ENCRYPTION_KEY` is not set and encryption is enabled, the file write will fail.

### Solution

**Check file size limits:**
In `next.config.ts`, verify the body size limit is appropriate:
```typescript
const nextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
```

**Create the uploads directory:**
```bash
mkdir -p uploads
# On Linux/Mac, set permissions:
chmod 755 uploads
```

**Check MIME types:**
The file upload handler should list allowed MIME types. Verify the file being uploaded matches an allowed type.

**Check for encryption errors:**
See Issue 7 for `FIELD_ENCRYPTION_KEY` troubleshooting.

---

## Issue 20: Session Expiry Issues

### Symptom

Users are logged out unexpectedly. Or after a period of inactivity, users receive a 401 Unauthorized error and are redirected to the login page mid-workflow.

### Cause

**A) `NEXTAUTH_SECRET` is different between restarts.** If `NEXTAUTH_SECRET` is not set (or is randomly generated each startup), existing sessions become invalid after a restart.

**B) JWT session token has expired.** NextAuth sessions have a configurable expiry time. If the session expires while the user is inactive, they must re-authenticate.

**C) The session cookie was cleared** by the browser (e.g., incognito mode, browser cache clear).

### Solution

**Ensure NEXTAUTH_SECRET is stable:**
`NEXTAUTH_SECRET` must be a fixed, persistent value stored in your environment variables. It must NEVER change between deployments (it would invalidate all active sessions).

Generate one:
```bash
openssl rand -base64 32
```

Save this value as `NEXTAUTH_SECRET` in `.env.local` and in Vercel. Do not regenerate it.

**Configure session duration:**
In `src/lib/auth.ts`, configure an appropriate session maxAge:
```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    maxAge: 8 * 60 * 60, // 8 hours in seconds
  },
  // ...
});
```

**For long-running workflows:**
Consider implementing session refresh: automatically renew the session token when the user makes an API call within a certain window before expiry.

---

## Debug Commands Reference

```bash
# Check Prisma schema status
npx prisma migrate status

# Open Prisma Studio (database GUI)
npx prisma studio

# View schema diff between local and DB
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma

# TypeScript check without building
npx tsc --noEmit

# Run i18n generation and check for errors
npm run i18n:generate

# Check environment variables are loaded
node -e "require('dotenv').config({ path: '.env.local' }); console.log(process.env.DATABASE_URL ? 'DB OK' : 'DB MISSING')"

# Test Neon connection
psql "$DATABASE_URL" -c "SELECT version();"

# View Vercel deployment logs
vercel logs grc-app-ba-testing --since 1h

# Test cron endpoint locally
curl http://localhost:3000/api/cron/due-reminders

# List all Vercel deployments
vercel ls grc-app-ba-testing

# Check Vercel environment variables
vercel env ls

# Clear Next.js build cache
rm -rf .next

# Check for port conflicts
netstat -ano | findstr :3000

# Verify encryption
npm run encrypt:verify
```

---

## Log Locations

| Environment | Location | Access Method |
|---|---|---|
| Local dev | Terminal running `npm run dev` | Direct terminal output |
| Local dev (verbose) | Terminal output | Set `LOG_LEVEL=debug` in `.env.local` |
| Vercel production | Vercel dashboard or CLI | `vercel logs grc-app-ba-testing` |
| Neon query log | Neon Console → Monitoring | https://console.neon.tech |
| Browser client logs | Browser DevTools → Console | F12 → Console tab |
| Network requests | Browser DevTools → Network | F12 → Network tab |

---

## Enabling Debug Mode

### NextAuth Debug Logging

Add to `.env.local`:
```
NEXTAUTH_DEBUG=true
```

This enables verbose NextAuth logging including OAuth flow details, session creation, and JWT decoding.

### Prisma Query Logging

In `src/lib/prisma.ts`, the Prisma client logs queries in development:
```typescript
new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})
```

To enable query logging in production temporarily (use caution — logs contain SQL):
```
PRISMA_LOG_LEVEL=query
```

### Next.js Debug Mode

```bash
# Enable Next.js verbose output
DEBUG=next:* npm run dev
```

### Translation Debug

To trace translation calls, add to `.env.local`:
```
TRANSLATION_DEBUG=true
```

This logs each translation request and response to the server console (field values are redacted using `safeLog`).

---

*Last updated: 2026-06-29*
*Module version: GRC App — GRC-MultiTenant branch*

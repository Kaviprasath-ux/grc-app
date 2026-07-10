# Environment Variables Reference

## Overview

This document explains every environment variable used by the GRC application. It covers what each variable does, why it is needed, how to generate or obtain it, and what breaks if it is missing.

---

## 1. What Are Environment Variables?

### The Real-World Analogy

Think of a coffee machine in an office. Every employee uses the same machine, but each person has their own coffee preference — some want strong espresso, some want decaf, some add sugar. Instead of buying a different machine for each person, you program the machine with settings that each user can customize.

Environment variables work the same way. The application code is the coffee machine — it is the same for everyone. But each deployment (your local laptop, a colleague's laptop, the production server) needs different settings:

- Your laptop connects to a local SQLite database
- The production server connects to a Neon PostgreSQL database in the cloud
- The test server connects to a separate test database

Rather than hardcoding these values directly into the code (which would mean different code for different environments — a maintenance nightmare), the values are stored in environment variables that the code reads at startup.

### Why Are They Kept Secret?

Some environment variables contain sensitive credentials:
- Database connection strings contain passwords
- `NEXTAUTH_SECRET` signs user session tokens — if an attacker has it, they can forge login sessions
- `FIELD_ENCRYPTION_KEY` encrypts sensitive data — if it leaks, encrypted data is compromised
- OAuth secrets allow impersonation of your application

If you committed these values to Git, they would be permanently visible in the repository history — even if you deleted them in a later commit. GitHub automatically scans public repositories for credentials and will alert you (and possibly revoke them).

**The golden rule: environment variables containing secrets MUST NEVER be committed to Git.**

---

## 2. How .env Files Work in Next.js

Next.js supports several `.env` file variants, each with a different purpose:

| File | When It Is Loaded | Should Be in Git? |
|------|-------------------|-------------------|
| `.env` | Always (all environments) | Yes (for non-secret defaults) |
| `.env.local` | Always, overrides `.env` | **No** (in `.gitignore`) |
| `.env.development` | Only when `NODE_ENV=development` | Yes (if no secrets) |
| `.env.production` | Only when `NODE_ENV=production` | Yes (if no secrets) |
| `.env.development.local` | Development only, overrides all | **No** |
| `.env.production.local` | Production only, overrides all | **No** |

**For local development:** Put your variables in `.env.local`. This file is listed in `.gitignore` and will never be committed.

**For production:** Set variables in the Vercel dashboard (see the Deployment guide). Never put secrets in files that are committed to the repository.

### Variable Prefix Rules in Next.js

- Variables named `NEXT_PUBLIC_*` are exposed to the browser (client-side JavaScript). Use this only for non-secret values.
- All other variables are server-side only — they are never sent to the browser.

---

## 3. The .env.local File

Create this file at the root of the project (same level as `package.json`). Here is a complete template with explanations for each variable:

```env
# =============================================
# DATABASE
# =============================================
DATABASE_URL="file:./dev.db"

# =============================================
# AUTHENTICATION
# =============================================
NEXTAUTH_SECRET="generate-a-random-string-at-least-32-characters"
NEXTAUTH_URL="http://localhost:3000"

# =============================================
# ENCRYPTION
# =============================================
ENCRYPTION_ENABLED="false"
FIELD_ENCRYPTION_KEY=""

# =============================================
# CRON JOBS
# =============================================
CRON_SECRET=""

# =============================================
# TRANSLATION SERVICE (Python backend)
# =============================================
PYTHON_API_URL=""
PYTHON_API_SECRET=""

# =============================================
# EMAIL (SMTP)
# =============================================
EMAIL_HOST=""
EMAIL_PORT=""
EMAIL_USER=""
EMAIL_PASS=""

# =============================================
# OAUTH — GOOGLE
# =============================================
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# =============================================
# OAUTH — MICROSOFT AZURE AD
# =============================================
AZURE_AD_CLIENT_ID=""
AZURE_AD_CLIENT_SECRET=""
AZURE_AD_TENANT_ID=""
```

---

## 4. Variable Reference

---

### DATABASE_URL

**What is it?**
The connection string that tells the application where to find the database and how to connect to it.

**Why is it needed?**
Every time the application reads or writes data (users, risks, compliance records, etc.), it uses this connection string to connect to the correct database. Without it, the application cannot start.

**Format for local SQLite development:**
```
DATABASE_URL="file:./dev.db"
```
This means "use a SQLite file named `dev.db` located in the `prisma/` folder (relative to where Prisma runs)".

**Format for Neon PostgreSQL (production):**
```
DATABASE_URL="postgresql://username:password@hostname/dbname?sslmode=require"
```

**Example values:**
```
# Local SQLite:
DATABASE_URL="file:./dev.db"

# Neon PostgreSQL (cloud):
DATABASE_URL="postgresql://neondb_owner:my_password@ep-small-sea-ahhjbm6p.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

**How to obtain it:**
- For local development: use `"file:./dev.db"` — no setup required.
- For Neon PostgreSQL: log into your Neon dashboard (`https://console.neon.tech`), select your project, click **"Connection Details"**, and copy the connection string.

**What happens if it is missing:**
The application fails to start with the error: `Error: Environment variable not found: DATABASE_URL`.

---

### NEXTAUTH_SECRET

**What is it?**
A secret string used to sign and encrypt the JSON Web Tokens (JWTs) that represent user sessions. When a user logs in, NextAuth creates a JWT signed with this secret. On every subsequent request, the server verifies the token's signature using the same secret.

**Why is it needed?**
Without this secret, the JWT signature cannot be verified, and every authenticated request will fail. The application will redirect all pages to the login screen.

**How to generate it:**

Option 1 — Using Node.js (recommended):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
This outputs something like: `K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=`

Option 2 — Using the OpenSSL command (macOS/Linux):
```bash
openssl rand -base64 32
```

Option 3 — Use the NextAuth secret generator at `https://generate-secret.vercel.app/32`.

**Example value:**
```
NEXTAUTH_SECRET="K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols="
```

**Requirements:**
- Must be at least 32 characters long
- Must be random (do not use dictionary words)
- Must be kept secret (never share it, never commit it)

**What happens if it is missing:**
Authentication fails. You will be immediately redirected to the login page on every request, and login itself will fail with a cryptographic error.

**Important:** Use a DIFFERENT secret for local development and production. If your local development secret is ever compromised, it should not affect the production environment.

---

### NEXTAUTH_URL

**What is it?**
The base URL of the application. NextAuth uses this to construct callback URLs for OAuth providers and for redirects after login/logout.

**Why is it needed?**
OAuth providers (Google, Microsoft) need to redirect back to a specific URL after the user authenticates. That URL must match exactly what you configured in the OAuth provider's settings. NextAuth constructs those callback URLs using `NEXTAUTH_URL`.

**Values:**
```
# Local development:
NEXTAUTH_URL="http://localhost:3000"

# Vercel production:
NEXTAUTH_URL="https://grc-app-ba-testing.vercel.app"
```

**What happens if it is missing:**
On Vercel, NextAuth can usually detect the URL automatically. But for OAuth providers, redirect URLs may not work correctly without this being explicitly set.

---

### FIELD_ENCRYPTION_KEY

**What is it?**
A 256-bit (32-byte) symmetric encryption key used to encrypt sensitive file data stored in the database. The application uses AES-256-GCM encryption.

**Why is it needed?**
File attachments uploaded by users (evidence files, audit documents, etc.) are encrypted at rest in the database. The encryption key is required to both encrypt files when they are saved and decrypt them when they are retrieved.

**How to generate it:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Example value (DO NOT USE THIS IN PRODUCTION):**
```
FIELD_ENCRYPTION_KEY="eHQmhfX3GjD9Ul7M5AKyBvLNWpCo+T1ZsI8/0RnuYEk="
```

**Requirements:**
- Must be exactly 32 bytes, base64-encoded (the `randomBytes(32).toString('base64')` command produces exactly this)
- Must never change after production data has been encrypted — changing the key makes all existing encrypted data unreadable
- Store a secure backup of this key in a password manager (1Password, Bitwarden, etc.)

**What happens if it is missing (when ENCRYPTION_ENABLED=true):**
The application will throw an error when attempting to read or write encrypted files. All file uploads and downloads will fail.

**Local development tip:** Set `ENCRYPTION_ENABLED="false"` to skip encryption entirely for local development. You only need `FIELD_ENCRYPTION_KEY` when encryption is enabled.

---

### ENCRYPTION_ENABLED

**What is it?**
A flag that turns file encryption on or off. Set to `"true"` to enable AES-256-GCM encryption of file data, or `"false"` (or leave unset) to disable it.

**Why does it exist?**
Encryption adds complexity to development and testing. This kill switch lets you run the application without encryption for local development, while production uses full encryption.

**Values:**
```
ENCRYPTION_ENABLED="false"   # Local development (no encryption)
ENCRYPTION_ENABLED="true"    # Production (full encryption)
```

**What happens if it is missing:**
Encryption is disabled (treated as `"false"`). This is the safe default for development.

---

### CRON_SECRET

**What is it?**
A secret bearer token that protects the cron job endpoint (`/api/cron/due-reminders`) from unauthorized access.

**Why is it needed?**
The cron endpoint sends email reminders about upcoming due dates. Without authentication, anyone who knows the URL could trigger mass emails. This secret ensures only the Vercel scheduler (which knows the secret) can call the endpoint.

**How it works:**
The cron endpoint checks for the `Authorization: Bearer <CRON_SECRET>` HTTP header. If the header does not match, it returns a 401 Unauthorized error.

**How to generate it:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example value:**
```
CRON_SECRET="a3f8d2e1c4b7a0f3d6e9c2b5a8f1d4e7c0b3a6f9d2e5c8b1a4f7d0e3c6b9a2"
```

**Local development note:**
In development mode (`NODE_ENV=development`), the cron endpoint skips authentication entirely. You only need this in production.

**What happens if it is missing:**
In development: no effect. In production: the cron endpoint is unprotected, allowing anyone to trigger reminder emails.

---

### PYTHON_API_URL

**What is it?**
The base URL of the Python translation backend service. This service handles dynamic translation of user-entered data (risk names, control descriptions, etc.) into Arabic and Latvian.

**Why is it needed?**
The GRC application supports three languages. Static UI text (buttons, labels) is handled by the built-in i18n system. But user-entered content (like "Risk: Unauthorized access to customer data") needs to be translated by an AI service. The Python backend handles those translations.

**Example values:**
```
# Local Python service (if running locally):
PYTHON_API_URL="http://localhost:8000"

# Production:
PYTHON_API_URL="https://your-python-service.example.com"
```

**What happens if it is missing:**
Dynamic translation stops working. The application still runs, but user-entered text will only appear in the language it was originally entered. No crashes — the translation feature gracefully degrades.

---

### PYTHON_API_SECRET

**What is it?**
An authentication token sent with every request to the Python translation API. Prevents unauthorized access to the translation service.

**How to generate it:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**What happens if it is missing:**
Requests to the Python API will fail with a 401 Unauthorized error. Dynamic translations will not work.

---

### EMAIL_HOST

**What is it?**
The hostname of the SMTP (Simple Mail Transfer Protocol) server used to send emails.

**Why is it needed?**
The application sends email notifications for:
- Due date reminders (upcoming evidence deadlines, CAPA due dates, policy review dates)
- Account creation notifications
- Password reset links

**Common values:**
```
# Gmail SMTP:
EMAIL_HOST="smtp.gmail.com"

# Outlook/Office 365:
EMAIL_HOST="smtp.office365.com"

# SendGrid:
EMAIL_HOST="smtp.sendgrid.net"

# Custom SMTP server:
EMAIL_HOST="mail.yourcompany.com"
```

**What happens if it is missing:**
Email notifications are not sent. The application does not crash — it logs an error and continues running. Users simply do not receive email reminders.

---

### EMAIL_PORT

**What is it?**
The port number on the SMTP server to connect to.

**Common values:**
```
EMAIL_PORT="587"   # TLS/STARTTLS (recommended — most secure and firewall-friendly)
EMAIL_PORT="465"   # SSL
EMAIL_PORT="25"    # Unencrypted (do not use in production)
```

**Recommendation:** Use port `587` with STARTTLS unless your mail provider specifically requires a different port.

---

### EMAIL_USER

**What is it?**
The username (usually an email address) used to authenticate with the SMTP server.

**Example values:**
```
EMAIL_USER="notifications@yourcompany.com"
EMAIL_USER="your.email@gmail.com"
```

**Note for Gmail users:** You cannot use your regular Gmail password. You must create an **App Password** in your Google account settings (requires 2-factor authentication enabled). Go to `myaccount.google.com` → Security → 2-Step Verification → App passwords.

---

### EMAIL_PASS

**What is it?**
The password used to authenticate with the SMTP server. For Gmail, this is the App Password, not your regular account password.

**What happens if EMAIL_HOST, EMAIL_PORT, EMAIL_USER, or EMAIL_PASS are missing:**
The nodemailer email client cannot connect to the SMTP server. Email notifications fail silently (logged as errors, but no crash).

---

### GOOGLE_CLIENT_ID

**What is it?**
The OAuth 2.0 Client ID for Google Sign-In. This identifies your application to Google when a user clicks "Sign in with Google".

**Why is it needed?**
Users can log in to the GRC application using their existing Google accounts instead of (or in addition to) username/password login.

**How to obtain it:**

1. Go to `https://console.cloud.google.com`
2. Create a new project (or select an existing one).
3. Navigate to **"APIs & Services"** → **"Credentials"**.
4. Click **"Create Credentials"** → **"OAuth 2.0 Client IDs"**.
5. Application type: **"Web application"**.
6. Add authorized redirect URIs:
   - For local dev: `http://localhost:3000/api/auth/callback/google`
   - For production: `https://grc-app-ba-testing.vercel.app/api/auth/callback/google`
7. Click **Create**. You will see the Client ID and Client Secret.

**Example value:**
```
GOOGLE_CLIENT_ID="123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com"
```

**What happens if it is missing:**
The "Sign in with Google" button on the login page either does not appear or throws an error when clicked. Username/password login still works.

---

### GOOGLE_CLIENT_SECRET

**What is it?**
The secret key that proves your application is the legitimate owner of the Google OAuth Client ID.

**How to obtain it:**
Obtained at the same time as the Client ID (see above). Keep it secret — anyone with the Client ID and Client Secret can impersonate your application.

**Example value:**
```
GOOGLE_CLIENT_SECRET="GOCSPX-abcdefghijklmnopqrstuvwxyz12345"
```

---

### AZURE_AD_CLIENT_ID

**What is it?**
The Application (Client) ID from Microsoft Azure Active Directory (now called Microsoft Entra ID). Enables "Sign in with Microsoft" for users with Microsoft 365 or Azure AD accounts.

**How to obtain it:**

1. Go to `https://portal.azure.com`
2. Navigate to **"Azure Active Directory"** → **"App registrations"**.
3. Click **"New registration"**.
4. Name: "GRC Application" (or any name you choose).
5. Supported account types: select based on your organization's needs.
6. Redirect URI: `https://grc-app-ba-testing.vercel.app/api/auth/callback/azure-ad` (and `http://localhost:3000/api/auth/callback/azure-ad` for local dev).
7. Click **Register**.
8. The **Application (client) ID** is displayed on the Overview page — copy it.

**Example value:**
```
AZURE_AD_CLIENT_ID="12345678-1234-1234-1234-123456789012"
```

---

### AZURE_AD_CLIENT_SECRET

**What is it?**
The client secret that authenticates your application with Azure AD.

**How to obtain it:**

1. In your Azure app registration, navigate to **"Certificates & secrets"**.
2. Click **"New client secret"**.
3. Add a description and expiry period.
4. Click **Add**.
5. **Copy the Value immediately** — Azure only shows it once. If you miss it, you must create a new secret.

**Example value:**
```
AZURE_AD_CLIENT_SECRET="abc~defghijklmnopqrstuvwxyz1234567890AB"
```

---

### AZURE_AD_TENANT_ID

**What is it?**
The Directory (Tenant) ID of your Azure Active Directory tenant. This identifies which organization's Azure AD to use for authentication.

**How to obtain it:**
1. In the Azure portal, go to **"Azure Active Directory"**.
2. The Tenant ID is displayed on the **Overview** page.

**Special value for multi-tenant apps:**
If you want to allow users from ANY Microsoft organization to sign in (not just your own), set:
```
AZURE_AD_TENANT_ID="common"
```

**Example value:**
```
AZURE_AD_TENANT_ID="87654321-4321-4321-4321-210987654321"
```

**What happens if AZURE_AD_* variables are missing:**
Microsoft SSO login is unavailable. Username/password and Google login still work.

---

## 5. Setting Variables in the Vercel Dashboard

For production deployments, environment variables are configured in the Vercel dashboard — they are never stored in files that get committed to Git.

**Step-by-step:**

1. Go to `https://vercel.com` and log in.
2. Click on your project (**grc-app-ba-testing**).
3. Click the **Settings** tab (at the top of the project page).
4. In the left sidebar, click **Environment Variables**.
5. For each variable:
   a. Type the variable name in the **Key** field (e.g., `DATABASE_URL`).
   b. Paste the value in the **Value** field.
   c. Select which environments it applies to:
      - **Production** — used when deploying the main branch
      - **Preview** — used for pull request preview deployments
      - **Development** — used when running `vercel dev` locally
   d. Click **Save**.
6. After adding all variables, trigger a new deployment (push a commit or use **Redeploy** in the Vercel dashboard) for the changes to take effect.

**Tip:** You can also use the Vercel CLI:
```bash
vercel env add DATABASE_URL production
# Vercel will prompt you to paste the value
```

---

## 6. Security Best Practices

### Never Commit Secrets

Add these patterns to your `.gitignore` (they should already be there):
```
.env
.env.local
.env.*.local
```

Run `git status` before every commit and verify that no `.env` files appear in the list of changed files.

### Use Different Secrets for Each Environment

| Environment | Secret Strategy |
|-------------|----------------|
| Local dev | Short, memorable values are OK — data is not sensitive |
| Staging/Preview | Randomly generated, different from production |
| Production | Randomly generated, never shared, stored in Vercel only |

### Rotate Secrets Periodically

- `NEXTAUTH_SECRET`: Rotate every 90 days. Rotation logs out all active sessions.
- `FIELD_ENCRYPTION_KEY`: Run `npm run encrypt:rotate-key` — do NOT just change the env var without migrating the encrypted data first.
- OAuth secrets: Rotate if you suspect they have been compromised.

### Never Log Secrets

The application uses a `safeLog` utility that automatically redacts sensitive values from logs. Do not use `console.log` directly with environment variable values. Use `safeLog` from `src/lib/safe-log.ts` instead.

---

## 7. Minimal .env.local for Local Development

For basic local development (login + database, no email/OAuth/translation), this is the minimum configuration:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="local-development-secret-change-this-for-production"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_ENABLED="false"
```

These four variables are all you need to run the application locally and log in with `superadmin` / `1`. All other features (email, SSO, translation) will degrade gracefully if their variables are absent.

---

## 8. Quick Reference Table

| Variable | Required? | Local Default | Generated? |
|----------|-----------|--------------|-----------|
| `DATABASE_URL` | Yes | `file:./dev.db` | No |
| `NEXTAUTH_SECRET` | Yes | Any 32+ char string | Yes (use crypto) |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` | No |
| `FIELD_ENCRYPTION_KEY` | Only if ENCRYPTION_ENABLED=true | — | Yes (use crypto) |
| `ENCRYPTION_ENABLED` | No | `false` | No |
| `CRON_SECRET` | No (dev) | — | Yes (use crypto) |
| `PYTHON_API_URL` | No | — | No |
| `PYTHON_API_SECRET` | No | — | Yes (use crypto) |
| `EMAIL_HOST` | No | — | No (SMTP provider) |
| `EMAIL_PORT` | No | — | No |
| `EMAIL_USER` | No | — | No |
| `EMAIL_PASS` | No | — | No (SMTP or App Password) |
| `GOOGLE_CLIENT_ID` | No | — | No (Google Console) |
| `GOOGLE_CLIENT_SECRET` | No | — | No (Google Console) |
| `AZURE_AD_CLIENT_ID` | No | — | No (Azure Portal) |
| `AZURE_AD_CLIENT_SECRET` | No | — | No (Azure Portal) |
| `AZURE_AD_TENANT_ID` | No | — | No (Azure Portal) |

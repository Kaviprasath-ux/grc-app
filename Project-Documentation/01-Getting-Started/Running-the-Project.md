# Running the Project

## Overview

This guide explains how to start and use the GRC application during development. It covers development mode vs. production mode, what the terminal output means, how to navigate the application, and how to run tests.

**Prerequisites:** Complete the **Local Setup** guide before reading this. Your `.env.local` file must exist, the database must be seeded, and `npm install` must have been run.

---

## 1. Development Mode vs. Production Mode

The application can run in two fundamentally different modes:

### Development Mode

Started with `npm run dev`.

**Characteristics:**
- **Hot reload:** When you save a file, the browser automatically refreshes to show your changes within 1–3 seconds. You do not need to manually restart the server.
- **Detailed error messages:** When something breaks, you see a full stack trace in the browser and terminal with exact file names and line numbers.
- **Slower initial startup:** The first page load may take a few seconds while Turbopack compiles the code.
- **Source maps:** Browser developer tools show your original TypeScript source code, not the compiled JavaScript.
- **Not optimized:** The code is not minified or bundled for performance. File sizes are larger.

**Use development mode when:** You are actively writing code, debugging, or exploring the application.

### Production Mode

Built with `npm run build`, then started with `npm run start`.

**Characteristics:**
- **No hot reload:** Changes require stopping the server, rebuilding, and restarting.
- **Fast:** Code is minified, bundled, and optimized. Pages load much faster than in development.
- **Minimal error messages:** Errors show generic messages rather than stack traces (to avoid leaking code details).
- **Static analysis:** TypeScript type errors and missing imports that are sometimes tolerated in development will fail the build in production mode.

**Use production mode when:** You are testing final performance, simulating the production environment, or preparing to deploy.

**For day-to-day development, always use `npm run dev`.**

---

## 2. Starting the Development Server

### Step 1 — Open a Terminal in the Project Folder

Open VS Code and use the built-in terminal (press **Ctrl + `** on Windows/Linux or **Control + `** on Mac). Alternatively, open a standalone terminal and navigate to the project folder.

Confirm you are in the right place:
```bash
# Windows PowerShell:
dir package.json

# macOS/Linux:
ls package.json
```
You should see `package.json` listed.

### Step 2 — Run the Dev Command

```bash
npm run dev
```

### Step 3 — Read the Terminal Output

Here is what the output means:

```
> grc-app@0.1.0 dev
> next dev --turbopack
```
This first line shows that npm ran the `dev` script defined in `package.json`. The actual command is `next dev --turbopack`.

```
   ▲ Next.js 16.1.1 (Turbopack)
```
Confirms the Next.js version and that **Turbopack** is enabled (the fast bundler — more on this below).

```
   - Local:        http://localhost:3000
   - Network:      http://192.168.1.45:3000
   - Environments: .env.local
```
- **Local:** The URL to open on your computer.
- **Network:** The URL other devices on your local network can use to access the app (useful for testing on a phone).
- **Environments:** Confirms that `.env.local` was found and loaded.

```
 ✓ Starting...
 ✓ Ready in 2.3s
```
The `✓ Ready in 2.3s` line means the server started successfully. The app is now accessible.

```
 ○ Compiling /login ...
 ✓ Compiled /login in 1.2s (342 modules)
```
When you open a page in the browser, Next.js compiles that page on demand (lazy compilation). You will see these lines each time you navigate to a page that has not been visited yet in the current session.

### What to Do If the Dev Server Doesn't Start

See the **Common Startup Errors** section at the end of this document.

---

## 3. What is Turbopack?

Turbopack is a new JavaScript/TypeScript bundler built in Rust. It is the replacement for Webpack, the bundler that Next.js used previously.

**Why does it matter?**
- Turbopack compiles code significantly faster than Webpack — often 5–10x faster for large projects.
- Hot reload (the code update cycle when you save a file) is faster.
- Startup time is faster.

**For developers:** Turbopack is enabled automatically when you run `npm run dev` in this project (the `--turbopack` flag in the script). You do not need to configure anything. Just know that when you see `(Turbopack)` in the output, it is working correctly.

**Known limitation:** Turbopack is still maturing. Very occasionally, a specific edge case may behave differently from Webpack. If you encounter a strange error that does not make logical sense, try temporarily running without Turbopack:
```bash
npx next dev
```
(This uses Webpack.) If the error disappears, it is a Turbopack edge case — check the Next.js GitHub issues.

---

## 4. Accessing the Application

Open your browser and navigate to:
```
http://localhost:3000
```

### What "localhost" Means

`localhost` is a special hostname that always refers to your own computer. Port `3000` is the network port the development server listens on. Together, `localhost:3000` means "connect to port 3000 on this machine".

This address is only accessible on your computer. Other people on the internet cannot visit it (unless you use a tunneling tool like `ngrok`).

---

## 5. Logging In for the First Time

You will be redirected to `http://localhost:3000/login`.

**Default credentials (created by the seed script):**
- Username: `superadmin`
- Password: `1`

Type these in the login form and click **Sign In**.

### The Superadmin Role

The `superadmin` account is a system-level administrator. In the GRC application's multi-tenant architecture:

- **Superadmin** manages the entire system — creates customer accounts, manages users, configures system-wide settings.
- **Customer accounts** are individual organizations using the GRC application. Each customer has their own data, users, and roles.

As `superadmin`, you can create customer accounts through the admin panel and then set up GRC data (risks, controls, audits) within those accounts.

---

## 6. Navigating the Application

### The Sidebar

The left sidebar is the main navigation. It is organized by module:

**System Administration (visible to superadmin only):**
- Customer Accounts — manage organizations
- System Users — manage system-level users

**GRC Modules (visible within a customer account context):**

| Module | What It Does |
|--------|-------------|
| **Organization** | Company profile, organizational context, business processes, Business Impact Analysis (BIA) |
| **Compliance** | Compliance frameworks (ISO 27001, SOC 2, etc.), controls, evidence collection, policies, exceptions, KPIs |
| **Risk Management** | Risk register, risk assessment wizard, risk response plans, risk control matrix |
| **Asset Management** | IT asset inventory, classification |
| **Internal Audit** | Audit universe, annual audit plan, fieldwork, findings, CAPA tracking, audit reports |

### Permission-Based Navigation

Navigation items are filtered by the current user's role and permissions. If an item does not appear in the sidebar, the logged-in user does not have permission to view that section. This is by design — different roles see different modules.

For example:
- An **Auditor** sees Internal Audit items but not the Risk Management configuration.
- An **Auditee** sees only items assigned to them.
- A **GRC Administrator** sees everything.

### The Header

The top header bar contains:
- **Breadcrumb / Page title** — shows where you are in the navigation hierarchy
- **Language switcher** — toggle between English (EN), Arabic (AR), and Latvian (LV)
- **Notification bell** — system notifications and due date alerts
- **User avatar / name** — click to access profile settings and sign out

---

## 7. Making Your First Change and Seeing Hot Reload

Hot reload is one of the most valuable features of the development server. Here is how to experience it:

**Step 1:** Open the project in VS Code. In the file tree, navigate to:
```
src/app/(protected)/dashboard/page.tsx
```

**Step 2:** Find a visible heading or text in that file. For example, a line that renders something like:
```tsx
<h1>{t("Dashboard")}</h1>
```

**Step 3:** Change the text temporarily (just for this test):
```tsx
<h1>{t("Dashboard")} — Hello World!</h1>
```

**Step 4:** Save the file with **Ctrl + S** (Windows/Linux) or **Command + S** (Mac).

**Step 5:** Look at your browser. Within 1–3 seconds, the page should automatically update to show the new text, without you pressing F5 or clicking anything.

**Step 6:** Revert your change and save again. The text returns to normal.

This instant feedback loop — edit, save, see the result — is how you develop the application efficiently.

### Note on Server-Side Changes

Hot reload works for most file changes. However, some changes require a full server restart (not just a page refresh):

- Changes to `.env.local` (environment variable changes)
- Changes to `next.config.ts`
- Changes to `prisma/schema.prisma` (also require `npx prisma db push` and `npx prisma generate`)

For these files, stop the server with **Ctrl + C** and restart with `npm run dev`.

---

## 8. Running the Production Build Locally

Before deploying to Vercel, always run the production build locally to catch errors:

```bash
npm run build
```

The build process:
1. Runs `npm run i18n:generate` to regenerate translation files
2. Runs `prisma generate` to ensure the Prisma client is up to date
3. Compiles all TypeScript files and checks for type errors
4. Bundles and optimizes all code

**Sample output:**
```
> next build

   ▲ Next.js 16.1.1

   Creating an optimized production build ...
 ✓ Compiled successfully
 ✓ Linting and checking validity of types
 ✓ Collecting page data
 ✓ Generating static pages (47/47)
 ✓ Collecting build traces
 ✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                   5.23 kB        92.4 kB
├ ○ /login                              12.3 kB         99.5 kB
├ ƒ /dashboard                          3.45 kB        95.7 kB
...

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

If the build fails, you will see a list of TypeScript errors. Fix them all before deploying. The Vercel build uses the same command — if it fails locally, it will fail on Vercel too.

---

## 9. Running E2E Tests with Playwright

The project includes end-to-end (E2E) tests using **Playwright**, a browser automation framework.

### What Are E2E Tests?

End-to-end tests simulate a real user interacting with the application in a browser. They open a real browser (Chrome, Firefox, etc.), navigate to pages, fill in forms, click buttons, and verify the results. This tests the entire application stack together, from the UI down to the database.

### Running All Tests

Make sure the development server is running in a separate terminal, then run:

```bash
npm run test:e2e
```

Playwright will:
1. Open test browsers in headless mode (no visible window — runs in the background)
2. Navigate through all the test scenarios
3. Print a summary of passed and failed tests

### Running Tests with a Visual Interface

```bash
npm run test:e2e:ui
```

This opens the Playwright UI — a desktop application showing all your tests, the browser preview, and test results. You can select individual tests to run and watch them execute in real time. Very useful for debugging failing tests.

### Debugging a Failing Test

```bash
npm run test:e2e:debug
```

This runs tests in debug mode, which pauses execution at breakpoints so you can inspect the browser state step by step.

### Generating New Tests

```bash
npm run test:e2e:codegen
```

This opens a browser where you can interact with the application normally, and Playwright records your actions as test code. Very useful for quickly creating new tests without writing them from scratch.

### Test Files Location

E2E tests are stored in the `tests/` folder at the project root. Each file tests a specific module or feature. For example:
```
tests/
  auth.spec.ts       — Login and authentication tests
  compliance.spec.ts — Compliance module tests
  risk.spec.ts       — Risk management tests
```

---

## 10. Useful Development Commands

| Command | What It Does |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (type-checks everything) |
| `npm run lint` | Run ESLint to check for code issues |
| `npx prisma studio` | Open Prisma Studio GUI (browse/edit database) |
| `npx prisma db push` | Apply schema changes to the database |
| `npx prisma generate` | Regenerate Prisma client after schema changes |
| `npm run db:seed` | Seed database with initial data |
| `npm run i18n:generate` | Regenerate translation JSON files |

### Prisma Studio

Prisma Studio is a web-based database GUI that lets you browse and edit database records without writing SQL. To open it:

```bash
npx prisma studio
```

This opens `http://localhost:5555` in your browser. You can:
- Browse all tables (User, Risk, Control, AuditFinding, etc.)
- Filter and sort records
- Edit field values directly
- Add and delete records

Very useful for inspecting what the seed script created or debugging database-related issues.

---

## 11. Common Startup Errors and Fixes

### Error: "EADDRINUSE: address already in use :::3000"

**What it means:** Port 3000 is already occupied by another process.

**How to find and kill the process:**

Windows PowerShell:
```powershell
# Find what is using port 3000
netstat -ano | findstr :3000
# Look for the PID (last number) in the output, then:
taskkill /PID <PID-NUMBER> /F
```

macOS/Linux:
```bash
# Find the process
lsof -i :3000
# Kill it (replace PID with the number from the output):
kill -9 <PID>
```

**Or change the port:**
```bash
npm run dev -- --port 3001
```
Then access the app at `http://localhost:3001`.

---

### Error: "Module not found: Can't resolve '@/components/...'"

**What it means:** TypeScript path aliases are not resolving correctly.

**Fix:** Make sure `tsconfig.json` has the paths configuration:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

If this is already correct, try deleting the `.next/` folder and restarting:
```bash
# Windows:
Remove-Item -Recurse -Force .next

# macOS/Linux:
rm -rf .next

npm run dev
```

---

### Error: "PrismaClientInitializationError: Can't reach database server"

**What it means:** Prisma cannot connect to the database. The `DATABASE_URL` is wrong or the database file doesn't exist.

**Fix for SQLite:**
1. Check that `.env.local` contains `DATABASE_URL="file:./dev.db"`
2. Run `npx prisma db push` to create the database file

**Fix for PostgreSQL:**
1. Verify the connection string in `.env.local` is correct
2. Check that the PostgreSQL server is running

---

### Error: "Error: NEXTAUTH_SECRET is not defined"

**What it means:** The `NEXTAUTH_SECRET` environment variable is missing from `.env.local`.

**Fix:** Open `.env.local` and add:
```
NEXTAUTH_SECRET="any-random-string-at-least-32-characters-long"
```
Restart the dev server.

---

### Error: Pages load but show "Internal Server Error"

**What it means:** A server-side error occurred. The browser shows a generic error page.

**How to debug:** Look at the terminal where `npm run dev` is running. The actual error message (with stack trace) appears there. Read the error, identify the file and line number, and investigate.

---

### The Browser Shows an Infinite Loading Spinner

**Possible causes and fixes:**
1. The dev server crashed — check the terminal for error messages and restart with `npm run dev`.
2. A JavaScript error in a component is preventing React from rendering — open browser DevTools (F12), go to the Console tab, and look for red error messages.
3. An API call is hanging — open DevTools, go to the Network tab, and look for requests that are pending (spinning) for more than 30 seconds.

---

## 12. Stopping the Development Server

Press **Ctrl + C** in the terminal where `npm run dev` is running. You will see:
```
^C
```

The server stops immediately. The database file (`prisma/dev.db`) is preserved — you do not lose any data.

---

## 13. Summary: Daily Development Workflow

Here is the typical workflow for daily development:

```bash
# 1. Pull the latest changes before starting
git fetch origin
git pull

# 2. If new packages were added (package.json changed):
npm install

# 3. If the schema changed (prisma/schema.prisma changed):
npx prisma db push
npx prisma generate

# 4. Start the dev server
npm run dev

# 5. Open http://localhost:3000 and work

# 6. Before committing, check for lint errors:
npm run lint

# 7. Before deploying, run the production build:
npm run build
```

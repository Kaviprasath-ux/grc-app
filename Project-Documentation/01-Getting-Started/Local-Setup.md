# Local Setup Guide

## Overview

This guide walks you through downloading the GRC application code onto your computer and getting it running locally. "Locally" means the application runs on your own machine — not on the internet, not on a server — just on your computer, accessible at `http://localhost:3000`.

**Prerequisites:** You must complete the **Software Installation** guide first. Confirm that Node.js, npm, and Git are all installed before continuing.

**Estimated time:** 20–40 minutes.

---

## 1. Understanding Git and Cloning

### What is a Repository?

A **repository** (often shortened to "repo") is a folder that contains all of the project's files AND a complete history of every change ever made to those files. Think of it like a folder with a built-in time machine — you can see exactly who changed what, when, and why.

The GRC application's repository is hosted on **GitHub** (a website that stores Git repositories in the cloud). Your goal is to download a copy of that repository onto your local machine. This process is called **cloning**.

### What Does "Cloning" Mean?

When you clone a repository, Git:

1. Downloads every file in the project (all the source code, configuration files, database schema, etc.)
2. Downloads the complete history of every commit (saved change) ever made
3. Creates a local copy that is linked to the original repository, so you can later push your changes back up or pull down new changes from others

Cloning is different from simply downloading a ZIP file. A cloned repository maintains a live connection to the remote server, enabling collaboration.

---

## 2. Cloning the Repository

### Step 1 — Choose Where to Store the Project

Decide on a folder on your computer where you want to store the project. Recommendations:

- **Windows:** `C:\Projects\` or `D:\GRC\`
- **macOS:** `~/Projects/` or `~/Developer/`
- **Linux:** `~/projects/`

Avoid paths with spaces (e.g., `C:\My Documents\My Projects\`) because some command-line tools have trouble with spaces in paths.

### Step 2 — Open a Terminal in That Location

**Windows:**
1. Open File Explorer and navigate to the folder where you want to store the project (e.g., `C:\Projects\`). Create the folder if it does not exist.
2. Right-click inside the folder (not on a file).
3. Select **"Open in Terminal"** (Windows 11) or **"Git Bash Here"** (if you installed Git for Windows).

**macOS:**
1. Open Terminal (press Command + Space, type "Terminal", press Enter).
2. Navigate to your chosen folder:
   ```bash
   cd ~/Projects
   # If the folder does not exist, create it first:
   mkdir -p ~/Projects
   cd ~/Projects
   ```

**Linux:**
1. Open a terminal.
2. Navigate to your chosen folder:
   ```bash
   mkdir -p ~/projects
   cd ~/projects
   ```

### Step 3 — Clone the Repository

Run this command (replace the URL with the actual repository URL provided by your team lead):

```bash
git clone https://github.com/YOUR-ORG/grc-app.git
```

You will see output similar to this:
```
Cloning into 'grc-app'...
remote: Enumerating objects: 4521, done.
remote: Counting objects: 100% (4521/4521), done.
remote: Compressing objects: 100% (2103/2103), done.
Receiving objects: 100% (4521/4521), 18.34 MiB | 2.10 MiB/s, done.
Resolving deltas: 100% (2891/2891), done.
```

This may take 1–3 minutes depending on your internet speed.

### Step 4 — Enter the Project Folder

```bash
cd grc-app
```

You are now inside the project folder. Confirm you are in the right place:

```bash
# On Windows (PowerShell):
dir

# On macOS/Linux:
ls
```

You should see folders and files like `src/`, `prisma/`, `package.json`, `next.config.ts`, etc.

---

## 3. Opening the Project in VS Code

Open the entire project folder in VS Code:

```bash
code .
```

The `.` means "the current folder". VS Code will open with the project's file tree visible in the left panel.

If VS Code prompts **"Do you trust the authors of the files in this folder?"**, click **"Yes, I trust the authors"**.

---

## 4. Understanding package.json

Before installing dependencies, it helps to understand what you are installing.

Open the file `package.json` in VS Code. This file is the project's manifest — it lists:

- **`name`**: The project name (`grc-app`)
- **`scripts`**: Commands you can run with `npm run` (like `npm run dev`)
- **`dependencies`**: Libraries the application needs to run in production (Next.js, React, Prisma, etc.)
- **`devDependencies`**: Libraries only needed during development (TypeScript, ESLint, Playwright testing, etc.)

There are over 50 packages listed. When you run `npm install`, npm reads this file and downloads all of them.

---

## 5. Installing Dependencies (npm install)

### What is npm install?

**npm** stands for "Node Package Manager". It manages third-party libraries (called **packages** or **dependencies**) that the project needs.

When you cloned the repository, you got the source code — but not the dependencies. The dependencies are listed in `package.json` but the actual library files are NOT stored in the repository (they are listed in `.gitignore` and excluded from commits). This is by design — the `node_modules` folder can be hundreds of megabytes, and everyone can regenerate it themselves from `package.json`.

`npm install` reads `package.json` and `package-lock.json`, downloads every dependency from the npm registry (https://registry.npmjs.org), and puts them all in a `node_modules/` folder.

### Running npm install

In your terminal, inside the `grc-app` folder, run:

```bash
npm install
```

You will see output like this:
```
added 1247 packages, and audited 1248 packages in 45s

173 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

This process typically takes 1–5 minutes. Do not close the terminal while it is running.

After it finishes, a `node_modules/` folder will appear in your project. It will contain hundreds of sub-folders — one for each dependency. You should never manually edit anything inside `node_modules/`.

### What is package-lock.json?

The `package-lock.json` file records the exact version of every package that was installed. This ensures that everyone on the team — and the production server — installs the exact same versions of every dependency, preventing "it works on my machine" problems. Never delete or manually edit `package-lock.json`.

---

## 6. Setting Up the Database for Local Development

### SQLite vs. PostgreSQL

The application supports two database engines:

| Engine | Use Case | Notes |
|--------|----------|-------|
| **SQLite** | Local development | A single file, no server needed, easy to set up |
| **PostgreSQL** | Production (Neon cloud) | Full-featured, scalable, requires a server |

For local development, we use **SQLite**. It stores the entire database in a single file (`prisma/dev.db`). This means you do not need to install a database server, create user accounts, or configure ports. It just works.

### What is Prisma?

**Prisma** is the application's ORM (Object-Relational Mapper). It is a toolkit that:

1. Defines the database structure in a human-readable schema file (`prisma/schema.prisma`)
2. Generates TypeScript code that lets the application query the database in a type-safe way
3. Manages database migrations (changes to the structure over time)
4. Provides **Prisma Studio**, a web-based GUI to browse and edit database records

### Step 1 — Create the .env.local File

Before pushing the schema, you need to tell Prisma which database to connect to. Create a `.env.local` file in the root of the project.

In your terminal:

```bash
# On Windows (PowerShell):
New-Item -ItemType File .env.local

# On macOS/Linux:
touch .env.local
```

Then open `.env.local` in VS Code and add the following content:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_SECRET="your-development-secret-at-least-32-chars-long"
NEXTAUTH_URL="http://localhost:3000"

# Encryption (optional for local dev, set to false to disable)
ENCRYPTION_ENABLED="false"
```

**Important notes about this file:**
- The `DATABASE_URL="file:./dev.db"` tells Prisma to use a SQLite file named `dev.db` in the `prisma/` folder.
- `NEXTAUTH_SECRET` can be any random string for local development — see the Environment Variables guide for how to generate a proper one.
- `ENCRYPTION_ENABLED="false"` disables file encryption locally so you do not need the encryption key for basic development.

Save the file. See the **Environment Variables** guide for a detailed explanation of every variable.

### Step 2 — Push the Schema to Create the Database

Prisma needs to create the actual database tables. Run:

```bash
npx prisma db push
```

**What does this command do?**

It reads `prisma/schema.prisma` (which describes all the database tables and their columns) and creates those tables in the SQLite database file. If the database file does not exist, it creates it automatically.

You will see output like:
```
Environment variables loaded from .env.local
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./dev.db"

Your database is now in sync with your Prisma schema. Done in 1.24s

Running generate... (Use --skip-generate to skip the generators)
...
Generated Prisma Client (v5.x.x) to ./node_modules/.prisma/client in 312ms
```

A file `prisma/dev.db` now exists on your computer. This is your local database.

### Step 3 — Generate Prisma Client (if needed)

The `db push` command usually generates the Prisma Client automatically. If it does not, or if you ever modify the schema later, run:

```bash
npx prisma generate
```

This generates TypeScript type definitions from the schema, giving you autocomplete and type-checking when writing database queries.

---

## 7. Seeding the Database

### What is Database Seeding?

"Seeding" means populating the database with initial data so the application has something to show when you first open it. Without seeding, the database is empty — no users, no organizations, no compliance frameworks — and you would not be able to log in.

The seed script (`prisma/seed.ts`) creates:

- **A superadmin user** (username: `superadmin`, password: `1`) — the initial admin account
- **Sample customer accounts** — example organizations to explore
- **Compliance frameworks** — sample ISO 27001, SOC 2, and other framework data
- **Risk categories and controls** — pre-populated reference data
- **User roles and permissions** — the RBAC configuration

### Running the Seed Script

```bash
npm run db:seed
```

You will see output like:
```
Seeding database...
Creating superadmin...
Creating sample customer accounts...
Creating compliance frameworks...
Creating risk categories...
Seeding complete!
```

If the command fails with a database error, make sure you ran `npx prisma db push` first (the tables must exist before data can be inserted into them).

### What is npm run db:seed-bts?

There is a second seed command:

```bash
npm run db:seed-bts
```

This runs an additional seed script (`prisma/seed-bts.ts`) that creates more specific sample data for demonstration purposes — additional users, realistic risk entries, evidence files, and audit data. Run this after `db:seed` if you want a fully populated demonstration environment.

---

## 8. Generating Translation Files

The application supports three languages (English, Arabic, Latvian). Before running the app for the first time, you need to generate the translation files:

```bash
npm run i18n:generate
```

This script reads a translation spreadsheet and generates JSON locale files in the `locales/` folder. The build process runs this automatically, but running it manually now ensures the files exist for development.

You will see output like:
```
Reading translations from scripts/translations.xlsx...
Generated: locales/en/common.json
Generated: locales/ar/common.json
Generated: locales/lv/common.json
Done.
```

---

## 9. Running the Application for the First Time

Now everything is ready. Start the development server:

```bash
npm run dev
```

You will see output like this in your terminal:
```
> grc-app@0.1.0 dev
> next dev --turbopack

   ▲ Next.js 16.1.1 (Turbopack)
   - Local:        http://localhost:3000
   - Network:      http://192.168.x.x:3000
   - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 2.3s
```

The key line is `✓ Ready in 2.3s` — this means the development server is running successfully.

**Do not close this terminal window.** The server runs as long as this terminal is open. If you close it, the application stops.

---

## 10. Exploring the Application for the First Time

Open your web browser and go to: `http://localhost:3000`

### The Login Page

You will be redirected to the login page at `http://localhost:3000/login`.

Log in with the default superadmin credentials:
- **Username:** `superadmin`
- **Password:** `1`

Click the **Sign In** button.

### The Dashboard

After logging in, you will see the main dashboard. Here is what you are looking at:

**Left sidebar:** The navigation menu. It lists all the modules:
- **Organization** — Company profile, processes, Business Impact Analysis
- **Compliance** — Frameworks, controls, evidence, policies
- **Risk Management** — Risk register, assessments, risk matrix
- **Asset Management** — IT asset inventory
- **Internal Audit** — Audit planning, fieldwork, findings, reports

The sidebar items you can see depend on your role. As superadmin, you can see everything.

**Top header:** Shows the current user (superadmin), language switcher (English/Arabic/Latvian), and notification bell.

**Main content area:** The dashboard overview — summary cards showing counts of risks, compliance items, open findings, etc. Some cards may show zeroes if the database was just seeded with minimal data.

### Navigating to Customer Accounts

As a superadmin, your primary view is the **system administration** view. To see the full GRC application:

1. Look for a **"Customer Accounts"** or **"Organizations"** link in the sidebar.
2. Select one of the sample customer accounts created by the seed script.
3. Now the sidebar updates to show the full GRC module navigation for that customer.

---

## 11. Common Local Setup Errors

### Error: "Cannot find module '@prisma/client'"

**Cause:** The Prisma client was not generated.

**Fix:**
```bash
npx prisma generate
```

---

### Error: "The table 'main.User' does not exist"

**Cause:** `prisma db push` was not run, so the database tables do not exist.

**Fix:**
```bash
npx prisma db push
```

---

### Error: "Environment variable not found: DATABASE_URL"

**Cause:** The `.env.local` file does not exist or is in the wrong location.

**Fix:** Make sure `.env.local` is in the ROOT of the project folder (same level as `package.json`), not inside `src/` or `prisma/`.

---

### Error: "ENOENT: no such file or directory, open 'locales/en/common.json'"

**Cause:** The i18n translation files have not been generated.

**Fix:**
```bash
npm run i18n:generate
```

---

### Error: "Port 3000 is already in use"

**Cause:** Another application is using port 3000 (possibly another instance of the dev server).

**Fix:** Either stop the other application, or start the GRC app on a different port:
```bash
npm run dev -- --port 3001
```
Then access the app at `http://localhost:3001`.

---

### Error: "npm error: missing script: dev"

**Cause:** You are not in the project root folder.

**Fix:** Make sure you are inside the `grc-app` folder:
```bash
cd grc-app
npm run dev
```

---

## 12. Complete Setup Checklist

- [ ] Repository cloned with `git clone`
- [ ] Dependencies installed with `npm install` (node_modules folder exists)
- [ ] `.env.local` file created with `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- [ ] Database schema created with `npx prisma db push`
- [ ] Prisma client generated (happens automatically during `db push`)
- [ ] Database seeded with `npm run db:seed`
- [ ] Translation files generated with `npm run i18n:generate`
- [ ] Dev server started with `npm run dev`
- [ ] App accessible at `http://localhost:3000`
- [ ] Successfully logged in with `superadmin` / `1`

---

## 13. Next Steps

Now that your local environment is running:

1. Read the **Environment Variables** guide to understand every configuration option and how to set up optional features (email, OAuth, encryption).
2. Read the **Running the Project** guide for tips on development workflow, hot reload, and running tests.
3. Browse the `src/` folder in VS Code to explore the codebase. Start with `src/app/(protected)/` to see the page structure.

# Technology Stack — testgrc 2025

> **Audience:** Developers, DevOps engineers, technical leads. This document explains every technology used in the project — what it is, why it was chosen, what alternatives exist, and where it is used.
>
> **Reading time:** ~45 minutes for a full read. Bookmark sections relevant to your work.

---

## How to Read This Document

Each technology section follows this structure:
1. **What is it?** — Explained from scratch, assuming no prior knowledge
2. **Why was it chosen?** — The reasoning behind the decision
3. **Alternatives considered** — What else could have been used
4. **How it's used in this project** — Specific usage patterns
5. **Where in the codebase** — Exact file paths and configuration locations

---

## 1. Next.js 16 (App Router)

### What Is It?

**Next.js** is a framework for building web applications using React. A **framework** is a set of pre-made tools and conventions that handle common problems, so developers can focus on building features rather than infrastructure.

Without Next.js, building a production-ready React application requires manually configuring:
- A bundler (tool that combines hundreds of JavaScript files into a few optimized files)
- A router (code that maps URLs to pages)
- Server-side rendering (generating HTML on the server for faster initial loads)
- API routes (server-side endpoints)
- Image optimization
- TypeScript compilation

Next.js does all of this automatically with sensible defaults.

The **App Router** is Next.js's file-system-based routing system introduced in version 13. The folder structure under `src/app/` directly defines the URL structure of the application.

**Version:** 16.1.1 (as of project start)

### Why Was It Chosen?

1. **Full-stack in one framework** — Next.js handles both the frontend (React pages) and backend (API routes) in a single project. No separate Express.js server needed.

2. **Server Components** — Next.js 16 introduces React Server Components (RSC). These render on the server and send plain HTML to the browser — no JavaScript download required for the initial render. This is dramatically faster for content-heavy pages like lists and dashboards.

3. **Automatic code splitting** — Each page only loads the JavaScript it needs. Users visiting the Dashboard do not download the Audit module's code.

4. **Built-in optimizations** — Image optimization, font optimization, and prefetching come built-in with zero configuration.

5. **Vercel deployment** — Vercel (the deployment platform) is built by the same company that makes Next.js. Deploying a Next.js application to Vercel is a single command.

6. **Industry adoption** — Next.js is one of the most widely used React frameworks. Finding developers who know it is straightforward.

### Alternatives Considered

| Alternative            | Reason Not Chosen                                                          |
|------------------------|----------------------------------------------------------------------------|
| Create React App       | Client-side only (no server rendering); abandoned by maintainers           |
| Remix                  | Newer, smaller community; different mental model for data loading          |
| Vite + React           | No server rendering; requires separate backend (Express/Node)              |
| SvelteKit              | Different component syntax (Svelte, not React); smaller talent pool        |
| Angular                | Steeper learning curve; heavier; less flexible                            |

### How It's Used in This Project

**File-system routing:**
```
src/app/
├── (protected)/              ← Route group (applies MainLayout to all children)
│   ├── layout.tsx            ← Shared layout (sidebar + header)
│   ├── dashboard/page.tsx    ← Maps to URL: /dashboard
│   ├── compliance/
│   │   ├── page.tsx          ← Maps to URL: /compliance
│   │   └── controls/
│   │       ├── page.tsx      ← Maps to URL: /compliance/controls
│   │       └── [id]/
│   │           └── page.tsx  ← Maps to URL: /compliance/controls/123
│   └── ...
├── api/                      ← API routes (server-side)
│   ├── risks/route.ts        ← Maps to URL: /api/risks
│   └── risks/[id]/route.ts   ← Maps to URL: /api/risks/123
└── login/page.tsx            ← Public (no auth required)
```

**Server vs Client components:**
```typescript
// Server Component (default) — runs on server, no "use client" directive
// src/app/(protected)/risks/page.tsx
export default async function RisksPage() {
  const risks = await prisma.risk.findMany(); // Direct DB access!
  return <RiskList risks={risks} />;
}

// Client Component — runs in browser, marked with "use client"
// src/components/risks/RiskForm.tsx
"use client";
export default function RiskForm() {
  const [name, setName] = useState(""); // useState only works in Client Components
  // ...
}
```

**API route example:**
```typescript
// src/app/api/risks/route.ts
export const GET = withAuth(handler, { resource: 'risk', action: 'view' });
```

### Configuration Files

- `next.config.ts` — Next.js configuration (image domains, environment variables, headers)
- `tsconfig.json` — TypeScript configuration (Next.js reads this)
- `.env.local` — Local environment variables (never committed to Git)

---

## 2. TypeScript

### What Is It?

**TypeScript** is a superset of JavaScript. **"Superset"** means it includes everything JavaScript has, plus additional features — most importantly, **static type checking**.

In regular JavaScript, you can write:
```javascript
function add(a, b) {
  return a + b;
}
add("hello", 42); // No error at write time — crashes at runtime!
```

In TypeScript:
```typescript
function add(a: number, b: number): number {
  return a + b;
}
add("hello", 42); // TypeScript ERROR immediately — "string is not assignable to number"
```

TypeScript catches entire categories of bugs before the code even runs.

A **type** is a description of what kind of data a variable holds:
- `string` — text like "hello"
- `number` — numeric values like 42 or 3.14
- `boolean` — true or false
- `string[]` — an array of strings
- `{ id: string; name: string }` — an object with specific fields
- Custom types like `Risk`, `User`, `AuditFinding` (defined throughout the codebase)

### Why Was It Chosen?

1. **Catch bugs at compile time** — Type errors are found when writing code, not when users encounter them.

2. **Autocomplete and IntelliSense** — When you type `risk.`, the editor shows every available field on the Risk object. No need to remember or look up field names.

3. **Safer refactoring** — When you rename a field in the database schema, TypeScript shows every place in the code that needs updating.

4. **Self-documenting code** — Function signatures tell you exactly what inputs are required and what is returned.

5. **Industry standard** — Modern professional TypeScript/JavaScript codebases almost universally use TypeScript.

### How It's Used in This Project

TypeScript is used for every `.ts` and `.tsx` file in the project (all source files). Key patterns:

```typescript
// Defining a type for a Risk record
interface Risk {
  id: string;
  name: string;
  description: string | null; // Can be null (optional)
  likelihood: number;
  impact: number;
  riskScore: number;
  customerAccountId: string;
  createdAt: Date;
}

// Prisma generates types automatically from the schema
// These are available as: import { Risk } from '@prisma/client'

// API route context type (Next.js 16 pattern)
interface RouteContext {
  params: Promise<{ id: string }>; // Must be awaited in Next.js 16
}
```

### Where in the Codebase

- `tsconfig.json` — TypeScript compiler configuration
- `src/types/` — Shared type definitions
- Every `.ts` / `.tsx` file uses TypeScript

---

## 3. React and React Hooks

### What Is React?

**React** is a JavaScript library for building user interfaces. It was created by Facebook (Meta) in 2013 and is currently the most widely used frontend library in the world.

The core concept in React is the **component** — a reusable piece of user interface. A component is a JavaScript function that returns HTML-like code (called **JSX**).

```tsx
// A simple React component
function WelcomeMessage({ userName }: { userName: string }) {
  return (
    <div className="welcome">
      <h1>Hello, {userName}!</h1>
      <p>Welcome to the GRC platform.</p>
    </div>
  );
}
```

Components can be nested inside each other, creating a tree of components that forms the complete UI.

### What Are React Hooks?

**Hooks** are functions that let you use React features in function components. The most important ones:

**`useState`** — Stores state (data that can change) in a component:
```typescript
const [isOpen, setIsOpen] = useState(false); // Start closed
// When user clicks: setIsOpen(true) → component re-renders with isOpen=true
```

**`useEffect`** — Runs side effects (like fetching data) when the component renders:
```typescript
useEffect(() => {
  fetch('/api/risks').then(res => res.json()).then(setRisks);
}, []); // Empty array = run once when component first appears
```

**`useCallback`** — Creates a function that doesn't get recreated on every render (performance optimization)

**`useMemo`** — Computes a value that doesn't get recalculated unnecessarily

### Custom Hooks in This Project

The application defines many custom hooks for reusable logic:
- `usePermissions(resource)` — Returns `{ canView, canCreate, canEdit, canDelete }`
- `useHasRole(role)` — Returns true if current user has that role
- `useTranslatedData(data, options)` — Returns data with applied translations
- `useLanguage()` — Returns current language and the `t()` function

### Where in the Codebase

- `src/hooks/` — All custom hooks
- `src/components/` — All React components
- React is implicit in every `.tsx` file

---

## 4. Tailwind CSS

### What Is It?

**Tailwind CSS** is a CSS framework that uses **utility classes** — small, single-purpose CSS classes that you compose directly in HTML/JSX.

Traditional CSS: you write a class name in your HTML, then define that class in a CSS file:
```html
<!-- HTML -->
<button class="primary-button">Save</button>
```
```css
/* CSS file */
.primary-button {
  background-color: blue;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
}
```

Tailwind CSS: you apply utility classes directly:
```html
<button class="bg-blue-500 text-white px-4 py-2 rounded">Save</button>
```

Each class does one thing: `bg-blue-500` sets a specific blue background, `text-white` makes text white, `px-4` adds horizontal padding, `py-2` adds vertical padding, `rounded` makes corners rounded.

### Why Was It Chosen?

1. **No naming problem** — You never have to invent class names like `.user-profile-card-header-title` again.

2. **No CSS file sprawl** — Styles live next to the HTML that uses them. No hunting across files.

3. **Consistent design tokens** — `blue-500`, `rounded`, `py-4` are defined values from a design system. All components use the same palette.

4. **RTL support** — Tailwind includes `ltr:` and `rtl:` variants for easy right-to-left layout support (needed for Arabic).

5. **Tree shaking** — Tailwind scans the codebase and includes only the CSS classes actually used. Production CSS bundle is tiny.

### Key Tailwind Patterns in This Project

```tsx
// Standard card layout
<div className="rounded-lg border bg-card p-6 shadow-sm">

// RTL-aware directional spacing
<div className="ltr:ml-4 rtl:mr-4">  // left margin in LTR, right margin in RTL

// Responsive layout
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  // 1 column on mobile, 2 on tablet, 3 on desktop

// Dark mode
<div className="bg-white dark:bg-gray-900">
```

### Configuration

- `tailwind.config.ts` — Tailwind configuration (custom colors, fonts, plugins)
- `postcss.config.mjs` — PostCSS (tool that processes CSS for Tailwind)
- `src/app/globals.css` — Global CSS variables (shadcn/ui color tokens)

---

## 5. shadcn/ui (Radix UI Components)

### What Is It?

**shadcn/ui** is a collection of pre-built UI components. Unlike traditional component libraries (which you install as a dependency), shadcn/ui copies the component source code directly into your project. You own the code and can modify it freely.

Under the hood, shadcn/ui uses **Radix UI** — a library of unstyled, accessible UI primitives. **"Primitives"** means fundamental building blocks: Dialog, Dropdown, Tooltip, Select, Tabs, etc. Radix handles the complex accessibility and keyboard behavior; shadcn/ui adds the visual styling (using Tailwind CSS).

**"Accessible"** means the components follow WAI-ARIA guidelines — screen readers, keyboard navigation, and focus management work correctly out of the box.

### Why Was It Chosen?

1. **Accessibility included** — Radix UI components follow accessibility standards that would take weeks to implement correctly from scratch.

2. **Full control** — Since the code lives in your project, you can customize every pixel. No fighting against a library's opinions.

3. **Consistent design system** — All components share the same design tokens (colors, spacing, border-radius) via CSS custom properties.

4. **Active community** — Large ecosystem, frequent updates, extensive documentation.

### Components Used in This Project

Located in `src/components/ui/`:

| Component    | Used For                                              |
|--------------|-------------------------------------------------------|
| Button       | All interactive buttons                               |
| Dialog       | Modal popups (create/edit forms, confirmations)       |
| Table        | All data tables (risks, controls, assets, etc.)       |
| Form         | Form wrapper with react-hook-form integration         |
| Input        | Text input fields                                     |
| Select       | Dropdown selects                                      |
| Badge        | Status indicators (Active, Closed, High, Low)         |
| Card         | Content containers                                    |
| Tabs         | Multi-tab interfaces                                  |
| Sheet        | Side-panel drawers                                    |
| Toast        | Temporary notification messages                       |
| Tooltip      | Hover explanations                                    |
| Command      | Searchable command/item picker                        |
| Calendar     | Date picker                                           |
| Popover      | Floating content containers                           |

### Configuration

- `components.json` — shadcn/ui configuration (style, base color, TypeScript settings)
- `src/components/ui/` — All component source files (copied from shadcn/ui, customizable)

---

## 6. NextAuth v5

### What Is It?

**NextAuth** (now officially called **Auth.js**) is an authentication library for Next.js applications. **Authentication** is the process of verifying identity — confirming that a user is who they say they are.

NextAuth handles:
- Login (credential verification, session creation)
- Session management (keeping users logged in between page loads)
- Logout (invalidating sessions)
- JWT (JSON Web Token) generation and validation
- OAuth providers (Google, GitHub, etc. — not used in this project but available)
- Database sessions vs. JWT sessions

**Version:** 5 (beta, also called Auth.js v5). Version 5 is a major rewrite supporting Next.js App Router.

### Why Was It Chosen?

1. **Native Next.js integration** — Designed specifically for Next.js; works seamlessly with App Router.

2. **JWT sessions** — Stateless sessions that do not require a sessions database table. The JWT token contains all needed user information and is cryptographically signed.

3. **Credential provider** — Supports username/password authentication without requiring OAuth setup.

4. **Session callback** — Allows customizing what data is included in the session (we add `role`, `customerAccountId`, `permissions`).

5. **Active development** — One of the most popular authentication libraries in the Next.js ecosystem.

### How It's Used in This Project

NextAuth is configured in `src/lib/auth.ts`:

```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        // 1. Find user in database
        const user = await prisma.user.findUnique({
          where: { username: credentials.username }
        });
        // 2. Verify password hash
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        // 3. Return user (NextAuth creates JWT from this)
        return { id: user.id, role: user.role, customerAccountId: user.customerAccountId };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // Add custom fields to JWT when first creating it
        token.role = user.role;
        token.customerAccountId = user.customerAccountId;
        token.permissions = getPermissionsForRole(user.role);
      }
      return token;
    },
    session({ session, token }) {
      // Make JWT data available in session object
      session.user.role = token.role;
      session.user.customerAccountId = token.customerAccountId;
      session.user.permissions = token.permissions;
      return session;
    }
  }
});
```

### Where in the Codebase

- `src/lib/auth.ts` — NextAuth configuration
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth API route handler
- `src/lib/api-auth.ts` — Custom `withAuth` wrapper that uses NextAuth's `auth()` function
- `src/app/login/page.tsx` — Login page (calls NextAuth `signIn`)

---

## 7. Prisma ORM

### What Is It?

**Prisma** is an **ORM (Object-Relational Mapper)** for Node.js and TypeScript. An ORM is a library that provides an abstraction over the database — instead of writing raw SQL queries, you use a type-safe JavaScript API.

**Why databases need an abstraction:**
- SQL syntax is verbose and error-prone
- SQL is database-specific (PostgreSQL syntax differs from MySQL)
- SQL does not know about JavaScript types
- SQL injection is a critical security risk when building queries from user input

Prisma solves all of these:
- Clean, readable API: `prisma.risk.findMany({ where: { ownerId: userId } })`
- Works with multiple databases (SQLite, PostgreSQL, MySQL, MongoDB)
- Fully typed — TypeScript knows exactly what fields each model has
- Parameterized queries — eliminates SQL injection by default

### The Prisma Schema

The **schema** (`prisma/schema.prisma`) defines every database table, its columns, and their types. Prisma reads this file to:
1. Generate TypeScript types for every model
2. Create and apply database migrations
3. Provide IDE autocomplete for database queries

```prisma
// Example from prisma/schema.prisma
model Risk {
  id                String   @id @default(cuid())
  customerAccountId String
  name              String
  description       String?
  likelihood        Int
  impact            Int
  riskScore         Float
  ownerId           String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id])
  owner             User            @relation(fields: [ownerId], references: [id])
}
```

### The Prisma Client Extension (Encryption)

This project adds a **Prisma client extension** in `src/lib/prisma.ts` that automatically encrypts and decrypts the `fileData` field when reading from or writing to the database. This is transparent to all application code.

### Why Was Prisma Chosen?

1. **Type safety** — Generated TypeScript types match the database schema exactly. Changes to the schema immediately update the types.

2. **Migration system** — `prisma migrate dev` tracks schema changes and creates migration scripts that can be applied to production safely.

3. **Prisma Studio** — A built-in GUI for browsing and editing database data during development.

4. **Multi-database support** — The same schema works with SQLite (development) and PostgreSQL (production).

5. **Rich query API** — Filtering, sorting, pagination, transactions, and nested writes are all supported with a clean API.

### Where in the Codebase

- `prisma/schema.prisma` — Database schema definition
- `prisma/seed.ts` — Seed script (populates database with initial data)
- `src/lib/prisma.ts` — Singleton Prisma client (with encryption extension)
- `src/lib/encrypted-fields.ts` — Registry of which fields are encrypted

---

## 8. PostgreSQL and SQLite

### What Is a Database?

A **database** is an organized collection of data that is stored persistently (it survives server restarts) and can be queried efficiently. This application uses a **relational database** — data is organized into tables (like spreadsheets) with rows and columns, and tables can reference each other.

### PostgreSQL

**PostgreSQL** (often called "Postgres") is a powerful, open-source relational database. It has been in development since 1986 and is widely considered the most capable open-source relational database.

Key PostgreSQL features used in this project:
- **ACID transactions** — Operations are Atomic, Consistent, Isolated, and Durable (data integrity)
- **Full-text search** — Searching within text content
- **JSON support** — Storing and querying JSON data natively
- **UUID support** — Generating unique IDs
- **Row-level security** (available but not currently used — multi-tenancy is handled at application level)

**Used in:** Production environment (Neon PostgreSQL cloud service)

### SQLite

**SQLite** is a lightweight, file-based database. Unlike PostgreSQL, which requires a database server, SQLite stores the entire database in a single file on disk.

SQLite is used for local development because:
- No installation or server setup required
- Single file — easy to delete and recreate
- Fast for development workloads
- Prisma supports it with the same API

**Used in:** Local development environment

### Why Two Different Databases?

The tradeoffs:

| Aspect               | SQLite (Dev)                      | PostgreSQL (Production)             |
|----------------------|-----------------------------------|-------------------------------------|
| Setup complexity     | Zero — just a file                | Requires server or cloud service    |
| Concurrent writes    | Limited (single writer at a time) | Excellent (many concurrent writers) |
| Performance at scale | Limited to one machine            | Scales horizontally                 |
| Features             | Basic                             | Advanced (full-text, JSONB, etc.)   |
| Cost (for dev)       | Free                              | N/A (would need server)             |
| Portability          | Single file, easy to copy         | Requires pg_dump/restore            |

---

## 9. Neon (Serverless PostgreSQL)

### What Is It?

**Neon** is a cloud service that provides serverless PostgreSQL. **"Serverless"** means:
- You do not manage any servers or infrastructure
- The database **scales to zero** when not in use (no compute charges when idle)
- It **scales up instantly** when traffic arrives
- Backups, updates, and maintenance are handled by Neon

### Why Was Neon Chosen?

1. **Cost efficiency** — Neon's free tier provides 0.5GB storage and compute-on-demand. For a BA testing environment, this is sufficient and costs nothing.

2. **PostgreSQL compatibility** — It is standard PostgreSQL. Prisma works with it unchanged.

3. **Vercel integration** — Neon has a first-class Vercel integration; connecting them takes one click.

4. **Branching** — Neon supports database branching (like Git branches but for databases). This is useful for testing migrations on a copy of production data.

5. **Connection pooling** — Neon handles connection pooling, which is important for serverless environments (Vercel functions spin up and down frequently).

### Connection String

```
DATABASE_URL="postgresql://neondb_owner:...@ep-small-sea-....neon.tech/neondb?sslmode=require"
```

This is stored as a Vercel environment variable, never in the codebase.

---

## 10. Vercel

### What Is It?

**Vercel** is a cloud platform for hosting web applications. It was built by the creators of Next.js and is optimized for Next.js deployments.

When you push code to Git, Vercel:
1. Detects the push automatically (via webhook)
2. Runs `npm run build` to create a production build
3. Deploys the built application to a global CDN (Content Delivery Network)
4. Issues a unique URL for the deployment
5. Promotes to the production URL if the branch is the main branch

**CDN** means Content Delivery Network — a network of servers around the world. When a user in Germany accesses the application, they connect to a server in Germany (or nearby), not to a server in the US. This reduces latency.

### Key Vercel Features Used

**Serverless Functions** — Each Next.js API route (`/api/*`) runs as a serverless function. Vercel spins up a container for each request and tears it down after. You do not pay for idle time.

**Edge Network** — The application is deployed to 100+ global locations automatically.

**Automatic HTTPS** — TLS certificates are issued and renewed automatically. All traffic is encrypted in transit.

**Cron Jobs** — Vercel Cron allows scheduling HTTP requests to your API routes on a schedule. Used for the 7 scheduled tasks.

**Environment Variables** — Secrets (database password, API keys) are stored securely in Vercel's environment variable system and injected at runtime.

### Vercel Configuration

`vercel.json` in the project root defines cron jobs:

```json
{
  "crons": [
    {
      "path": "/api/cron/due-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

The schedule `"0 8 * * *"` is a **cron expression** meaning "at 8:00 AM every day."

---

## 11. Nodemailer

### What Is It?

**Nodemailer** is a Node.js library for sending emails. It supports multiple transport methods but is most commonly used with SMTP (Simple Mail Transfer Protocol).

**SMTP** is the standard protocol for sending email. When this application sends an email, it connects to an SMTP server, authenticates, and delivers the message. The SMTP server handles routing the email to the recipient.

### How It's Used in This Project

The application has 65+ distinct email templates. Each template is an HTML file with template variables. When an event occurs (a new audit finding is created, a CAPA is due tomorrow), the system:

1. Selects the appropriate template
2. Fills in the dynamic variables (recipient name, item name, due date, etc.)
3. Calls Nodemailer to send the email via SMTP

```typescript
// Example email send
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  }
});

await transporter.sendMail({
  from: '"testgrc 2025" <noreply@testgrc.com>',
  to: recipient.email,
  subject: `Audit Finding: ${finding.title}`,
  html: renderTemplate('audit-finding-created', { finding, recipient })
});
```

### Email Categories

| Category                  | Templates |
|---------------------------|-----------|
| Authentication            | Password reset, new user welcome, email verification |
| Compliance                | Evidence due, evidence expired, control review due |
| Risk                      | Risk assigned, risk review due, risk treatment update |
| Internal Audit            | Finding created, finding responded to, CAPA due, audit report issued |
| TPRM                      | Vendor assessment requested, vendor questionnaire due, contract renewal |
| System                    | Account setup, notification digest, system alerts |

---

## 12. React Hook Form and Zod

### What Is React Hook Form?

**React Hook Form** is a library for managing form state in React. Forms are complex:
- Each field has a current value
- Fields can have validation rules
- The form has a submission state
- Error messages need to display next to the relevant field
- Submitting should be prevented while invalid

React Hook Form handles all of this with minimal code and excellent performance (it avoids unnecessary re-renders).

### What Is Zod?

**Zod** is a schema validation library. A **schema** defines what valid data looks like:

```typescript
import { z } from 'zod';

const RiskFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  likelihood: z.number().min(1).max(5),
  impact: z.number().min(1).max(5),
  category: z.enum(['strategic', 'operational', 'financial', 'compliance'])
});

// TypeScript type is automatically inferred from the schema
type RiskFormValues = z.infer<typeof RiskFormSchema>;
```

When the form is submitted, Zod validates the data against the schema. If any field fails validation, the form displays the error message without submitting.

### How They Work Together

React Hook Form integrates with Zod via the `zodResolver`:

```typescript
const form = useForm<RiskFormValues>({
  resolver: zodResolver(RiskFormSchema),
  defaultValues: {
    name: "",
    likelihood: 3,
    impact: 3,
  }
});
```

This pattern is used in **every form** in the application:
- Risk creation/editing forms
- Compliance control forms
- Audit finding forms
- User management forms
- Vendor assessment forms

### Where in the Codebase

Form components: `src/components/` (each module's `*Form.tsx` files)
Zod schemas are typically defined at the top of the form file or in a separate `schemas.ts` file.

---

## 13. Playwright (E2E Testing)

### What Is E2E Testing?

**End-to-End (E2E) testing** means testing the application the same way a real user would — by controlling a real browser. Unlike unit tests (which test individual functions in isolation), E2E tests:
- Open a browser
- Navigate to pages
- Click buttons
- Fill in forms
- Assert that the result is what was expected

E2E tests catch bugs that unit tests cannot — such as a correct backend that returns the right data, but a broken frontend that displays it incorrectly.

### What Is Playwright?

**Playwright** is a browser automation library by Microsoft. It can control Chromium (Chrome/Edge), Firefox, and WebKit (Safari) programmatically.

### How It's Used in This Project

```typescript
// Example E2E test
import { test, expect } from '@playwright/test';

test('should create a new risk', async ({ page }) => {
  // Log in
  await page.goto('/login');
  await page.fill('[name="username"]', 'superadmin');
  await page.fill('[name="password"]', '1');
  await page.click('button[type="submit"]');

  // Navigate to risk module
  await page.goto('/risks');
  await page.click('text=Add New Risk');

  // Fill in the form
  await page.fill('[name="name"]', 'Test Risk');
  await page.selectOption('[name="category"]', 'operational');
  await page.click('text=Save');

  // Assert the risk appears in the list
  await expect(page.locator('text=Test Risk')).toBeVisible();
});
```

### Configuration

- `playwright.config.ts` — Playwright configuration (browsers, base URL, timeouts)
- `e2e/` — All E2E test files

---

## 14. AES-256-GCM Encryption

### What Is Encryption?

**Encryption** is the process of transforming readable data (called **plaintext**) into an unreadable scrambled form (called **ciphertext**) using a mathematical algorithm and a key. Only someone with the key can reverse the process (called **decryption**) to recover the original data.

**Analogy:** Imagine a padlock and key. You put a document in a lockbox and close the padlock. Anyone can see the lockbox, but only someone with the right key can open it and read the document.

### What Is AES?

**AES (Advanced Encryption Standard)** is the most widely used symmetric encryption algorithm. "Symmetric" means the same key is used for both encryption and decryption. It was standardized by the US National Institute of Standards and Technology (NIST) in 2001.

**256-bit** refers to the key size. A 256-bit key has 2^256 possible values — a number so large that even all the computers on Earth could not try all possibilities before the heat death of the universe.

### What Is GCM Mode?

**GCM (Galois/Counter Mode)** is a mode of operation for AES. Beyond encryption, GCM provides **authenticated encryption** — it generates an authentication tag that proves the ciphertext was not modified since it was encrypted. If anyone tampers with the ciphertext, decryption fails.

This prevents a class of attack where an attacker cannot read your data but can alter it.

### Implementation in This Project

The encryption is implemented as a Prisma middleware in `src/lib/prisma.ts`:

```typescript
// Conceptual overview (simplified)
const prismaWithEncryption = basePrisma.$extends({
  query: {
    // Before any write operation
    $allOperations: async ({ args, query }) => {
      // Encrypt fileData fields before writing
      encryptSensitiveFields(args.data);
      const result = await query(args);
      // Decrypt fileData fields after reading
      decryptSensitiveFields(result);
      return result;
    }
  }
});
```

The encryption key is stored in the `FIELD_ENCRYPTION_KEY` environment variable — never in the database or codebase.

---

## 15. Python AI Backend (Translation)

### What Is It?

A separate Python web service that accepts text and returns translations. The Python backend:
1. Receives translation requests from the Next.js application
2. Calls a GPT language model API (OpenAI-compatible)
3. Returns the translated text

### Why a Separate Python Service?

Python was chosen for the AI integration because:
1. The Python ecosystem for AI/ML is the most mature (OpenAI, LangChain, etc.)
2. Separating concerns — the translation service can be scaled, updated, and deployed independently of the main application
3. Python's async libraries (FastAPI/aiohttp) handle concurrent translation requests efficiently

### How It's Used in This Project

When a record is created or edited, the Next.js API route calls the Python backend:

```typescript
// src/lib/translation-service.ts
export async function translateRecord(
  customerAccountId: string,
  modelName: string,
  recordId: string,
  fields: Record<string, string>
) {
  const response = await fetch(`${process.env.PYTHON_API_URL}/translate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PYTHON_API_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ modelName, recordId, fields, sourceLocale: 'auto' })
  });
  // ... handle response
}
```

The Python API uses auto-detection to determine the source language. A user could enter a risk name in Arabic, and the system would translate it to English and Latvian automatically.

### Security

The Python API is protected with a shared secret (`PYTHON_API_SECRET`). Requests without this secret are rejected. This prevents unauthorized parties from calling the translation API.

---

## 16. Excel / Translation Source

### What Is It?

The static UI translations (button labels, menu items, etc.) are maintained in an Excel spreadsheet format before being imported into the application's translation system.

### Why Excel?

Non-technical team members (translators, business analysts) are comfortable with Excel. Maintaining translations in a spreadsheet allows:
- Non-developers to add or update translations without touching code
- Easy diff-checking between versions
- Sharing with external translation agencies

### The Translation Pipeline

```
Excel spreadsheet (source phrases + Arabic + Latvian translations)
    ↓
scripts/init-translations.ts (imports and registers translations)
    ↓
locales/ directory (JSON files per language)
    ↓
LanguageContext (provides t() function to components)
    ↓
Components (call t("phrase") to get translated text)
```

### Files

- `scripts/init-translations.ts` — Single source of truth for all static translations
- `locales/en.json` — English translations (keys = English phrases)
- `locales/ar.json` — Arabic translations
- `locales/lv.json` — Latvian translations
- `src/contexts/LanguageContext.tsx` — React context that provides `t()` function

---

## Technology Stack Summary Table

| Technology             | Category       | Version    | Purpose                                    |
|------------------------|----------------|------------|--------------------------------------------|
| Next.js                | Framework      | 16.1.1     | Full-stack web framework                   |
| TypeScript             | Language       | 5+         | Type-safe JavaScript                       |
| React                  | UI Library     | 19         | Component-based UI                         |
| Tailwind CSS           | CSS Framework  | 3.4        | Utility-first styling                      |
| shadcn/ui              | Component Lib  | Latest     | Accessible UI components                   |
| NextAuth v5            | Auth           | 5.x        | Authentication and session management      |
| Prisma ORM             | Database ORM   | 6+         | Type-safe database access                  |
| PostgreSQL             | Database       | 15+        | Production database (via Neon)             |
| SQLite                 | Database       | 3+         | Development database                       |
| Neon                   | Cloud DB       | Latest     | Serverless PostgreSQL hosting              |
| Vercel                 | Hosting        | Latest     | Application deployment platform            |
| Nodemailer             | Email          | 6+         | Email sending library                      |
| React Hook Form        | Forms          | 7+         | Form state management                      |
| Zod                    | Validation     | 3+         | Schema validation                          |
| Playwright             | Testing        | 1.4+       | End-to-end browser testing                 |
| AES-256-GCM            | Encryption     | N/A        | Field-level database encryption            |
| Python (FastAPI)       | AI Service     | 3.11+      | AI translation backend                     |
| bcrypt                 | Security       | Latest     | Password hashing                           |
| React Hook Form + Zod  | Forms          | Latest     | Form validation                            |

---

*Related documents: `00-Project-Overview/Architecture-Overview.md` for how these technologies work together, `07-Authentication/Encryption.md` for encryption implementation details.*

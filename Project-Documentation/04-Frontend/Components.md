# Components

## Table of Contents
1. [What Are React Components?](#what-are-react-components)
2. [Component Types in This Project](#component-types)
3. [UI Components (shadcn/ui)](#ui-components)
4. [Layout Components](#layout-components)
5. [Shared Components](#shared-components)
6. [Feature Components](#feature-components)
7. [shadcn/ui Explained](#shadcnui-explained)
8. [How to Use PermissionGate](#how-to-use-permissiongate)
9. [How to Create a New Component](#how-to-create-a-new-component)
10. [Props and TypeScript Interfaces](#props-and-typescript-interfaces)
11. [The "use client" Decision](#the-use-client-decision)
12. [Component Composition Patterns](#component-composition-patterns)

---

## What Are React Components?

A React **component** is a self-contained, reusable piece of user interface. The LEGO analogy is the clearest way to understand components:

- **A single LEGO brick** = a primitive UI component (Button, Input, Badge)
- **A small assembly** = a composite component built from primitives (SearchBar = Input + Button)
- **A large model** = a page-level component built from many assemblies (RiskRegisterPage)

Each component:
1. **Accepts props** — inputs passed to it by its parent, like arguments to a function
2. **Maintains state** — local data that can change (only in Client Components)
3. **Returns JSX** — a description of what should be rendered on screen

Components can be used multiple times in different places with different props, just like the same LEGO brick appears in many different models.

```tsx
// A simple Button component
function Button({ label, onClick, variant = "primary" }) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// Used in three different places with different props
<Button label="Save" onClick={handleSave} variant="primary" />
<Button label="Cancel" onClick={handleCancel} variant="secondary" />
<Button label="Delete" onClick={handleDelete} variant="destructive" />
```

---

## Component Types

The GRC application organises components into four categories based on their scope and purpose:

| Category | Location | Purpose |
|----------|----------|---------|
| **UI Components** | `src/components/ui/` | Primitive building blocks (button, input, dialog) |
| **Layout Components** | `src/components/layout/` | Application shell (sidebar, header, main layout) |
| **Shared Components** | `src/components/shared/` | Cross-module composite components (page header, stats card) |
| **Feature Components** | Within feature folders | Page-specific components for one module |

---

## UI Components

The `src/components/ui/` directory contains 37 primitive components, all from the **shadcn/ui** library (described in detail in the next section). These are the atoms that everything else is built from.

### Complete Component Inventory

| Component File | What It Renders | Common Usage |
|----------------|-----------------|--------------|
| `accordion.tsx` | Collapsible content panels with a trigger and animated expand/collapse | FAQ sections, settings panels |
| `alert-dialog.tsx` | A modal dialog requiring explicit user confirmation (OK/Cancel) | Destructive action confirmations like "Delete Risk?" |
| `alert.tsx` | An inline message box for informational, warning, or error notices | Form validation notices, informational banners |
| `avatar.tsx` | A circular image or fallback initials for a user | User profile pictures in header, user lists |
| `badge.tsx` | A small pill-shaped label for status or category | Risk levels (High/Medium/Low), status tags |
| `button.tsx` | A clickable button with variants (primary, outline, destructive, ghost) | All action triggers throughout the app |
| `calendar.tsx` | An interactive date-picker calendar widget | Date selection in forms |
| `card.tsx` | A container with optional header, content, and footer sections | Dashboard stats cards, framework tiles |
| `checkbox.tsx` | A toggleable checkbox input | Multi-select tables, form checkboxes |
| `collapsible.tsx` | A simple show/hide wrapper for content | Sidebar navigation groups |
| `command.tsx` | A searchable command palette / combobox | Advanced search, combobox dropdowns |
| `confirm.tsx` | A global singleton confirmation dialog (triggered programmatically) | Used by the `useConfirm` hook for delete actions |
| `date-picker.tsx` | A composed date picker built on `calendar.tsx` + `popover.tsx` | Due dates, review dates in forms |
| `dialog.tsx` | A modal overlay dialog for creating or editing records | Create/Edit forms throughout the app |
| `dropdown-menu.tsx` | A menu that appears on button click with a list of actions | Row action menus (Edit, Delete, View) in tables |
| `form.tsx` | React Hook Form integration — Field, FormItem, FormLabel, FormMessage | All forms in the application |
| `input.tsx` | A styled text input field | All text inputs in forms |
| `label.tsx` | A form label that associates with an input | Used with `form.tsx` components |
| `multi-select.tsx` | A multi-value select dropdown with checkboxes | Selecting multiple frameworks, departments, tags |
| `pagination.tsx` | Page navigation controls (Previous, 1, 2, 3, Next) | Large data tables |
| `permission-gate.tsx` | Conditionally renders children based on user permission | Hiding Edit/Delete buttons for unauthorised users |
| `popover.tsx` | A floating content panel anchored to a trigger element | Tooltips with rich content, date pickers |
| `progress.tsx` | A horizontal progress bar | Assessment completion percentage |
| `radio-group.tsx` | A group of mutually exclusive radio button options | Single-choice selections in forms |
| `scroll-area.tsx` | A custom-styled scrollable container | Long dropdowns, content panels |
| `select.tsx` | A styled native-like single-value dropdown select | Single-choice dropdowns in forms |
| `separator.tsx` | A horizontal or vertical dividing line | Visual section separators |
| `sheet.tsx` | A panel that slides in from the screen edge | Mobile navigation menu, side panels |
| `slider.tsx` | A draggable range slider | Risk scoring sliders |
| `switch.tsx` | A toggle switch (on/off) | Boolean settings, feature flags |
| `table.tsx` | A set of table primitives (Table, TableHead, TableRow, TableCell) | All data tables |
| `tabs.tsx` | A tabbed content switcher | Profile page tabs, settings tabs |
| `textarea.tsx` | A multi-line text input area | Description fields, notes |
| `toast.tsx` + `toaster.tsx` | Toast notification system | Success/error messages after API calls |
| `tooltip.tsx` | A small hover label for UI elements | Icon button labels |
| `unauthorized.tsx` | A styled "Access Denied" page component | Shown when `canView` is false |

---

## Layout Components

Location: `src/components/layout/`

These five components form the application shell — the persistent UI that surrounds all page content.

### `main-layout.tsx`

The master layout Client Component. Manages:
- Sidebar collapsed/expanded state (persisted to localStorage)
- Mobile menu open/closed state (uses Sheet component)
- Subscription gate — redirects users who try to access modules they are not subscribed to
- RTL/LTR layout direction based on current language

```tsx
<MainLayout>
  {children}  {/* page.tsx content renders here */}
</MainLayout>
```

### `sidebar.tsx`

The left navigation panel. Reads navigation items from `src/lib/navigation.ts` and filters them by the user's permissions and module access. Supports:
- Collapse to icon-only mode
- Mobile Sheet overlay
- Expandable/collapsible group items (Accordion)
- Active link highlighting
- RTL direction (slides to the right for Arabic)

### `header.tsx`

The top bar present on every authenticated page. Contains:
- Mobile menu hamburger button
- Page breadcrumb or title
- Language switcher (EN / AR / LV)
- Dark/light mode toggle
- Notifications bell with unread count badge
- User profile menu (name, role, sign out)
- Help chatbot toggle button

### `subscription-banner.tsx`

An optional banner displayed just below the header. Shows subscription trial expiry warnings or account suspension notices. Hidden when the subscription is active.

### `global-search.tsx`

A search input in the header that searches across multiple record types (risks, controls, policies, etc.) using a command palette interface.

---

## Shared Components

Location: `src/components/shared/`

These components are used across multiple modules and encapsulate common UI patterns.

### `PageHeader`

A consistent page title area with optional breadcrumb, action buttons, and description.

```tsx
<PageHeader
  title={t("Risk Register")}
  description={t("Manage your organisation's risks")}
  actions={
    <PermissionGate resource="risk.register" action="create">
      <Button onClick={() => setCreateOpen(true)}>
        <Plus className="h-4 w-4" />
        {t("Add Risk")}
      </Button>
    </PermissionGate>
  }
/>
```

### `StatsCard`

A metric display card used on dashboard pages.

```tsx
<StatsCard
  title={t("Total Risks")}
  value={42}
  trend={{ value: 5, direction: "up" }}
  icon={AlertTriangle}
/>
```

### `DataGrid` / `DataTable`

A feature-rich table component with sorting, pagination, and row selection.

### `FilterBar`

A search + filter toolbar used above data tables. Provides a search input and dropdown filters for common attributes (status, department, date range).

### `EmptyState`

A centered illustration and message shown when a table or list has no records.

### `LoadingSpinner`

A centered spinner shown while data is being fetched.

---

## Feature Components

Feature components live within specific module page folders rather than a shared location. They are only used by one module.

For example:
```
src/app/(protected)/risks/
  register/
    page.tsx                ← Uses RiskTable, CreateRiskDialog
    _components/
      risk-table.tsx        ← Feature component: only used on Risk Register page
      create-risk-dialog.tsx← Feature component: the "Add Risk" modal form
      risk-row-actions.tsx  ← Feature component: Edit/Delete/View dropdown for a row
```

This co-location pattern keeps module-specific code next to the page that uses it, making it easy to find and modify.

---

## shadcn/ui Explained

**shadcn/ui** is not a traditional component library that you install as a package dependency. Instead, it is a collection of pre-built, accessible, and customisable component implementations that you copy directly into your project.

### How It Works

When you "add a shadcn/ui component," you run a CLI command that copies the component's source code into `src/components/ui/`. The component becomes your own code — you can modify it freely.

```bash
# Example: adding the Dialog component
npx shadcn@latest add dialog
# This creates src/components/ui/dialog.tsx with Radix UI + Tailwind styling
```

### The Technology Stack

shadcn/ui components are built from two layers:

1. **Radix UI** — Unstyled, fully accessible, behaviour-only primitives (handles keyboard navigation, focus management, ARIA attributes, screen reader support)
2. **Tailwind CSS** — Utility classes applied on top for visual styling

This separation means the components work correctly for users with disabilities out of the box, and you control all visual styling through Tailwind.

### CSS Variables and Theming

shadcn/ui uses CSS custom properties (variables) for its colour palette, defined in `src/app/globals.css`. This is what makes the light/dark mode switch work:

```css
/* Light mode */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  /* ... */
}

/* Dark mode */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

Components reference these variables: `bg-background`, `text-foreground`, `bg-primary`. When the ThemeProvider adds the `.dark` class, all colours automatically update.

### Adding New shadcn/ui Components

```bash
# List available components
npx shadcn@latest add --list

# Add a specific component
npx shadcn@latest add [component-name]

# Example: adding a Tooltip
npx shadcn@latest add tooltip
# Creates: src/components/ui/tooltip.tsx
```

After adding, import and use the component:

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon">
        <HelpCircle className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Click to learn more</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## How to Use PermissionGate

The `PermissionGate` component (in `src/components/ui/permission-gate.tsx`) is the standard pattern for conditionally showing UI elements based on the logged-in user's permissions.

### Basic Usage — Hide When No Permission

```tsx
import { PermissionGate } from "@/components/ui/permission-gate";

// The "Add Risk" button is only visible if the user can create risks
<PermissionGate resource="risk.register" action="create">
  <Button onClick={() => setOpen(true)}>Add Risk</Button>
</PermissionGate>
```

If the user does not have `risk.register:create` permission, the button is not rendered at all.

### With Fallback — Show Disabled Version Instead

```tsx
<PermissionGate
  resource="compliance.governance"
  action="delete"
  fallback={
    <Button disabled variant="outline">
      Delete (Insufficient Permission)
    </Button>
  }
>
  <Button variant="destructive" onClick={() => handleDelete(id)}>
    Delete Policy
  </Button>
</PermissionGate>
```

### Multiple Permissions — AND Logic

```tsx
import { MultiPermissionGate } from "@/components/ui/permission-gate";

<MultiPermissionGate
  permissions={[
    { resource: "compliance.governance", action: "edit" },
    { resource: "compliance.governance", action: "approve" },
  ]}
>
  <Button>Edit and Approve</Button>
</MultiPermissionGate>
```

### Multiple Permissions — OR Logic

```tsx
<MultiPermissionGate
  permissions={[
    { resource: "risk.register", action: "create" },
    { resource: "risk.register", action: "edit" },
  ]}
  requireAny  // User needs EITHER create OR edit
>
  <Button>Modify Risk</Button>
</MultiPermissionGate>
```

### Role-Based Rendering (Use Sparingly)

For cases where the entire UI layout differs by role (not just whether a button is shown), use `RoleGate`:

```tsx
import { RoleGate } from "@/components/ui/permission-gate";

<RoleGate roles="CustomerAdministrator">
  <FrameworkCardGrid />  {/* Different UI for CustomerAdmin */}
</RoleGate>

<RoleGate roles={["AuditHead", "Auditor"]}>
  <AuditWorkflowPanel />
</RoleGate>
```

**Prefer `PermissionGate` over `RoleGate` in most cases.** `PermissionGate` is more maintainable because changing a role's permissions automatically updates all gated UI without code changes. Use `RoleGate` only when the UI structure itself is fundamentally different by role.

---

## How to Create a New Component

Follow these conventions for all new components.

### Step 1: Choose the right location

| Location | When to use |
|----------|-------------|
| `src/components/ui/` | Only for new shadcn/ui additions (run `npx shadcn@latest add`) |
| `src/components/layout/` | Shell/navigation components used on every authenticated page |
| `src/components/shared/` | Reused by 2+ different modules |
| `src/app/(protected)/[module]/_components/` | Used by exactly one page or module |

### Step 2: Decide: Server or Client Component?

```
Does the component need any of:
  - useState, useEffect, useCallback, useMemo, useRef?
  - onClick, onChange, or any DOM event handlers?
  - useSession(), useLanguage(), or any Context hook?
  - browser APIs (localStorage, window)?

YES → "use client" directive required
NO  → Leave as Server Component (default, no directive needed)
```

### Step 3: Write the component

```tsx
"use client"; // Only if needed per Step 2

import { useLanguage } from "@/contexts/LanguageContext";

// Define TypeScript interface for props
interface StatusBadgeProps {
  status: "active" | "inactive" | "pending";
  className?: string; // Optional props end with ?
}

// Named export (preferred over default export for shared components)
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useLanguage();

  const variants = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    pending: "bg-yellow-100 text-yellow-800",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${variants[status]} ${className}`}>
      {t(status.charAt(0).toUpperCase() + status.slice(1))}
    </span>
  );
}
```

### Step 4: Export from an index file (for shared components)

If adding to `src/components/shared/`, add the export to the index file:

```ts
// src/components/shared/index.ts
export { StatusBadge } from "./status-badge";
```

---

## Props and TypeScript Interfaces

Every component should define a TypeScript interface for its props. This provides:
- Compile-time type checking (the TypeScript compiler catches incorrect prop types)
- IDE autocompletion when using the component
- Living documentation (you can see what a component expects from its interface)

### Conventions

```tsx
// 1. Name the interface [ComponentName]Props
interface RiskRowActionsProps {
  riskId: string;
  riskName: string;
  onDelete: (id: string) => void; // Function prop
  onEdit: (id: string) => void;
  disabled?: boolean;             // Optional prop: use ?
  variant?: "default" | "compact"; // Union type for fixed string values
}

// 2. Destructure props with the interface type
export function RiskRowActions({
  riskId,
  riskName,
  onDelete,
  onEdit,
  disabled = false,  // Default value for optional prop
  variant = "default",
}: RiskRowActionsProps) {
  // ...
}
```

### Common Prop Patterns

```tsx
// Children — for wrapper/layout components
interface CardProps {
  children: React.ReactNode;  // Any JSX content
  title: string;
}

// Callback functions — for passing handlers down
interface FormProps {
  onSubmit: (data: FormValues) => void;
  onCancel: () => void;
}

// Optional className — for style overriding
interface ButtonProps {
  className?: string;  // Always optional
}

// Record props — for full object data
interface RiskRowProps {
  risk: {
    id: string;
    name: string;
    level: "high" | "medium" | "low";
  };
}
```

---

## The "use client" Decision

The `"use client"` directive is the most consequential architectural decision for any component. Here is the decision flowchart:

```
Does the component use useState?         → use client
Does it use useEffect?                   → use client
Does it respond to clicks or input?      → use client
Does it use useSession()?               → use client
Does it use useLanguage()?              → use client (uses Context)
Does it use usePermissions()?           → use client (uses Context)
Does it use useRouter()?               → use client
Does it use localStorage?              → use client

None of the above apply?               → No directive (Server Component)
```

### Why It Matters

Client Components:
- Increase the JavaScript bundle size sent to the browser
- Run their rendering logic in the browser (CPU cost on the user's device)
- Cannot directly access databases or server-only secrets

Server Components:
- Zero JavaScript in the browser for that component
- Can directly query the database
- Render faster (HTML is generated server-side)

In the GRC application, because pages require sessions, translations (language context), and interactive elements, most page-level components are Client Components. Server Components appear mainly at the route segment level for initial data loading when that data is simple and not dependent on client state.

---

## Component Composition Patterns

The GRC application uses several recurring composition patterns.

### Pattern 1: Page + Dialog

The most common pattern for CRUD pages: the page component manages a list, and clicking a button opens a Dialog for creating or editing.

```tsx
"use client";

export default function RiskRegisterPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);

  return (
    <div>
      <PageHeader
        title="Risk Register"
        actions={
          <PermissionGate resource="risk.register" action="create">
            <Button onClick={() => setCreateOpen(true)}>Add Risk</Button>
          </PermissionGate>
        }
      />

      <RiskTable
        onEdit={(risk) => setEditingRisk(risk)}
      />

      <CreateRiskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {editingRisk && (
        <EditRiskDialog
          risk={editingRisk}
          open={true}
          onClose={() => setEditingRisk(null)}
        />
      )}
    </div>
  );
}
```

### Pattern 2: Form with React Hook Form + Zod

All forms in the application follow the same validation pattern:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// 1. Define the schema (validation rules)
const riskSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  level: z.enum(["high", "medium", "low"]),
});

type RiskFormValues = z.infer<typeof riskSchema>;

export function CreateRiskForm({ onSuccess }: { onSuccess: () => void }) {
  // 2. Initialise the form with the schema and defaults
  const form = useForm<RiskFormValues>({
    resolver: zodResolver(riskSchema),
    defaultValues: { name: "", level: "medium" },
  });

  // 3. Handle submission
  async function onSubmit(data: RiskFormValues) {
    const response = await fetch("/api/risks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (response.ok) onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Fields automatically show validation errors */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Risk Name</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage /> {/* Shows error: "Name must be at least 3 characters" */}
            </FormItem>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
```

### Pattern 3: Data Fetching with useEffect

Pages that load data from an API do so inside `useEffect`:

```tsx
"use client";

export default function RisksPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/risks")
      .then(res => res.json())
      .then(data => {
        setRisks(data.risks);
        setLoading(false);
      });
  }, []); // Empty dependency array = runs once on mount

  if (loading) return <LoadingSpinner />;
  return <RiskTable risks={risks} />;
}
```

### Pattern 4: Permission-Aware Rendering

Buttons and actions are conditionally rendered using `PermissionGate`. The component tree itself decides what each role can see:

```tsx
<TableCell>
  {/* Everyone with view permission sees this */}
  <Link href={`/risks/${risk.id}`}>View</Link>

  {/* Only users with edit permission see this */}
  <PermissionGate resource="risk.register" action="edit">
    <Button onClick={() => onEdit(risk)}>Edit</Button>
  </PermissionGate>

  {/* Only users with delete permission see this */}
  <PermissionGate resource="risk.register" action="delete">
    <Button variant="destructive" onClick={() => onDelete(risk.id)}>Delete</Button>
  </PermissionGate>

  {/* Only reviewers see this */}
  <PermissionGate resource="risk.register" action="approve">
    <Button variant="outline" onClick={() => onApprove(risk.id)}>Approve</Button>
  </PermissionGate>
</TableCell>
```

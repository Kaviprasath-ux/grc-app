# State Management

## Table of Contents
1. [What is State in React?](#what-is-state-in-react)
2. [Why No Redux or Zustand?](#why-no-redux-or-zustand)
3. [Server State vs Client State](#server-state-vs-client-state)
4. [useState — Local Component State](#usestate)
5. [useEffect — Side Effects and Data Fetching](#useeffect)
6. [useMemo — Expensive Computations](#usememo)
7. [React Context API](#react-context-api)
8. [Custom Hooks](#custom-hooks)
9. [When to Use Which Approach](#when-to-use-which-approach)
10. [Data Fetching Patterns](#data-fetching-patterns)

---

## What is State in React?

**State** is data that can change over time and, when it changes, causes the component to re-render with the updated values.

Think of a form. When you start filling it out:
- The name field is empty — that is the initial state.
- You type "Cybersecurity Risk" — the state changes, the input visually updates.
- You select "High" from the risk level dropdown — that field's state changes.
- You click "Save" — a loading state might appear, then a success/error state.

All of those changes are driven by **state**. Without state, the UI would be frozen — a static HTML page that never responds to user input.

React tracks state at the component level. When state changes, React re-renders that component (and its children) to reflect the new values.

---

## Why No Redux or Zustand?

The GRC application deliberately does **not** use a global state management library like **Redux** or **Zustand**. Here is why:

### The Problem Redux Was Designed For

In 2015, large React applications had serious problems sharing data between distant components in the tree. The only way to pass data "up" to a sibling was prop drilling — passing data through every intermediate parent, which became unmaintainable.

Redux solved this by putting all data in one central "store" that any component could read from and write to.

### Why It Is Unnecessary Here

The GRC application handles this situation through two mechanisms that did not exist in 2015:

1. **React Context API** — for truly global state that many components need (session, language, theme)
2. **Local state lifting** — when two sibling components need to share state, their common parent holds the state and passes it down as props

Additionally, most data in this application is **server state** — it lives in the database and is fetched on demand. Libraries like **TanStack Query** (React Query) were specifically designed for server state and eliminate many Redux use cases, though this application uses simple `useEffect` + `fetch` instead.

### The Trade-off

This decision keeps the architecture simple and reduces the codebase's learning curve. A new developer does not need to understand Redux reducers, actions, dispatchers, middleware, or selectors before contributing. The trade-off is that some data refetching could be optimised — if the same API is called from multiple components, React Query would deduplicate those calls. For the current scale of this application, this trade-off is acceptable.

---

## Server State vs Client State

Understanding this distinction is key to understanding how state is managed in this application.

### Server State

Data that **lives in the database** and is fetched over HTTP. Examples:
- The list of risks in the risk register
- A specific policy document
- User profiles and roles

Characteristics:
- Asynchronous (fetching takes time)
- Can be stale (the database might have changed since last fetch)
- Shared across all users
- Must be re-fetched to see updates

In this application, server state is managed with `useEffect` + `useState` — fetch on mount, store in state, re-fetch when needed.

### Client State

Data that **only exists in the browser** and does not need to be stored in the database. Examples:
- Whether a dialog is open or closed
- The current search filter text
- Which table row is selected
- Whether the sidebar is collapsed

Characteristics:
- Synchronous (instantly available)
- Private to the current user session
- Disappears on page reload

In this application, client state is managed with `useState`.

---

## useState

`useState` is React's most fundamental hook. It creates a piece of state in a component and a function to update it.

```tsx
const [value, setValue] = useState(initialValue);
//     ^         ^                  ^
//     current   function to        starting value
//     value     update it
```

When `setValue` is called with a new value, React schedules a re-render of the component and all its children.

### Common Usage Patterns

#### Dialog open/closed state

```tsx
const [createOpen, setCreateOpen] = useState(false);

<Button onClick={() => setCreateOpen(true)}>Add Risk</Button>

<Dialog open={createOpen} onOpenChange={setCreateOpen}>
  <DialogContent>
    <CreateRiskForm onSuccess={() => setCreateOpen(false)} />
  </DialogContent>
</Dialog>
```

#### Selected record for editing

```tsx
const [editingRisk, setEditingRisk] = useState<Risk | null>(null);

// In a table row:
<Button onClick={() => setEditingRisk(risk)}>Edit</Button>

// Dialog opens when editingRisk is not null:
{editingRisk && (
  <EditRiskDialog
    risk={editingRisk}
    open={true}
    onClose={() => setEditingRisk(null)}
  />
)}
```

#### Search filter

```tsx
const [search, setSearch] = useState("");

<Input
  placeholder="Search risks..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
/>

// Use the search value to filter the list:
const filteredRisks = risks.filter(r =>
  r.name.toLowerCase().includes(search.toLowerCase())
);
```

#### API loading / error state

```tsx
const [risks, setRisks] = useState<Risk[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

### State Update Rules

1. **Never mutate state directly** — always use the setter function:
   ```tsx
   // WRONG — mutates state
   risks.push(newRisk);

   // CORRECT — creates a new array (immutable update)
   setRisks([...risks, newRisk]);
   ```

2. **State updates are asynchronous** — the new value is not immediately available after calling the setter:
   ```tsx
   setCount(count + 1);
   console.log(count); // Still the old value!
   ```

3. **Function updater for derived state** — when the new value depends on the current value:
   ```tsx
   setCount(prev => prev + 1); // Safe — uses current value
   ```

---

## useEffect

`useEffect` runs **after** a component renders. It is used for:
- Fetching data from APIs
- Subscribing to external events
- Synchronising state with browser APIs (localStorage, title)
- Setting up timers or intervals

```tsx
useEffect(() => {
  // Effect code runs after render

  return () => {
    // Optional cleanup — runs before next effect or on unmount
  };
}, [dependency1, dependency2]); // Only re-run when these values change
```

### The Dependency Array

The second argument (dependency array) controls when the effect re-runs:

| Dependency array | Effect runs when |
|-----------------|-----------------|
| `[]` (empty) | Once, when the component first mounts |
| `[id]` | On mount AND whenever `id` changes |
| `[search, page]` | On mount AND whenever `search` or `page` changes |
| Omitted | After EVERY render (almost never what you want) |

### Standard Data Fetching Pattern

```tsx
"use client";

import { useState, useEffect } from "react";

export default function RiskRegisterPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRisks() {
      try {
        setLoading(true);
        const response = await fetch("/api/risks");
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setRisks(data.risks);
      } catch (err) {
        setError("Failed to load risks. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchRisks();
  }, []); // Empty array = fetch once on mount

  if (loading) return <LoadingSpinner />;
  if (error) return <Alert variant="destructive">{error}</Alert>;
  return <RiskTable risks={risks} />;
}
```

### Fetching When a Dependency Changes

```tsx
// Refetch whenever the selected department changes
useEffect(() => {
  if (!departmentId) return;

  fetch(`/api/risks?departmentId=${departmentId}`)
    .then(res => res.json())
    .then(data => setRisks(data.risks));
}, [departmentId]); // Runs on mount AND whenever departmentId changes
```

### AbortController — Cancelling In-Flight Requests

When a user rapidly changes a filter, multiple requests might be in-flight at once. The last request to complete might not be the last one sent. Use `AbortController` to cancel outdated requests:

```tsx
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/risks?search=${search}`, { signal: controller.signal })
    .then(res => res.json())
    .then(data => setRisks(data.risks))
    .catch(err => {
      if (err.name === "AbortError") return; // Request was cancelled — ignore
      setError("Failed to load");
    });

  return () => {
    controller.abort(); // Cancel if component unmounts or search changes
  };
}, [search]);
```

---

## useMemo

`useMemo` **caches the result of a computation** and only recalculates when its dependencies change. It prevents expensive operations from running on every render.

```tsx
const memoizedValue = useMemo(() => {
  return expensiveComputation(a, b);
}, [a, b]); // Only recalculate when a or b changes
```

### When to Use It

1. **Filtering large arrays**: If `risks` has 1,000 items, filtering on every keystroke is expensive.
   ```tsx
   const filteredRisks = useMemo(() => {
     return risks.filter(r =>
       r.name.toLowerCase().includes(search.toLowerCase()) &&
       (levelFilter === "all" || r.level === levelFilter)
     );
   }, [risks, search, levelFilter]);
   ```

2. **Transforming data for charts**: Building chart data from raw records.
   ```tsx
   const chartData = useMemo(() => {
     return Object.entries(
       risks.reduce((acc, r) => {
         acc[r.level] = (acc[r.level] || 0) + 1;
         return acc;
       }, {} as Record<string, number>)
     ).map(([name, value]) => ({ name, value }));
   }, [risks]);
   ```

3. **Computing derived permission state** (`usePermissions` hook uses it internally):
   ```tsx
   return useMemo(() => ({
     canView: hasPermission(permissions, resource, "view"),
     canCreate: hasPermission(permissions, resource, "create"),
     // ...
   }), [permissions, resource]);
   ```

**Do not over-optimise**: Only add `useMemo` when you can measure a performance problem. For simple transformations on small arrays, `useMemo` adds complexity without benefit.

---

## React Context API

React Context allows data to be shared with any component in the tree without passing props through every intermediate level. This project uses Context for data that is:
- Needed by many components at different nesting depths
- Changed infrequently (changing context triggers re-renders of all consumers)

### LanguageContext

**Source**: `src/contexts/LanguageContext.tsx`

The most widely used context. Every page and most components use `useLanguage()`.

```tsx
// Provider wraps the entire app in layout.tsx
<LanguageProvider>

// Any component anywhere can use it:
const { t, locale, isRTL, setLocale } = useLanguage();
```

| Property | Type | Description |
|----------|------|-------------|
| `t(phrase)` | `(string) => string` | Translates a UI phrase to current locale |
| `locale` | `"en" \| "ar" \| "lv"` | Current language code |
| `isRTL` | `boolean` | True when locale is Arabic (right-to-left layout) |
| `setLocale(code)` | `(string) => void` | Change the current language |

### SessionProvider (NextAuth)

**Source**: `next-auth/react`

Provides authentication session data. Used via `useSession()`:

```tsx
import { useSession } from "next-auth/react";

const { data: session, status } = useSession();

// session.user contains:
// - id, name, email
// - roles: string[]
// - permissions: UserPermission[]
// - customerAccountId
// - departmentId
// - isGrcAdded, isTprmAdded, isInternalAuditEnabled
// - subscriptionStatus
```

`status` can be: `"loading"`, `"authenticated"`, or `"unauthenticated"`.

### ThemeProvider

**Source**: `src/contexts/ThemeContext.tsx`

Manages the light/dark mode theme.

```tsx
const { theme, setTheme } = useTheme();
// theme: "light" | "dark" | "system"
```

### ModuleProvider

**Source**: `src/contexts/ModuleContext.tsx`

Manages which modules the current user can access, based on subscription + role.

```tsx
const { availableModules, currentModule, isSystemUser } = useModule();
// availableModules: ("GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE")[]
// isSystemUser: true for GRCAdministrator
```

Used by `MainLayout` to redirect users who try to visit a module they are not subscribed to.

### LogoProvider

**Source**: `src/contexts/LogoContext.tsx`

Fetches and caches the customer's logo URL from the settings API.

```tsx
const { logoUrl, isLoading } = useLogo();
```

### Creating a New Context

If you need a new piece of global state, follow this pattern:

```tsx
// src/contexts/MyContext.tsx
"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface MyContextValue {
  myValue: string;
  setMyValue: (value: string) => void;
}

const MyContext = createContext<MyContextValue | null>(null);

export function MyProvider({ children }: { children: ReactNode }) {
  const [myValue, setMyValue] = useState("default");

  return (
    <MyContext.Provider value={{ myValue, setMyValue }}>
      {children}
    </MyContext.Provider>
  );
}

export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) throw new Error("useMyContext must be used within MyProvider");
  return context;
}
```

Then add the provider to `src/app/layout.tsx` and add `useMyContext` to `src/hooks/`.

---

## Custom Hooks

Custom hooks are functions that start with `use` and can call other hooks. They extract reusable stateful logic from components.

### `usePermissions(resource)`

**Source**: `src/hooks/usePermissions.ts`

Returns all permission states for a resource in one call.

```tsx
const { canView, canCreate, canEdit, canDelete, canApprove, isLoading, scope } =
  usePermissions("compliance.governance");
```

Internally uses `useMemo` to avoid recomputing permissions on every render.

### `useHasPermission(resource, action)`

A simpler version when you only need one permission check.

```tsx
const canCreatePolicy = useHasPermission("compliance.governance", "create");
```

### `useHasRole(roleName)`

Checks if the current user has a specific role.

```tsx
const isAuditHead = useHasRole("AuditHead");
const isCustomerAdmin = useHasRole("CustomerAdministrator");
```

### `useUserRoles()`

Returns the full array of the current user's roles.

```tsx
const roles = useUserRoles();
const hasAuditAccess = roles.some(r =>
  ["AuditHead", "Auditor", "Auditee"].includes(r)
);
```

### `useTranslatedData(data, options)`

**Source**: `src/hooks/useTranslatedData.ts`

Fetches translations for an array of records and overlays them onto the original data. Used on list pages.

```tsx
const { data: translatedRisks, isLoading } = useTranslatedData(risks, {
  modelName: "Risk",
});
// Use translatedRisks instead of risks for display — names/descriptions are translated
```

Features:
- In-memory cache with 5-minute TTL
- AbortController to cancel stale requests
- Shows original data immediately while translations load

### `useTranslatedRecord(record, options)`

The single-record version of `useTranslatedData`. Used on detail pages.

```tsx
const { data: translatedRisk } = useTranslatedRecord(risk, {
  modelName: "Risk",
});
```

### `triggerTranslation(modelName, recordId, fields)`

A fire-and-forget function (not a hook) that initiates translation after create/edit.

```tsx
// Called after successful form submission:
triggerTranslation("Risk", savedRisk.id, {
  name: savedRisk.name,
  description: savedRisk.description,
});
```

---

## When to Use Which Approach

| Scenario | Solution |
|----------|----------|
| Dialog open/closed | `useState` in the parent component |
| Form input values | React Hook Form (`useForm`) |
| Server data (list of records) | `useEffect` + `useState` |
| User session and roles | `useSession()` (from SessionProvider) |
| Current language | `useLanguage()` (from LanguageProvider) |
| Permission checks | `usePermissions()` or `useHasPermission()` |
| Current theme | `useTheme()` |
| Expensive filtered list | `useMemo` |
| Truly global UI state (new) | New React Context |

### What NOT to Do

- Do not use a global Context for data that is only needed by one component — use local `useState` instead.
- Do not skip `useMemo` on arrays with hundreds of items that get filtered on every keystroke.
- Do not call `useEffect` without a dependency array — this creates infinite loops.
- Do not mutate state arrays directly (`array.push()`) — always create new arrays with spread (`[...array, item]`).

---

## Data Fetching Patterns

### Pattern 1: Fetch on Mount

The simplest and most common pattern. Fetch data when the component mounts.

```tsx
useEffect(() => {
  fetch("/api/risks")
    .then(res => res.json())
    .then(data => setRisks(data.risks));
}, []);
```

### Pattern 2: Fetch with Parameters

Re-fetch when filtering criteria change.

```tsx
const [filters, setFilters] = useState({ status: "all", department: "" });

useEffect(() => {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.append("status", filters.status);
  if (filters.department) params.append("departmentId", filters.department);

  fetch(`/api/risks?${params}`)
    .then(res => res.json())
    .then(data => setRisks(data.risks));
}, [filters]); // Re-fetch whenever filters change
```

### Pattern 3: Optimistic Updates

Update the UI immediately before the server confirms, then correct if the server rejects.

```tsx
async function handleDelete(riskId: string) {
  // 1. Immediately remove from UI
  setRisks(prev => prev.filter(r => r.id !== riskId));

  // 2. Send delete request
  const res = await fetch(`/api/risks/${riskId}`, { method: "DELETE" });

  if (!res.ok) {
    // 3. Restore if server rejected
    setRisks(prev => [...prev, deletedRisk]);
    toast.error("Failed to delete risk");
  }
}
```

### Pattern 4: Mutate and Refetch

The safest pattern — after a create/update/delete, refetch the whole list to guarantee the UI reflects server state.

```tsx
async function handleCreate(data: RiskFormValues) {
  const res = await fetch("/api/risks", {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (res.ok) {
    setCreateOpen(false);
    // Trigger a refetch by incrementing a counter that is in the effect's dependency array
    setRefetchTrigger(n => n + 1);
  }
}

useEffect(() => {
  fetch("/api/risks").then(res => res.json()).then(data => setRisks(data.risks));
}, [refetchTrigger]); // Re-runs whenever refetchTrigger changes
```

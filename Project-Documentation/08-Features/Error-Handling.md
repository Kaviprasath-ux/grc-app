# Error Handling

## Table of Contents

1. [Types of Errors in the Application](#types-of-errors-in-the-application)
2. [HTTP Error Codes](#http-error-codes)
3. [try/catch in API Routes](#trycatch-in-api-routes)
4. [Standard Error Response Format](#standard-error-response-format)
5. [Client-Side Error Handling — Toast Notifications](#client-side-error-handling--toast-notifications)
6. [React Error Boundaries](#react-error-boundaries)
7. [Loading States and Skeleton Screens](#loading-states-and-skeleton-screens)
8. [Permission Denied Handling](#permission-denied-handling)
9. [Not Found Handling](#not-found-handling)
10. [Form Validation Errors](#form-validation-errors)
11. [Network Errors](#network-errors)
12. [Database Errors](#database-errors)
13. [Translation Errors](#translation-errors)
14. [Encryption Errors](#encryption-errors)
15. [Logging](#logging)

---

## Types of Errors in the Application

Errors in a full-stack Next.js application fall into several categories, each requiring a different handling strategy:

| Error Type | Where it occurs | How users see it |
|-----------|----------------|-----------------|
| **Validation errors** | Client-side form, API route | Inline form field messages |
| **Authentication errors** | API middleware, Auth callback | Redirect to login page |
| **Authorisation errors** | `withAuth` wrapper | "Unauthorised" component in UI |
| **Not found errors** | API route, page | 404 page or empty state |
| **Database errors** | Prisma queries | Generic server error message |
| **Network errors** | `fetch()` calls | Toast notification |
| **Encryption errors** | Prisma extension | Server-side log, degraded gracefully |
| **Translation errors** | Translation service | Falls back to original text |
| **Unexpected server errors** | API routes, cron jobs | 500 response, console.error log |

---

## HTTP Error Codes

HTTP status codes are three-digit numbers that tell the client what happened with their request. Every API response includes one.

### 2xx — Success

| Code | Meaning | Used when |
|------|---------|-----------|
| `200 OK` | Request succeeded, response body contains data | GET requests, successful updates |
| `201 Created` | A new resource was created successfully | POST requests that create records |
| `204 No Content` | Request succeeded, no response body | DELETE requests, successful operations with no data to return |

### 4xx — Client Errors (the caller did something wrong)

| Code | Meaning | Used when |
|------|---------|-----------|
| `400 Bad Request` | The request is malformed or contains invalid data | Missing required fields, invalid JSON, failed Zod validation |
| `401 Unauthorized` | The caller is not authenticated (no session) | API call made without a valid session cookie |
| `403 Forbidden` | The caller is authenticated but lacks permission | User has a session but their role does not permit this action |
| `404 Not Found` | The requested resource does not exist | Record with given ID not found, wrong URL |
| `409 Conflict` | The request conflicts with current state | Duplicate unique key violation, trying to delete a record with active dependents |
| `422 Unprocessable Entity` | Request body is structurally valid but semantically invalid | Valid JSON but business rule violation |
| `429 Too Many Requests` | Rate limit exceeded | Repeated failed login attempts |

### 5xx — Server Errors (the server failed)

| Code | Meaning | Used when |
|------|---------|-----------|
| `500 Internal Server Error` | An unexpected error occurred on the server | Unhandled exception, database connection failure |
| `503 Service Unavailable` | The server is temporarily unable to handle requests | Database overload, maintenance window |

---

## try/catch in API Routes

Every API route handler is wrapped in a `try/catch` block to ensure unhandled exceptions return a meaningful 500 response rather than crashing the server or hanging the request.

### Standard Pattern

```typescript
export const GET = withAuth(async (req, context, session) => {
  try {
    const { id } = await context.params;

    const risk = await prisma.risk.findUnique({
      where: { id, customerAccountId: session.customerAccountId },
    });

    if (!risk) {
      return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
    }

    return NextResponse.json({ risk });

  } catch (error) {
    console.error('[GET /api/risks/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { resource: 'risk.register', action: 'view' });
```

### Why "Internal server error" is Generic

The 500 response body says "Internal server error" rather than the actual exception message for security reasons. Detailed error messages can reveal:
- Database schema details (table names, column names).
- Internal file paths.
- Stack traces with library versions.

This information is useful to attackers. The detailed error is logged server-side (in `console.error`) where only authorised personnel can view it.

---

## Standard Error Response Format

All error responses from API routes follow a consistent JSON structure:

```typescript
// Error response
{
  "error": "A human-readable description of what went wrong"
}

// Validation error response (with field-level details)
{
  "error": "Validation failed",
  "details": {
    "name": ["Name is required"],
    "dueDate": ["Due date must be a future date"]
  }
}

// Success response with data
{
  "risk": { ... },           // Single record response
  "risks": [ ... ],          // List response
  "total": 47,               // Total count for pagination
  "page": 1,
  "pageSize": 20
}
```

### Consistent Error Key

All error responses use the `"error"` key (singular, lowercase). Callers can always check `response.error` to detect failure without inspecting the status code.

---

## Client-Side Error Handling — Toast Notifications

The application uses **Sonner** (a toast notification library) to display user-facing error messages.

### Where It Is Used

In any component that calls an API and needs to show success/failure feedback:

```typescript
import { toast } from 'sonner';

async function handleSubmit(data: FormValues) {
  try {
    const response = await fetch('/api/risks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const result = await response.json();
      toast.error(result.error || 'Failed to create risk');
      return;
    }

    const result = await response.json();
    toast.success('Risk created successfully');
    router.push(`/risks/${result.risk.id}`);

  } catch (err) {
    // Network-level failure (no internet, server down)
    toast.error('Network error. Please check your connection and try again.');
  }
}
```

### Toast Types

| Function | Appearance | Use case |
|----------|-----------|---------|
| `toast.success('...')` | Green, checkmark | Successful create/update/delete |
| `toast.error('...')` | Red, X icon | API error, validation failure |
| `toast.warning('...')` | Yellow, warning icon | Non-blocking warnings |
| `toast.info('...')` | Blue, info icon | Informational messages |
| `toast.loading('...')` | Spinner | Long-running operations |

### Toast Configuration

The `<Toaster />` component is mounted in the root layout (`src/app/layout.tsx`), ensuring toasts work on every page without repeating the setup.

```typescript
// src/app/layout.tsx
import { Toaster } from 'sonner';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
```

---

## React Error Boundaries

A **React Error Boundary** is a component that catches JavaScript errors thrown during rendering by any child component tree, preventing the entire page from going blank.

### How Error Boundaries Work

Without an error boundary:
```
Parent → Child → GrandChild throws error → ENTIRE PAGE CRASHES (white screen)
```

With an error boundary:
```
Parent → ErrorBoundary → Child → GrandChild throws error
                                   ↓
                       ErrorBoundary catches error → renders fallback UI
                       Parent and other siblings continue working normally
```

### Where Error Boundaries Are Used

The application wraps major page sections and module containers with error boundaries. If the risk register table crashes, the sidebar and header still work. The user sees a "Something went wrong" message with a retry button, not a blank white page.

### Usage Pattern

```typescript
// In the protected layout
<ErrorBoundary fallback={<ModuleError />}>
  <RiskRegisterPage />
</ErrorBoundary>
```

---

## Loading States and Skeleton Screens

While data is being fetched from the API, the UI shows **skeleton screens** — animated placeholder shapes that match the layout of the content being loaded.

### Why Skeletons (Not Spinners)

A full-page spinner (rotating circle in the centre of the page) is jarring and can feel slower than it is. Skeleton screens:
- Show the page structure immediately, reducing perceived load time.
- Give the user a preview of where content will appear.
- Prevent layout shift when data loads.

### Implementation

```typescript
// Page component pattern
function RiskRegisterPage() {
  const { data: risks, isLoading, error } = useQuery({
    queryKey: ['risks'],
    queryFn: () => fetch('/api/risks').then(r => r.json()),
  });

  if (isLoading) {
    return <RiskTableSkeleton />;  // Animated placeholder
  }

  if (error) {
    return <ErrorState message="Failed to load risks. Please try again." />;
  }

  return <RiskTable risks={risks} />;
}
```

---

## Permission Denied Handling

When a user navigates to a page or API route they do not have permission to access:

### API Level (403 Forbidden)

The `withAuth` wrapper returns `403` immediately if the user's role does not include the required permission:

```typescript
return NextResponse.json(
  { error: 'You do not have permission to perform this action.' },
  { status: 403 }
);
```

### UI Level

In the frontend, when a fetch returns 403, the component renders an `Unauthorised` component rather than the normal page content:

```typescript
// Typical page check
const { canView } = usePermissions('risk.register');

if (!canView) {
  return <Unauthorised />;
}
```

The `Unauthorised` component displays:
- A lock icon.
- "Access Restricted" heading.
- "You don't have permission to view this page."
- A link back to the dashboard.

This provides a clear, user-friendly message rather than a blank page or a confusing JSON error response.

---

## Not Found Handling

### API Not Found (404)

```typescript
const risk = await prisma.risk.findUnique({ where: { id } });

if (!risk) {
  return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
}
```

The application also adds a tenancy check to prevent cross-tenant data access:

```typescript
const risk = await prisma.risk.findUnique({
  where: {
    id,
    customerAccountId: session.customerAccountId,  // Tenant isolation
  },
});

// If the record exists but belongs to another tenant,
// this returns null — same as "not found" from the caller's perspective.
// This deliberately prevents users from discovering that a record exists
// in another tenant.
if (!risk) {
  return NextResponse.json({ error: 'Risk not found' }, { status: 404 });
}
```

### Page Not Found

Next.js automatically handles unknown routes with the default 404 page. Custom `not-found.tsx` components can be added per route segment for module-specific not-found experiences.

---

## Form Validation Errors

Forms use **React Hook Form** combined with **Zod** schema validation.

### Zod Schema Definition

```typescript
import { z } from 'zod';

const riskSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  categoryId: z.string({ required_error: 'Category is required' }),
  likelihoodId: z.number().min(1).max(5),
  impactId: z.number().min(1).max(5),
  dueDate: z.date().min(new Date(), 'Due date must be in the future'),
});
```

### Inline Validation Messages

```typescript
const { register, formState: { errors } } = useForm<RiskFormValues>({
  resolver: zodResolver(riskSchema),
});

// In the JSX
<Input {...register('name')} />
{errors.name && (
  <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
)}
```

Errors appear inline beneath the problematic field immediately when the user moves away (blur) or attempts to submit.

### Server-Side Validation

Zod validation is also run server-side in API routes as an additional layer:

```typescript
const body = await req.json();
const result = riskSchema.safeParse(body);

if (!result.success) {
  return NextResponse.json(
    { error: 'Validation failed', details: result.error.flatten().fieldErrors },
    { status: 400 }
  );
}
```

---

## Network Errors

Network errors occur when the `fetch()` call itself fails — before the server even responds. Common causes:
- No internet connection.
- DNS resolution failure.
- Server is completely down.
- Request timeout.

### How to Detect Network Errors

```typescript
try {
  const response = await fetch('/api/risks');
  // If we get here, the server responded (even if status is 500)
} catch (err) {
  // Network-level failure — server did not respond at all
  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    toast.error('Cannot reach the server. Please check your internet connection.');
  }
}
```

### Retry Logic

For non-idempotent operations (GET requests), the application may implement automatic retry:

```typescript
async function fetchWithRetry(url: string, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status >= 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, delay * attempt));
        continue;
      }
      return response;  // Return even on 4xx errors
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delay * attempt));
    }
  }
}
```

---

## Database Errors

Prisma throws typed errors that can be caught and handled:

### Common Prisma Error Codes

```typescript
import { Prisma } from '@prisma/client';

try {
  await prisma.risk.create({ data: { ... } });
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        // Unique constraint violation (duplicate record)
        return NextResponse.json(
          { error: 'A risk with this code already exists.' },
          { status: 409 }
        );
      case 'P2003':
        // Foreign key constraint violation
        return NextResponse.json(
          { error: 'Referenced record does not exist.' },
          { status: 400 }
        );
      case 'P2025':
        // Record not found (for delete/update)
        return NextResponse.json(
          { error: 'Record not found.' },
          { status: 404 }
        );
    }
  }
  // Unknown error — log and return 500
  console.error('Database error:', err);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

---

## Translation Errors

When the translation service (Python backend API) fails, the application degrades gracefully:
- The `useTranslatedData` hook returns the original untranslated data.
- Users see English text instead of their selected language.
- No error toast is shown (translation failures are non-critical).
- The failure is logged at `console.warn` level for monitoring.

```typescript
// In useTranslatedData hook
const fetchTranslations = async () => {
  try {
    const response = await fetch('/api/translations/bulk', { ... });
    if (!response.ok) {
      // Graceful degradation: return original data
      return originalData;
    }
    const { translations } = await response.json();
    return applyTranslations(originalData, translations);
  } catch (err) {
    console.warn('[Translation] Service unavailable, using original text:', err);
    return originalData;  // Fall back silently
  }
};
```

---

## Encryption Errors

### Decryption Failures

If a `fileData` column cannot be decrypted (typically due to key mismatch), the Prisma extension catches the error and returns the raw bytes (which will be unreadable but will not crash the application):

```typescript
// In the encryption extension (src/lib/prisma.ts)
function maybeDecryptBytes(value: Buffer): Buffer {
  try {
    return decryptBytes(value);
  } catch (err) {
    safeLog.error('Decryption failed for field — returning raw bytes', { err });
    return value;  // Return encrypted bytes rather than throwing
  }
}
```

This prevents a single decryption failure from blocking the entire record fetch.

### Kill Switch

If `ENCRYPTION_ENABLED` is set to `false` or unset, the Prisma extension is a no-op — data is stored and retrieved in plaintext. This allows staging environments to run without encryption for debugging purposes.

---

## Logging

### Server-Side Logging

For non-sensitive error details, use `console.error`:

```typescript
console.error('[POST /api/risks] Failed to create risk:', err);
```

The `[POST /api/risks]` prefix makes log lines easy to filter in the Vercel function logs.

### Sensitive Data Logging — safeLog

**Never log sensitive data using `console.log` or `console.error`.**

Use `safeLog` from `@/lib/safe-log`, which automatically redacts known-sensitive fields:

```typescript
import { safeLog } from '@/lib/safe-log';

// This will log the user object but automatically redact
// fields like password, token, secret, fileData, etc.
safeLog.info('User profile updated', { user: updatedUser });

// Output: { user: { id: "clx...", name: "John", email: "j@c.com", password: "[REDACTED]" } }
```

**Fields automatically redacted by safeLog:**
- `password`, `passwordHash`
- `token`, `secret`, `apiKey`
- `fileData`, `encryptedData`
- `ssn`, `creditCard`, `bankAccount`
- Any field matching `/secret|password|token|key|credential/i`

### Log Levels

| Level | Use case |
|-------|---------|
| `safeLog.error` | Unexpected failures that need investigation |
| `safeLog.warn` | Non-critical issues (translation failures, optional service unavailable) |
| `safeLog.info` | Important business events (user login, report generated) |
| `console.debug` | Development-only detailed tracing (wrap in `if (process.env.NODE_ENV === 'development')`) |

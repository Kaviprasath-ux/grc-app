# Audit Trail

## Table of Contents

1. [What is an Audit Trail?](#what-is-an-audit-trail)
2. [Why Immutability Matters](#why-immutability-matters)
3. [The AuditTrail Database Model](#the-audittrail-database-model)
4. [What Gets Logged](#what-gets-logged)
5. [Automatic Capture via withAuth Wrapper](#automatic-capture-via-withauth-wrapper)
6. [The Audit Trail UI Page](#the-audit-trail-ui-page)
7. [Read-Only Log (No Edit, No Delete)](#read-only-log-no-edit-no-delete)
8. [Filtering and Searching](#filtering-and-searching)
9. [Module Label Generation](#module-label-generation)
10. [Compliance Use Cases](#compliance-use-cases)

---

## What is an Audit Trail?

An **audit trail** (also called an **audit log**) is a chronological record of every significant action taken in a system — who did what, to which record, and when. It is the digital equivalent of a paper log book that is written in ink: once an entry is written, it cannot be erased or changed.

### A Simple Analogy

Imagine a bank vault. Every person who enters and exits signs a physical register at the front desk. The date, time, and signature are written in pen — not pencil. If something goes missing, investigators review the register to determine who was in the vault, in what order, and exactly when. The register's value depends entirely on the fact that nobody can erase an entry.

The application's audit trail works the same way: every time a user creates a risk, approves evidence, deletes a control, or logs in, a permanent record is written that says "User X performed action Y on record Z at time T." This record cannot be edited, and only superadmins can see the raw log.

### Legal and Regulatory Context

Audit trails are a legal and compliance requirement under many frameworks:

| Framework | Requirement |
|-----------|-------------|
| ISO 27001 | A.8.15 — Logging: "Logs that record user activities, exceptions, faults and information security events shall be produced, stored, protected and analysed." |
| SOC 2 | CC7.2 — "The entity monitors system components for anomalies that are indicative of malicious acts, natural disasters, and errors affecting the entity's ability to meet its objectives." |
| GDPR | Article 30 — Records of processing activities; Article 32 — Appropriate security measures including logging. |
| PCI-DSS | Requirement 10 — Log and monitor all access to system components and cardholder data. |
| HIPAA | 45 CFR §164.312(b) — Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems. |

---

## Why Immutability Matters

If an audit trail can be modified, it has no evidentiary value. An attacker who gains access and deletes audit logs has destroyed the evidence of their own activities. An employee who manipulates records and then deletes the audit trail can deny wrongdoing.

### How Immutability is Enforced in This Application

1. **No DELETE or PATCH API routes exist for audit trail records.** The `AuditTrail` table has no API endpoint that allows updates or deletions.

2. **Database-level protection.** The Prisma schema and database permissions are configured such that the application user account cannot issue `UPDATE` or `DELETE` statements against the `AuditTrail` table.

3. **No edit UI.** The audit trail page in the application is strictly read-only. There are no edit buttons, no delete buttons, and no bulk actions.

4. **Append-only writes.** The `withAuth` wrapper only ever calls `prisma.auditTrail.create()` — never update or delete.

---

## The AuditTrail Database Model

```prisma
model AuditTrail {
  id                String          @id @default(cuid())
  customerAccountId String
  customerAccount   CustomerAccount @relation(...)

  // Who
  userId            String
  user              User            @relation(...)
  userEmail         String          // Denormalised: stored even if user is later deleted
  userName          String          // Denormalised: display name at time of action

  // What
  action            String          // "create", "update", "delete", "view", "login", "logout", etc.
  resource          String          // Permission resource string, e.g., "compliance.evidence"
  resourceLabel     String?         // Human-readable label, e.g., "Compliance - Evidence"
  recordId          String?         // The ID of the affected record
  recordLabel       String?         // Display name of the affected record at time of action
  module            String?         // Top-level module: "compliance", "risk", "internal-audit", etc.

  // Changes
  previousValues    Json?           // The record's values BEFORE the change
  newValues         Json?           // The record's values AFTER the change (for creates/updates)

  // Context
  ipAddress         String?         // Client IP address
  userAgent         String?         // Browser / client user agent string
  requestPath       String?         // The API path that was called (e.g., "/api/compliance/evidence/123")
  requestMethod     String?         // HTTP method: GET, POST, PATCH, DELETE

  // When
  createdAt         DateTime        @default(now())
  // Note: No updatedAt field — audit trails are never updated
}
```

### Why User Information is Denormalised

`userEmail` and `userName` are stored directly in the audit trail row (not just referenced via `userId`). This ensures that:
- If a user is deleted or renamed, the audit trail still shows who performed the original action.
- Historical records remain accurate even as user data changes.

This is a standard pattern in audit logging: the audit trail captures the state of the actor **at the time of the action**, not their current state.

---

## What Gets Logged

### CRUD Operations on All Protected Resources

Every API route protected by `withAuth` automatically logs actions. The following action types are captured:

| Action | Trigger |
|--------|---------|
| `create` | POST request that creates a new record |
| `update` | PATCH or PUT request that modifies an existing record |
| `delete` | DELETE request that removes a record |
| `view` | GET request for a specific record (not list views) |
| `view_list` | GET request for a list/collection of records |
| `export` | Export action (download data) |
| `import` | Import action (bulk upload) |
| `approve` | Approval action (evidence approval, policy approval, etc.) |
| `reject` | Rejection action |
| `submit` | Submission action (evidence submitted for review) |

### Authentication Events

| Action | Trigger |
|--------|---------|
| `login` | Successful user login |
| `logout` | User explicitly logs out |
| `login_failed` | Failed login attempt (wrong password) |
| `password_reset` | Password reset completed |
| `session_expired` | Session token expired |

### Special Actions

| Action | Trigger |
|--------|---------|
| `generate_report` | Report generated and downloaded |
| `send_notification` | Manual notification sent |
| `bulk_delete` | Multiple records deleted at once |
| `role_change` | User's role is changed |
| `invitation_sent` | New user invitation email sent |
| `permission_granted` | Explicit permission grant |
| `permission_revoked` | Permission removal |

---

## Automatic Capture via withAuth Wrapper

The audit logging is built into the `withAuth` API wrapper (`src/lib/api-auth.ts`). This means:

- **No individual route needs to write audit logs manually.**
- Every route wrapped with `withAuth` automatically gets logged.
- The log is written as a **fire-and-forget** operation — it does not block the API response.

### How the Fire-and-Forget Pattern Works

```typescript
// Simplified version of what withAuth does after the handler succeeds
export function withAuth(handler, options) {
  return async (req, context) => {
    const session = await getSession();

    // Run the actual route handler
    const response = await handler(req, context, session);

    // Fire audit log AFTER response is sent — does not block the user
    // If audit logging fails, the original request still succeeds
    void prisma.auditTrail.create({
      data: {
        customerAccountId: session.customerAccountId,
        userId: session.user.id,
        userEmail: session.user.email,
        userName: session.user.name,
        action: deriveAction(req.method, options.action),
        resource: options.resource,
        resourceLabel: generateResourceLabel(options.resource),
        module: options.resource.split('.')[0],
        ipAddress: req.headers.get('x-forwarded-for'),
        userAgent: req.headers.get('user-agent'),
        requestPath: req.url,
        requestMethod: req.method,
        // recordId and changes are passed in from the handler result
      }
    });

    return response;
  };
}
```

The `void` keyword means "start this Promise but don't wait for it." The HTTP response returns to the user immediately; the audit log write happens asynchronously in the background.

**Trade-off:** In extremely rare cases (server crash immediately after response), an audit log entry could be lost. This is an acceptable trade-off for performance. For high-assurance environments, a synchronous audit log write can be configured.

---

## The Audit Trail UI Page

**URL:** `/audit-trail`

**Who can access it:** Customer Administrators and GRC Administrators (read-only).

### Page Layout

The audit trail page presents a chronological table (newest first) of all audit events for the tenant:

| Column | Description |
|--------|-------------|
| Date/Time | Timestamp of the action (shown in user's local timezone) |
| User | Display name and email of the actor |
| Action | What was done (Create, Update, Delete, View, Login, etc.) |
| Module | Which application module was involved |
| Resource | The specific resource type (e.g., "Compliance - Evidence") |
| Record | The name/identifier of the affected record |
| IP Address | Client IP address |
| Details | "View" link to see full change details |

Clicking **"View Details"** for a row opens a modal showing:
- Full `previousValues` and `newValues` JSON (if available).
- The exact API path that was called.
- Browser user agent.
- All fields that changed (highlighted diff view).

---

## Read-Only Log (No Edit, No Delete)

The audit trail page is strictly read-only:
- No edit buttons anywhere on the page.
- No delete buttons, even for superadmins.
- No "Clear log" or "Archive log" function in the UI.
- The API route for audit trail only exposes GET (list and individual record fetch).

If an organisation requires long-term archival of audit logs beyond the database retention period, logs should be exported regularly to an immutable storage system (e.g., AWS S3 with object lock, Azure immutable blob storage).

---

## Filtering and Searching

The audit trail page provides filters to narrow down the log:

### Filter by User

Dropdown list of all users in the tenant. Selecting a user shows only their actions. Useful for:
- Investigating a specific user's activities.
- Employee offboarding review.
- Privilege abuse investigation.

### Filter by Module

Dropdown: All Modules / Compliance / Risk / Internal Audit / Asset Management / TPRM / Support / Organisation / Authentication / Admin.

### Filter by Action

Dropdown: All Actions / Create / Update / Delete / View / Login / Logout / Approve / Reject / Export.

### Filter by Resource

Free-text search across the `resource` and `resourceLabel` fields. Useful when you know exactly which resource you are investigating (e.g., "compliance.evidence").

### Date/Time Range Filter

Start date and end date pickers. All entries between the two dates (inclusive) are shown.

### Combining Filters

All filters are combinable. Example: "Show me all DELETE actions performed by john.doe@company.com in the Risk module during July 2025."

### Search

A free-text search field searches across `recordLabel`, `userName`, and `userEmail` fields simultaneously.

---

## Module Label Generation

The raw `resource` field in the database uses a programmatic format: `compliance.evidence`, `risk.register`, `internal-audit.findings`, etc. These are not user-friendly.

The frontend uses a **module label generator** function that converts the resource string to a readable label:

| Resource String | Displayed As |
|----------------|-------------|
| `compliance.evidence` | Compliance — Evidence |
| `compliance.controls` | Compliance — Controls |
| `compliance.governance` | Compliance — Governance Documents |
| `risk.register` | Risk Management — Risk Register |
| `risk.assessment` | Risk Management — Assessments |
| `internal-audit.engagements` | Internal Audit — Engagements |
| `internal-audit.findings` | Internal Audit — Findings |
| `internal-audit.capa` | Internal Audit — CAPA |
| `assets.inventory` | Asset Management — Inventory |
| `organization.processes` | Organisation — Processes |
| `auth` | Authentication |
| `admin.users` | Admin — User Management |

---

## Compliance Use Cases

### Proving Actions Were Taken

A common compliance audit question is: "Prove that access reviews were conducted quarterly." The audit trail provides:
- A `view` or `update` record every time a reviewer opened and completed an access review record.
- Timestamped entries showing the reviewer's identity and the exact time of review.
- The `newValues` field showing the review outcome (approved/rejected).

### Demonstrating Segregation of Duties

ISO 27001 and SOC 2 both require segregation of duties for certain sensitive actions (e.g., one person cannot both request and approve their own evidence). The audit trail can be queried to show that:
- Record A was created by User X.
- Record A was approved by User Y (different user).
- No single user both created and approved the same record.

### Incident Investigation

If a data breach or policy violation is suspected:
1. Filter the audit trail by the suspected timeframe.
2. Filter by the affected resource (e.g., `compliance.evidence`).
3. Look for unusual actions: bulk deletes, exports at odd hours, access from unfamiliar IP addresses.
4. Cross-reference with the login log to confirm session validity.

### Regulatory Examination Support

When regulators ask "who accessed patient data between January and March?", the audit trail provides a ready-made answer. The log includes:
- Every `view` action on relevant records.
- The user's name and email.
- The timestamp and IP address.
- The exact record that was accessed.

This transforms a potentially days-long forensic exercise into a filtered query.

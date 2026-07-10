# Email and Notifications System

## Table of Contents

1. [Overview](#overview)
2. [What is SMTP?](#what-is-smtp)
3. [How Email Delivery Works End-to-End](#how-email-delivery-works-end-to-end)
4. [Nodemailer Library](#nodemailer-library)
5. [EmailSettings Database Model](#emailsettings-database-model)
6. [Configuring Email in the Admin Panel](#configuring-email-in-the-admin-panel)
7. [Template System](#template-system)
8. [All Notification Types and Triggers](#all-notification-types-and-triggers)
9. [Multi-Channel Delivery](#multi-channel-delivery)
10. [The Notification Database Model](#the-notification-database-model)
11. [In-App Notification Center](#in-app-notification-center)
12. [Sending a Notification Programmatically](#sending-a-notification-programmatically)
13. [Adding a New Email Template](#adding-a-new-email-template)
14. [Testing Email Configuration](#testing-email-configuration)
15. [Common Email Errors and Fixes](#common-email-errors-and-fixes)

---

## Overview

The GRC application has a fully featured notification system that keeps all users informed about tasks, deadlines, approvals, and important events. Notifications are delivered through two channels simultaneously:

- **In-app inbox** — a bell icon in the top navigation bar shows unread notifications. Clicking it opens a slide-out panel listing all recent notifications.
- **Email** — an email is sent to the user's registered address, rendered from a pre-designed HTML template stored in the database.

The system is **multi-tenant aware**: each customer account can configure its own SMTP settings, and email notifications are sent from that account's mail server. If no SMTP settings are configured for a tenant, email delivery is silently skipped while in-app notifications still work.

There are over **65 distinct notification templates** covering every module: Compliance, Risk, Internal Audit, TPRM, Asset Management, Support, and system events such as new user invitations and password resets.

---

## What is SMTP?

**SMTP** stands for **Simple Mail Transfer Protocol**. It is the internet standard for sending email messages from one server to another. Think of SMTP as the postal system for email:

- Your application is the **sender** (like a person dropping a letter at the post office).
- The SMTP server is the **post office** — it accepts the email and routes it onward.
- The recipient's mail server is the **destination post office** — it receives the email and delivers it to the inbox.

SMTP does not handle receiving email (that is done by IMAP or POP3 protocols). SMTP only handles the **outbound sending** of messages.

### SMTP Connection Parameters

To connect to an SMTP server you need four things:

| Parameter | What it means | Example |
|-----------|--------------|---------|
| Host | The hostname or IP address of the mail server | `smtp.gmail.com` |
| Port | The TCP port to connect on | `587` (STARTTLS) or `465` (SSL) |
| Username | Usually the sending email address | `notifications@yourcompany.com` |
| Password | The account password or app-specific password | `abcd efgh ijkl mnop` |

### Common SMTP Ports

- **Port 25** — Unencrypted SMTP, used server-to-server. Most ISPs block outbound port 25 on residential connections.
- **Port 465** — SMTP over SSL/TLS (implicit encryption). The connection is encrypted from the first byte.
- **Port 587** — SMTP with STARTTLS (explicit encryption). The connection starts unencrypted, then upgrades to TLS before credentials are sent. This is the most widely used port for application email sending.

---

## How Email Delivery Works End-to-End

Here is the complete journey of a notification email from the application to the user's inbox:

```
[GRC Application Code]
        |
        | (1) Event occurs (e.g., evidence due tomorrow)
        v
[Notification Service]  ←── src/lib/notification-service.ts
        |
        | (2) Looks up user preferences and tenant SMTP settings
        v
[EmailSettings lookup]  ←── DB: EmailSettings table (per tenant)
        |
        | (3) Loads the HTML template from DB
        v
[EmailTemplate lookup]  ←── DB: EmailTemplate table (template by name)
        |
        | (4) Substitutes {{VARIABLE}} placeholders with real values
        v
[Nodemailer createTransport()]  ←── connects to tenant SMTP server
        |
        | (5) Sends the assembled email message
        v
[Tenant SMTP Server]  (e.g., smtp.office365.com)
        |
        | (6) Routes through internet MX records
        v
[User's Mail Server]  (e.g., Gmail, Outlook)
        |
        | (7) Delivered to user's inbox
        v
[User reads email]
```

Each step can fail independently; the system logs errors and continues processing remaining notifications without stopping the entire batch.

---

## Nodemailer Library

**Nodemailer** is the most widely used Node.js library for sending emails. It abstracts the low-level SMTP protocol into a simple JavaScript API.

### Installation

Nodemailer is already installed as a project dependency:

```bash
npm install nodemailer
# TypeScript types
npm install --save-dev @types/nodemailer
```

### How Nodemailer Connects to SMTP

```typescript
import nodemailer from 'nodemailer';

// Step 1: Create a transport (a persistent SMTP connection pool)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,       // false = STARTTLS on port 587, true = SSL on port 465
  auth: {
    user: 'sender@gmail.com',
    pass: 'app-password',
  },
});

// Step 2: Send a message
await transporter.sendMail({
  from: '"GRC System" <sender@gmail.com>',
  to: 'user@company.com',
  subject: 'Evidence Due Tomorrow',
  html: '<p>Your evidence item is due tomorrow.</p>',
});
```

### Where Nodemailer Is Used in This Project

The email sending logic lives in `src/lib/notification-service.ts`. The `sendEmail()` function:

1. Receives the recipient address, subject, and pre-rendered HTML body.
2. Looks up the tenant's `EmailSettings` record to get SMTP credentials.
3. Creates a Nodemailer transporter using those credentials.
4. Calls `transporter.sendMail()`.
5. Returns success/failure status to the caller.

The transporter is created fresh per email to use the correct per-tenant credentials. This avoids credential leakage between tenants.

---

## EmailSettings Database Model

Each customer account can have exactly one `EmailSettings` record. This record holds all SMTP configuration for that tenant.

### Schema

```prisma
model EmailSettings {
  id                String          @id @default(cuid())
  customerAccountId String          @unique
  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id])

  // SMTP connection settings
  smtpHost          String          // e.g., "smtp.office365.com"
  smtpPort          Int             // e.g., 587
  smtpUser          String          // e.g., "grc@company.com"
  smtpPassword      String          // Stored encrypted at rest

  // Sender identity
  fromEmail         String          // e.g., "grc@company.com"
  fromName          String?         // e.g., "GRC Notifications"

  // Feature flags
  emailEnabled      Boolean         @default(true)
  useTLS            Boolean         @default(true)

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
}
```

### Key Fields Explained

- **smtpHost** — The mail server hostname provided by your email provider.
- **smtpPort** — Usually `587` for STARTTLS or `465` for SSL. Ask your IT team which one your server requires.
- **smtpUser** / **smtpPassword** — The account credentials. For Gmail, this must be an App Password (not your regular Google password) because Google blocks less-secure app access.
- **fromEmail** — The "From" address recipients see. Must match what your SMTP server allows.
- **fromName** — The friendly display name shown in email clients, e.g., "GRC Notifications Team".
- **emailEnabled** — If set to `false`, the service skips email delivery for this tenant without throwing an error.
- **useTLS** — Whether to use encrypted transport. Should always be `true` in production.

---

## Configuring Email in the Admin Panel

### Where to Find It

Navigate to: **Admin Panel → Settings → Email Configuration**

URL: `/admin/settings/email`

### Step-by-Step Setup

1. Log in as a **Customer Administrator** or **GRC Administrator**.
2. Go to **Settings** in the left sidebar.
3. Click **Email Configuration**.
4. Fill in the SMTP form:
   - **SMTP Host** — Enter your mail server address (e.g., `mail.yourcompany.com`).
   - **SMTP Port** — Enter `587` for most corporate mail servers.
   - **Username** — Enter the sending email account address.
   - **Password** — Enter the password or app-specific password.
   - **From Name** — Enter the display name (e.g., `GRC Platform`).
   - **From Email** — Enter the sender address.
5. Click **Test Connection** to verify the settings work (see [Testing Email Configuration](#testing-email-configuration)).
6. Click **Save Settings**.
7. Enable the **Email Notifications** toggle if it is not already on.

### Common Email Providers

| Provider | SMTP Host | Port | Notes |
|----------|-----------|------|-------|
| Gmail | smtp.gmail.com | 587 | Requires App Password (2FA must be enabled) |
| Microsoft 365 | smtp.office365.com | 587 | Use full UPN as username |
| Outlook.com | smtp.live.com | 587 | Personal accounts only |
| Amazon SES | email-smtp.us-east-1.amazonaws.com | 587 | Requires SMTP credentials from SES console |
| SendGrid | smtp.sendgrid.net | 587 | Use `apikey` as username, API key as password |
| Mailgun | smtp.mailgun.org | 587 | Use SMTP credentials from Mailgun dashboard |

---

## Template System

### How Templates Work

Email templates are stored in the `EmailTemplate` database table. Each template has:

- A unique **name** (used as the lookup key, e.g., `EVIDENCE_DUE_REMINDER`)
- An HTML **body** containing `{{VARIABLE_NAME}}` placeholders
- A **subject line** that can also contain placeholders

When an email is triggered, the notification service:
1. Looks up the template by name from the database.
2. Replaces all `{{VARIABLE_NAME}}` tokens with real values.
3. Passes the rendered HTML to Nodemailer.

### Placeholder Substitution Example

**Template body (stored in DB):**
```html
<h2>Evidence Due Tomorrow</h2>
<p>Dear {{USER_NAME}},</p>
<p>Your evidence item <strong>{{EVIDENCE_NAME}}</strong> ({{EVIDENCE_CODE}})
   is due on <strong>{{DUE_DATE}}</strong>.</p>
<p>Please submit your evidence before the deadline.</p>
<a href="{{APP_URL}}/compliance/evidence/{{EVIDENCE_ID}}">View Evidence</a>
```

**After substitution (sent to user):**
```html
<h2>Evidence Due Tomorrow</h2>
<p>Dear Sarah Chen,</p>
<p>Your evidence item <strong>Access Review Q3</strong> (EVD-0042)
   is due on <strong>July 15, 2025</strong>.</p>
<p>Please submit your evidence before the deadline.</p>
<a href="https://grc.company.com/compliance/evidence/clx9z2abc">View Evidence</a>
```

### EmailTemplate Model

```prisma
model EmailTemplate {
  id                String          @id @default(cuid())
  customerAccountId String
  customerAccount   CustomerAccount @relation(...)

  name              String          // Template identifier, e.g., "EVIDENCE_DUE_REMINDER"
  subject           String          // Email subject, may contain {{variables}}
  body              String          // HTML content with {{VARIABLE}} placeholders
  description       String?         // Human-readable description of when this fires

  isActive          Boolean         @default(true)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@unique([customerAccountId, name])
}
```

### Common Template Variables

These variables are available across many templates:

| Variable | Description |
|----------|-------------|
| `{{USER_NAME}}` | Recipient's full name |
| `{{USER_EMAIL}}` | Recipient's email address |
| `{{APP_URL}}` | Base URL of the application |
| `{{COMPANY_NAME}}` | Tenant organization name |
| `{{DUE_DATE}}` | Formatted due date |
| `{{ASSIGNED_BY}}` | Name of the person who assigned the task |
| `{{ITEM_NAME}}` | Name of the relevant record |
| `{{ITEM_CODE}}` | Reference code (e.g., EVD-0042) |
| `{{ACTION_URL}}` | Deep link to the specific record in the app |
| `{{COMMENTS}}` | Any reviewer comments or notes |

---

## All Notification Types and Triggers

### Compliance Module

| Template Name | Trigger |
|--------------|---------|
| `EVIDENCE_DUE_REMINDER` | Evidence item due date is within 24 hours |
| `EVIDENCE_ASSIGNED` | An evidence item is assigned to a user |
| `EVIDENCE_SUBMITTED` | Assignee submits evidence for review |
| `EVIDENCE_APPROVED` | Reviewer approves submitted evidence |
| `EVIDENCE_REJECTED` | Reviewer rejects submitted evidence with comments |
| `CONTROL_REVIEW_DUE` | Control periodic review date is approaching |
| `EXCEPTION_APPROVED` | Compliance exception/waiver is approved |
| `EXCEPTION_REJECTED` | Compliance exception/waiver is rejected |
| `POLICY_REVIEW_DUE` | Policy document is due for periodic review |
| `POLICY_APPROVED` | Governance policy document is approved |
| `POLICY_REJECTED` | Governance policy document is rejected |
| `KPI_BREACH` | A KPI threshold has been breached |
| `REVIEW_DUE_REMINDER` | General review deadline approaching |

### Risk Management Module

| Template Name | Trigger |
|--------------|---------|
| `RISK_ASSIGNED` | A risk is assigned to an owner |
| `RISK_ESCALATED` | A risk score exceeds escalation threshold |
| `RISK_RESPONSE_DUE` | Risk response action is approaching its due date |
| `RISK_ASSESSMENT_DUE` | Periodic risk re-assessment is scheduled |
| `RISK_CONTROL_DUE` | A planned risk control is due for implementation |

### Internal Audit Module

| Template Name | Trigger |
|--------------|---------|
| `AUDIT_ANNOUNCEMENT` | Audit engagement announcement is sent to auditees |
| `OPENING_MEETING_INVITE` | Opening meeting is scheduled; invitations sent |
| `EVIDENCE_REQUEST` | Auditor requests evidence/documents from auditee |
| `EVIDENCE_REQUEST_REMINDER` | Follow-up reminder on outstanding evidence request |
| `FINDING_RAISED` | A finding is documented and sent to auditee |
| `FINDING_RESPONSE_DUE` | Auditee's response deadline is approaching |
| `CAPA_ASSIGNED` | CAPA is assigned to responsible person |
| `CAPA_DUE_REMINDER` | CAPA action item is due within 24 hours |
| `CAPA_COMPLETED` | Responsible person marks CAPA as complete |
| `CAPA_VERIFIED` | Auditor verifies CAPA completion |
| `CLOSING_MEETING_INVITE` | Closing meeting is scheduled |
| `AUDIT_REPORT_ISSUED` | Final audit report is distributed |
| `FEEDBACK_SURVEY_INVITE` | Feedback survey is sent after report issuance |

### TPRM (Third-Party Risk Management)

| Template Name | Trigger |
|--------------|---------|
| `TPRM_ASSESSMENT_DUE` | Third-party vendor assessment is due |
| `TPRM_CONTRACT_EXPIRY` | Vendor contract is approaching expiry |
| `TPRM_REMEDIATION_DUE` | Vendor remediation action is due |
| `TPRM_ESCALATION` | Third-party risk escalation to manager |
| `TPRM_SME_REMINDER` | SME (Subject Matter Expert) review is due |

### System and Account Events

| Template Name | Trigger |
|--------------|---------|
| `USER_INVITATION` | New user is invited to the platform |
| `PASSWORD_RESET` | User requests a password reset |
| `WELCOME_EMAIL` | New user account is created and activated |
| `SUBSCRIPTION_EXPIRY` | Customer subscription is approaching expiry |
| `SUBSCRIPTION_EXPIRED` | Customer subscription has expired |
| `SUBSCRIPTION_RENEWAL` | Subscription auto-renews or is manually renewed |

### Support Module

| Template Name | Trigger |
|--------------|---------|
| `TICKET_CREATED` | A new support ticket is opened |
| `TICKET_ASSIGNED` | Ticket is assigned to an agent |
| `TICKET_REPLIED` | Agent or requester adds a reply |
| `TICKET_RESOLVED` | Ticket is marked as resolved |
| `TICKET_SLA_BREACH` | Ticket has exceeded its SLA response time |

---

## Multi-Channel Delivery

Every notification event creates both:

1. **An in-app notification record** in the `Notification` database table.
2. **An email** sent via the tenant's SMTP settings (if email is enabled and configured).

The `notificationService` in `src/lib/notification-service.ts` coordinates both channels:

```typescript
// Conceptual flow inside notificationService.sendNotification()
async function sendNotification(options: NotificationOptions) {
  // Channel 1: Always create in-app notification
  await prisma.notification.create({
    data: {
      userId: options.recipientId,
      customerAccountId: options.customerAccountId,
      title: options.title,
      message: options.message,
      type: options.type,
      entityId: options.entityId,
      entityType: options.entityType,
      isRead: false,
    }
  });

  // Channel 2: Send email if enabled
  const emailSettings = await prisma.emailSettings.findUnique({
    where: { customerAccountId: options.customerAccountId }
  });

  if (emailSettings?.emailEnabled) {
    const template = await prisma.emailTemplate.findUnique({
      where: { customerAccountId_name: {
        customerAccountId: options.customerAccountId,
        name: options.templateName
      }}
    });

    if (template) {
      const renderedBody = substitutePlaceholders(template.body, options.variables);
      const renderedSubject = substitutePlaceholders(template.subject, options.variables);
      await sendEmail(emailSettings, options.recipientEmail, renderedSubject, renderedBody);
    }
  }
}
```

### NOTIFICATION_CHANNELS Constant

```typescript
// src/lib/notification-service.ts
export const NOTIFICATION_CHANNELS = {
  INBOX: 'inbox',
  EMAIL: 'email',
  BOTH: 'both',
} as const;
```

Pass `NOTIFICATION_CHANNELS.BOTH` (the default) to deliver to both channels.

---

## The Notification Database Model

```prisma
model Notification {
  id                String          @id @default(cuid())
  customerAccountId String
  customerAccount   CustomerAccount @relation(...)

  userId            String          // The recipient user
  user              User            @relation(...)

  title             String          // Short notification headline
  message           String          // Full notification message body
  type              String          // Template name / event type
  isRead            Boolean         @default(false)

  // Link back to the source record
  entityId          String?         // ID of the related record (e.g., evidence ID)
  entityType        String?         // Type of record (e.g., "Evidence", "CAPA")
  actionUrl         String?         // Deep link to the record in the app

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
}
```

### Key Fields

- **userId** — The notification belongs to exactly one user. Each recipient in a broadcast gets their own row.
- **isRead** — `false` when first created; set to `true` when the user views it or clicks "Mark all as read".
- **entityId / entityType** — Used by the frontend to build deep links, e.g., clicking a CAPA notification navigates to that CAPA record.
- **actionUrl** — Optional pre-computed URL. If present, the notification bell panel renders it as a clickable link.
- **type** — Matches a `NOTIFICATION_CHANNELS` or template name, enabling filtering by category.

---

## In-App Notification Center

### Where It Lives in the UI

The notification center is accessible via the **bell icon** in the top-right of the header navigation bar. It is rendered by the `NotificationBell` component in `src/components/layout/`.

### Unread Count Badge

A red badge overlaid on the bell icon shows the count of unread notifications. It is fetched from:

```
GET /api/notifications/unread-count
```

Response:
```json
{ "count": 7 }
```

The badge auto-refreshes every 60 seconds using a polling interval (or on WebSocket push if configured). If `count` is 0, the badge is hidden.

### Opening the Notification Panel

Clicking the bell icon opens a slide-out drawer/panel showing:

- Each notification as a card with title, message preview, and timestamp (e.g., "3 hours ago").
- Unread notifications are highlighted with a colored left border or bold text.
- Each card links to the related record (`actionUrl`).
- A **"Mark all as read"** button at the top.

### Fetching Notifications

```
GET /api/notifications/
```

Query parameters:
- `page` — page number (default: 1)
- `limit` — items per page (default: 20)
- `unreadOnly` — if `true`, return only unread notifications

Response:
```json
{
  "notifications": [
    {
      "id": "clx9z2abc",
      "title": "Evidence Due Tomorrow",
      "message": "Access Review Q3 (EVD-0042) is due tomorrow.",
      "type": "EVIDENCE_DUE_REMINDER",
      "isRead": false,
      "entityType": "Evidence",
      "entityId": "clx7y1xyz",
      "actionUrl": "/compliance/evidence/clx7y1xyz",
      "createdAt": "2025-07-14T08:00:00.000Z"
    }
  ],
  "total": 24,
  "unreadCount": 7
}
```

### Marking Notifications as Read

**Mark a single notification as read:**
```
PATCH /api/notifications/[id]
Body: { "isRead": true }
```

**Mark all notifications as read:**
```
POST /api/notifications/read-all/
```

Response: `{ "updated": 7 }` — the number of notifications marked as read.

---

## Sending a Notification Programmatically

### Import the Service

```typescript
import { notificationService, NOTIFICATION_CHANNELS } from '@/lib/notification-service';
```

### Basic Usage

```typescript
await notificationService.sendNotification({
  customerAccountId: 'clx_tenant_id',
  recipientId: 'clx_user_id',
  recipientEmail: 'user@company.com',
  title: 'CAPA Due Tomorrow',
  message: 'Your CAPA action "Patch firewall firmware" is due tomorrow.',
  type: 'CAPA_DUE_REMINDER',
  templateName: 'CAPA_DUE_REMINDER',
  channels: NOTIFICATION_CHANNELS.BOTH,
  entityId: 'clx_capa_id',
  entityType: 'InternalAuditCAPA',
  actionUrl: '/internal-audit/capa/clx_capa_id',
  variables: {
    USER_NAME: 'John Smith',
    CAPA_TITLE: 'Patch firewall firmware',
    DUE_DATE: 'July 15, 2025',
    ACTION_URL: 'https://grc.company.com/internal-audit/capa/clx_capa_id',
  },
});
```

### Sending from a Cron Job

Cron jobs use the same `notificationService` but typically loop over multiple recipients:

```typescript
for (const capa of capasDueSoon) {
  try {
    await notificationService.sendNotification({
      customerAccountId: capa.customerAccountId,
      recipientId: capa.assigneeId,
      recipientEmail: capa.assignee.email,
      title: `CAPA Due Tomorrow: ${capa.title}`,
      message: `Your CAPA action "${capa.title}" is due tomorrow.`,
      type: 'CAPA_DUE_REMINDER',
      templateName: 'CAPA_DUE_REMINDER',
      channels: NOTIFICATION_CHANNELS.BOTH,
      entityId: capa.id,
      entityType: 'InternalAuditCAPA',
      variables: {
        USER_NAME: capa.assignee.name,
        CAPA_TITLE: capa.title,
        DUE_DATE: format(capa.dueDate, 'MMMM d, yyyy'),
        ACTION_URL: `${process.env.NEXTAUTH_URL}/internal-audit/capa/${capa.id}`,
      },
    });
    counts.capa++;
  } catch (err) {
    errors.push({ entityType: 'CAPA', entityId: capa.id, error: String(err) });
  }
}
```

---

## Adding a New Email Template

Follow these steps to add a new notification template:

### Step 1: Define the Template Name Constant

Add the new name to `src/lib/notification-types.ts` (or wherever constants are defined):

```typescript
export const NOTIFICATION_TYPES = {
  // ... existing types
  ASSET_REVIEW_DUE: 'ASSET_REVIEW_DUE',
} as const;
```

### Step 2: Create the Template in the Database Seed

Add to `prisma/seed.ts` in the email templates section:

```typescript
await prisma.emailTemplate.upsert({
  where: { customerAccountId_name: { customerAccountId, name: 'ASSET_REVIEW_DUE' } },
  update: {},
  create: {
    customerAccountId,
    name: 'ASSET_REVIEW_DUE',
    subject: 'Asset Review Due: {{ASSET_NAME}}',
    description: 'Sent when an asset review is due within 24 hours',
    body: `
      <h2>Asset Review Due Tomorrow</h2>
      <p>Dear {{USER_NAME}},</p>
      <p>The asset <strong>{{ASSET_NAME}}</strong> ({{ASSET_CODE}}) is scheduled
         for review on <strong>{{DUE_DATE}}</strong>.</p>
      <p>Please complete the review before the deadline.</p>
      <p><a href="{{ACTION_URL}}">Review Asset</a></p>
    `,
  },
});
```

### Step 3: Call the Notification Service

In the relevant API route or cron job:

```typescript
await notificationService.sendNotification({
  customerAccountId: asset.customerAccountId,
  recipientId: asset.reviewerId,
  recipientEmail: asset.reviewer.email,
  title: `Asset Review Due: ${asset.name}`,
  message: `Asset ${asset.name} is due for review tomorrow.`,
  type: 'ASSET_REVIEW_DUE',
  templateName: 'ASSET_REVIEW_DUE',
  channels: NOTIFICATION_CHANNELS.BOTH,
  entityId: asset.id,
  entityType: 'Asset',
  variables: {
    USER_NAME: asset.reviewer.name,
    ASSET_NAME: asset.name,
    ASSET_CODE: asset.code,
    DUE_DATE: format(asset.nextReviewDate, 'MMMM d, yyyy'),
    ACTION_URL: `${process.env.NEXTAUTH_URL}/assets/${asset.id}`,
  },
});
```

### Step 4: Test

1. Run `npm run db:seed` to insert the new template into the database.
2. Trigger the notification manually via a test API call or the admin test button.
3. Verify both the in-app notification and email are received.

---

## Testing Email Configuration

### Using the Admin Test Button

The Email Settings page has a **"Send Test Email"** button. Clicking it:

1. Sends a test email to the logged-in administrator's email address.
2. Shows a green success toast if the email was accepted by the SMTP server.
3. Shows a red error toast with the error message if the connection failed.

### Testing via API

```bash
curl -X POST http://localhost:3000/api/admin/email/test \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_COOKIE" \
  -d '{"to": "you@example.com"}'
```

### Testing Cron-Triggered Emails Locally

```bash
# Trigger the due-reminders cron manually (no auth required in dev)
curl http://localhost:3000/api/cron/due-reminders

# Check the response for counts and errors
# { "success": true, "counts": { "evidence": 2, "capa": 1 }, "errors": [] }
```

### Using Mailhog for Local Development

For local testing without sending real emails, install Mailhog:

```bash
# macOS
brew install mailhog
mailhog  # starts SMTP on localhost:1025, web UI on localhost:8025

# Docker
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

Configure `EmailSettings` with:
- SMTP Host: `localhost`
- Port: `1025`
- Username / Password: leave blank
- TLS: disabled

All emails sent in development will appear in the Mailhog web UI at `http://localhost:8025`.

---

## Common Email Errors and Fixes

### Error: "Invalid login: 535 Authentication failed"

**Cause:** Wrong SMTP username or password.

**Fix:**
- Double-check the username and password in Email Settings.
- For Gmail: you must use an **App Password**, not your regular Google password. Go to `myaccount.google.com → Security → App passwords`.
- For Microsoft 365: ensure the account has SMTP AUTH enabled. Go to `admin.microsoft.com → Users → [user] → Mail → Manage email apps → SMTP AUTH`.

### Error: "Connection timeout" or "ECONNREFUSED"

**Cause:** Cannot reach the SMTP server. Usually a firewall, wrong hostname, or wrong port.

**Fix:**
1. Verify the hostname is correct (e.g., `smtp.office365.com`, not `mail.office365.com`).
2. Try port `465` if `587` does not work.
3. Check that outbound connections on that port are allowed by your server's firewall.
4. Confirm the SMTP server is online by testing with `telnet smtp.office365.com 587`.

### Error: "self-signed certificate in certificate chain"

**Cause:** The SMTP server is using a self-signed or internal CA certificate that Node.js does not trust.

**Fix (development only):**
```typescript
const transporter = nodemailer.createTransport({
  host: emailSettings.smtpHost,
  port: emailSettings.smtpPort,
  tls: { rejectUnauthorized: false }  // Only for dev/internal servers
});
```

**Fix (production):** Install the correct CA certificate on the server, or use a publicly trusted TLS certificate on the mail server.

### Error: "Message rejected: Domain not verified"

**Cause:** When using Amazon SES or SendGrid, you must verify the sending domain before you can send email.

**Fix:** Go to your email provider's dashboard (SES console, SendGrid settings) and verify the domain `yourcompany.com` by adding the required DNS TXT/CNAME records.

### Error: Emails Delivered to Spam

**Cause:** Missing SPF, DKIM, or DMARC DNS records on the sending domain.

**Fix:** Add the following DNS records for `yourcompany.com`:
- **SPF:** `v=spf1 include:mail.yourcompany.com ~all`
- **DKIM:** Enable in your mail server and add the public key as a DNS TXT record.
- **DMARC:** `v=DMARC1; p=none; rua=mailto:dmarc@yourcompany.com`

### Error: "Too many connections" or Rate Limiting

**Cause:** Sending too many emails too fast; the SMTP server is throttling connections.

**Fix:** Add a small delay between bulk sends, or use a transactional email service (SendGrid, SES) with higher rate limits. For cron jobs, the built-in `try/catch` per email prevents a single rate-limit error from stopping the entire batch.

### In-App Notifications Work But No Email Is Received

**Cause:** Email is disabled at the tenant level, or SMTP settings are not configured.

**Check:**
1. Go to Admin → Settings → Email Configuration.
2. Confirm the "Email Notifications Enabled" toggle is on.
3. Confirm SMTP settings are filled in.
4. Use the "Send Test Email" button to verify the connection works.
5. Check `CustomerAccount.emailNotificationsEnabled` in the database — if it is `false`, emails are suppressed globally for that tenant.

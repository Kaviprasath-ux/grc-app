/**
 * Generate Word Document: Email Notification Module Documentation
 * Run: npx tsx scripts/generate-email-notification-doc.ts
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType,
} from "docx";
import * as fs from "fs";
import * as path from "path";

const BLUE = "1a56db";
const GRAY = "6b7280";
const LIGHT_BG = "f1f5f9";

function heading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 100 }, children: [new TextRun({ text, bold: true, color: level === HeadingLevel.HEADING_1 ? BLUE : "1e293b" })] });
}

function para(text: string, opts?: { bold?: boolean; italic?: boolean; color?: string; spacing?: number }) {
  return new Paragraph({
    spacing: { after: opts?.spacing ?? 120 },
    children: [new TextRun({ text, bold: opts?.bold, italics: opts?.italic, color: opts?.color, size: 22, font: "Calibri" })],
  });
}

function bullet(text: string, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, font: "Calibri" })],
  });
}

function headerCell(text: string) {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: BLUE },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "ffffff", size: 20, font: "Calibri" })] })],
    width: { size: 25, type: WidthType.PERCENTAGE },
  });
}

function cell(text: string, width = 25) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: "Calibri" })] })],
    width: { size: width, type: WidthType.PERCENTAGE },
  });
}

function makeTable(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "d1d5db" },
    },
    rows: [
      new TableRow({ children: headers.map((h) => headerCell(h)) }),
      ...rows.map((row) => new TableRow({ children: row.map((c) => cell(c, Math.floor(100 / headers.length))) })),
    ],
  });
}

async function generate() {
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [{
      properties: {},
      children: [
        // ── TITLE ──
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: "Email & Notification Module", bold: true, size: 36, color: BLUE, font: "Calibri" }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({ text: "Technical Documentation", bold: true, size: 28, color: "475569", font: "Calibri" }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({ text: "GRC Application — Baarez Technologies", size: 22, color: GRAY, font: "Calibri" }),
          ],
        }),

        // ── 1. OVERVIEW ──
        heading("1. Overview"),
        para("The GRC application includes a comprehensive, multi-channel notification system that delivers both in-app (inbox) and email notifications to users. The system is designed for multi-tenant isolation, role-based access, and graceful degradation when email services are unavailable."),
        para("Key Capabilities:", { bold: true }),
        bullet("Dual-channel delivery: In-App Inbox + Email"),
        bullet("150+ pre-defined notification event types across all modules"),
        bullet("Database-driven email templates with placeholder substitution"),
        bullet("Global SMTP configuration managed by GRC Administrator"),
        bullet("Per-customer email notification toggle"),
        bullet("Scheduled due-date reminders via cron jobs"),
        bullet("Self-notification prevention (actors don't receive their own notifications)"),
        bullet("Notification preferences per user (in-app and email toggles)"),

        // ── 2. ARCHITECTURE ──
        heading("2. System Architecture"),
        para("The notification system follows a layered architecture:"),
        heading("2.1 Flow Diagram", HeadingLevel.HEADING_2),
        para("User Action → API Route Handler → NotificationService.sendBulk() → Multi-Channel Router", { italic: true, color: GRAY }),
        bullet("INBOX Channel: Creates Notification record in database → Appears in bell dropdown & notifications page"),
        bullet("EMAIL Channel: Maps event to template → Fetches template from DB → Replaces placeholders → Sends via nodemailer/SMTP"),

        heading("2.2 Key Files", HeadingLevel.HEADING_2),
        makeTable(
          ["File", "Purpose"],
          [
            ["src/lib/email-service.ts", "SMTP configuration, sendEmail(), sendTemplatedEmail(), placeholder system"],
            ["src/lib/notification-service.ts", "NotificationService class with send(), sendBulk(), 50+ convenience methods, channel routing"],
            ["src/lib/notification-constants.ts", "NOTIFICATION_EVENTS (150+), NOTIFICATION_CHANNELS, NOTIFICATION_PRIORITIES"],
            ["src/hooks/useNotifications.ts", "Frontend hook for fetching, polling, and managing notifications"],
            ["src/components/layout/header.tsx", "Notification bell icon with unread badge and dropdown"],
            ["src/app/api/notifications/", "CRUD API for notifications (list, mark read, delete)"],
            ["src/app/api/cron/due-reminders/", "Scheduled cron job for due-date reminder notifications"],
          ],
        ),

        // ── 3. SMTP CONFIGURATION ──
        heading("3. SMTP Configuration"),
        para("Email delivery uses a global SMTP configuration stored in the EmailSettings database model. Only the GRC Administrator can configure and test SMTP settings."),
        heading("3.1 EmailSettings Model", HeadingLevel.HEADING_2),
        makeTable(
          ["Field", "Type", "Description"],
          [
            ["smtpHost", "String", "SMTP server hostname (e.g., smtp.gmail.com)"],
            ["smtpPort", "Int (default: 587)", "SMTP port (587 for TLS, 465 for SSL)"],
            ["smtpUser", "String", "SMTP authentication username"],
            ["smtpPassword", "String", "SMTP password (masked in API responses)"],
            ["fromAddress", "String", "Sender email address"],
            ["fromName", "String?", "Display name for sender"],
            ["replyToAddress", "String?", "Reply-to email address"],
            ["useTLS", "Boolean", "Enable STARTTLS encryption"],
            ["useSSL", "Boolean", "Enable SSL encryption (port 465)"],
            ["isActive", "Boolean", "Enable/disable email sending globally"],
            ["isVerified", "Boolean", "Set to true after successful test"],
            ["lastTestedAt", "DateTime?", "Timestamp of last SMTP test"],
            ["lastTestResult", "String?", "Result message from last test"],
          ],
        ),
        heading("3.2 Pre-configured Providers", HeadingLevel.HEADING_2),
        para("The Email Settings UI provides quick-select presets for common providers:"),
        makeTable(
          ["Provider", "Host", "Port", "Encryption"],
          [
            ["Gmail", "smtp.gmail.com", "587", "TLS"],
            ["Office 365", "smtp.office365.com", "587", "TLS"],
            ["Outlook", "smtp-mail.outlook.com", "587", "TLS"],
            ["SendGrid", "smtp.sendgrid.net", "587", "TLS"],
            ["Mailgun", "smtp.mailgun.org", "587", "TLS"],
            ["AWS SES", "email-smtp.us-east-1.amazonaws.com", "587", "TLS"],
          ],
        ),
        heading("3.3 API Endpoints", HeadingLevel.HEADING_2),
        makeTable(
          ["Method", "Endpoint", "Description"],
          [
            ["GET", "/api/grc/email-settings", "Retrieve SMTP settings (password masked)"],
            ["POST", "/api/grc/email-settings", "Create or update SMTP settings"],
            ["DELETE", "/api/grc/email-settings", "Remove SMTP configuration"],
            ["POST", "/api/grc/email-settings/test", "Test SMTP connection and optionally send test email"],
          ],
        ),

        // ── 4. EMAIL TEMPLATES ──
        heading("4. Email Templates"),
        para("Email templates are stored in the database and managed by the GRC Administrator. Each template has a unique code that maps to a notification event type."),
        heading("4.1 EmailTemplate Model", HeadingLevel.HEADING_2),
        makeTable(
          ["Field", "Type", "Description"],
          [
            ["code", "String (unique)", "Template identifier matching notification event (e.g., EVIDENCE_ASSIGNED)"],
            ["name", "String", "Human-readable template name"],
            ["subject", "String", "Email subject line with {placeholders}"],
            ["bodyHtml", "Text", "HTML email body with {placeholders}"],
            ["bodyText", "Text?", "Plain text fallback"],
            ["placeholders", "Text?", "JSON array of available placeholder names"],
            ["category", "String", "notification, reminder, system, or custom"],
            ["module", "String", "grc or tprm"],
            ["isSystem", "Boolean", "System templates cannot be deleted"],
            ["isActive", "Boolean", "Inactive templates are skipped"],
          ],
        ),
        heading("4.2 Placeholder System", HeadingLevel.HEADING_2),
        para("Templates use {placeholderName} syntax for dynamic content substitution. The following default placeholders are available in every template:"),
        makeTable(
          ["Placeholder", "Description", "Example Value"],
          [
            ["{recipientName}", "Name of the notification recipient", "John Smith"],
            ["{recipientEmail}", "Email of the recipient", "john@example.com"],
            ["{appName}", "Application name", "GRC Platform"],
            ["{appUrl}", "Application URL", "https://grc-app.vercel.app"],
            ["{currentDate}", "Current date", "March 17, 2026"],
            ["{currentYear}", "Current year", "2026"],
            ["{entityName}", "Name of the related entity", "SOC 2 Evidence Q1"],
            ["{entityLink}", "Direct link to the entity", "/compliance/evidence/abc123"],
            ["{actorName}", "Name of the user who triggered the action", "Jane Admin"],
          ],
        ),
        heading("4.3 Template Management UI", HeadingLevel.HEADING_2),
        para("The Email Templates page (accessible to GRC Administrator) provides:"),
        bullet("Create, edit, and delete templates"),
        bullet("Live preview with placeholder substitution"),
        bullet("Category and module filtering (GRC vs TPRM)"),
        bullet("Import/Export templates as JSON for backup"),
        bullet("Bulk delete and re-seed from defaults"),
        bullet("System template protection (read-only, cannot be deleted)"),

        // ── 5. NOTIFICATION SERVICE ──
        heading("5. Notification Service"),
        para("The NotificationService class (singleton) handles all notification delivery. It provides both low-level send/sendBulk methods and 50+ pre-built convenience methods for common scenarios."),
        heading("5.1 Core Methods", HeadingLevel.HEADING_2),
        makeTable(
          ["Method", "Description"],
          [
            ["send(payload)", "Send a single notification to one recipient (both INBOX + EMAIL)"],
            ["sendBulk(payload)", "Send notifications to multiple recipients. Filters out the actor automatically."],
            ["sendEmailNotification(payload)", "Internal: sends email via template. Checks customer emailNotificationsEnabled flag."],
            ["getEmailTemplateCode(event)", "Maps a NotificationEvent to its email template code."],
          ],
        ),
        heading("5.2 Channel Routing", HeadingLevel.HEADING_2),
        para("By default, every notification is delivered to both channels:"),
        bullet("INBOX: Creates a Notification record in the database. Appears in the bell icon dropdown and the /notifications page."),
        bullet("EMAIL: Looks up the email template by event code, builds placeholders, and sends via SMTP. If customer has emailNotificationsEnabled=false, email is silently skipped."),

        heading("5.3 Convenience Methods (by Module)", HeadingLevel.HEADING_2),
        makeTable(
          ["Module", "Methods", "Examples"],
          [
            ["Evidence", "notifyEvidenceAssigned, notifyEvidenceSubmitted", "When evidence is assigned to a user or submitted for review"],
            ["Risk", "notifyRiskAssigned, notifyRiskApproved", "When a risk is assigned or approved"],
            ["Governance", "notifyGovernanceApproved, notifyPolicyAssigned", "Policy approvals and assignments"],
            ["Internal Audit", "notifyAuditCreated, notifyFindingsCreated, notifyWorkpaperSubmitted", "Audit lifecycle events"],
            ["TPRM", "notifyTPRMAssessmentInitiated, notifyTPRMMonitoringScanCompleted, notifyTPRMContractDeletionRequested", "TPRM assessment and monitoring events"],
            ["Workflow", "notifyApprovalRequested, notifyApprovalGranted, notifyCommentAdded", "Cross-module workflow events"],
            ["Reminders", "notifyDueReminder, notifyEscalation", "Scheduled due-date and escalation reminders"],
          ],
        ),

        // ── 6. NOTIFICATION EVENTS ──
        heading("6. Notification Events"),
        para("The system defines 150+ notification events organized by module. Each event maps to an email template code for the EMAIL channel."),
        makeTable(
          ["Category", "Count", "Key Events"],
          [
            ["Internal Audit", "23", "AUDIT_CREATED, FINDINGS_COMPLETED, AUDIT_PLAN_APPROVAL, WORKPAPER_SUBMITTED, INTERVIEW_SCHEDULED, PERIODICITY_INITIATED, REPORT_PUBLISHED"],
            ["Evidence", "3", "EVIDENCE_ASSIGNED, EVIDENCE_SUBMITTED, EVIDENCE_PUBLISHED"],
            ["Governance & Policy", "7", "GOVERNANCE_APPROVED, GOVERNANCE_ASSIGNED, GOVERNANCE_PUBLISHED, POLICY_ASSIGNED, RESEND_POLICY"],
            ["Process Management", "5", "PROCESS_CREATED, PROCESS_ASSIGNED, PROCESS_APPROVED, PROCESS_REJECTION"],
            ["Risk Management", "5", "RISK_CREATED, RISK_ASSIGNED, RISK_APPROVED, RISK_SUBMIT_FOR_APPROVAL"],
            ["Control Management", "3", "CONTROL_ASSIGNED, CONTROL_COMPLIANT, ASSESSMENT_COMPLETED"],
            ["Asset Management", "1", "ASSET_ASSIGNED"],
            ["Exception Management", "8", "EXCEPTION_ASSIGNED, EXCEPTION_AUTHORIZED, EXCEPTION_APPROVED, EXCEPTION_CLOSED"],
            ["Issue/Finding Tracking", "7", "ISSUE_CREATED, ISSUE_RESOLVED, ISSUE_ESCALATED, ISSUE_EVIDENCE"],
            ["KPI", "2", "KPI_UPDATED, KPI_SCORE_UPDATED"],
            ["User & System", "3", "USER_CREATED, CUSTOMER_ONBOARDED, SYSTEM_ANNOUNCEMENT"],
            ["Workflow", "7", "COMMENT_ADDED, APPROVAL_REQUESTED, APPROVAL_GRANTED, APPROVAL_DENIED, SENT_BACK, STATUS_CHANGED"],
            ["Reminders", "4", "EVIDENCE_DUE_REMINDER, CAPA_DUE_REMINDER, REVIEW_DUE_REMINDER, CLARIFICATION_REMINDER"],
            ["Escalations", "3", "ESCALATE_FIELDWORK_RESPONSE, ESCALATE_CLARIFICATION, ESCALATE_ACKNOWLEDGMENT"],
            ["TPRM", "61+", "Assessment lifecycle, vendor onboarding, monitoring scans, remediation, contract deletion, offboarding, clarifications"],
          ],
        ),

        // ── 7. DATABASE MODELS ──
        heading("7. Database Models"),
        heading("7.1 Notification", HeadingLevel.HEADING_2),
        makeTable(
          ["Field", "Type", "Description"],
          [
            ["id", "String (CUID)", "Primary key"],
            ["customerAccountId", "String", "Multi-tenant isolation"],
            ["userId", "String", "Recipient user ID"],
            ["type", "String", "Notification event type"],
            ["title", "String", "Short notification title"],
            ["message", "Text", "Detailed notification message"],
            ["relatedEntityType", "String?", "Entity type (evidence, risk, audit, etc.)"],
            ["relatedEntityId", "String?", "Related entity ID"],
            ["link", "String?", "Navigation URL when clicked"],
            ["priority", "String", "low, normal, high, or urgent"],
            ["isRead", "Boolean", "Read/unread status"],
            ["readAt", "DateTime?", "When notification was read"],
            ["metadata", "Text?", "JSON for additional data"],
          ],
        ),
        heading("7.2 NotificationPreference", HeadingLevel.HEADING_2),
        para("Per-user settings for notification opt-in/opt-out:"),
        makeTable(
          ["Field", "Type", "Description"],
          [
            ["userId", "String", "User ID"],
            ["notificationType", "String", "Event type or 'ALL'"],
            ["inAppEnabled", "Boolean", "Toggle in-app notifications"],
            ["emailEnabled", "Boolean", "Toggle email notifications"],
            ["emailFrequency", "String", "immediate, daily_digest, or weekly_digest"],
          ],
        ),

        // ── 8. FRONTEND ──
        heading("8. Frontend Components"),
        heading("8.1 Notification Bell (Header)", HeadingLevel.HEADING_2),
        bullet("Bell icon with red unread count badge (shows '99+' if > 99)"),
        bullet("Dropdown showing latest 10 notifications"),
        bullet("Click notification to navigate and auto-mark as read"),
        bullet("'Mark all read' and 'View all' action buttons"),
        bullet("60-second polling interval for real-time updates"),

        heading("8.2 Notifications Page (/notifications)", HeadingLevel.HEADING_2),
        bullet("Paginated list (20 per page) with All/Unread filter"),
        bullet("Color-coded icons by notification type (clock for reminders, user for assignments, check for approvals)"),
        bullet("Relative timestamps ('2 hours ago')"),
        bullet("Mark as read / Delete individual notifications"),

        heading("8.3 useNotifications Hook", HeadingLevel.HEADING_2),
        para("The frontend hook provides:"),
        bullet("notifications — paginated notification list"),
        bullet("unreadCount — badge count"),
        bullet("markAsRead(id) — mark single notification read"),
        bullet("markAllAsRead() — mark all as read"),
        bullet("deleteNotification(id) — remove notification"),
        bullet("refresh() — manual refresh trigger"),

        // ── 9. SCHEDULED REMINDERS ──
        heading("9. Scheduled Reminders (Cron Job)"),
        para("The /api/cron/due-reminders endpoint runs daily at 8:00 AM UTC (configured in vercel.json). It sends notifications for items due within the next 24 hours."),
        makeTable(
          ["Reminder Type", "Source", "Recipients", "Event"],
          [
            ["Evidence Due", "Evidence with dueDate tomorrow", "Assignee", "EVIDENCE_DUE_REMINDER"],
            ["CAPA/Finding Due", "Findings with targetDate tomorrow", "Responsible person or auditee", "CAPA_DUE_REMINDER"],
            ["Policy Review Due", "Policies with reviewDate tomorrow", "Assignee", "REVIEW_DUE_REMINDER"],
            ["TPRM Remediation Overdue", "Issues with dueDate < today", "Assessor, AM, Business Owners", "TPRM_REMEDIATION_OVERDUE"],
            ["TPRM Contract Expiry", "Contracts expiring today/tomorrow", "AM, Business Owners", "TPRM_CONTRACT_EXPIRY"],
            ["TPRM Assessment Due", "Assessments with dueDate tomorrow", "Assessor, AM, Business Owners", "TPRM_ASSESSMENT_DUE_REMINDER"],
          ],
        ),
        para("Security: In production, the endpoint requires a Bearer token (CRON_SECRET environment variable). In development, no authentication is required."),

        // ── 10. MULTI-TENANT ISOLATION ──
        heading("10. Multi-Tenant Isolation"),
        bullet("Every notification includes customerAccountId for strict tenant isolation"),
        bullet("Users can only view their own notifications within their customer account"),
        bullet("Email notifications respect per-customer emailNotificationsEnabled flag"),
        bullet("SMTP settings are global (shared across all tenants) — managed by GRC Administrator"),
        bullet("Email templates are global but can be filtered by module (GRC vs TPRM)"),

        // ── 11. GRACEFUL DEGRADATION ──
        heading("11. Error Handling & Graceful Degradation"),
        bullet("If SMTP is not configured: email channel silently skips, inbox notifications still work"),
        bullet("If customer has emailNotificationsEnabled=false: email skipped, no error"),
        bullet("If email template not found: falls back to GENERIC_NOTIFICATION template"),
        bullet("If notification table doesn't exist: API returns empty array (no crash)"),
        bullet("Individual cron reminder failures are caught and logged — don't break the batch"),
        bullet("Self-notification prevention: actors never receive notifications about their own actions"),

        // ── 12. SECURITY ──
        heading("12. Security Considerations"),
        bullet("SMTP passwords are never exposed in API responses (masked as '********')"),
        bullet("Email settings API restricted to GRCAdministrator role"),
        bullet("Notification API endpoints use tenant filtering (users see only their own data)"),
        bullet("Cron endpoint protected by CRON_SECRET Bearer token in production"),
        bullet("Template code injection prevented by placeholder-only substitution (no eval/exec)"),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(process.cwd(), "Email_Notification_Module_Documentation.docx");
  fs.writeFileSync(outPath, buffer);
  console.log(`Document generated: ${outPath}`);
}

generate().catch(console.error);

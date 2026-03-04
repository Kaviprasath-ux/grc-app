/**
 * Seed Email Templates
 *
 * This script seeds all 73 English email templates based on VerifAI UAT system.
 * Run with: npx tsx prisma/seed-email-templates.ts
 *
 * Templates are organized by category:
 * - Internal Audit (22 templates)
 * - Evidence Management (4 templates)
 * - Governance & Policy (8 templates)
 * - Risk Management (4 templates)
 * - Control Management (3 templates)
 * - Exception Management (8 templates)
 * - Issue/Finding Tracking (7 templates)
 * - Planned Actions (4 templates)
 * - KPI (2 templates)
 * - User & System (2 templates)
 * - Reminders & Escalations (6 templates)
 * - General Workflow (3 templates)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// HTML Email Template Base Styles
const emailStyles = {
  container: 'font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;',
  header: (color: string) => `color: ${color}; margin-bottom: 20px;`,
  paragraph: 'margin: 10px 0; line-height: 1.6;',
  table: 'width: 100%; border-collapse: collapse; margin: 15px 0;',
  tableRow: 'padding: 10px; border: 1px solid #ddd;',
  tableHeader: 'padding: 10px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold; width: 35%;',
  tableCell: 'padding: 10px; border: 1px solid #ddd;',
  button: (color: string) => `background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px;`,
  signature: 'margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;',
};

// Color scheme
const colors = {
  primary: '#1e40af',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
  info: '#0891b2',
};

// Helper to create consistent HTML email template
function createEmailHtml(
  title: string,
  color: string,
  body: string,
  buttonText?: string
): string {
  return `<div style="${emailStyles.container}">
  <h2 style="${emailStyles.header(color)}">${title}</h2>
  ${body}
  ${buttonText ? `<p><a href="{entityLink}" style="${emailStyles.button(color)}">${buttonText}</a></p>` : ''}
  <div style="${emailStyles.signature}">
    <p style="margin: 0;">Best regards,</p>
    <p style="margin: 5px 0 0 0;"><strong>GRC Platform Team</strong></p>
  </div>
</div>`;
}

// Helper to create table row
function tableRow(label: string, value: string, highlight = false): string {
  const cellStyle = highlight
    ? `${emailStyles.tableCell} color: ${colors.danger}; font-weight: bold;`
    : emailStyles.tableCell;
  return `<tr><td style="${emailStyles.tableHeader}">${label}</td><td style="${cellStyle}">${value}</td></tr>`;
}

// ==================== EMAIL TEMPLATES ====================

const EMAIL_TEMPLATES = [
  // ===================== INTERNAL AUDIT =====================
  {
    code: 'AUDIT_CREATED',
    name: 'Audit Creation',
    description: 'Sent when a new audit is created and assigned',
    category: 'audit',
    subject: 'Internal Audit Notification – Upcoming Audit: {auditName}',
    bodyHtml: createEmailHtml(
      'Internal Audit Notification',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">This is to inform you that the Internal Audit team will be conducting an audit for <strong>{departmentName}</strong> as part of the audit plan.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Audit Period', '{startDate} – {endDate}')}
        ${tableRow('Scope', '{description}')}
        ${tableRow('Auditee Assigned', '{auditeeName}')}
      </table>
      <p style="${emailStyles.paragraph}">We request your cooperation in providing the necessary information and support during this engagement. A detailed schedule and document request list will follow shortly.</p>`,
      'View Audit Details'
    ),
    bodyText: `Dear {recipientName},

This is to inform you that the Internal Audit team will be conducting an audit for {departmentName} as part of the audit plan.

Audit Period: {startDate} – {endDate}
Scope: {description}
Auditee Assigned: {auditeeName}

We request your cooperation in providing the necessary information and support during this engagement.

View Audit Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditName', 'departmentName', 'startDate', 'endDate', 'description', 'auditeeName', 'entityLink']),
    module: "grc",
  },
  {
    code: 'FINDINGS_CREATED',
    name: 'Findings Creation',
    description: 'Sent when audit findings are created',
    category: 'audit',
    subject: 'Audit Findings Notification – {auditName}',
    bodyHtml: createEmailHtml(
      'Audit Findings Notification',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Findings have been documented as part of the audit: <strong>{auditName}</strong>.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Audit Name', '{auditName}')}
        ${tableRow('Finding Title', '{findingTitle}')}
        ${tableRow('Severity', '{severity}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the findings and provide your response within the specified timeline.</p>`,
      'View Findings'
    ),
    bodyText: `Dear {recipientName},

Findings have been documented as part of the audit: {auditName}.

Audit Name: {auditName}
Finding Title: {findingTitle}
Severity: {severity}

Please review the findings and provide your response within the specified timeline.

View Findings: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditName', 'findingTitle', 'severity', 'entityLink']),
    module: "grc",
  },
  {
    code: 'FINDINGS_COMPLETED',
    name: 'Findings Completed',
    description: 'Sent when audit findings are closed/completed',
    category: 'audit',
    subject: 'Audit Finding Closure Confirmation – {auditName}',
    bodyHtml: createEmailHtml(
      'Finding Closure Confirmation',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following audit finding has been closed:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Audit Name', '{auditName}')}
        ${tableRow('Finding Title', '{findingTitle}')}
        ${tableRow('Status', 'Closed')}
        ${tableRow('Closed Date', '{closedDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Thank you for your cooperation in resolving this finding.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The following audit finding has been closed:

Audit Name: {auditName}
Finding Title: {findingTitle}
Status: Closed
Closed Date: {closedDate}

Thank you for your cooperation in resolving this finding.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditName', 'findingTitle', 'closedDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'AUDIT_PLAN_CREATED',
    name: 'Audit Plan Created',
    description: 'Sent when an audit plan is created',
    category: 'audit',
    subject: 'Audit Plan Created: {auditPlanName}',
    bodyHtml: createEmailHtml(
      'Audit Plan Created',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A new audit plan has been created:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Plan Name', '{auditPlanName}')}
        ${tableRow('Period', '{startDate} – {endDate}')}
        ${tableRow('Created By', '{createdBy}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the audit plan and schedule accordingly.</p>`,
      'View Audit Plan'
    ),
    bodyText: `Dear {recipientName},

A new audit plan has been created:

Plan Name: {auditPlanName}
Period: {startDate} – {endDate}
Created By: {createdBy}

Please review the audit plan and schedule accordingly.

View Audit Plan: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditPlanName', 'startDate', 'endDate', 'createdBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'AUDIT_PLAN_SCHEDULED',
    name: 'Audit Plan Scheduled',
    description: 'Sent when an audit plan is scheduled',
    category: 'audit',
    subject: 'Audit Plan Scheduled: {auditPlanName}',
    bodyHtml: createEmailHtml(
      'Audit Plan Scheduled',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following audit plan has been scheduled:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Plan Name', '{auditPlanName}')}
        ${tableRow('Scheduled Date', '{scheduledDate}')}
        ${tableRow('Department', '{departmentName}')}
      </table>
      <p style="${emailStyles.paragraph}">Please ensure all preparations are completed before the scheduled date.</p>`,
      'View Schedule'
    ),
    bodyText: `Dear {recipientName},

The following audit plan has been scheduled:

Plan Name: {auditPlanName}
Scheduled Date: {scheduledDate}
Department: {departmentName}

Please ensure all preparations are completed before the scheduled date.

View Schedule: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditPlanName', 'scheduledDate', 'departmentName', 'entityLink']),
    module: "grc",
  },
  {
    code: 'AUDIT_PLAN_APPROVAL',
    name: 'Audit Plan Approval Required',
    description: 'Sent when audit plan approval is required',
    category: 'audit',
    subject: 'AuditPlan Approval Required: {auditPlanName}',
    bodyHtml: createEmailHtml(
      'Audit Plan Approval Required',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Your approval is required for the following audit plan:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Plan Name', '{auditPlanName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
        ${tableRow('Period', '{startDate} – {endDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and approve the audit plan at your earliest convenience.</p>`,
      'Review & Approve'
    ),
    bodyText: `Dear {recipientName},

Your approval is required for the following audit plan:

Plan Name: {auditPlanName}
Submitted By: {submittedBy}
Period: {startDate} – {endDate}

Please review and approve the audit plan at your earliest convenience.

Review & Approve: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditPlanName', 'submittedBy', 'startDate', 'endDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'AUDIT_PLAN_ACKNOWLEDGED',
    name: 'Audit Plan Acknowledged',
    description: 'Sent when audit plan is acknowledged',
    category: 'audit',
    subject: 'Audit Plan Acknowledged: {auditPlanName}',
    bodyHtml: createEmailHtml(
      'Audit Plan Acknowledged',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The audit plan has been acknowledged:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Plan Name', '{auditPlanName}')}
        ${tableRow('Acknowledged By', '{acknowledgedBy}')}
        ${tableRow('Date', '{acknowledgedDate}')}
      </table>
      <p style="${emailStyles.paragraph}">The audit will proceed as scheduled.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The audit plan has been acknowledged:

Plan Name: {auditPlanName}
Acknowledged By: {acknowledgedBy}
Date: {acknowledgedDate}

The audit will proceed as scheduled.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditPlanName', 'acknowledgedBy', 'acknowledgedDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'AUDIT_PLAN_SUBMIT_FOR_ACKNOWLEDGEMENT',
    name: 'Audit Plan Submit for Acknowledgement',
    description: 'Sent when audit plan is submitted for acknowledgement',
    category: 'audit',
    subject: 'Audit Plan Acknowledgement Required: {auditPlanName}',
    bodyHtml: createEmailHtml(
      'Audit Plan Acknowledgement Required',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following audit plan requires your acknowledgement:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Plan Name', '{auditPlanName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
        ${tableRow('Scheduled Period', '{startDate} – {endDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please acknowledge the audit plan to confirm your participation.</p>`,
      'Acknowledge Plan'
    ),
    bodyText: `Dear {recipientName},

The following audit plan requires your acknowledgement:

Plan Name: {auditPlanName}
Submitted By: {submittedBy}
Scheduled Period: {startDate} – {endDate}

Please acknowledge the audit plan to confirm your participation.

Acknowledge Plan: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditPlanName', 'submittedBy', 'startDate', 'endDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'WORKPAPER_SUBMITTED',
    name: 'Workpaper Submitted',
    description: 'Sent when a workpaper is submitted',
    category: 'audit',
    subject: 'Workpaper Submitted: {workpaperName}',
    bodyHtml: createEmailHtml(
      'Workpaper Submitted',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A workpaper has been submitted for your review:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Workpaper', '{workpaperName}')}
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the submitted workpaper.</p>`,
      'Review Workpaper'
    ),
    bodyText: `Dear {recipientName},

A workpaper has been submitted for your review:

Workpaper: {workpaperName}
Audit: {auditName}
Submitted By: {submittedBy}

Please review the submitted workpaper.

Review Workpaper: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'workpaperName', 'auditName', 'submittedBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'PROCEDURE_ASSIGNED',
    name: 'Procedure Assigned',
    description: 'Sent when a test procedure is assigned',
    category: 'audit',
    subject: 'Procedure Assigned: {procedureName}',
    bodyHtml: createEmailHtml(
      'Test Procedure Assigned',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A test procedure has been assigned to you:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Procedure', '{procedureName}')}
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Due Date', '{dueDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please complete the assigned procedure within the specified timeline.</p>`,
      'View Procedure'
    ),
    bodyText: `Dear {recipientName},

A test procedure has been assigned to you:

Procedure: {procedureName}
Audit: {auditName}
Due Date: {dueDate}

Please complete the assigned procedure within the specified timeline.

View Procedure: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'procedureName', 'auditName', 'dueDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'QUESTION_DELEGATED',
    name: 'Question Delegated',
    description: 'Sent when a question is delegated to another user',
    category: 'audit',
    subject: 'Question Delegated: {questionTitle}',
    bodyHtml: createEmailHtml(
      'Question Delegated to You',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A question has been delegated to you for response:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Delegated By', '{delegatedBy}')}
      </table>
      <p style="${emailStyles.paragraph}">Please provide your response at your earliest convenience.</p>`,
      'View Question'
    ),
    bodyText: `Dear {recipientName},

A question has been delegated to you for response:

Question: {questionTitle}
Audit: {auditName}
Delegated By: {delegatedBy}

Please provide your response at your earliest convenience.

View Question: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'questionTitle', 'auditName', 'delegatedBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'QUESTION_CLARIFICATION',
    name: 'Question Clarification Required',
    description: 'Sent when clarification is required for a question',
    category: 'audit',
    subject: 'Clarification Required: {questionTitle}',
    bodyHtml: createEmailHtml(
      'Clarification Required',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Clarification is required for the following question:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Comment', '{clarificationComment}')}
      </table>
      <p style="${emailStyles.paragraph}">Please provide the requested clarification.</p>`,
      'Respond'
    ),
    bodyText: `Dear {recipientName},

Clarification is required for the following question:

Question: {questionTitle}
Audit: {auditName}
Comment: {clarificationComment}

Please provide the requested clarification.

Respond: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'questionTitle', 'auditName', 'clarificationComment', 'entityLink']),
    module: "grc",
  },
  {
    code: 'CONCLUDE_TEST',
    name: 'Test Concluded',
    description: 'Sent when a test procedure is concluded',
    category: 'audit',
    subject: 'Test Conclusion: {procedureName}',
    bodyHtml: createEmailHtml(
      'Test Procedure Concluded',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following test procedure has been concluded:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Procedure', '{procedureName}')}
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Result', '{result}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the test results.</p>`,
      'View Results'
    ),
    bodyText: `Dear {recipientName},

The following test procedure has been concluded:

Procedure: {procedureName}
Audit: {auditName}
Result: {result}

Please review the test results.

View Results: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'procedureName', 'auditName', 'result', 'entityLink']),
    module: "grc",
  },
  {
    code: 'RESPONSE_SUBMITTED',
    name: 'Response Submitted',
    description: 'Sent when a response is submitted',
    category: 'audit',
    subject: 'Response Submitted: {questionTitle}',
    bodyHtml: createEmailHtml(
      'Response Submitted',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A response has been submitted:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Submitted By', '{submittedBy}')}
        ${tableRow('Date', '{submittedDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the submitted response.</p>`,
      'Review Response'
    ),
    bodyText: `Dear {recipientName},

A response has been submitted:

Question: {questionTitle}
Submitted By: {submittedBy}
Date: {submittedDate}

Please review the submitted response.

Review Response: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'questionTitle', 'submittedBy', 'submittedDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'INTERVIEW_SCHEDULED',
    name: 'Interview Scheduled',
    description: 'Sent when an interview is scheduled',
    category: 'audit',
    subject: 'Interview Scheduled: {auditName}',
    bodyHtml: createEmailHtml(
      'Interview Scheduled',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">An interview has been scheduled:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Date & Time', '{interviewDateTime}')}
        ${tableRow('Location', '{location}')}
      </table>
      <p style="${emailStyles.paragraph}">Please ensure your availability for the scheduled interview.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

An interview has been scheduled:

Audit: {auditName}
Date & Time: {interviewDateTime}
Location: {location}

Please ensure your availability for the scheduled interview.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditName', 'interviewDateTime', 'location', 'entityLink']),
    module: "grc",
  },
  {
    code: 'INTERVIEW_RESCHEDULED',
    name: 'Interview Rescheduled',
    description: 'Sent when an interview is rescheduled',
    category: 'audit',
    subject: 'Interview Rescheduled: {auditName}',
    bodyHtml: createEmailHtml(
      'Interview Rescheduled',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">An interview has been rescheduled:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('New Date & Time', '{interviewDateTime}')}
        ${tableRow('Location', '{location}')}
      </table>
      <p style="${emailStyles.paragraph}">Please update your calendar accordingly.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

An interview has been rescheduled:

Audit: {auditName}
New Date & Time: {interviewDateTime}
Location: {location}

Please update your calendar accordingly.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditName', 'interviewDateTime', 'location', 'entityLink']),
    module: "grc",
  },
  {
    code: 'PERIODICITY_INITIATED',
    name: 'Periodic Audit Initiated',
    description: 'Sent when a periodic audit is initiated',
    category: 'audit',
    subject: 'Periodic Audit Initiated: {auditName}',
    bodyHtml: createEmailHtml(
      'Periodic Audit Initiated',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A periodic audit has been initiated:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Period', '{auditPeriod}')}
        ${tableRow('Frequency', '{frequency}')}
      </table>
      <p style="${emailStyles.paragraph}">Please prepare for the upcoming audit activities.</p>`,
      'View Audit'
    ),
    bodyText: `Dear {recipientName},

A periodic audit has been initiated:

Audit: {auditName}
Period: {auditPeriod}
Frequency: {frequency}

Please prepare for the upcoming audit activities.

View Audit: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditName', 'auditPeriod', 'frequency', 'entityLink']),
    module: "grc",
  },
  {
    code: 'REPORT_PUBLISHED',
    name: 'Report Published',
    description: 'Sent when an audit report is published',
    category: 'audit',
    subject: 'Report Published: {reportName}',
    bodyHtml: createEmailHtml(
      'Audit Report Published',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">An audit report has been published:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Report', '{reportName}')}
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Published Date', '{publishedDate}')}
      </table>
      <p style="${emailStyles.paragraph}">The report is now available for review.</p>`,
      'View Report'
    ),
    bodyText: `Dear {recipientName},

An audit report has been published:

Report: {reportName}
Audit: {auditName}
Published Date: {publishedDate}

The report is now available for review.

View Report: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'reportName', 'auditName', 'publishedDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'REPORT_INITIATED',
    name: 'Report Initiated',
    description: 'Sent when an audit report is initiated',
    category: 'audit',
    subject: 'Report Initiated: {reportName}',
    bodyHtml: createEmailHtml(
      'Audit Report Initiated',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">An audit report has been initiated:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Report', '{reportName}')}
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Initiated By', '{initiatedBy}')}
      </table>
      <p style="${emailStyles.paragraph}">The report is being prepared.</p>`,
      'View Report'
    ),
    bodyText: `Dear {recipientName},

An audit report has been initiated:

Report: {reportName}
Audit: {auditName}
Initiated By: {initiatedBy}

The report is being prepared.

View Report: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'reportName', 'auditName', 'initiatedBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'REPORT_SUBMISSION',
    name: 'Report Submitted',
    description: 'Sent when an audit report is submitted',
    category: 'audit',
    subject: 'Report Submission: {reportName}',
    bodyHtml: createEmailHtml(
      'Audit Report Submitted',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">An audit report has been submitted for review:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Report', '{reportName}')}
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the submitted report.</p>`,
      'Review Report'
    ),
    bodyText: `Dear {recipientName},

An audit report has been submitted for review:

Report: {reportName}
Audit: {auditName}
Submitted By: {submittedBy}

Please review the submitted report.

Review Report: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'reportName', 'auditName', 'submittedBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'FIELDWORK_RESPONSE',
    name: 'FieldWork Response Required',
    description: 'Sent when fieldwork response is required',
    category: 'audit',
    subject: 'FieldWork Response Required: {auditName}',
    bodyHtml: createEmailHtml(
      'FieldWork Response Required',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Your response is required for the following fieldwork:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Fieldwork Item', '{fieldworkItem}')}
        ${tableRow('Due Date', '{dueDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please provide your response at your earliest convenience.</p>`,
      'Respond'
    ),
    bodyText: `Dear {recipientName},

Your response is required for the following fieldwork:

Audit: {auditName}
Fieldwork Item: {fieldworkItem}
Due Date: {dueDate}

Please provide your response at your earliest convenience.

Respond: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditName', 'fieldworkItem', 'dueDate', 'entityLink']),
    module: "grc",
  },

  // ===================== EVIDENCE MANAGEMENT =====================
  {
    code: 'EVIDENCE_ASSIGNED',
    name: 'Evidence Assigned',
    description: 'Sent when evidence is assigned to a user',
    category: 'evidence',
    subject: 'Request for Supporting Evidence - {entityName}',
    bodyHtml: createEmailHtml(
      'Evidence Assignment',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">As part of the ongoing review, the audit team requires the following documents/information for validation:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Control', '{controlCode}')}
        ${tableRow('Evidence Required', '{entityName}')}
        ${tableRow('Due Date', '{dueDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please upload the evidence in the portal. Timely submission will help ensure the smooth completion of the audit within schedule.</p>`,
      'Submit Evidence'
    ),
    bodyText: `Dear {recipientName},

As part of the ongoing review, the audit team requires the following documents/information for validation:

Control: {controlCode}
Evidence Required: {entityName}
Due Date: {dueDate}

Please upload the evidence in the portal. Timely submission will help ensure the smooth completion of the audit within schedule.

Submit Evidence: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'controlCode', 'entityName', 'dueDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'EVIDENCE_SUBMITTED',
    name: 'Evidence Submitted',
    description: 'Sent when evidence is submitted',
    category: 'evidence',
    subject: 'Evidence Submitted: {entityName}',
    bodyHtml: createEmailHtml(
      'Evidence Submitted',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Evidence has been submitted for review:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Evidence', '{entityName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
        ${tableRow('Date', '{submittedDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the submitted evidence.</p>`,
      'Review Evidence'
    ),
    bodyText: `Dear {recipientName},

Evidence has been submitted for review:

Evidence: {entityName}
Submitted By: {submittedBy}
Date: {submittedDate}

Please review the submitted evidence.

Review Evidence: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'submittedBy', 'submittedDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'EVIDENCE_PUBLISHED',
    name: 'Evidence Published',
    description: 'Sent when evidence is submitted for review',
    category: 'evidence',
    subject: 'Submitted for Review of Evidence by Reviewer: {entityName}',
    bodyHtml: createEmailHtml(
      'Evidence Submitted for Review',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Evidence has been submitted for your review:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Evidence', '{entityName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
        ${tableRow('Control', '{controlCode}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and approve or provide feedback.</p>`,
      'Review Evidence'
    ),
    bodyText: `Dear {recipientName},

Evidence has been submitted for your review:

Evidence: {entityName}
Submitted By: {submittedBy}
Control: {controlCode}

Please review and approve or provide feedback.

Review Evidence: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'submittedBy', 'controlCode', 'entityLink']),
    module: "grc",
  },

  // ===================== GOVERNANCE & POLICY =====================
  {
    code: 'GOVERNANCE_APPROVED',
    name: 'Governance Approved',
    description: 'Sent when a governance item is approved',
    category: 'governance',
    subject: 'Approved Confirmation: {entityName}',
    bodyHtml: createEmailHtml(
      'Governance Item Approved',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following governance item has been approved:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Item', '{entityName}')}
        ${tableRow('Type', '{entityType}')}
        ${tableRow('Approved By', '{approvedBy}')}
        ${tableRow('Date', '{approvedDate}')}
      </table>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The following governance item has been approved:

Item: {entityName}
Type: {entityType}
Approved By: {approvedBy}
Date: {approvedDate}

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'entityType', 'approvedBy', 'approvedDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'GOVERNANCE_ASSIGNED',
    name: 'Governance Assigned',
    description: 'Sent when a governance item is assigned',
    category: 'governance',
    subject: 'Governance Assignment Notification: {entityName}',
    bodyHtml: createEmailHtml(
      'Governance Item Assigned',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">You have been assigned to the following governance item:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Item', '{entityName}')}
        ${tableRow('Type', '{entityType}')}
        ${tableRow('Assigned By', '{assignedBy}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and take necessary action.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

You have been assigned to the following governance item:

Item: {entityName}
Type: {entityType}
Assigned By: {assignedBy}

Please review and take necessary action.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'entityType', 'assignedBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'GOVERNANCE_PUBLISHED',
    name: 'Governance Published',
    description: 'Sent when a policy is submitted for review',
    category: 'governance',
    subject: 'Submitted for Review of Policy by Reviewer: {entityName}',
    bodyHtml: createEmailHtml(
      'Policy Submitted for Review',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A policy has been submitted for your review:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Policy', '{entityName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
        ${tableRow('Version', '{version}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and provide your approval or feedback.</p>`,
      'Review Policy'
    ),
    bodyText: `Dear {recipientName},

A policy has been submitted for your review:

Policy: {entityName}
Submitted By: {submittedBy}
Version: {version}

Please review and provide your approval or feedback.

Review Policy: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'submittedBy', 'version', 'entityLink']),
    module: "grc",
  },
  {
    code: 'GOVERNANCE_SUBMIT_FOR_APPROVAL',
    name: 'Governance Submit for Approval',
    description: 'Sent when a policy is submitted for approval',
    category: 'governance',
    subject: 'Submitted for Review of Policy by Reviewer: {entityName}',
    bodyHtml: createEmailHtml(
      'Policy Awaiting Approval',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A policy requires your approval:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Policy', '{entityName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
        ${tableRow('Version', '{version}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and approve or reject the policy.</p>`,
      'Review & Approve'
    ),
    bodyText: `Dear {recipientName},

A policy requires your approval:

Policy: {entityName}
Submitted By: {submittedBy}
Version: {version}

Please review and approve or reject the policy.

Review & Approve: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'submittedBy', 'version', 'entityLink']),
    module: "grc",
  },
  {
    code: 'GOVERNANCE_APPROVER',
    name: 'Governance Approver Notification',
    description: 'Sent to governance approver',
    category: 'governance',
    subject: 'Approval Required: {entityName}',
    bodyHtml: createEmailHtml(
      'Governance Approval Required',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Your approval is required for the following governance item:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Item', '{entityName}')}
        ${tableRow('Type', '{entityType}')}
        ${tableRow('Submitted By', '{submittedBy}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and take action.</p>`,
      'Review & Approve'
    ),
    bodyText: `Dear {recipientName},

Your approval is required for the following governance item:

Item: {entityName}
Type: {entityType}
Submitted By: {submittedBy}

Please review and take action.

Review & Approve: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'entityType', 'submittedBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'RESEND_POLICY',
    name: 'Resend Policy',
    description: 'Sent when a policy is resent for review',
    category: 'governance',
    subject: 'Submitted for Review of Policy by Reviewer: {entityName}',
    bodyHtml: createEmailHtml(
      'Policy Resubmitted for Review',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A policy has been resubmitted for your review:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Policy', '{entityName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
        ${tableRow('Changes', '{changesSummary}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the updated policy.</p>`,
      'Review Policy'
    ),
    bodyText: `Dear {recipientName},

A policy has been resubmitted for your review:

Policy: {entityName}
Submitted By: {submittedBy}
Changes: {changesSummary}

Please review the updated policy.

Review Policy: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'submittedBy', 'changesSummary', 'entityLink']),
    module: "grc",
  },

  // ===================== PROCESS MANAGEMENT =====================
  {
    code: 'PROCESS_CREATED',
    name: 'Process Creation',
    description: 'Sent when a process is created',
    category: 'process',
    subject: 'Process Created: {entityName}',
    bodyHtml: createEmailHtml(
      'Process Created',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A new process has been created:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Process', '{entityName}')}
        ${tableRow('Created By', '{createdBy}')}
        ${tableRow('Department', '{department}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the process details.</p>`,
      'View Process'
    ),
    bodyText: `Dear {recipientName},

A new process has been created:

Process: {entityName}
Created By: {createdBy}
Department: {department}

Please review the process details.

View Process: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'createdBy', 'department', 'entityLink']),
    module: "grc",
  },
  {
    code: 'PROCESS_SUBMIT_FOR_APPROVAL',
    name: 'Process Submit for Approval',
    description: 'Sent when a process is submitted for approval',
    category: 'process',
    subject: 'Submitted for Review of Process: {entityName}',
    bodyHtml: createEmailHtml(
      'Process Awaiting Review',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A process has been submitted for your review:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Process', '{entityName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and approve or provide feedback.</p>`,
      'Review Process'
    ),
    bodyText: `Dear {recipientName},

A process has been submitted for your review:

Process: {entityName}
Submitted By: {submittedBy}

Please review and approve or provide feedback.

Review Process: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'submittedBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'PROCESS_APPROVED',
    name: 'Process Approved',
    description: 'Sent when a process is approved',
    category: 'process',
    subject: 'Process Approved: {entityName}',
    bodyHtml: createEmailHtml(
      'Process Approved',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following process has been approved:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Process', '{entityName}')}
        ${tableRow('Approved By', '{approvedBy}')}
        ${tableRow('Date', '{approvedDate}')}
      </table>`,
      'View Process'
    ),
    bodyText: `Dear {recipientName},

The following process has been approved:

Process: {entityName}
Approved By: {approvedBy}
Date: {approvedDate}

View Process: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'approvedBy', 'approvedDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'PROCESS_REJECTION',
    name: 'Process Rejection',
    description: 'Sent when a process is rejected',
    category: 'process',
    subject: 'Process Rejected: {entityName}',
    bodyHtml: createEmailHtml(
      'Process Rejected',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following process has been rejected:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Process', '{entityName}')}
        ${tableRow('Rejected By', '{rejectedBy}')}
        ${tableRow('Reason', '{reason}')}
      </table>
      <p style="${emailStyles.paragraph}">Please address the feedback and resubmit.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The following process has been rejected:

Process: {entityName}
Rejected By: {rejectedBy}
Reason: {reason}

Please address the feedback and resubmit.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'rejectedBy', 'reason', 'entityLink']),
    module: "grc",
  },

  // ===================== RISK MANAGEMENT =====================
  {
    code: 'RISK_CREATED',
    name: 'Risk Creation',
    description: 'Sent when a risk is created',
    category: 'risk',
    subject: 'Risk Created: {entityName}',
    bodyHtml: createEmailHtml(
      'Risk Created',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A new risk has been identified and created:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Risk ID', '{riskCode}')}
        ${tableRow('Risk Name', '{entityName}')}
        ${tableRow('Category', '{category}')}
        ${tableRow('Created By', '{createdBy}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the risk details and take appropriate action.</p>`,
      'View Risk'
    ),
    bodyText: `Dear {recipientName},

A new risk has been identified and created:

Risk ID: {riskCode}
Risk Name: {entityName}
Category: {category}
Created By: {createdBy}

Please review the risk details and take appropriate action.

View Risk: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'riskCode', 'entityName', 'category', 'createdBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'RISK_ASSIGNED',
    name: 'Risk Assigned',
    description: 'Sent when a risk is assigned to a user',
    category: 'risk',
    subject: 'Risk Assigned to You: {riskCode}',
    bodyHtml: createEmailHtml(
      'Risk Assignment',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">You have been assigned as the owner of the following risk:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Risk ID', '{riskCode}')}
        ${tableRow('Risk Name', '{entityName}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and manage this risk accordingly.</p>`,
      'View Risk'
    ),
    bodyText: `Dear {recipientName},

You have been assigned as the owner of the following risk:

Risk ID: {riskCode}
Risk Name: {entityName}

Please review and manage this risk accordingly.

View Risk: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'riskCode', 'entityName', 'entityLink']),
    module: "grc",
  },
  {
    code: 'RISK_APPROVED',
    name: 'Risk Approved',
    description: 'Sent when a risk is approved',
    category: 'risk',
    subject: 'Approved Confirmation: {entityName}',
    bodyHtml: createEmailHtml(
      'Risk Approved',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following risk has been approved:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Risk ID', '{riskCode}')}
        ${tableRow('Risk Name', '{entityName}')}
        ${tableRow('Approved By', '{approvedBy}')}
      </table>`,
      'View Risk'
    ),
    bodyText: `Dear {recipientName},

The following risk has been approved:

Risk ID: {riskCode}
Risk Name: {entityName}
Approved By: {approvedBy}

View Risk: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'riskCode', 'entityName', 'approvedBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'RISK_SUBMIT_FOR_APPROVAL',
    name: 'Risk Submit for Approval',
    description: 'Sent when a risk is submitted for approval',
    category: 'risk',
    subject: 'Submitted for Review of Risk: {entityName}',
    bodyHtml: createEmailHtml(
      'Risk Awaiting Review',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A risk has been submitted for your review:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Risk ID', '{riskCode}')}
        ${tableRow('Risk Name', '{entityName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and approve or provide feedback.</p>`,
      'Review Risk'
    ),
    bodyText: `Dear {recipientName},

A risk has been submitted for your review:

Risk ID: {riskCode}
Risk Name: {entityName}
Submitted By: {submittedBy}

Please review and approve or provide feedback.

Review Risk: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'riskCode', 'entityName', 'submittedBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'RISK_REJECTION',
    name: 'Risk Rejection',
    description: 'Sent when a risk is rejected',
    category: 'risk',
    subject: 'Risk Rejected: {entityName}',
    bodyHtml: createEmailHtml(
      'Risk Rejected',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following risk has been rejected:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Risk ID', '{riskCode}')}
        ${tableRow('Risk Name', '{entityName}')}
        ${tableRow('Rejected By', '{rejectedBy}')}
        ${tableRow('Reason', '{reason}')}
      </table>
      <p style="${emailStyles.paragraph}">Please address the feedback and resubmit.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The following risk has been rejected:

Risk ID: {riskCode}
Risk Name: {entityName}
Rejected By: {rejectedBy}
Reason: {reason}

Please address the feedback and resubmit.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'riskCode', 'entityName', 'rejectedBy', 'reason', 'entityLink']),
    module: "grc",
  },

  // ===================== CONTROL MANAGEMENT =====================
  {
    code: 'CONTROL_ASSIGNED',
    name: 'Control Assignment',
    description: 'Sent when a control is assigned',
    category: 'control',
    subject: 'Control Assigned: {controlCode}',
    bodyHtml: createEmailHtml(
      'Control Assignment',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">You have been assigned to the following control:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Control ID', '{controlCode}')}
        ${tableRow('Control Name', '{entityName}')}
        ${tableRow('Framework', '{frameworkName}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the control requirements and ensure compliance.</p>`,
      'View Control'
    ),
    bodyText: `Dear {recipientName},

You have been assigned to the following control:

Control ID: {controlCode}
Control Name: {entityName}
Framework: {frameworkName}

Please review the control requirements and ensure compliance.

View Control: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'controlCode', 'entityName', 'frameworkName', 'entityLink']),
    module: "grc",
  },
  {
    code: 'CONTROL_COMPLIANT',
    name: 'Control Compliant',
    description: 'Sent when a control is marked as compliant',
    category: 'control',
    subject: 'Control Compliant: {controlCode}',
    bodyHtml: createEmailHtml(
      'Control Marked Compliant',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following control has been marked as compliant:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Control ID', '{controlCode}')}
        ${tableRow('Control Name', '{entityName}')}
        ${tableRow('Assessed By', '{assessedBy}')}
        ${tableRow('Assessment Date', '{assessmentDate}')}
      </table>`,
      'View Control'
    ),
    bodyText: `Dear {recipientName},

The following control has been marked as compliant:

Control ID: {controlCode}
Control Name: {entityName}
Assessed By: {assessedBy}
Assessment Date: {assessmentDate}

View Control: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'controlCode', 'entityName', 'assessedBy', 'assessmentDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ASSESSMENT_COMPLETED',
    name: 'Assessment Completed',
    description: 'Sent when a control assessment is completed',
    category: 'control',
    subject: 'Assessment Completed: {controlCode}',
    bodyHtml: createEmailHtml(
      'Control Assessment Completed',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A control assessment has been completed:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Control ID', '{controlCode}')}
        ${tableRow('Control Name', '{entityName}')}
        ${tableRow('Result', '{assessmentResult}')}
        ${tableRow('Completed By', '{completedBy}')}
      </table>`,
      'View Assessment'
    ),
    bodyText: `Dear {recipientName},

A control assessment has been completed:

Control ID: {controlCode}
Control Name: {entityName}
Result: {assessmentResult}
Completed By: {completedBy}

View Assessment: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'controlCode', 'entityName', 'assessmentResult', 'completedBy', 'entityLink']),
    module: "grc",
  },

  // ===================== EXCEPTION MANAGEMENT =====================
  {
    code: 'EXCEPTION_ASSIGNED',
    name: 'Exception Assignment',
    description: 'Sent when an exception is assigned',
    category: 'exception',
    subject: 'Approval Required for Exception: {entityName}',
    bodyHtml: createEmailHtml(
      'Exception Assignment',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">An exception has been assigned to you:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Exception', '{entityName}')}
        ${tableRow('Control', '{controlCode}')}
        ${tableRow('Requested By', '{requestedBy}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and take necessary action.</p>`,
      'Review Exception'
    ),
    bodyText: `Dear {recipientName},

An exception has been assigned to you:

Exception: {entityName}
Control: {controlCode}
Requested By: {requestedBy}

Please review and take necessary action.

Review Exception: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'controlCode', 'requestedBy', 'entityLink']),
    module: "grc",
  },
  {
    code: 'EXCEPTION_AUTHORIZED',
    name: 'Exception Authorized',
    description: 'Sent when an exception is authorized',
    category: 'exception',
    subject: 'Approval Required for Exception: {entityName}',
    bodyHtml: createEmailHtml(
      'Exception Authorization Required',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Your authorization is required for the following exception:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Exception', '{entityName}')}
        ${tableRow('Control', '{controlCode}')}
        ${tableRow('Requested By', '{requestedBy}')}
        ${tableRow('Justification', '{justification}')}
      </table>`,
      'Authorize Exception'
    ),
    bodyText: `Dear {recipientName},

Your authorization is required for the following exception:

Exception: {entityName}
Control: {controlCode}
Requested By: {requestedBy}
Justification: {justification}

Authorize Exception: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'controlCode', 'requestedBy', 'justification', 'entityLink']),
    module: "grc",
  },
  {
    code: 'EXCEPTION_AUTHORIZATION_REQUIRED',
    name: 'Exception Authorization Required',
    description: 'Sent when exception authorization is required',
    category: 'exception',
    subject: 'Require Authorization for Exception: {entityName}',
    bodyHtml: createEmailHtml(
      'Exception Authorization Required',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Authorization is required for the following exception:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Exception', '{entityName}')}
        ${tableRow('Control', '{controlCode}')}
        ${tableRow('Expiry Date', '{expiryDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and authorize or deny the exception.</p>`,
      'Review & Authorize'
    ),
    bodyText: `Dear {recipientName},

Authorization is required for the following exception:

Exception: {entityName}
Control: {controlCode}
Expiry Date: {expiryDate}

Please review and authorize or deny the exception.

Review & Authorize: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'controlCode', 'expiryDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'EXCEPTION_APPROVED',
    name: 'Exception Approved',
    description: 'Sent when an exception is approved',
    category: 'exception',
    subject: 'Exception Successfully Approved: {entityName}',
    bodyHtml: createEmailHtml(
      'Exception Approved',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following exception has been approved:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Exception', '{entityName}')}
        ${tableRow('Approved By', '{approvedBy}')}
        ${tableRow('Valid Until', '{expiryDate}')}
      </table>`,
      'View Exception'
    ),
    bodyText: `Dear {recipientName},

The following exception has been approved:

Exception: {entityName}
Approved By: {approvedBy}
Valid Until: {expiryDate}

View Exception: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'approvedBy', 'expiryDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'EXCEPTION_DENIED',
    name: 'Exception Denied',
    description: 'Sent when an exception is denied',
    category: 'exception',
    subject: 'Authorization Denied for Exception: {entityName}',
    bodyHtml: createEmailHtml(
      'Exception Denied',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following exception has been denied:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Exception', '{entityName}')}
        ${tableRow('Denied By', '{deniedBy}')}
        ${tableRow('Reason', '{reason}')}
      </table>
      <p style="${emailStyles.paragraph}">Please address the concerns and resubmit if necessary.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The following exception has been denied:

Exception: {entityName}
Denied By: {deniedBy}
Reason: {reason}

Please address the concerns and resubmit if necessary.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'deniedBy', 'reason', 'entityLink']),
    module: "grc",
  },
  {
    code: 'EXCEPTION_SENT_BACK',
    name: 'Exception Sent Back',
    description: 'Sent when an exception is sent back by approver',
    category: 'exception',
    subject: 'Exception Sent Back by Approver: {entityName}',
    bodyHtml: createEmailHtml(
      'Exception Sent Back',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following exception has been sent back for revision:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Exception', '{entityName}')}
        ${tableRow('Sent Back By', '{sentBackBy}')}
        ${tableRow('Comments', '{comments}')}
      </table>
      <p style="${emailStyles.paragraph}">Please address the feedback and resubmit.</p>`,
      'View & Revise'
    ),
    bodyText: `Dear {recipientName},

The following exception has been sent back for revision:

Exception: {entityName}
Sent Back By: {sentBackBy}
Comments: {comments}

Please address the feedback and resubmit.

View & Revise: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'sentBackBy', 'comments', 'entityLink']),
    module: "grc",
  },
  {
    code: 'EXCEPTION_CLOSURE',
    name: 'Exception Closure',
    description: 'Sent when an exception is submitted for closure',
    category: 'exception',
    subject: 'Exception Submitted for Closure: {entityName}',
    bodyHtml: createEmailHtml(
      'Exception Closure Request',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">An exception has been submitted for closure:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Exception', '{entityName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
        ${tableRow('Closure Reason', '{closureReason}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and approve the closure.</p>`,
      'Review Closure'
    ),
    bodyText: `Dear {recipientName},

An exception has been submitted for closure:

Exception: {entityName}
Submitted By: {submittedBy}
Closure Reason: {closureReason}

Please review and approve the closure.

Review Closure: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'submittedBy', 'closureReason', 'entityLink']),
    module: "grc",
  },
  {
    code: 'EXCEPTION_CLOSED',
    name: 'Exception Closed',
    description: 'Sent when an exception is closed',
    category: 'exception',
    subject: 'Exception Has Been Closed: {entityName}',
    bodyHtml: createEmailHtml(
      'Exception Closed',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following exception has been closed:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Exception', '{entityName}')}
        ${tableRow('Closed By', '{closedBy}')}
        ${tableRow('Closed Date', '{closedDate}')}
      </table>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The following exception has been closed:

Exception: {entityName}
Closed By: {closedBy}
Closed Date: {closedDate}

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'closedBy', 'closedDate', 'entityLink']),
    module: "grc",
  },

  // ===================== ISSUE/FINDING TRACKING =====================
  {
    code: 'ISSUE_CREATED',
    name: 'Issue Creation',
    description: 'Sent when an issue is created',
    category: 'issue',
    subject: 'Issue Creation: {entityName}',
    bodyHtml: createEmailHtml(
      'Issue Created',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A new issue has been created:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Issue', '{entityName}')}
        ${tableRow('Severity', '{severity}')}
        ${tableRow('Created By', '{createdBy}')}
        ${tableRow('Due Date', '{dueDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please take appropriate action to resolve this issue.</p>`,
      'View Issue'
    ),
    bodyText: `Dear {recipientName},

A new issue has been created:

Issue: {entityName}
Severity: {severity}
Created By: {createdBy}
Due Date: {dueDate}

Please take appropriate action to resolve this issue.

View Issue: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'severity', 'createdBy', 'dueDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ISSUE_RESOLVED',
    name: 'Issue Resolved',
    description: 'Sent when an issue is resolved',
    category: 'issue',
    subject: 'Issue Resolved: {entityName}',
    bodyHtml: createEmailHtml(
      'Issue Resolved',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following issue has been resolved:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Issue', '{entityName}')}
        ${tableRow('Resolved By', '{resolvedBy}')}
        ${tableRow('Resolution Date', '{resolvedDate}')}
      </table>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The following issue has been resolved:

Issue: {entityName}
Resolved By: {resolvedBy}
Resolution Date: {resolvedDate}

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'resolvedBy', 'resolvedDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ISSUE_SUBMIT_FOR_CLOSURE',
    name: 'Issue Submit for Closure',
    description: 'Sent when an issue is submitted for closure',
    category: 'issue',
    subject: 'Issue Submit for Closure: {entityName}',
    bodyHtml: createEmailHtml(
      'Issue Submitted for Closure',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">An issue has been submitted for closure:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Issue', '{entityName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
        ${tableRow('Resolution Summary', '{resolutionSummary}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and approve the closure.</p>`,
      'Review Closure'
    ),
    bodyText: `Dear {recipientName},

An issue has been submitted for closure:

Issue: {entityName}
Submitted By: {submittedBy}
Resolution Summary: {resolutionSummary}

Please review and approve the closure.

Review Closure: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'submittedBy', 'resolutionSummary', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ISSUE_REJECTED',
    name: 'Issue Rejected',
    description: 'Sent when an issue closure is rejected',
    category: 'issue',
    subject: 'Issue Rejected: {entityName}',
    bodyHtml: createEmailHtml(
      'Issue Closure Rejected',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The issue closure has been rejected:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Issue', '{entityName}')}
        ${tableRow('Rejected By', '{rejectedBy}')}
        ${tableRow('Reason', '{reason}')}
      </table>
      <p style="${emailStyles.paragraph}">Please address the concerns and resubmit.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The issue closure has been rejected:

Issue: {entityName}
Rejected By: {rejectedBy}
Reason: {reason}

Please address the concerns and resubmit.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'rejectedBy', 'reason', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ISSUE_RESOLUTION_REMINDER',
    name: 'Issue Resolution Reminder',
    description: 'Sent as a reminder for issue resolution',
    category: 'issue',
    subject: 'Issue Resolution Required: {entityName}',
    bodyHtml: createEmailHtml(
      'Issue Resolution Reminder',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">This is a reminder that the following issue requires resolution:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Issue', '{entityName}')}
        ${tableRow('Due Date', '{dueDate}', true)}
        ${tableRow('Days Overdue', '{daysOverdue}')}
      </table>
      <p style="${emailStyles.paragraph}">Please prioritize resolving this issue.</p>`,
      'Resolve Issue'
    ),
    bodyText: `Dear {recipientName},

This is a reminder that the following issue requires resolution:

Issue: {entityName}
Due Date: {dueDate}
Days Overdue: {daysOverdue}

Please prioritize resolving this issue.

Resolve Issue: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'dueDate', 'daysOverdue', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ISSUE_ESCALATED',
    name: 'Issue Escalated',
    description: 'Sent when an issue is escalated',
    category: 'issue',
    subject: 'Issue Resolution Required (Escalated): {entityName}',
    bodyHtml: createEmailHtml(
      'Issue Escalated',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following issue has been escalated and requires immediate attention:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Issue', '{entityName}')}
        ${tableRow('Severity', '{severity}')}
        ${tableRow('Escalated By', '{escalatedBy}')}
        ${tableRow('Due Date', '{dueDate}', true)}
      </table>
      <p style="${emailStyles.paragraph}">Please prioritize resolving this issue immediately.</p>`,
      'View Issue'
    ),
    bodyText: `Dear {recipientName},

The following issue has been escalated and requires immediate attention:

Issue: {entityName}
Severity: {severity}
Escalated By: {escalatedBy}
Due Date: {dueDate}

Please prioritize resolving this issue immediately.

View Issue: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'severity', 'escalatedBy', 'dueDate', 'entityLink']),
    module: "grc",
  },

  // ===================== PLANNED ACTIONS =====================
  {
    code: 'PLANNED_ACTION_RAISE',
    name: 'Planned Action Raised',
    description: 'Sent when a planned action is raised',
    category: 'planned_action',
    subject: 'Submitted for Review of Planned Action: {entityName}',
    bodyHtml: createEmailHtml(
      'Planned Action Raised',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A planned action has been raised for review:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Action', '{entityName}')}
        ${tableRow('Raised By', '{raisedBy}')}
        ${tableRow('Due Date', '{dueDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and approve the planned action.</p>`,
      'Review Action'
    ),
    bodyText: `Dear {recipientName},

A planned action has been raised for review:

Action: {entityName}
Raised By: {raisedBy}
Due Date: {dueDate}

Please review and approve the planned action.

Review Action: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'raisedBy', 'dueDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'PLANNED_ACTION_REJECTION',
    name: 'Planned Action Rejected',
    description: 'Sent when a planned action is rejected',
    category: 'planned_action',
    subject: 'Planned Action Rejected: {entityName}',
    bodyHtml: createEmailHtml(
      'Planned Action Rejected',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following planned action has been rejected:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Action', '{entityName}')}
        ${tableRow('Rejected By', '{rejectedBy}')}
        ${tableRow('Reason', '{reason}')}
      </table>
      <p style="${emailStyles.paragraph}">Please address the feedback and resubmit.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The following planned action has been rejected:

Action: {entityName}
Rejected By: {rejectedBy}
Reason: {reason}

Please address the feedback and resubmit.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'rejectedBy', 'reason', 'entityLink']),
    module: "grc",
  },
  {
    code: 'PLANNED_ACTION_SUBMIT_FOR_APPROVAL',
    name: 'Planned Action Submit for Approval',
    description: 'Sent when a planned action is submitted for approval',
    category: 'planned_action',
    subject: 'Submitted for Review of Planned Action: {entityName}',
    bodyHtml: createEmailHtml(
      'Planned Action Awaiting Approval',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A planned action has been submitted for your approval:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Action', '{entityName}')}
        ${tableRow('Submitted By', '{submittedBy}')}
        ${tableRow('Due Date', '{dueDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and approve or reject.</p>`,
      'Review & Approve'
    ),
    bodyText: `Dear {recipientName},

A planned action has been submitted for your approval:

Action: {entityName}
Submitted By: {submittedBy}
Due Date: {dueDate}

Please review and approve or reject.

Review & Approve: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'submittedBy', 'dueDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'PLANNED_ACTION_APPROVED',
    name: 'Planned Action Approved',
    description: 'Sent when a planned action is approved',
    category: 'planned_action',
    subject: 'Planned Action Approved: {entityName}',
    bodyHtml: createEmailHtml(
      'Planned Action Approved',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following planned action has been approved:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Action', '{entityName}')}
        ${tableRow('Approved By', '{approvedBy}')}
        ${tableRow('Due Date', '{dueDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please proceed with implementing the action.</p>`,
      'View Action'
    ),
    bodyText: `Dear {recipientName},

The following planned action has been approved:

Action: {entityName}
Approved By: {approvedBy}
Due Date: {dueDate}

Please proceed with implementing the action.

View Action: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'approvedBy', 'dueDate', 'entityLink']),
    module: "grc",
  },

  // ===================== KPI =====================
  {
    code: 'KPI_UPDATED',
    name: 'KPI Updated',
    description: 'Sent when a KPI is updated',
    category: 'kpi',
    subject: 'KPI Updated: {entityName}',
    bodyHtml: createEmailHtml(
      'KPI Updated',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A KPI has been updated:</p>
      <table style="${emailStyles.table}">
        ${tableRow('KPI', '{entityName}')}
        ${tableRow('Updated By', '{updatedBy}')}
        ${tableRow('Previous Value', '{previousValue}')}
        ${tableRow('New Value', '{newValue}')}
      </table>`,
      'View KPI'
    ),
    bodyText: `Dear {recipientName},

A KPI has been updated:

KPI: {entityName}
Updated By: {updatedBy}
Previous Value: {previousValue}
New Value: {newValue}

View KPI: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'updatedBy', 'previousValue', 'newValue', 'entityLink']),
    module: "grc",
  },
  {
    code: 'KPI_SCORE_UPDATED',
    name: 'KPI Score Updated',
    description: 'Sent when a KPI score is updated',
    category: 'kpi',
    subject: 'KPI Score Updated: {entityName}',
    bodyHtml: createEmailHtml(
      'KPI Score Updated',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A KPI score has been updated:</p>
      <table style="${emailStyles.table}">
        ${tableRow('KPI', '{entityName}')}
        ${tableRow('New Score', '{newScore}')}
        ${tableRow('Target', '{target}')}
        ${tableRow('Status', '{status}')}
      </table>`,
      'View KPI'
    ),
    bodyText: `Dear {recipientName},

A KPI score has been updated:

KPI: {entityName}
New Score: {newScore}
Target: {target}
Status: {status}

View KPI: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'newScore', 'target', 'status', 'entityLink']),
    module: "grc",
  },

  // ===================== USER & SYSTEM =====================
  {
    code: 'USER_CREATED',
    name: 'User Creation',
    description: 'Sent when a new user account is created',
    category: 'system',
    subject: 'Welcome to GRC Platform',
    bodyHtml: createEmailHtml(
      'Welcome to GRC Platform!',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {userName},</p>
      <p style="${emailStyles.paragraph}">Your account has been successfully created on the GRC Platform.</p>
      <p style="${emailStyles.paragraph}">You can now log in and start using the platform to manage your organization's governance, risk, and compliance activities.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Username', '{username}')}
        ${tableRow('Role', '{roleName}')}
      </table>
      <p style="${emailStyles.paragraph}">If you have any questions, please contact your administrator.</p>`,
      'Log In Now'
    ),
    bodyText: `Dear {userName},

Your account has been successfully created on the GRC Platform.

You can now log in and start using the platform to manage your organization's governance, risk, and compliance activities.

Username: {username}
Role: {roleName}

Log in at: {entityLink}

If you have any questions, please contact your administrator.

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['userName', 'username', 'roleName', 'entityLink']),
    module: "grc",
  },
  {
    code: 'CUSTOMER_ONBOARDED',
    name: 'Customer Onboarded',
    description: 'Sent when a new customer organization is onboarded',
    category: 'system',
    subject: 'Your Organization Has Been Onboarded',
    bodyHtml: createEmailHtml(
      'Welcome to GRC Platform!',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {userName},</p>
      <p style="${emailStyles.paragraph}">Your organization <strong>"{customerName}"</strong> has been successfully onboarded to the GRC Platform.</p>
      <p style="${emailStyles.paragraph}">As the administrator, you can now:</p>
      <ul style="margin: 15px 0;">
        <li>Configure your organization settings</li>
        <li>Invite team members</li>
        <li>Set up compliance frameworks</li>
        <li>Manage risks and controls</li>
      </ul>`,
      'Go to Dashboard'
    ),
    bodyText: `Dear {userName},

Your organization "{customerName}" has been successfully onboarded to the GRC Platform.

As the administrator, you can now:
- Configure your organization settings
- Invite team members
- Set up compliance frameworks
- Manage risks and controls

Go to Dashboard: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['userName', 'customerName', 'entityLink']),
    module: "grc",
  },

  // ===================== REMINDERS & ESCALATIONS =====================
  {
    code: 'EVIDENCE_DUE_REMINDER',
    name: 'Evidence Due Reminder',
    description: 'Sent when evidence is due soon',
    category: 'reminder',
    subject: 'Evidence Due Soon: {entityName}',
    bodyHtml: createEmailHtml(
      'Evidence Due Soon',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">This is a reminder that the following evidence is due soon:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Evidence', '{entityName}')}
        ${tableRow('Due Date', '{dueDate}', true)}
        ${tableRow('Control', '{controlCode}')}
      </table>
      <p style="${emailStyles.paragraph}">Please ensure you submit the required evidence before the due date.</p>`,
      'Submit Evidence'
    ),
    bodyText: `Dear {recipientName},

This is a reminder that the following evidence is due soon:

Evidence: {entityName}
Due Date: {dueDate}
Control: {controlCode}

Please ensure you submit the required evidence before the due date.

Submit Evidence: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'dueDate', 'controlCode', 'entityLink']),
    module: "grc",
  },
  {
    code: 'CAPA_DUE_REMINDER',
    name: 'CAPA Due Reminder',
    description: 'Sent when a CAPA is due soon',
    category: 'reminder',
    subject: 'CAPA Due Soon: {entityName}',
    bodyHtml: createEmailHtml(
      'CAPA Due Soon',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">This is a reminder that the following CAPA is due soon:</p>
      <table style="${emailStyles.table}">
        ${tableRow('CAPA', '{entityName}')}
        ${tableRow('Due Date', '{dueDate}', true)}
      </table>
      <p style="${emailStyles.paragraph}">Please ensure you complete the required actions before the due date.</p>`,
      'View CAPA'
    ),
    bodyText: `Dear {recipientName},

This is a reminder that the following CAPA is due soon:

CAPA: {entityName}
Due Date: {dueDate}

Please ensure you complete the required actions before the due date.

View CAPA: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'dueDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'REVIEW_DUE_REMINDER',
    name: 'Review Due Reminder',
    description: 'Sent when a policy review is due soon',
    category: 'reminder',
    subject: 'Policy Review Due Soon: {entityName}',
    bodyHtml: createEmailHtml(
      'Policy Review Due Soon',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">This is a reminder that the following policy is due for review:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Policy', '{entityName}')}
        ${tableRow('Review Date', '{dueDate}', true)}
      </table>
      <p style="${emailStyles.paragraph}">Please review and update the policy as needed.</p>`,
      'Review Policy'
    ),
    bodyText: `Dear {recipientName},

This is a reminder that the following policy is due for review:

Policy: {entityName}
Review Date: {dueDate}

Please review and update the policy as needed.

Review Policy: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'dueDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'AUDIT_PLAN_ACKNOWLEDGEMENT_REMINDER',
    name: 'Audit Plan Acknowledgement Reminder',
    description: 'Sent as a reminder for audit plan acknowledgement',
    category: 'reminder',
    subject: 'Reminder: Audit Plan Acknowledgement Required: {auditPlanName}',
    bodyHtml: createEmailHtml(
      'Audit Plan Acknowledgement Reminder',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">This is a reminder that the following audit plan requires your acknowledgement:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Plan Name', '{auditPlanName}')}
        ${tableRow('Scheduled Date', '{scheduledDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please acknowledge the audit plan as soon as possible.</p>`,
      'Acknowledge Plan'
    ),
    bodyText: `Dear {recipientName},

This is a reminder that the following audit plan requires your acknowledgement:

Plan Name: {auditPlanName}
Scheduled Date: {scheduledDate}

Please acknowledge the audit plan as soon as possible.

Acknowledge Plan: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditPlanName', 'scheduledDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'CLARIFICATION_REMINDER',
    name: 'Clarification Reminder',
    description: 'Sent as a reminder for clarification response',
    category: 'reminder',
    subject: 'Reminder: Clarification Required: {questionTitle}',
    bodyHtml: createEmailHtml(
      'Clarification Reminder',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">This is a reminder that clarification is still required for:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Audit', '{auditName}')}
      </table>
      <p style="${emailStyles.paragraph}">Please provide your response as soon as possible.</p>`,
      'Respond'
    ),
    bodyText: `Dear {recipientName},

This is a reminder that clarification is still required for:

Question: {questionTitle}
Audit: {auditName}

Please provide your response as soon as possible.

Respond: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'questionTitle', 'auditName', 'entityLink']),
    module: "grc",
  },
  {
    code: 'FIELDWORK_RESPONSE_REMINDER',
    name: 'FieldWork Response Reminder',
    description: 'Sent as a reminder for fieldwork response',
    category: 'reminder',
    subject: 'FieldWork Response Reminder: {auditName}',
    bodyHtml: createEmailHtml(
      'FieldWork Response Reminder',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">This is a reminder that your response is required for the following fieldwork:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Fieldwork Item', '{fieldworkItem}')}
        ${tableRow('Due Date', '{dueDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please provide your response as soon as possible.</p>`,
      'Respond'
    ),
    bodyText: `Dear {recipientName},

This is a reminder that your response is required for the following fieldwork:

Audit: {auditName}
Fieldwork Item: {fieldworkItem}
Due Date: {dueDate}

Please provide your response as soon as possible.

Respond: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditName', 'fieldworkItem', 'dueDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ESCALATE_FIELDWORK_RESPONSE',
    name: 'Escalate FieldWork Response',
    description: 'Sent when fieldwork response is escalated',
    category: 'escalation',
    subject: 'FieldWork Response Required (Escalated): {auditName}',
    bodyHtml: createEmailHtml(
      'FieldWork Response Escalated',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following fieldwork response has been escalated and requires immediate attention:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Fieldwork Item', '{fieldworkItem}')}
        ${tableRow('Due Date', '{dueDate}', true)}
        ${tableRow('Escalated To', '{escalatedTo}')}
      </table>
      <p style="${emailStyles.paragraph}">Please ensure the response is provided immediately.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The following fieldwork response has been escalated and requires immediate attention:

Audit: {auditName}
Fieldwork Item: {fieldworkItem}
Due Date: {dueDate}
Escalated To: {escalatedTo}

Please ensure the response is provided immediately.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditName', 'fieldworkItem', 'dueDate', 'escalatedTo', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ESCALATE_CLARIFICATION',
    name: 'Escalate Clarification',
    description: 'Sent when clarification request is escalated',
    category: 'escalation',
    subject: 'Clarification Escalated: {questionTitle}',
    bodyHtml: createEmailHtml(
      'Clarification Escalated',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A clarification request has been escalated and requires immediate attention:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Audit', '{auditName}')}
        ${tableRow('Escalated To', '{escalatedTo}')}
      </table>
      <p style="${emailStyles.paragraph}">Please ensure the clarification is provided immediately.</p>`,
      'Respond'
    ),
    bodyText: `Dear {recipientName},

A clarification request has been escalated and requires immediate attention:

Question: {questionTitle}
Audit: {auditName}
Escalated To: {escalatedTo}

Please ensure the clarification is provided immediately.

Respond: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'questionTitle', 'auditName', 'escalatedTo', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ESCALATE_ACKNOWLEDGMENT',
    name: 'Escalate Acknowledgment',
    description: 'Sent when audit plan acknowledgement is escalated',
    category: 'escalation',
    subject: 'Acknowledgement Escalated: {auditPlanName}',
    bodyHtml: createEmailHtml(
      'Acknowledgement Escalated',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">An audit plan acknowledgement has been escalated and requires immediate attention:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Plan Name', '{auditPlanName}')}
        ${tableRow('Scheduled Date', '{scheduledDate}')}
        ${tableRow('Escalated To', '{escalatedTo}')}
      </table>
      <p style="${emailStyles.paragraph}">Please acknowledge the audit plan immediately.</p>`,
      'Acknowledge Plan'
    ),
    bodyText: `Dear {recipientName},

An audit plan acknowledgement has been escalated and requires immediate attention:

Plan Name: {auditPlanName}
Scheduled Date: {scheduledDate}
Escalated To: {escalatedTo}

Please acknowledge the audit plan immediately.

Acknowledge Plan: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'auditPlanName', 'scheduledDate', 'escalatedTo', 'entityLink']),
    module: "grc",
  },

  // ===================== GENERIC TEMPLATES =====================
  {
    code: 'GENERIC_NOTIFICATION',
    name: 'Generic Notification',
    description: 'Generic notification template for unmapped events',
    category: 'system',
    subject: '{title}',
    bodyHtml: createEmailHtml(
      '{title}',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">{message}</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

{message}

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'title', 'message', 'entityLink']),
    module: "grc",
  },

  // ===================== ADDITIONAL TEMPLATES =====================
  {
    code: 'CAPA_ASSIGNED',
    name: 'CAPA Assigned',
    description: 'Sent when a CAPA is assigned to a user',
    category: 'capa',
    subject: 'CAPA Assigned to You: {capaCode}',
    bodyHtml: createEmailHtml(
      'CAPA Assignment - Action Required',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A Corrective and Preventive Action (CAPA) has been assigned to you:</p>
      <table style="${emailStyles.table}">
        ${tableRow('CAPA Code', '{capaCode}')}
        ${tableRow('Title', '{entityName}')}
        ${tableRow('Due Date', '{dueDate}', true)}
      </table>
      <p style="${emailStyles.paragraph}">Please take appropriate action to address this CAPA within the specified timeline.</p>`,
      'View CAPA'
    ),
    bodyText: `Dear {recipientName},

A Corrective and Preventive Action (CAPA) has been assigned to you:

CAPA Code: {capaCode}
Title: {entityName}
Due Date: {dueDate}

Please take appropriate action to address this CAPA within the specified timeline.

View CAPA: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'capaCode', 'entityName', 'dueDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ENGAGEMENT_ASSIGNED',
    name: 'Engagement Assigned',
    description: 'Sent when an audit engagement is assigned to a user',
    category: 'audit',
    subject: 'Audit Engagement Assignment: {engagementCode}',
    bodyHtml: createEmailHtml(
      'Audit Engagement Assignment',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">You have been assigned to the following audit engagement:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Engagement Code', '{engagementCode}')}
        ${tableRow('Engagement Name', '{entityName}')}
        ${tableRow('Your Role', '{role}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the engagement details and prepare accordingly.</p>`,
      'View Engagement'
    ),
    bodyText: `Dear {recipientName},

You have been assigned to the following audit engagement:

Engagement Code: {engagementCode}
Engagement Name: {entityName}
Your Role: {role}

Please review the engagement details and prepare accordingly.

View Engagement: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'engagementCode', 'entityName', 'role', 'entityLink']),
    module: "grc",
  },
  {
    code: 'POLICY_ASSIGNED',
    name: 'Policy Assigned',
    description: 'Sent when a policy is assigned to a user',
    category: 'governance',
    subject: 'Policy Assigned: {entityName}',
    bodyHtml: createEmailHtml(
      'Policy Assignment',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">You have been assigned to the following policy:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Policy Name', '{entityName}')}
        ${tableRow('Review Date', '{reviewDate}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the policy and ensure compliance.</p>`,
      'View Policy'
    ),
    bodyText: `Dear {recipientName},

You have been assigned to the following policy:

Policy Name: {entityName}
Review Date: {reviewDate}

Please review the policy and ensure compliance.

View Policy: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'reviewDate', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ASSET_ASSIGNED',
    name: 'Asset Assigned',
    description: 'Sent when an asset is assigned to a user',
    category: 'asset',
    subject: 'Asset {role} Assignment: {assetCode}',
    bodyHtml: createEmailHtml(
      'Asset Assignment',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">You have been assigned as <strong>{role}</strong> for the following asset:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Asset Code', '{assetCode}')}
        ${tableRow('Asset Name', '{entityName}')}
        ${tableRow('Your Role', '{role}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the asset details and manage accordingly.</p>`,
      'View Asset'
    ),
    bodyText: `Dear {recipientName},

You have been assigned as {role} for the following asset:

Asset Code: {assetCode}
Asset Name: {entityName}
Your Role: {role}

Please review the asset details and manage accordingly.

View Asset: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assetCode', 'entityName', 'role', 'entityLink']),
    module: "grc",
  },
  {
    code: 'PROCESS_ASSIGNED',
    name: 'Process Assigned',
    description: 'Sent when a process is assigned to a user',
    category: 'process',
    subject: 'Process {role} Assignment: {entityName}',
    bodyHtml: createEmailHtml(
      'Process Assignment',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">You have been assigned as <strong>{role}</strong> for the following process:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Process Name', '{entityName}')}
        ${tableRow('Your Role', '{role}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the process and take necessary action.</p>`,
      'View Process'
    ),
    bodyText: `Dear {recipientName},

You have been assigned as {role} for the following process:

Process Name: {entityName}
Your Role: {role}

Please review the process and take necessary action.

View Process: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'role', 'entityLink']),
    module: "grc",
  },
  {
    code: 'ISSUE_EVIDENCE',
    name: 'Issue from Evidence Review',
    description: 'Sent when AI creates an issue from evidence review',
    category: 'issue',
    subject: 'Issue Created from Evidence Review: {evidenceName}',
    bodyHtml: createEmailHtml(
      'Issue Created from AI Evidence Review',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">An issue has been automatically generated from the AI review of the following evidence:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Evidence Name', '{evidenceName}')}
        ${tableRow('Review Status', 'Non-compliant')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the issue and take appropriate action.</p>`,
      'View Issue'
    ),
    bodyText: `Dear {recipientName},

An issue has been automatically generated from the AI review of the following evidence:

Evidence Name: {evidenceName}
Review Status: Non-compliant

Please review the issue and take appropriate action.

View Issue: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'evidenceName', 'entityLink']),
    module: "grc",
  },

  // ===================== WORKFLOW EVENTS =====================
  {
    code: 'SYSTEM_ANNOUNCEMENT',
    name: 'System Announcement',
    description: 'Sent for system-wide announcements',
    category: 'system',
    subject: 'System Announcement: {title}',
    bodyHtml: createEmailHtml(
      'System Announcement',
      colors.info,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">{message}</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

{message}

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'title', 'message', 'entityLink']),
    module: "grc",
  },
  {
    code: 'COMMENT_ADDED',
    name: 'Comment Added',
    description: 'Sent when a comment is added to an entity',
    category: 'notification',
    subject: 'New Comment on {entityType}: {entityName}',
    bodyHtml: createEmailHtml(
      'New Comment',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A new comment has been added:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Entity Type', '{entityType}')}
        ${tableRow('Entity Name', '{entityName}')}
        ${tableRow('Comment By', '{actorName} ({senderUsername})')}
      </table>
      <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid ${colors.primary}; margin: 15px 0;">
        <p style="margin: 0; font-style: italic;">"{commentPreview}"</p>
      </div>`,
      'View Comment'
    ),
    bodyText: `Dear {recipientName},

A new comment has been added:

Entity Type: {entityType}
Entity Name: {entityName}
Comment By: {actorName} ({senderUsername})

Comment: "{commentPreview}"

View Comment: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityType', 'entityName', 'actorName', 'senderUsername', 'recipientUsername', 'commentPreview', 'entityLink']),
    module: "grc",
  },
  {
    code: 'APPROVAL_REQUESTED',
    name: 'Approval Requested',
    description: 'Sent when approval is requested from a user',
    category: 'notification',
    subject: 'Approval Required: {entityType} - {entityName}',
    bodyHtml: createEmailHtml(
      'Approval Required',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Your approval is required for the following:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Type', '{entityType}')}
        ${tableRow('Name', '{entityName}')}
        ${tableRow('Requested By', '{actorName} ({senderUsername})')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and take appropriate action.</p>`,
      'Review & Approve'
    ),
    bodyText: `Dear {recipientName},

Your approval is required for the following:

Type: {entityType}
Name: {entityName}
Requested By: {actorName} ({senderUsername})

Please review and take appropriate action.

Review & Approve: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityType', 'entityName', 'actorName', 'senderUsername', 'recipientUsername', 'entityLink']),
    module: "grc",
  },
  {
    code: 'APPROVAL_GRANTED',
    name: 'Approval Granted',
    description: 'Sent when an approval is granted',
    category: 'notification',
    subject: 'Approved: {entityType} - {entityName}',
    bodyHtml: createEmailHtml(
      'Approval Granted',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Your request has been approved:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Type', '{entityType}')}
        ${tableRow('Name', '{entityName}')}
        ${tableRow('Approved By', '{actorName} ({senderUsername})')}
      </table>
      <p style="${emailStyles.paragraph}">You may now proceed with the next steps.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

Your request has been approved:

Type: {entityType}
Name: {entityName}
Approved By: {actorName} ({senderUsername})

You may now proceed with the next steps.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityType', 'entityName', 'actorName', 'senderUsername', 'recipientUsername', 'entityLink']),
    module: "grc",
  },
  {
    code: 'APPROVAL_DENIED',
    name: 'Approval Denied',
    description: 'Sent when an approval is denied/rejected',
    category: 'notification',
    subject: 'Rejected: {entityType} - {entityName}',
    bodyHtml: createEmailHtml(
      'Approval Denied',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Your request has been rejected:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Type', '{entityType}')}
        ${tableRow('Name', '{entityName}')}
        ${tableRow('Rejected By', '{actorName} ({senderUsername})')}
        ${tableRow('Reason', '{reason}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review and address the concerns before resubmitting.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

Your request has been rejected:

Type: {entityType}
Name: {entityName}
Rejected By: {actorName} ({senderUsername})
Reason: {reason}

Please review and address the concerns before resubmitting.

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityType', 'entityName', 'actorName', 'senderUsername', 'recipientUsername', 'reason', 'entityLink']),
    module: "grc",
  },
  {
    code: 'SENT_BACK',
    name: 'Sent Back for Revision',
    description: 'Sent when an item is sent back for revision',
    category: 'notification',
    subject: 'Revision Required: {entityType} - {entityName}',
    bodyHtml: createEmailHtml(
      'Sent Back for Revision',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following has been sent back for revision:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Type', '{entityType}')}
        ${tableRow('Name', '{entityName}')}
        ${tableRow('Sent Back By', '{actorName} ({senderUsername})')}
        ${tableRow('Reason', '{reason}')}
      </table>
      <p style="${emailStyles.paragraph}">Please address the feedback and resubmit.</p>`,
      'View & Revise'
    ),
    bodyText: `Dear {recipientName},

The following has been sent back for revision:

Type: {entityType}
Name: {entityName}
Sent Back By: {actorName} ({senderUsername})
Reason: {reason}

Please address the feedback and resubmit.

View & Revise: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityType', 'entityName', 'actorName', 'senderUsername', 'recipientUsername', 'reason', 'entityLink']),
    module: "grc",
  },
  {
    code: 'FEEDBACK_REQUESTED',
    name: 'Feedback Requested',
    description: 'Sent when feedback is requested from a user',
    category: 'notification',
    subject: 'Feedback Requested: {entityType} - {entityName}',
    bodyHtml: createEmailHtml(
      'Feedback Requested',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Your feedback has been requested for the following:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Type', '{entityType}')}
        ${tableRow('Name', '{entityName}')}
        ${tableRow('Requested By', '{actorName} ({senderUsername})')}
      </table>
      <p style="${emailStyles.paragraph}">Please provide your feedback at your earliest convenience.</p>`,
      'Provide Feedback'
    ),
    bodyText: `Dear {recipientName},

Your feedback has been requested for the following:

Type: {entityType}
Name: {entityName}
Requested By: {actorName} ({senderUsername})

Please provide your feedback at your earliest convenience.

Provide Feedback: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityType', 'entityName', 'actorName', 'senderUsername', 'recipientUsername', 'entityLink']),
    module: "grc",
  },
  {
    code: 'STATUS_CHANGED',
    name: 'Status Changed',
    description: 'Sent when the status of an entity changes',
    category: 'notification',
    subject: 'Status Update: {entityType} - {entityName}',
    bodyHtml: createEmailHtml(
      'Status Update',
      colors.info,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The status has been updated for the following:</p>
      <table style="${emailStyles.table}">
        ${tableRow('Type', '{entityType}')}
        ${tableRow('Name', '{entityName}')}
        ${tableRow('Previous Status', '{previousStatus}')}
        ${tableRow('New Status', '{newStatus}')}
        ${tableRow('Changed By', '{actorName} ({senderUsername})')}
      </table>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The status has been updated for the following:

Type: {entityType}
Name: {entityName}
Previous Status: {previousStatus}
New Status: {newStatus}
Changed By: {actorName} ({senderUsername})

View Details: {entityLink}

Best regards,
GRC Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'entityType', 'entityName', 'previousStatus', 'newStatus', 'actorName', 'senderUsername', 'recipientUsername', 'entityLink']),
    module: "grc",
  },
];

async function seedEmailTemplates() {
  console.log('Seeding email templates...');
  console.log(`Total templates to process: ${EMAIL_TEMPLATES.length}`);

  let created = 0;
  let updated = 0;

  for (const template of EMAIL_TEMPLATES) {
    try {
      // Check if template already exists
      const existing = await prisma.emailTemplate.findUnique({
        where: { code: template.code },
      });

      if (existing) {
        // Update existing template
        await prisma.emailTemplate.update({
          where: { code: template.code },
          data: {
            name: template.name,
            description: template.description,
            category: template.category,
            subject: template.subject,
            bodyHtml: template.bodyHtml,
            bodyText: template.bodyText,
            placeholders: template.placeholders,
            isSystem: true,
          },
        });
        updated++;
        console.log(`✓ Updated template: ${template.code}`);
      } else {
        // Create new template
        await prisma.emailTemplate.create({
          data: {
            ...template,
            isSystem: true,
            isActive: true,
          },
        });
        created++;
        console.log(`✓ Created template: ${template.code}`);
      }
    } catch (error) {
      console.error(`✗ Error seeding template ${template.code}:`, error);
    }
  }

  console.log('\n========================================');
  console.log(`Email templates seeded successfully!`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Total: ${created + updated}`);
  console.log('========================================');
}

// Export for use in main seed.ts
export { EMAIL_TEMPLATES, seedEmailTemplates };

// Run standalone if this file is executed directly
// Check if this module is the main module (not imported)
const isMainModule = require.main === module || process.argv[1]?.includes('seed-email-templates');

if (isMainModule) {
  seedEmailTemplates()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

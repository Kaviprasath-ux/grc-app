/**
 * Seed TPRM Email Templates
 *
 * This script seeds all 39 TPRM email templates.
 * Run with: npx tsx prisma/seed-tprm-email-templates.ts
 *
 * Templates are organized by category:
 * - TPRM User Management (2 templates)
 * - TPRM Vendor Management (2 templates)
 * - TPRM Assessment (12 templates)
 * - TPRM Remediation (9 templates)
 * - TPRM Vendor Issues (3 templates)
 * - TPRM Offboarding (7 templates)
 * - TPRM Support (2 templates)
 * - TPRM Monitoring (2 templates)
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
    <p style="margin: 5px 0 0 0;"><strong>TPRM Platform Team</strong></p>
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

// ==================== TPRM EMAIL TEMPLATES ====================

const TPRM_EMAIL_TEMPLATES = [
  // ===================== TPRM USER MANAGEMENT =====================
  {
    code: 'TPRM_ACCOUNT_CREATED',
    name: 'TPRM Account Created',
    description: 'Welcome email sent when a new TPRM user account is created',
    category: 'TPRM User Management',
    subject: 'Welcome to TPRM Platform – Your Account Has Been Created',
    bodyHtml: createEmailHtml(
      'Welcome to TPRM Platform',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Your account has been created on the TPRM (Third-Party Risk Management) platform. You can now access the system and begin your assigned tasks.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Role', '{tprmRole}')}
      </table>
      <p style="${emailStyles.paragraph}">Please log in to the platform to get started. If you have any questions or need assistance, please contact your administrator.</p>`,
      'Access TPRM Platform'
    ),
    bodyText: `Dear {recipientName},

Your account has been created on the TPRM (Third-Party Risk Management) platform. You can now access the system and begin your assigned tasks.

Role: {tprmRole}

Please log in to the platform to get started. If you have any questions or need assistance, please contact your administrator.

Access TPRM Platform: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'tprmRole', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_RM_ACCOUNT_CREATED',
    name: 'RM Account Created Notice',
    description: 'Notification sent to admins when a new Relationship Manager account is created',
    category: 'TPRM User Management',
    subject: 'New Relationship Manager Account Created – {rmName}',
    bodyHtml: createEmailHtml(
      'New RM Account Created',
      colors.info,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A new Relationship Manager account has been created on the TPRM platform. Please review the details below.</p>
      <table style="${emailStyles.table}">
        ${tableRow('RM Name', '{rmName}')}
        ${tableRow('Email', '{rmEmail}')}
      </table>
      <p style="${emailStyles.paragraph}">Please ensure the appropriate vendor assignments are configured for this new RM.</p>`,
      'View User Details'
    ),
    bodyText: `Dear {recipientName},

A new Relationship Manager account has been created on the TPRM platform.

RM Name: {rmName}
Email: {rmEmail}

Please ensure the appropriate vendor assignments are configured for this new RM.

View User Details: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'rmName', 'rmEmail', 'entityLink']),
    module: "tprm",
  },

  // ===================== TPRM VENDOR MANAGEMENT =====================
  {
    code: 'TPRM_VENDOR_ONBOARDED',
    name: 'Vendor Onboarded',
    description: 'Sent when a new vendor is successfully onboarded',
    category: 'TPRM Vendor Management',
    subject: 'Vendor Onboarded – {vendorName} ({vendorCode})',
    bodyHtml: createEmailHtml(
      'Vendor Successfully Onboarded',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A new vendor has been successfully onboarded to the TPRM platform.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor Code', '{vendorCode}')}
        ${tableRow('Vendor Name', '{vendorName}')}
      </table>
      <p style="${emailStyles.paragraph}">You may now initiate assessments and manage this vendor through the platform.</p>`,
      'View Vendor Details'
    ),
    bodyText: `Dear {recipientName},

A new vendor has been successfully onboarded to the TPRM platform.

Vendor Code: {vendorCode}
Vendor Name: {vendorName}

You may now initiate assessments and manage this vendor through the platform.

View Vendor Details: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorCode', 'vendorName', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_VENDOR_OFFBOARDING',
    name: 'Vendor Offboarding Started',
    description: 'Sent when vendor offboarding process is initiated',
    category: 'TPRM Vendor Management',
    subject: 'URGENT: Vendor Offboarding Initiated – {vendorName} ({vendorCode})',
    bodyHtml: createEmailHtml(
      'Vendor Offboarding Initiated',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The offboarding process has been initiated for the following vendor. Please take necessary actions to ensure a smooth transition.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor Code', '{vendorCode}')}
        ${tableRow('Vendor Name', '{vendorName}', true)}
      </table>
      <p style="${emailStyles.paragraph}"><strong>Action Required:</strong> Please review all active contracts, assessments, and data associated with this vendor and begin the offboarding procedures.</p>`,
      'View Offboarding Details'
    ),
    bodyText: `Dear {recipientName},

URGENT: The offboarding process has been initiated for the following vendor.

Vendor Code: {vendorCode}
Vendor Name: {vendorName}

Action Required: Please review all active contracts, assessments, and data associated with this vendor and begin the offboarding procedures.

View Offboarding Details: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorCode', 'vendorName', 'entityLink']),
    module: "tprm",
  },

  // ===================== TPRM ASSESSMENT LIFECYCLE =====================
  {
    code: 'TPRM_ASSESSMENT_INITIATED',
    name: 'Assessment Initiated',
    description: 'Sent when a new vendor assessment is initiated',
    category: 'TPRM Assessment',
    subject: 'Assessment Initiated – {assessmentCode} for {vendorName}',
    bodyHtml: createEmailHtml(
      'Assessment Initiated',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A new vendor assessment has been initiated. Please review the details below.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Vendor', '{vendorName}')}
      </table>
      <p style="${emailStyles.paragraph}">Please proceed with the assessment according to the established procedures.</p>`,
      'View Assessment'
    ),
    bodyText: `Dear {recipientName},

A new vendor assessment has been initiated.

Assessment Code: {assessmentCode}
Vendor: {vendorName}

Please proceed with the assessment according to the established procedures.

View Assessment: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'vendorName', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_ASSESSMENT_ASSIGNED',
    name: 'Assessment Assigned',
    description: 'Sent when an assessment is assigned to an assessor',
    category: 'TPRM Assessment',
    subject: 'Assessment Assigned to You – {assessmentCode} for {vendorName}',
    bodyHtml: createEmailHtml(
      'Assessment Assigned',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">You have been assigned as the assessor for the following vendor assessment. Please begin your review at your earliest convenience.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Vendor', '{vendorName}')}
      </table>
      <p style="${emailStyles.paragraph}">Please log in to the platform to access the assessment questionnaire and begin your evaluation.</p>`,
      'Start Assessment'
    ),
    bodyText: `Dear {recipientName},

You have been assigned as the assessor for the following vendor assessment.

Assessment Code: {assessmentCode}
Vendor: {vendorName}

Please log in to the platform to access the assessment questionnaire and begin your evaluation.

Start Assessment: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'vendorName', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_ASSESSMENT_REASSIGNED',
    name: 'Assessment Reassigned',
    description: 'Sent to the previous assessor when an assessment is reassigned',
    category: 'TPRM Assessment',
    subject: 'Assessment Reassigned – {assessmentCode}',
    bodyHtml: createEmailHtml(
      'Assessment Reassigned',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following assessment has been reassigned to a different assessor. You are no longer responsible for this assessment.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('New Assessor', '{newAssessorName}')}
      </table>
      <p style="${emailStyles.paragraph}">If you have any questions regarding this reassignment, please contact your administrator.</p>`,
      'View Assessment'
    ),
    bodyText: `Dear {recipientName},

The following assessment has been reassigned to a different assessor. You are no longer responsible for this assessment.

Assessment Code: {assessmentCode}
New Assessor: {newAssessorName}

If you have any questions regarding this reassignment, please contact your administrator.

View Assessment: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'newAssessorName', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_ASSESSMENT_SUBMITTED',
    name: 'Assessment Submitted',
    description: 'Sent when an assessment is submitted for review',
    category: 'TPRM Assessment',
    subject: 'Assessment Submitted for Review – {assessmentCode} ({vendorName})',
    bodyHtml: createEmailHtml(
      'Assessment Submitted for Review',
      colors.info,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following vendor assessment has been submitted and is ready for your review.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Vendor', '{vendorName}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the assessment responses and provide your feedback or approval.</p>`,
      'Review Assessment'
    ),
    bodyText: `Dear {recipientName},

The following vendor assessment has been submitted and is ready for your review.

Assessment Code: {assessmentCode}
Vendor: {vendorName}

Please review the assessment responses and provide your feedback or approval.

Review Assessment: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'vendorName', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_ASSESSMENT_SENT_TO_APPROVER',
    name: 'Assessment Sent to Approver',
    description: 'Sent when an assessment is forwarded to the approver for final approval',
    category: 'TPRM Assessment',
    subject: 'Assessment Awaiting Your Approval – {assessmentCode} ({vendorName})',
    bodyHtml: createEmailHtml(
      'Assessment Awaiting Approval',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following vendor assessment has been reviewed and is now awaiting your final approval.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Assessor', '{assessorName}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the assessment and provide your approval or return it for further work.</p>`,
      'Approve Assessment'
    ),
    bodyText: `Dear {recipientName},

The following vendor assessment has been reviewed and is now awaiting your final approval.

Assessment Code: {assessmentCode}
Vendor: {vendorName}
Assessor: {assessorName}

Please review the assessment and provide your approval or return it for further work.

Approve Assessment: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'vendorName', 'assessorName', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_ASSESSMENT_COMPLETED',
    name: 'Assessment Completed',
    description: 'Sent when an assessment review is completed',
    category: 'TPRM Assessment',
    subject: 'Assessment Review Completed – {assessmentCode} ({vendorName})',
    bodyHtml: createEmailHtml(
      'Assessment Review Completed',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The review for the following vendor assessment has been completed.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Vendor', '{vendorName}')}
      </table>
      <p style="${emailStyles.paragraph}">Please log in to the platform to view the assessment results and any recommended actions.</p>`,
      'View Results'
    ),
    bodyText: `Dear {recipientName},

The review for the following vendor assessment has been completed.

Assessment Code: {assessmentCode}
Vendor: {vendorName}

Please log in to the platform to view the assessment results and any recommended actions.

View Results: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'vendorName', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_ASSESSMENT_APPROVED',
    name: 'Assessment Approved',
    description: 'Sent when an assessment is approved by the approver',
    category: 'TPRM Assessment',
    subject: 'Assessment Approved – {assessmentCode} ({vendorName})',
    bodyHtml: createEmailHtml(
      'Assessment Approved',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following vendor assessment has been approved.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Approved By', '{approverName}')}
      </table>
      <p style="${emailStyles.paragraph}">The assessment is now finalized. Any remediation items identified will be tracked separately.</p>`,
      'View Assessment'
    ),
    bodyText: `Dear {recipientName},

The following vendor assessment has been approved.

Assessment Code: {assessmentCode}
Vendor: {vendorName}
Approved By: {approverName}

The assessment is now finalized. Any remediation items identified will be tracked separately.

View Assessment: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'vendorName', 'approverName', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_ASSESSMENT_RETURNED',
    name: 'Assessment Returned for Rework',
    description: 'Sent when an assessment is returned to the assessor for rework',
    category: 'TPRM Assessment',
    subject: 'URGENT: Assessment Returned for Rework – {assessmentCode} ({vendorName})',
    bodyHtml: createEmailHtml(
      'Assessment Returned for Rework',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The following assessment has been returned and requires rework. Please address the feedback provided.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Reason', '{reason}', true)}
      </table>
      <p style="${emailStyles.paragraph}"><strong>Action Required:</strong> Please review the feedback, make the necessary corrections, and resubmit the assessment.</p>`,
      'Rework Assessment'
    ),
    bodyText: `Dear {recipientName},

URGENT: The following assessment has been returned and requires rework.

Assessment Code: {assessmentCode}
Vendor: {vendorName}
Reason: {reason}

Action Required: Please review the feedback, make the necessary corrections, and resubmit the assessment.

Rework Assessment: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'vendorName', 'reason', 'entityLink']),
    module: "tprm",
  },

  // ===================== TPRM ASSESSMENT COLLABORATION =====================
  {
    code: 'TPRM_CLARIFICATION_REQUESTED',
    name: 'Clarification Requested',
    description: 'Sent when a clarification is requested on an assessment',
    category: 'TPRM Assessment',
    subject: 'Clarification Requested – {assessmentCode} ({vendorName})',
    bodyHtml: createEmailHtml(
      'Clarification Requested',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A clarification has been requested on the following assessment. Please respond at your earliest convenience.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Comment', '{comment}')}
      </table>
      <p style="${emailStyles.paragraph}">Please log in and provide the requested clarification.</p>`,
      'Respond to Clarification'
    ),
    bodyText: `Dear {recipientName},

A clarification has been requested on the following assessment.

Assessment Code: {assessmentCode}
Vendor: {vendorName}
Comment: {comment}

Please log in and provide the requested clarification.

Respond to Clarification: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'vendorName', 'comment', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_COMMENT_ADDED',
    name: 'Comment Added',
    description: 'Sent when a new comment is added to an assessment',
    category: 'TPRM Assessment',
    subject: 'New Comment on Assessment – {assessmentCode}',
    bodyHtml: createEmailHtml(
      'New Comment Added',
      colors.info,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A new comment has been added to an assessment you are involved with.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Comment Preview', '{commentPreview}')}
      </table>
      <p style="${emailStyles.paragraph}">Please log in to view the full comment and respond if needed.</p>`,
      'View Comment'
    ),
    bodyText: `Dear {recipientName},

A new comment has been added to an assessment you are involved with.

Assessment Code: {assessmentCode}
Comment Preview: {commentPreview}

Please log in to view the full comment and respond if needed.

View Comment: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'commentPreview', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_OVERRIDE_APPLIED',
    name: 'AI Override Applied',
    description: 'Sent when an AI scoring override is applied to an assessment',
    category: 'TPRM Assessment',
    subject: 'AI Override Applied – {assessmentCode}',
    bodyHtml: createEmailHtml(
      'AI Override Applied',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">An AI scoring override has been applied to the following assessment. Please review the updated status.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Status', '{status}')}
      </table>
      <p style="${emailStyles.paragraph}">Please verify the override is appropriate and take any necessary follow-up actions.</p>`,
      'Review Override'
    ),
    bodyText: `Dear {recipientName},

An AI scoring override has been applied to the following assessment.

Assessment Code: {assessmentCode}
Status: {status}

Please verify the override is appropriate and take any necessary follow-up actions.

Review Override: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'status', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_SME_ASSIGNED',
    name: 'SME Assigned to Question',
    description: 'Sent when a Subject Matter Expert is assigned to a specific assessment question',
    category: 'TPRM Assessment',
    subject: 'You Have Been Assigned as SME – {assessmentCode}',
    bodyHtml: createEmailHtml(
      'SME Assignment',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">You have been assigned as a Subject Matter Expert (SME) for a specific question in the following assessment.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Question', '{questionTitle}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the question and provide your expert input to support the assessment process.</p>`,
      'Review Question'
    ),
    bodyText: `Dear {recipientName},

You have been assigned as a Subject Matter Expert (SME) for a specific question in the following assessment.

Assessment Code: {assessmentCode}
Question: {questionTitle}

Please review the question and provide your expert input to support the assessment process.

Review Question: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'questionTitle', 'entityLink']),
    module: "tprm",
  },

  // ===================== TPRM REMEDIATION WORKFLOW =====================
  {
    code: 'TPRM_REMEDIATION_CREATED',
    name: 'Remediation Items Created',
    description: 'Sent when remediation items are created after assessment approval',
    category: 'TPRM Remediation',
    subject: 'URGENT: Remediation Items Created – {assessmentCode} ({vendorName})',
    bodyHtml: createEmailHtml(
      'Remediation Items Created',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">Remediation items have been created following the approval of a vendor assessment. Immediate attention is required.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Items Count', '{count}', true)}
      </table>
      <p style="${emailStyles.paragraph}"><strong>Action Required:</strong> Please review the remediation items and begin addressing them according to the specified timelines.</p>`,
      'View Remediation Items'
    ),
    bodyText: `Dear {recipientName},

URGENT: Remediation items have been created following the approval of a vendor assessment.

Assessment Code: {assessmentCode}
Vendor: {vendorName}
Items Count: {count}

Action Required: Please review the remediation items and begin addressing them according to the specified timelines.

View Remediation Items: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'assessmentCode', 'vendorName', 'count', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_REMEDIATION_SUBMITTED',
    name: 'Remediation Response Submitted',
    description: 'Sent when the Account Manager submits a remediation response',
    category: 'TPRM Remediation',
    subject: 'Remediation Response Submitted – {vendorName}: {questionTitle}',
    bodyHtml: createEmailHtml(
      'Remediation Response Submitted',
      colors.info,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A remediation response has been submitted for your review.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Question', '{questionTitle}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the submitted response and provide your assessment.</p>`,
      'Review Response'
    ),
    bodyText: `Dear {recipientName},

A remediation response has been submitted for your review.

Vendor: {vendorName}
Question: {questionTitle}

Please review the submitted response and provide your assessment.

Review Response: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'questionTitle', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_REMEDIATION_SATISFIED',
    name: 'Remediation Marked Satisfactory',
    description: 'Sent when a remediation item is marked as satisfactory',
    category: 'TPRM Remediation',
    subject: 'Remediation Satisfactory – {vendorName}: {questionTitle}',
    bodyHtml: createEmailHtml(
      'Remediation Marked Satisfactory',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A remediation item has been reviewed and marked as satisfactory.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Issue Code', '{issueCode}')}
      </table>
      <p style="${emailStyles.paragraph}">No further action is required for this item.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

A remediation item has been reviewed and marked as satisfactory.

Vendor: {vendorName}
Question: {questionTitle}
Issue Code: {issueCode}

No further action is required for this item.

View Details: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'questionTitle', 'issueCode', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_REMEDIATION_UNSATISFIED',
    name: 'Remediation Unsatisfactory',
    description: 'Sent when a remediation item is marked as unsatisfactory',
    category: 'TPRM Remediation',
    subject: 'URGENT: Remediation Unsatisfactory – {vendorName}: {questionTitle}',
    bodyHtml: createEmailHtml(
      'Remediation Unsatisfactory',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A remediation item has been reviewed and marked as <strong>unsatisfactory</strong>. Further action is required.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Issue Code', '{issueCode}')}
        ${tableRow('Reason', '{reason}', true)}
      </table>
      <p style="${emailStyles.paragraph}"><strong>Action Required:</strong> Please address the identified deficiencies and resubmit your remediation response.</p>`,
      'Address Remediation'
    ),
    bodyText: `Dear {recipientName},

URGENT: A remediation item has been reviewed and marked as unsatisfactory.

Vendor: {vendorName}
Question: {questionTitle}
Issue Code: {issueCode}
Reason: {reason}

Action Required: Please address the identified deficiencies and resubmit your remediation response.

Address Remediation: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'questionTitle', 'issueCode', 'reason', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_REMEDIATION_SENT_TO_BUSINESS',
    name: 'Remediation Sent to Business/RM',
    description: 'Sent when a remediation item is forwarded to the business or Relationship Manager',
    category: 'TPRM Remediation',
    subject: 'Remediation Item Forwarded to You – {vendorName}: {questionTitle}',
    bodyHtml: createEmailHtml(
      'Remediation Sent to Business',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A remediation item has been forwarded to you for action.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Issue Code', '{issueCode}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the item and coordinate with the vendor to address the identified gap.</p>`,
      'View Remediation'
    ),
    bodyText: `Dear {recipientName},

A remediation item has been forwarded to you for action.

Vendor: {vendorName}
Question: {questionTitle}
Issue Code: {issueCode}

Please review the item and coordinate with the vendor to address the identified gap.

View Remediation: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'questionTitle', 'issueCode', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_REMEDIATION_ASSIGNED_TO_IT',
    name: 'Remediation Assigned to IT/RM',
    description: 'Sent when a remediation item is assigned to IT or Relationship Manager',
    category: 'TPRM Remediation',
    subject: 'Remediation Item Assigned to You (IT) – {vendorName}: {questionTitle}',
    bodyHtml: createEmailHtml(
      'Remediation Assigned to IT',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A remediation item has been assigned to you for IT review and action.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Issue Code', '{issueCode}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the technical aspects and provide your response.</p>`,
      'View Assignment'
    ),
    bodyText: `Dear {recipientName},

A remediation item has been assigned to you for IT review and action.

Vendor: {vendorName}
Question: {questionTitle}
Issue Code: {issueCode}

Please review the technical aspects and provide your response.

View Assignment: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'questionTitle', 'issueCode', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_REMEDIATION_IT_SUBMITTED',
    name: 'IT Remediation Response Submitted',
    description: 'Sent when IT submits their remediation response',
    category: 'TPRM Remediation',
    subject: 'IT Remediation Response Submitted – {vendorName}: {questionTitle}',
    bodyHtml: createEmailHtml(
      'IT Remediation Response Submitted',
      colors.info,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">IT has submitted their remediation response for the following item. Please review.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Issue Code', '{issueCode}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the IT response and determine if the remediation is acceptable.</p>`,
      'Review IT Response'
    ),
    bodyText: `Dear {recipientName},

IT has submitted their remediation response for the following item.

Vendor: {vendorName}
Question: {questionTitle}
Issue Code: {issueCode}

Please review the IT response and determine if the remediation is acceptable.

Review IT Response: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'questionTitle', 'issueCode', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_REMEDIATION_IT_APPROVED',
    name: 'IT Remediation Approved',
    description: 'Sent when IT remediation response is approved',
    category: 'TPRM Remediation',
    subject: 'IT Remediation Approved – {vendorName}: {questionTitle}',
    bodyHtml: createEmailHtml(
      'IT Remediation Approved',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The IT remediation response for the following item has been approved.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Issue Code', '{issueCode}')}
      </table>
      <p style="${emailStyles.paragraph}">This remediation item is now resolved. No further action is required.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

The IT remediation response for the following item has been approved.

Vendor: {vendorName}
Question: {questionTitle}
Issue Code: {issueCode}

This remediation item is now resolved. No further action is required.

View Details: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'questionTitle', 'issueCode', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_REMEDIATION_IT_RETURNED',
    name: 'IT Remediation Returned',
    description: 'Sent when IT remediation response is returned for rework',
    category: 'TPRM Remediation',
    subject: 'URGENT: IT Remediation Returned – {vendorName}: {questionTitle}',
    bodyHtml: createEmailHtml(
      'IT Remediation Returned',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The IT remediation response has been returned and requires rework.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Question', '{questionTitle}')}
        ${tableRow('Issue Code', '{issueCode}')}
        ${tableRow('Reason', '{reason}', true)}
      </table>
      <p style="${emailStyles.paragraph}"><strong>Action Required:</strong> Please address the feedback and resubmit your IT remediation response.</p>`,
      'Rework Remediation'
    ),
    bodyText: `Dear {recipientName},

URGENT: The IT remediation response has been returned and requires rework.

Vendor: {vendorName}
Question: {questionTitle}
Issue Code: {issueCode}
Reason: {reason}

Action Required: Please address the feedback and resubmit your IT remediation response.

Rework Remediation: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'questionTitle', 'issueCode', 'reason', 'entityLink']),
    module: "tprm",
  },

  // ===================== TPRM VENDOR ISSUES =====================
  {
    code: 'TPRM_VENDOR_ISSUE_CREATED',
    name: 'Vendor Issue Created',
    description: 'Sent when a new vendor issue is created',
    category: 'TPRM Vendor Issues',
    subject: 'URGENT: Vendor Issue Created – {vendorName}: {issueTitle}',
    bodyHtml: createEmailHtml(
      'Vendor Issue Created',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A new vendor issue has been created and requires your attention.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Issue Title', '{issueTitle}', true)}
      </table>
      <p style="${emailStyles.paragraph}"><strong>Action Required:</strong> Please review the issue details and take appropriate action to address it.</p>`,
      'View Issue'
    ),
    bodyText: `Dear {recipientName},

URGENT: A new vendor issue has been created and requires your attention.

Vendor: {vendorName}
Issue Title: {issueTitle}

Action Required: Please review the issue details and take appropriate action to address it.

View Issue: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'issueTitle', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_VENDOR_ISSUE_UPDATED',
    name: 'Vendor Issue Updated',
    description: 'Sent when a vendor issue status is updated',
    category: 'TPRM Vendor Issues',
    subject: 'Vendor Issue Updated – {vendorName}: {issueTitle}',
    bodyHtml: createEmailHtml(
      'Vendor Issue Updated',
      colors.info,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A vendor issue you are tracking has been updated.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Issue Title', '{issueTitle}')}
        ${tableRow('New Status', '{newStatus}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the updated status and take any necessary follow-up actions.</p>`,
      'View Issue'
    ),
    bodyText: `Dear {recipientName},

A vendor issue you are tracking has been updated.

Vendor: {vendorName}
Issue Title: {issueTitle}
New Status: {newStatus}

Please review the updated status and take any necessary follow-up actions.

View Issue: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'issueTitle', 'newStatus', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_VENDOR_ISSUE_RESOLVED',
    name: 'Vendor Issue Resolved',
    description: 'Sent when a vendor issue is resolved',
    category: 'TPRM Vendor Issues',
    subject: 'Vendor Issue Resolved – {vendorName}: {issueTitle}',
    bodyHtml: createEmailHtml(
      'Vendor Issue Resolved',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A vendor issue has been resolved.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Issue Title', '{issueTitle}')}
      </table>
      <p style="${emailStyles.paragraph}">The issue has been closed. If you believe this was resolved prematurely, please contact your administrator.</p>`,
      'View Details'
    ),
    bodyText: `Dear {recipientName},

A vendor issue has been resolved.

Vendor: {vendorName}
Issue Title: {issueTitle}

The issue has been closed. If you believe this was resolved prematurely, please contact your administrator.

View Details: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'issueTitle', 'entityLink']),
    module: "tprm",
  },

  // ===================== TPRM OFFBOARDING =====================
  {
    code: 'TPRM_OFFBOARD_SUBMITTED',
    name: 'Offboard Submitted',
    description: 'Sent when a vendor offboard request is submitted',
    category: 'TPRM Offboarding',
    subject: 'Vendor Offboard Submitted – {vendorName} ({assessmentCode})',
    bodyHtml: createEmailHtml(
      'Vendor Offboard Submitted',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A vendor offboard request has been submitted and requires your review.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Assessment Code', '{assessmentCode}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the offboard request and provide your approval or feedback.</p>`,
      'Review Offboard Request'
    ),
    bodyText: `Dear {recipientName},

A vendor offboard request has been submitted and requires your review.

Vendor: {vendorName}
Assessment Code: {assessmentCode}

Please review the offboard request and provide your approval or feedback.

Review Offboard Request: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'assessmentCode', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_OFFBOARD_ASSESSOR_APPROVED',
    name: 'Offboard Assessor Approved',
    description: 'Sent when the assessor approves the offboard request',
    category: 'TPRM Offboarding',
    subject: 'Offboard Assessor Approved – {vendorName} ({assessmentCode})',
    bodyHtml: createEmailHtml(
      'Offboard Approved by Assessor',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The assessor has approved the vendor offboard request. The request will proceed to the next approval stage.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Assessment Code', '{assessmentCode}')}
      </table>
      <p style="${emailStyles.paragraph}">The offboard process is progressing through the approval chain.</p>`,
      'View Offboard Status'
    ),
    bodyText: `Dear {recipientName},

The assessor has approved the vendor offboard request.

Vendor: {vendorName}
Assessment Code: {assessmentCode}

The offboard process is progressing through the approval chain.

View Offboard Status: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'assessmentCode', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_OFFBOARD_ASSESSOR_SENT_BACK',
    name: 'Offboard Assessor Sent Back',
    description: 'Sent when the assessor sends back the offboard request',
    category: 'TPRM Offboarding',
    subject: 'URGENT: Offboard Sent Back by Assessor – {vendorName} ({assessmentCode})',
    bodyHtml: createEmailHtml(
      'Offboard Sent Back by Assessor',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The assessor has sent back the vendor offboard request. Please address the feedback and resubmit.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Reason', '{reason}', true)}
      </table>
      <p style="${emailStyles.paragraph}"><strong>Action Required:</strong> Please review the feedback and resubmit the offboard request.</p>`,
      'Address Feedback'
    ),
    bodyText: `Dear {recipientName},

URGENT: The assessor has sent back the vendor offboard request.

Vendor: {vendorName}
Assessment Code: {assessmentCode}
Reason: {reason}

Action Required: Please review the feedback and resubmit the offboard request.

Address Feedback: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'assessmentCode', 'reason', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_OFFBOARD_RM_APPROVED',
    name: 'Offboard RM Approved',
    description: 'Sent when the Relationship Manager approves the offboard request',
    category: 'TPRM Offboarding',
    subject: 'Offboard RM Approved – {vendorName} ({assessmentCode})',
    bodyHtml: createEmailHtml(
      'Offboard Approved by RM',
      colors.success,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The Relationship Manager has approved the vendor offboard request. The request will proceed to the final approval stage.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Assessment Code', '{assessmentCode}')}
      </table>
      <p style="${emailStyles.paragraph}">The offboard process is nearing completion.</p>`,
      'View Offboard Status'
    ),
    bodyText: `Dear {recipientName},

The Relationship Manager has approved the vendor offboard request.

Vendor: {vendorName}
Assessment Code: {assessmentCode}

The offboard process is nearing completion.

View Offboard Status: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'assessmentCode', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_OFFBOARD_RM_SENT_BACK',
    name: 'Offboard RM Sent Back',
    description: 'Sent when the Relationship Manager sends back the offboard request',
    category: 'TPRM Offboarding',
    subject: 'URGENT: Offboard Sent Back by RM – {vendorName} ({assessmentCode})',
    bodyHtml: createEmailHtml(
      'Offboard Sent Back by RM',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The Relationship Manager has sent back the vendor offboard request. Please address the feedback.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Assessment Code', '{assessmentCode}')}
        ${tableRow('Reason', '{reason}', true)}
      </table>
      <p style="${emailStyles.paragraph}"><strong>Action Required:</strong> Please review the RM's feedback and take corrective action.</p>`,
      'Address Feedback'
    ),
    bodyText: `Dear {recipientName},

URGENT: The Relationship Manager has sent back the vendor offboard request.

Vendor: {vendorName}
Assessment Code: {assessmentCode}
Reason: {reason}

Action Required: Please review the RM's feedback and take corrective action.

Address Feedback: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'assessmentCode', 'reason', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_OFFBOARD_BO_APPROVED',
    name: 'Offboard BO Approved (Final)',
    description: 'Sent when the Business Owner gives final approval for offboarding',
    category: 'TPRM Offboarding',
    subject: 'FINAL: Vendor Offboard Approved – {vendorName} ({assessmentCode})',
    bodyHtml: createEmailHtml(
      'Vendor Offboard Approved (Final)',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The Business Owner has given final approval for the vendor offboard. The vendor will now be fully offboarded from the system.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}', true)}
        ${tableRow('Assessment Code', '{assessmentCode}')}
      </table>
      <p style="${emailStyles.paragraph}"><strong>Important:</strong> Please ensure all contracts, access, and data sharing with this vendor are terminated according to your organization's procedures.</p>`,
      'View Offboard Details'
    ),
    bodyText: `Dear {recipientName},

FINAL: The Business Owner has given final approval for the vendor offboard.

Vendor: {vendorName}
Assessment Code: {assessmentCode}

Important: Please ensure all contracts, access, and data sharing with this vendor are terminated according to your organization's procedures.

View Offboard Details: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'assessmentCode', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_OFFBOARD_BO_SENT_TO_RM',
    name: 'Offboard BO Sent Back to RM',
    description: 'Sent when the Business Owner sends the offboard request back to the RM',
    category: 'TPRM Offboarding',
    subject: 'Offboard Sent Back to RM by BO – {vendorName} ({assessmentCode})',
    bodyHtml: createEmailHtml(
      'Offboard Sent Back to RM by BO',
      colors.warning,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">The Business Owner has sent the offboard request back to the Relationship Manager for further review.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Assessment Code', '{assessmentCode}')}
      </table>
      <p style="${emailStyles.paragraph}">Please coordinate with the Business Owner to address any outstanding concerns before resubmitting.</p>`,
      'View Offboard Request'
    ),
    bodyText: `Dear {recipientName},

The Business Owner has sent the offboard request back to the Relationship Manager for further review.

Vendor: {vendorName}
Assessment Code: {assessmentCode}

Please coordinate with the Business Owner to address any outstanding concerns before resubmitting.

View Offboard Request: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'assessmentCode', 'entityLink']),
    module: "tprm",
  },

  // ===================== TPRM SUPPORT & OTHER =====================
  {
    code: 'TPRM_SUPPORT_REQUEST',
    name: 'Support Request',
    description: 'Sent when a user submits a support request',
    category: 'TPRM Support',
    subject: 'TPRM Support Request from {requesterName} ({company})',
    bodyHtml: createEmailHtml(
      'Support Request Received',
      colors.primary,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A new support request has been submitted on the TPRM platform.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Requester', '{requesterName}')}
        ${tableRow('Company', '{company}')}
        ${tableRow('Phone', '{phone}')}
        ${tableRow('Message', '{message}')}
      </table>
      <p style="${emailStyles.paragraph}">Please respond to this support request at your earliest convenience.</p>`,
      'View Support Request'
    ),
    bodyText: `Dear {recipientName},

A new support request has been submitted on the TPRM platform.

Requester: {requesterName}
Company: {company}
Phone: {phone}
Message: {message}

Please respond to this support request at your earliest convenience.

View Support Request: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'requesterName', 'company', 'phone', 'message', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_CONTRACT_EXPIRY',
    name: 'Contract Expiry Warning',
    description: 'Sent when a vendor contract is approaching its expiry date',
    category: 'TPRM Support',
    subject: 'URGENT: Contract Expiry Warning – {vendorName} ({vendorCode})',
    bodyHtml: createEmailHtml(
      'Contract Expiry Warning',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A vendor contract is approaching its expiry date. Immediate attention is required to ensure continuity or proper offboarding.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor Name', '{vendorName}')}
        ${tableRow('Vendor Code', '{vendorCode}')}
        ${tableRow('Expiry Date', '{expiryDate}', true)}
      </table>
      <p style="${emailStyles.paragraph}"><strong>Action Required:</strong> Please review the contract and initiate renewal or offboarding procedures as appropriate.</p>`,
      'View Contract Details'
    ),
    bodyText: `Dear {recipientName},

URGENT: A vendor contract is approaching its expiry date.

Vendor Name: {vendorName}
Vendor Code: {vendorCode}
Expiry Date: {expiryDate}

Action Required: Please review the contract and initiate renewal or offboarding procedures as appropriate.

View Contract Details: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'vendorCode', 'expiryDate', 'entityLink']),
    module: "tprm",
  },

  // ===================== TPRM MONITORING =====================
  {
    code: 'TPRM_MONITORING_SCAN_COMPLETED',
    name: 'Monitoring Scan Completed',
    description: 'Sent when a vendor monitoring scan is completed',
    category: 'TPRM Monitoring',
    subject: 'Vendor Monitoring Scan Completed – {vendorName}',
    bodyHtml: createEmailHtml(
      'Monitoring Scan Completed',
      colors.info,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}">A monitoring scan has been completed for the following vendor.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}')}
        ${tableRow('Risk Score', '{riskScore}')}
      </table>
      <p style="${emailStyles.paragraph}">Please review the scan results and take any necessary actions based on the findings.</p>`,
      'View Scan Results'
    ),
    bodyText: `Dear {recipientName},

A monitoring scan has been completed for the following vendor.

Vendor: {vendorName}
Risk Score: {riskScore}

Please review the scan results and take any necessary actions based on the findings.

View Scan Results: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'riskScore', 'entityLink']),
    module: "tprm",
  },
  {
    code: 'TPRM_MONITORING_CRITICAL_RISK',
    name: 'Critical Risk Detected',
    description: 'Sent when a critical risk is detected during vendor monitoring',
    category: 'TPRM Monitoring',
    subject: 'CRITICAL: High Risk Detected – {vendorName}',
    bodyHtml: createEmailHtml(
      'Critical Risk Detected',
      colors.danger,
      `<p style="${emailStyles.paragraph}">Dear {recipientName},</p>
      <p style="${emailStyles.paragraph}"><strong>A critical risk has been detected during vendor monitoring.</strong> Immediate action is required.</p>
      <table style="${emailStyles.table}">
        ${tableRow('Vendor', '{vendorName}', true)}
        ${tableRow('Risk Score', '{riskScore}', true)}
      </table>
      <p style="${emailStyles.paragraph}"><strong>URGENT Action Required:</strong> Please immediately review the risk details and initiate the appropriate risk response procedures. Escalate to management if necessary.</p>`,
      'View Risk Details'
    ),
    bodyText: `Dear {recipientName},

CRITICAL: A critical risk has been detected during vendor monitoring. Immediate action is required.

Vendor: {vendorName}
Risk Score: {riskScore}

URGENT Action Required: Please immediately review the risk details and initiate the appropriate risk response procedures. Escalate to management if necessary.

View Risk Details: {entityLink}

Best regards,
TPRM Platform Team`,
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'riskScore', 'entityLink']),
    module: "tprm",
  },
];

// ==================== SEED FUNCTION ====================

async function seedTPRMEmailTemplates() {
  console.log('Seeding TPRM email templates...');
  console.log(`Total templates to process: ${TPRM_EMAIL_TEMPLATES.length}`);

  let created = 0;
  let updated = 0;

  for (const template of TPRM_EMAIL_TEMPLATES) {
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
            module: template.module,
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
  console.log(`TPRM email templates seeded successfully!`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Total: ${created + updated}`);
  console.log('========================================');
}

// Export for use in main seed.ts
export { TPRM_EMAIL_TEMPLATES, seedTPRMEmailTemplates };

// Run standalone if this file is executed directly
// Check if this module is the main module (not imported)
const isMainModule = require.main === module || process.argv[1]?.includes('seed-tprm-email-templates');

if (isMainModule) {
  seedTPRMEmailTemplates()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

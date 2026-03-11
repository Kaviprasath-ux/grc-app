/**
 * Email Service
 *
 * Mendix-style email system using nodemailer with database-stored SMTP configuration.
 * GLOBAL configuration managed by GRCAdministrator - single SMTP config for entire instance.
 *
 * Key Features:
 * - Global SMTP configuration (stored in database, one record)
 * - Reusable email templates with placeholder substitution
 * - Connection testing and verification
 * - Graceful fallback when email is not configured
 */

import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/config/app-url';

// ==================== INTERFACES ====================

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface TemplatePlaceholders {
  [key: string]: string | number | undefined;
}

// Default placeholders available in all templates
export interface DefaultPlaceholders {
  recipientName: string;
  recipientEmail: string;
  appName: string;
  appUrl: string;
  currentDate: string;
  currentYear: string;
}

// ==================== SMTP CONFIGURATION ====================

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean; // true for SSL (465), false for TLS (587)
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  replyTo?: string;
}

/**
 * Get global SMTP configuration from the database.
 * Returns null if no email settings are configured or if settings are inactive.
 */
async function getSMTPConfig(): Promise<SMTPConfig | null> {
  try {
    // Get the first (and should be only) email settings record
    const settings = await prisma.emailSettings.findFirst({
      where: { isActive: true },
    });

    if (!settings) {
      return null;
    }

    return {
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.useSSL, // SSL uses port 465
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      },
      from: settings.fromName
        ? `${settings.fromName} <${settings.fromAddress}>`
        : settings.fromAddress,
      replyTo: settings.replyToAddress || undefined,
    };
  } catch (error) {
    console.error('[EmailService] Error fetching SMTP config:', error);
    return null;
  }
}

/**
 * Create a nodemailer transporter using global SMTP settings.
 */
async function createTransporter() {
  const config = await getSMTPConfig();

  if (!config) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates in development
    },
  });
}

// ==================== EMAIL SENDING ====================

/**
 * Send an email using the global SMTP configuration.
 * Returns success: false if email is not configured (graceful degradation).
 */
export async function sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
  const config = await getSMTPConfig();

  if (!config) {
    console.log('[EmailService] Email not configured - no active SMTP settings found');
    return { success: false, error: 'Email not configured for this instance' };
  }

  const transporter = await createTransporter();

  if (!transporter) {
    return { success: false, error: 'Failed to create email transporter' };
  }

  try {
    const result = await transporter.sendMail({
      from: config.from,
      to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      replyTo: payload.replyTo || config.replyTo,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    console.log('[EmailService] Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[EmailService] Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending email'
    };
  } finally {
    transporter.close();
  }
}

/**
 * Test SMTP connection.
 * Updates the EmailSettings with test results.
 */
export async function testEmailConnection(testRecipient?: string): Promise<SendEmailResult> {
  const transporter = await createTransporter();

  if (!transporter) {
    const result = { success: false, error: 'Email not configured' };
    await updateTestResult(result);
    return result;
  }

  try {
    // Verify connection
    await transporter.verify();

    // Optionally send a test email
    if (testRecipient) {
      const config = await getSMTPConfig();
      if (!config) {
        return { success: false, error: 'SMTP config not found' };
      }

      const testResult = await transporter.sendMail({
        from: config.from,
        to: testRecipient,
        subject: 'GRC Platform - Email Configuration Test',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0066cc;">Email Configuration Test</h2>
            <p>This is a test email from your GRC Platform.</p>
            <p>If you received this email, your SMTP configuration is working correctly.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">
              Sent at: ${new Date().toISOString()}
            </p>
          </div>
        `,
        text: 'This is a test email from your GRC Platform. If you received this email, your SMTP configuration is working correctly.',
      });

      const result = { success: true, messageId: testResult.messageId };
      await updateTestResult(result);
      return result;
    }

    const result = { success: true, messageId: 'connection-verified' };
    await updateTestResult(result);
    return result;
  } catch (error) {
    const result = {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
    await updateTestResult(result);
    return result;
  } finally {
    transporter.close();
  }
}

/**
 * Update the email settings with test results.
 */
async function updateTestResult(result: SendEmailResult) {
  try {
    // Find the active email settings record
    const settings = await prisma.emailSettings.findFirst({
      where: { isActive: true },
    });

    if (settings) {
      await prisma.emailSettings.update({
        where: { id: settings.id },
        data: {
          isVerified: result.success,
          lastTestedAt: new Date(),
          lastTestResult: result.success
            ? 'Connection successful'
            : `Error: ${result.error}`,
        },
      });
    }
  } catch (error) {
    console.error('[EmailService] Failed to update test result:', error);
  }
}

// ==================== EMAIL TEMPLATES ====================

/**
 * Get an email template by code.
 */
export async function getEmailTemplate(
  code: string
): Promise<{ subject: string; bodyHtml: string; bodyText?: string; placeholders: string[] } | null> {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { code },
    });

    if (!template || !template.isActive) {
      return null;
    }

    return {
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText || undefined,
      placeholders: template.placeholders ? JSON.parse(template.placeholders) : [],
    };
  } catch (error) {
    console.error('[EmailService] Error fetching template:', error);
    return null;
  }
}

/**
 * Replace placeholders in a template string.
 * Placeholders are in the format {placeholderName}.
 */
export function replacePlaceholders(
  template: string,
  placeholders: TemplatePlaceholders
): string {
  let result = template;

  for (const [key, value] of Object.entries(placeholders)) {
    const placeholder = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(placeholder, String(value ?? ''));
  }

  return result;
}

/**
 * Get default placeholders that are available in all templates.
 */
export function getDefaultPlaceholders(recipientName: string, recipientEmail: string): DefaultPlaceholders {
  const now = new Date();
  return {
    recipientName,
    recipientEmail,
    appName: 'GRC Platform',
    appUrl: getAppUrl(),
    currentDate: now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    currentYear: now.getFullYear().toString(),
  };
}

/**
 * Send an email using a template.
 * Combines template lookup, placeholder replacement, and email sending.
 */
export async function sendTemplatedEmail(
  templateCode: string,
  to: string | string[],
  placeholders: TemplatePlaceholders,
  recipientName: string = 'User'
): Promise<SendEmailResult> {
  console.log('[EmailService] sendTemplatedEmail called');
  console.log('[EmailService] Template:', templateCode);
  console.log('[EmailService] To:', to);
  console.log('[EmailService] Recipient Name:', recipientName);

  // Get the template
  const template = await getEmailTemplate(templateCode);

  if (!template) {
    console.log('[EmailService] Template NOT FOUND:', templateCode);
    // Fall back to a generic email
    return sendEmail({
      to,
      subject: placeholders.title as string || 'Notification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${placeholders.title || 'Notification'}</h2>
          <p>${placeholders.message || ''}</p>
          ${placeholders.entityLink ? `<p><a href="${placeholders.entityLink}">View Details</a></p>` : ''}
        </div>
      `,
    });
  }

  // Get recipient email (first one if array)
  const recipientEmail = Array.isArray(to) ? to[0] : to;

  // Merge default placeholders with custom ones
  const allPlaceholders: TemplatePlaceholders = {
    ...getDefaultPlaceholders(recipientName, recipientEmail),
    ...placeholders,
  };

  // Replace placeholders in subject and body
  const subject = replacePlaceholders(template.subject, allPlaceholders);
  const html = replacePlaceholders(template.bodyHtml, allPlaceholders);
  const text = template.bodyText
    ? replacePlaceholders(template.bodyText, allPlaceholders)
    : undefined;

  console.log('[EmailService] Calling sendEmail with subject:', subject);
  const result = await sendEmail({
    to,
    subject,
    html,
    text,
  });
  console.log('[EmailService] sendEmail result:', result.success ? 'SUCCESS' : 'FAILED', result.error || result.messageId);
  return result;
}

// ==================== USER EMAIL HELPERS ====================

/**
 * Get a user's email address by their ID.
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email || null;
  } catch (error) {
    console.error('[EmailService] Error fetching user email:', error);
    return null;
  }
}

/**
 * Get a user's name and email by their ID.
 */
export async function getUserInfo(userId: string): Promise<{ name: string; email: string; userName: string } | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true, userName: true },
    });
    return user ? { name: user.fullName, email: user.email, userName: user.userName } : null;
  } catch (error) {
    console.error('[EmailService] Error fetching user info:', error);
    return null;
  }
}

// ==================== TPRM TEMPLATE HELPER ====================

/**
 * Generate a consistent TPRM-branded HTML email template.
 */
function tprmTemplate({ color, heading, body, buttonText }: {
  color: string;
  heading: string;
  body: string;
  buttonText: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f7; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: ${color}; color: white; padding: 24px 30px; }
    .header h1 { margin: 0 0 4px 0; font-size: 14px; opacity: 0.85; font-weight: 400; }
    .header h2 { margin: 0; font-size: 22px; font-weight: 700; }
    .content { padding: 28px 30px; }
    .content p { margin: 0 0 14px 0; }
    .button { display: inline-block; background: ${color}; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 6px; margin: 16px 0; font-weight: 600; font-size: 14px; }
    .footer { padding: 20px 30px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>{appName} — TPRM</h1>
        <h2>${heading}</h2>
      </div>
      <div class="content">
        ${body}
        <p><a href="{entityLink}" class="button">${buttonText}</a></p>
      </div>
      <div class="footer">
        <p>This is an automated notification from {appName}.</p>
        <p>&copy; {currentYear} {appName}. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ==================== DEFAULT TEMPLATES ====================

/**
 * Default email templates to seed into the database.
 */
export const DEFAULT_EMAIL_TEMPLATES = [
  // Assignment notifications
  {
    code: 'EVIDENCE_ASSIGNED',
    name: 'Evidence Assigned',
    description: 'Sent when evidence is assigned to a user',
    category: 'notification',
    subject: 'Evidence Assigned: {entityName}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { display: inline-block; background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background: #f0f0f0; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{appName}</h1>
    </div>
    <div class="content">
      <h2>Evidence Assigned to You</h2>
      <p>Hello {recipientName},</p>
      <p>You have been assigned to provide evidence for:</p>
      <p><strong>{entityName}</strong></p>
      {controlCode ? '<p>Control: {controlCode}</p>' : ''}
      {dueDate ? '<p>Due Date: {dueDate}</p>' : ''}
      <p><a href="{entityLink}" class="button">View Evidence</a></p>
    </div>
    <div class="footer">
      <p>This is an automated notification from {appName}.</p>
      <p>&copy; {currentYear} {appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'entityLink', 'controlCode', 'dueDate']),
  },
  {
    code: 'RISK_ASSIGNED',
    name: 'Risk Assigned',
    description: 'Sent when a risk is assigned to a user',
    category: 'notification',
    subject: 'Risk Assigned: {riskCode} - {entityName}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background: #f0f0f0; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{appName}</h1>
    </div>
    <div class="content">
      <h2>Risk Assigned to You</h2>
      <p>Hello {recipientName},</p>
      <p>You have been assigned as the owner for:</p>
      <p><strong>{riskCode}: {entityName}</strong></p>
      <p><a href="{entityLink}" class="button">View Risk</a></p>
    </div>
    <div class="footer">
      <p>This is an automated notification from {appName}.</p>
      <p>&copy; {currentYear} {appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'entityLink', 'riskCode']),
  },
  {
    code: 'CAPA_ASSIGNED',
    name: 'CAPA Assigned',
    description: 'Sent when a CAPA is assigned to a user',
    category: 'notification',
    subject: 'CAPA Assigned: {capaCode} - {entityName}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background: #f0f0f0; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{appName}</h1>
    </div>
    <div class="content">
      <h2>CAPA Assigned to You</h2>
      <p>Hello {recipientName},</p>
      <p>A Corrective and Preventive Action (CAPA) has been assigned to you:</p>
      <p><strong>{capaCode}: {entityName}</strong></p>
      {dueDate ? '<p>Due Date: {dueDate}</p>' : ''}
      <p><a href="{entityLink}" class="button">View CAPA</a></p>
    </div>
    <div class="footer">
      <p>This is an automated notification from {appName}.</p>
      <p>&copy; {currentYear} {appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    placeholders: JSON.stringify(['recipientName', 'entityName', 'entityLink', 'capaCode', 'dueDate']),
  },
  // Due date reminders
  {
    code: 'DUE_REMINDER',
    name: 'Due Date Reminder',
    description: 'Sent when an item is due soon',
    category: 'reminder',
    subject: 'Reminder: {entityType} Due Soon - {entityName}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; background: #f9f9f9; }
    .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 15px; margin: 15px 0; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background: #f0f0f0; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{appName}</h1>
    </div>
    <div class="content">
      <h2>Due Date Reminder</h2>
      <p>Hello {recipientName},</p>
      <div class="alert">
        <strong>{entityType}</strong> "{entityName}" is due on <strong>{dueDate}</strong>.
      </div>
      <p>Please take action to complete this item before the due date.</p>
      <p><a href="{entityLink}" class="button">View Details</a></p>
    </div>
    <div class="footer">
      <p>This is an automated reminder from {appName}.</p>
      <p>&copy; {currentYear} {appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    placeholders: JSON.stringify(['recipientName', 'entityType', 'entityName', 'entityLink', 'dueDate']),
  },
  // Approval notifications
  {
    code: 'APPROVAL_REQUESTED',
    name: 'Approval Requested',
    description: 'Sent when approval is requested from a user',
    category: 'notification',
    subject: 'Approval Required: {entityType} - {entityName}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background: #f0f0f0; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{appName}</h1>
    </div>
    <div class="content">
      <h2>Approval Required</h2>
      <p>Hello {recipientName},</p>
      <p>Your approval is required for the following {entityType}:</p>
      <p><strong>{entityName}</strong></p>
      <p>Submitted by: {actorName}</p>
      <p><a href="{entityLink}" class="button">Review &amp; Approve</a></p>
    </div>
    <div class="footer">
      <p>This is an automated notification from {appName}.</p>
      <p>&copy; {currentYear} {appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    placeholders: JSON.stringify(['recipientName', 'entityType', 'entityName', 'entityLink', 'actorName']),
  },
  // Generic notification template
  {
    code: 'GENERIC_NOTIFICATION',
    name: 'Generic Notification',
    description: 'Generic notification template for various events',
    category: 'notification',
    subject: '{title}',
    bodyHtml: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { display: inline-block; background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; background: #f0f0f0; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{appName}</h1>
    </div>
    <div class="content">
      <h2>{title}</h2>
      <p>Hello {recipientName},</p>
      <p>{message}</p>
      {entityLink ? '<p><a href="{entityLink}" class="button">View Details</a></p>' : ''}
    </div>
    <div class="footer">
      <p>This is an automated notification from {appName}.</p>
      <p>&copy; {currentYear} {appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `,
    placeholders: JSON.stringify(['recipientName', 'title', 'message', 'entityLink']),
  },

  // ==================== TPRM EMAIL TEMPLATES ====================


  // --- Account & User Management ---
  {
    code: 'TPRM_ACCOUNT_CREATED',
    name: 'TPRM Account Created',
    description: 'Sent when a TPRM account is created for a user',
    category: 'notification',
    subject: 'Your TPRM Account Has Been Created',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'TPRM Account Created',
      body: `<p>Hello {recipientName},</p>
      <p>Your TPRM account has been created with role: <strong>{roleName}</strong>.</p>
      <p>You can now log in to the TPRM platform to access your dashboard and assigned tasks.</p>`,
      buttonText: 'Go to TPRM',
    }),
    placeholders: JSON.stringify(['recipientName', 'roleName', 'entityLink']),
  },
  {
    code: 'TPRM_RM_ACCOUNT_CREATED',
    name: 'Relationship Manager Account Created',
    description: 'Sent to BO/Admin when a new RM account is created',
    category: 'notification',
    subject: 'New Relationship Manager Account Created',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'New RM Account Created',
      body: `<p>Hello {recipientName},</p>
      <p>A new Relationship Manager account has been created:</p>
      <p><strong>{entityName}</strong></p>
      <p>The user can now manage vendors and assessments within the TPRM platform.</p>`,
      buttonText: 'View User Management',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'entityLink']),
  },

  // --- Vendor Lifecycle ---
  {
    code: 'TPRM_VENDOR_ONBOARDED',
    name: 'Vendor Onboarded',
    description: 'Sent when a vendor is onboarded',
    category: 'notification',
    subject: 'Vendor Onboarded: {vendorCode} - {entityName}',
    bodyHtml: tprmTemplate({
      color: '#16a34a',
      heading: 'Vendor Onboarded',
      body: `<p>Hello {recipientName},</p>
      <p>The following vendor has been successfully onboarded:</p>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;margin:12px 0;">
        <strong>{vendorCode}: {entityName}</strong>
      </div>
      <p>You may now proceed with assessments and other TPRM activities for this vendor.</p>`,
      buttonText: 'View Vendor',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorCode', 'entityLink']),
  },
  {
    code: 'TPRM_VENDOR_OFFBOARDING',
    name: 'Vendor Offboarding Initiated',
    description: 'Sent when vendor offboarding is started',
    category: 'notification',
    subject: 'Vendor Offboarding Initiated: {entityName}',
    bodyHtml: tprmTemplate({
      color: '#dc2626',
      heading: 'Vendor Offboarding Initiated',
      body: `<p>Hello {recipientName},</p>
      <p>The offboarding process has been initiated for vendor:</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:12px 0;">
        <strong>{entityName}</strong>
      </div>
      <p>Please complete the required offboarding assessment and ensure all obligations are fulfilled.</p>`,
      buttonText: 'View Offboarding',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'entityLink']),
  },

  // --- Vendor Termination (Internal) ---
  {
    code: 'TPRM_VENDOR_TERMINATED',
    name: 'Vendor Terminated (Internal)',
    description: 'Sent to internal users when a vendor is terminated',
    category: 'notification',
    subject: 'Vendor Terminated: {vendorCode} - {entityName}',
    bodyHtml: tprmTemplate({
      color: '#dc2626',
      heading: 'Vendor Terminated',
      body: `<p>Hello {recipientName},</p>
      <p>The following vendor has been <strong>terminated</strong>:</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:12px 0;">
        <strong>{vendorCode}: {entityName}</strong>
      </div>
      <p><strong>Reason:</strong> {reason}</p>
      <p>All active assessments and remediations for this vendor have been closed. No further actions are required.</p>`,
      buttonText: 'View Vendor',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorCode', 'reason', 'entityLink']),
  },

  // --- Vendor Termination (External - sent to vendor contact) ---
  {
    code: 'TPRM_VENDOR_TERMINATED_EXTERNAL',
    name: 'Vendor Terminated (External)',
    description: 'Sent to the vendor contact email when the vendor is terminated',
    category: 'notification',
    subject: 'Notice of Vendor Relationship Termination — {vendorCode}',
    bodyHtml: tprmTemplate({
      color: '#dc2626',
      heading: 'Vendor Relationship Terminated',
      body: `<p>Dear {recipientName},</p>
      <p>We are writing to inform you that the vendor relationship with your organization (<strong>{vendorCode}: {vendorName}</strong>) has been <strong>terminated</strong> effective immediately.</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:12px 0;">
        <strong>Reason for termination:</strong> {reason}
      </div>
      <p>As a result of this termination:</p>
      <ul style="margin:12px 0;padding-left:20px;">
        <li>All active assessments have been closed</li>
        <li>All pending remediations have been cancelled</li>
        <li>Access to the TPRM portal for this engagement has been revoked</li>
      </ul>
      <p>If you have any questions regarding this termination, please contact the account manager or the TPRM team.</p>
      <p>Thank you for your understanding.</p>`,
      buttonText: 'Contact Support',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'vendorCode', 'reason', 'entityLink']),
  },

  // --- Assessment Lifecycle ---
  {
    code: 'TPRM_ASSESSMENT_INITIATED',
    name: 'Assessment Initiated',
    description: 'Sent when a new assessment is created',
    category: 'notification',
    subject: 'New Assessment Initiated: {entityName} for {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'Assessment Initiated',
      body: `<p>Hello {recipientName},</p>
      <p>A new assessment has been initiated:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <p>Please begin the assessment process at your earliest convenience.</p>`,
      buttonText: 'View Assessment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_ASSESSMENT_ASSIGNED',
    name: 'Assessment Assigned',
    description: 'Sent when an assessment is assigned to an assessor',
    category: 'notification',
    subject: 'Assessment Assigned to You: {entityName}',
    bodyHtml: tprmTemplate({
      color: '#7c3aed',
      heading: 'Assessment Assigned to You',
      body: `<p>Hello {recipientName},</p>
      <p>You have been assigned to review the following assessment:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <p>Please review and complete the assessment.</p>`,
      buttonText: 'Start Assessment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_ASSESSMENT_REASSIGNED',
    name: 'Assessment Reassigned',
    description: 'Sent when an assessment is reassigned to a different assessor',
    category: 'notification',
    subject: 'Assessment Reassigned: {entityName}',
    bodyHtml: tprmTemplate({
      color: '#7c3aed',
      heading: 'Assessment Reassigned',
      body: `<p>Hello {recipientName},</p>
      <p>An assessment has been reassigned to you:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>`,
      buttonText: 'View Assessment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_ASSESSMENT_SUBMITTED',
    name: 'Assessment Submitted',
    description: 'Sent when AM submits an assessment for review',
    category: 'notification',
    subject: 'Assessment Submitted for Review: {entityName}',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'Assessment Submitted for Review',
      body: `<p>Hello {recipientName},</p>
      <p>An assessment has been submitted for your review:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <p>Please review the responses and provide your evaluation.</p>`,
      buttonText: 'Review Assessment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_ASSESSMENT_SENT_TO_APPROVER',
    name: 'Assessment Sent to Approver',
    description: 'Sent when assessment is forwarded to approver',
    category: 'notification',
    subject: 'Assessment Awaiting Your Approval: {entityName}',
    bodyHtml: tprmTemplate({
      color: '#7c3aed',
      heading: 'Assessment Awaiting Your Approval',
      body: `<p>Hello {recipientName},</p>
      <p>An assessment is ready for your approval:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <p>Please review and approve or return the assessment.</p>`,
      buttonText: 'Approve Assessment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_ASSESSMENT_COMPLETED',
    name: 'Assessment Completed',
    description: 'Sent when assessment is reviewed/completed by assessor',
    category: 'notification',
    subject: 'Assessment Reviewed: {entityName}',
    bodyHtml: tprmTemplate({
      color: '#16a34a',
      heading: 'Assessment Reviewed',
      body: `<p>Hello {recipientName},</p>
      <p>The following assessment has been reviewed and completed:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>`,
      buttonText: 'View Results',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_ASSESSMENT_APPROVED',
    name: 'Assessment Approved',
    description: 'Sent when assessment is approved',
    category: 'notification',
    subject: 'Assessment Approved: {entityName}',
    bodyHtml: tprmTemplate({
      color: '#16a34a',
      heading: 'Assessment Approved',
      body: `<p>Hello {recipientName},</p>
      <p>The following assessment has been approved:</p>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;margin:12px 0;">
        <strong>{entityName}</strong> for vendor <strong>{vendorName}</strong>
      </div>`,
      buttonText: 'View Assessment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_ASSESSMENT_RETURNED',
    name: 'Assessment Returned',
    description: 'Sent when assessment is returned for corrections',
    category: 'notification',
    subject: 'Assessment Returned: {entityName}',
    bodyHtml: tprmTemplate({
      color: '#f59e0b',
      heading: 'Assessment Returned',
      body: `<p>Hello {recipientName},</p>
      <p>The following assessment has been returned and requires further action:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;">
        <strong>Reason:</strong> {message}
      </div>
      <p>Please address the feedback and resubmit.</p>`,
      buttonText: 'View Assessment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'message', 'entityLink']),
  },
  {
    code: 'TPRM_ASSESSMENT_DUE_REMINDER',
    name: 'Assessment Due Reminder',
    description: 'Sent when an assessment is approaching its due date',
    category: 'reminder',
    subject: 'Reminder: Assessment {entityName} Due Soon',
    bodyHtml: tprmTemplate({
      color: '#f59e0b',
      heading: 'Assessment Due Reminder',
      body: `<p>Hello {recipientName},</p>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;">
        Assessment <strong>{entityName}</strong> for vendor <strong>{vendorName}</strong> is due on <strong>{dueDate}</strong>.
      </div>
      <p>Please ensure the assessment is completed before the due date.</p>`,
      buttonText: 'View Assessment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'dueDate', 'entityLink']),
  },

  // --- Clarification & Comments ---
  {
    code: 'TPRM_CLARIFICATION_REQUESTED',
    name: 'Clarification Requested',
    description: 'Sent when assessor requests clarification from AM',
    category: 'notification',
    subject: 'Clarification Requested on Assessment {entityName}',
    bodyHtml: tprmTemplate({
      color: '#f59e0b',
      heading: 'Clarification Requested',
      body: `<p>Hello {recipientName},</p>
      <p>The assessor has requested clarification on an assessment:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
      </table>
      <p>Please review the request and provide the necessary information.</p>`,
      buttonText: 'View Clarification',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'entityLink']),
  },
  {
    code: 'TPRM_CLARIFICATION_RESPONDED',
    name: 'Clarification Response Received',
    description: 'Sent when AM responds to a clarification request',
    category: 'notification',
    subject: 'Clarification Response Received: {entityName}',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'Clarification Response Received',
      body: `<p>Hello {recipientName},</p>
      <p>A response has been received for your clarification request:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <p>Please review the response and continue with the assessment.</p>`,
      buttonText: 'View Response',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_COMMENT_ADDED',
    name: 'Comment Added to Assessment',
    description: 'Sent when a comment is added to an assessment',
    category: 'notification',
    subject: 'New Comment on Assessment {entityName}',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'New Comment on Assessment',
      body: `<p>Hello {recipientName},</p>
      <p>A new comment has been added to assessment <strong>{entityName}</strong>:</p>
      <div style="background:#f0f9ff;border-left:4px solid #0066cc;padding:12px 16px;margin:12px 0;font-style:italic;">
        {message}
      </div>`,
      buttonText: 'View Comment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'message', 'entityLink']),
  },
  {
    code: 'TPRM_OVERRIDE_APPLIED',
    name: 'Assessment Override Applied',
    description: 'Sent when assessor overrides AI evaluation',
    category: 'notification',
    subject: 'Assessment Override Applied: {entityName}',
    bodyHtml: tprmTemplate({
      color: '#f59e0b',
      heading: 'Assessment Override Applied',
      body: `<p>Hello {recipientName},</p>
      <p>An assessor has overridden the AI evaluation on an assessment:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
      </table>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;">
        {message}
      </div>`,
      buttonText: 'View Assessment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'message', 'entityLink']),
  },
  {
    code: 'TPRM_SME_ASSIGNED',
    name: 'SME Assigned',
    description: 'Sent when an SME is assigned to answer delegated questions',
    category: 'notification',
    subject: 'SME Assignment: Assessment {entityName}',
    bodyHtml: tprmTemplate({
      color: '#7c3aed',
      heading: 'SME Assignment',
      body: `<p>Hello {recipientName},</p>
      <p>You have been assigned as a Subject Matter Expert for the following assessment:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
      </table>
      <p>Please review and respond to the delegated questions.</p>`,
      buttonText: 'View Assignment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'entityLink']),
  },
  {
    code: 'TPRM_SME_ASSIGNMENT_PENDING',
    name: 'SME Assignment Pending',
    description: 'Daily reminder for pending SME responses',
    category: 'reminder',
    subject: 'Reminder: Pending SME Assignment on Assessment {entityName}',
    bodyHtml: tprmTemplate({
      color: '#f59e0b',
      heading: 'Pending SME Assignment',
      body: `<p>Hello {recipientName},</p>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;">
        You have a pending SME assignment on assessment <strong>{entityName}</strong> that is still awaiting your response.
      </div>
      <p>Please respond to the delegated questions at your earliest convenience.</p>`,
      buttonText: 'View Assignment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'entityLink']),
  },

  // --- Remediation Lifecycle ---
  {
    code: 'TPRM_REMEDIATION_CREATED',
    name: 'Remediation Items Created',
    description: 'Sent when remediation items are created for an assessment',
    category: 'notification',
    subject: 'Remediation Items Created: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#dc2626',
      heading: 'Remediation Items Created',
      body: `<p>Hello {recipientName},</p>
      <p>Remediation items have been created:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Assessment:</td><td style="padding:6px 0;"><strong>{entityName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Items:</td><td style="padding:6px 0;"><strong>{count}</strong></td></tr>
      </table>
      <p>Please review and begin addressing the identified issues.</p>`,
      buttonText: 'View Remediations',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'count', 'entityLink']),
  },
  {
    code: 'TPRM_REMEDIATION_SUBMITTED',
    name: 'Remediation Response Submitted',
    description: 'Sent when AM submits a remediation response',
    category: 'notification',
    subject: 'Remediation Response Submitted: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'Remediation Response Submitted',
      body: `<p>Hello {recipientName},</p>
      <p>A remediation response has been submitted:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Issue:</td><td style="padding:6px 0;"><strong>{issueCode}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <p>Please review the response and take appropriate action.</p>`,
      buttonText: 'Review Response',
    }),
    placeholders: JSON.stringify(['recipientName', 'issueCode', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_REMEDIATION_SATISFIED',
    name: 'Remediation Marked Satisfactory',
    description: 'Sent when assessor marks remediation as satisfactory',
    category: 'notification',
    subject: 'Remediation Satisfactory: {vendorName} - {issueCode}',
    bodyHtml: tprmTemplate({
      color: '#16a34a',
      heading: 'Remediation Marked Satisfactory',
      body: `<p>Hello {recipientName},</p>
      <p>A remediation has been marked as <strong style="color:#16a34a;">Satisfactory</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Issue:</td><td style="padding:6px 0;"><strong>{issueCode}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>`,
      buttonText: 'View Details',
    }),
    placeholders: JSON.stringify(['recipientName', 'issueCode', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_REMEDIATION_UNSATISFIED',
    name: 'Remediation Marked Unsatisfactory',
    description: 'Sent when assessor marks remediation as unsatisfactory',
    category: 'notification',
    subject: 'Remediation Unsatisfactory: {vendorName} - {issueCode}',
    bodyHtml: tprmTemplate({
      color: '#dc2626',
      heading: 'Remediation Marked Unsatisfactory',
      body: `<p>Hello {recipientName},</p>
      <p>A remediation has been marked as <strong style="color:#dc2626;">Unsatisfactory</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Issue:</td><td style="padding:6px 0;"><strong>{issueCode}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:12px 0;">
        <strong>Reason:</strong> {message}
      </div>
      <p>Further action is required. Please address the assessor's feedback and resubmit.</p>`,
      buttonText: 'View Remediation',
    }),
    placeholders: JSON.stringify(['recipientName', 'issueCode', 'vendorName', 'message', 'entityLink']),
  },
  {
    code: 'TPRM_REMEDIATION_SENT_TO_BUSINESS',
    name: 'Remediation Assigned to Business',
    description: 'Sent when remediation is assigned to RM for business review',
    category: 'notification',
    subject: 'Remediation Assigned to You: {vendorName} - {issueCode}',
    bodyHtml: tprmTemplate({
      color: '#7c3aed',
      heading: 'Remediation Assigned to You',
      body: `<p>Hello {recipientName},</p>
      <p>A remediation has been assigned to you for business review:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Issue:</td><td style="padding:6px 0;"><strong>{issueCode}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <p>Please review and provide your response.</p>`,
      buttonText: 'View Remediation',
    }),
    placeholders: JSON.stringify(['recipientName', 'issueCode', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_REMEDIATION_ASSIGNED_TO_IT',
    name: 'Remediation Assigned to IT',
    description: 'Sent when remediation is assigned to IT team',
    category: 'notification',
    subject: 'IT Remediation Assigned: {vendorName} - {issueCode}',
    bodyHtml: tprmTemplate({
      color: '#7c3aed',
      heading: 'IT Remediation Assigned to You',
      body: `<p>Hello {recipientName},</p>
      <p>A remediation has been assigned to you for IT review:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Issue:</td><td style="padding:6px 0;"><strong>{issueCode}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <p>Please review the technical aspects and submit your findings.</p>`,
      buttonText: 'View Remediation',
    }),
    placeholders: JSON.stringify(['recipientName', 'issueCode', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_REMEDIATION_IT_SUBMITTED',
    name: 'IT Remediation Response Submitted',
    description: 'Sent when IT/RM submits remediation response',
    category: 'notification',
    subject: 'IT Remediation Response Submitted: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'IT Remediation Response Submitted',
      body: `<p>Hello {recipientName},</p>
      <p>An IT/RM remediation response has been submitted:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Issue:</td><td style="padding:6px 0;"><strong>{issueCode}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <p>Please review the submission.</p>`,
      buttonText: 'Review Submission',
    }),
    placeholders: JSON.stringify(['recipientName', 'issueCode', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_REMEDIATION_IT_APPROVED',
    name: 'IT Remediation Approved',
    description: 'Sent when IT remediation is approved by assessor',
    category: 'notification',
    subject: 'IT Remediation Approved: {vendorName} - {issueCode}',
    bodyHtml: tprmTemplate({
      color: '#16a34a',
      heading: 'IT Remediation Approved',
      body: `<p>Hello {recipientName},</p>
      <p>Your IT remediation submission has been <strong style="color:#16a34a;">approved</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Issue:</td><td style="padding:6px 0;"><strong>{issueCode}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>`,
      buttonText: 'View Details',
    }),
    placeholders: JSON.stringify(['recipientName', 'issueCode', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_REMEDIATION_IT_RETURNED',
    name: 'IT Remediation Returned',
    description: 'Sent when IT remediation is returned by assessor',
    category: 'notification',
    subject: 'IT Remediation Returned: {vendorName} - {issueCode}',
    bodyHtml: tprmTemplate({
      color: '#f59e0b',
      heading: 'IT Remediation Returned',
      body: `<p>Hello {recipientName},</p>
      <p>Your IT remediation submission has been returned:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Issue:</td><td style="padding:6px 0;"><strong>{issueCode}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;">
        <strong>Reason:</strong> {message}
      </div>
      <p>Please address the feedback and resubmit.</p>`,
      buttonText: 'View Remediation',
    }),
    placeholders: JSON.stringify(['recipientName', 'issueCode', 'vendorName', 'message', 'entityLink']),
  },
  {
    code: 'TPRM_REMEDIATION_OVERDUE',
    name: 'Remediation Overdue',
    description: 'Sent when a remediation item is past its due date',
    category: 'reminder',
    subject: 'OVERDUE: Remediation for {vendorName} - {issueCode}',
    bodyHtml: tprmTemplate({
      color: '#dc2626',
      heading: 'Remediation Overdue',
      body: `<p>Hello {recipientName},</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:12px 0;">
        <strong>OVERDUE:</strong> A remediation item is past its due date.
      </div>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Issue:</td><td style="padding:6px 0;"><strong>{issueCode}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Due Date:</td><td style="padding:6px 0;"><strong style="color:#dc2626;">{dueDate}</strong></td></tr>
      </table>
      <p>Please take immediate action to resolve this remediation.</p>`,
      buttonText: 'View Remediation',
    }),
    placeholders: JSON.stringify(['recipientName', 'issueCode', 'vendorName', 'dueDate', 'entityLink']),
  },
  {
    code: 'TPRM_REMEDIATION_ALL_CLOSED',
    name: 'All Remediations Closed',
    description: 'Sent when all remediations for an assessment are closed',
    category: 'notification',
    subject: 'All Remediations Closed: {entityName} - {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#16a34a',
      heading: 'All Remediations Closed',
      body: `<p>Hello {recipientName},</p>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;margin:12px 0;">
        All remediation items for assessment <strong>{entityName}</strong> (vendor: <strong>{vendorName}</strong>) have been closed.
      </div>
      <p>No further remediation action is required for this assessment.</p>`,
      buttonText: 'View Assessment',
    }),
    placeholders: JSON.stringify(['recipientName', 'entityName', 'vendorName', 'entityLink']),
  },

  // --- Vendor Issues ---
  {
    code: 'TPRM_VENDOR_ISSUE_CREATED',
    name: 'Vendor Issue Created',
    description: 'Sent when a vendor issue is reported',
    category: 'notification',
    subject: 'Vendor Issue Reported: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#dc2626',
      heading: 'Vendor Issue Reported',
      body: `<p>Hello {recipientName},</p>
      <p>A new issue has been reported for a vendor:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:12px 0;">
        {message}
      </div>
      <p>Please review and take appropriate action.</p>`,
      buttonText: 'View Issue',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'message', 'entityLink']),
  },
  {
    code: 'TPRM_VENDOR_ISSUE_UPDATED',
    name: 'Vendor Issue Updated',
    description: 'Sent when a vendor issue status is updated',
    category: 'notification',
    subject: 'Vendor Issue Updated: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'Vendor Issue Updated',
      body: `<p>Hello {recipientName},</p>
      <p>A vendor issue has been updated:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <div style="background:#f0f9ff;border-left:4px solid #0066cc;padding:12px 16px;margin:12px 0;">
        {message}
      </div>`,
      buttonText: 'View Issue',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'message', 'entityLink']),
  },
  {
    code: 'TPRM_VENDOR_ISSUE_RESOLVED',
    name: 'Vendor Issue Resolved',
    description: 'Sent when a vendor issue is resolved',
    category: 'notification',
    subject: 'Vendor Issue Resolved: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#16a34a',
      heading: 'Vendor Issue Resolved',
      body: `<p>Hello {recipientName},</p>
      <p>A vendor issue has been resolved:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;margin:12px 0;">
        {message}
      </div>`,
      buttonText: 'View Issue',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'message', 'entityLink']),
  },
  {
    code: 'TPRM_VENDOR_ISSUE_ESCALATED',
    name: 'Vendor Issue Escalated',
    description: 'Sent when a vendor issue is escalated',
    category: 'notification',
    subject: 'ESCALATED: Vendor Issue - {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#dc2626',
      heading: 'Vendor Issue Escalated',
      body: `<p>Hello {recipientName},</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:12px 0;">
        <strong>ESCALATED:</strong> A vendor issue has been escalated and requires immediate attention.
      </div>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
      </table>
      <p>{message}</p>
      <p>Please take immediate action.</p>`,
      buttonText: 'View Issue',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'message', 'entityLink']),
  },

  // --- Offboarding Workflow ---
  {
    code: 'TPRM_OFFBOARD_SUBMITTED',
    name: 'Offboard Assessment Submitted',
    description: 'Sent when AM submits offboard assessment for review',
    category: 'notification',
    subject: 'Offboard Assessment Submitted: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'Offboard Assessment Submitted',
      body: `<p>Hello {recipientName},</p>
      <p>An offboard assessment has been submitted for your review:</p>
      <div style="background:#f0f9ff;border-left:4px solid #0066cc;padding:12px 16px;margin:12px 0;">
        Vendor: <strong>{vendorName}</strong>
      </div>
      <p>Please review and approve or return the offboard assessment.</p>`,
      buttonText: 'Review Offboard',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_OFFBOARD_ASSESSOR_APPROVED',
    name: 'Offboard Assessor Approved',
    description: 'Sent when assessor approves offboard assessment',
    category: 'notification',
    subject: 'Offboard Assessment Approved by Assessor: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#16a34a',
      heading: 'Offboard Assessment: Assessor Approved',
      body: `<p>Hello {recipientName},</p>
      <p>The offboard assessment for vendor <strong>{vendorName}</strong> has been approved by the assessor.</p>
      <p>The assessment is now awaiting RM review.</p>`,
      buttonText: 'View Offboard',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_OFFBOARD_ASSESSOR_SENT_BACK',
    name: 'Offboard Returned by Assessor',
    description: 'Sent when assessor returns offboard assessment',
    category: 'notification',
    subject: 'Offboard Assessment Returned by Assessor: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#f59e0b',
      heading: 'Offboard Assessment Returned by Assessor',
      body: `<p>Hello {recipientName},</p>
      <p>The offboard assessment for vendor <strong>{vendorName}</strong> has been returned by the assessor.</p>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;">
        <strong>Reason:</strong> {message}
      </div>
      <p>Please address the feedback and resubmit.</p>`,
      buttonText: 'View Offboard',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'message', 'entityLink']),
  },
  {
    code: 'TPRM_OFFBOARD_RM_APPROVED',
    name: 'Offboard RM Approved',
    description: 'Sent when RM approves offboard assessment',
    category: 'notification',
    subject: 'Offboard Assessment Approved by RM: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#16a34a',
      heading: 'Offboard Assessment: RM Approved',
      body: `<p>Hello {recipientName},</p>
      <p>The offboard assessment for vendor <strong>{vendorName}</strong> has been approved by the Relationship Manager.</p>
      <p>The assessment is now awaiting Business Owner approval.</p>`,
      buttonText: 'View Offboard',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_OFFBOARD_RM_SENT_BACK',
    name: 'Offboard Returned by RM',
    description: 'Sent when RM returns offboard assessment',
    category: 'notification',
    subject: 'Offboard Assessment Returned by RM: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#f59e0b',
      heading: 'Offboard Assessment Returned by RM',
      body: `<p>Hello {recipientName},</p>
      <p>The offboard assessment for vendor <strong>{vendorName}</strong> has been returned by the Relationship Manager.</p>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;">
        <strong>Reason:</strong> {message}
      </div>
      <p>Please address the feedback and resubmit.</p>`,
      buttonText: 'View Offboard',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'message', 'entityLink']),
  },
  {
    code: 'TPRM_OFFBOARD_BO_APPROVED',
    name: 'Vendor Offboarding Approved',
    description: 'Sent when BO gives final approval for vendor offboarding',
    category: 'notification',
    subject: 'Vendor Offboarding Approved: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#16a34a',
      heading: 'Vendor Offboarding Approved',
      body: `<p>Hello {recipientName},</p>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;margin:12px 0;">
        Vendor <strong>{vendorName}</strong> offboarding has been fully approved. The vendor status has been set to <strong>Offboarded</strong>.
      </div>
      <p>All vendor-related activities have been concluded.</p>`,
      buttonText: 'View Vendor',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'entityLink']),
  },
  {
    code: 'TPRM_OFFBOARD_BO_SENT_TO_RM',
    name: 'Offboard Sent Back to RM by BO',
    description: 'Sent when BO sends offboard assessment back to RM',
    category: 'notification',
    subject: 'Offboard Assessment Sent Back by BO: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#f59e0b',
      heading: 'Offboard Sent Back by Business Owner',
      body: `<p>Hello {recipientName},</p>
      <p>The offboard assessment for vendor <strong>{vendorName}</strong> has been sent back to you by the Business Owner.</p>
      <p>Please review and take the necessary action.</p>`,
      buttonText: 'View Offboard',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'entityLink']),
  },

  // --- Monitoring ---
  {
    code: 'TPRM_MONITORING_SCAN_COMPLETED',
    name: 'Monitoring Scan Completed',
    description: 'Sent when a monitoring scan is completed for a vendor',
    category: 'notification',
    subject: 'Monitoring Scan Completed: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'Monitoring Scan Completed',
      body: `<p>Hello {recipientName},</p>
      <p>A monitoring scan has been completed:</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Risk Score:</td><td style="padding:6px 0;"><strong>{riskScore}</strong></td></tr>
      </table>
      <p>Review the scan results for any notable changes.</p>`,
      buttonText: 'View Results',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'riskScore', 'entityLink']),
  },
  {
    code: 'TPRM_MONITORING_CRITICAL_RISK',
    name: 'Critical Risk Detected',
    description: 'Sent when monitoring detects a critical risk score',
    category: 'notification',
    subject: 'CRITICAL RISK: Monitoring Alert for {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#dc2626',
      heading: 'Critical Risk Detected',
      body: `<p>Hello {recipientName},</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:12px 0;">
        <strong>CRITICAL:</strong> A monitoring scan has detected a high-risk score for vendor <strong>{vendorName}</strong>.
      </div>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:6px 0;color:#666;">Vendor:</td><td style="padding:6px 0;"><strong>{vendorName}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666;">Risk Score:</td><td style="padding:6px 0;"><strong style="color:#dc2626;">{riskScore}</strong></td></tr>
      </table>
      <p>Immediate action is recommended to assess and mitigate the risk.</p>`,
      buttonText: 'View Monitoring',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'riskScore', 'entityLink']),
  },

  // --- Contract & Support ---
  {
    code: 'TPRM_CONTRACT_EXPIRY',
    name: 'Contract Expiry Reminder',
    description: 'Sent when a vendor contract is about to expire',
    category: 'reminder',
    subject: 'Contract Expiring Soon: {vendorName}',
    bodyHtml: tprmTemplate({
      color: '#f59e0b',
      heading: 'Contract Expiring Soon',
      body: `<p>Hello {recipientName},</p>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;margin:12px 0;">
        The contract for vendor <strong>{vendorName}</strong> expires on <strong>{expiryDate}</strong>.
      </div>
      <p>Please take action to renew or terminate the contract as needed.</p>`,
      buttonText: 'View Vendor',
    }),
    placeholders: JSON.stringify(['recipientName', 'vendorName', 'expiryDate', 'entityLink']),
  },
  {
    code: 'TPRM_SUPPORT_REQUEST',
    name: 'TPRM Support Request',
    description: 'Sent when a support request is submitted in TPRM',
    category: 'notification',
    subject: 'TPRM Support Request',
    bodyHtml: tprmTemplate({
      color: '#0066cc',
      heading: 'TPRM Support Request',
      body: `<p>Hello {recipientName},</p>
      <p>A support request has been submitted:</p>
      <div style="background:#f0f9ff;border-left:4px solid #0066cc;padding:12px 16px;margin:12px 0;">
        {message}
      </div>
      <p>Please review and respond to the request.</p>`,
      buttonText: 'View Request',
    }),
    placeholders: JSON.stringify(['recipientName', 'message', 'entityLink']),
  },
];

/**
 * Seed default email templates into the database.
 * Only creates templates that don't already exist.
 */
export async function seedDefaultEmailTemplates(): Promise<void> {
  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    try {
      // Check if template already exists
      const existing = await prisma.emailTemplate.findUnique({
        where: { code: template.code },
      });

      if (!existing) {
        await prisma.emailTemplate.create({
          data: {
            ...template,
            isSystem: true,
          },
        });
        console.log(`[EmailService] Created template: ${template.code}`);
      }
    } catch (error) {
      console.error(`[EmailService] Error seeding template ${template.code}:`, error);
    }
  }

  console.log('[EmailService] Default email templates seeded');
}

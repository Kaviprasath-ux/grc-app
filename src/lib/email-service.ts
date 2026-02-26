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
    appUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
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

/**
 * Seeds 9 subscription-related email templates into the EmailTemplate table.
 * Idempotent — uses upsert keyed on `code`.
 *
 * Run: npx tsx scripts/seed-subscription-email-templates.ts
 *
 * Templates seeded:
 *   SUBSCRIPTION_REMINDER_30D   — 30-day expiry warning
 *   SUBSCRIPTION_REMINDER_15D   — 15-day expiry warning
 *   SUBSCRIPTION_REMINDER_7D    — 7-day urgent warning
 *   SUBSCRIPTION_REMINDER_3D    — daily 3/2/1-day countdown
 *   SUBSCRIPTION_EXPIRED        — expiry day notice
 *   SUBSCRIPTION_GRACE_PERIOD   — read-only mode notice
 *   SUBSCRIPTION_RENEWED        — post-payment confirmation
 *   PAYMENT_FAILED              — payment failure notice
 *   TRIAL_ENDING                — trial ends in 3/1 day(s)
 *   WELCOME_SIGNUP              — new account welcome
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TemplateSpec {
  code: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  placeholders: string[];
}

const TEMPLATES: TemplateSpec[] = [
  {
    code: "SUBSCRIPTION_REMINDER_30D",
    name: "Subscription — 30-day reminder",
    description: "Sent 30 days before a module's cycleEnd.",
    subject: "Your Verifai GRC subscription expires in 30 days",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #A57865;">Your subscription expires in 30 days</h2>
        <p>Hi {recipientName},</p>
        <p>Your <strong>{customerName}</strong> Verifai GRC subscription is approaching its renewal date.</p>
        <ul>
          <li><strong>Modules:</strong> {moduleList}</li>
          <li><strong>Renewal date:</strong> {cycleEnd}</li>
        </ul>
        <p>To avoid any interruption to your team's access, please renew before the cycle ends.</p>
        <p><a href="{renewLink}" style="display:inline-block; background:#A57865; color:white; padding:10px 20px; text-decoration:none; border-radius:4px;">Renew Subscription</a></p>
      </div>`,
    bodyText: "Hi {recipientName}, your Verifai GRC subscription for {customerName} expires in 30 days on {cycleEnd}. Modules: {moduleList}. Renew at: {renewLink}",
    placeholders: ["recipientName", "customerName", "moduleList", "cycleEnd", "renewLink", "daysLeft"],
  },
  {
    code: "SUBSCRIPTION_REMINDER_15D",
    name: "Subscription — 15-day reminder",
    description: "Sent 15 days before cycleEnd.",
    subject: "Reminder: Your subscription expires in 15 days",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #C9A84C;">Subscription expires in 15 days</h2>
        <p>Hi {recipientName},</p>
        <p>Your <strong>{customerName}</strong> subscription expires on <strong>{cycleEnd}</strong> ({daysLeft} days from today).</p>
        <p><strong>Modules:</strong> {moduleList}</p>
        <p>Renew now to keep continuous access to your modules.</p>
        <p><a href="{renewLink}" style="display:inline-block; background:#A57865; color:white; padding:10px 20px; text-decoration:none; border-radius:4px;">Renew Subscription</a></p>
      </div>`,
    bodyText: "Hi {recipientName}, {customerName}'s subscription expires in {daysLeft} days on {cycleEnd}. Renew at: {renewLink}",
    placeholders: ["recipientName", "customerName", "moduleList", "cycleEnd", "renewLink", "daysLeft"],
  },
  {
    code: "SUBSCRIPTION_REMINDER_7D",
    name: "Subscription — 7-day urgent reminder",
    description: "Sent 7 days before cycleEnd.",
    subject: "Urgent: Renew your subscription within 7 days",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #C0392B;">Urgent: Subscription expires in {daysLeft} days</h2>
        <p>Hi {recipientName},</p>
        <p><strong>{customerName}</strong>'s Verifai GRC subscription will expire on <strong>{cycleEnd}</strong>.</p>
        <p><strong>Affected modules:</strong> {moduleList}</p>
        <p>If you don't renew before then, your team will lose write access (read-only for 7 days), then full access will be suspended.</p>
        <p><a href="{renewLink}" style="display:inline-block; background:#C0392B; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight:600;">Renew Now</a></p>
      </div>`,
    bodyText: "URGENT: {customerName}'s subscription expires in {daysLeft} days on {cycleEnd}. Modules: {moduleList}. Renew immediately: {renewLink}",
    placeholders: ["recipientName", "customerName", "moduleList", "cycleEnd", "renewLink", "daysLeft"],
  },
  {
    code: "SUBSCRIPTION_REMINDER_3D",
    name: "Subscription — final countdown (3/2/1 days)",
    description: "Sent on each of the final 3 days before cycleEnd.",
    subject: "Final notice: Subscription expires in {daysLeft} day(s)",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #C0392B;">Final notice — {daysLeft} day(s) remaining</h2>
        <p>Hi {recipientName},</p>
        <p>Tomorrow is just around the corner. <strong>{customerName}</strong>'s subscription for <strong>{moduleList}</strong> expires on <strong>{cycleEnd}</strong>.</p>
        <p>If you don't renew today, expect:</p>
        <ul>
          <li>Day 1–7 after expiry: <em>Read-only mode</em> — view data, no edits</li>
          <li>Day 8+: Modules suspended; only the billing portal is reachable</li>
        </ul>
        <p><a href="{renewLink}" style="display:inline-block; background:#C0392B; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight:600;">Renew in 60 seconds</a></p>
      </div>`,
    bodyText: "FINAL NOTICE: {customerName}'s subscription expires in {daysLeft} day(s) on {cycleEnd}. Renew now: {renewLink}",
    placeholders: ["recipientName", "customerName", "moduleList", "cycleEnd", "renewLink", "daysLeft"],
  },
  {
    code: "SUBSCRIPTION_EXPIRED",
    name: "Subscription — expired today",
    description: "Sent on the day cycleEnd passes.",
    subject: "Your Verifai GRC subscription has expired",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #C0392B;">Subscription expired</h2>
        <p>Hi {recipientName},</p>
        <p>Your <strong>{customerName}</strong> Verifai GRC subscription expired today. Affected modules: <strong>{moduleList}</strong>.</p>
        <p>For the next 7 days you can still access your data in read-only mode while you arrange renewal. After day 7, modules will be suspended until renewal.</p>
        <p><strong>Your data is safe.</strong> Nothing is deleted. Renew anytime to restore full access.</p>
        <p><a href="{renewLink}" style="display:inline-block; background:#C0392B; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight:600;">Renew Now</a></p>
      </div>`,
    bodyText: "Your {customerName} Verifai GRC subscription expired today. Read-only access for 7 days. Renew: {renewLink}",
    placeholders: ["recipientName", "customerName", "moduleList", "cycleEnd", "renewLink"],
  },
  {
    code: "SUBSCRIPTION_GRACE_PERIOD",
    name: "Subscription — grace period reminder",
    description: "Sent on days 1, 3, 7 of the grace period.",
    subject: "Read-only mode: Your subscription needs renewal",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #C0392B;">{customerName} is in read-only mode</h2>
        <p>Hi {recipientName},</p>
        <p>Your subscription expired {daysLeft} day(s) ago. Your team can still view their data but cannot make changes. After day 7 of grace period, full access will be suspended.</p>
        <p><a href="{renewLink}" style="display:inline-block; background:#C0392B; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight:600;">Renew to restore full access</a></p>
      </div>`,
    bodyText: "{customerName} is in read-only mode ({daysLeft} days post-expiry). Renew to restore: {renewLink}",
    placeholders: ["recipientName", "customerName", "moduleList", "renewLink", "daysLeft"],
  },
  {
    code: "SUBSCRIPTION_RENEWED",
    name: "Subscription renewed — payment confirmation",
    description: "Sent after a successful renewal payment.",
    subject: "Subscription renewed — Invoice {invoiceNumber}",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #4A5E3A;">Thank you — payment received</h2>
        <p>Hi {recipientName},</p>
        <p>Your renewal for <strong>{customerName}</strong> has been processed successfully.</p>
        <table style="width:100%; margin: 20px 0; font-size:14px;">
          <tr><td style="padding:6px;"><strong>Invoice number:</strong></td><td>{invoiceNumber}</td></tr>
          <tr><td style="padding:6px;"><strong>Amount paid:</strong></td><td>{amount}</td></tr>
          <tr><td style="padding:6px;"><strong>Modules:</strong></td><td>{moduleList}</td></tr>
          <tr><td style="padding:6px;"><strong>Next renewal:</strong></td><td>{cycleEnd}</td></tr>
        </table>
        <p>Your invoice is attached and also available in the billing portal.</p>
        <p><a href="{portalLink}" style="display:inline-block; background:#A57865; color:white; padding:10px 20px; text-decoration:none; border-radius:4px;">View Subscription</a></p>
      </div>`,
    bodyText: "Renewal confirmed for {customerName}. Invoice {invoiceNumber}, amount {amount}. Next renewal: {cycleEnd}.",
    placeholders: ["recipientName", "customerName", "invoiceNumber", "amount", "moduleList", "cycleEnd", "portalLink"],
  },
  {
    code: "PAYMENT_FAILED",
    name: "Payment failed",
    description: "Sent when an automatic or one-time payment fails.",
    subject: "Action required: Payment failed for your subscription",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #C0392B;">Payment failed</h2>
        <p>Hi {recipientName},</p>
        <p>We couldn't process the payment for your Verifai GRC subscription on <strong>{customerName}</strong>.</p>
        <p><strong>Reason:</strong> {errorDescription}</p>
        <p>Please update your billing details and retry. If you don't act, your subscription will move to read-only mode at cycle end.</p>
        <p><a href="{renewLink}" style="display:inline-block; background:#C0392B; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight:600;">Retry Payment</a></p>
      </div>`,
    bodyText: "Payment failed for {customerName}. Reason: {errorDescription}. Retry at: {renewLink}",
    placeholders: ["recipientName", "customerName", "errorDescription", "renewLink"],
  },
  {
    code: "TRIAL_ENDING",
    name: "Trial ending soon",
    description: "Sent 3 and 1 days before trial ends.",
    subject: "Your Verifai trial ends in {daysLeft} day(s)",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #4A8FA8;">Your trial ends in {daysLeft} day(s)</h2>
        <p>Hi {recipientName},</p>
        <p>Your <strong>{customerName}</strong> trial ends on <strong>{trialEndsAt}</strong>. Subscribe before then to keep your data and team access intact.</p>
        <p><a href="{renewLink}" style="display:inline-block; background:#A57865; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight:600;">Subscribe Now</a></p>
        <p style="font-size:12px; color:#8E7065;">If you don't subscribe, your account will be paused — your data will be retained for 30 days while you decide.</p>
      </div>`,
    bodyText: "{customerName} trial ends in {daysLeft} day(s) on {trialEndsAt}. Subscribe: {renewLink}",
    placeholders: ["recipientName", "customerName", "trialEndsAt", "renewLink", "daysLeft"],
  },
  {
    code: "WELCOME_SIGNUP",
    name: "Welcome — new account",
    description: "Sent immediately after a successful self-signup.",
    subject: "Welcome to Verifai GRC, {customerName}!",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #A57865;">Welcome to Verifai GRC</h2>
        <p>Hi {recipientName},</p>
        <p>Your account for <strong>{customerName}</strong> is ready. Subscribed modules: <strong>{moduleList}</strong>.</p>
        <p><a href="{portalLink}" style="display:inline-block; background:#A57865; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight:600;">Sign In</a></p>
        <p>Need help getting started? Reply to this email and our team will guide you.</p>
      </div>`,
    bodyText: "Welcome to Verifai GRC, {customerName}! Subscribed modules: {moduleList}. Sign in: {portalLink}",
    placeholders: ["recipientName", "customerName", "moduleList", "portalLink"],
  },
];

export async function seedSubscriptionEmailTemplates(client: PrismaClient = prisma) {
  console.log("🌱 Seeding subscription email templates...");
  for (const t of TEMPLATES) {
    await client.emailTemplate.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        description: t.description,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        bodyText: t.bodyText,
        placeholders: JSON.stringify(t.placeholders),
        category: "reminder",
        isActive: true,
        isSystem: true,
        module: "grc",
      },
      create: {
        code: t.code,
        name: t.name,
        description: t.description,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        bodyText: t.bodyText,
        placeholders: JSON.stringify(t.placeholders),
        category: "reminder",
        isActive: true,
        isSystem: true,
        module: "grc",
      },
    });
    console.log(`  ✓ ${t.code}`);
  }
  console.log(`✅ ${TEMPLATES.length} subscription templates seeded`);
}

if (require.main === module) {
  seedSubscriptionEmailTemplates()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}

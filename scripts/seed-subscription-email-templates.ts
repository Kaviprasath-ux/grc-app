/**
 * Seeds subscription-related email templates into the EmailTemplate table.
 * Idempotent — uses upsert keyed on `code`.
 *
 * Run: npx tsx scripts/seed-subscription-email-templates.ts
 *
 * V1 templates:
 *   SUBSCRIPTION_REMINDER_30D / _15D / _7D / _3D   - cycle-end reminders
 *   SUBSCRIPTION_EXPIRED / _GRACE_PERIOD / _RENEWED
 *   PAYMENT_FAILED / TRIAL_ENDING / WELCOME_SIGNUP
 *
 * V2 templates (Phase 10):
 *   BASE_ENDING_30D / _15D / _7D    - heads-up before BASE -> GENERAL flip
 *   MANDATE_FAILED                  - Razorpay subscription.halted
 *   CONTRACT_ENDING_30D             - 30 days before 2-year contract end
 *   CANCELLATION_QUEUED             - confirmation of queued cancel
 *   CANCELLATION_PROCESSED          - confirmation that queued cancel was processed
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

  // ─── V2 (Base/General + 2-year contract) templates ─────────────
  {
    code: "BASE_ENDING_30D",
    name: "V2 — Base ends in 30 days",
    description: "Sent 30 days before the Year-1 Base plan flips to General.",
    subject: "Heads up: your Base plan ends in 30 days — General plan starts then",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #A57865;">Your Year-1 Base plan ends in 30 days</h2>
        <p>Hi {recipientName},</p>
        <p>Heads up — your <strong>{customerName}</strong> Year-1 Base plan ends on <strong>{baseEndDate}</strong>.</p>
        <p>From that day, your General plan auto-starts. Your saved payment method will be auto-debited on the cycle you chose at signup.</p>
        <ul>
          <li><strong>Modules:</strong> {moduleList}</li>
          <li><strong>General plan billing:</strong> {generalBillingCycle}</li>
        </ul>
        <p>No action needed — this is just a heads-up. To review or update your payment method, visit your subscription portal.</p>
        <p><a href="{portalLink}" style="display:inline-block; background:#A57865; color:white; padding:10px 20px; text-decoration:none; border-radius:4px;">Review Subscription</a></p>
      </div>`,
    bodyText: "Hi {recipientName}, your {customerName} Year-1 Base plan ends on {baseEndDate}. General plan ({generalBillingCycle}) auto-starts then. Review: {portalLink}",
    placeholders: ["recipientName", "customerName", "moduleList", "baseEndDate", "generalBillingCycle", "portalLink"],
  },
  {
    code: "BASE_ENDING_15D",
    name: "V2 — Base ends in 15 days",
    description: "Sent 15 days before the Year-1 Base plan flips to General.",
    subject: "Reminder: Base plan ends in 15 days — General plan starts then",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #C9A84C;">Base plan ends in 15 days</h2>
        <p>Hi {recipientName},</p>
        <p>Your <strong>{customerName}</strong> Year-1 Base plan ends on <strong>{baseEndDate}</strong> ({daysLeft} days). The General plan auto-starts at standard pricing on that date.</p>
        <p><a href="{portalLink}" style="display:inline-block; background:#A57865; color:white; padding:10px 20px; text-decoration:none; border-radius:4px;">Review Subscription</a></p>
      </div>`,
    bodyText: "Hi {recipientName}, {customerName}'s Base plan ends in {daysLeft} days on {baseEndDate}. General ({generalBillingCycle}) auto-starts. Review: {portalLink}",
    placeholders: ["recipientName", "customerName", "moduleList", "baseEndDate", "daysLeft", "generalBillingCycle", "portalLink"],
  },
  {
    code: "BASE_ENDING_7D",
    name: "V2 — Base ends in 7 days",
    description: "Sent 7 days before the Year-1 Base plan flips to General.",
    subject: "1 week left: General plan starts in 7 days",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #C0392B;">General plan starts in 7 days</h2>
        <p>Hi {recipientName},</p>
        <p>Your <strong>{customerName}</strong> Year-1 Base plan ends on <strong>{baseEndDate}</strong> ({daysLeft} days). The first General-plan charge will be auto-debited on that date.</p>
        <p>If your payment method needs updating, please do so before then to avoid service interruption.</p>
        <p><a href="{portalLink}" style="display:inline-block; background:#C0392B; color:white; padding:10px 20px; text-decoration:none; border-radius:4px;">Review Payment Method</a></p>
      </div>`,
    bodyText: "Hi {recipientName}, {customerName}'s Base plan ends in {daysLeft} days. First General charge will auto-debit on {baseEndDate}. Update payment if needed: {portalLink}",
    placeholders: ["recipientName", "customerName", "moduleList", "baseEndDate", "daysLeft", "generalBillingCycle", "portalLink"],
  },
  {
    code: "MANDATE_FAILED",
    name: "V2 — Auto-debit failed",
    description: "Sent when Razorpay subscription.halted webhook fires (auto-debit retries exhausted).",
    subject: "Action required: We couldn't process your auto-debit",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #C0392B;">Auto-debit failed</h2>
        <p>Hi {recipientName},</p>
        <p>We weren't able to process the latest auto-debit charge for your <strong>{customerName}</strong> subscription.</p>
        <p>Your subscription is currently in a grace period — your team retains access for now, but service will be suspended if payment isn't updated within {gracePeriodDays} days.</p>
        <p>Please update your saved payment method and we'll retry automatically.</p>
        <p><a href="{portalLink}" style="display:inline-block; background:#C0392B; color:white; padding:10px 20px; text-decoration:none; border-radius:4px;">Update Payment Method</a></p>
      </div>`,
    bodyText: "Hi {recipientName}, the auto-debit for {customerName} failed. Update payment method within {gracePeriodDays} days to avoid suspension: {portalLink}",
    placeholders: ["recipientName", "customerName", "gracePeriodDays", "portalLink"],
  },
  {
    code: "CONTRACT_ENDING_30D",
    name: "V2 — Contract ends in 30 days",
    description: "Sent 30 days before the 2-year contract end (cancellation becomes available).",
    subject: "Your 2-year contract ends in 30 days",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #A57865;">Your 2-year contract ends in 30 days</h2>
        <p>Hi {recipientName},</p>
        <p>Your <strong>{customerName}</strong> subscription completes its 2-year contract on <strong>{contractEndDate}</strong>. From that date you can cancel anytime — no further commitment required.</p>
        <p>If you'd like to continue, no action is needed: your General plan keeps running on auto-debit.</p>
        <p>If you'd like to schedule cancellation now to take effect on the contract end date, you can do so from your subscription portal.</p>
        <p><a href="{portalLink}" style="display:inline-block; background:#A57865; color:white; padding:10px 20px; text-decoration:none; border-radius:4px;">Manage Subscription</a></p>
      </div>`,
    bodyText: "Hi {recipientName}, {customerName}'s 2-year contract ends on {contractEndDate}. From then you can cancel anytime. Manage: {portalLink}",
    placeholders: ["recipientName", "customerName", "contractEndDate", "portalLink"],
  },
  {
    code: "CANCELLATION_QUEUED",
    name: "V2 — Cancellation queued",
    description: "Sent when a customer queues a cancellation during the lock-in period.",
    subject: "Cancellation queued — will process at contract end",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #A57865;">Cancellation queued</h2>
        <p>Hi {recipientName},</p>
        <p>We've queued cancellation for your <strong>{customerName}</strong> subscription. It will take effect on <strong>{contractEndDate}</strong> — the end of your 2-year contract.</p>
        <p>Until then, your subscription remains fully active and recurring charges will continue. After the contract end, the subscription will be cancelled automatically and no further charges will fire.</p>
        <p>If you change your mind, contact your administrator to cancel the queued request.</p>
        <p><a href="{portalLink}" style="display:inline-block; background:#A57865; color:white; padding:10px 20px; text-decoration:none; border-radius:4px;">View Subscription</a></p>
      </div>`,
    bodyText: "Hi {recipientName}, cancellation queued for {customerName}. Will process on {contractEndDate}. Subscription stays active until then. View: {portalLink}",
    placeholders: ["recipientName", "customerName", "contractEndDate", "portalLink"],
  },
  {
    code: "CANCELLATION_PROCESSED",
    name: "V2 — Cancellation processed",
    description: "Sent when the plan-transitions cron processes a queued cancellation at contract end.",
    subject: "Subscription cancelled — contract complete",
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3A2D28;">
        <h2 style="color: #A57865;">Subscription cancelled</h2>
        <p>Hi {recipientName},</p>
        <p>Your <strong>{customerName}</strong> Verifai GRC subscription has been cancelled as scheduled. Your 2-year contract is now complete and no further charges will be made.</p>
        <p><strong>Modules:</strong> {moduleList}</p>
        <p>If you'd like to come back later, you can sign up again at any time.</p>
        <p>Thank you for using Verifai GRC.</p>
      </div>`,
    bodyText: "Hi {recipientName}, {customerName}'s subscription has been cancelled. 2-year contract complete, no further charges. Modules: {moduleList}.",
    placeholders: ["recipientName", "customerName", "moduleList"],
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

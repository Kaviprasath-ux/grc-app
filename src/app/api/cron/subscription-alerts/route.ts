/**
 * Subscription expiry alerts cron.
 *
 * Schedule: daily at 09:00 UTC (vercel.json).
 *
 * Behaviour:
 *   For every (non-COMPLIMENTARY) ModuleSubscription whose cycleEnd falls on
 *   today + N days (where N ∈ {30, 15, 7, 3, 2, 1, 0, -1..-7}), dispatch the
 *   corresponding email template to every CustomerAdministrator on that customer.
 *
 * Templates (seeded via scripts/seed-subscription-email-templates.ts):
 *   SUBSCRIPTION_REMINDER_30D, _15D, _7D, _3D, SUBSCRIPTION_EXPIRED, _GRACE_PERIOD,
 *   TRIAL_ENDING_3D
 *
 * One email per (customer, window) per cron run. If multiple modules expire on
 * the same day, they're grouped into one email with `{{moduleList}}`
 * substituted as a comma-separated list.
 *
 * Idempotency: re-running on the same day is safe — your email server's
 * dedupe (or a per-day cache) prevents double-sends. We don't track sent state
 * here; an extra email once a year is preferable to missed alerts.
 *
 * Security: Bearer CRON_SECRET (matches existing crons). Manual invocation
 * possible with `x-triggered-by: manual` header.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTemplatedEmail } from "@/lib/email-service";
import { startCronRun, finishCronRun } from "@/lib/cron-logger";

interface AlertWindow {
  days: number;     // negative = past
  template: string; // email template code
  isUrgent: boolean; // also dispatch SMS (Phase 2.5)
}

// Order matters — we pick the FIRST matching window per module so 30d doesn't
// also fire 15d for the same customer accidentally.
const WINDOWS: AlertWindow[] = [
  { days:  30, template: "SUBSCRIPTION_REMINDER_30D", isUrgent: false },
  { days:  15, template: "SUBSCRIPTION_REMINDER_15D", isUrgent: false },
  { days:   7, template: "SUBSCRIPTION_REMINDER_7D",  isUrgent: true  },
  { days:   3, template: "SUBSCRIPTION_REMINDER_3D",  isUrgent: true  },
  { days:   2, template: "SUBSCRIPTION_REMINDER_3D",  isUrgent: true  },
  { days:   1, template: "SUBSCRIPTION_REMINDER_3D",  isUrgent: true  },
  { days:   0, template: "SUBSCRIPTION_EXPIRED",      isUrgent: true  },
  { days:  -1, template: "SUBSCRIPTION_GRACE_PERIOD", isUrgent: true  },
  { days:  -3, template: "SUBSCRIPTION_GRACE_PERIOD", isUrgent: true  },
  { days:  -7, template: "SUBSCRIPTION_GRACE_PERIOD", isUrgent: true  },
];

const TRIAL_ENDING_DAYS = [3, 1];

function startOfDayUTC(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function daysBetween(from: Date, to: Date): number {
  const ms = startOfDayUTC(to).getTime() - startOfDayUTC(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function appUrl(): string {
  return process.env.NEXTAUTH_URL || "https://app.verifai.com";
}

interface DispatchResult { sent: number; failed: number; skipped: number; }

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const triggeredBy = req.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule";
  const runId = await startCronRun({
    taskFunction: "subscription-alerts",
    name: "Subscription Expiry Alerts",
    schedule: "0 9 * * *",
    triggeredBy,
  });

  const today = startOfDayUTC(new Date());
  const result: DispatchResult = { sent: 0, failed: 0, skipped: 0 };
  const errors: string[] = [];

  console.log(`[SubscriptionAlerts] Starting at ${today.toISOString()}`);

  try {
    // ── 1. Module-expiry windows ────────────────────────────
    // Group: per customer, per window, list of moduleCodes expiring that window.
    type Bucket = { customerAccountId: string; window: AlertWindow; modules: string[]; cycleEnd: Date };
    const buckets = new Map<string, Bucket>();

    const subs = await prisma.subscription.findMany({
      where: { subscriptionType: { in: ["PAID", "TRIAL"] } },
      include: { modules: true, customerAccount: { select: { id: true, name: true } } },
    });

    for (const sub of subs) {
      for (const m of sub.modules) {
        if (m.cancelledAt) continue;
        const delta = daysBetween(today, m.cycleEnd);
        const window = WINDOWS.find((w) => w.days === delta);
        if (!window) continue;
        const key = `${sub.customerAccountId}|${window.days}`;
        const existing = buckets.get(key);
        if (existing) existing.modules.push(m.moduleCode);
        else buckets.set(key, {
          customerAccountId: sub.customerAccountId,
          window,
          modules: [m.moduleCode],
          cycleEnd: m.cycleEnd,
        });
      }
    }

    for (const bucket of buckets.values()) {
      // Find CustomerAdministrator(s) for this customer
      const admins = await prisma.user.findMany({
        where: {
          customerAccountId: bucket.customerAccountId,
          isActive: true,
          userRoles: { some: { role: { name: "CustomerAdministrator" } } },
        },
        select: { id: true, fullName: true, email: true },
      });
      if (admins.length === 0) {
        result.skipped++;
        continue;
      }

      const customer = subs.find((s) => s.customerAccountId === bucket.customerAccountId)!.customerAccount;
      const moduleList = bucket.modules.join(", ");
      const days = Math.abs(bucket.window.days);
      const placeholders = {
        customerName: customer.name,
        moduleList,
        daysLeft: String(days),
        cycleEnd: bucket.cycleEnd.toISOString().slice(0, 10),
        renewLink: `${appUrl()}/settings/subscription/renew`,
        portalLink: `${appUrl()}/settings/subscription`,
      };

      for (const admin of admins) {
        try {
          await sendTemplatedEmail(
            bucket.window.template,
            admin.email,
            { ...placeholders, recipientName: admin.fullName, recipientEmail: admin.email },
            admin.fullName
          );
          result.sent++;
        } catch (e) {
          result.failed++;
          errors.push(`${admin.email} ${bucket.window.template}: ${(e as Error).message}`);
        }

        // SMS for urgent windows: src/lib/sms-service.ts is wired and ready,
        // but the User model has no phoneNumber column today. When that field
        // is added (future schema change), call sendSms() here for
        // bucket.window.isUrgent.
      }
    }

    // ── 2. Trial-ending windows ─────────────────────────────
    for (const sub of subs) {
      if (sub.subscriptionType !== "TRIAL" || !sub.trialEndsAt) continue;
      const delta = daysBetween(today, sub.trialEndsAt);
      if (!TRIAL_ENDING_DAYS.includes(delta)) continue;

      const admins = await prisma.user.findMany({
        where: {
          customerAccountId: sub.customerAccountId,
          isActive: true,
          userRoles: { some: { role: { name: "CustomerAdministrator" } } },
        },
        select: { id: true, fullName: true, email: true },
      });

      const placeholders = {
        customerName: sub.customerAccount.name,
        daysLeft: String(delta),
        trialEndsAt: sub.trialEndsAt.toISOString().slice(0, 10),
        renewLink: `${appUrl()}/settings/subscription/renew`,
      };
      for (const admin of admins) {
        try {
          await sendTemplatedEmail(
            "TRIAL_ENDING",
            admin.email,
            { ...placeholders, recipientName: admin.fullName, recipientEmail: admin.email },
            admin.fullName
          );
          result.sent++;
        } catch (e) {
          result.failed++;
          errors.push(`${admin.email} TRIAL_ENDING: ${(e as Error).message}`);
        }
      }
    }

    console.log(`[SubscriptionAlerts] Done. ${result.sent} sent · ${result.failed} failed · ${result.skipped} skipped`);
    await finishCronRun(runId, "Completed", { ok: true, ...result, errors });
    return NextResponse.json({ data: { ...result, errors: errors.slice(0, 10) } });
  } catch (e) {
    console.error("[SubscriptionAlerts] fatal:", e);
    await finishCronRun(runId, "Failed", { ok: false, error: (e as Error).message, ...result });
    return NextResponse.json({ error: (e as Error).message, ...result }, { status: 500 });
  }
}

/**
 * V2 plan transition cron.
 *
 * Schedule: daily at 01:00 UTC (vercel.json).
 *
 * Behaviour:
 *   For every ModuleSubscription where planType=BASE AND baseEndDate <= today,
 *   flip the row to GENERAL. Computes a new cycleEnd from the customer's
 *   chosen generalBillingCycle, swaps in GENERAL limits/price snapshot,
 *   and creates the first GENERAL invoice.
 *
 *   In stub mode the invoice is marked PAID + a Payment row is recorded
 *   (simulating a successful Razorpay mandate auto-charge). In real Razorpay
 *   mode, the invoice stays ISSUED until the subscription.charged webhook
 *   marks it PAID.
 *
 * Idempotent: re-running on the same day is a no-op for already-flipped rows
 * (the WHERE clause excludes planType != BASE). Cancelled and COMPLIMENTARY
 * rows are also skipped.
 *
 * Security: Bearer CRON_SECRET. Manual invocation via x-triggered-by: manual.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { startCronRun, finishCronRun } from "@/lib/cron-logger";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { isStubMode } from "@/lib/payment-provider";
import { cancelMandate } from "@/lib/payment-provider-mandate";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { sendTemplatedEmail } from "@/lib/email-service";
import { SUBSCRIPTION_V2_ENABLED } from "@/lib/subscription-flags";

const GST_PERCENT = 18;
function withGst(subtotal: number): { tax: number; total: number } {
  const tax = Math.round(subtotal * (GST_PERCENT / 100) * 100) / 100;
  return { tax: tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

function startOfDayUTC(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function advanceCycleEnd(from: Date, cycle: "MONTHLY" | "YEARLY"): Date {
  const r = new Date(from);
  if (cycle === "MONTHLY") r.setUTCMonth(r.getUTCMonth() + 1);
  else r.setUTCFullYear(r.getUTCFullYear() + 1);
  return r;
}

interface TransitionResult {
  flipped: number;
  skippedAlreadyGeneral: number;
  skippedNoPricing: number;
  skippedCancelled: number;
  invoicesCreated: number;
  /** Queued-cancellation rows processed once contract end was reached. */
  queuedCancellationsProcessed: number;
  errors: string[];
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUBSCRIPTION_V2_ENABLED) {
    return NextResponse.json({
      data: { skipped: true, reason: "SUBSCRIPTION_V2_ENABLED=false" },
    });
  }

  const triggeredBy = req.headers.get("x-triggered-by") === "manual" ? "manual" : "schedule";
  const runId = await startCronRun({
    taskFunction: "plan-transitions",
    name: "V2 BASE -> GENERAL Plan Transitions",
    schedule: "0 1 * * *",
    triggeredBy,
  });

  const today = startOfDayUTC(new Date());
  const result: TransitionResult = {
    flipped: 0,
    skippedAlreadyGeneral: 0,
    skippedNoPricing: 0,
    skippedCancelled: 0,
    invoicesCreated: 0,
    queuedCancellationsProcessed: 0,
    errors: [],
  };

  console.log(`[PlanTransitions] Run starting at ${today.toISOString()}`);

  try {
    // Eligible rows: BASE plans whose baseEndDate is today or earlier.
    const eligible = await prisma.moduleSubscription.findMany({
      where: {
        planType: "BASE",
        baseEndDate: { lte: today },
      },
      include: { subscription: true },
    });

    console.log(`[PlanTransitions] Found ${eligible.length} eligible BASE rows`);

    // Pre-fetch all GENERAL pricing rows once (small set, max 3 rows).
    const generalPricing = await prisma.modulePlanPricing.findMany({
      where: { planType: "GENERAL", isActive: true },
    });

    for (const ms of eligible) {
      try {
        if (ms.cancelledAt) {
          result.skippedCancelled++;
          continue;
        }

        const pricing = generalPricing.find((p) => p.moduleCode === ms.moduleCode);
        if (!pricing) {
          result.skippedNoPricing++;
          result.errors.push(`No GENERAL pricing for ${ms.moduleCode} (ms ${ms.id})`);
          continue;
        }

        const cycle = ms.generalBillingCycle ?? "YEARLY";
        const cycleStart = ms.baseEndDate!;
        const cycleEnd = advanceCycleEnd(cycleStart, cycle);
        const unitPrice =
          cycle === "MONTHLY"
            ? Number(pricing.monthlyPrice ?? 0)
            : Number(pricing.yearlyPrice);
        const { tax, total } = withGst(unitPrice);

        // Pre-generate invoice number (its own internal transaction).
        const invoiceNumber = await nextInvoiceNumber(today);

        await prisma.$transaction(async (tx) => {
          // 1. Flip ModuleSubscription to GENERAL with refreshed snapshot.
          await tx.moduleSubscription.update({
            where: { id: ms.id },
            data: {
              planType: "GENERAL",
              nextPlanType: null,
              billingCycle: cycle,
              unitPrice,
              userLimit: pricing.unlimitedUsers ? 999_999 : pricing.userLimit,
              vendorLimit: pricing.unlimitedVendors ? 999_999 : pricing.vendorLimit,
              assessmentLimit: pricing.unlimitedAssessments
                ? 999_999
                : pricing.assessmentLimit,
              frameworkLimit: pricing.unlimitedFrameworks
                ? 999_999
                : pricing.frameworkLimit,
              auditLimit: pricing.unlimitedAudits ? 999_999 : pricing.auditLimit,
              cycleStart,
              cycleEnd,
            },
          });

          // 2. New invoice for the first GENERAL charge.
          const invoice = await tx.invoice.create({
            data: {
              subscriptionId: ms.subscriptionId,
              customerAccountId: ms.subscription.customerAccountId,
              invoiceNumber,
              status: isStubMode() ? "PAID" : "ISSUED",
              subtotal: unitPrice,
              discountAmount: 0,
              taxAmount: tax,
              total,
              periodStart: cycleStart,
              periodEnd: cycleEnd,
            },
          });

          // 3. Single line item (one ModuleSubscription per cron invoice).
          await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              moduleCode: ms.moduleCode,
              tier: ms.tier, // legacy column
              description: `${ms.moduleCode} - GENERAL (${cycle === "MONTHLY" ? "Monthly" : "Yearly"})`,
              quantity: 1,
              unitPrice,
              amount: unitPrice,
            },
          });

          // 4. Stub-mode payment record (simulates mandate auto-charge).
          if (isStubMode()) {
            await tx.payment.create({
              data: {
                subscriptionId: ms.subscriptionId,
                amount: total,
                currency: "INR",
                provider: "RAZORPAY",
                providerOrderId: `STUB-FLIP-ORDER-${ms.id}`,
                providerPaymentId: `STUB-FLIP-PAY-${ms.id}`,
                providerSignature: "STUB-SIGNATURE",
                status: "CAPTURED",
                paidAt: today,
                invoice: { connect: { id: invoice.id } },
              },
            });
          }
        });

        // 5. Sync legacy SubscriptionPlan with new GENERAL limits.
        try {
          await syncSubscriptionPlan(ms.id);
        } catch (e) {
          console.warn(`[PlanTransitions] sync failed for ${ms.id}:`, e);
        }

        result.flipped++;
        result.invoicesCreated++;
        console.log(
          `[PlanTransitions] Flipped ${ms.moduleCode} (ms ${ms.id}) to GENERAL ${cycle}, invoice ${invoiceNumber}, total INR ${total}`
        );
      } catch (e) {
        const msg = (e as Error).message || String(e);
        result.errors.push(`Failed ${ms.id}: ${msg}`);
        console.error(`[PlanTransitions] Error on ${ms.id}:`, msg);
      }
    }

    // ── Queued cancellations: process rows where contract has ended ──
    // Customer asked to cancel during lock-in; we set cancellationRequestedAt
    // and held the row. Now that today >= contractEndDate, do the actual cancel.
    const queuedReady = await prisma.moduleSubscription.findMany({
      where: {
        cancellationRequestedAt: { not: null },
        cancelledAt: null,
        contractEndDate: { lte: today },
      },
    });

    // Track customers we cancelled today so we email each at most once.
    const notifiedCustomerIds = new Set<string>();
    for (const ms of queuedReady) {
      try {
        if (ms.mandateId) {
          try {
            await cancelMandate(ms.mandateId);
          } catch (e) {
            console.warn(`[PlanTransitions] mandate cancel failed for ${ms.id}:`, (e as Error).message);
          }
        }
        await prisma.moduleSubscription.update({
          where: { id: ms.id },
          data: { cancelledAt: today },
        });
        await syncSubscriptionPlan(ms.id);
        result.queuedCancellationsProcessed++;

        // Send CANCELLATION_PROCESSED email — once per customer, best-effort.
        const sub = await prisma.subscription.findUnique({
          where: { id: ms.subscriptionId },
          include: {
            customerAccount: { select: { id: true, name: true } },
            modules: { select: { moduleCode: true, cancelledAt: true } },
          },
        });
        if (sub && !notifiedCustomerIds.has(sub.customerAccount.id)) {
          notifiedCustomerIds.add(sub.customerAccount.id);
          try {
            const admins = await prisma.user.findMany({
              where: {
                customerAccountId: sub.customerAccount.id,
                isActive: true,
                userRoles: { some: { role: { name: "CustomerAdministrator" } } },
              },
              select: { fullName: true, email: true },
            });
            const cancelledModules = sub.modules
              .filter((m) => m.cancelledAt || m.moduleCode === ms.moduleCode)
              .map((m) => m.moduleCode);
            for (const admin of admins) {
              await sendTemplatedEmail(
                "CANCELLATION_PROCESSED",
                admin.email,
                {
                  customerName: sub.customerAccount.name,
                  moduleList: cancelledModules.join(", "),
                  recipientName: admin.fullName,
                },
                admin.fullName
              );
            }
          } catch (e) {
            console.warn(`[PlanTransitions] CANCELLATION_PROCESSED email failed:`, (e as Error).message);
          }
        }
      } catch (e) {
        const msg = (e as Error).message || String(e);
        result.errors.push(`Queued cancellation failed for ${ms.id}: ${msg}`);
      }
    }

    // Count rows already on GENERAL (informational only — they're not in `eligible`).
    result.skippedAlreadyGeneral = await prisma.moduleSubscription.count({
      where: { planType: "GENERAL" },
    });

    await finishCronRun(runId, "Completed", {
      itemsProcessed: result.flipped,
      summary: result,
    });

    return NextResponse.json({
      data: {
        runAt: today.toISOString(),
        ...result,
      },
    });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    console.error("[PlanTransitions] Fatal:", msg);
    await finishCronRun(runId, "Failed", { errorText: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/settings/subscription/subscribe
 *
 * Authenticated V2 subscribe endpoint for an existing customer that doesn't
 * yet have a Subscription envelope. Mirrors /api/public/signup/v2 but skips
 * the customer/user creation steps — uses session.customerAccountId.
 *
 * Body: { modules: [{ moduleCode }], generalBillingCycle, contractAccepted: true }
 *
 * On success:
 *   - Subscription envelope (PAID, autoRenew=true)
 *   - ModuleSubscription per module on planType=BASE with all V2 lifecycle dates
 *   - Razorpay mandate (or stub)
 *   - BASE invoice + Payment in stub mode
 *   - Sync to legacy SubscriptionPlan
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { z } from "zod";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { createSubscriptionMandate } from "@/lib/payment-provider-mandate";
import { isStubMode } from "@/lib/payment-provider";
import { nextInvoiceNumber } from "@/lib/invoice-number";

const Schema = z.object({
  modules: z
    .array(z.object({ moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]) }))
    .min(1)
    .max(3),
  generalBillingCycle: z.enum(["MONTHLY", "YEARLY"]),
  contractAccepted: z.literal(true),
});

const GST_PERCENT = 18;
function withGst(subtotal: number): { tax: number; total: number } {
  const tax = Math.round(subtotal * (GST_PERCENT / 100) * 100) / 100;
  return { tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

function addYears(d: Date, years: number): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + years);
  return r;
}

export const POST = withAuth(
  async (req: NextRequest, _ctx, session) => {
    if (!session.customerAccountId) {
      return NextResponse.json({ error: "No customer account on session" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Reject if customer already has any subscription envelope (must be edited, not re-created).
    const existing = await prisma.subscription.findUnique({
      where: { customerAccountId: session.customerAccountId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Subscription already exists — use the renew/add-module flow" },
        { status: 409 }
      );
    }

    const codes = new Set(data.modules.map((m) => m.moduleCode));
    if (codes.size !== data.modules.length) {
      return NextResponse.json({ error: "Duplicate moduleCode in selection" }, { status: 400 });
    }

    // Lookup BASE pricing for snapshot
    const baseRows = await prisma.modulePlanPricing.findMany({
      where: {
        moduleCode: { in: data.modules.map((m) => m.moduleCode) },
        planType: "BASE",
        isActive: true,
      },
    });
    if (baseRows.length !== data.modules.length) {
      const missing = data.modules
        .map((m) => m.moduleCode)
        .filter((c) => !baseRows.find((r) => r.moduleCode === c));
      return NextResponse.json(
        { error: `BASE plan pricing missing for: ${missing.join(", ")} - run seed-module-plan-pricing` },
        { status: 503 }
      );
    }

    const now = new Date();
    const baseEnd = addYears(now, 1);
    const contractEnd = addYears(now, 2);

    const baseSubtotal = baseRows.reduce((s, r) => s + Number(r.yearlyPrice), 0);
    const { tax: baseTax, total: baseTotal } = withGst(baseSubtotal);

    const invoiceNumber = await nextInvoiceNumber(now);
    const customerCode = (await prisma.customerAccount.findUnique({
      where: { id: session.customerAccountId },
      select: { code: true },
    }))?.code ?? "UNKNOWN";

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Sync customer flags so the modules unlock immediately
          const enabledCodes = new Set(data.modules.map((m) => m.moduleCode));
          await tx.customerAccount.update({
            where: { id: session.customerAccountId! },
            data: {
              isGrcAdded: enabledCodes.has("GRC"),
              isTprmAdded: enabledCodes.has("TPRM"),
              isInternalAuditEnabled: enabledCodes.has("INTERNAL_AUDIT"),
            },
          });

          const sub = await tx.subscription.create({
            data: {
              customerAccountId: session.customerAccountId!,
              status: "ACTIVE",
              subscriptionType: "PAID",
              autoRenew: true,
              notes: `V2 self-subscribe on ${now.toISOString()} (BASE→GENERAL ${data.generalBillingCycle})`,
            },
          });

          const mandate = await createSubscriptionMandate({
            customerAccountId: session.customerAccountId!,
            generalBillingCycle: data.generalBillingCycle,
            unitAmount: baseTotal,
            description: `${customerCode} - ${data.modules.length} module(s) - 2yr autopay`,
            customerEmail: session.email ?? undefined,
            idempotencyKey: `subscribe-v2-${customerCode}-${now.getTime()}`,
          });

          const moduleSubIds: string[] = [];
          for (const m of data.modules) {
            const baseRow = baseRows.find((r) => r.moduleCode === m.moduleCode)!;
            const created = await tx.moduleSubscription.create({
              data: {
                subscriptionId: sub.id,
                moduleCode: m.moduleCode,
                tier: "BASIC",
                billingCycle: "YEARLY",
                unitPrice: baseRow.yearlyPrice,
                userLimit: baseRow.unlimitedUsers ? 999999 : baseRow.userLimit,
                vendorLimit: baseRow.unlimitedVendors ? 999999 : baseRow.vendorLimit,
                assessmentLimit: baseRow.unlimitedAssessments ? 999999 : baseRow.assessmentLimit,
                frameworkLimit: baseRow.unlimitedFrameworks ? 999999 : baseRow.frameworkLimit,
                auditLimit: baseRow.unlimitedAudits ? 999999 : baseRow.auditLimit,
                cycleStart: now,
                cycleEnd: baseEnd,
                planType: "BASE",
                nextPlanType: "GENERAL",
                baseStartDate: now,
                baseEndDate: baseEnd,
                contractStartDate: now,
                contractEndDate: contractEnd,
                generalBillingCycle: data.generalBillingCycle,
                generalStartDate: baseEnd,
                mandateId: mandate.mandateId,
                mandateStatus: mandate.status,
              },
            });
            moduleSubIds.push(created.id);
          }

          const invoice = await tx.invoice.create({
            data: {
              subscriptionId: sub.id,
              customerAccountId: session.customerAccountId!,
              invoiceNumber,
              status: isStubMode() ? "PAID" : "ISSUED",
              subtotal: baseSubtotal,
              discountAmount: 0,
              taxAmount: baseTax,
              total: baseTotal,
              periodStart: now,
              periodEnd: baseEnd,
            },
          });
          for (const m of data.modules) {
            const baseRow = baseRows.find((r) => r.moduleCode === m.moduleCode)!;
            const price = Number(baseRow.yearlyPrice);
            await tx.invoiceItem.create({
              data: {
                invoiceId: invoice.id,
                moduleCode: m.moduleCode,
                tier: "BASIC",
                description: `${m.moduleCode} - BASE (Year 1, Yearly)`,
                quantity: 1,
                unitPrice: price,
                amount: price,
              },
            });
          }

          if (isStubMode()) {
            await tx.payment.create({
              data: {
                subscriptionId: sub.id,
                amount: baseTotal,
                currency: "INR",
                provider: "RAZORPAY",
                providerOrderId: `STUB-ORDER-${customerCode}-${now.getTime()}`,
                providerPaymentId: `STUB-PAY-${customerCode}-${now.getTime()}`,
                providerSignature: "STUB-SIGNATURE",
                status: "CAPTURED",
                paidAt: now,
                invoice: { connect: { id: invoice.id } },
              },
            });
          }

          return {
            subscriptionId: sub.id,
            moduleSubIds,
            invoiceNumber,
            mandate: { mandateId: mandate.mandateId, status: mandate.status, checkoutUrl: mandate.checkoutUrl },
          };
        },
        { timeout: 20000 }
      );

      for (const id of result.moduleSubIds) {
        try {
          await syncSubscriptionPlan(id);
        } catch (e) {
          console.warn("[subscribe-v2] sync failed (non-fatal):", (e as Error).message);
        }
      }

      console.log(
        `[subscribe-v2] ${customerCode} - BASE for ${data.modules.length} module(s), GENERAL ${data.generalBillingCycle} after ${baseEnd.toISOString().slice(0, 10)}`
      );

      return NextResponse.json(
        {
          data: {
            subscriptionId: result.subscriptionId,
            invoiceNumber: result.invoiceNumber,
            baseAmount: baseTotal,
            baseEndDate: baseEnd,
            contractEndDate: contractEnd,
            generalBillingCycle: data.generalBillingCycle,
            mandate: result.mandate,
            stub: isStubMode(),
          },
        },
        { status: 201 }
      );
    } catch (e) {
      console.error("[subscribe-v2] failed:", e);
      return NextResponse.json({ error: (e as Error).message || "Subscribe failed" }, { status: 500 });
    }
  },
  { resource: "subscription.customer-portal", action: "edit" }
);

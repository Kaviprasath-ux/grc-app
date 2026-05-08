/**
 * POST /api/public/signup/v2 - V2 PUBLIC SIGNUP (UNAUTHENTICATED)
 *
 * Active when SUBSCRIPTION_V2_ENABLED=true. Coexists with V1 /api/public/signup.
 *
 * V2 lifecycle on customer signup:
 *   - planType=BASE for each requested module
 *   - baseStart=today, baseEnd=+1y, cycleEnd=baseEnd
 *   - contractStart=today, contractEnd=+2y (2-year lock-in)
 *   - nextPlanType=GENERAL, generalStart=baseEnd
 *   - generalBillingCycle=<chosen by customer> (used by Phase 6 flip cron)
 *
 * NOTE: Razorpay mandate creation is Phase 5. For now, this route creates
 * the customer + V2 rows immediately so signup is testable end-to-end. The
 * BASE invoice (INR 100 + 18% GST = INR 118) is created and marked PAID via
 * stub payment (dev mode) or queued PENDING (prod). When Phase 5 lands, the
 * Razorpay mandate is created here and the BASE charge becomes the first
 * mandate charge.
 *
 * Body shape:
 *   organizationName, adminFirstName, adminLastName, adminEmail, adminPassword,
 *   gstin?, modules: [{ moduleCode }], generalBillingCycle: "MONTHLY"|"YEARLY",
 *   contractAccepted: true
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { z } from "zod";
import { createSubscriptionMandate } from "@/lib/payment-provider-mandate";
import { isStubMode } from "@/lib/payment-provider";
import { nextInvoiceNumber } from "@/lib/invoice-number";

// 18% GST applied to every subscription invoice (Indian customer default).
const GST_PERCENT = 18;
function withGst(subtotal: number): { tax: number; total: number } {
  const tax = Math.round(subtotal * (GST_PERCENT / 100) * 100) / 100;
  return { tax, total: subtotal + tax };
}

const Schema = z.object({
  organizationName: z.string().min(2).max(120),
  gstin: z.string().min(15).max(15).nullable().optional(),
  adminFirstName: z.string().min(1).max(60),
  adminLastName: z.string().min(1).max(60),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(128),
  modules: z
    .array(z.object({ moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]) }))
    .min(1)
    .max(3),
  generalBillingCycle: z.enum(["MONTHLY", "YEARLY"]),
  contractAccepted: z.literal(true), // must be exactly true
});

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
}

async function generateUniqueCustomerCode(orgName: string): Promise<string> {
  const slug = slugify(orgName) || "cust";
  for (let i = 0; i < 5; i++) {
    const suffix = i === 0 ? "" : `-${i}`;
    const candidate = `CUST_${slug.toUpperCase()}${suffix}`;
    const exists = await prisma.customerAccount.findUnique({ where: { code: candidate } });
    if (!exists) return candidate;
  }
  return `CUST_${slug.toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
}

function addYears(d: Date, years: number): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + years);
  return r;
}

export async function POST(req: NextRequest) {
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

  // Email uniqueness
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: data.adminEmail }, { userName: data.adminEmail }] },
  });
  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please log in instead." },
      { status: 409 }
    );
  }

  // No duplicate moduleCodes
  const codes = new Set(data.modules.map((m) => m.moduleCode));
  if (codes.size !== data.modules.length) {
    return NextResponse.json({ error: "Duplicate moduleCode in selection" }, { status: 400 });
  }

  // Lookup BASE pricing rows for snapshot + price
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

  const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
  const customerCode = await generateUniqueCustomerCode(data.organizationName);

  // Aggregate BASE charge for all selected modules (one mandate per signup).
  const baseSubtotal = baseRows.reduce(
    (s, r) => s + Number(r.yearlyPrice),
    0
  );
  const { tax: baseTax, total: baseTotal } = withGst(baseSubtotal);

  // Pre-generate invoice number outside the transaction
  // (it has its own internal transaction for atomic counter advance).
  const invoiceNumber = await nextInvoiceNumber(now);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. CustomerAccount with module flags
        const enabledCodes = new Set(data.modules.map((m) => m.moduleCode));
        const customer = await tx.customerAccount.create({
          data: {
            code: customerCode,
            name: data.organizationName,
            isActive: true,
            isGrcAdded: enabledCodes.has("GRC"),
            isTprmAdded: enabledCodes.has("TPRM"),
            isInternalAuditEnabled: enabledCodes.has("INTERNAL_AUDIT"),
          },
        });

        // 2. Role + admin user
        const role = await tx.role.upsert({
          where: { name: "CustomerAdministrator" },
          update: {},
          create: { name: "CustomerAdministrator", description: "Customer-level admin", isSystem: true },
        });
        const user = await tx.user.create({
          data: {
            userName: data.adminEmail,
            email: data.adminEmail,
            firstName: data.adminFirstName,
            lastName: data.adminLastName,
            fullName: `${data.adminFirstName} ${data.adminLastName}`,
            password: hashedPassword,
            isActive: true,
            customerAccountId: customer.id,
            role: "CustomerAdministrator",
          },
        });
        await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });

        // 3. Subscription envelope
        const sub = await tx.subscription.create({
          data: {
            customerAccountId: customer.id,
            status: "ACTIVE",
            subscriptionType: "PAID",
            autoRenew: true,
            gstin: data.gstin || null,
            notes: `V2 self-signup on ${now.toISOString()} (BASE→GENERAL ${data.generalBillingCycle})`,
          },
        });

        // 4. Create mandate (stub or real). One mandate per customer; mandateId
        // is replicated onto each ModuleSubscription so future per-module
        // operations (cancel, suspend) can reference it directly.
        const mandate = await createSubscriptionMandate({
          customerAccountId: customer.id,
          generalBillingCycle: data.generalBillingCycle,
          unitAmount: baseTotal,
          description: `${data.organizationName} - ${data.modules.length} module(s) - 2yr autopay`,
          customerEmail: data.adminEmail,
          customerName: `${data.adminFirstName} ${data.adminLastName}`,
          idempotencyKey: `signup-v2-${customerCode}`,
        });

        // 5. ModuleSubscription rows — one per module on BASE plan
        const moduleSubIds: string[] = [];
        for (const m of data.modules) {
          const baseRow = baseRows.find((r) => r.moduleCode === m.moduleCode)!;
          const created = await tx.moduleSubscription.create({
            data: {
              subscriptionId: sub.id,
              moduleCode: m.moduleCode,
              // V1 fields (kept for back-compat): tier=BASIC as a placeholder, no longer load-bearing
              tier: "BASIC",
              billingCycle: "YEARLY", // BASE is yearly
              unitPrice: baseRow.yearlyPrice,
              userLimit: baseRow.unlimitedUsers ? 999999 : baseRow.userLimit,
              vendorLimit: baseRow.unlimitedVendors ? 999999 : baseRow.vendorLimit,
              assessmentLimit: baseRow.unlimitedAssessments ? 999999 : baseRow.assessmentLimit,
              frameworkLimit: baseRow.unlimitedFrameworks ? 999999 : baseRow.frameworkLimit,
              auditLimit: baseRow.unlimitedAudits ? 999999 : baseRow.auditLimit,
              cycleStart: now,
              cycleEnd: baseEnd,
              // V2 lifecycle fields
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

        // 6. BASE invoice (for the Year-1 promo charge: INR 100/mod + 18% GST).
        const invoice = await tx.invoice.create({
          data: {
            subscriptionId: sub.id,
            customerAccountId: customer.id,
            invoiceNumber,
            // In stub mode the first charge is treated as captured immediately;
            // in real Razorpay this would start as ISSUED and flip to PAID via webhook.
            status: isStubMode() ? "PAID" : "ISSUED",
            subtotal: baseSubtotal,
            discountAmount: 0,
            taxAmount: baseTax,
            total: baseTotal,
            periodStart: now,
            periodEnd: baseEnd,
          },
        });

        // 7. Invoice line items — one per module
        for (const m of data.modules) {
          const baseRow = baseRows.find((r) => r.moduleCode === m.moduleCode)!;
          const price = Number(baseRow.yearlyPrice);
          await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              moduleCode: m.moduleCode,
              tier: "BASIC", // legacy column
              description: `${m.moduleCode} - BASE (Year 1, Yearly)`,
              quantity: 1,
              unitPrice: price,
              amount: price,
            },
          });
        }

        // 8. Payment record — in stub mode mark CAPTURED immediately so the
        // customer is fully provisioned. In real mode this row would be created
        // when the subscription.charged webhook fires.
        if (isStubMode()) {
          await tx.payment.create({
            data: {
              subscriptionId: sub.id,
              amount: baseTotal,
              currency: "INR",
              provider: "RAZORPAY",
              providerOrderId: `STUB-ORDER-${customerCode}`,
              providerPaymentId: `STUB-PAY-${customerCode}`,
              providerSignature: "STUB-SIGNATURE",
              status: "CAPTURED",
              paidAt: now,
              invoice: { connect: { id: invoice.id } },
            },
          });
        }

        return {
          customerId: customer.id,
          customerCode: customer.code,
          userName: user.userName,
          moduleSubIds,
          invoiceNumber,
          mandate: {
            mandateId: mandate.mandateId,
            status: mandate.status,
            checkoutUrl: mandate.checkoutUrl,
          },
        };
      },
      { timeout: 20000 }
    );

    // Sync legacy SubscriptionPlan rows so the 16 V1 enforcement files keep working
    for (const id of result.moduleSubIds) {
      try {
        await syncSubscriptionPlan(id);
      } catch (e) {
        console.warn("[SIGNUP V2] sync failed (non-fatal):", e);
      }
    }

    console.log(
      `[SIGNUP V2] ${result.customerCode} (${data.adminEmail}) - BASE for ${data.modules.length} module(s), GENERAL ${data.generalBillingCycle} after ${baseEnd.toISOString().slice(0, 10)}, contract until ${contractEnd.toISOString().slice(0, 10)}`
    );

    return NextResponse.json(
      {
        data: {
          customerCode: result.customerCode,
          userName: result.userName,
          baseEndDate: baseEnd,
          contractEndDate: contractEnd,
          generalBillingCycle: data.generalBillingCycle,
          invoiceNumber: result.invoiceNumber,
          baseAmount: baseTotal,
          mandate: result.mandate,
          // In real mode the client redirects to mandate.checkoutUrl; in stub
          // mode the customer is already provisioned and can sign in immediately.
          stub: isStubMode(),
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[SIGNUP V2] failed:", e);
    return NextResponse.json({ error: (e as Error).message || "Signup failed" }, { status: 500 });
  }
}

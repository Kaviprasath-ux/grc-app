/**
 * POST /api/public/signup/v2 - V2 PUBLIC SIGNUP WITH 14-DAY TRIAL
 *
 * V2 lifecycle on customer signup:
 *   - Creates customer account with mandateStatus="pending"
 *   - 14-day free trial begins after mandate authorization
 *   - Subscription status = TRIAL
 *   - Invoice status = DRAFT (will be charged after trial)
 *   - Returns subscriptionId + razorpayKeyId for inline checkout
 *
 * After trial:
 *   - Razorpay auto-charges first invoice (BASE: ₹1,200/module + GST)
 *   - Webhook flips invoice to PAID, status to ACTIVE
 *
 * If autopay fails or is disabled:
 *   - Subscription ends immediately
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
import {
  createSubscriptionMandate,
  getTrialDays,
} from "@/lib/payment-provider-mandate";
import { isStubMode, getRazorpayKeyId } from "@/lib/payment-provider";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limiter";
import {
  logSignupInitiated,
  logSignupCompleted,
  logSignupFailed,
} from "@/lib/payment-audit";

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
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

async function generateUniqueCustomerCode(orgName: string): Promise<string> {
  const slug = slugify(orgName) || "cust";
  for (let i = 0; i < 5; i++) {
    const suffix = i === 0 ? "" : `-${i}`;
    const candidate = `CUST_${slug.toUpperCase()}${suffix}`;
    const exists = await prisma.customerAccount.findUnique({
      where: { code: candidate },
    });
    if (!exists) return candidate;
  }
  return `CUST_${slug.toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
}

function addYears(d: Date, years: number): Date {
  const r = new Date(d);
  r.setUTCFullYear(r.getUTCFullYear() + years);
  return r;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setTime(r.getTime() + days * 24 * 60 * 60 * 1000);
  return r;
}

export async function POST(req: NextRequest) {
  // Rate limiting - 5 signup attempts per 15 minutes per IP
  const clientIp = getClientIp(req.headers);
  const rateLimit = checkRateLimit(`signup:${clientIp}`, RATE_LIMITS.SIGNUP);

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many signup attempts. Please try again later.",
        retryAfter: rateLimit.retryAfterSecs,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSecs),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(rateLimit.resetAt / 1000)),
        },
      }
    );
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

  // Audit log: signup initiated
  void logSignupInitiated(
    data.adminEmail,
    data.modules.map((m) => m.moduleCode),
    clientIp
  );

  // Email uniqueness
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: data.adminEmail }, { userName: data.adminEmail }] },
  });
  if (existingUser) {
    return NextResponse.json(
      {
        error:
          "An account with this email already exists. Please log in instead.",
      },
      { status: 409 }
    );
  }

  // No duplicate moduleCodes
  const codes = new Set(data.modules.map((m) => m.moduleCode));
  if (codes.size !== data.modules.length) {
    return NextResponse.json(
      { error: "Duplicate moduleCode in selection" },
      { status: 400 }
    );
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
      {
        error: `BASE plan pricing missing for: ${missing.join(", ")} - run seed-module-plan-pricing`,
      },
      { status: 503 }
    );
  }

  const now = new Date();
  const trialDays = getTrialDays();
  const trialEndsAt = addDays(now, trialDays);
  const baseEnd = addYears(now, 1);
  const contractEnd = addYears(now, 2);

  const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
  const customerCode = await generateUniqueCustomerCode(data.organizationName);

  // Aggregate BASE charge for all selected modules (one mandate per signup).
  const baseSubtotal = baseRows.reduce((s, r) => s + Number(r.yearlyPrice), 0);
  const { tax: baseTax, total: baseTotal } = withGst(baseSubtotal);

  // Pre-generate invoice number outside the transaction
  const invoiceNumber = await nextInvoiceNumber(now);

  try {
    // Create mandates for each module (outside transaction since Razorpay is external)
    const mandateResults: Array<{
      moduleCode: string;
      mandateId: string;
      status: string;
      checkoutUrl: string | null;
      trialEndsAt: Date;
    }> = [];

    for (const m of data.modules) {
      try {
        const mandate = await createSubscriptionMandate({
          customerAccountId: customerCode, // Use code as temp ID before customer is created
          moduleCode: m.moduleCode,
          generalBillingCycle: data.generalBillingCycle,
          unitAmount: baseTotal / data.modules.length, // Split across modules
          description: `${data.organizationName} - ${m.moduleCode} - 2yr subscription`,
          customerEmail: data.adminEmail,
          customerName: `${data.adminFirstName} ${data.adminLastName}`,
          idempotencyKey: `signup-v2-${customerCode}-${m.moduleCode}`,
        });

        mandateResults.push({
          moduleCode: m.moduleCode,
          mandateId: mandate.mandateId,
          status: mandate.status,
          checkoutUrl: mandate.checkoutUrl,
          trialEndsAt: mandate.trialEndsAt,
        });
      } catch (mandateError) {
        // Check if this is a Razorpay credentials error
        const err = mandateError as { statusCode?: number; error?: string; message?: string };
        if (err.statusCode === 401 || err.error === "Unauthorized") {
          console.error("[SIGNUP V2] Razorpay authentication failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or set PAYMENT_STUB=true for development.");
          return NextResponse.json(
            { error: "Payment gateway configuration error. Please contact support or set PAYMENT_STUB=true for development." },
            { status: 503 }
          );
        }
        throw mandateError;
      }
    }

    // Use first mandate's details for checkout
    const primaryMandate = mandateResults[0];
    const primaryCheckoutUrl = primaryMandate?.checkoutUrl || null;

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
          create: {
            name: "CustomerAdministrator",
            description: "Customer-level admin",
            isSystem: true,
          },
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
        // Create UserRole for each module the customer is subscribing to.
        // This is required for ModuleContext to recognize which modules the user has access to.
        for (const m of data.modules) {
          await tx.userRole.create({
            data: { userId: user.id, roleId: role.id, moduleCode: m.moduleCode },
          });
        }

        // 3. Subscription envelope with TRIAL status
        const sub = await tx.subscription.create({
          data: {
            customerAccountId: customer.id,
            // In stub mode, treat as active; in real mode, start in TRIAL
            status: isStubMode() ? "ACTIVE" : "TRIAL",
            subscriptionType: "PAID",
            trialEndsAt: isStubMode() ? null : trialEndsAt,
            autoRenew: true,
            gstin: data.gstin || null,
            notes: `V2 self-signup on ${now.toISOString()} (${trialDays}-day trial, BASE→GENERAL ${data.generalBillingCycle})`,
          },
        });

        // 4. ModuleSubscription rows — one per module on BASE plan with trial
        const moduleSubIds: string[] = [];
        for (const m of data.modules) {
          const baseRow = baseRows.find((r) => r.moduleCode === m.moduleCode)!;
          const mandateResult = mandateResults.find(
            (mr) => mr.moduleCode === m.moduleCode
          )!;

          const created = await tx.moduleSubscription.create({
            data: {
              subscriptionId: sub.id,
              moduleCode: m.moduleCode,
              // V1 fields (kept for back-compat)
              tier: "BASIC",
              billingCycle: "YEARLY",
              unitPrice: baseRow.yearlyPrice,
              userLimit: baseRow.unlimitedUsers ? 999999 : baseRow.userLimit,
              vendorLimit: baseRow.unlimitedVendors ? 999999 : baseRow.vendorLimit,
              assessmentLimit: baseRow.unlimitedAssessments
                ? 999999
                : baseRow.assessmentLimit,
              frameworkLimit: baseRow.unlimitedFrameworks
                ? 999999
                : baseRow.frameworkLimit,
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
              // Mandate fields
              mandateId: mandateResult.mandateId,
              mandateStatus: isStubMode() ? "active" : "pending",
              checkoutUrl: mandateResult.checkoutUrl,
              trialEndsAt: isStubMode() ? null : mandateResult.trialEndsAt,
            },
          });
          moduleSubIds.push(created.id);
        }

        // 5. BASE invoice (DRAFT until trial ends and charge succeeds)
        // In stub mode, mark as PAID immediately
        const invoice = await tx.invoice.create({
          data: {
            subscriptionId: sub.id,
            customerAccountId: customer.id,
            invoiceNumber,
            status: isStubMode() ? "PAID" : "DRAFT",
            subtotal: baseSubtotal,
            discountAmount: 0,
            taxAmount: baseTax,
            total: baseTotal,
            periodStart: now,
            periodEnd: baseEnd,
          },
        });

        // 6. Invoice line items — one per module
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

        // 7. Payment record — in stub mode mark CAPTURED immediately
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
          subscriptionId: sub.id,
        };
      },
      { timeout: 20000 }
    );

    // Sync legacy SubscriptionPlan rows so the V1 enforcement files keep working
    for (const id of result.moduleSubIds) {
      try {
        await syncSubscriptionPlan(id);
      } catch (e) {
        console.warn("[SIGNUP V2] sync failed (non-fatal):", e);
      }
    }

    console.log(
      `[SIGNUP V2] ${result.customerCode} (${data.adminEmail}) - ${trialDays}-day trial, BASE for ${data.modules.length} module(s), GENERAL ${data.generalBillingCycle} after ${baseEnd.toISOString().slice(0, 10)}, contract until ${contractEnd.toISOString().slice(0, 10)}`
    );

    // Audit log: signup completed
    void logSignupCompleted(
      result.customerId,
      data.adminEmail,
      data.modules.map((m) => m.moduleCode),
      primaryMandate?.mandateId || "NONE"
    );

    return NextResponse.json(
      {
        data: {
          customerCode: result.customerCode,
          userName: result.userName,
          trialEndsAt: trialEndsAt,
          trialDays,
          baseEndDate: baseEnd,
          contractEndDate: contractEnd,
          generalBillingCycle: data.generalBillingCycle,
          invoiceNumber: result.invoiceNumber,
          baseAmount: baseTotal,
          // For inline Razorpay checkout
          razorpayKeyId: getRazorpayKeyId(),
          mandate: {
            subscriptionId: primaryMandate?.mandateId,
            mandateId: primaryMandate?.mandateId,
            status: primaryMandate?.status,
            checkoutUrl: primaryCheckoutUrl,
          },
          // In stub mode, no payment flow needed
          stub: isStubMode(),
        },
      },
      { status: 201 }
    );
  } catch (e) {
    const errorMessage = (e as Error).message || "Signup failed";
    console.error("[SIGNUP V2] failed:", e);

    // Audit log: signup failed
    void logSignupFailed(data.adminEmail, errorMessage, clientIp);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

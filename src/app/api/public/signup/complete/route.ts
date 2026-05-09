/**
 * POST /api/public/signup/complete — UNAUTHENTICATED
 *
 * Step 2 of paid signup flow:
 *   1. Verifies Razorpay payment signature
 *   2. Retrieves pending signup data
 *   3. Creates CustomerAccount, User, Subscription, ModuleSubscription
 *   4. Creates Invoice and Payment records
 *   5. Deletes pending signup
 *   6. Returns credentials for auto-login
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { verifyPaymentSignature, isStubMode } from "@/lib/payment-provider";
import { syncSubscriptionPlan } from "@/lib/subscription-plan-sync";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { z } from "zod";

const Schema = z.object({
  signupToken: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
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

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const { signupToken, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  // ── Verify payment signature (skip in stub mode) ─────────────────
  if (!isStubMode()) {
    const isValid = verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });
    if (!isValid) {
      console.error("[SIGNUP] Invalid payment signature");
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }
  }

  // ── Retrieve pending signup ─────────────────────────────────────
  const pending = await prisma.pendingSignup.findUnique({
    where: { token: signupToken },
  });

  if (!pending) {
    return NextResponse.json({ error: "Signup session not found or expired" }, { status: 404 });
  }

  if (pending.expiresAt < new Date()) {
    await prisma.pendingSignup.delete({ where: { token: signupToken } });
    return NextResponse.json({ error: "Signup session expired. Please start over." }, { status: 410 });
  }

  // Verify order ID matches
  if (pending.razorpayOrderId !== razorpay_order_id) {
    return NextResponse.json({ error: "Order ID mismatch" }, { status: 400 });
  }

  type PlanTier = "BASIC" | "MEDIUM" | "PRO";
  type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";

  // Parse stored data
  let data: {
    organizationName: string;
    adminFirstName: string;
    adminLastName: string;
    adminEmail: string;
    adminPhone: string;
    adminPassword: string;
    modules: Array<{ moduleCode: ModuleCode; tier: PlanTier }>;
    cycle: "MONTHLY" | "YEARLY";
    subtotal: number;
    discountAmount: number;
    appliedDiscount: { name: string; amount: number } | null;
    taxAmount: number;
    total: number;
  };

  try {
    data = JSON.parse(pending.data);
  } catch {
    return NextResponse.json({ error: "Invalid signup data" }, { status: 500 });
  }

  // ── Check email uniqueness again (race condition protection) ────
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: data.adminEmail }, { userName: data.adminEmail }] },
  });
  if (existingUser) {
    await prisma.pendingSignup.delete({ where: { token: signupToken } });
    return NextResponse.json({
      error: "An account with this email was created while you were paying. Please log in.",
    }, { status: 409 });
  }

  // ── Lookup catalog for limits ────────────────────────────────────
  const catalog = await prisma.moduleTierPricing.findMany({ where: { isActive: true } });
  function findCatalog(moduleCode: string, tier: string) {
    return catalog.find((c) => c.moduleCode === moduleCode && c.tier === tier);
  }

  const now = new Date();
  const cycleEnd = (() => {
    const d = new Date(now);
    if (data.cycle === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d;
  })();

  const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
  const customerCode = await generateUniqueCustomerCode(data.organizationName);

  // Generate invoice number outside main transaction (it has its own transaction)
  const invoiceNumber = await nextInvoiceNumber(now);

  // ── Transactional creation ────────────────────────────────────────
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. CustomerAccount
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

      // 2. Role
      const role = await tx.role.upsert({
        where: { name: "CustomerAdministrator" },
        update: {},
        create: { name: "CustomerAdministrator", description: "Customer-level admin", isSystem: true },
      });

      // 3. Admin user
      const user = await tx.user.create({
        data: {
          userName: data.adminEmail,
          email: data.adminEmail,
          phone: data.adminPhone,
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

      // 4. Subscription
      const sub = await tx.subscription.create({
        data: {
          customerAccountId: customer.id,
          status: "ACTIVE",
          subscriptionType: "PAID",
          autoRenew: true,
          notes: `Paid signup on ${now.toISOString()}`,
        },
      });

      // 5. ModuleSubscription rows
      const moduleSubIds: string[] = [];
      for (const m of data.modules) {
        const tierRow = findCatalog(m.moduleCode, m.tier);
        if (!tierRow) throw new Error(`Catalog missing for ${m.moduleCode} ${m.tier}`);

        const unitPrice = data.cycle === "MONTHLY" ? Number(tierRow.monthlyPrice) : Number(tierRow.yearlyPrice);
        const created = await tx.moduleSubscription.create({
          data: {
            subscriptionId: sub.id,
            moduleCode: m.moduleCode,
            tier: m.tier,
            billingCycle: data.cycle,
            unitPrice,
            userLimit: tierRow.userLimit,
            vendorLimit: tierRow.vendorLimit,
            assessmentLimit: tierRow.assessmentLimit,
            frameworkLimit: tierRow.frameworkLimit,
            auditLimit: tierRow.auditLimit,
            cycleStart: now,
            cycleEnd,
          },
        });
        moduleSubIds.push(created.id);
      }

      // 6. Invoice (PAID) - invoiceNumber already generated outside transaction
      const invoice = await tx.invoice.create({
        data: {
          subscriptionId: sub.id,
          customerAccountId: customer.id,
          invoiceNumber,
          status: "PAID",
          subtotal: data.subtotal,
          discountAmount: data.discountAmount,
          taxAmount: data.taxAmount,
          total: data.total,
          periodStart: now,
          periodEnd: cycleEnd,
        },
      });

      // 7. Invoice items
      for (const m of data.modules) {
        const tierRow = findCatalog(m.moduleCode, m.tier);
        const price = data.cycle === "MONTHLY" ? Number(tierRow?.monthlyPrice || 0) : Number(tierRow?.yearlyPrice || 0);
        await tx.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            moduleCode: m.moduleCode,
            tier: m.tier,
            description: `${m.moduleCode} - ${m.tier} (${data.cycle})`,
            quantity: 1,
            unitPrice: price,
            amount: price,
          },
        });
      }

      // 8. Payment record
      await tx.payment.create({
        data: {
          subscriptionId: sub.id,
          amount: data.total,
          currency: "INR",
          provider: "RAZORPAY",
          providerOrderId: razorpay_order_id,
          providerPaymentId: razorpay_payment_id,
          providerSignature: razorpay_signature,
          status: "CAPTURED",
          paidAt: now,
          invoice: { connect: { id: invoice.id } },
        },
      });

      // 9. Delete pending signup
      await tx.pendingSignup.delete({ where: { token: signupToken } });

      return {
        customerId: customer.id,
        customerCode: customer.code,
        userName: user.userName,
        invoiceNumber,
        moduleSubIds,
      };
    }, { timeout: 20000 });

    // Sync legacy SubscriptionPlan rows (best-effort)
    for (const id of result.moduleSubIds) {
      try { await syncSubscriptionPlan(id); } catch { /* non-fatal */ }
    }

    console.log(`[SIGNUP] Completed paid signup for ${data.adminEmail}, customer: ${result.customerCode}`);

    return NextResponse.json({
      data: {
        customerCode: result.customerCode,
        userName: result.userName,
        invoiceNumber: result.invoiceNumber,
        path: "SUBSCRIBE",
      },
    }, { status: 201 });
  } catch (e) {
    console.error("[SIGNUP] Complete failed:", e);
    return NextResponse.json({ error: (e as Error).message || "Signup failed" }, { status: 500 });
  }
}

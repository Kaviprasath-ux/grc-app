/**
 * POST /api/public/signup/initiate — UNAUTHENTICATED
 *
 * Step 1 of paid signup flow:
 *   1. Validates input (org details, admin user, modules + tiers + cycle)
 *   2. Checks email uniqueness
 *   3. Calculates total with discounts and tax
 *   4. Creates a Razorpay order
 *   5. Stores pending registration in PendingSignup table
 *   6. Returns Razorpay checkout data for frontend
 *
 * For TRIAL path, redirects to the main signup endpoint (no payment needed).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { processPayment, isStubMode } from "@/lib/payment-provider";
import { z } from "zod";
import { randomUUID } from "crypto";

const Schema = z.object({
  // Step 1: Org & admin
  organizationName: z.string().min(2).max(120),
  gstin: z.string().min(15).max(15).optional().nullable(),
  adminFirstName: z.string().min(1).max(60),
  adminLastName: z.string().min(1).max(60),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(128),

  // Step 2 + 3: modules + tiers + cycle
  modules: z.array(z.object({
    moduleCode: z.enum(["GRC", "TPRM", "INTERNAL_AUDIT"]),
    tier: z.enum(["BASIC", "MEDIUM", "PRO"]),
  })).min(1).max(3),
  cycle: z.enum(["MONTHLY", "YEARLY"]),
});

const TIER_RANK: Record<string, number> = { BASIC: 0, MEDIUM: 1, PRO: 2 };

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // ── Pre-flight checks ─────────────────────────────────────
  // 1. Email/userName uniqueness
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: data.adminEmail }, { userName: data.adminEmail }] },
  });
  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please log in instead." },
      { status: 409 }
    );
  }

  // 2. Reject duplicate moduleCode in selection
  const codes = new Set(data.modules.map((m) => m.moduleCode));
  if (codes.size !== data.modules.length) {
    return NextResponse.json({ error: "Duplicate moduleCode in selection" }, { status: 400 });
  }

  // ── Calculate pricing ────────────────────────────────────
  const catalog = await prisma.moduleTierPricing.findMany({
    where: { isActive: true },
  });

  function findCatalog(moduleCode: string, tier: string) {
    return catalog.find((c) => c.moduleCode === moduleCode && c.tier === tier);
  }

  // Calculate subtotal
  let subtotal = 0;
  const lineItems: Array<{ moduleCode: string; tier: string; price: number }> = [];

  for (const m of data.modules) {
    const tierRow = findCatalog(m.moduleCode, m.tier);
    if (!tierRow) {
      return NextResponse.json({ error: `Pricing not found for ${m.moduleCode} ${m.tier}` }, { status: 400 });
    }
    const price = data.cycle === "MONTHLY" ? Number(tierRow.monthlyPrice) : Number(tierRow.yearlyPrice);
    subtotal += price;
    lineItems.push({ moduleCode: m.moduleCode, tier: m.tier, price });
  }

  // Apply bundle discount if eligible
  const discounts = await prisma.bundleDiscount.findMany({
    where: {
      isActive: true,
      OR: [
        { validFrom: null },
        { validFrom: { lte: new Date() } },
      ],
    },
  });

  let discountAmount = 0;
  let appliedDiscount: { name: string; amount: number } | null = null;

  for (const rule of discounts) {
    // Check validity
    if (rule.validUntil && rule.validUntil < new Date()) continue;
    if (rule.appliesToCycle && rule.appliesToCycle !== data.cycle) continue;
    if (data.modules.length < rule.minModules) continue;

    // Check min tier requirement
    if (rule.minTier) {
      const minRank = TIER_RANK[rule.minTier];
      const allMeetTier = data.modules.every((m) => TIER_RANK[m.tier] >= minRank);
      if (!allMeetTier) continue;
    }

    // Calculate discount
    const amount = rule.discountType === "PERCENTAGE"
      ? Math.round(subtotal * (Number(rule.discountValue) / 100))
      : Math.min(Number(rule.discountValue), subtotal);

    if (amount > discountAmount) {
      discountAmount = amount;
      appliedDiscount = { name: rule.name, amount };
    }
  }

  const taxableAmount = subtotal - discountAmount;
  const taxAmount = Math.round(taxableAmount * 0.18); // 18% GST
  const total = taxableAmount + taxAmount;

  if (total <= 0) {
    return NextResponse.json({ error: "Invalid total amount" }, { status: 400 });
  }

  // ── Create Razorpay Order ────────────────────────────────
  const signupToken = randomUUID();
  const description = `Verifai GRC Signup - ${data.modules.map(m => m.moduleCode).join(", ")}`;

  try {
    const paymentResult = await processPayment({
      subscriptionId: `signup_${signupToken}`, // Temporary ID for signup
      amount: total,
      currency: "INR",
      customerAccountId: `pending_${signupToken}`,
      idempotencyKey: `signup_${signupToken}`,
      description,
      customerEmail: data.adminEmail,
      customerName: `${data.adminFirstName} ${data.adminLastName}`,
    });

    if (paymentResult.status === "FAILED") {
      return NextResponse.json({
        error: "Failed to create payment order",
        errorCode: paymentResult.errorCode,
        errorDescription: paymentResult.errorDescription,
      }, { status: 500 });
    }

    // ── Store pending registration ────────────────────────────
    // Use a simple JSON store in the database or cache
    // For now, we'll use the PendingSignup table
    await prisma.pendingSignup.upsert({
      where: { token: signupToken },
      update: {
        data: JSON.stringify({
          ...data,
          lineItems,
          subtotal,
          discountAmount,
          appliedDiscount,
          taxAmount,
          total,
        }),
        razorpayOrderId: paymentResult.paymentRef,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
      create: {
        token: signupToken,
        data: JSON.stringify({
          ...data,
          lineItems,
          subtotal,
          discountAmount,
          appliedDiscount,
          taxAmount,
          total,
        }),
        razorpayOrderId: paymentResult.paymentRef,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    console.log(`[SIGNUP] Initiated payment for ${data.adminEmail}, order: ${paymentResult.paymentRef}`);

    // Return checkout data
    // Note: amount is returned in paise for Razorpay Checkout
    const amountInPaise = Math.round(total * 100);
    return NextResponse.json({
      data: {
        signupToken,
        orderId: paymentResult.paymentRef,
        amount: amountInPaise,
        currency: "INR",
        keyId: paymentResult.checkoutData?.keyId || process.env.RAZORPAY_KEY_ID,
        prefill: {
          email: data.adminEmail,
          name: `${data.adminFirstName} ${data.adminLastName}`,
        },
        summary: {
          subtotal,
          discountAmount,
          appliedDiscount,
          taxAmount,
          total,
        },
        // For stub mode, also return stub payment data
        stubMode: isStubMode(),
        stubPaymentId: isStubMode() ? `stub_pay_${Date.now()}` : undefined,
      },
    });
  } catch (error) {
    console.error("[SIGNUP] Payment initiation failed:", error);
    return NextResponse.json({
      error: "Failed to initiate payment",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

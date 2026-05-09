/**
 * Signup callback handler - handles both redirect and inline checkout
 *
 * GET /api/public/signup/callback - Handle Razorpay redirect after mandate authorization
 * POST /api/public/signup/callback - Handle inline checkout verification
 *
 * After customer authorizes the mandate, this endpoint:
 *   1. Looks up the customer by razorpay_subscription_id (mandateId)
 *   2. Verifies the signature
 *   3. Updates mandateStatus to "authenticated"
 *   4. Returns success (POST) or redirects to login (GET)
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchMandateStatus } from "@/lib/payment-provider-mandate";
import { isStubMode } from "@/lib/payment-provider";
import crypto from "crypto";

interface CallbackParams {
  subscriptionId: string;
  paymentId?: string;
  signature?: string;
}

async function verifyAndUpdateMandate(params: CallbackParams): Promise<{
  success: boolean;
  error?: string;
  customerCode?: string;
  customerEmail?: string;
}> {
  const { subscriptionId, paymentId, signature } = params;

  // Verify signature (skip in stub mode)
  if (!isStubMode() && signature) {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (secret) {
      const body = paymentId
        ? `${paymentId}|${subscriptionId}`
        : subscriptionId;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      if (expectedSignature !== signature) {
        console.error("[Signup Callback] Invalid signature", {
          subscriptionId,
          paymentId,
        });
        return { success: false, error: "InvalidSignature" };
      }
    }
  }

  // Find module subscriptions by mandateId
  const moduleSubs = await prisma.moduleSubscription.findMany({
    where: { mandateId: subscriptionId },
    include: {
      subscription: {
        include: {
          customerAccount: {
            include: {
              users: {
                take: 1,
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (moduleSubs.length === 0) {
    console.error(
      "[Signup Callback] No subscriptions found for mandate:",
      subscriptionId
    );
    return { success: false, error: "SubscriptionNotFound" };
  }

  // Get current status from Razorpay
  const { status: currentStatus } = await fetchMandateStatus(subscriptionId);

  // Update all module subscriptions with the new status
  await prisma.moduleSubscription.updateMany({
    where: { mandateId: subscriptionId },
    data: {
      mandateStatus: currentStatus,
    },
  });

  // If mandate is authenticated or active, the customer can use the platform
  const customer = moduleSubs[0]?.subscription?.customerAccount;
  const customerEmail = customer?.users?.[0]?.email;

  console.log("[Signup Callback] Mandate authorized successfully:", {
    subscriptionId,
    status: currentStatus,
    customerCode: customer?.code,
  });

  return {
    success: true,
    customerCode: customer?.code,
    customerEmail,
  };
}

// GET handler - for redirect flow
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const subscriptionId = searchParams.get("razorpay_subscription_id");
  const paymentId = searchParams.get("razorpay_payment_id");
  const signature = searchParams.get("razorpay_signature");

  // Build redirect URL
  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const loginUrl = new URL("/login", baseUrl);

  // Validate required params
  if (!subscriptionId) {
    console.error("[Signup Callback] Missing razorpay_subscription_id");
    loginUrl.searchParams.set("error", "MissingSubscriptionId");
    loginUrl.searchParams.set(
      "message",
      "Payment setup incomplete. Please try again."
    );
    return NextResponse.redirect(loginUrl);
  }

  const result = await verifyAndUpdateMandate({
    subscriptionId,
    paymentId: paymentId || undefined,
    signature: signature || undefined,
  });

  if (!result.success) {
    loginUrl.searchParams.set("error", result.error || "ProcessingError");
    loginUrl.searchParams.set(
      "message",
      result.error === "InvalidSignature"
        ? "Payment verification failed. Please contact support."
        : "An error occurred. Please try logging in or contact support."
    );
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to login with success message
  loginUrl.searchParams.set("signup", "success");
  loginUrl.searchParams.set(
    "message",
    "Account created! Your subscription is now active."
  );
  if (result.customerEmail) {
    loginUrl.searchParams.set("email", result.customerEmail);
  }

  return NextResponse.redirect(loginUrl);
}

// POST handler - for inline checkout verification
export async function POST(req: NextRequest) {
  let body: {
    razorpay_subscription_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subscriptionId = body.razorpay_subscription_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "Missing razorpay_subscription_id" },
      { status: 400 }
    );
  }

  const result = await verifyAndUpdateMandate({
    subscriptionId,
    paymentId,
    signature,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        error:
          result.error === "InvalidSignature"
            ? "Payment verification failed"
            : "Subscription not found",
      },
      { status: result.error === "InvalidSignature" ? 400 : 404 }
    );
  }

  return NextResponse.json({
    data: {
      success: true,
      customerCode: result.customerCode,
    },
  });
}

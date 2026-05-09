/**
 * POST /api/public/signup/retry-mandate - Get checkout URL for mandate retry
 *
 * When a user's mandate authorization is pending (they abandoned or failed the checkout),
 * this endpoint returns the Razorpay checkout URL so they can retry.
 *
 * Body:
 *   email: string - User's email to look up their pending subscription
 *
 * Response:
 *   { data: { checkoutUrl: string, customerCode: string } }
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCheckoutUrl } from "@/lib/payment-provider-mandate";
import { z } from "zod";

const Schema = z.object({
  email: z.string().email(),
});

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

  const { email } = parsed.data;

  try {
    // Find user by email
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { userName: email }],
      },
      include: {
        customerAccount: {
          include: {
            subscription: {
              include: {
                modules: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email" },
        { status: 404 }
      );
    }

    const subscription = user.customerAccount?.subscription;
    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found for this account" },
        { status: 404 }
      );
    }

    // Find a module subscription with pending mandate
    const pendingModule = subscription.modules.find(
      (m) => m.mandateStatus === "pending" || m.mandateStatus === "created"
    );

    if (!pendingModule) {
      // Check if mandate is already active
      const activeModule = subscription.modules.find(
        (m) =>
          m.mandateStatus === "active" || m.mandateStatus === "authenticated"
      );

      if (activeModule) {
        return NextResponse.json(
          {
            error: "Your payment setup is already complete. Please log in.",
            alreadyActive: true,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "No pending payment authorization found" },
        { status: 404 }
      );
    }

    // Get checkout URL from stored value or fetch from Razorpay
    let checkoutUrl = pendingModule.checkoutUrl;

    if (!checkoutUrl && pendingModule.mandateId) {
      // Try to fetch from Razorpay
      checkoutUrl = await getCheckoutUrl(pendingModule.mandateId);

      // Update stored URL if we got one
      if (checkoutUrl) {
        await prisma.moduleSubscription.update({
          where: { id: pendingModule.id },
          data: { checkoutUrl },
        });
      }
    }

    if (!checkoutUrl) {
      return NextResponse.json(
        {
          error:
            "Could not retrieve payment link. Please contact support.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        checkoutUrl,
        customerCode: user.customerAccount?.code,
        mandateId: pendingModule.mandateId,
      },
    });
  } catch (e) {
    console.error("[Retry Mandate] Error:", e);
    return NextResponse.json(
      { error: (e as Error).message || "Failed to retrieve payment link" },
      { status: 500 }
    );
  }
}

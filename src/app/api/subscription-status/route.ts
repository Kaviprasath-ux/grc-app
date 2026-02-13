import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthOnly } from "@/lib/api-auth";

export const GET = withAuthOnly(async (req, context, session) => {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    let customerAccountId = session.customerAccountId;

    // If customerId is provided (GRC Admin checking a specific customer), look up that customer's account
    if (customerId) {
      const customerUser = await prisma.user.findUnique({
        where: { id: customerId },
        select: { customerAccountId: true },
      });
      customerAccountId = customerUser?.customerAccountId || null;
    } else if (!customerAccountId) {
      // Fallback: if customerAccountId is not on session, look up via user record
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { customerAccountId: true, customerCode: true },
      });

      customerAccountId = user?.customerAccountId || null;

      if (!customerAccountId && user?.customerCode) {
        const account = await prisma.customerAccount.findUnique({
          where: { code: user.customerCode },
          select: { id: true },
        });
        customerAccountId = account?.id || null;
      }
    }

    // If no customer account found, return not allowed
    if (!customerAccountId) {
      // For GRC Admin without customerId param, allow access (backwards compat)
      if (!customerId) {
        return NextResponse.json({ allowed: true, reason: null });
      }
      return NextResponse.json({ allowed: false, reason: "inactive" });
    }

    // Get all subscription plans for this customer
    const plans = await prisma.subscriptionPlan.findMany({
      where: { customerAccountId },
    });

    // No plans at all
    if (plans.length === 0) {
      return NextResponse.json({ allowed: false, reason: "inactive" });
    }

    const now = new Date();

    // Check for an active plan that hasn't expired
    const activePlan = plans.find(
      (p) => p.status === "Active" && new Date(p.expiryDate) >= now
    );

    if (activePlan) {
      return NextResponse.json({
        allowed: true,
        reason: null,
        maxAccountsAllowed: activePlan.maxAccountsAllowed,
        accountsUsed: activePlan.accountsUsed,
        maxFrameworksAllowed: activePlan.maxFrameworksAllowed,
        frameworksUsed: activePlan.frameworksUsed,
      });
    }

    // Check if there are any Active-status plans (they must be expired)
    const hasExpiredActivePlan = plans.some(
      (p) => p.status === "Active" && new Date(p.expiryDate) < now
    );

    if (hasExpiredActivePlan) {
      return NextResponse.json({ allowed: false, reason: "expired" });
    }

    // All plans are Inactive
    return NextResponse.json({ allowed: false, reason: "inactive" });
  } catch (error) {
    console.error("Error checking subscription status:", error);
    return NextResponse.json(
      { error: "Failed to check subscription status" },
      { status: 500 }
    );
  }
});

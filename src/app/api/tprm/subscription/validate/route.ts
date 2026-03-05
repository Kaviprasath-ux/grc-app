import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

/**
 * Mirrors the Mendix subscription validation microflow:
 * 1. Retrieve SubscriptionPlan → not found → isValid: false
 * 2. Check startDate <= now    → future    → isValid: false
 * 3. Check expiryDate >= now   → expired   → isValid: false
 * 4. All pass                              → isValid: true
 */
export const GET = withAuth(
  async (_req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);

      const plan = await prisma.subscriptionPlan.findFirst({
        where: { customerAccountId },
        orderBy: { createdAt: "desc" },
      });

      if (!plan) {
        return NextResponse.json({
          isValid: false,
          message: "Subscription plan was not found!",
        });
      }

      const now = new Date();

      if (plan.startDate > now) {
        return NextResponse.json({
          isValid: false,
          message: "Please wait for the subscription start date to proceed further.",
        });
      }

      if (plan.expiryDate < now) {
        return NextResponse.json({
          isValid: false,
          message: "Subscription has Expired.",
        });
      }

      return NextResponse.json({ isValid: true });
    } catch (error) {
      console.error("Subscription validate error:", error);
      return NextResponse.json(
        { error: "Failed to validate subscription" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.rm-inventory", "tprm.bo-inventory"], action: "view" }
);

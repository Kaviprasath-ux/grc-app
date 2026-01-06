import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/grc/customer-accounts/[id]/subscription-plans
 * Get all subscription plans for a customer
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden - GRCAdministrator role required" }, { status: 403 });
    }

    const { id } = await params;

    // Verify the customer exists
    const customer = await prisma.user.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Get all subscription plans for this customer
    const subscriptionPlans = await prisma.subscriptionPlan.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
    });

    // Transform the data for the frontend
    const plans = subscriptionPlans.map((plan) => ({
      id: plan.id,
      frameworksAvailable: plan.maxFrameworksAllowed - plan.frameworksUsed,
      accountsAvailable: plan.maxAccountsAllowed - plan.accountsUsed,
      maxFrameworksAllowed: plan.maxFrameworksAllowed,
      maxAccountsAllowed: plan.maxAccountsAllowed,
      frameworksUsed: plan.frameworksUsed,
      accountsUsed: plan.accountsUsed,
      startDate: plan.startDate.toISOString().split("T")[0],
      expiryDate: plan.expiryDate.toISOString().split("T")[0],
      status: plan.status,
    }));

    return NextResponse.json(plans);
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/grc/customer-accounts/[id]/subscription-plans
 * Create a new subscription plan for a customer
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden - GRCAdministrator role required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { startDate, expiryDate, maxFrameworks, maxAccounts, status } = body;

    // Validate required fields
    if (!startDate || !expiryDate) {
      return NextResponse.json({ error: "Start date and expiry date are required" }, { status: 400 });
    }

    // Verify the customer exists
    const customer = await prisma.user.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Check if there's already an active subscription plan for this customer
    if (status === "Active") {
      const existingActivePlan = await prisma.subscriptionPlan.findFirst({
        where: {
          customerId: id,
          status: "Active",
        },
      });

      if (existingActivePlan) {
        return NextResponse.json(
          { error: "An active subscription plan already exists for this customer. Only one active plan is allowed per account." },
          { status: 400 }
        );
      }
    }

    // Create the subscription plan
    const subscriptionPlan = await prisma.subscriptionPlan.create({
      data: {
        customerId: id,
        startDate: new Date(startDate),
        expiryDate: new Date(expiryDate),
        maxFrameworksAllowed: maxFrameworks || 0,
        maxAccountsAllowed: maxAccounts || 0,
        status: status || "Active",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription plan created successfully",
      plan: {
        id: subscriptionPlan.id,
        frameworksAvailable: subscriptionPlan.maxFrameworksAllowed,
        accountsAvailable: subscriptionPlan.maxAccountsAllowed,
        startDate: subscriptionPlan.startDate.toISOString().split("T")[0],
        expiryDate: subscriptionPlan.expiryDate.toISOString().split("T")[0],
        status: subscriptionPlan.status,
      },
    });
  } catch (error) {
    console.error("Error creating subscription plan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/grc/customer-accounts/[id]/subscription-plans
 * Update an existing subscription plan (requires planId in query params)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden - GRCAdministrator role required" }, { status: 403 });
    }

    const { id } = await params;
    const url = new URL(req.url);
    const planId = url.searchParams.get("planId");

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    const body = await req.json();
    const { startDate, expiryDate, maxFrameworks, maxAccounts, status } = body;

    // Validate required fields
    if (!startDate || !expiryDate) {
      return NextResponse.json({ error: "Start date and expiry date are required" }, { status: 400 });
    }

    // Verify the subscription plan exists and belongs to this customer
    const existingPlan = await prisma.subscriptionPlan.findFirst({
      where: {
        id: planId,
        customerId: id,
      },
    });

    if (!existingPlan) {
      return NextResponse.json({ error: "Subscription plan not found" }, { status: 404 });
    }

    // Check if trying to set status to Active when another active plan exists
    if (status === "Active" && existingPlan.status !== "Active") {
      const otherActivePlan = await prisma.subscriptionPlan.findFirst({
        where: {
          customerId: id,
          status: "Active",
          id: { not: planId },
        },
      });

      if (otherActivePlan) {
        return NextResponse.json(
          { error: "An active subscription plan already exists for this customer. Only one active plan is allowed per account." },
          { status: 400 }
        );
      }
    }

    // Update the subscription plan
    const updatedPlan = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        startDate: new Date(startDate),
        expiryDate: new Date(expiryDate),
        maxFrameworksAllowed: maxFrameworks ?? existingPlan.maxFrameworksAllowed,
        maxAccountsAllowed: maxAccounts ?? existingPlan.maxAccountsAllowed,
        status: status || existingPlan.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription plan updated successfully",
      plan: {
        id: updatedPlan.id,
        frameworksAvailable: updatedPlan.maxFrameworksAllowed - updatedPlan.frameworksUsed,
        accountsAvailable: updatedPlan.maxAccountsAllowed - updatedPlan.accountsUsed,
        maxFrameworksAllowed: updatedPlan.maxFrameworksAllowed,
        maxAccountsAllowed: updatedPlan.maxAccountsAllowed,
        frameworksUsed: updatedPlan.frameworksUsed,
        accountsUsed: updatedPlan.accountsUsed,
        startDate: updatedPlan.startDate.toISOString().split("T")[0],
        expiryDate: updatedPlan.expiryDate.toISOString().split("T")[0],
        status: updatedPlan.status,
      },
    });
  } catch (error) {
    console.error("Error updating subscription plan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/grc/customer-accounts/[id]/subscription-plans
 * Delete a subscription plan (requires planId in query params)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden - GRCAdministrator role required" }, { status: 403 });
    }

    const { id } = await params;
    const url = new URL(req.url);
    const planId = url.searchParams.get("planId");

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    // Verify the subscription plan exists and belongs to this customer
    const plan = await prisma.subscriptionPlan.findFirst({
      where: {
        id: planId,
        customerId: id,
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Subscription plan not found" }, { status: 404 });
    }

    // Delete the subscription plan
    await prisma.subscriptionPlan.delete({
      where: { id: planId },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription plan deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting subscription plan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

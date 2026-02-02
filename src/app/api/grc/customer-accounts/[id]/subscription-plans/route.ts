import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/grc/customer-accounts/[id]/subscription-plans
 * Get all subscription plans for a customer account
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

    // First get the user to find their customerAccountId
    const user = await prisma.user.findUnique({
      where: { id },
      select: { customerAccountId: true },
    });

    if (!user?.customerAccountId) {
      return NextResponse.json({ error: "Customer account not found" }, { status: 404 });
    }

    const plans = await prisma.subscriptionPlan.findMany({
      where: { customerAccountId: user.customerAccountId },
      orderBy: { createdAt: "desc" },
    });

    // Format the response to match frontend expectations
    const formattedPlans = plans.map((plan) => ({
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

    return NextResponse.json(formattedPlans);
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/grc/customer-accounts/[id]/subscription-plans
 * Create a new subscription plan for a customer account
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

    // Get the user to find their customerAccountId
    const user = await prisma.user.findUnique({
      where: { id },
      select: { customerAccountId: true },
    });

    if (!user?.customerAccountId) {
      return NextResponse.json({ error: "Customer account not found" }, { status: 404 });
    }

    // Create the subscription plan
    const plan = await prisma.subscriptionPlan.create({
      data: {
        customerAccountId: user.customerAccountId,
        startDate: new Date(startDate),
        expiryDate: new Date(expiryDate),
        maxFrameworksAllowed: maxFrameworks || 0,
        maxAccountsAllowed: maxAccounts || 0,
        frameworksUsed: 0,
        accountsUsed: 0,
        status: status || "Active",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription plan created successfully",
      plan: {
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
      },
    });
  } catch (error) {
    console.error("Error creating subscription plan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/grc/customer-accounts/[id]/subscription-plans?planId=xxx
 * Update a subscription plan
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
    const planId = req.nextUrl.searchParams.get("planId");

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    const body = await req.json();
    const { startDate, expiryDate, maxFrameworks, maxAccounts, status } = body;

    // Validate required fields
    if (!startDate || !expiryDate) {
      return NextResponse.json({ error: "Start date and expiry date are required" }, { status: 400 });
    }

    // Verify the plan exists and belongs to this customer
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
      include: {
        customerAccount: {
          include: {
            users: {
              where: { id },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!existingPlan) {
      return NextResponse.json({ error: "Subscription plan not found" }, { status: 404 });
    }

    // Update the subscription plan
    const plan = await prisma.subscriptionPlan.update({
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
      },
    });
  } catch (error) {
    console.error("Error updating subscription plan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/grc/customer-accounts/[id]/subscription-plans?planId=xxx
 * Delete a subscription plan
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

    const planId = req.nextUrl.searchParams.get("planId");

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    // Verify the plan exists
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!existingPlan) {
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

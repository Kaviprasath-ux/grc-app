import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SubscriptionPlanInput {
  startDate: string;
  expiryDate: string;
  maxFrameworks: number;
  maxAccounts: number;
  status: string;
}

/**
 * POST /api/grc/customer-accounts/onboard
 * Onboard a new customer (creates CustomerAccount, User with CustomerAdministrator role, and SubscriptionPlans)
 *
 * IMPORTANT: The role is ALWAYS CustomerAdministrator and cannot be changed.
 * This is enforced server-side regardless of what the client sends.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has GRCAdministrator role
    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden - GRCAdministrator role required" }, { status: 403 });
    }

    const body = await req.json();
    const { customerName, email, userName, password, blocked, active, language, timeZone, subscriptionPlans } = body;

    // Validate required fields
    if (!customerName || !email || !userName || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Generate next customer code
    const lastCustomerAccount = await prisma.customerAccount.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    });

    let nextCode = "GRC_001";
    if (lastCustomerAccount?.code) {
      const num = parseInt(lastCustomerAccount.code.replace("GRC_", "")) || 0;
      nextCode = `GRC_${String(num + 1).padStart(3, "0")}`;
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { userName },
    });

    if (existingUser) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }

    // Get the CustomerAdministrator role (FIXED - cannot be changed)
    const customerAdminRole = await prisma.role.findUnique({
      where: { name: "CustomerAdministrator" },
    });

    if (!customerAdminRole) {
      return NextResponse.json({ error: "CustomerAdministrator role not found. Please run RBAC seed first." }, { status: 500 });
    }

    // Use a transaction to create CustomerAccount, User, and SubscriptionPlans together
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the CustomerAccount
      const customerAccount = await tx.customerAccount.create({
        data: {
          code: nextCode,
          name: customerName,
          isActive: active !== false,
        },
      });

      // 2. Create the User linked to CustomerAccount
      const newUser = await tx.user.create({
        data: {
          userId: `USR-${Date.now()}-${userName.substring(0, 4).toUpperCase()}`,
          userName,
          email,
          password, // In production, this should be hashed
          firstName: customerName.split(" ")[0] || customerName,
          lastName: customerName.split(" ").slice(1).join(" ") || "",
          fullName: customerName,
          role: "CustomerAdministrator", // Legacy field
          customerCode: nextCode,
          customerAccountId: customerAccount.id,
          isBlocked: blocked || false,
          isActive: active !== false,
          language: language || "en-US",
          timezone: timeZone || "Asia/Qatar",
          userRoles: {
            create: {
              roleId: customerAdminRole.id,
            },
          },
        },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      // 3. Create SubscriptionPlans if provided
      const createdPlans = [];
      if (subscriptionPlans && Array.isArray(subscriptionPlans)) {
        for (const plan of subscriptionPlans as SubscriptionPlanInput[]) {
          const createdPlan = await tx.subscriptionPlan.create({
            data: {
              customerAccountId: customerAccount.id,
              startDate: new Date(plan.startDate),
              expiryDate: new Date(plan.expiryDate),
              maxFrameworksAllowed: plan.maxFrameworks || 0,
              maxAccountsAllowed: plan.maxAccounts || 0,
              frameworksUsed: 0,
              accountsUsed: 0,
              status: plan.status || "Active",
            },
          });
          createdPlans.push(createdPlan);
        }
      }

      return { customerAccount, newUser, createdPlans };
    });

    return NextResponse.json({
      success: true,
      message: "Customer onboarded successfully",
      user: {
        id: result.newUser.id,
        userName: result.newUser.userName,
        email: result.newUser.email,
        fullName: result.newUser.fullName,
        role: "CustomerAdministrator", // Always CustomerAdministrator
      },
      customerAccount: {
        id: result.customerAccount.id,
        code: result.customerAccount.code,
        name: result.customerAccount.name,
      },
      subscriptionPlans: result.createdPlans.length,
    });
  } catch (error) {
    console.error("Error onboarding customer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

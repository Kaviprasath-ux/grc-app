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

    // Generate next customer code - find an available code
    const allCustomerAccounts = await prisma.customerAccount.findMany({
      select: { code: true },
    });

    const existingCodes = new Set(allCustomerAccounts.map(a => a.code));

    let maxNum = 0;
    for (const account of allCustomerAccounts) {
      const num = parseInt(account.code.replace("GRC_", "")) || 0;
      if (num > maxNum) {
        maxNum = num;
      }
    }

    // Find the next available code (handles gaps in sequence)
    let nextNum = maxNum + 1;
    let nextCode = `GRC_${String(nextNum).padStart(3, "0")}`;

    // Safety check: if code exists, keep incrementing until we find an available one
    while (existingCodes.has(nextCode)) {
      nextNum++;
      nextCode = `GRC_${String(nextNum).padStart(3, "0")}`;
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

    // Get or create the CustomerAdministrator role (FIXED - cannot be changed)
    let customerAdminRole = await prisma.role.findUnique({
      where: { name: "CustomerAdministrator" },
    });

    // Auto-create the role if it doesn't exist (handles cases where seeding wasn't run)
    if (!customerAdminRole) {
      customerAdminRole = await prisma.role.create({
        data: {
          name: "CustomerAdministrator",
          description: "Organization-level admin, manages users and settings",
          isSystem: true,
        },
      });
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
  } catch (error: unknown) {
    console.error("Error onboarding customer:", error);

    // Handle Prisma unique constraint errors
    if ((error as { code?: string }).code === "P2002") {
      const target = (error as { meta?: { target?: string[] } }).meta?.target;
      console.error("Unique constraint violation on fields:", target);

      if (target?.includes("userName")) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      }
      if (target?.includes("email")) {
        return NextResponse.json({ error: "Email already exists" }, { status: 400 });
      }
      if (target?.includes("code")) {
        return NextResponse.json({ error: "Customer code already exists. Please try again." }, { status: 400 });
      }
      if (target?.includes("userId")) {
        return NextResponse.json({ error: "User ID collision. Please try again." }, { status: 400 });
      }
      return NextResponse.json({ error: `A record with this value already exists: ${target?.join(", ") || "unknown field"}` }, { status: 400 });
    }

    // Return the actual error message in development for debugging
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

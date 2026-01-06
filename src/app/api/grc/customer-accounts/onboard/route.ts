import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/grc/customer-accounts/onboard
 * Onboard a new customer (creates a user with CustomerAdministrator role)
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
    const { customerName, email, userName, password, blocked, active, language, timeZone } = body;

    // Validate required fields
    if (!customerName || !email || !userName || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Generate next customer code
    const lastCustomer = await prisma.user.findFirst({
      where: { customerCode: { not: null } },
      orderBy: { customerCode: "desc" },
      select: { customerCode: true },
    });

    let nextCode = "GRC_001";
    if (lastCustomer?.customerCode) {
      const num = parseInt(lastCustomer.customerCode.replace("GRC_", "")) || 0;
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

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        userName,
        email,
        password, // In production, this should be hashed
        firstName: customerName.split(" ")[0] || customerName,
        lastName: customerName.split(" ").slice(1).join(" ") || "",
        fullName: customerName,
        role: "CustomerAdministrator", // Legacy field
        customerCode: nextCode,
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

    return NextResponse.json({
      success: true,
      message: "Customer onboarded successfully",
      user: {
        id: newUser.id,
        userName: newUser.userName,
        email: newUser.email,
        fullName: newUser.fullName,
        role: "CustomerAdministrator", // Always CustomerAdministrator
      },
    });
  } catch (error) {
    console.error("Error onboarding customer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/grc/customer-accounts
 * List all customer accounts (GRCAdministrator only)
 */
export async function GET(req: NextRequest) {
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

    // Get all users with CustomerAdministrator role (these represent customer accounts)
    const customerAccounts = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              name: "CustomerAdministrator",
            },
          },
        },
      },
      select: {
        id: true,
        userName: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        createdAt: true,
        updatedAt: true,
        logoUrl: true,
        customerCode: true,
        lastLogin: true,
        isBlocked: true,
        isActive: true,
        language: true,
        timezone: true,
        departmentId: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform the data to match the expected format
    const formattedAccounts = customerAccounts.map((user, index) => ({
      id: user.id,
      customerCode: user.customerCode || `GRC_${String(index + 1).padStart(3, "0")}`,
      customerName: user.fullName || `${user.firstName} ${user.lastName}`,
      email: user.email,
      userName: user.userName,
      isLocalUser: true,
      name: user.userName,
      lastLogin: user.lastLogin?.toLocaleString() || user.updatedAt?.toLocaleDateString() || null,
      blocked: user.isBlocked || false,
      blockedSince: null,
      active: user.isActive !== false,
      logoUrl: user.logoUrl || null,
      language: user.language || "en-US",
      timeZone: user.timezone || "Asia/Qatar",
    }));

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error("Error fetching customer accounts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

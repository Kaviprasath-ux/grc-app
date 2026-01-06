import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/grc/customers
 * List all customers with compliance percentage (GRCAdministrator only)
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

    // Get all users with CustomerAdministrator role
    const customers = await prisma.user.findMany({
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
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate compliance percentage for each customer
    // In a real implementation, this would be based on actual compliance data
    const formattedCustomers = await Promise.all(
      customers.map(async (user, index) => {
        // Get compliance data for this user's organization/department
        // For now, using a placeholder calculation
        let compliancePercentage = 0;

        try {
          // Count total controls and compliant controls
          const totalControls = await prisma.control.count();
          const compliantControls = await prisma.control.count({
            where: {
              status: "Compliant",
            },
          });

          if (totalControls > 0) {
            compliancePercentage = (compliantControls / totalControls) * 100;
          }
        } catch {
          // If compliance calculation fails, use 0
          compliancePercentage = 0;
        }

        return {
          id: user.id,
          customerCode: `GRC_${String(index + 1).padStart(3, "0")}`,
          customerName: user.department?.name || user.fullName || `${user.firstName} ${user.lastName}`,
          email: user.email,
          userName: user.userName,
          compliancePercentage,
        };
      })
    );

    return NextResponse.json(formattedCustomers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

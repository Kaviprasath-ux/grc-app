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

    // Get all users with CustomerAdministrator role whose account has GRC access.
    // This is the GRC-section Customers list, so it must exclude TPRM-only /
    // Internal-Audit-only / Technical-Evidence-only accounts. The single source
    // of truth for ALL accounts (any module) is /api/grc/customer-accounts.
    const customers = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              name: "CustomerAdministrator",
            },
          },
        },
        customerAccount: {
          isGrcAdded: true,
        },
      },
      select: {
        id: true,
        userName: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        customerAccountId: true,
        customerAccount: {
          select: {
            code: true,
            name: true,
            logoUrl: true,
          },
        },
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

    // Calculate compliance percentage for each customer based on THEIR controls
    const formattedCustomers = await Promise.all(
      customers.map(async (user) => {
        let compliancePercentage = 0;

        try {
          // Count controls for THIS customer only (skip if no customerAccountId)
          if (user.customerAccountId) {
            const totalControls = await prisma.control.count({
              where: { customerAccountId: user.customerAccountId },
            });
            const compliantControls = await prisma.control.count({
              where: {
                customerAccountId: user.customerAccountId,
                status: "Compliant",
              },
            });

            if (totalControls > 0) {
              compliancePercentage = (compliantControls / totalControls) * 100;
            }
          }
        } catch {
          // If compliance calculation fails, use 0
          compliancePercentage = 0;
        }

        return {
          id: user.id,
          customerCode: user.customerAccount?.code || "N/A",
          customerName: user.customerAccount?.name || user.department?.name || user.fullName || `${user.firstName} ${user.lastName}`,
          email: user.email,
          userName: user.userName,
          customerAccountId: user.customerAccountId,
          logoUrl: user.customerAccount?.logoUrl || null,
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

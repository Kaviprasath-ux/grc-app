import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/grc/dashboard/stats
 * Returns aggregated stats for the GRC admin landing page (GRCAdministrator only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json(
        { error: "Forbidden - GRCAdministrator role required" },
        { status: 403 }
      );
    }

    // GRC admin landing page — counts and recent list must be scoped to accounts
    // with GRC access only (isGrcAdded). TPRM-only / IA-only / TE-only accounts
    // are managed from the cross-platform /api/grc/customer-accounts list.
    const [
      customerAccountsCount,
      customersCount,
      emailTemplatesCount,
      frameworksCount,
      recentCustomers,
    ] = await Promise.all([
      prisma.customerAccount.count({ where: { isGrcAdded: true } }),
      prisma.user.count({
        where: {
          userRoles: {
            some: { role: { name: "CustomerAdministrator" } },
          },
          customerAccount: { isGrcAdded: true },
        },
      }),
      prisma.emailTemplate.count(),
      prisma.framework.count(),
      prisma.user.findMany({
        where: {
          userRoles: {
            some: { role: { name: "CustomerAdministrator" } },
          },
          customerAccount: { isGrcAdded: true },
        },
        select: {
          id: true,
          fullName: true,
          firstName: true,
          lastName: true,
          email: true,
          customerAccountId: true,
          customerAccount: {
            select: { code: true, name: true },
          },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    // Calculate compliance for recent customers
    const formattedCustomers = await Promise.all(
      recentCustomers.map(async (user) => {
        let compliancePercentage = 0;
        if (user.customerAccountId) {
          const [total, compliant] = await Promise.all([
            prisma.control.count({ where: { customerAccountId: user.customerAccountId } }),
            prisma.control.count({ where: { customerAccountId: user.customerAccountId, status: "Compliant" } }),
          ]);
          if (total > 0) compliancePercentage = Math.round((compliant / total) * 100);
        }
        return {
          id: user.id,
          customerCode: user.customerAccount?.code || "N/A",
          customerName: user.customerAccount?.name || user.fullName || `${user.firstName} ${user.lastName}`,
          email: user.email,
          customerAccountId: user.customerAccountId,
          compliancePercentage,
        };
      })
    );

    return NextResponse.json({
      stats: {
        customerAccounts: customerAccountsCount,
        customers: customersCount,
        emailTemplates: emailTemplatesCount,
        frameworks: frameworksCount,
      },
      recentCustomers: formattedCustomers,
    });
  } catch (error) {
    console.error("Error fetching GRC dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

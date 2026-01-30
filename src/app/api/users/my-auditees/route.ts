import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly, getTenantFilter } from "@/lib/api-auth";

// GET auditees within the current user's tenant
// Note: User model doesn't have auditHeadId field yet - returning all auditees within tenant
export const GET = withAuthOnly(async (req: NextRequest, context: {}, session) => {
  try {
    const tenantFilter = getTenantFilter(session);

    // Return all auditees within the tenant
    const auditees = await prisma.user.findMany({
      where: {
        ...tenantFilter,
        userRoles: {
          some: {
            role: {
              name: "Auditee",
            },
          },
        },
      },
      include: {
        department: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { fullName: "asc" },
    });

    // Remove password from response
    const safeAuditees = auditees.map(({ password, ...user }) => user);

    return NextResponse.json({
      auditees: safeAuditees,
      count: safeAuditees.length,
    });
  } catch (error) {
    console.error("Error fetching auditees:", error);
    return NextResponse.json(
      { error: "Failed to fetch auditees" },
      { status: 500 }
    );
  }
});

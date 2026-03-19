import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly, getTenantFilter } from "@/lib/api-auth";

// GET auditees within the current user's tenant
// Optional query param: ?departmentId=xxx to filter by department
export const GET = withAuthOnly(async (req: NextRequest, context: {}, session) => {
  try {
    const tenantFilter = getTenantFilter(session);
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId");

    // Return auditees within the tenant, optionally filtered by department
    const whereClause: Record<string, unknown> = {
      ...tenantFilter,
      userRoles: {
        some: {
          role: {
            name: "Auditee",
          },
        },
      },
    };
    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    const auditees = await prisma.user.findMany({
      where: whereClause,
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

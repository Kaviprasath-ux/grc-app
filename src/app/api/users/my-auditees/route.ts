import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly, getTenantFilter } from "@/lib/api-auth";

// GET auditees managed by the current user's Audit Head
// Multi-tenant: respects data isolation by auditHeadId
export const GET = withAuthOnly(async (req: NextRequest, context: {}, session) => {
  try {
    const currentUserId = session.id;
    const userRoles = session.roles || [];
    const tenantFilter = getTenantFilter(session);

    // Check if user is an Audit Head, Audit Manager, Auditor, or Admin
    const isAuditHead = userRoles.includes("AuditHead");
    const isAuditManager = userRoles.includes("AuditManager");
    const isAuditor = userRoles.includes("Auditor");
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const isCustomerAdmin = userRoles.includes("CustomerAdministrator");

    let auditees: Awaited<ReturnType<typeof prisma.user.findMany>>;

    if (isGRCAdmin || isCustomerAdmin) {
      // Admins can see all auditees within their tenant
      auditees = await prisma.user.findMany({
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
    } else if (isAuditHead) {
      // Audit Head sees auditees they manage (auditHeadId = their own ID)
      auditees = await prisma.user.findMany({
        where: {
          ...tenantFilter,
          auditHeadId: currentUserId,
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
    } else if (isAuditManager || isAuditor) {
      // Audit Manager/Auditor sees auditees under their assigned Audit Head
      // Use session.auditHeadId (the ID of their managing Audit Head)
      const auditHeadId = session.auditHeadId;

      if (!auditHeadId) {
        // Not assigned to an Audit Head, cannot see auditees
        return NextResponse.json({
          auditees: [],
          count: 0,
          message: "No Audit Head assigned. Contact your administrator.",
        });
      }

      auditees = await prisma.user.findMany({
        where: {
          ...tenantFilter,
          auditHeadId: auditHeadId,
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
    } else {
      // Other users cannot see auditees
      auditees = [];
    }

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

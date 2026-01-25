import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuthOnly } from "@/lib/api-auth";

// GET auditees managed by the current user (Audit Head/Manager)
export const GET = withAuthOnly(async (req: NextRequest, context: {}, session) => {
  try {
    const currentUserId = session.id;
    const userRoles = session.roles || [];

    // Debug logging
    console.log("=== MY-AUDITEES API DEBUG ===");
    console.log("Current User ID:", currentUserId);
    console.log("User Roles:", userRoles);

    // Check if user is an Audit Head, Audit Manager, Auditor, or GRC Administrator
    const isAuditHead = userRoles.includes("AuditHead");
    const isAuditManager = userRoles.includes("AuditManager");
    const isAuditor = userRoles.includes("Auditor");
    const isGRCAdmin = userRoles.includes("GRCAdministrator");

    console.log("isAuditHead:", isAuditHead);
    console.log("isAuditManager:", isAuditManager);
    console.log("isAuditor:", isAuditor);
    console.log("isGRCAdmin:", isGRCAdmin);

    let auditees: Awaited<ReturnType<typeof prisma.user.findMany>>;

    if (isGRCAdmin) {
      // GRC Admin can see all auditees
      console.log("Fetching all auditees for GRC Admin");
      auditees = await prisma.user.findMany({
        where: {
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
    } else if (isAuditHead || isAuditManager) {
      // Audit Head/Manager can only see their managed auditees
      console.log("Fetching managed auditees for Audit Head/Manager, auditHeadId:", currentUserId);
      auditees = await prisma.user.findMany({
        where: {
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
    } else if (isAuditor) {
      // Auditor can see auditees managed by their engagement's audit head
      // For now, show all auditees that have an auditHeadId set (belong to any audit head)
      console.log("Fetching auditees for Auditor");
      auditees = await prisma.user.findMany({
        where: {
          auditHeadId: { not: null },
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
      console.log("User has no audit role, returning empty list");
      auditees = [];
    }

    console.log("Found auditees count:", auditees.length);

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

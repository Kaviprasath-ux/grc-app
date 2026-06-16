import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";

// GET all internal audit processes for the tenant
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const processes = await prisma.internalAuditProcess.findMany({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        select: {
          id: true,
          processCode: true,
          name: true,
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(processes);
    } catch (error) {
      console.error("Error fetching internal audit processes:", error);
      return NextResponse.json(
        { error: "Failed to fetch internal audit processes" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.risk-register", action: "view" }
);

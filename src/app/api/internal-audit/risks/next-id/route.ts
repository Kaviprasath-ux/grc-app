import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET next available risk ID for the tenant
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      // Find the last risk ID for this tenant
      const lastRisk = await prisma.internalAuditRisk.findFirst({
        where: tenantFilter,
        orderBy: { riskId: "desc" },
      });

      let nextNumber = 1;
      if (lastRisk && lastRisk.riskId) {
        const match = lastRisk.riskId.match(/RID(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      const nextRiskId = `RID${String(nextNumber).padStart(3, "0")}`;

      return NextResponse.json({ nextRiskId });
    } catch (error) {
      console.error("Error generating next risk ID:", error);
      return NextResponse.json(
        { error: "Failed to generate next risk ID" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.risk-register", action: "view" }
);

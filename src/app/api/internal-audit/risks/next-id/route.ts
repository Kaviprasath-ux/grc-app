import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET next available risk ID for the tenant
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      // Find the max risk ID for this tenant, handles all legacy formats
      const existingRisks = await prisma.internalAuditRisk.findMany({
        where: tenantFilter,
        select: { riskId: true },
      });

      let maxRiskNumber = 0;
      for (const r of existingRisks) {
        const match = r.riskId.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxRiskNumber) maxRiskNumber = num;
        }
      }
      const nextRiskId = `RID${String(maxRiskNumber + 1).padStart(3, "0")}`;

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

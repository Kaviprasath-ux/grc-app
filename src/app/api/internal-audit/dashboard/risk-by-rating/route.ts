import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadRiskFilter } from "@/lib/api-auth";

// GET risk counts by rating
export const GET = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      // Multi-tenant + AuditHead filtering
      const tenantFilter = getTenantFilter(session);
      const riskFilter = getAuditHeadRiskFilter(session);

      // Build combined where clause - include risks with matching auditHeadId OR null (legacy/unassigned)
      const auditHeadIdValue = 'auditHeadId' in riskFilter ? (riskFilter as { auditHeadId: string }).auditHeadId : null;
      const whereClause = auditHeadIdValue
        ? { ...tenantFilter, OR: [{ auditHeadId: auditHeadIdValue }, { auditHeadId: null }] }
        : { ...tenantFilter };

      // Get risk counts grouped by risk level (with tenant and audit head filter)
      const risks = await prisma.internalAuditRisk.groupBy({
        by: ["riskLevel"],
        where: whereClause,
        _count: {
          id: true,
        },
      });

      // Define the rating levels with their colors
      const ratingConfig = [
        { name: "Extreme", color: "#ef4444" },
        { name: "High", color: "#f97316" },
        { name: "Medium", color: "#eab308" },
        { name: "Low", color: "#22c55e" },
      ];

      // Map the results to include all levels
      const riskByRating = ratingConfig.map((config) => {
        const found = risks.find((r) => r.riskLevel === config.name);
        return {
          name: config.name,
          value: found ? found._count.id : 0,
          color: config.color,
        };
      });

      return NextResponse.json(riskByRating);
    } catch (error) {
      console.error("Error fetching risk by rating:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk by rating" },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.dashboard', action: 'view' }
);

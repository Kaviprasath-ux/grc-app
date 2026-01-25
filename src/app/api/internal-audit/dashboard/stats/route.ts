import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadFilter, getAuditHeadRiskFilter } from "@/lib/api-auth";

// GET dashboard statistics
export const GET = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      // Multi-tenant + AuditHead filtering
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);
      const riskFilter = getAuditHeadRiskFilter(session);

      // Total risks identified (filtered by tenant and audit head's engagements)
      const totalRisksIdentified = await prisma.internalAuditRisk.count({
        where: {
          ...tenantFilter,
          ...riskFilter,
        },
      });

      // Risks with extreme severity (riskLevel = "Extreme" or very high score)
      const risksWithExtremeSeverity = await prisma.internalAuditRisk.count({
        where: {
          ...tenantFilter,
          ...riskFilter,
          OR: [
            { riskLevel: "Extreme" },
            { riskLevel: "Very High" },
            { residualScore: { gte: 250 } },
          ],
        },
      });

      // Ongoing audits (status = "In Progress" or "Planned")
      const ongoingAudits = await prisma.auditEngagement.count({
        where: {
          ...tenantFilter,
          ...auditHeadFilter,
          status: { in: ["In Progress", "Planned", "InProgress"] },
        },
      });

      // Completed audits
      const completedAudits = await prisma.auditEngagement.count({
        where: {
          ...tenantFilter,
          ...auditHeadFilter,
          status: "Completed",
        },
      });

      return NextResponse.json({
        totalRisksIdentified,
        risksWithExtremeSeverity,
        ongoingAudits,
        completedAudits,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      return NextResponse.json(
        { error: "Failed to fetch dashboard stats" },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.dashboard', action: 'view' }
);

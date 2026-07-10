import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";

// GET - Assessed risks (both inherent + residual scored) that are NOT yet added
// to a strategic plan. These populate the "Risk Assessment" section; clicking
// "Add Plan" on one moves it into the Strategic Plan.
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      // Risk ids already used in any strategic plan item.
      const usedItems = await prisma.auditStrategicPlanItem.findMany({
        where: { riskId: { not: null } },
        select: { riskId: true },
      });
      const usedRiskIds = usedItems.map((i) => i.riskId).filter(Boolean) as string[];

      const risks = await prisma.internalAuditRisk.findMany({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
          // A risk only counts as assessed once the assessment wizard has been
          // completed (assessmentStatus = "Assessed"). Legacy inherent/residual
          // columns alone do NOT make a risk assessed.
          assessmentStatus: "Assessed",
          ...(usedRiskIds.length ? { id: { notIn: usedRiskIds } } : {}),
        },
        select: {
          id: true,
          riskId: true,
          riskName: true,
          inherentScore: true,
          residualScore: true,
          assessmentResidualScore: true,
          riskLevel: true,
          department: { select: { id: true, name: true } },
        },
        orderBy: [{ assessmentResidualScore: "desc" }, { residualScore: "desc" }],
      });

      return NextResponse.json(
        risks.map((r) => ({
          id: r.id,
          riskId: r.riskId,
          riskName: r.riskName,
          inherentScore: r.inherentScore,
          // Prefer the wizard's residual score; fall back to the legacy column.
          residualScore: r.assessmentResidualScore ?? r.residualScore,
          riskLevel: r.riskLevel,
          departmentId: r.department?.id ?? null,
          departmentName: r.department?.name ?? null,
        }))
      );
    } catch (error) {
      console.error("Error fetching assessed risks:", error);
      return NextResponse.json({ error: "Failed to fetch assessed risks" }, { status: 500 });
    }
  },
  { resource: "audit.strategic-plan", action: "view" }
);

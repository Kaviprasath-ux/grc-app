import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH - Save risk assessment scores and mark risk as Assessed
export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();

      const existingRisk = await prisma.internalAuditRisk.findUnique({ where: { id } });
      if (!existingRisk) {
        return NextResponse.json({ error: "Risk not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, existingRisk.customerAccountId)) {
        return forbidden("Access denied");
      }

      const strategicImpact = body.strategicImpact != null ? Math.round(Number(body.strategicImpact)) : null;
      const financialImpact = body.financialImpact != null ? Math.round(Number(body.financialImpact)) : null;
      const complianceRisk  = body.complianceRisk  != null ? Math.round(Number(body.complianceRisk))  : null;
      const operationalRisk = body.operationalRisk != null ? Math.round(Number(body.operationalRisk)) : null;
      const itDataRisk      = body.itDataRisk      != null ? Math.round(Number(body.itDataRisk))      : null;
      const assessmentLikelihood      = body.assessmentLikelihood      != null ? Math.round(Number(body.assessmentLikelihood))      : null;
      const controlEffectivenessScore = body.controlEffectivenessScore != null ? Math.round(Number(body.controlEffectivenessScore)) : null;

      // Prefer the frontend-calculated score (uses audit-settings mapped values).
      // Fall back to raw calculation if not provided.
      let assessmentResidualScore: number | null = null;
      if (body.assessmentResidualScore != null) {
        assessmentResidualScore = Math.round(Number(body.assessmentResidualScore) * 100) / 100;
      } else {
        const meanProbability = assessmentLikelihood ?? 0;
        const impactSum = [strategicImpact, financialImpact, complianceRisk, operationalRisk, itDataRisk]
          .reduce<number>((acc, v) => acc + (v ?? 0), 0);
        const meanImpact = impactSum / 5;
        if (meanProbability > 0 && meanImpact > 0 && controlEffectivenessScore) {
          assessmentResidualScore = Math.round(meanProbability * meanImpact * ((6 - controlEffectivenessScore) / 5) * 100) / 100;
        }
      }

      // Derive risk level from the assessment score using configured scoring ranges
      let riskLevel = existingRisk.riskLevel ?? "Low";
      if (assessmentResidualScore !== null) {
        const scoringRanges = await prisma.auditScoringRange.findMany({
          where: { customerAccountId: existingRisk.customerAccountId },
          orderBy: { lowValue: "desc" },
        });
        if (scoringRanges.length > 0) {
          for (const range of scoringRanges) {
            if (
              assessmentResidualScore >= range.lowValue &&
              (range.highValue === null || assessmentResidualScore <= range.highValue)
            ) {
              riskLevel = range.label;
              break;
            }
          }
        } else {
          // Fallback thresholds proportional to max possible score
          if (assessmentResidualScore >= 15) riskLevel = "Critical";
          else if (assessmentResidualScore >= 10) riskLevel = "High";
          else if (assessmentResidualScore >= 5)  riskLevel = "Medium";
          else riskLevel = "Low";
        }
      }

      const updated = await prisma.internalAuditRisk.update({
        where: { id },
        data: {
          strategicImpact,
          financialImpact,
          complianceRisk,
          operationalRisk,
          itDataRisk,
          assessmentLikelihood,
          controlEffectivenessScore,
          assessmentResidualScore,
          assessmentStatus: "Assessed",
          riskLevel,
        },
      });

      return NextResponse.json(updated);
    } catch (error) {
      console.error("Error saving risk assessment:", error);
      return NextResponse.json({ error: "Failed to save assessment" }, { status: 500 });
    }
  },
  { resource: "audit.risk-register", action: "edit" }
);

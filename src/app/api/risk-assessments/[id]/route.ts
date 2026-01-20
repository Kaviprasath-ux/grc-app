import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Helper function to calculate risk rating based on score
// Rating values matching website: Catastrophic, Very high, High, Low Risk
function calculateRiskRating(score: number): string {
  if (score >= 20) return "Catastrophic";
  if (score >= 15) return "Very high";
  if (score >= 10) return "High";
  return "Low Risk";
}

// GET a single risk assessment - filtered by customer account
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const assessment = await prisma.riskAssessment.findFirst({
        where: { id, ...tenantFilter },
        include: {
          risk: {
            select: {
              id: true,
              riskId: true,
              name: true,
              category: true,
              department: true,
              owner: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });

      if (!assessment) {
        return NextResponse.json(
          { error: "Risk assessment not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(assessment);
    } catch (error) {
      console.error("Error fetching risk assessment:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk assessment" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.assessment", action: "view" }
);

// PUT update a risk assessment - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        assessmentType,
        assessorName,
        likelihood,
        likelihoodRationale,
        impact,
        impactRationale,
        threatsIdentified,
        vulnerabilitiesIdentified,
        causesIdentified,
        recommendations,
        notes,
        status,
      } = body;

      const existing = await prisma.riskAssessment.findUnique({
        where: { id },
        select: { customerAccountId: true, likelihood: true, impact: true, status: true, riskId: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Risk assessment not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this risk assessment");
      }

      const newLikelihood = likelihood ?? existing.likelihood;
      const newImpact = impact ?? existing.impact;
      const riskScore = newLikelihood * newImpact;
      const riskRating = calculateRiskRating(riskScore);

      const assessment = await prisma.riskAssessment.update({
        where: { id },
        data: {
          assessmentType,
          assessorName,
          likelihood: newLikelihood,
          likelihoodRationale,
          impact: newImpact,
          impactRationale,
          riskScore,
          riskRating,
          threatsIdentified: threatsIdentified
            ? JSON.stringify(threatsIdentified)
            : undefined,
          vulnerabilitiesIdentified: vulnerabilitiesIdentified
            ? JSON.stringify(vulnerabilitiesIdentified)
            : undefined,
          causesIdentified: causesIdentified
            ? JSON.stringify(causesIdentified)
            : undefined,
          recommendations,
          notes,
          status,
        },
        include: {
          risk: {
            select: {
              id: true,
              riskId: true,
              name: true,
            },
          },
        },
      });

      // Update the risk with the latest assessment scores if status changed to Approved
      if (status === "Approved" && existing.status !== "Approved") {
        await prisma.risk.update({
          where: { id: existing.riskId },
          data: {
            likelihood: newLikelihood,
            impact: newImpact,
            riskScore,
            riskRating,
            lastAssessmentDate: new Date(),
          },
        });
      }

      return NextResponse.json(assessment);
    } catch (error) {
      console.error("Error updating risk assessment:", error);
      return NextResponse.json(
        { error: "Failed to update risk assessment" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.assessment", action: "edit" }
);

// DELETE a risk assessment - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const existing = await prisma.riskAssessment.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Risk assessment not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this risk assessment");
      }

      await prisma.riskAssessment.delete({ where: { id } });

      return NextResponse.json({
        message: "Risk assessment deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting risk assessment:", error);
      return NextResponse.json(
        { error: "Failed to delete risk assessment" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.assessment", action: "delete" }
);

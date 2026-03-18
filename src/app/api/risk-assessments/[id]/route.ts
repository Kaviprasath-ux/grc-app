import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden, canAccessRecord } from "@/lib/api-auth";
import { calculateRiskScore } from '@/lib/risk-scoring';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET a single risk assessment - filtered by customer account and department scope
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
              departmentId: true,
              owner: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              ownerId: true,
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

      // Check department scope access
      if (!canAccessRecord(session, "risk.assessment", "view", {
        departmentId: assessment.risk?.departmentId,
        ownerId: assessment.risk?.ownerId,
      })) {
        return forbidden("Access denied - this record belongs to a different department");
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

// PUT update a risk assessment - with tenant validation and approval workflow
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
        include: {
          risk: {
            select: { departmentId: true, ownerId: true },
          },
        },
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

      // Check department scope access for edit
      if (!canAccessRecord(session, "risk.assessment", "edit", {
        departmentId: existing.risk?.departmentId,
        ownerId: existing.risk?.ownerId,
      })) {
        return forbidden("Access denied - this record belongs to a different department");
      }

      // Per UAT: Assessment has NO approval workflow
      // Status flow is: Open → In-Progress → Completed
      // No approve/reject actions in Assessment (approval is in Risk Response Strategy)
      const validTransitions: Record<string, string[]> = {
        "Open": ["In-Progress"],
        "In-Progress": ["Completed", "Open"], // Can go back to Open (like Re-assess in UAT)
        "Completed": ["In-Progress"], // Can re-assess (Resume button in UAT)
      };

      if (status && status !== existing.status) {
        const allowedNextStates = validTransitions[existing.status] || [];
        if (!allowedNextStates.includes(status)) {
          return NextResponse.json(
            { error: `Invalid status transition from ${existing.status} to ${status}` },
            { status: 400 }
          );
        }
      }

      const newLikelihood = likelihood ?? existing.likelihood;
      const newImpact = impact ?? existing.impact;
      const scoreResult = await calculateRiskScore(existing.customerAccountId, { likelihood: newLikelihood, impact: newImpact });
      const riskScore = scoreResult?.riskScore ?? (newLikelihood * newImpact);
      const riskRating = scoreResult?.riskRating ?? "";

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

      // Update the risk with the latest assessment scores if status changed to Completed (per UAT)
      if (status === "Completed" && existing.status !== "Completed") {
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

// DELETE a risk assessment - with tenant validation and department scope
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const existing = await prisma.riskAssessment.findUnique({
        where: { id },
        include: {
          risk: {
            select: { departmentId: true, ownerId: true },
          },
        },
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

      // Check department scope access for delete
      if (!canAccessRecord(session, "risk.assessment", "delete", {
        departmentId: existing.risk?.departmentId,
        ownerId: existing.risk?.ownerId,
      })) {
        return forbidden("Access denied - this record belongs to a different department");
      }

      // Only allow deleting Open assessments (per UAT status flow)
      if (existing.status !== "Open") {
        return NextResponse.json(
          { error: "Only open assessments can be deleted" },
          { status: 400 }
        );
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

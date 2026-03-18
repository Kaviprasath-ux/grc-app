import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, canAccessRecord, forbidden } from "@/lib/api-auth";
import { calculateRiskScore } from '@/lib/risk-scoring';

// Helper function to generate assessment ID
async function generateAssessmentId(): Promise<string> {
  const count = await prisma.riskAssessment.count();
  return `RA-${String(count + 1).padStart(4, "0")}`;
}

// GET all risk assessments - filtered by customer account and department scope
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const riskId = searchParams.get("riskId");
      const status = searchParams.get("status");
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      const tenantFilter = getTenantFilter(session);
      const where: Record<string, unknown> = { ...tenantFilter };
      if (riskId) where.riskId = riskId;
      if (status) where.status = status;

      // Apply department scope filtering via the related risk
      // Department-scoped roles only see assessments for risks in their department
      const isDepartmentRole = session.roles.some(
        (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
      );
      if (isDepartmentRole && session.departmentId) {
        where.risk = { departmentId: session.departmentId };
      }

      const [assessments, total] = await Promise.all([
        prisma.riskAssessment.findMany({
          where,
          include: {
            risk: {
              select: {
                id: true,
                riskId: true,
                name: true,
                departmentId: true,
              },
            },
          },
          orderBy: { assessmentDate: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.riskAssessment.count({ where }),
      ]);

      return NextResponse.json({
        data: assessments,
        pagination: {
          total,
          limit,
          offset,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + assessments.length < total,
        },
      });
    } catch (error) {
      console.error("Error fetching risk assessments:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk assessments" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.assessment", action: "view" }
);

// POST create a new risk assessment - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        riskId,
        assessmentType = "Periodic",
        assessorName,
        likelihood = 1,
        likelihoodRationale,
        impact = 1,
        impactRationale,
        threatsIdentified,
        vulnerabilitiesIdentified,
        causesIdentified,
        recommendations,
        notes,
        // Per UAT: Assessment status flow is Open → In-Progress → Completed (no approval)
        status = "Open",
      } = body;

      if (!riskId) {
        return NextResponse.json(
          { error: "Risk ID is required" },
          { status: 400 }
        );
      }

      // Check if risk exists and get department info
      const risk = await prisma.risk.findUnique({
        where: { id: riskId },
        select: { id: true, departmentId: true, ownerId: true, customerAccountId: true },
      });
      if (!risk) {
        return NextResponse.json({ error: "Risk not found" }, { status: 404 });
      }

      // Check department scope access for creating assessment on this risk
      if (!canAccessRecord(session, "risk.assessment", "create", {
        departmentId: risk.departmentId,
        ownerId: risk.ownerId,
      })) {
        return forbidden("Access denied - this risk belongs to a different department");
      }

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);

      const assessmentId = await generateAssessmentId();
      const scoreResult = await calculateRiskScore(customerAccountId, { likelihood, impact });
      const riskScore = scoreResult?.riskScore ?? (likelihood * impact);
      const riskRating = scoreResult?.riskRating ?? "";

      const assessment = await prisma.riskAssessment.create({
        data: {
          customerAccountId,
          assessmentId,
          riskId,
          assessmentType,
          assessorName,
          likelihood,
          likelihoodRationale,
          impact,
          impactRationale,
          riskScore,
          riskRating,
          threatsIdentified: threatsIdentified
            ? JSON.stringify(threatsIdentified)
            : null,
          vulnerabilitiesIdentified: vulnerabilitiesIdentified
            ? JSON.stringify(vulnerabilitiesIdentified)
            : null,
          causesIdentified: causesIdentified
            ? JSON.stringify(causesIdentified)
            : null,
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

      // Update the risk with the latest assessment scores if status is Completed (per UAT)
      if (status === "Completed") {
        await prisma.risk.update({
          where: { id: riskId },
          data: {
            likelihood,
            impact,
            riskScore,
            riskRating,
            lastAssessmentDate: new Date(),
          },
        });
      }

      return NextResponse.json(assessment, { status: 201 });
    } catch (error) {
      console.error("Error creating risk assessment:", error);
      return NextResponse.json(
        { error: "Failed to create risk assessment" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.assessment", action: "create" }
);

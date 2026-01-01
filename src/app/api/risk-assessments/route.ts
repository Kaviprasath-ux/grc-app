import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helper function to calculate risk rating based on score
// Rating values matching website: Catastrophic, Very high, High, Low Risk
function calculateRiskRating(score: number): string {
  if (score >= 20) return "Catastrophic";
  if (score >= 15) return "Very high";
  if (score >= 10) return "High";
  return "Low Risk";
}

// Helper function to generate assessment ID
async function generateAssessmentId(): Promise<string> {
  const count = await prisma.riskAssessment.count();
  return `RA-${String(count + 1).padStart(4, "0")}`;
}

// GET all risk assessments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const riskId = searchParams.get("riskId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (riskId) where.riskId = riskId;
    if (status) where.status = status;

    const [assessments, total] = await Promise.all([
      prisma.riskAssessment.findMany({
        where,
        include: {
          risk: {
            select: {
              id: true,
              riskId: true,
              name: true,
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
}

// POST create a new risk assessment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
      status = "Draft",
    } = body;

    if (!riskId) {
      return NextResponse.json(
        { error: "Risk ID is required" },
        { status: 400 }
      );
    }

    // Check if risk exists
    const risk = await prisma.risk.findUnique({ where: { id: riskId } });
    if (!risk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    const assessmentId = await generateAssessmentId();
    const riskScore = likelihood * impact;
    const riskRating = calculateRiskRating(riskScore);

    const assessment = await prisma.riskAssessment.create({
      data: {
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

    // Update the risk with the latest assessment scores if status is Approved
    if (status === "Approved") {
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
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const assessmentIncludes = {
  risk: {
    include: {
      category: true,
      department: true,
      owner: true,
      riskThreats: {
        include: {
          threat: true,
          threatImpacts: true,
        },
      },
      riskVulnerabilities: {
        include: {
          vulnerability: true,
        },
      },
      riskAssetGroups: {
        include: {
          assetGroup: {
            include: {
              assets: true,
            },
          },
        },
      },
      riskControls: {
        include: {
          control: true,
        },
      },
    },
  },
};

// GET all risk assessments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const riskId = searchParams.get("riskId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (riskId) where.riskId = riskId;
    if (status) where.status = status;

    const assessments = await prisma.riskAssessment.findMany({
      where,
      include: assessmentIncludes,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(assessments);
  } catch (error) {
    console.error("Error fetching risk assessments:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk assessments" },
      { status: 500 }
    );
  }
}

// POST create/initiate new risk assessment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { riskId } = body;

    if (!riskId) {
      return NextResponse.json(
        { error: "Risk ID is required" },
        { status: 400 }
      );
    }

    // Check if risk exists
    const risk = await prisma.risk.findUnique({
      where: { id: riskId },
    });

    if (!risk) {
      return NextResponse.json(
        { error: "Risk not found" },
        { status: 404 }
      );
    }

    // Get the next assessment number for this risk
    const lastAssessment = await prisma.riskAssessment.findFirst({
      where: { riskId },
      orderBy: { assessmentNumber: "desc" },
    });

    const assessmentNumber = lastAssessment ? lastAssessment.assessmentNumber + 1 : 1;

    // Create new assessment
    const assessment = await prisma.riskAssessment.create({
      data: {
        riskId,
        assessmentNumber,
        currentStep: 1,
        status: "In-Progress",
        isCompleted: false,
      },
      include: assessmentIncludes,
    });

    // Update risk status
    await prisma.risk.update({
      where: { id: riskId },
      data: {
        status: "In-Progress",
        assessmentStatus: "Assessment Pending",
      },
    });

    return NextResponse.json(assessment, { status: 201 });
  } catch (error) {
    console.error("Error creating risk assessment:", error);
    return NextResponse.json(
      { error: "Failed to create risk assessment" },
      { status: 500 }
    );
  }
}

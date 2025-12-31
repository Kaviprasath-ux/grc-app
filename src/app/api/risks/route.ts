import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const riskIncludes = {
  category: true,
  department: true,
  owner: true,
  relatedProcess: true,
  riskCategories: true,
  riskThreats: {
    include: {
      threat: {
        include: {
          category: true,
        },
      },
      threatImpacts: true,
    },
  },
  riskVulnerabilities: {
    include: {
      vulnerability: {
        include: {
          category: true,
        },
      },
    },
  },
  riskAssetGroups: {
    include: {
      assetGroup: true,
    },
  },
  riskControls: {
    include: {
      control: {
        include: {
          domain: true,
          department: true,
          owner: true,
          assignee: true,
        },
      },
    },
  },
  riskAssessments: {
    orderBy: {
      createdAt: "desc" as const,
    },
    take: 1,
  },
};

// Helper function to generate next Risk ID
async function generateRiskId(): Promise<string> {
  const lastRisk = await prisma.risk.findFirst({
    orderBy: { riskId: "desc" },
  });

  if (!lastRisk) {
    return "RID0001";
  }

  const lastNumber = parseInt(lastRisk.riskId.replace("RID", ""));
  const nextNumber = lastNumber + 1;
  return `RID${nextNumber.toString().padStart(4, "0")}`;
}

// GET all risks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const riskRating = searchParams.get("riskRating");
    const categoryId = searchParams.get("categoryId");
    const riskType = searchParams.get("riskType");
    const assessmentStatus = searchParams.get("assessmentStatus");

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (riskRating) where.riskRating = riskRating;
    if (categoryId) where.categoryId = categoryId;
    if (riskType) where.riskType = riskType;
    if (assessmentStatus) where.assessmentStatus = assessmentStatus;

    const risks = await prisma.risk.findMany({
      where,
      include: riskIncludes,
      orderBy: { riskId: "desc" },
    });

    return NextResponse.json(risks);
  } catch (error) {
    console.error("Error fetching risks:", error);
    return NextResponse.json(
      { error: "Failed to fetch risks" },
      { status: 500 }
    );
  }
}

// POST create new risk
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      riskType,
      riskSources,
      cause,
      categoryId,
      departmentId,
      ownerId,
      relatedProcessId,
      // Multi-select relations
      categoryIds,
      threatIds,
      vulnerabilityIds,
      assetGroupIds,
      controlIds,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Risk name is required" },
        { status: 400 }
      );
    }

    // Generate new risk ID
    const riskId = await generateRiskId();

    // Create risk with relations
    const risk = await prisma.risk.create({
      data: {
        riskId,
        name,
        description: description || null,
        riskType: riskType || "Asset Risk",
        riskSources: riskSources || null,
        cause: cause || null,
        categoryId: categoryId || null,
        departmentId: departmentId || null,
        ownerId: ownerId || null,
        relatedProcessId: riskType === "Process Risk" ? relatedProcessId || null : null,
        status: "Open",
        assessmentStatus: "Assessment Pending",
        // Create multi-select relations
        riskCategories: categoryIds?.length
          ? {
              create: categoryIds.map((catId: string) => ({
                categoryId: catId,
              })),
            }
          : undefined,
        riskThreats: threatIds?.length
          ? {
              create: threatIds.map((threatId: string) => ({
                threatId,
              })),
            }
          : undefined,
        riskVulnerabilities: vulnerabilityIds?.length
          ? {
              create: vulnerabilityIds.map((vulnId: string) => ({
                vulnerabilityId: vulnId,
              })),
            }
          : undefined,
        riskAssetGroups: riskType === "Asset Risk" && assetGroupIds?.length
          ? {
              create: assetGroupIds.map((groupId: string) => ({
                assetGroupId: groupId,
              })),
            }
          : undefined,
        riskControls: controlIds?.length
          ? {
              create: controlIds.map((controlId: string) => ({
                controlId,
                isPlanned: false,
              })),
            }
          : undefined,
      },
      include: riskIncludes,
    });

    return NextResponse.json(risk, { status: 201 });
  } catch (error) {
    console.error("Error creating risk:", error);
    return NextResponse.json(
      { error: "Failed to create risk" },
      { status: 500 }
    );
  }
}

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

// Helper function to generate risk ID (format: RID0001, RID0002, etc. matching website)
async function generateRiskId(): Promise<string> {
  const lastRisk = await prisma.risk.findFirst({
    orderBy: { createdAt: "desc" },
    select: { riskId: true },
  });

  if (!lastRisk) {
    return "RID001";
  }

  // Extract the number from the last risk ID (e.g., "RID0040" -> 40)
  const match = lastRisk.riskId.match(/RID(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `RID${String(nextNum).padStart(3, "0")}`;
  }

  // Fallback: count-based
  const count = await prisma.risk.count();
  return `RID${String(count + 1).padStart(3, "0")}`;
}

// GET all risks with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId");
    const typeId = searchParams.get("typeId");
    const status = searchParams.get("status");
    const riskRating = searchParams.get("riskRating");
    const departmentId = searchParams.get("departmentId");
    const ownerId = searchParams.get("ownerId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { riskId: { contains: search } },
        { description: { contains: search } },
        { riskRating: { contains: search } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (typeId) where.typeId = typeId;
    if (status) where.status = status;
    if (riskRating) where.riskRating = riskRating;
    if (departmentId) where.departmentId = departmentId;
    if (ownerId) where.ownerId = ownerId;

    const [risks, total] = await Promise.all([
      prisma.risk.findMany({
        where,
        include: {
          category: true,
          type: true,
          department: true,
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          threats: {
            include: { threat: true },
          },
          vulnerabilities: {
            include: { vulnerability: true },
          },
          causes: {
            include: { cause: true },
          },
          _count: {
            select: {
              assessments: true,
              responses: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.risk.count({ where }),
    ]);

    return NextResponse.json({
      data: risks,
      pagination: {
        total,
        limit,
        offset,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + risks.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching risks:", error);
    return NextResponse.json(
      { error: "Failed to fetch risks" },
      { status: 500 }
    );
  }
}

// POST create a new risk
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      riskSources,
      categoryId,
      typeId,
      departmentId,
      ownerId,
      likelihood = 1,
      impact = 1,
      inherentLikelihood,
      inherentImpact,
      residualLikelihood,
      residualImpact,
      targetLikelihood,
      targetImpact,
      status = "Open",
      responseStrategy,
      treatmentPlan,
      treatmentDueDate,
      treatmentStatus,
      threats = [],
      vulnerabilities = [],
      causes = [],
      actor = "System",
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Risk name is required" },
        { status: 400 }
      );
    }

    const riskId = await generateRiskId();
    const riskScore = likelihood * impact;
    const riskRating = calculateRiskRating(riskScore);

    const risk = await prisma.risk.create({
      data: {
        riskId,
        name,
        description,
        riskSources,
        categoryId,
        typeId,
        departmentId,
        ownerId,
        likelihood,
        impact,
        riskScore,
        riskRating,
        inherentLikelihood,
        inherentImpact,
        inherentRiskScore: inherentLikelihood && inherentImpact ? inherentLikelihood * inherentImpact : null,
        residualLikelihood,
        residualImpact,
        residualRiskScore: residualLikelihood && residualImpact ? residualLikelihood * residualImpact : null,
        targetLikelihood,
        targetImpact,
        targetRiskScore: targetLikelihood && targetImpact ? targetLikelihood * targetImpact : null,
        status,
        responseStrategy,
        treatmentPlan,
        treatmentDueDate: treatmentDueDate ? new Date(treatmentDueDate) : null,
        treatmentStatus,
        threats: {
          create: threats.map((threatId: string) => ({
            threatId,
          })),
        },
        vulnerabilities: {
          create: vulnerabilities.map((vulnerabilityId: string) => ({
            vulnerabilityId,
          })),
        },
        causes: {
          create: causes.map((causeId: string) => ({
            causeId,
          })),
        },
        // Create activity log entry for risk creation
        activityLogs: {
          create: {
            activity: "Created",
            description: `Risk "${name}" was created`,
            actor,
          },
        },
      },
      include: {
        category: true,
        type: true,
        department: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        threats: {
          include: { threat: true },
        },
        vulnerabilities: {
          include: { vulnerability: true },
        },
        causes: {
          include: { cause: true },
        },
      },
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

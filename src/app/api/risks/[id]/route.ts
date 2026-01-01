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

// GET a single risk by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const risk = await prisma.risk.findUnique({
      where: { id },
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
        assessments: {
          orderBy: { assessmentDate: "desc" },
          take: 10,
        },
        responses: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!risk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    return NextResponse.json(risk);
  } catch (error) {
    console.error("Error fetching risk:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk" },
      { status: 500 }
    );
  }
}

// PUT update a risk
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      categoryId,
      typeId,
      departmentId,
      ownerId,
      likelihood,
      impact,
      inherentLikelihood,
      inherentImpact,
      residualLikelihood,
      residualImpact,
      targetLikelihood,
      targetImpact,
      status,
      responseStrategy,
      treatmentPlan,
      treatmentDueDate,
      treatmentStatus,
      nextReviewDate,
      threats,
      vulnerabilities,
      causes,
    } = body;

    // Check if risk exists
    const existingRisk = await prisma.risk.findUnique({ where: { id } });
    if (!existingRisk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    // Calculate scores
    const newLikelihood = likelihood ?? existingRisk.likelihood;
    const newImpact = impact ?? existingRisk.impact;
    const riskScore = newLikelihood * newImpact;
    const riskRating = calculateRiskRating(riskScore);

    // Build update data
    const updateData: Record<string, unknown> = {
      name,
      description,
      categoryId,
      typeId,
      departmentId,
      ownerId,
      likelihood: newLikelihood,
      impact: newImpact,
      riskScore,
      riskRating,
      status,
      responseStrategy,
      treatmentPlan,
      treatmentStatus,
    };

    // Handle optional date fields
    if (treatmentDueDate !== undefined) {
      updateData.treatmentDueDate = treatmentDueDate ? new Date(treatmentDueDate) : null;
    }
    if (nextReviewDate !== undefined) {
      updateData.nextReviewDate = nextReviewDate ? new Date(nextReviewDate) : null;
    }

    // Handle inherent scores
    if (inherentLikelihood !== undefined) {
      updateData.inherentLikelihood = inherentLikelihood;
    }
    if (inherentImpact !== undefined) {
      updateData.inherentImpact = inherentImpact;
    }
    if (inherentLikelihood !== undefined && inherentImpact !== undefined) {
      updateData.inherentRiskScore = inherentLikelihood * inherentImpact;
    }

    // Handle residual scores
    if (residualLikelihood !== undefined) {
      updateData.residualLikelihood = residualLikelihood;
    }
    if (residualImpact !== undefined) {
      updateData.residualImpact = residualImpact;
    }
    if (residualLikelihood !== undefined && residualImpact !== undefined) {
      updateData.residualRiskScore = residualLikelihood * residualImpact;
    }

    // Handle target scores
    if (targetLikelihood !== undefined) {
      updateData.targetLikelihood = targetLikelihood;
    }
    if (targetImpact !== undefined) {
      updateData.targetImpact = targetImpact;
    }
    if (targetLikelihood !== undefined && targetImpact !== undefined) {
      updateData.targetRiskScore = targetLikelihood * targetImpact;
    }

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update risk in a transaction
    const risk = await prisma.$transaction(async (tx) => {
      // Update threat mappings if provided
      if (threats !== undefined) {
        await tx.riskThreatMapping.deleteMany({ where: { riskId: id } });
        if (threats.length > 0) {
          await tx.riskThreatMapping.createMany({
            data: threats.map((threatId: string) => ({
              riskId: id,
              threatId,
            })),
          });
        }
      }

      // Update vulnerability mappings if provided
      if (vulnerabilities !== undefined) {
        await tx.riskVulnerabilityMapping.deleteMany({ where: { riskId: id } });
        if (vulnerabilities.length > 0) {
          await tx.riskVulnerabilityMapping.createMany({
            data: vulnerabilities.map((vulnerabilityId: string) => ({
              riskId: id,
              vulnerabilityId,
            })),
          });
        }
      }

      // Update cause mappings if provided
      if (causes !== undefined) {
        await tx.riskCauseMapping.deleteMany({ where: { riskId: id } });
        if (causes.length > 0) {
          await tx.riskCauseMapping.createMany({
            data: causes.map((causeId: string) => ({
              riskId: id,
              causeId,
            })),
          });
        }
      }

      // Update risk
      return tx.risk.update({
        where: { id },
        data: updateData,
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
    });

    return NextResponse.json(risk);
  } catch (error) {
    console.error("Error updating risk:", error);
    return NextResponse.json(
      { error: "Failed to update risk" },
      { status: 500 }
    );
  }
}

// PATCH update a risk (partial update)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if risk exists
    const existingRisk = await prisma.risk.findUnique({ where: { id } });
    if (!existingRisk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    // Build update data from provided fields only
    const updateData: Record<string, unknown> = {};

    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.responseStrategy !== undefined) {
      updateData.responseStrategy = body.responseStrategy;
    }
    if (body.treatmentPlan !== undefined) {
      updateData.treatmentPlan = body.treatmentPlan;
    }
    if (body.treatmentStatus !== undefined) {
      updateData.treatmentStatus = body.treatmentStatus;
    }
    if (body.treatmentDueDate !== undefined) {
      updateData.treatmentDueDate = body.treatmentDueDate ? new Date(body.treatmentDueDate) : null;
    }

    // Update risk
    const risk = await prisma.risk.update({
      where: { id },
      data: updateData,
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
      },
    });

    return NextResponse.json(risk);
  } catch (error) {
    console.error("Error updating risk:", error);
    return NextResponse.json(
      { error: "Failed to update risk" },
      { status: 500 }
    );
  }
}

// DELETE a risk
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingRisk = await prisma.risk.findUnique({ where: { id } });
    if (!existingRisk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    await prisma.risk.delete({ where: { id } });

    return NextResponse.json({ message: "Risk deleted successfully" });
  } catch (error) {
    console.error("Error deleting risk:", error);
    return NextResponse.json(
      { error: "Failed to delete risk" },
      { status: 500 }
    );
  }
}

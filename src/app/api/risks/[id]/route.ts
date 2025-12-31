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
      assetGroup: {
        include: {
          assets: true,
        },
      },
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
  },
};

// GET single risk
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const risk = await prisma.risk.findUnique({
      where: { id },
      include: riskIncludes,
    });

    if (!risk) {
      return NextResponse.json(
        { error: "Risk not found" },
        { status: 404 }
      );
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

// PUT update risk
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
      riskType,
      riskSources,
      cause,
      categoryId,
      departmentId,
      ownerId,
      relatedProcessId,
      status,
      assessmentStatus,
      responseStrategy,
      likelihoodScore,
      impactScore,
      vulnerabilityScore,
      inherentRiskRating,
      controlRating,
      residualRiskRating,
      riskRating,
      assessmentDate,
      nextReviewDate,
      dueDate,
      budgetAllocated,
      budgetUsed,
      // Multi-select relations
      categoryIds,
      threatIds,
      vulnerabilityIds,
      assetGroupIds,
      controlIds,
      plannedControlIds,
    } = body;

    const existing = await prisma.risk.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk not found" },
        { status: 404 }
      );
    }

    // Use transaction to update risk and relations
    const risk = await prisma.$transaction(async (tx) => {
      // Delete existing relations if new ones are provided
      if (categoryIds !== undefined) {
        await tx.riskCategoryMapping.deleteMany({ where: { riskId: id } });
      }
      if (threatIds !== undefined) {
        await tx.riskThreat.deleteMany({ where: { riskId: id } });
      }
      if (vulnerabilityIds !== undefined) {
        await tx.riskVulnerability.deleteMany({ where: { riskId: id } });
      }
      if (assetGroupIds !== undefined) {
        await tx.riskAssetGroup.deleteMany({ where: { riskId: id } });
      }
      if (controlIds !== undefined || plannedControlIds !== undefined) {
        await tx.riskControl.deleteMany({ where: { riskId: id } });
      }

      // Update risk
      const updatedRisk = await tx.risk.update({
        where: { id },
        data: {
          name: name || existing.name,
          description: description !== undefined ? description : existing.description,
          riskType: riskType || existing.riskType,
          riskSources: riskSources !== undefined ? riskSources : existing.riskSources,
          cause: cause !== undefined ? cause : existing.cause,
          categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
          departmentId: departmentId !== undefined ? (departmentId || null) : existing.departmentId,
          ownerId: ownerId !== undefined ? (ownerId || null) : existing.ownerId,
          relatedProcessId: relatedProcessId !== undefined ? (relatedProcessId || null) : existing.relatedProcessId,
          status: status || existing.status,
          assessmentStatus: assessmentStatus || existing.assessmentStatus,
          responseStrategy: responseStrategy !== undefined ? responseStrategy : existing.responseStrategy,
          likelihoodScore: likelihoodScore !== undefined ? parseFloat(likelihoodScore) : existing.likelihoodScore,
          impactScore: impactScore !== undefined ? parseFloat(impactScore) : existing.impactScore,
          vulnerabilityScore: vulnerabilityScore !== undefined ? parseFloat(vulnerabilityScore) : existing.vulnerabilityScore,
          inherentRiskRating: inherentRiskRating !== undefined ? parseFloat(inherentRiskRating) : existing.inherentRiskRating,
          controlRating: controlRating !== undefined ? parseFloat(controlRating) : existing.controlRating,
          residualRiskRating: residualRiskRating !== undefined ? parseFloat(residualRiskRating) : existing.residualRiskRating,
          riskRating: riskRating || existing.riskRating,
          assessmentDate: assessmentDate !== undefined ? (assessmentDate ? new Date(assessmentDate) : null) : existing.assessmentDate,
          nextReviewDate: nextReviewDate !== undefined ? (nextReviewDate ? new Date(nextReviewDate) : null) : existing.nextReviewDate,
          dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existing.dueDate,
          budgetAllocated: budgetAllocated !== undefined ? parseFloat(budgetAllocated) : existing.budgetAllocated,
          budgetUsed: budgetUsed !== undefined ? parseFloat(budgetUsed) : existing.budgetUsed,
        },
      });

      // Create new relations
      if (categoryIds?.length) {
        await tx.riskCategoryMapping.createMany({
          data: categoryIds.map((catId: string) => ({
            riskId: id,
            categoryId: catId,
          })),
        });
      }

      if (threatIds?.length) {
        await tx.riskThreat.createMany({
          data: threatIds.map((threatId: string) => ({
            riskId: id,
            threatId,
          })),
        });
      }

      if (vulnerabilityIds?.length) {
        await tx.riskVulnerability.createMany({
          data: vulnerabilityIds.map((vulnId: string) => ({
            riskId: id,
            vulnerabilityId: vulnId,
          })),
        });
      }

      if (assetGroupIds?.length) {
        await tx.riskAssetGroup.createMany({
          data: assetGroupIds.map((groupId: string) => ({
            riskId: id,
            assetGroupId: groupId,
          })),
        });
      }

      if (controlIds?.length) {
        await tx.riskControl.createMany({
          data: controlIds.map((controlId: string) => ({
            riskId: id,
            controlId,
            isPlanned: false,
          })),
        });
      }

      if (plannedControlIds?.length) {
        await tx.riskControl.createMany({
          data: plannedControlIds.map((controlId: string) => ({
            riskId: id,
            controlId,
            isPlanned: true,
          })),
        });
      }

      return updatedRisk;
    });

    // Fetch full risk with relations
    const fullRisk = await prisma.risk.findUnique({
      where: { id },
      include: riskIncludes,
    });

    return NextResponse.json(fullRisk);
  } catch (error) {
    console.error("Error updating risk:", error);
    return NextResponse.json(
      { error: "Failed to update risk" },
      { status: 500 }
    );
  }
}

// DELETE risk
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.risk.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk not found" },
        { status: 404 }
      );
    }

    await prisma.risk.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Risk deleted successfully" });
  } catch (error) {
    console.error("Error deleting risk:", error);
    return NextResponse.json(
      { error: "Failed to delete risk" },
      { status: 500 }
    );
  }
}

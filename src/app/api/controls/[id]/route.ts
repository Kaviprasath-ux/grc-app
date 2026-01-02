import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single control with all related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const control = await prisma.control.findUnique({
      where: { id },
      include: {
        domain: true,
        framework: true,
        department: true,
        owner: true,
        assignee: true,
        evidences: {
          include: {
            assignee: true,
            attachments: true,
          },
        },
        exceptions: true,
        requirements: {
          include: {
            requirement: {
              include: {
                framework: true,
              },
            },
          },
        },
        controlRisks: {
          include: {
            risk: {
              include: {
                category: true,
                owner: true,
              },
            },
          },
        },
        policyControls: {
          include: {
            policy: true,
          },
        },
      },
    });

    if (!control) {
      return NextResponse.json(
        { error: "Control not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(control);
  } catch (error) {
    console.error("Error fetching control:", error);
    return NextResponse.json(
      { error: "Failed to fetch control" },
      { status: 500 }
    );
  }
}

// PUT update control
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      controlCode,
      description,
      controlQuestion,
      functionalGrouping,
      status,
      entities,
      isControlList,
      relativeControlWeighting,
      scope,
      // CMM Maturity Level Descriptions
      notPerformed,
      performedInformally,
      plannedAndTracked,
      wellDefined,
      quantitativelyControlled,
      continuouslyImproving,
      // Relations
      domainId,
      frameworkId,
      departmentId,
      ownerId,
      assigneeId,
      // Multi-select relations
      riskIds,
      requirementIds,
    } = body;

    // Build update data object, only including defined values
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (controlCode !== undefined) updateData.controlCode = controlCode;
    if (description !== undefined) updateData.description = description;
    if (controlQuestion !== undefined) updateData.controlQuestion = controlQuestion;
    if (functionalGrouping !== undefined) updateData.functionalGrouping = functionalGrouping;
    if (status !== undefined) updateData.status = status;
    if (entities !== undefined) updateData.entities = entities;
    if (isControlList !== undefined) updateData.isControlList = isControlList;
    if (relativeControlWeighting !== undefined) updateData.relativeControlWeighting = relativeControlWeighting;
    if (scope !== undefined) updateData.scope = scope;
    if (notPerformed !== undefined) updateData.notPerformed = notPerformed;
    if (performedInformally !== undefined) updateData.performedInformally = performedInformally;
    if (plannedAndTracked !== undefined) updateData.plannedAndTracked = plannedAndTracked;
    if (wellDefined !== undefined) updateData.wellDefined = wellDefined;
    if (quantitativelyControlled !== undefined) updateData.quantitativelyControlled = quantitativelyControlled;
    if (continuouslyImproving !== undefined) updateData.continuouslyImproving = continuouslyImproving;
    if (domainId !== undefined) updateData.domainId = domainId;
    if (frameworkId !== undefined) updateData.frameworkId = frameworkId;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (ownerId !== undefined) updateData.ownerId = ownerId;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;

    // Update the control
    const control = await prisma.control.update({
      where: { id },
      data: updateData,
      include: {
        domain: true,
        framework: true,
        department: true,
        owner: true,
        assignee: true,
      },
    });

    // Handle risk associations if provided
    if (riskIds !== undefined) {
      // Delete existing risk associations
      await prisma.controlRisk.deleteMany({
        where: { controlId: id },
      });
      // Create new risk associations
      if (riskIds.length > 0) {
        await prisma.controlRisk.createMany({
          data: riskIds.map((riskId: string) => ({
            controlId: id,
            riskId,
          })),
        });
      }
    }

    // Handle requirement associations if provided
    if (requirementIds !== undefined) {
      // Delete existing requirement associations
      await prisma.requirementControl.deleteMany({
        where: { controlId: id },
      });
      // Create new requirement associations
      if (requirementIds.length > 0) {
        await prisma.requirementControl.createMany({
          data: requirementIds.map((requirementId: string) => ({
            controlId: id,
            requirementId,
          })),
        });
      }
    }

    return NextResponse.json(control);
  } catch (error: unknown) {
    console.error("Error updating control:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Control not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update control" },
      { status: 500 }
    );
  }
}

// DELETE control
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.control.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Control deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting control:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Control not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete control" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single evidence with all related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const evidence = await prisma.evidence.findUnique({
      where: { id },
      include: {
        framework: true,
        control: {
          include: {
            domain: true,
          },
        },
        department: true,
        assignee: true,
        attachments: true,
        kpis: true,
        evidenceControls: {
          include: {
            control: {
              include: {
                domain: true,
                framework: true,
              },
            },
          },
        },
        linkedArtifacts: {
          include: {
            artifact: true,
          },
        },
      },
    });

    if (!evidence) {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(evidence);
  } catch (error) {
    console.error("Error fetching evidence:", error);
    return NextResponse.json(
      { error: "Failed to fetch evidence" },
      { status: 500 }
    );
  }
}

// PUT update evidence
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
      domain,
      frameworkId,
      controlId,
      departmentId,
      assigneeId,
      dueDate,
      status,
      recurrence,
      reviewDate,
      publishedAt,
      kpiRequired,
      kpiObjective,
      kpiDataSource,
      kpiExpectedScore,
      kpiDescription,
      kpiCalculationFormula,
    } = body;

    // Build update data, only including defined fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (domain !== undefined) updateData.domain = domain;
    if (frameworkId !== undefined) updateData.frameworkId = frameworkId;
    if (controlId !== undefined) updateData.controlId = controlId;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (status !== undefined) updateData.status = status;
    if (recurrence !== undefined) updateData.recurrence = recurrence;
    if (reviewDate !== undefined) updateData.reviewDate = reviewDate ? new Date(reviewDate) : null;
    if (publishedAt !== undefined) updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
    if (kpiRequired !== undefined) updateData.kpiRequired = kpiRequired;
    if (kpiObjective !== undefined) updateData.kpiObjective = kpiObjective;
    if (kpiDataSource !== undefined) updateData.kpiDataSource = kpiDataSource;
    if (kpiExpectedScore !== undefined) updateData.kpiExpectedScore = kpiExpectedScore;
    if (kpiDescription !== undefined) updateData.kpiDescription = kpiDescription;
    if (kpiCalculationFormula !== undefined) updateData.kpiCalculationFormula = kpiCalculationFormula;

    const evidence = await prisma.evidence.update({
      where: { id },
      data: updateData,
      include: {
        framework: true,
        control: {
          include: {
            domain: true,
          },
        },
        department: true,
        assignee: true,
        attachments: true,
        kpis: true,
        evidenceControls: {
          include: {
            control: {
              include: {
                domain: true,
                framework: true,
              },
            },
          },
        },
        linkedArtifacts: {
          include: {
            artifact: true,
          },
        },
      },
    });

    return NextResponse.json(evidence);
  } catch (error: unknown) {
    console.error("Error updating evidence:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update evidence" },
      { status: 500 }
    );
  }
}

// DELETE evidence
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.evidence.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Evidence deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting evidence:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Evidence not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete evidence" },
      { status: 500 }
    );
  }
}

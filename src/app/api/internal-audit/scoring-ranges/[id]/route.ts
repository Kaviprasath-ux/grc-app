import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET a single scoring range
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const range = await prisma.auditScoringRange.findUnique({
      where: { id },
    });

    if (!range) {
      return NextResponse.json(
        { error: "Scoring range not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(range);
  } catch (error) {
    console.error("Error fetching scoring range:", error);
    return NextResponse.json(
      { error: "Failed to fetch scoring range" },
      { status: 500 }
    );
  }
}

// PUT update a scoring range
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { label, lowValue, highValue, calculationType } = body;

    const existing = await prisma.auditScoringRange.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Scoring range not found" },
        { status: 404 }
      );
    }

    // Check for duplicate label if label or calculationType is being changed
    const newLabel = label ?? existing.label;
    const newCalcType = calculationType ?? existing.calculationType;

    if (newLabel !== existing.label || newCalcType !== existing.calculationType) {
      const duplicate = await prisma.auditScoringRange.findFirst({
        where: {
          label: newLabel,
          calculationType: newCalcType,
          NOT: { id }
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Scoring range with this label already exists for this calculation type" },
          { status: 400 }
        );
      }
    }

    const range = await prisma.auditScoringRange.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(lowValue !== undefined && { lowValue }),
        ...(highValue !== undefined && { highValue }),
        ...(calculationType !== undefined && { calculationType }),
      },
    });

    return NextResponse.json(range);
  } catch (error) {
    console.error("Error updating scoring range:", error);
    return NextResponse.json(
      { error: "Failed to update scoring range" },
      { status: 500 }
    );
  }
}

// DELETE a scoring range
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.auditScoringRange.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Scoring range not found" },
        { status: 404 }
      );
    }

    await prisma.auditScoringRange.delete({ where: { id } });

    return NextResponse.json({ message: "Scoring range deleted successfully" });
  } catch (error) {
    console.error("Error deleting scoring range:", error);
    return NextResponse.json(
      { error: "Failed to delete scoring range" },
      { status: 500 }
    );
  }
}

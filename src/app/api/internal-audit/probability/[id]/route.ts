import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET a single probability
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const probability = await prisma.auditProbability.findUnique({
      where: { id },
    });

    if (!probability) {
      return NextResponse.json(
        { error: "Probability not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(probability);
  } catch (error) {
    console.error("Error fetching probability:", error);
    return NextResponse.json(
      { error: "Failed to fetch probability" },
      { status: 500 }
    );
  }
}

// PUT update a probability
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { label, value } = body;

    const existing = await prisma.auditProbability.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Probability not found" },
        { status: 404 }
      );
    }

    // Check for duplicate label if label is being changed
    if (label && label !== existing.label) {
      const duplicate = await prisma.auditProbability.findUnique({
        where: { label },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Probability with this label already exists" },
          { status: 400 }
        );
      }
    }

    const probability = await prisma.auditProbability.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(value !== undefined && { value }),
      },
    });

    return NextResponse.json(probability);
  } catch (error) {
    console.error("Error updating probability:", error);
    return NextResponse.json(
      { error: "Failed to update probability" },
      { status: 500 }
    );
  }
}

// DELETE a probability
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.auditProbability.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Probability not found" },
        { status: 404 }
      );
    }

    await prisma.auditProbability.delete({ where: { id } });

    return NextResponse.json({ message: "Probability deleted successfully" });
  } catch (error) {
    console.error("Error deleting probability:", error);
    return NextResponse.json(
      { error: "Failed to delete probability" },
      { status: 500 }
    );
  }
}

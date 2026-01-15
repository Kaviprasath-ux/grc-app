import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single BIA scoring range
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const range = await prisma.bIAScoringRange.findUnique({
      where: { id },
    });

    if (!range) {
      return NextResponse.json(
        { error: "BIA scoring range not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(range);
  } catch (error) {
    console.error("Error fetching BIA scoring range:", error);
    return NextResponse.json(
      { error: "Failed to fetch BIA scoring range" },
      { status: 500 }
    );
  }
}

// PUT update BIA scoring range
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { label, lowValue, highValue, color, calculationType, sortOrder } = body;

    const range = await prisma.bIAScoringRange.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(lowValue !== undefined && { lowValue }),
        ...(highValue !== undefined && { highValue }),
        ...(color !== undefined && { color }),
        ...(calculationType !== undefined && { calculationType }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return NextResponse.json(range);
  } catch (error: unknown) {
    console.error("Error updating BIA scoring range:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "BIA scoring range not found" },
        { status: 404 }
      );
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "A range with this label and calculation type already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update BIA scoring range" },
      { status: 500 }
    );
  }
}

// DELETE BIA scoring range
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.bIAScoringRange.delete({
      where: { id },
    });

    return NextResponse.json({ message: "BIA scoring range deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting BIA scoring range:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "BIA scoring range not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete BIA scoring range" },
      { status: 500 }
    );
  }
}

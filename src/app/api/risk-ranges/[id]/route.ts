import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single risk range
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const range = await prisma.riskRange.findUnique({
      where: { id },
    });

    if (!range) {
      return NextResponse.json(
        { error: "Risk range not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(range);
  } catch (error) {
    console.error("Error fetching risk range:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk range" },
      { status: 500 }
    );
  }
}

// PUT update risk range
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, color, lowRange, highRange, description } = body;

    const existing = await prisma.riskRange.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk range not found" },
        { status: 404 }
      );
    }

    if (title && title !== existing.title) {
      const conflict = await prisma.riskRange.findUnique({
        where: { title },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Risk range title already exists" },
          { status: 400 }
        );
      }
    }

    const range = await prisma.riskRange.update({
      where: { id },
      data: {
        title: title || existing.title,
        color: color || existing.color,
        lowRange: lowRange !== undefined ? parseInt(lowRange) : existing.lowRange,
        highRange: highRange !== undefined ? parseInt(highRange) : existing.highRange,
        description: description !== undefined ? description : existing.description,
      },
    });

    return NextResponse.json(range);
  } catch (error) {
    console.error("Error updating risk range:", error);
    return NextResponse.json(
      { error: "Failed to update risk range" },
      { status: 500 }
    );
  }
}

// DELETE risk range
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.riskRange.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk range not found" },
        { status: 404 }
      );
    }

    await prisma.riskRange.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Risk range deleted successfully" });
  } catch (error) {
    console.error("Error deleting risk range:", error);
    return NextResponse.json(
      { error: "Failed to delete risk range" },
      { status: 500 }
    );
  }
}

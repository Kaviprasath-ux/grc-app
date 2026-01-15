import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT update risk range
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, color, lowRange, highRange, timelineDays, description } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const range = await prisma.riskRange.update({
      where: { id },
      data: {
        title: title.trim(),
        color: color?.trim() || null,
        lowRange: parseInt(lowRange) || 0,
        highRange: parseInt(highRange) || 0,
        timelineDays: parseInt(timelineDays) || 0,
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(range);
  } catch (error: unknown) {
    console.error("Error updating risk range:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Risk range not found" }, { status: 404 });
    }
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
    await prisma.riskRange.delete({ where: { id } });
    return NextResponse.json({ message: "Risk range deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting risk range:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Risk range not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to delete risk range" },
      { status: 500 }
    );
  }
}

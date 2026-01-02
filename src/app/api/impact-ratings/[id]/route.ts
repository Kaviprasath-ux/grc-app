import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT update impact rating
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, score, description } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const rating = await prisma.impactRating.update({
      where: { id },
      data: {
        name: name.trim(),
        score: score || 0,
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(rating);
  } catch (error: unknown) {
    console.error("Error updating impact rating:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Impact rating with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update impact rating" },
      { status: 500 }
    );
  }
}

// DELETE impact rating
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.impactRating.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting impact rating:", error);
    return NextResponse.json(
      { error: "Failed to delete impact rating" },
      { status: 500 }
    );
  }
}

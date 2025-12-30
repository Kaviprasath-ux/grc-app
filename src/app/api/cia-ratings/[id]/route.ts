import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT update CIA rating
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { type, label, value } = body;

    if (!type?.trim() || !label?.trim()) {
      return NextResponse.json(
        { error: "Type and label are required" },
        { status: 400 }
      );
    }

    const rating = await prisma.cIARating.update({
      where: { id },
      data: {
        type: type.trim(),
        label: label.trim().toLowerCase(),
        value,
      },
    });

    return NextResponse.json(rating);
  } catch (error: unknown) {
    console.error("Error updating CIA rating:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Rating with this type and label already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update CIA rating" },
      { status: 500 }
    );
  }
}

// DELETE CIA rating
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.cIARating.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting CIA rating:", error);
    return NextResponse.json(
      { error: "Failed to delete CIA rating" },
      { status: 500 }
    );
  }
}

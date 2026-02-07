import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single BIA rating
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rating = await prisma.bIARating.findUnique({
      where: { id },
    });

    if (!rating) {
      return NextResponse.json(
        { error: "BIA rating not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(rating);
  } catch (error) {
    console.error("Error fetching BIA rating:", error);
    return NextResponse.json(
      { error: "Failed to fetch BIA rating" },
      { status: 500 }
    );
  }
}

// PUT update BIA rating
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { label, score, description, color, sortOrder, isActive } = body;

    if (!label?.trim()) {
      return NextResponse.json(
        { error: "Rating label is required" },
        { status: 400 }
      );
    }

    const rating = await prisma.bIARating.update({
      where: { id },
      data: {
        label: label.trim(),
        score: score ?? 0,
        description: description?.trim() || null,
        color: color?.trim() || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(rating);
  } catch (error: unknown) {
    console.error("Error updating BIA rating:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "BIA rating not found" },
        { status: 404 }
      );
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Rating with this label already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update BIA rating" },
      { status: 500 }
    );
  }
}

// DELETE BIA rating
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.bIARating.delete({
      where: { id },
    });

    return NextResponse.json({ message: "BIA rating deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting BIA rating:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "BIA rating not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete BIA rating" },
      { status: 500 }
    );
  }
}

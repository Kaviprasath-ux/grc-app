import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single BIA category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await prisma.bIACategory.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json(
        { error: "BIA category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching BIA category:", error);
    return NextResponse.json(
      { error: "Failed to fetch BIA category" },
      { status: 500 }
    );
  }
}

// PUT update BIA category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, sortOrder, isActive } = body;

    const category = await prisma.bIACategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(category);
  } catch (error: unknown) {
    console.error("Error updating BIA category:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "BIA category not found" },
        { status: 404 }
      );
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update BIA category" },
      { status: 500 }
    );
  }
}

// DELETE BIA category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.bIACategory.delete({
      where: { id },
    });

    return NextResponse.json({ message: "BIA category deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting BIA category:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "BIA category not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete BIA category" },
      { status: 500 }
    );
  }
}

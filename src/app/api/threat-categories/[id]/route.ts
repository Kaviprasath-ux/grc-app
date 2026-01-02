import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT update threat category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const category = await prisma.threatCategory.update({
      where: { id },
      data: {
        name: name.trim(),
      },
      include: {
        _count: {
          select: { threats: true },
        },
      },
    });

    return NextResponse.json(category);
  } catch (error: unknown) {
    console.error("Error updating threat category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update threat category" },
      { status: 500 }
    );
  }
}

// DELETE threat category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.threatCategory.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting threat category:", error);
    return NextResponse.json(
      { error: "Failed to delete threat category" },
      { status: 500 }
    );
  }
}

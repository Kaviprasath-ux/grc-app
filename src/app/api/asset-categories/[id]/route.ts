import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT update asset category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, status } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const category = await prisma.assetCategory.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        status: status || "Active",
      },
      include: {
        subCategories: true,
        _count: {
          select: { assets: true, subCategories: true },
        },
      },
    });

    return NextResponse.json(category);
  } catch (error: unknown) {
    console.error("Error updating asset category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update asset category" },
      { status: 500 }
    );
  }
}

// DELETE asset category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.assetCategory.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset category:", error);
    return NextResponse.json(
      { error: "Failed to delete asset category" },
      { status: 500 }
    );
  }
}

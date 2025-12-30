import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT update asset sub-category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, categoryId, status } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Sub-category name is required" },
        { status: 400 }
      );
    }

    const subCategory = await prisma.assetSubCategory.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        categoryId,
        status: status || "Active",
      },
      include: {
        category: true,
        _count: {
          select: { assets: true },
        },
      },
    });

    return NextResponse.json(subCategory);
  } catch (error: unknown) {
    console.error("Error updating asset sub-category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Sub-category with this name already exists in this category" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update asset sub-category" },
      { status: 500 }
    );
  }
}

// DELETE asset sub-category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.assetSubCategory.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset sub-category:", error);
    return NextResponse.json(
      { error: "Failed to delete asset sub-category" },
      { status: 500 }
    );
  }
}

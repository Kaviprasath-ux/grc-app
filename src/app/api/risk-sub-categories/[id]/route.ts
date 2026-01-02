import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT update risk sub category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { type } = body;

    if (!type?.trim()) {
      return NextResponse.json(
        { error: "Type is required" },
        { status: 400 }
      );
    }

    const subCategory = await prisma.riskSubCategory.update({
      where: { id },
      data: {
        type: type.trim(),
      },
    });

    return NextResponse.json(subCategory);
  } catch (error: unknown) {
    console.error("Error updating risk sub category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Sub category with this type already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update risk sub category" },
      { status: 500 }
    );
  }
}

// DELETE risk sub category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.riskSubCategory.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting risk sub category:", error);
    return NextResponse.json(
      { error: "Failed to delete risk sub category" },
      { status: 500 }
    );
  }
}

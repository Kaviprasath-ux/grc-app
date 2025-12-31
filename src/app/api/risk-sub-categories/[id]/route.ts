import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single risk sub-category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subCategory = await prisma.riskSubCategory.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!subCategory) {
      return NextResponse.json(
        { error: "Risk sub-category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(subCategory);
  } catch (error) {
    console.error("Error fetching risk sub-category:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk sub-category" },
      { status: 500 }
    );
  }
}

// PUT update risk sub-category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, categoryId, status } = body;

    const existing = await prisma.riskSubCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk sub-category not found" },
        { status: 404 }
      );
    }

    // Check for name conflict within same category
    if (name && (name !== existing.name || categoryId !== existing.categoryId)) {
      const conflict = await prisma.riskSubCategory.findFirst({
        where: {
          name,
          categoryId: categoryId || existing.categoryId,
          NOT: { id },
        },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Sub-category name already exists in this category" },
          { status: 400 }
        );
      }
    }

    const subCategory = await prisma.riskSubCategory.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        categoryId: categoryId || existing.categoryId,
        status: status || existing.status,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(subCategory);
  } catch (error) {
    console.error("Error updating risk sub-category:", error);
    return NextResponse.json(
      { error: "Failed to update risk sub-category" },
      { status: 500 }
    );
  }
}

// DELETE risk sub-category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.riskSubCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk sub-category not found" },
        { status: 404 }
      );
    }

    await prisma.riskSubCategory.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Risk sub-category deleted successfully" });
  } catch (error) {
    console.error("Error deleting risk sub-category:", error);
    return NextResponse.json(
      { error: "Failed to delete risk sub-category" },
      { status: 500 }
    );
  }
}

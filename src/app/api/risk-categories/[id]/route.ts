import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET a single risk category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const category = await prisma.riskCategory.findUnique({
      where: { id },
      include: {
        risks: {
          select: {
            id: true,
            riskId: true,
            name: true,
            riskRating: true,
            status: true,
          },
        },
        _count: {
          select: { risks: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Risk category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching risk category:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk category" },
      { status: 500 }
    );
  }
}

// PUT update a risk category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, color } = body;

    const existing = await prisma.riskCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Risk category not found" },
        { status: 404 }
      );
    }

    // Check for duplicate name if name is being changed
    if (name && name !== existing.name) {
      const duplicate = await prisma.riskCategory.findUnique({
        where: { name },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 400 }
        );
      }
    }

    const category = await prisma.riskCategory.update({
      where: { id },
      data: {
        name,
        description,
        color,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error updating risk category:", error);
    return NextResponse.json(
      { error: "Failed to update risk category" },
      { status: 500 }
    );
  }
}

// DELETE a risk category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.riskCategory.findUnique({
      where: { id },
      include: { _count: { select: { risks: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk category not found" },
        { status: 404 }
      );
    }

    if (existing._count.risks > 0) {
      return NextResponse.json(
        { error: "Cannot delete category with associated risks" },
        { status: 400 }
      );
    }

    await prisma.riskCategory.delete({ where: { id } });

    return NextResponse.json({ message: "Risk category deleted successfully" });
  } catch (error) {
    console.error("Error deleting risk category:", error);
    return NextResponse.json(
      { error: "Failed to delete risk category" },
      { status: 500 }
    );
  }
}

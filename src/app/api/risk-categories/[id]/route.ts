import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single risk category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await prisma.riskCategory.findUnique({
      where: { id },
      include: {
        subCategories: true,
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

// PUT update risk category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, status } = body;

    const existing = await prisma.riskCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk category not found" },
        { status: 404 }
      );
    }

    // Check for name conflicts
    if (name && name !== existing.name) {
      const conflict = await prisma.riskCategory.findUnique({
        where: { name },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Risk category name already exists" },
          { status: 400 }
        );
      }
    }

    const category = await prisma.riskCategory.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        status: status || existing.status,
      },
      include: {
        subCategories: true,
        _count: {
          select: { risks: true },
        },
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

// DELETE risk category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.riskCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk category not found" },
        { status: 404 }
      );
    }

    await prisma.riskCategory.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Risk category deleted successfully" });
  } catch (error) {
    console.error("Error deleting risk category:", error);
    return NextResponse.json(
      { error: "Failed to delete risk category" },
      { status: 500 }
    );
  }
}

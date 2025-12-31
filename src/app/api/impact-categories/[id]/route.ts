import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single impact category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await prisma.impactCategory.findUnique({
      where: { id },
      include: {
        impactRatings: true,
        _count: {
          select: { impactRatings: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Impact category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching impact category:", error);
    return NextResponse.json(
      { error: "Failed to fetch impact category" },
      { status: 500 }
    );
  }
}

// PUT update impact category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    const existing = await prisma.impactCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Impact category not found" },
        { status: 404 }
      );
    }

    if (name && name !== existing.name) {
      const conflict = await prisma.impactCategory.findUnique({
        where: { name },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Impact category name already exists" },
          { status: 400 }
        );
      }
    }

    const category = await prisma.impactCategory.update({
      where: { id },
      data: {
        name: name || existing.name,
      },
      include: {
        _count: {
          select: { impactRatings: true },
        },
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error updating impact category:", error);
    return NextResponse.json(
      { error: "Failed to update impact category" },
      { status: 500 }
    );
  }
}

// DELETE impact category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.impactCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Impact category not found" },
        { status: 404 }
      );
    }

    await prisma.impactCategory.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Impact category deleted successfully" });
  } catch (error) {
    console.error("Error deleting impact category:", error);
    return NextResponse.json(
      { error: "Failed to delete impact category" },
      { status: 500 }
    );
  }
}

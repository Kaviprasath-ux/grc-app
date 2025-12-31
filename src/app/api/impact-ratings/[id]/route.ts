import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single impact rating
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rating = await prisma.impactRating.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!rating) {
      return NextResponse.json(
        { error: "Impact rating not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(rating);
  } catch (error) {
    console.error("Error fetching impact rating:", error);
    return NextResponse.json(
      { error: "Failed to fetch impact rating" },
      { status: 500 }
    );
  }
}

// PUT update impact rating
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, score, description, categoryId } = body;

    const existing = await prisma.impactRating.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Impact rating not found" },
        { status: 404 }
      );
    }

    if (name && name !== existing.name) {
      const conflict = await prisma.impactRating.findUnique({
        where: { name },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Impact rating name already exists" },
          { status: 400 }
        );
      }
    }

    const rating = await prisma.impactRating.update({
      where: { id },
      data: {
        name: name || existing.name,
        score: score !== undefined ? parseInt(score) : existing.score,
        description: description !== undefined ? description : existing.description,
        categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(rating);
  } catch (error) {
    console.error("Error updating impact rating:", error);
    return NextResponse.json(
      { error: "Failed to update impact rating" },
      { status: 500 }
    );
  }
}

// DELETE impact rating
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.impactRating.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Impact rating not found" },
        { status: 404 }
      );
    }

    await prisma.impactRating.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Impact rating deleted successfully" });
  } catch (error) {
    console.error("Error deleting impact rating:", error);
    return NextResponse.json(
      { error: "Failed to delete impact rating" },
      { status: 500 }
    );
  }
}

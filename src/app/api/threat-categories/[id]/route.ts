import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single threat category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await prisma.threatCategory.findUnique({
      where: { id },
      include: {
        threats: true,
        _count: {
          select: { threats: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Threat category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching threat category:", error);
    return NextResponse.json(
      { error: "Failed to fetch threat category" },
      { status: 500 }
    );
  }
}

// PUT update threat category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    const existing = await prisma.threatCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Threat category not found" },
        { status: 404 }
      );
    }

    if (name && name !== existing.name) {
      const conflict = await prisma.threatCategory.findUnique({
        where: { name },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Threat category name already exists" },
          { status: 400 }
        );
      }
    }

    const category = await prisma.threatCategory.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
      },
      include: {
        _count: {
          select: { threats: true },
        },
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error updating threat category:", error);
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

    const existing = await prisma.threatCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Threat category not found" },
        { status: 404 }
      );
    }

    await prisma.threatCategory.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Threat category deleted successfully" });
  } catch (error) {
    console.error("Error deleting threat category:", error);
    return NextResponse.json(
      { error: "Failed to delete threat category" },
      { status: 500 }
    );
  }
}

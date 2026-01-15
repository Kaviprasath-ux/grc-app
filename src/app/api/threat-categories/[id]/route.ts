import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
        _count: { select: { threats: true } },
      },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
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
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const category = await prisma.threatCategory.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(category);
  } catch (error: unknown) {
    console.error("Error updating threat category:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
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
    await prisma.threatCategory.delete({ where: { id } });
    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting threat category:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to delete threat category" },
      { status: 500 }
    );
  }
}

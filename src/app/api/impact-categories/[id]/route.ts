import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT update impact category
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

    const category = await prisma.impactCategory.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(category);
  } catch (error: unknown) {
    console.error("Error updating impact category:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
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
    await prisma.impactCategory.delete({ where: { id } });
    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting impact category:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to delete impact category" },
      { status: 500 }
    );
  }
}

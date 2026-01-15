import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
      return NextResponse.json({ error: "Type is required" }, { status: 400 });
    }

    const category = await prisma.riskSubCategory.update({
      where: { id },
      data: { type: type.trim() },
    });

    return NextResponse.json(category);
  } catch (error: unknown) {
    console.error("Error updating risk sub category:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Sub category not found" }, { status: 404 });
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
    await prisma.riskSubCategory.delete({ where: { id } });
    return NextResponse.json({ message: "Sub category deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting risk sub category:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Sub category not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to delete risk sub category" },
      { status: 500 }
    );
  }
}

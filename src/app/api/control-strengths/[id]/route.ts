import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT update control strength
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, score } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const strength = await prisma.controlStrength.update({
      where: { id },
      data: {
        name: name.trim(),
        score: parseInt(score) || 0,
      },
    });

    return NextResponse.json(strength);
  } catch (error: unknown) {
    console.error("Error updating control strength:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Control strength not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update control strength" },
      { status: 500 }
    );
  }
}

// DELETE control strength
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.controlStrength.delete({ where: { id } });
    return NextResponse.json({ message: "Control strength deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting control strength:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Control strength not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to delete control strength" },
      { status: 500 }
    );
  }
}

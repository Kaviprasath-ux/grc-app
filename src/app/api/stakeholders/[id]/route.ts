import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT update stakeholder
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, type, status, departmentId } = body;

    const stakeholder = await prisma.stakeholder.update({
      where: { id },
      data: { name, email, type, status, departmentId },
      include: { department: true },
    });

    return NextResponse.json(stakeholder);
  } catch (error: unknown) {
    console.error("Error updating stakeholder:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Stakeholder not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update stakeholder" }, { status: 500 });
  }
}

// DELETE stakeholder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.stakeholder.delete({ where: { id } });
    return NextResponse.json({ message: "Stakeholder deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting stakeholder:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Stakeholder not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete stakeholder" }, { status: 500 });
  }
}

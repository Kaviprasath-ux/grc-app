import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single department
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        users: true,
        issues: true,
        stakeholders: true,
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error("Error fetching department:", error);
    return NextResponse.json(
      { error: "Failed to fetch department" },
      { status: 500 }
    );
  }
}

// PUT update department
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, headId } = body;

    const department = await prisma.department.update({
      where: { id },
      data: {
        name,
        description: description || null,
        headId: headId || null,
      },
    });

    return NextResponse.json(department);
  } catch (error: unknown) {
    console.error("Error updating department:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update department" },
      { status: 500 }
    );
  }
}

// DELETE department
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.department.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Department deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting department:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete department" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single vulnerability
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vulnerability = await prisma.vulnerability.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!vulnerability) {
      return NextResponse.json(
        { error: "Vulnerability not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(vulnerability);
  } catch (error) {
    console.error("Error fetching vulnerability:", error);
    return NextResponse.json(
      { error: "Failed to fetch vulnerability" },
      { status: 500 }
    );
  }
}

// PUT update vulnerability
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, categoryId } = body;

    const existing = await prisma.vulnerability.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Vulnerability not found" },
        { status: 404 }
      );
    }

    if (name && name !== existing.name) {
      const conflict = await prisma.vulnerability.findUnique({
        where: { name },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Vulnerability name already exists" },
          { status: 400 }
        );
      }
    }

    const vulnerability = await prisma.vulnerability.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(vulnerability);
  } catch (error) {
    console.error("Error updating vulnerability:", error);
    return NextResponse.json(
      { error: "Failed to update vulnerability" },
      { status: 500 }
    );
  }
}

// DELETE vulnerability
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.vulnerability.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Vulnerability not found" },
        { status: 404 }
      );
    }

    await prisma.vulnerability.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Vulnerability deleted successfully" });
  } catch (error) {
    console.error("Error deleting vulnerability:", error);
    return NextResponse.json(
      { error: "Failed to delete vulnerability" },
      { status: 500 }
    );
  }
}

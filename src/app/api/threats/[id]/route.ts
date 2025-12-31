import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single threat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const threat = await prisma.threat.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!threat) {
      return NextResponse.json(
        { error: "Threat not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(threat);
  } catch (error) {
    console.error("Error fetching threat:", error);
    return NextResponse.json(
      { error: "Failed to fetch threat" },
      { status: 500 }
    );
  }
}

// PUT update threat
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, categoryId } = body;

    const existing = await prisma.threat.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Threat not found" },
        { status: 404 }
      );
    }

    if (name && name !== existing.name) {
      const conflict = await prisma.threat.findUnique({
        where: { name },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Threat name already exists" },
          { status: 400 }
        );
      }
    }

    const threat = await prisma.threat.update({
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

    return NextResponse.json(threat);
  } catch (error) {
    console.error("Error updating threat:", error);
    return NextResponse.json(
      { error: "Failed to update threat" },
      { status: 500 }
    );
  }
}

// DELETE threat
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.threat.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Threat not found" },
        { status: 404 }
      );
    }

    await prisma.threat.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Threat deleted successfully" });
  } catch (error) {
    console.error("Error deleting threat:", error);
    return NextResponse.json(
      { error: "Failed to delete threat" },
      { status: 500 }
    );
  }
}

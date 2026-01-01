import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET a single risk type by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const type = await prisma.riskType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { risks: true },
        },
      },
    });

    if (!type) {
      return NextResponse.json({ error: "Type not found" }, { status: 404 });
    }

    return NextResponse.json(type);
  } catch (error) {
    console.error("Error fetching risk type:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk type" },
      { status: 500 }
    );
  }
}

// PUT update a risk type
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    const existingType = await prisma.riskType.findUnique({ where: { id } });
    if (!existingType) {
      return NextResponse.json({ error: "Type not found" }, { status: 404 });
    }

    // Check for duplicate name (excluding current type)
    if (name && name !== existingType.name) {
      const duplicate = await prisma.riskType.findUnique({ where: { name } });
      if (duplicate) {
        return NextResponse.json(
          { error: "Type with this name already exists" },
          { status: 400 }
        );
      }
    }

    const type = await prisma.riskType.update({
      where: { id },
      data: {
        name: name || existingType.name,
        description: description !== undefined ? description : existingType.description,
      },
    });

    return NextResponse.json(type);
  } catch (error) {
    console.error("Error updating risk type:", error);
    return NextResponse.json(
      { error: "Failed to update risk type" },
      { status: 500 }
    );
  }
}

// DELETE a risk type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingType = await prisma.riskType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { risks: true },
        },
      },
    });

    if (!existingType) {
      return NextResponse.json({ error: "Type not found" }, { status: 404 });
    }

    if (existingType._count.risks > 0) {
      return NextResponse.json(
        { error: "Cannot delete type with associated risks" },
        { status: 400 }
      );
    }

    await prisma.riskType.delete({ where: { id } });

    return NextResponse.json({ message: "Type deleted successfully" });
  } catch (error) {
    console.error("Error deleting risk type:", error);
    return NextResponse.json(
      { error: "Failed to delete risk type" },
      { status: 500 }
    );
  }
}

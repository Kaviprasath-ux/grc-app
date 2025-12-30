import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single asset classification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const classification = await prisma.assetClassification.findUnique({
      where: { id },
      include: {
        assets: {
          include: {
            department: true,
            owner: true,
          },
        },
        _count: {
          select: { assets: true },
        },
      },
    });

    if (!classification) {
      return NextResponse.json(
        { error: "Asset classification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(classification);
  } catch (error) {
    console.error("Error fetching asset classification:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset classification" },
      { status: 500 }
    );
  }
}

// PUT update asset classification
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    // Check if classification exists
    const existingClassification = await prisma.assetClassification.findUnique({
      where: { id },
    });

    if (!existingClassification) {
      return NextResponse.json(
        { error: "Asset classification not found" },
        { status: 404 }
      );
    }

    // Check if new name conflicts with another classification
    if (name && name !== existingClassification.name) {
      const conflictingClassification = await prisma.assetClassification.findUnique({
        where: { name },
      });
      if (conflictingClassification) {
        return NextResponse.json(
          { error: "Classification name already exists" },
          { status: 400 }
        );
      }
    }

    const classification = await prisma.assetClassification.update({
      where: { id },
      data: {
        name: name || existingClassification.name,
        description,
      },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    return NextResponse.json(classification);
  } catch (error) {
    console.error("Error updating asset classification:", error);
    return NextResponse.json(
      { error: "Failed to update asset classification" },
      { status: 500 }
    );
  }
}

// DELETE asset classification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if classification exists
    const existingClassification = await prisma.assetClassification.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    if (!existingClassification) {
      return NextResponse.json(
        { error: "Asset classification not found" },
        { status: 404 }
      );
    }

    // Check if classification has assets
    if (existingClassification._count.assets > 0) {
      return NextResponse.json(
        { error: "Cannot delete classification with associated assets" },
        { status: 400 }
      );
    }

    await prisma.assetClassification.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Asset classification deleted successfully" });
  } catch (error) {
    console.error("Error deleting asset classification:", error);
    return NextResponse.json(
      { error: "Failed to delete asset classification" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT update asset group
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 }
      );
    }

    const group = await prisma.assetGroup.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
      include: {
        _count: {
          select: { assets: true, assetCIAClassifications: true },
        },
      },
    });

    return NextResponse.json(group);
  } catch (error: unknown) {
    console.error("Error updating asset group:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Group with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update asset group" },
      { status: 500 }
    );
  }
}

// DELETE asset group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.assetGroup.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset group:", error);
    return NextResponse.json(
      { error: "Failed to delete asset group" },
      { status: 500 }
    );
  }
}

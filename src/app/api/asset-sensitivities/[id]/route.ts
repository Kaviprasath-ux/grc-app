import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT update asset sensitivity
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
        { error: "Sensitivity name is required" },
        { status: 400 }
      );
    }

    const sensitivity = await prisma.assetSensitivity.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    return NextResponse.json(sensitivity);
  } catch (error: unknown) {
    console.error("Error updating asset sensitivity:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Sensitivity with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update asset sensitivity" },
      { status: 500 }
    );
  }
}

// DELETE asset sensitivity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.assetSensitivity.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset sensitivity:", error);
    return NextResponse.json(
      { error: "Failed to delete asset sensitivity" },
      { status: 500 }
    );
  }
}

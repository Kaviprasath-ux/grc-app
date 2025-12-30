import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT update asset lifecycle status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, order } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Status name is required" },
        { status: 400 }
      );
    }

    const status = await prisma.assetLifecycleStatus.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        order: order || 0,
      },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    return NextResponse.json(status);
  } catch (error: unknown) {
    console.error("Error updating asset lifecycle status:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Status with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update asset lifecycle status" },
      { status: 500 }
    );
  }
}

// DELETE asset lifecycle status
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.assetLifecycleStatus.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset lifecycle status:", error);
    return NextResponse.json(
      { error: "Failed to delete asset lifecycle status" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single BCP label
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const label = await prisma.bCPLabel.findUnique({
      where: { id },
    });

    if (!label) {
      return NextResponse.json(
        { error: "BCP label not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(label);
  } catch (error) {
    console.error("Error fetching BCP label:", error);
    return NextResponse.json(
      { error: "Failed to fetch BCP label" },
      { status: 500 }
    );
  }
}

// PUT update BCP label
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, type, hours, description, sortOrder, isActive } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Label name is required" },
        { status: 400 }
      );
    }

    if (!type || !["RTO", "RPO"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be either RTO or RPO" },
        { status: 400 }
      );
    }

    const label = await prisma.bCPLabel.update({
      where: { id },
      data: {
        name: name.trim(),
        type,
        hours: hours ?? 0,
        description: description?.trim() || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(label);
  } catch (error: unknown) {
    console.error("Error updating BCP label:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "BCP label not found" },
        { status: 404 }
      );
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Label with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update BCP label" },
      { status: 500 }
    );
  }
}

// DELETE BCP label
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.bCPLabel.delete({
      where: { id },
    });

    return NextResponse.json({ message: "BCP label deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting BCP label:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "BCP label not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete BCP label" },
      { status: 500 }
    );
  }
}

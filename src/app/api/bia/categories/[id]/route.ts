import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { translateRecord, deleteRecordTranslations } from "@/lib/translation-service";

// GET single BIA category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await prisma.bIACategory.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json(
        { error: "BIA category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching BIA category:", error);
    return NextResponse.json(
      { error: "Failed to fetch BIA category" },
      { status: 500 }
    );
  }
}

// PUT update BIA category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, sortOrder, isActive } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const category = await prisma.bIACategory.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    });

    const session = await auth();
    const customerAccountId = (session as any)?.customerAccountId;
    if (customerAccountId) {
      void translateRecord(customerAccountId, 'BIACategory', id, { name: category.name, description: category.description ?? undefined });
    }

    return NextResponse.json(category);
  } catch (error: unknown) {
    console.error("Error updating BIA category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "BIA category not found" },
        { status: 404 }
      );
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update BIA category" },
      { status: 500 }
    );
  }
}

// DELETE BIA category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.bIACategory.delete({
      where: { id },
    });

    const session = await auth();
    const customerAccountId = (session as any)?.customerAccountId;
    if (customerAccountId) {
      void deleteRecordTranslations(customerAccountId, 'BIACategory', id);
    }

    return NextResponse.json({ message: "BIA category deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting BIA category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "BIA category not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete BIA category" },
      { status: 500 }
    );
  }
}

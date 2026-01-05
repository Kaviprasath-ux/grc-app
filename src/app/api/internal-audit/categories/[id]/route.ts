import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET a single audit category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const category = await prisma.auditCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { internalAuditRisks: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Audit category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching audit category:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit category" },
      { status: 500 }
    );
  }
}

// PUT update an audit category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    const existing = await prisma.auditCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Audit category not found" },
        { status: 404 }
      );
    }

    // Check for duplicate name if name is being changed
    if (name && name !== existing.name) {
      const duplicate = await prisma.auditCategory.findUnique({
        where: { name },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 400 }
        );
      }
    }

    const category = await prisma.auditCategory.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error updating audit category:", error);
    return NextResponse.json(
      { error: "Failed to update audit category" },
      { status: 500 }
    );
  }
}

// DELETE an audit category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.auditCategory.findUnique({
      where: { id },
      include: { _count: { select: { internalAuditRisks: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Audit category not found" },
        { status: 404 }
      );
    }

    if (existing._count.internalAuditRisks > 0) {
      return NextResponse.json(
        { error: "Cannot delete category with associated risks" },
        { status: 400 }
      );
    }

    await prisma.auditCategory.delete({ where: { id } });

    return NextResponse.json({ message: "Audit category deleted successfully" });
  } catch (error) {
    console.error("Error deleting audit category:", error);
    return NextResponse.json(
      { error: "Failed to delete audit category" },
      { status: 500 }
    );
  }
}

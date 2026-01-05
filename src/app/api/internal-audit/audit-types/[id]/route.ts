import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET a single audit type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const auditType = await prisma.auditType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { internalAuditRisks: true },
        },
      },
    });

    if (!auditType) {
      return NextResponse.json(
        { error: "Audit type not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(auditType);
  } catch (error) {
    console.error("Error fetching audit type:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit type" },
      { status: 500 }
    );
  }
}

// PUT update an audit type
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    const existing = await prisma.auditType.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Audit type not found" },
        { status: 404 }
      );
    }

    // Check for duplicate name if name is being changed
    if (name && name !== existing.name) {
      const duplicate = await prisma.auditType.findUnique({
        where: { name },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Audit type with this name already exists" },
          { status: 400 }
        );
      }
    }

    const auditType = await prisma.auditType.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json(auditType);
  } catch (error) {
    console.error("Error updating audit type:", error);
    return NextResponse.json(
      { error: "Failed to update audit type" },
      { status: 500 }
    );
  }
}

// DELETE an audit type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.auditType.findUnique({
      where: { id },
      include: { _count: { select: { internalAuditRisks: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Audit type not found" },
        { status: 404 }
      );
    }

    if (existing._count.internalAuditRisks > 0) {
      return NextResponse.json(
        { error: "Cannot delete audit type with associated risks" },
        { status: 400 }
      );
    }

    await prisma.auditType.delete({ where: { id } });

    return NextResponse.json({ message: "Audit type deleted successfully" });
  } catch (error) {
    console.error("Error deleting audit type:", error);
    return NextResponse.json(
      { error: "Failed to delete audit type" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET single threat category - with tenant validation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;

    const { id } = await params;
    const category = await prisma.threatCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { threats: true } },
      },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Check tenant ownership (unless GRC Admin)
    if (!isGRCAdmin && customerAccountId && category.customerAccountId !== customerAccountId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error fetching threat category:", error);
    return NextResponse.json(
      { error: "Failed to fetch threat category" },
      { status: 500 }
    );
  }
}

// PUT update threat category - with tenant validation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;

    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Verify item exists and belongs to this tenant
    const existing = await prisma.threatCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Check tenant ownership (unless GRC Admin)
    if (!isGRCAdmin && customerAccountId && existing.customerAccountId !== customerAccountId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const category = await prisma.threatCategory.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(category);
  } catch (error: unknown) {
    console.error("Error updating threat category:", error);
    return NextResponse.json(
      { error: "Failed to update threat category" },
      { status: 500 }
    );
  }
}

// DELETE threat category - with tenant validation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;

    const { id } = await params;

    // Verify item exists and belongs to this tenant
    const existing = await prisma.threatCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Check tenant ownership (unless GRC Admin)
    if (!isGRCAdmin && customerAccountId && existing.customerAccountId !== customerAccountId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.threatCategory.delete({ where: { id } });
    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting threat category:", error);
    return NextResponse.json(
      { error: "Failed to delete threat category" },
      { status: 500 }
    );
  }
}

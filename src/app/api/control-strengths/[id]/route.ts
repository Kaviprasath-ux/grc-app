import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PUT update control strength - with tenant validation
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
    const { name, score } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Verify item exists and belongs to this tenant
    const existing = await prisma.controlStrength.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Control strength not found" }, { status: 404 });
    }

    // Check tenant ownership (unless GRC Admin)
    if (!isGRCAdmin && customerAccountId && existing.customerAccountId !== customerAccountId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const strength = await prisma.controlStrength.update({
      where: { id },
      data: {
        name: name.trim(),
        score: parseInt(score) || 0,
      },
    });

    return NextResponse.json(strength);
  } catch (error: unknown) {
    console.error("Error updating control strength:", error);
    return NextResponse.json(
      { error: "Failed to update control strength" },
      { status: 500 }
    );
  }
}

// DELETE control strength - with tenant validation
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
    const existing = await prisma.controlStrength.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Control strength not found" }, { status: 404 });
    }

    // Check tenant ownership (unless GRC Admin)
    if (!isGRCAdmin && customerAccountId && existing.customerAccountId !== customerAccountId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.controlStrength.delete({ where: { id } });
    return NextResponse.json({ message: "Control strength deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting control strength:", error);
    return NextResponse.json(
      { error: "Failed to delete control strength" },
      { status: 500 }
    );
  }
}

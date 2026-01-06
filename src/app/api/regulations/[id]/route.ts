import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT update regulation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, version, sa1Date, sa2Date, scope, exclusionJustification, document, certificate, status } = body;

    const regulation = await prisma.regulation.update({
      where: { id },
      data: {
        name,
        version,
        sa1Date,
        sa2Date,
        scope,
        exclusionJustification,
        document,
        certificate,
        status,
      },
    });

    return NextResponse.json(regulation);
  } catch (error: unknown) {
    console.error("Error updating regulation:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Regulation not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update regulation" }, { status: 500 });
  }
}

// DELETE regulation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.regulation.delete({ where: { id } });
    return NextResponse.json({ message: "Regulation deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting regulation:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Regulation not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete regulation" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET a single impact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const impact = await prisma.auditImpact.findUnique({
      where: { id },
    });

    if (!impact) {
      return NextResponse.json(
        { error: "Impact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(impact);
  } catch (error) {
    console.error("Error fetching impact:", error);
    return NextResponse.json(
      { error: "Failed to fetch impact" },
      { status: 500 }
    );
  }
}

// PUT update an impact
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { label, value } = body;

    const existing = await prisma.auditImpact.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Impact not found" },
        { status: 404 }
      );
    }

    // Check for duplicate label if label is being changed
    if (label && label !== existing.label) {
      const duplicate = await prisma.auditImpact.findUnique({
        where: { label },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Impact with this label already exists" },
          { status: 400 }
        );
      }
    }

    const impact = await prisma.auditImpact.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(value !== undefined && { value }),
      },
    });

    return NextResponse.json(impact);
  } catch (error) {
    console.error("Error updating impact:", error);
    return NextResponse.json(
      { error: "Failed to update impact" },
      { status: 500 }
    );
  }
}

// DELETE an impact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.auditImpact.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Impact not found" },
        { status: 404 }
      );
    }

    await prisma.auditImpact.delete({ where: { id } });

    return NextResponse.json({ message: "Impact deleted successfully" });
  } catch (error) {
    console.error("Error deleting impact:", error);
    return NextResponse.json(
      { error: "Failed to delete impact" },
      { status: 500 }
    );
  }
}

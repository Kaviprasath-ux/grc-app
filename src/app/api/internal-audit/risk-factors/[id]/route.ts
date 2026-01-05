import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET a single risk factor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const factor = await prisma.auditRiskFactor.findUnique({
      where: { id },
    });

    if (!factor) {
      return NextResponse.json(
        { error: "Risk factor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(factor);
  } catch (error) {
    console.error("Error fetching risk factor:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk factor" },
      { status: 500 }
    );
  }
}

// PUT update a risk factor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { label } = body;

    const existing = await prisma.auditRiskFactor.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Risk factor not found" },
        { status: 404 }
      );
    }

    // Check for duplicate label if label is being changed
    if (label && label !== existing.label) {
      const duplicate = await prisma.auditRiskFactor.findUnique({
        where: { label },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Risk factor with this label already exists" },
          { status: 400 }
        );
      }
    }

    const factor = await prisma.auditRiskFactor.update({
      where: { id },
      data: { label },
    });

    return NextResponse.json(factor);
  } catch (error) {
    console.error("Error updating risk factor:", error);
    return NextResponse.json(
      { error: "Failed to update risk factor" },
      { status: 500 }
    );
  }
}

// DELETE a risk factor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.auditRiskFactor.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Risk factor not found" },
        { status: 404 }
      );
    }

    await prisma.auditRiskFactor.delete({ where: { id } });

    return NextResponse.json({ message: "Risk factor deleted successfully" });
  } catch (error) {
    console.error("Error deleting risk factor:", error);
    return NextResponse.json(
      { error: "Failed to delete risk factor" },
      { status: 500 }
    );
  }
}

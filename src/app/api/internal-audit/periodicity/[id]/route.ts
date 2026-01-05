import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET a single periodicity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const periodicity = await prisma.auditPeriodicity.findUnique({
      where: { id },
    });

    if (!periodicity) {
      return NextResponse.json(
        { error: "Periodicity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(periodicity);
  } catch (error) {
    console.error("Error fetching periodicity:", error);
    return NextResponse.json(
      { error: "Failed to fetch periodicity" },
      { status: 500 }
    );
  }
}

// PUT update a periodicity
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { interval, months } = body;

    const existing = await prisma.auditPeriodicity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Periodicity not found" },
        { status: 404 }
      );
    }

    // Check for duplicate interval if interval is being changed
    if (interval && interval !== existing.interval) {
      const duplicate = await prisma.auditPeriodicity.findUnique({
        where: { interval },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Periodicity with this interval already exists" },
          { status: 400 }
        );
      }
    }

    const periodicity = await prisma.auditPeriodicity.update({
      where: { id },
      data: {
        ...(interval !== undefined && { interval }),
        ...(months !== undefined && { months }),
      },
    });

    return NextResponse.json(periodicity);
  } catch (error) {
    console.error("Error updating periodicity:", error);
    return NextResponse.json(
      { error: "Failed to update periodicity" },
      { status: 500 }
    );
  }
}

// DELETE a periodicity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.auditPeriodicity.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Periodicity not found" },
        { status: 404 }
      );
    }

    await prisma.auditPeriodicity.delete({ where: { id } });

    return NextResponse.json({ message: "Periodicity deleted successfully" });
  } catch (error) {
    console.error("Error deleting periodicity:", error);
    return NextResponse.json(
      { error: "Failed to delete periodicity" },
      { status: 500 }
    );
  }
}

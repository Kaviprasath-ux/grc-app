import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single KPI with reviews
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const kpi = await prisma.kPI.findUnique({
      where: { id },
      include: {
        department: true,
        evidence: {
          include: {
            control: true,
            attachments: true,
          },
        },
        reviews: {
          include: {
            actionPlans: {
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { reviewDate: "desc" },
        },
      },
    });

    if (!kpi) {
      return NextResponse.json(
        { error: "KPI not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(kpi);
  } catch (error) {
    console.error("Error fetching KPI:", error);
    return NextResponse.json(
      { error: "Failed to fetch KPI" },
      { status: 500 }
    );
  }
}

// PUT update KPI
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      objective,
      description,
      dataSource,
      calculationFormula,
      expectedScore,
      actualScore,
      reviewDate,
      status,
      departmentId,
      evidenceId,
    } = body;

    const kpi = await prisma.kPI.update({
      where: { id },
      data: {
        objective,
        description,
        dataSource,
        calculationFormula,
        expectedScore: expectedScore !== undefined ? parseFloat(expectedScore) : undefined,
        actualScore: actualScore !== undefined ? parseFloat(actualScore) : undefined,
        reviewDate: reviewDate ? new Date(reviewDate) : undefined,
        status,
        departmentId: departmentId || undefined,
        evidenceId: evidenceId || undefined,
      },
      include: {
        department: true,
        evidence: true,
        reviews: {
          orderBy: { reviewDate: "desc" },
        },
      },
    });

    return NextResponse.json(kpi);
  } catch (error: unknown) {
    console.error("Error updating KPI:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "KPI not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update KPI" },
      { status: 500 }
    );
  }
}

// DELETE KPI
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.kPI.delete({
      where: { id },
    });

    return NextResponse.json({ message: "KPI deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting KPI:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "KPI not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete KPI" },
      { status: 500 }
    );
  }
}

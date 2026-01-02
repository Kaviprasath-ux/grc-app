import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single action plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string; planId: string }> }
) {
  try {
    const { planId } = await params;

    const actionPlan = await prisma.kPIActionPlan.findUnique({
      where: { id: planId },
    });

    if (!actionPlan) {
      return NextResponse.json(
        { error: "Action plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(actionPlan);
  } catch (error) {
    console.error("Error fetching action plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch action plan" },
      { status: 500 }
    );
  }
}

// PUT update action plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string; planId: string }> }
) {
  try {
    const { planId } = await params;
    const body = await request.json();
    const { plannedAction, description, percentageCompleted, startDate, status } = body;

    const actionPlan = await prisma.kPIActionPlan.update({
      where: { id: planId },
      data: {
        plannedAction: plannedAction !== undefined ? plannedAction : undefined,
        description: description !== undefined ? description : undefined,
        percentageCompleted: percentageCompleted !== undefined
          ? parseFloat(percentageCompleted)
          : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        status: status !== undefined ? status : undefined,
      },
    });

    return NextResponse.json(actionPlan);
  } catch (error: unknown) {
    console.error("Error updating action plan:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Action plan not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update action plan" },
      { status: 500 }
    );
  }
}

// DELETE action plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string; planId: string }> }
) {
  try {
    const { planId } = await params;

    await prisma.kPIActionPlan.delete({
      where: { id: planId },
    });

    return NextResponse.json({ message: "Action plan deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting action plan:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Action plan not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete action plan" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all action plans for a KPI review
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const { reviewId } = await params;

    const actionPlans = await prisma.kPIActionPlan.findMany({
      where: { kpiReviewId: reviewId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(actionPlans);
  } catch (error) {
    console.error("Error fetching action plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch action plans" },
      { status: 500 }
    );
  }
}

// POST create new action plan for a KPI review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const body = await request.json();
    const { plannedAction, description, percentageCompleted, startDate, status } = body;

    // Validate required fields
    if (!plannedAction) {
      return NextResponse.json(
        { error: "Planned Action is required" },
        { status: 400 }
      );
    }

    if (percentageCompleted === undefined || percentageCompleted === null) {
      return NextResponse.json(
        { error: "Percentage Completed is required" },
        { status: 400 }
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { error: "Start Date is required" },
        { status: 400 }
      );
    }

    // Verify the review exists
    const review = await prisma.kPIReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return NextResponse.json(
        { error: "KPI Review not found" },
        { status: 404 }
      );
    }

    const actionPlan = await prisma.kPIActionPlan.create({
      data: {
        plannedAction,
        description: description || null,
        percentageCompleted: parseFloat(percentageCompleted) || 0,
        startDate: new Date(startDate),
        status: status || "In-Progress",
        kpiReviewId: reviewId,
      },
    });

    return NextResponse.json(actionPlan, { status: 201 });
  } catch (error) {
    console.error("Error creating action plan:", error);
    return NextResponse.json(
      { error: "Failed to create action plan" },
      { status: 500 }
    );
  }
}

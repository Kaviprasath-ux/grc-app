import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all reviews for a QPost KPI
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reviews = await prisma.qPostKPIReview.findMany({
      where: { kpiId: id },
      include: {
        actionPlans: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { reviewDate: "desc" },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error("Error fetching QPost KPI reviews:", error);
    return NextResponse.json(
      { error: "Failed to fetch KPI reviews" },
      { status: 500 }
    );
  }
}

// POST create new QPost KPI review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { reviewDate, actualScore, status, documentPath, documentName } = body;

    // Create the review
    const review = await prisma.qPostKPIReview.create({
      data: {
        kpiId: id,
        reviewDate: reviewDate ? new Date(reviewDate) : new Date(),
        actualScore: actualScore ? parseFloat(actualScore) : null,
        status: status || "Scheduled",
        documentPath,
        documentName,
      },
    });

    // Update the QPost KPI's current actual score and status
    await prisma.qPostKPI.update({
      where: { id },
      data: {
        actualScore: actualScore ? parseFloat(actualScore) : undefined,
        status: status || undefined,
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error("Error creating QPost KPI review:", error);
    return NextResponse.json(
      { error: "Failed to create KPI review" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single KPI review
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const { reviewId } = await params;

    const review = await prisma.kPIReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      return NextResponse.json(
        { error: "KPI review not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(review);
  } catch (error) {
    console.error("Error fetching KPI review:", error);
    return NextResponse.json(
      { error: "Failed to fetch KPI review" },
      { status: 500 }
    );
  }
}

// PUT update KPI review
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const { id, reviewId } = await params;
    const body = await request.json();
    const { reviewDate, actualScore, status, documentPath, documentName } = body;

    const review = await prisma.kPIReview.update({
      where: { id: reviewId },
      data: {
        reviewDate: reviewDate ? new Date(reviewDate) : undefined,
        actualScore: actualScore !== undefined ? parseFloat(actualScore) : undefined,
        status,
        documentPath,
        documentName,
      },
    });

    // Update the KPI's current actual score and status if this is the latest review
    const latestReview = await prisma.kPIReview.findFirst({
      where: { kpiId: id },
      orderBy: { reviewDate: "desc" },
    });

    if (latestReview?.id === reviewId) {
      await prisma.kPI.update({
        where: { id },
        data: {
          actualScore: actualScore !== undefined ? parseFloat(actualScore) : undefined,
          status: status || undefined,
        },
      });
    }

    return NextResponse.json(review);
  } catch (error: unknown) {
    console.error("Error updating KPI review:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "KPI review not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update KPI review" },
      { status: 500 }
    );
  }
}

// DELETE KPI review
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const { reviewId } = await params;

    await prisma.kPIReview.delete({
      where: { id: reviewId },
    });

    return NextResponse.json({ message: "KPI review deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting KPI review:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "KPI review not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete KPI review" },
      { status: 500 }
    );
  }
}

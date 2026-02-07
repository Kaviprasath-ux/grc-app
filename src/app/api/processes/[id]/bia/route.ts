import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET Process BIA assessment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First check if process exists
    const process = await prisma.process.findUnique({
      where: { id },
    });

    if (!process) {
      return NextResponse.json(
        { error: "Process not found" },
        { status: 404 }
      );
    }

    // Get BIA assessment with category ratings
    const bia = await prisma.processBIA.findUnique({
      where: { processId: id },
      include: {
        categoryRatings: {
          orderBy: { categoryName: "asc" },
        },
      },
    });

    if (!bia) {
      return NextResponse.json(null);
    }

    return NextResponse.json(bia);
  } catch (error) {
    console.error("Error fetching Process BIA:", error);
    return NextResponse.json(
      { error: "Failed to fetch Process BIA" },
      { status: 500 }
    );
  }
}

// POST/PUT Create or update Process BIA assessment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      categoryRatings, // Array of { categoryName, rating, ratingScore, description }
      rtoHours,
      rpoHours,
      rtoLabel,
      rpoLabel,
      approverId,
      approverName,
      status,
      comments,
    } = body;

    // First check if process exists
    const process = await prisma.process.findUnique({
      where: { id },
    });

    if (!process) {
      return NextResponse.json(
        { error: "Process not found" },
        { status: 404 }
      );
    }

    // Get scoring configuration
    const scoringConfig = await prisma.bIAScoringConfig.findFirst({
      where: { isActive: true },
    });
    const calculationType = scoringConfig?.calculationType || "High of all";

    // Calculate impact rating based on category ratings and scoring config
    let impactRating = 0;
    if (categoryRatings && Array.isArray(categoryRatings)) {
      const scores = categoryRatings
        .filter((r: { ratingScore?: number }) => r.ratingScore !== undefined && r.ratingScore !== null)
        .map((r: { ratingScore: number }) => r.ratingScore);

      if (scores.length > 0) {
        switch (calculationType) {
          case "High of all":
            impactRating = Math.max(...scores);
            break;
          case "Addition of all":
            impactRating = scores.reduce((sum: number, score: number) => sum + score, 0);
            break;
          case "Product of all":
            impactRating = scores.reduce((product: number, score: number) => product * score, 1);
            break;
          default:
            impactRating = Math.max(...scores);
        }
      }
    }

    // Determine process criticality based on impact rating and scoring ranges
    let processCriticality: string | null = null;
    const scoringRanges = await prisma.bIAScoringRange.findMany({
      where: { calculationType },
      orderBy: { lowValue: "desc" },
    });

    for (const range of scoringRanges) {
      if (impactRating >= range.lowValue) {
        if (range.highValue === null || impactRating <= range.highValue) {
          processCriticality = range.label;
          break;
        }
      }
    }

    // Check if BIA already exists
    const existingBIA = await prisma.processBIA.findUnique({
      where: { processId: id },
    });

    let bia;
    if (existingBIA) {
      // Update existing BIA
      bia = await prisma.processBIA.update({
        where: { processId: id },
        data: {
          status: status || existingBIA.status,
          impactRating,
          processCriticality,
          rtoHours: rtoHours ?? existingBIA.rtoHours,
          rpoHours: rpoHours ?? existingBIA.rpoHours,
          rtoLabel: rtoLabel ?? existingBIA.rtoLabel,
          rpoLabel: rpoLabel ?? existingBIA.rpoLabel,
          approverId: approverId ?? existingBIA.approverId,
          approverName: approverName ?? existingBIA.approverName,
          comments: comments ?? existingBIA.comments,
          approvedAt: status === "Approved" ? new Date() : existingBIA.approvedAt,
        },
        include: {
          categoryRatings: true,
        },
      });

      // Update category ratings
      if (categoryRatings && Array.isArray(categoryRatings)) {
        for (const rating of categoryRatings) {
          await prisma.processBIARating.upsert({
            where: {
              processBIAId_categoryName: {
                processBIAId: bia.id,
                categoryName: rating.categoryName,
              },
            },
            update: {
              rating: rating.rating || null,
              ratingScore: rating.ratingScore ?? null,
              description: rating.description || null,
            },
            create: {
              processBIAId: bia.id,
              categoryName: rating.categoryName,
              rating: rating.rating || null,
              ratingScore: rating.ratingScore ?? null,
              description: rating.description || null,
            },
          });
        }
      }
    } else {
      // Create new BIA
      bia = await prisma.processBIA.create({
        data: {
          processId: id,
          status: status || "Open",
          impactRating,
          processCriticality,
          rtoHours: rtoHours ?? 0,
          rpoHours: rpoHours ?? 0,
          rtoLabel: rtoLabel || null,
          rpoLabel: rpoLabel || null,
          approverId: approverId || null,
          approverName: approverName || null,
          comments: comments || null,
          categoryRatings: {
            create: categoryRatings?.map((rating: { categoryName: string; rating?: string; ratingScore?: number; description?: string }) => ({
              categoryName: rating.categoryName,
              rating: rating.rating || null,
              ratingScore: rating.ratingScore ?? null,
              description: rating.description || null,
            })) || [],
          },
        },
        include: {
          categoryRatings: true,
        },
      });
    }

    // Fetch updated BIA with category ratings
    const updatedBIA = await prisma.processBIA.findUnique({
      where: { processId: id },
      include: {
        categoryRatings: {
          orderBy: { categoryName: "asc" },
        },
      },
    });

    return NextResponse.json(updatedBIA);
  } catch (error) {
    console.error("Error saving Process BIA:", error);
    return NextResponse.json(
      { error: "Failed to save Process BIA" },
      { status: 500 }
    );
  }
}

// DELETE Process BIA assessment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.processBIA.delete({
      where: { processId: id },
    });

    return NextResponse.json({ message: "Process BIA deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting Process BIA:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Process BIA not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete Process BIA" },
      { status: 500 }
    );
  }
}

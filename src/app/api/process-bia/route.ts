import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all process BIA assessments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processId = searchParams.get("processId");
    const status = searchParams.get("status");

    const whereClause: Record<string, unknown> = {};
    if (processId) whereClause.processId = processId;
    if (status) whereClause.status = status;

    const biaAssessments = await prisma.processBIA.findMany({
      where: whereClause,
      include: {
        process: {
          include: {
            department: true,
          },
        },
        categoryRatings: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(biaAssessments);
  } catch (error) {
    console.error("Error fetching process BIA assessments:", error);
    return NextResponse.json(
      { error: "Failed to fetch process BIA assessments" },
      { status: 500 }
    );
  }
}

// POST create or update process BIA assessment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      processId,
      categoryRatings,
      rtoHours,
      rpoHours,
      rtoLabel,
      rpoLabel,
      approverId,
      approverName,
      status,
      comments,
    } = body;

    if (!processId) {
      return NextResponse.json(
        { error: "Process ID is required" },
        { status: 400 }
      );
    }

    // Get the scoring config to calculate impact rating
    const scoringConfig = await prisma.bIAScoringConfig.findFirst();
    const calculationType = scoringConfig?.calculationType || "High of all";

    // Calculate impact rating based on category ratings
    let impactRating = 0;
    if (categoryRatings && categoryRatings.length > 0) {
      const scores = categoryRatings.map((r: { ratingScore: number }) => r.ratingScore || 0);
      if (calculationType === "High of all") {
        impactRating = Math.max(...scores);
      } else if (calculationType === "Addition of all") {
        impactRating = scores.reduce((sum: number, s: number) => sum + s, 0);
      } else if (calculationType === "Product of all") {
        impactRating = scores.reduce((prod: number, s: number) => prod * (s || 1), 1);
      }
    }

    // Determine process criticality based on scoring ranges
    const scoringRange = await prisma.bIAScoringRange.findFirst({
      where: {
        calculationType,
        lowValue: { lte: impactRating },
        OR: [
          { highValue: { gte: impactRating } },
          { highValue: null },
        ],
      },
      orderBy: { lowValue: "desc" },
    });
    const processCriticality = scoringRange?.label || "Low";

    // Check if BIA already exists for this process
    const existingBIA = await prisma.processBIA.findUnique({
      where: { processId },
    });

    let processBIA: Awaited<ReturnType<typeof prisma.processBIA.create>> | null = null;
    if (existingBIA) {
      // Update existing BIA
      processBIA = await prisma.processBIA.update({
        where: { id: existingBIA.id },
        data: {
          impactRating,
          processCriticality,
          rtoHours: rtoHours ?? existingBIA.rtoHours,
          rpoHours: rpoHours ?? existingBIA.rpoHours,
          rtoLabel: rtoLabel ?? existingBIA.rtoLabel,
          rpoLabel: rpoLabel ?? existingBIA.rpoLabel,
          approverId: approverId ?? existingBIA.approverId,
          approverName: approverName ?? existingBIA.approverName,
          status: status ?? existingBIA.status,
          comments: comments ?? existingBIA.comments,
        },
        include: {
          categoryRatings: true,
        },
      });

      // Update category ratings
      if (categoryRatings && processBIA) {
        const biaId = processBIA.id;
        // Delete existing ratings
        await prisma.processBIARating.deleteMany({
          where: { processBIAId: biaId },
        });

        // Create new ratings
        await prisma.processBIARating.createMany({
          data: categoryRatings.map((rating: { categoryName: string; rating: string; ratingScore: number; description: string }) => ({
            processBIAId: biaId,
            categoryName: rating.categoryName,
            rating: rating.rating,
            ratingScore: rating.ratingScore,
            description: rating.description,
          })),
        });
      }
    } else {
      // Create new BIA
      processBIA = await prisma.processBIA.create({
        data: {
          processId,
          impactRating,
          processCriticality,
          rtoHours: rtoHours ?? 0,
          rpoHours: rpoHours ?? 0,
          rtoLabel,
          rpoLabel,
          approverId,
          approverName,
          status: status || "Open",
          comments,
          categoryRatings: categoryRatings
            ? {
                create: categoryRatings.map((rating: { categoryName: string; rating: string; ratingScore: number; description: string }) => ({
                  categoryName: rating.categoryName,
                  rating: rating.rating,
                  ratingScore: rating.ratingScore,
                  description: rating.description,
                })),
              }
            : undefined,
        },
        include: {
          categoryRatings: true,
        },
      });
    }

    // Re-fetch with all relations
    const result = await prisma.processBIA.findUnique({
      where: { id: processBIA.id },
      include: {
        process: {
          include: {
            department: true,
          },
        },
        categoryRatings: true,
      },
    });

    return NextResponse.json(result, { status: existingBIA ? 200 : 201 });
  } catch (error) {
    console.error("Error saving process BIA:", error);
    return NextResponse.json(
      { error: "Failed to save process BIA" },
      { status: 500 }
    );
  }
}

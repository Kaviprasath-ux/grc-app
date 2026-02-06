import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET process BIA by process ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ processId: string }> }
) {
  try {
    const { processId } = await params;
    const processBIA = await prisma.processBIA.findUnique({
      where: { processId },
      include: {
        process: {
          include: {
            department: true,
          },
        },
        categoryRatings: true,
        biaComments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!processBIA) {
      // Return empty object if no BIA exists yet (will be created on save)
      return NextResponse.json(null);
    }

    return NextResponse.json(processBIA);
  } catch (error) {
    console.error("Error fetching process BIA:", error);
    return NextResponse.json(
      { error: "Failed to fetch process BIA" },
      { status: 500 }
    );
  }
}

// PUT update process BIA (including submit for approval)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ processId: string }> }
) {
  try {
    const { processId } = await params;
    const body = await request.json();
    const {
      categoryRatings,
      rtoHours,
      rpoHours,
      rtoLabel,
      rpoLabel,
      lowValue,
      criticalValue,
      highValue,
      mediumValue,
      approverId,
      approverName,
      status,
      comments,
      rejectionReason,
    } = body;

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
          impactRating: categoryRatings ? impactRating : existingBIA.impactRating,
          processCriticality: categoryRatings ? processCriticality : existingBIA.processCriticality,
          ...(rtoHours !== undefined && { rtoHours }),
          ...(rpoHours !== undefined && { rpoHours }),
          ...(rtoLabel !== undefined && { rtoLabel }),
          ...(rpoLabel !== undefined && { rpoLabel }),
          ...(lowValue !== undefined && { lowValue }),
          ...(criticalValue !== undefined && { criticalValue }),
          ...(highValue !== undefined && { highValue }),
          ...(mediumValue !== undefined && { mediumValue }),
          ...(approverId !== undefined && { approverId }),
          ...(approverName !== undefined && { approverName }),
          ...(status !== undefined && { status }),
          ...(comments !== undefined && { comments }),
          ...(rejectionReason !== undefined && { rejectionReason }),
          ...(status === "Approved" && { approvedAt: new Date() }),
        },
      });

      // Update category ratings if provided
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
          lowValue: lowValue ?? null,
          criticalValue: criticalValue ?? null,
          highValue: highValue ?? null,
          mediumValue: mediumValue ?? null,
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
        biaComments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating process BIA:", error);
    return NextResponse.json(
      { error: "Failed to update process BIA" },
      { status: 500 }
    );
  }
}

// DELETE process BIA
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ processId: string }> }
) {
  try {
    const { processId } = await params;
    const existingBIA = await prisma.processBIA.findUnique({
      where: { processId },
    });

    if (!existingBIA) {
      return NextResponse.json(
        { error: "Process BIA not found" },
        { status: 404 }
      );
    }

    await prisma.processBIA.delete({
      where: { id: existingBIA.id },
    });

    return NextResponse.json({ message: "Process BIA deleted successfully" });
  } catch (error) {
    console.error("Error deleting process BIA:", error);
    return NextResponse.json(
      { error: "Failed to delete process BIA" },
      { status: 500 }
    );
  }
}

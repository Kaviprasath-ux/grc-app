import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET BIA scoring configuration
export async function GET() {
  try {
    // Get or create default config
    let config = await prisma.bIAScoringConfig.findFirst();

    if (!config) {
      // Create default config
      config = await prisma.bIAScoringConfig.create({
        data: {
          calculationType: "High of all",
          isActive: true,
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching BIA scoring config:", error);
    return NextResponse.json(
      { error: "Failed to fetch BIA scoring config" },
      { status: 500 }
    );
  }
}

// PUT update BIA scoring configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { calculationType } = body;

    // Get existing config or create one
    let config = await prisma.bIAScoringConfig.findFirst();

    if (config) {
      config = await prisma.bIAScoringConfig.update({
        where: { id: config.id },
        data: {
          ...(calculationType !== undefined && { calculationType }),
        },
      });
    } else {
      config = await prisma.bIAScoringConfig.create({
        data: {
          calculationType: calculationType || "High of all",
          isActive: true,
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating BIA scoring config:", error);
    return NextResponse.json(
      { error: "Failed to update BIA scoring config" },
      { status: 500 }
    );
  }
}

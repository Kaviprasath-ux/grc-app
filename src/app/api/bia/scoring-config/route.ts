import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET BIA scoring configuration (returns the active one or creates default)
export async function GET() {
  try {
    let config = await prisma.bIAScoringConfig.findFirst({
      where: { isActive: true },
    });

    // If no config exists, create a default one
    if (!config) {
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

    const validTypes = ["High of all", "Addition of all", "Product of all"];
    if (!calculationType || !validTypes.includes(calculationType)) {
      return NextResponse.json(
        { error: "Invalid calculation type. Must be one of: High of all, Addition of all, Product of all" },
        { status: 400 }
      );
    }

    // Deactivate all existing configs
    await prisma.bIAScoringConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Create new active config
    const config = await prisma.bIAScoringConfig.create({
      data: {
        calculationType,
        isActive: true,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating BIA scoring config:", error);
    return NextResponse.json(
      { error: "Failed to update BIA scoring config" },
      { status: 500 }
    );
  }
}

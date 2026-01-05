import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET scoring config (singleton)
export async function GET() {
  try {
    let config = await prisma.auditScoringConfig.findFirst();

    // Create default config if none exists
    if (!config) {
      config = await prisma.auditScoringConfig.create({
        data: {
          probabilityImpactCalcType: "Product of all",
          riskRatingCalcType: "High of all",
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching scoring config:", error);
    return NextResponse.json(
      { error: "Failed to fetch scoring config" },
      { status: 500 }
    );
  }
}

// PUT update scoring config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { probabilityImpactCalcType, riskRatingCalcType } = body;

    let config = await prisma.auditScoringConfig.findFirst();

    if (!config) {
      // Create if doesn't exist
      config = await prisma.auditScoringConfig.create({
        data: {
          probabilityImpactCalcType: probabilityImpactCalcType || "Product of all",
          riskRatingCalcType: riskRatingCalcType || "High of all",
        },
      });
    } else {
      // Update existing
      config = await prisma.auditScoringConfig.update({
        where: { id: config.id },
        data: {
          ...(probabilityImpactCalcType !== undefined && { probabilityImpactCalcType }),
          ...(riskRatingCalcType !== undefined && { riskRatingCalcType }),
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating scoring config:", error);
    return NextResponse.json(
      { error: "Failed to update scoring config" },
      { status: 500 }
    );
  }
}

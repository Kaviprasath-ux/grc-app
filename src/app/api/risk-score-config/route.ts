import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET risk score configuration (there should only be one)
export async function GET() {
  try {
    let config = await prisma.riskScoreConfig.findFirst();

    // Create default config if none exists
    if (!config) {
      config = await prisma.riskScoreConfig.create({
        data: {
          useLikelihood: true,
          useImpact: true,
          useAssetScore: false,
          useVulnerabilityScore: true,
          riskTolerance: 10,
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching risk score config:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk score config" },
      { status: 500 }
    );
  }
}

// PUT update risk score configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { useLikelihood, useImpact, useAssetScore, useVulnerabilityScore, riskTolerance } = body;

    // Find existing config or create new one
    let config = await prisma.riskScoreConfig.findFirst();

    if (config) {
      config = await prisma.riskScoreConfig.update({
        where: { id: config.id },
        data: {
          useLikelihood: useLikelihood ?? true,
          useImpact: useImpact ?? true,
          useAssetScore: useAssetScore ?? false,
          useVulnerabilityScore: useVulnerabilityScore ?? true,
          riskTolerance: riskTolerance ?? 10,
        },
      });
    } else {
      config = await prisma.riskScoreConfig.create({
        data: {
          useLikelihood: useLikelihood ?? true,
          useImpact: useImpact ?? true,
          useAssetScore: useAssetScore ?? false,
          useVulnerabilityScore: useVulnerabilityScore ?? true,
          riskTolerance: riskTolerance ?? 10,
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating risk score config:", error);
    return NextResponse.json(
      { error: "Failed to update risk score config" },
      { status: 500 }
    );
  }
}

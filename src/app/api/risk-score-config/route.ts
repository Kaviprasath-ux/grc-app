import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET risk score configuration (returns the first/only config)
export async function GET() {
  try {
    let config = await prisma.riskScoreConfig.findFirst();

    // If no config exists, create default
    if (!config) {
      config = await prisma.riskScoreConfig.create({
        data: {
          useLikelihood: true,
          useImpact: true,
          useAssetScore: false,
          useVulnerabilityScore: false,
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

    // Get existing config or create one
    let config = await prisma.riskScoreConfig.findFirst();

    if (config) {
      config = await prisma.riskScoreConfig.update({
        where: { id: config.id },
        data: {
          useLikelihood: useLikelihood ?? config.useLikelihood,
          useImpact: useImpact ?? config.useImpact,
          useAssetScore: useAssetScore ?? config.useAssetScore,
          useVulnerabilityScore: useVulnerabilityScore ?? config.useVulnerabilityScore,
          riskTolerance: riskTolerance !== undefined ? parseInt(riskTolerance) : config.riskTolerance,
        },
      });
    } else {
      config = await prisma.riskScoreConfig.create({
        data: {
          useLikelihood: useLikelihood ?? true,
          useImpact: useImpact ?? true,
          useAssetScore: useAssetScore ?? false,
          useVulnerabilityScore: useVulnerabilityScore ?? false,
          riskTolerance: riskTolerance !== undefined ? parseInt(riskTolerance) : 10,
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

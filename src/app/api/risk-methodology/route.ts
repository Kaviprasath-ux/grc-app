import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET risk methodology (single record)
export async function GET() {
  try {
    // Get the first (and should be only) methodology record
    let methodology = await prisma.riskMethodology.findFirst();

    // If no methodology exists, create a default one
    if (!methodology) {
      methodology = await prisma.riskMethodology.create({
        data: {
          includeLikelihood: true,
          includeImpact: true,
          includeAssetScore: false,
          includeVulnerability: true,
          riskTolerance: 10,
        },
      });
    }

    return NextResponse.json(methodology);
  } catch (error) {
    console.error("Error fetching risk methodology:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk methodology" },
      { status: 500 }
    );
  }
}

// PUT update risk methodology
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { includeLikelihood, includeImpact, includeAssetScore, includeVulnerability, riskTolerance } = body;

    // Get existing methodology or create one
    let methodology = await prisma.riskMethodology.findFirst();

    if (!methodology) {
      methodology = await prisma.riskMethodology.create({
        data: {
          includeLikelihood: includeLikelihood ?? true,
          includeImpact: includeImpact ?? true,
          includeAssetScore: includeAssetScore ?? false,
          includeVulnerability: includeVulnerability ?? true,
          riskTolerance: riskTolerance !== undefined ? parseInt(riskTolerance) : 10,
        },
      });
    } else {
      methodology = await prisma.riskMethodology.update({
        where: { id: methodology.id },
        data: {
          includeLikelihood: includeLikelihood !== undefined ? includeLikelihood : methodology.includeLikelihood,
          includeImpact: includeImpact !== undefined ? includeImpact : methodology.includeImpact,
          includeAssetScore: includeAssetScore !== undefined ? includeAssetScore : methodology.includeAssetScore,
          includeVulnerability: includeVulnerability !== undefined ? includeVulnerability : methodology.includeVulnerability,
          riskTolerance: riskTolerance !== undefined ? parseInt(riskTolerance) : methodology.riskTolerance,
        },
      });
    }

    return NextResponse.json(methodology);
  } catch (error) {
    console.error("Error updating risk methodology:", error);
    return NextResponse.json(
      { error: "Failed to update risk methodology" },
      { status: 500 }
    );
  }
}

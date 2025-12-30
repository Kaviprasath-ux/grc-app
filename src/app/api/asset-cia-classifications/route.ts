import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all asset CIA classifications
export async function GET() {
  try {
    const classifications = await prisma.assetCIAClassification.findMany({
      include: {
        subCategory: {
          include: {
            category: true,
          },
        },
        group: true,
      },
      orderBy: [{ subCategory: { name: "asc" } }, { group: { name: "asc" } }],
    });
    return NextResponse.json(classifications);
  } catch (error) {
    console.error("Error fetching asset CIA classifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset CIA classifications" },
      { status: 500 }
    );
  }
}

// POST create new asset CIA classification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      subCategoryId,
      groupId,
      confidentiality,
      confidentialityScore,
      integrity,
      integrityScore,
      availability,
      availabilityScore,
      assetCriticality,
      assetCriticalityScore,
    } = body;

    if (!subCategoryId || !groupId) {
      return NextResponse.json(
        { error: "Sub-category and group are required" },
        { status: 400 }
      );
    }

    // Calculate criticality if not provided
    const scores = [
      confidentialityScore || 1,
      integrityScore || 1,
      availabilityScore || 0,
    ];
    const maxScore = Math.max(...scores);
    const calculatedCriticality =
      maxScore >= 10 ? "high" : maxScore >= 5 ? "medium" : "low";

    const classification = await prisma.assetCIAClassification.create({
      data: {
        subCategoryId,
        groupId,
        confidentiality: confidentiality || "low",
        confidentialityScore: confidentialityScore || 1,
        integrity: integrity || "low",
        integrityScore: integrityScore || 1,
        availability: availability || "low",
        availabilityScore: availabilityScore || 0,
        assetCriticality: assetCriticality || calculatedCriticality,
        assetCriticalityScore: assetCriticalityScore || maxScore,
      },
      include: {
        subCategory: {
          include: {
            category: true,
          },
        },
        group: true,
      },
    });

    return NextResponse.json(classification, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating asset CIA classification:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Classification for this sub-category and group already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create asset CIA classification" },
      { status: 500 }
    );
  }
}

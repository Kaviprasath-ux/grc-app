import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT update asset CIA classification
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Calculate criticality if not provided
    const scores = [
      confidentialityScore || 1,
      integrityScore || 1,
      availabilityScore || 0,
    ];
    const maxScore = Math.max(...scores);
    const calculatedCriticality =
      maxScore >= 10 ? "high" : maxScore >= 5 ? "medium" : "low";

    const classification = await prisma.assetCIAClassification.update({
      where: { id },
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

    return NextResponse.json(classification);
  } catch (error: unknown) {
    console.error("Error updating asset CIA classification:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Classification for this sub-category and group already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update asset CIA classification" },
      { status: 500 }
    );
  }
}

// DELETE asset CIA classification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.assetCIAClassification.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset CIA classification:", error);
    return NextResponse.json(
      { error: "Failed to delete asset CIA classification" },
      { status: 500 }
    );
  }
}

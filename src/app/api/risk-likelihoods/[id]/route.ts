import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT update risk likelihood
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, score, timeFrame, probability } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const likelihood = await prisma.riskLikelihood.update({
      where: { id },
      data: {
        title: title.trim(),
        score: score || 0,
        timeFrame: timeFrame?.trim() || null,
        probability: probability?.trim() || null,
      },
    });

    return NextResponse.json(likelihood);
  } catch (error: unknown) {
    console.error("Error updating risk likelihood:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Likelihood with this title already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update risk likelihood" },
      { status: 500 }
    );
  }
}

// DELETE risk likelihood
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.riskLikelihood.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting risk likelihood:", error);
    return NextResponse.json(
      { error: "Failed to delete risk likelihood" },
      { status: 500 }
    );
  }
}

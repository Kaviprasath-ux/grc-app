import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const likelihood = await prisma.riskLikelihood.update({
      where: { id },
      data: {
        title: title.trim(),
        score: parseInt(score) || 0,
        timeFrame: timeFrame?.trim() || null,
        probability: probability?.trim() || null,
      },
    });

    return NextResponse.json(likelihood);
  } catch (error: unknown) {
    console.error("Error updating risk likelihood:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Likelihood not found" }, { status: 404 });
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
    await prisma.riskLikelihood.delete({ where: { id } });
    return NextResponse.json({ message: "Likelihood deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting risk likelihood:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Likelihood not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to delete risk likelihood" },
      { status: 500 }
    );
  }
}

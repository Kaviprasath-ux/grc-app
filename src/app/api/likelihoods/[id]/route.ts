import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single likelihood
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const likelihood = await prisma.likelihood.findUnique({
      where: { id },
    });

    if (!likelihood) {
      return NextResponse.json(
        { error: "Likelihood not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(likelihood);
  } catch (error) {
    console.error("Error fetching likelihood:", error);
    return NextResponse.json(
      { error: "Failed to fetch likelihood" },
      { status: 500 }
    );
  }
}

// PUT update likelihood
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, score, timeFrame, probability } = body;

    const existing = await prisma.likelihood.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Likelihood not found" },
        { status: 404 }
      );
    }

    if (title && title !== existing.title) {
      const conflict = await prisma.likelihood.findUnique({
        where: { title },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Likelihood title already exists" },
          { status: 400 }
        );
      }
    }

    const likelihood = await prisma.likelihood.update({
      where: { id },
      data: {
        title: title || existing.title,
        score: score !== undefined ? parseInt(score) : existing.score,
        timeFrame: timeFrame !== undefined ? timeFrame : existing.timeFrame,
        probability: probability !== undefined ? probability : existing.probability,
      },
    });

    return NextResponse.json(likelihood);
  } catch (error) {
    console.error("Error updating likelihood:", error);
    return NextResponse.json(
      { error: "Failed to update likelihood" },
      { status: 500 }
    );
  }
}

// DELETE likelihood
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.likelihood.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Likelihood not found" },
        { status: 404 }
      );
    }

    await prisma.likelihood.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Likelihood deleted successfully" });
  } catch (error) {
    console.error("Error deleting likelihood:", error);
    return NextResponse.json(
      { error: "Failed to delete likelihood" },
      { status: 500 }
    );
  }
}

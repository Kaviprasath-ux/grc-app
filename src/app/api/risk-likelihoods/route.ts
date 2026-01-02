import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all risk likelihoods
export async function GET() {
  try {
    const likelihoods = await prisma.riskLikelihood.findMany({
      orderBy: { score: "asc" },
    });
    return NextResponse.json(likelihoods);
  } catch (error) {
    console.error("Error fetching risk likelihoods:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk likelihoods" },
      { status: 500 }
    );
  }
}

// POST create new risk likelihood
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, score, timeFrame, probability } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const likelihood = await prisma.riskLikelihood.create({
      data: {
        title: title.trim(),
        score: score || 0,
        timeFrame: timeFrame?.trim() || null,
        probability: probability?.trim() || null,
      },
    });

    return NextResponse.json(likelihood, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating risk likelihood:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Likelihood with this title already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create risk likelihood" },
      { status: 500 }
    );
  }
}

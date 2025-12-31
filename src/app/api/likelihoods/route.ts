import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all likelihoods
export async function GET() {
  try {
    const likelihoods = await prisma.likelihood.findMany({
      orderBy: { score: "asc" },
    });
    return NextResponse.json(likelihoods);
  } catch (error) {
    console.error("Error fetching likelihoods:", error);
    return NextResponse.json(
      { error: "Failed to fetch likelihoods" },
      { status: 500 }
    );
  }
}

// POST create new likelihood
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, score, timeFrame, probability } = body;

    if (!title || score === undefined) {
      return NextResponse.json(
        { error: "Title and score are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.likelihood.findUnique({
      where: { title },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Likelihood already exists" },
        { status: 400 }
      );
    }

    const likelihood = await prisma.likelihood.create({
      data: {
        title,
        score: parseInt(score),
        timeFrame: timeFrame || null,
        probability: probability || null,
      },
    });

    return NextResponse.json(likelihood, { status: 201 });
  } catch (error) {
    console.error("Error creating likelihood:", error);
    return NextResponse.json(
      { error: "Failed to create likelihood" },
      { status: 500 }
    );
  }
}

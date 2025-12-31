import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all control strengths
export async function GET() {
  try {
    const strengths = await prisma.controlStrength.findMany({
      orderBy: { score: "desc" },
    });
    return NextResponse.json(strengths);
  } catch (error) {
    console.error("Error fetching control strengths:", error);
    return NextResponse.json(
      { error: "Failed to fetch control strengths" },
      { status: 500 }
    );
  }
}

// POST create new control strength
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, score, description } = body;

    if (!name || score === undefined) {
      return NextResponse.json(
        { error: "Name and score are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.controlStrength.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Control strength already exists" },
        { status: 400 }
      );
    }

    const strength = await prisma.controlStrength.create({
      data: {
        name,
        score: parseInt(score),
        description: description || null,
      },
    });

    return NextResponse.json(strength, { status: 201 });
  } catch (error) {
    console.error("Error creating control strength:", error);
    return NextResponse.json(
      { error: "Failed to create control strength" },
      { status: 500 }
    );
  }
}

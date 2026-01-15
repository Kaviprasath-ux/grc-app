import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all control strengths
export async function GET() {
  try {
    const strengths = await prisma.controlStrength.findMany({
      orderBy: { score: "asc" },
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

// POST create control strength
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, score } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const strength = await prisma.controlStrength.create({
      data: {
        name: name.trim(),
        score: parseInt(score) || 0,
      },
    });

    return NextResponse.json(strength, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating control strength:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Control strength already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create control strength" },
      { status: 500 }
    );
  }
}

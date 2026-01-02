import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all impact ratings
export async function GET() {
  try {
    const ratings = await prisma.impactRating.findMany({
      orderBy: { score: "asc" },
    });
    return NextResponse.json(ratings);
  } catch (error) {
    console.error("Error fetching impact ratings:", error);
    return NextResponse.json(
      { error: "Failed to fetch impact ratings" },
      { status: 500 }
    );
  }
}

// POST create new impact rating
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, score, description } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const rating = await prisma.impactRating.create({
      data: {
        name: name.trim(),
        score: score || 0,
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(rating, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating impact rating:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Impact rating with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create impact rating" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all impact ratings
export async function GET() {
  try {
    const ratings = await prisma.impactRating.findMany({
      include: {
        category: true,
      },
      orderBy: { score: "desc" },
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
    const { name, score, description, categoryId } = body;

    if (!name || score === undefined) {
      return NextResponse.json(
        { error: "Name and score are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.impactRating.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Impact rating already exists" },
        { status: 400 }
      );
    }

    const rating = await prisma.impactRating.create({
      data: {
        name,
        score: parseInt(score),
        description: description || null,
        categoryId: categoryId || null,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(rating, { status: 201 });
  } catch (error) {
    console.error("Error creating impact rating:", error);
    return NextResponse.json(
      { error: "Failed to create impact rating" },
      { status: 500 }
    );
  }
}

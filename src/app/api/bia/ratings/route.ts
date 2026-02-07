import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all BIA ratings
export async function GET() {
  try {
    const ratings = await prisma.bIARating.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(ratings);
  } catch (error) {
    console.error("Error fetching BIA ratings:", error);
    return NextResponse.json(
      { error: "Failed to fetch BIA ratings" },
      { status: 500 }
    );
  }
}

// POST create new BIA rating
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { label, score, description, color, sortOrder, isActive } = body;

    if (!label?.trim()) {
      return NextResponse.json(
        { error: "Rating label is required" },
        { status: 400 }
      );
    }

    const rating = await prisma.bIARating.create({
      data: {
        label: label.trim(),
        score: score ?? 0,
        description: description?.trim() || null,
        color: color?.trim() || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(rating, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating BIA rating:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Rating with this label already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create BIA rating" },
      { status: 500 }
    );
  }
}

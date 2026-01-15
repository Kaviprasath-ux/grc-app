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
    const { label, score, description, color, sortOrder } = body;

    if (!label) {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    // Get the max sortOrder if not provided
    let order = sortOrder;
    if (order === undefined) {
      const maxOrder = await prisma.bIARating.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      order = (maxOrder?.sortOrder ?? -1) + 1;
    }

    const rating = await prisma.bIARating.create({
      data: {
        label,
        score: score ?? 0,
        description,
        color,
        sortOrder: order,
        isActive: true,
      },
    });

    return NextResponse.json(rating, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating BIA rating:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "A rating with this label already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create BIA rating" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all BIA scoring ranges
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const calculationType = searchParams.get("calculationType");

    const whereClause = calculationType
      ? { calculationType }
      : {};

    const ranges = await prisma.bIAScoringRange.findMany({
      where: whereClause,
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(ranges);
  } catch (error) {
    console.error("Error fetching BIA scoring ranges:", error);
    return NextResponse.json(
      { error: "Failed to fetch BIA scoring ranges" },
      { status: 500 }
    );
  }
}

// POST create new BIA scoring range
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { label, lowValue, highValue, color, calculationType, sortOrder } = body;

    if (!label) {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    // Get the max sortOrder if not provided
    let order = sortOrder;
    if (order === undefined) {
      const maxOrder = await prisma.bIAScoringRange.findFirst({
        where: { calculationType: calculationType || "High of all" },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      order = (maxOrder?.sortOrder ?? -1) + 1;
    }

    const range = await prisma.bIAScoringRange.create({
      data: {
        label,
        lowValue: lowValue ?? 0,
        highValue,
        color,
        calculationType: calculationType || "High of all",
        sortOrder: order,
      },
    });

    return NextResponse.json(range, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating BIA scoring range:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "A range with this label and calculation type already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create BIA scoring range" },
      { status: 500 }
    );
  }
}

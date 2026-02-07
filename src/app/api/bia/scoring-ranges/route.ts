import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all BIA scoring ranges
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const calculationType = searchParams.get("calculationType") || "High of all";

    const ranges = await prisma.bIAScoringRange.findMany({
      where: { calculationType },
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

    if (!label?.trim()) {
      return NextResponse.json(
        { error: "Range label is required" },
        { status: 400 }
      );
    }

    const range = await prisma.bIAScoringRange.create({
      data: {
        label: label.trim(),
        lowValue: lowValue ?? 0,
        highValue: highValue ?? null,
        color: color?.trim() || null,
        calculationType: calculationType || "High of all",
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json(range, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating BIA scoring range:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Range with this label and calculation type already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create BIA scoring range" },
      { status: 500 }
    );
  }
}

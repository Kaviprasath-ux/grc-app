import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all risk ranges
export async function GET() {
  try {
    const ranges = await prisma.riskRange.findMany({
      orderBy: { lowRange: "asc" },
    });
    return NextResponse.json(ranges);
  } catch (error) {
    console.error("Error fetching risk ranges:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk ranges" },
      { status: 500 }
    );
  }
}

// POST create new risk range
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, color, lowRange, highRange, timelineDays, description } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const range = await prisma.riskRange.create({
      data: {
        title: title.trim(),
        color: color?.trim() || null,
        lowRange: lowRange || 0,
        highRange: highRange || 0,
        timelineDays: timelineDays || 0,
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(range, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating risk range:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Risk range with this title already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create risk range" },
      { status: 500 }
    );
  }
}

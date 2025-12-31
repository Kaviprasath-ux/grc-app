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
    const { title, color, lowRange, highRange, description } = body;

    if (!title || !color || lowRange === undefined || highRange === undefined) {
      return NextResponse.json(
        { error: "Title, color, low range, and high range are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.riskRange.findUnique({
      where: { title },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Risk range already exists" },
        { status: 400 }
      );
    }

    const range = await prisma.riskRange.create({
      data: {
        title,
        color,
        lowRange: parseInt(lowRange),
        highRange: parseInt(highRange),
        description: description || null,
      },
    });

    return NextResponse.json(range, { status: 201 });
  } catch (error) {
    console.error("Error creating risk range:", error);
    return NextResponse.json(
      { error: "Failed to create risk range" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all scoring ranges
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const calculationType = searchParams.get("calculationType");

    const where = calculationType ? { calculationType } : {};

    const ranges = await prisma.auditScoringRange.findMany({
      where,
      orderBy: { lowValue: "asc" },
    });

    return NextResponse.json(ranges);
  } catch (error) {
    console.error("Error fetching scoring ranges:", error);
    return NextResponse.json(
      { error: "Failed to fetch scoring ranges" },
      { status: 500 }
    );
  }
}

// POST create a new scoring range
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { label, lowValue, highValue, calculationType } = body;

    if (!label) {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    // Check for duplicate label within same calculation type
    const existing = await prisma.auditScoringRange.findFirst({
      where: {
        label,
        calculationType: calculationType || "High of all"
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Scoring range with this label already exists for this calculation type" },
        { status: 400 }
      );
    }

    const range = await prisma.auditScoringRange.create({
      data: {
        label,
        lowValue: lowValue || 0,
        highValue: highValue || null,
        calculationType: calculationType || "High of all",
      },
    });

    return NextResponse.json(range, { status: 201 });
  } catch (error) {
    console.error("Error creating scoring range:", error);
    return NextResponse.json(
      { error: "Failed to create scoring range" },
      { status: 500 }
    );
  }
}

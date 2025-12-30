import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all CIA ratings
export async function GET() {
  try {
    const ratings = await prisma.cIARating.findMany({
      orderBy: [{ type: "asc" }, { value: "desc" }],
    });
    return NextResponse.json(ratings);
  } catch (error) {
    console.error("Error fetching CIA ratings:", error);
    return NextResponse.json(
      { error: "Failed to fetch CIA ratings" },
      { status: 500 }
    );
  }
}

// POST create new CIA rating
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, label, value } = body;

    if (!type?.trim() || !label?.trim()) {
      return NextResponse.json(
        { error: "Type and label are required" },
        { status: 400 }
      );
    }

    if (typeof value !== "number") {
      return NextResponse.json(
        { error: "Value must be a number" },
        { status: 400 }
      );
    }

    const rating = await prisma.cIARating.create({
      data: {
        type: type.trim(),
        label: label.trim().toLowerCase(),
        value,
      },
    });

    return NextResponse.json(rating, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating CIA rating:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Rating with this type and label already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create CIA rating" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all BCP labels
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // RTO or RPO

    const where = type ? { type } : {};

    const labels = await prisma.bCPLabel.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(labels);
  } catch (error) {
    console.error("Error fetching BCP labels:", error);
    return NextResponse.json(
      { error: "Failed to fetch BCP labels" },
      { status: 500 }
    );
  }
}

// POST create new BCP label
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, hours, description, sortOrder, isActive } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Label name is required" },
        { status: 400 }
      );
    }

    if (!type || !["RTO", "RPO"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be either RTO or RPO" },
        { status: 400 }
      );
    }

    const label = await prisma.bCPLabel.create({
      data: {
        name: name.trim(),
        type,
        hours: hours ?? 0,
        description: description?.trim() || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(label, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating BCP label:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Label with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create BCP label" },
      { status: 500 }
    );
  }
}

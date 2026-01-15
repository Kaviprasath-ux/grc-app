import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all BCP labels
export async function GET() {
  try {
    const labels = await prisma.bCPLabel.findMany({
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
    const { name, type, hours, description, sortOrder } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Get the max sortOrder if not provided
    let order = sortOrder;
    if (order === undefined) {
      const maxOrder = await prisma.bCPLabel.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      order = (maxOrder?.sortOrder ?? -1) + 1;
    }

    const label = await prisma.bCPLabel.create({
      data: {
        name,
        type: type || "RTO",
        hours: hours ?? 0,
        description,
        sortOrder: order,
        isActive: true,
      },
    });

    return NextResponse.json(label, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating BCP label:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "A label with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create BCP label" },
      { status: 500 }
    );
  }
}

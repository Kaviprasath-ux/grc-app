import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all BIA categories
export async function GET() {
  try {
    const categories = await prisma.bIACategory.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching BIA categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch BIA categories" },
      { status: 500 }
    );
  }
}

// POST create new BIA category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, sortOrder } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Get the max sortOrder if not provided
    let order = sortOrder;
    if (order === undefined) {
      const maxOrder = await prisma.bIACategory.findFirst({
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      order = (maxOrder?.sortOrder ?? -1) + 1;
    }

    const category = await prisma.bIACategory.create({
      data: {
        name,
        description,
        sortOrder: order,
        isActive: true,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating BIA category:", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "A category with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create BIA category" },
      { status: 500 }
    );
  }
}

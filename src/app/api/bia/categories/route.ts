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
    const { name, description, sortOrder, isActive } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const category = await prisma.bIACategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating BIA category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create BIA category" },
      { status: 500 }
    );
  }
}

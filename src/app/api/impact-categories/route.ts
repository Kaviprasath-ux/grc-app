import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all impact categories
export async function GET() {
  try {
    const categories = await prisma.impactCategory.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching impact categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch impact categories" },
      { status: 500 }
    );
  }
}

// POST create new impact category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const category = await prisma.impactCategory.create({
      data: {
        name: name.trim(),
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating impact category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create impact category" },
      { status: 500 }
    );
  }
}

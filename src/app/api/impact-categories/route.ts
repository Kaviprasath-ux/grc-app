import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all impact categories
export async function GET() {
  try {
    const categories = await prisma.impactCategory.findMany({
      include: {
        _count: {
          select: { impactRatings: true },
        },
      },
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

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.impactCategory.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Impact category already exists" },
        { status: 400 }
      );
    }

    const category = await prisma.impactCategory.create({
      data: {
        name,
      },
      include: {
        _count: {
          select: { impactRatings: true },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating impact category:", error);
    return NextResponse.json(
      { error: "Failed to create impact category" },
      { status: 500 }
    );
  }
}

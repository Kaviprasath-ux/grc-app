import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all threat categories
export async function GET() {
  try {
    const categories = await prisma.threatCategory.findMany({
      include: {
        _count: {
          select: { threats: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching threat categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch threat categories" },
      { status: 500 }
    );
  }
}

// POST create new threat category
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

    const category = await prisma.threatCategory.create({
      data: {
        name: name.trim(),
      },
      include: {
        _count: {
          select: { threats: true },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating threat category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create threat category" },
      { status: 500 }
    );
  }
}

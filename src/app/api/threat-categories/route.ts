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
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.threatCategory.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Threat category already exists" },
        { status: 400 }
      );
    }

    const category = await prisma.threatCategory.create({
      data: {
        name,
        description: description || null,
      },
      include: {
        _count: {
          select: { threats: true },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating threat category:", error);
    return NextResponse.json(
      { error: "Failed to create threat category" },
      { status: 500 }
    );
  }
}

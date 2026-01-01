import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all risk categories
export async function GET() {
  try {
    const categories = await prisma.riskCategory.findMany({
      include: {
        _count: {
          select: { risks: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching risk categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk categories" },
      { status: 500 }
    );
  }
}

// POST create a new risk category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.riskCategory.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }

    const category = await prisma.riskCategory.create({
      data: {
        name,
        description,
        color,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating risk category:", error);
    return NextResponse.json(
      { error: "Failed to create risk category" },
      { status: 500 }
    );
  }
}

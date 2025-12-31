import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all risk sub-categories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;

    const subCategories = await prisma.riskSubCategory.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(subCategories);
  } catch (error) {
    console.error("Error fetching risk sub-categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk sub-categories" },
      { status: 500 }
    );
  }
}

// POST create new risk sub-category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, categoryId, status } = body;

    if (!name || !categoryId) {
      return NextResponse.json(
        { error: "Name and category are required" },
        { status: 400 }
      );
    }

    // Check for duplicate within category
    const existing = await prisma.riskSubCategory.findFirst({
      where: {
        name,
        categoryId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Sub-category already exists in this category" },
        { status: 400 }
      );
    }

    const subCategory = await prisma.riskSubCategory.create({
      data: {
        name,
        description: description || null,
        categoryId,
        status: status || "Active",
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(subCategory, { status: 201 });
  } catch (error) {
    console.error("Error creating risk sub-category:", error);
    return NextResponse.json(
      { error: "Failed to create risk sub-category" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all asset sub-categories
export async function GET() {
  try {
    const subCategories = await prisma.assetSubCategory.findMany({
      include: {
        category: true,
        _count: {
          select: { assets: true },
        },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });
    return NextResponse.json(subCategories);
  } catch (error) {
    console.error("Error fetching asset sub-categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset sub-categories" },
      { status: 500 }
    );
  }
}

// POST create new asset sub-category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, categoryId, status } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Sub-category name is required" },
        { status: 400 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 }
      );
    }

    const subCategory = await prisma.assetSubCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        categoryId,
        status: status || "Active",
      },
      include: {
        category: true,
        _count: {
          select: { assets: true },
        },
      },
    });

    return NextResponse.json(subCategory, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating asset sub-category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Sub-category with this name already exists in this category" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create asset sub-category" },
      { status: 500 }
    );
  }
}

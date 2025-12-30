import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all asset categories
export async function GET() {
  try {
    const categories = await prisma.assetCategory.findMany({
      include: {
        subCategories: true,
        _count: {
          select: { assets: true, subCategories: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching asset categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset categories" },
      { status: 500 }
    );
  }
}

// POST create new asset category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, status } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const category = await prisma.assetCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        status: status || "Active",
      },
      include: {
        subCategories: true,
        _count: {
          select: { assets: true, subCategories: true },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating asset category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create asset category" },
      { status: 500 }
    );
  }
}

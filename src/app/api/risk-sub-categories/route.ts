import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all risk sub categories
export async function GET() {
  try {
    const subCategories = await prisma.riskSubCategory.findMany({
      orderBy: { type: "asc" },
    });
    return NextResponse.json(subCategories);
  } catch (error) {
    console.error("Error fetching risk sub categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk sub categories" },
      { status: 500 }
    );
  }
}

// POST create new risk sub category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    if (!type?.trim()) {
      return NextResponse.json(
        { error: "Type is required" },
        { status: 400 }
      );
    }

    const subCategory = await prisma.riskSubCategory.create({
      data: {
        type: type.trim(),
      },
    });

    return NextResponse.json(subCategory, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating risk sub category:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Sub category with this type already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create risk sub category" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all asset classifications
export async function GET() {
  try {
    const classifications = await prisma.assetClassification.findMany({
      include: {
        _count: {
          select: { assets: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(classifications);
  } catch (error) {
    console.error("Error fetching asset classifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset classifications" },
      { status: 500 }
    );
  }
}

// POST create new asset classification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Classification name is required" },
        { status: 400 }
      );
    }

    // Check if classification already exists
    const existingClassification = await prisma.assetClassification.findUnique({
      where: { name },
    });

    if (existingClassification) {
      return NextResponse.json(
        { error: "Classification already exists" },
        { status: 400 }
      );
    }

    const classification = await prisma.assetClassification.create({
      data: {
        name,
        description,
      },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    return NextResponse.json(classification, { status: 201 });
  } catch (error) {
    console.error("Error creating asset classification:", error);
    return NextResponse.json(
      { error: "Failed to create asset classification" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all asset sensitivities
export async function GET() {
  try {
    const sensitivities = await prisma.assetSensitivity.findMany({
      include: {
        _count: {
          select: { assets: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(sensitivities);
  } catch (error) {
    console.error("Error fetching asset sensitivities:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset sensitivities" },
      { status: 500 }
    );
  }
}

// POST create new asset sensitivity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Sensitivity name is required" },
        { status: 400 }
      );
    }

    const sensitivity = await prisma.assetSensitivity.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    return NextResponse.json(sensitivity, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating asset sensitivity:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Sensitivity with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create asset sensitivity" },
      { status: 500 }
    );
  }
}

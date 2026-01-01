import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all risk types
export async function GET() {
  try {
    const types = await prisma.riskType.findMany({
      include: {
        _count: {
          select: { risks: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(types);
  } catch (error) {
    console.error("Error fetching risk types:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk types" },
      { status: 500 }
    );
  }
}

// POST create a new risk type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Type name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.riskType.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Type with this name already exists" },
        { status: 400 }
      );
    }

    const type = await prisma.riskType.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(type, { status: 201 });
  } catch (error) {
    console.error("Error creating risk type:", error);
    return NextResponse.json(
      { error: "Failed to create risk type" },
      { status: 500 }
    );
  }
}

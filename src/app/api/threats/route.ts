import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all threats
export async function GET() {
  try {
    const threats = await prisma.threat.findMany({
      include: {
        category: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(threats);
  } catch (error) {
    console.error("Error fetching threats:", error);
    return NextResponse.json(
      { error: "Failed to fetch threats" },
      { status: 500 }
    );
  }
}

// POST create new threat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, categoryId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Threat name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.threat.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Threat already exists" },
        { status: 400 }
      );
    }

    const threat = await prisma.threat.create({
      data: {
        name,
        description: description || null,
        categoryId: categoryId || null,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(threat, { status: 201 });
  } catch (error) {
    console.error("Error creating threat:", error);
    return NextResponse.json(
      { error: "Failed to create threat" },
      { status: 500 }
    );
  }
}

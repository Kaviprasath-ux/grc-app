import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all risk threats
export async function GET() {
  try {
    const threats = await prisma.riskThreat.findMany({
      include: {
        _count: {
          select: { risks: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(threats);
  } catch (error) {
    console.error("Error fetching risk threats:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk threats" },
      { status: 500 }
    );
  }
}

// POST create a new risk threat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Threat name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.riskThreat.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Threat with this name already exists" },
        { status: 400 }
      );
    }

    const threat = await prisma.riskThreat.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(threat, { status: 201 });
  } catch (error) {
    console.error("Error creating risk threat:", error);
    return NextResponse.json(
      { error: "Failed to create risk threat" },
      { status: 500 }
    );
  }
}

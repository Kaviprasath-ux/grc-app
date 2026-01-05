import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all impacts
export async function GET() {
  try {
    const impacts = await prisma.auditImpact.findMany({
      orderBy: { value: "asc" },
    });

    return NextResponse.json(impacts);
  } catch (error) {
    console.error("Error fetching impacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch impacts" },
      { status: 500 }
    );
  }
}

// POST create a new impact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { label, value } = body;

    if (!label) {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    // Check for duplicate label
    const existing = await prisma.auditImpact.findUnique({
      where: { label },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Impact with this label already exists" },
        { status: 400 }
      );
    }

    const impact = await prisma.auditImpact.create({
      data: { label, value: value || 0 },
    });

    return NextResponse.json(impact, { status: 201 });
  } catch (error) {
    console.error("Error creating impact:", error);
    return NextResponse.json(
      { error: "Failed to create impact" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all probabilities
export async function GET() {
  try {
    const probabilities = await prisma.auditProbability.findMany({
      orderBy: { value: "asc" },
    });

    return NextResponse.json(probabilities);
  } catch (error) {
    console.error("Error fetching probabilities:", error);
    return NextResponse.json(
      { error: "Failed to fetch probabilities" },
      { status: 500 }
    );
  }
}

// POST create a new probability
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
    const existing = await prisma.auditProbability.findUnique({
      where: { label },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Probability with this label already exists" },
        { status: 400 }
      );
    }

    const probability = await prisma.auditProbability.create({
      data: { label, value: value || 0 },
    });

    return NextResponse.json(probability, { status: 201 });
  } catch (error) {
    console.error("Error creating probability:", error);
    return NextResponse.json(
      { error: "Failed to create probability" },
      { status: 500 }
    );
  }
}

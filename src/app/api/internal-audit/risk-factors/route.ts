import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all risk factors
export async function GET() {
  try {
    const factors = await prisma.auditRiskFactor.findMany({
      orderBy: { label: "asc" },
    });

    return NextResponse.json(factors);
  } catch (error) {
    console.error("Error fetching risk factors:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk factors" },
      { status: 500 }
    );
  }
}

// POST create a new risk factor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { label } = body;

    if (!label) {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.auditRiskFactor.findUnique({
      where: { label },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Risk factor with this label already exists" },
        { status: 400 }
      );
    }

    const factor = await prisma.auditRiskFactor.create({
      data: { label },
    });

    return NextResponse.json(factor, { status: 201 });
  } catch (error) {
    console.error("Error creating risk factor:", error);
    return NextResponse.json(
      { error: "Failed to create risk factor" },
      { status: 500 }
    );
  }
}

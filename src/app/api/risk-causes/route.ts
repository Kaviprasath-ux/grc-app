import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all risk causes
export async function GET() {
  try {
    const causes = await prisma.riskCause.findMany({
      include: {
        _count: {
          select: { risks: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(causes);
  } catch (error) {
    console.error("Error fetching risk causes:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk causes" },
      { status: 500 }
    );
  }
}

// POST create a new risk cause
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Cause name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.riskCause.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Cause with this name already exists" },
        { status: 400 }
      );
    }

    const cause = await prisma.riskCause.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(cause, { status: 201 });
  } catch (error) {
    console.error("Error creating risk cause:", error);
    return NextResponse.json(
      { error: "Failed to create risk cause" },
      { status: 500 }
    );
  }
}

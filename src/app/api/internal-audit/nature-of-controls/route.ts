import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all nature of controls
export async function GET() {
  try {
    const controls = await prisma.auditNatureOfControl.findMany({
      orderBy: { label: "asc" },
    });

    return NextResponse.json(controls);
  } catch (error) {
    console.error("Error fetching nature of controls:", error);
    return NextResponse.json(
      { error: "Failed to fetch nature of controls" },
      { status: 500 }
    );
  }
}

// POST create a new nature of control
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

    // Check for duplicate
    const existing = await prisma.auditNatureOfControl.findUnique({
      where: { label },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Nature of control with this label already exists" },
        { status: 400 }
      );
    }

    const control = await prisma.auditNatureOfControl.create({
      data: { label },
    });

    return NextResponse.json(control, { status: 201 });
  } catch (error) {
    console.error("Error creating nature of control:", error);
    return NextResponse.json(
      { error: "Failed to create nature of control" },
      { status: 500 }
    );
  }
}

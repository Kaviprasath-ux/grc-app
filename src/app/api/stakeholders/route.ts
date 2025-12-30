import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all stakeholders
export async function GET() {
  try {
    const stakeholders = await prisma.stakeholder.findMany({
      include: {
        department: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(stakeholders);
  } catch (error) {
    console.error("Error fetching stakeholders:", error);
    return NextResponse.json(
      { error: "Failed to fetch stakeholders" },
      { status: 500 }
    );
  }
}

// POST create new stakeholder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, type, status, departmentId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Stakeholder name is required" },
        { status: 400 }
      );
    }

    const stakeholder = await prisma.stakeholder.create({
      data: {
        name,
        email,
        type: type || "Internal",
        status: status || "Active",
        departmentId,
      },
      include: {
        department: true,
      },
    });

    return NextResponse.json(stakeholder, { status: 201 });
  } catch (error) {
    console.error("Error creating stakeholder:", error);
    return NextResponse.json(
      { error: "Failed to create stakeholder" },
      { status: 500 }
    );
  }
}

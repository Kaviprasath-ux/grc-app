import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all departments
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { users: true, issues: true, stakeholders: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json(
      { error: "Failed to fetch departments" },
      { status: 500 }
    );
  }
}

// POST create new department
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: { name },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating department:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Department with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create department" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET all vulnerabilities
export async function GET() {
  try {
    const vulnerabilities = await prisma.vulnerability.findMany({
      include: {
        category: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(vulnerabilities);
  } catch (error) {
    console.error("Error fetching vulnerabilities:", error);
    return NextResponse.json(
      { error: "Failed to fetch vulnerabilities" },
      { status: 500 }
    );
  }
}

// POST create new vulnerability
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, categoryId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Vulnerability name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.vulnerability.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Vulnerability already exists" },
        { status: 400 }
      );
    }

    const vulnerability = await prisma.vulnerability.create({
      data: {
        name,
        description: description || null,
        categoryId: categoryId || null,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(vulnerability, { status: 201 });
  } catch (error) {
    console.error("Error creating vulnerability:", error);
    return NextResponse.json(
      { error: "Failed to create vulnerability" },
      { status: 500 }
    );
  }
}

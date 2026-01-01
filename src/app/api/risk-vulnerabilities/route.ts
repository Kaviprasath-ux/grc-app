import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all risk vulnerabilities
export async function GET() {
  try {
    const vulnerabilities = await prisma.riskVulnerability.findMany({
      include: {
        _count: {
          select: { risks: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(vulnerabilities);
  } catch (error) {
    console.error("Error fetching risk vulnerabilities:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk vulnerabilities" },
      { status: 500 }
    );
  }
}

// POST create a new risk vulnerability
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Vulnerability name is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.riskVulnerability.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Vulnerability with this name already exists" },
        { status: 400 }
      );
    }

    const vulnerability = await prisma.riskVulnerability.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(vulnerability, { status: 201 });
  } catch (error) {
    console.error("Error creating risk vulnerability:", error);
    return NextResponse.json(
      { error: "Failed to create risk vulnerability" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Default risk types that should always exist
const DEFAULT_RISK_TYPES = [
  { name: "Asset Risk", description: "Risk associated with impacted assets from Asset Inventory" },
  { name: "Process Risk", description: "Risk associated with impacted processes from Process Repository" },
];

// GET all risk types
// Note: RiskType model doesn't have customerAccountId field yet - tenant filtering disabled
export async function GET() {
  try {
    let types = await prisma.riskType.findMany({
      include: {
        _count: {
          select: { risks: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Auto-create default risk types if none exist
    if (types.length === 0) {
      for (const rt of DEFAULT_RISK_TYPES) {
        await prisma.riskType.create({ data: rt });
      }
      types = await prisma.riskType.findMany({
        include: { _count: { select: { risks: true } } },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json(types);
  } catch (error) {
    console.error("Error fetching risk types:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk types" },
      { status: 500 }
    );
  }
}

// POST create a new risk type
// Note: RiskType model doesn't have customerAccountId field yet - tenant assignment disabled
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Type name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.riskType.findFirst({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Type with this name already exists" },
        { status: 400 }
      );
    }

    const type = await prisma.riskType.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(type, { status: 201 });
  } catch (error) {
    console.error("Error creating risk type:", error);
    return NextResponse.json(
      { error: "Failed to create risk type" },
      { status: 500 }
    );
  }
}

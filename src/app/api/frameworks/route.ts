import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all frameworks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const frameworks = await prisma.framework.findMany({
      where,
      include: {
        _count: {
          select: { controls: true, evidences: true, requirements: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(frameworks);
  } catch (error) {
    console.error("Error fetching frameworks:", error);
    return NextResponse.json(
      { error: "Failed to fetch frameworks" },
      { status: 500 }
    );
  }
}

// POST create new framework
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      version,
      type,
      status,
      country,
      industry,
      isCustom,
      logo,
      supportDocumentUrl,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Framework name is required" },
        { status: 400 }
      );
    }

    const framework = await prisma.framework.create({
      data: {
        name,
        description,
        version,
        type: type || "Framework",
        status: status || "Subscribed",
        country,
        industry,
        isCustom: isCustom || false,
        logo,
        supportDocumentUrl,
        compliancePercentage: 0,
        policyPercentage: 0,
        evidencePercentage: 0,
      },
    });

    return NextResponse.json(framework, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating framework:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Framework with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create framework" },
      { status: 500 }
    );
  }
}

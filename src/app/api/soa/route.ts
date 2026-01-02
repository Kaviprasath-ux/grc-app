import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all SOA entries (requirements with SOA fields) with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const frameworkId = searchParams.get("frameworkId");
    const applicability = searchParams.get("applicability");
    const implementationStatus = searchParams.get("implementationStatus");

    const where: Record<string, unknown> = {};
    if (frameworkId) where.frameworkId = frameworkId;
    if (applicability) where.applicability = applicability;
    if (implementationStatus) where.implementationStatus = implementationStatus;

    const soaEntries = await prisma.requirement.findMany({
      where,
      include: {
        framework: true,
        controls: {
          include: {
            control: {
              include: {
                domain: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });

    return NextResponse.json(soaEntries);
  } catch (error) {
    console.error("Error fetching SOA entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch SOA entries" },
      { status: 500 }
    );
  }
}

// PUT update SOA fields for a requirement
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      applicability,
      justification,
      implementationStatus,
      controlCompliance,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Requirement ID is required" },
        { status: 400 }
      );
    }

    const soaEntry = await prisma.requirement.update({
      where: { id },
      data: {
        applicability,
        justification,
        implementationStatus,
        controlCompliance,
      },
      include: {
        framework: true,
        controls: {
          include: {
            control: true,
          },
        },
      },
    });

    return NextResponse.json(soaEntry);
  } catch (error) {
    console.error("Error updating SOA entry:", error);
    return NextResponse.json(
      { error: "Failed to update SOA entry" },
      { status: 500 }
    );
  }
}

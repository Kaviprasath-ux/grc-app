import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all asset classifications
export async function GET() {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;
    const tenantFilter = !isGRCAdmin && customerAccountId ? { customerAccountId } : {};

    const classifications = await prisma.assetClassification.findMany({
      where: tenantFilter,
      include: {
        _count: {
          select: { assets: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(classifications);
  } catch (error) {
    console.error("Error fetching asset classifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset classifications" },
      { status: 500 }
    );
  }
}

// POST create new asset classification
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const customerAccountId = session?.user?.customerAccountId;

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Classification name is required" },
        { status: 400 }
      );
    }

    // Check if classification already exists within the same tenant
    const existingClassification = await prisma.assetClassification.findFirst({
      where: {
        name,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    if (existingClassification) {
      return NextResponse.json(
        { error: "Classification already exists" },
        { status: 400 }
      );
    }

    const classification = await prisma.assetClassification.create({
      data: {
        name,
        description,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    return NextResponse.json(classification, { status: 201 });
  } catch (error) {
    console.error("Error creating asset classification:", error);
    return NextResponse.json(
      { error: "Failed to create asset classification" },
      { status: 500 }
    );
  }
}

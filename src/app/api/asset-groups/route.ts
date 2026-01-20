import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all asset groups
export async function GET() {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;
    const tenantFilter = !isGRCAdmin && customerAccountId ? { customerAccountId } : {};

    const groups = await prisma.assetGroup.findMany({
      where: tenantFilter,
      include: {
        _count: {
          select: { assets: true, assetCIAClassifications: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error fetching asset groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch asset groups" },
      { status: 500 }
    );
  }
}

// POST create new asset group
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const customerAccountId = session?.user?.customerAccountId;

    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate within the same tenant
    const existing = await prisma.assetGroup.findFirst({
      where: {
        name: name.trim(),
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Group with this name already exists" },
        { status: 400 }
      );
    }

    const group = await prisma.assetGroup.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
      include: {
        _count: {
          select: { assets: true, assetCIAClassifications: true },
        },
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating asset group:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Group with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create asset group" },
      { status: 500 }
    );
  }
}

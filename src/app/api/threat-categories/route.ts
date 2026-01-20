import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all threat categories
export async function GET() {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;
    const tenantFilter = !isGRCAdmin && customerAccountId ? { customerAccountId } : {};

    const categories = await prisma.threatCategory.findMany({
      where: tenantFilter,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { threats: true },
        },
      },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching threat categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch threat categories" },
      { status: 500 }
    );
  }
}

// POST create threat category
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const customerAccountId = session?.user?.customerAccountId;

    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate within the same tenant
    const existing = await prisma.threatCategory.findFirst({
      where: {
        name: name.trim(),
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 409 }
      );
    }

    const category = await prisma.threatCategory.create({
      data: {
        name: name.trim(),
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating threat category:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create threat category" },
      { status: 500 }
    );
  }
}

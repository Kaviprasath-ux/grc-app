import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all risk categories (filtered by tenant)
export async function GET() {
  try {
    const session = await auth();

    // Multi-tenant: Build filter based on customerAccountId
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;

    // Build tenant filter: show customer-specific OR shared (null) data
    const tenantFilter = !isGRCAdmin && customerAccountId
      ? { OR: [{ customerAccountId }, { customerAccountId: null }] }
      : {};

    const categories = await prisma.riskCategory.findMany({
      where: tenantFilter,
      include: {
        _count: {
          select: { risks: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching risk categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk categories" },
      { status: 500 }
    );
  }
}

// POST create a new risk category (with tenant assignment)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const customerAccountId = session?.user?.customerAccountId;

    const body = await request.json();
    const { name, description, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate within tenant
    const existing = await prisma.riskCategory.findFirst({
      where: {
        customerAccountId: customerAccountId || null,
        name,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }

    const category = await prisma.riskCategory.create({
      data: {
        customerAccountId,
        name,
        description,
        color,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Error creating risk category:", error);
    return NextResponse.json(
      { error: "Failed to create risk category" },
      { status: 500 }
    );
  }
}

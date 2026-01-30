import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all control strengths - filtered by tenant
export async function GET() {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;

    // Build tenant filter: show only customer-specific data (strict isolation)
    const tenantFilter = !isGRCAdmin && customerAccountId
      ? { customerAccountId }
      : {};

    const strengths = await prisma.controlStrength.findMany({
      where: tenantFilter,
      orderBy: { score: "asc" },
    });
    return NextResponse.json(strengths);
  } catch (error) {
    console.error("Error fetching control strengths:", error);
    return NextResponse.json(
      { error: "Failed to fetch control strengths" },
      { status: 500 }
    );
  }
}

// POST create control strength - with tenant assignment
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const customerAccountId = session?.user?.customerAccountId;

    const body = await request.json();
    const { name, score } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate within the same tenant
    const existing = await prisma.controlStrength.findFirst({
      where: {
        name: name.trim(),
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Control strength already exists" },
        { status: 409 }
      );
    }

    const strength = await prisma.controlStrength.create({
      data: {
        name: name.trim(),
        score: parseInt(score) || 0,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    return NextResponse.json(strength, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating control strength:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Control strength already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create control strength" },
      { status: 500 }
    );
  }
}

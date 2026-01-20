import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all nature of controls
export async function GET() {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;
    const tenantFilter = !isGRCAdmin && customerAccountId ? { customerAccountId } : {};

    const controls = await prisma.auditNatureOfControl.findMany({
      where: tenantFilter,
      orderBy: { label: "asc" },
    });

    return NextResponse.json(controls);
  } catch (error) {
    console.error("Error fetching nature of controls:", error);
    return NextResponse.json(
      { error: "Failed to fetch nature of controls" },
      { status: 500 }
    );
  }
}

// POST create a new nature of control
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const customerAccountId = session?.user?.customerAccountId;

    const body = await request.json();
    const { label } = body;

    if (!label) {
      return NextResponse.json(
        { error: "Label is required" },
        { status: 400 }
      );
    }

    // Check for duplicate within the same tenant
    const existing = await prisma.auditNatureOfControl.findFirst({
      where: {
        label,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Nature of control with this label already exists" },
        { status: 400 }
      );
    }

    const control = await prisma.auditNatureOfControl.create({
      data: {
        label,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    return NextResponse.json(control, { status: 201 });
  } catch (error) {
    console.error("Error creating nature of control:", error);
    return NextResponse.json(
      { error: "Failed to create nature of control" },
      { status: 500 }
    );
  }
}

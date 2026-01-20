import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all audit types
export async function GET() {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;
    const tenantFilter = !isGRCAdmin && customerAccountId ? { customerAccountId } : {};

    const auditTypes = await prisma.auditType.findMany({
      where: tenantFilter,
      include: {
        _count: {
          select: { internalAuditRisks: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(auditTypes);
  } catch (error) {
    console.error("Error fetching audit types:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit types" },
      { status: 500 }
    );
  }
}

// POST create a new audit type
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const customerAccountId = session?.user?.customerAccountId;

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Audit type name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate within the same tenant
    const existing = await prisma.auditType.findFirst({
      where: {
        name,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Audit type with this name already exists" },
        { status: 400 }
      );
    }

    const auditType = await prisma.auditType.create({
      data: {
        name,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    return NextResponse.json(auditType, { status: 201 });
  } catch (error) {
    console.error("Error creating audit type:", error);
    return NextResponse.json(
      { error: "Failed to create audit type" },
      { status: 500 }
    );
  }
}

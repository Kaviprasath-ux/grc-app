import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all audit types
export async function GET() {
  try {
    const auditTypes = await prisma.auditType.findMany({
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
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Audit type name is required" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.auditType.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Audit type with this name already exists" },
        { status: 400 }
      );
    }

    const auditType = await prisma.auditType.create({
      data: { name },
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

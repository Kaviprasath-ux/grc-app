import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all regulations
export async function GET() {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;
    const tenantFilter = !isGRCAdmin && customerAccountId ? { customerAccountId } : {};

    const regulations = await prisma.regulation.findMany({
      where: tenantFilter,
      include: { attachments: { orderBy: { uploadedAt: "desc" } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(regulations);
  } catch (error) {
    console.error("Error fetching regulations:", error);
    return NextResponse.json({ error: "Failed to fetch regulations" }, { status: 500 });
  }
}

// POST create new regulation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const customerAccountId = session?.user?.customerAccountId;

    const body = await request.json();
    const { name, version, sa1Date, sa2Date, scope, exclusionJustification, document, certificate, status } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Check for duplicate within the same tenant
    const existing = await prisma.regulation.findFirst({
      where: {
        name,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Regulation already exists" }, { status: 409 });
    }

    const regulation = await prisma.regulation.create({
      data: {
        name,
        version,
        sa1Date,
        sa2Date,
        scope,
        exclusionJustification,
        document,
        certificate,
        status: status || "Subscribed",
        ...(customerAccountId ? { customerAccountId } : {}),
      },
      include: { attachments: true },
    });

    return NextResponse.json(regulation, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating regulation:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Regulation already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create regulation" }, { status: 500 });
  }
}

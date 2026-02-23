import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

// GET all BCP labels
export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const type = searchParams.get("type"); // RTO or RPO
      const tenantFilter = getTenantFilter(session);

      const where = { ...tenantFilter, ...(type ? { type } : {}) };

      const labels = await prisma.bCPLabel.findMany({
        where,
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(labels);
    } catch (error) {
      console.error("Error fetching BCP labels:", error);
      return NextResponse.json(
        { error: "Failed to fetch BCP labels" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// POST create new BCP label
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { name, type, hours, description, sortOrder, isActive } = body;
      const customerAccountId = session.customerAccountId;

    if (!customerAccountId) {
      return NextResponse.json(
        { error: "Customer account not found" },
        { status: 400 }
      );
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Label name is required" },
        { status: 400 }
      );
    }

    if (!type || !["RTO", "RPO"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be either RTO or RPO" },
        { status: 400 }
      );
    }

    const label = await prisma.bCPLabel.create({
      data: {
        name: name.trim(),
        type,
        hours: hours ?? 0,
        description: description?.trim() || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        customerAccountId,
      },
    });

    if (customerAccountId) {
      void translateRecord(customerAccountId, 'BCPLabel', label.id, { name: label.name, description: label.description ?? undefined });
    }

    return NextResponse.json(label, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating BCP label:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Label with this name already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create BCP label" },
      { status: 500 }
    );
  }
  },
  { resource: "organization.bia", action: "create" }
);

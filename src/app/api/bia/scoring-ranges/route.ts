import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";

// GET all BIA scoring ranges
export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const calculationType = searchParams.get("calculationType") || "High of all";
      const tenantFilter = getTenantFilter(session);

      const ranges = await prisma.bIAScoringRange.findMany({
        where: { ...tenantFilter, calculationType },
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(ranges);
    } catch (error) {
      console.error("Error fetching BIA scoring ranges:", error);
      return NextResponse.json(
        { error: "Failed to fetch BIA scoring ranges" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// POST create new BIA scoring range
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { label, lowValue, highValue, color, calculationType, sortOrder } = body;
      const customerAccountId = session.customerAccountId;

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found" },
          { status: 400 }
        );
      }

      if (!label?.trim()) {
        return NextResponse.json(
          { error: "Range label is required" },
          { status: 400 }
        );
      }

      const range = await prisma.bIAScoringRange.create({
        data: {
          label: label.trim(),
          lowValue: lowValue ?? 0,
          highValue: highValue ?? null,
          color: color?.trim() || null,
          calculationType: calculationType || "High of all",
          sortOrder: sortOrder ?? 0,
          customerAccountId,
        },
      });

      if (customerAccountId) {
        void translateRecord(customerAccountId, 'BIAScoringRange', range.id, { label: range.label });
      }

      return NextResponse.json(range, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating BIA scoring range:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Range with this label and calculation type already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create BIA scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "create" }
);

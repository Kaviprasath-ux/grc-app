import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET all asset scoring ranges for the current tenant
export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const { searchParams } = new URL(req.url);
      const calculationType = searchParams.get("calculationType");

      const where: Record<string, unknown> = { ...tenantFilter };

      if (calculationType) {
        where.calculationType = calculationType;
      }

      const ranges = await prisma.assetScoringRange.findMany({
        where,
        orderBy: [
          { calculationType: "asc" },
          { sortOrder: "asc" },
          { maxScore: "desc" },
        ],
      });

      return NextResponse.json(ranges);
    } catch (error) {
      console.error("Error fetching asset scoring ranges:", error);
      return NextResponse.json(
        { error: "Failed to fetch asset scoring ranges" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "view" }
);

// POST create new asset scoring range
export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { calculationType, level, minScore, maxScore, color } = body;

      if (!calculationType || !level) {
        return NextResponse.json(
          { error: "Calculation type and level are required" },
          { status: 400 }
        );
      }

      const customerAccountId = session.customerAccountId || null;

      // Check for duplicate within same tenant and calculation type
      const existing = await prisma.assetScoringRange.findFirst({
        where: {
          customerAccountId,
          calculationType,
          level: level.trim(),
        } as Record<string, unknown>,
      });

      if (existing) {
        return NextResponse.json(
          { error: "Rating with this name already exists for this calculation type" },
          { status: 400 }
        );
      }

      // Get max sort order for this calculation type
      const maxSortOrder = await prisma.assetScoringRange.aggregate({
        where: {
          customerAccountId,
          calculationType,
        },
        _max: { sortOrder: true },
      });

      const range = await prisma.assetScoringRange.create({
        data: {
          calculationType,
          level: level.trim(),
          minScore: minScore || 0,
          maxScore: maxScore || 0,
          color: color || "#000000",
          sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
          customerAccountId,
        },
      });

      return NextResponse.json(range, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating asset scoring range:", error);
      if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "Rating with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create asset scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "create" }
);

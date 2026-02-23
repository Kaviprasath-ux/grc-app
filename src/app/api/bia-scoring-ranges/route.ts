import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all BIA scoring ranges - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const calculationType = searchParams.get("calculationType");
      const tenantFilter = getTenantFilter(session);

      const whereClause = {
        ...tenantFilter,
        ...(calculationType && { calculationType }),
      };

      const ranges = await prisma.bIAScoringRange.findMany({
        where: whereClause,
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

// Helper function to check for overlapping ranges
async function checkOverlappingRanges(
  tenantFilter: Record<string, unknown>,
  calculationType: string,
  lowValue: number,
  highValue: number | null,
  excludeId?: string
): Promise<{ hasOverlap: boolean; conflictingRange?: { label: string; lowValue: number; highValue: number | null } }> {
  // Get all existing ranges for this calculation type
  const existingRanges = await prisma.bIAScoringRange.findMany({
    where: {
      ...tenantFilter,
      calculationType,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { id: true, label: true, lowValue: true, highValue: true },
  });

  // Check for overlaps
  for (const existing of existingRanges) {
    const existingLow = existing.lowValue;
    const existingHigh = existing.highValue ?? Number.MAX_SAFE_INTEGER;
    const newLow = lowValue;
    const newHigh = highValue ?? Number.MAX_SAFE_INTEGER;

    // Two ranges overlap if: newLow <= existingHigh AND newHigh >= existingLow
    if (newLow <= existingHigh && newHigh >= existingLow) {
      return {
        hasOverlap: true,
        conflictingRange: {
          label: existing.label,
          lowValue: existing.lowValue,
          highValue: existing.highValue,
        },
      };
    }
  }

  return { hasOverlap: false };
}

// POST create new BIA scoring range - with tenant isolation
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { label, lowValue, highValue, color, calculationType, sortOrder } = body;
      const customerAccountId = getCustomerAccountId(session);
      const tenantFilter = getTenantFilter(session);

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Validate lowValue and highValue
      const low = lowValue ?? 0;
      const high = highValue ?? null;

      if (low < 0) {
        return NextResponse.json(
          { error: "Min Score cannot be negative" },
          { status: 400 }
        );
      }

      if (high !== null && high < 0) {
        return NextResponse.json(
          { error: "Max Score cannot be negative" },
          { status: 400 }
        );
      }

      if (high !== null && low > high) {
        return NextResponse.json(
          { error: "Min Score cannot be greater than Max Score" },
          { status: 400 }
        );
      }

      // Check for overlapping ranges
      const calcType = calculationType || "High of all";
      const overlapCheck = await checkOverlappingRanges(tenantFilter, calcType, low, high);
      if (overlapCheck.hasOverlap && overlapCheck.conflictingRange) {
        const conflictRange = overlapCheck.conflictingRange;
        const conflictHighDisplay = conflictRange.highValue !== null ? conflictRange.highValue : "∞";
        return NextResponse.json(
          { error: `Range ${low}-${high ?? '∞'} overlaps with existing range "${conflictRange.label}" (${conflictRange.lowValue}-${conflictHighDisplay})` },
          { status: 400 }
        );
      }

      // Get the max sortOrder if not provided
      let order = sortOrder;
      if (order === undefined) {
        const maxOrder = await prisma.bIAScoringRange.findFirst({
          where: {
            ...tenantFilter,
            calculationType: calcType
          },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        order = (maxOrder?.sortOrder ?? -1) + 1;
      }

      const range = await prisma.bIAScoringRange.create({
        data: {
          customerAccountId,
          label,
          lowValue: low,
          highValue: high,
          color,
          calculationType: calcType,
          sortOrder: order,
        },
      });

      if (customerAccountId) void translateRecord(customerAccountId, 'BIAScoringRange', range.id, { label: range.label });

      return NextResponse.json(range, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating BIA scoring range:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "A range with this label and calculation type already exists" },
          { status: 409 }
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

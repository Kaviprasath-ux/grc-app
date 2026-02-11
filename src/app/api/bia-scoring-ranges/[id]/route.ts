import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

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

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single BIA scoring range - with tenant isolation
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const range = await prisma.bIAScoringRange.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!range) {
        return NextResponse.json(
          { error: "BIA scoring range not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(range);
    } catch (error) {
      console.error("Error fetching BIA scoring range:", error);
      return NextResponse.json(
        { error: "Failed to fetch BIA scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// PUT update BIA scoring range - with tenant isolation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { label, lowValue, highValue, color, calculationType, sortOrder } = body;
      const tenantFilter = getTenantFilter(session);

      // Verify the range belongs to the tenant
      const existing = await prisma.bIAScoringRange.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "BIA scoring range not found" },
          { status: 404 }
        );
      }

      // Calculate the final values (use existing values if not provided)
      const finalLow = lowValue !== undefined ? lowValue : existing.lowValue;
      const finalHigh = highValue !== undefined ? highValue : existing.highValue;
      const finalCalcType = calculationType !== undefined ? calculationType : existing.calculationType;

      // Validate lowValue and highValue
      if (finalLow < 0) {
        return NextResponse.json(
          { error: "Min Score cannot be negative" },
          { status: 400 }
        );
      }

      if (finalHigh !== null && finalHigh < 0) {
        return NextResponse.json(
          { error: "Max Score cannot be negative" },
          { status: 400 }
        );
      }

      if (finalHigh !== null && finalLow > finalHigh) {
        return NextResponse.json(
          { error: "Min Score cannot be greater than Max Score" },
          { status: 400 }
        );
      }

      // Check for overlapping ranges (excluding current range)
      const overlapCheck = await checkOverlappingRanges(tenantFilter, finalCalcType, finalLow, finalHigh, id);
      if (overlapCheck.hasOverlap && overlapCheck.conflictingRange) {
        const conflictRange = overlapCheck.conflictingRange;
        const conflictHighDisplay = conflictRange.highValue !== null ? conflictRange.highValue : "∞";
        return NextResponse.json(
          { error: `Range ${finalLow}-${finalHigh ?? '∞'} overlaps with existing range "${conflictRange.label}" (${conflictRange.lowValue}-${conflictHighDisplay})` },
          { status: 400 }
        );
      }

      const range = await prisma.bIAScoringRange.update({
        where: { id },
        data: {
          ...(label !== undefined && { label }),
          ...(lowValue !== undefined && { lowValue }),
          ...(highValue !== undefined && { highValue }),
          ...(color !== undefined && { color }),
          ...(calculationType !== undefined && { calculationType }),
          ...(sortOrder !== undefined && { sortOrder }),
        },
      });

      return NextResponse.json(range);
    } catch (error: unknown) {
      console.error("Error updating BIA scoring range:", error);
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "A range with this label and calculation type already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update BIA scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "edit" }
);

// DELETE BIA scoring range - with tenant isolation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify the range belongs to the tenant
      const existing = await prisma.bIAScoringRange.findFirst({
        where: { id, ...tenantFilter },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "BIA scoring range not found" },
          { status: 404 }
        );
      }

      await prisma.bIAScoringRange.delete({
        where: { id },
      });

      return NextResponse.json({ message: "BIA scoring range deleted successfully" });
    } catch (error) {
      console.error("Error deleting BIA scoring range:", error);
      return NextResponse.json(
        { error: "Failed to delete BIA scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "delete" }
);

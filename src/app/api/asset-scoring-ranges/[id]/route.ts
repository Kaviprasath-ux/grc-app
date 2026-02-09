import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single asset scoring range
export const GET = withAuth(
  async (_req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const range = await prisma.assetScoringRange.findFirst({
        where: {
          id,
          ...tenantFilter,
        } as Record<string, unknown>,
      });

      if (!range) {
        return NextResponse.json(
          { error: "Scoring range not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(range);
    } catch (error) {
      console.error("Error fetching asset scoring range:", error);
      return NextResponse.json(
        { error: "Failed to fetch asset scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "view" }
);

// PUT update asset scoring range
export const PUT = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const body = await req.json();
      const { level, minScore, maxScore, color } = body;
      const tenantFilter = getTenantFilter(session);

      // Check if range exists and belongs to tenant
      const existing = await prisma.assetScoringRange.findFirst({
        where: {
          id,
          ...tenantFilter,
        } as Record<string, unknown>,
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Scoring range not found" },
          { status: 404 }
        );
      }

      // Check for duplicate level name (excluding current record)
      if (level && level.trim() !== existing.level) {
        const duplicate = await prisma.assetScoringRange.findFirst({
          where: {
            id: { not: id },
            customerAccountId: existing.customerAccountId,
            calculationType: existing.calculationType,
            level: level.trim(),
          } as Record<string, unknown>,
        });

        if (duplicate) {
          return NextResponse.json(
            { error: "Rating with this name already exists" },
            { status: 400 }
          );
        }
      }

      const range = await prisma.assetScoringRange.update({
        where: { id },
        data: {
          level: level?.trim() || existing.level,
          minScore: minScore !== undefined ? minScore : existing.minScore,
          maxScore: maxScore !== undefined ? maxScore : existing.maxScore,
          color: color || existing.color,
        },
      });

      return NextResponse.json(range);
    } catch (error) {
      console.error("Error updating asset scoring range:", error);
      return NextResponse.json(
        { error: "Failed to update asset scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "edit" }
);

// DELETE asset scoring range
export const DELETE = withAuth(
  async (_req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      // Check if range exists and belongs to tenant
      const existing = await prisma.assetScoringRange.findFirst({
        where: {
          id,
          ...tenantFilter,
        } as Record<string, unknown>,
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Scoring range not found" },
          { status: 404 }
        );
      }

      await prisma.assetScoringRange.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting asset scoring range:", error);
      return NextResponse.json(
        { error: "Failed to delete asset scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "delete" }
);

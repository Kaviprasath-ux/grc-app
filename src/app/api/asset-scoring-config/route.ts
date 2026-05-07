import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET asset scoring config for the current tenant
export const GET = withAuth(
  async (_req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = session.customerAccountId || null;

      // Try to get existing config
      let config = await prisma.assetScoringConfig.findFirst({
        where: tenantFilter as Record<string, unknown>,
      });

      // If no config exists, create a default one
      if (!config) {
        config = await prisma.assetScoringConfig.create({
          data: {
            calculationType: "high_of_all",
            isActive: true,
            customerAccountId,
          },
        });
      }

      return NextResponse.json(config);
    } catch (error) {
      console.error("Error fetching asset scoring config:", error);
      return NextResponse.json(
        { error: "Failed to fetch asset scoring config" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "view" }
);

// PUT update asset scoring config
export const PUT = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { calculationType } = body;

      if (!calculationType) {
        return NextResponse.json(
          { error: "Calculation type is required" },
          { status: 400 }
        );
      }

      const tenantFilter = getTenantFilter(session);
      const customerAccountId = session.customerAccountId || null;

      // Find existing config
      let config = await prisma.assetScoringConfig.findFirst({
        where: tenantFilter as Record<string, unknown>,
      });

      if (config) {
        // Update existing
        config = await prisma.assetScoringConfig.update({
          where: { id: config.id },
          data: { calculationType },
        });
      } else {
        // Create new
        config = await prisma.assetScoringConfig.create({
          data: {
            calculationType,
            isActive: true,
            customerAccountId,
          },
        });
      }

      return NextResponse.json(config);
    } catch (error) {
      console.error("Error updating asset scoring config:", error);
      return NextResponse.json(
        { error: "Failed to update asset scoring config" },
        { status: 500 }
      );
    }
  },
  { resource: "asset.settings", action: "edit" }
);

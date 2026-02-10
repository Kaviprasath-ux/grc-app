import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET BIA scoring configuration (returns the active one or creates default)
export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = session.customerAccountId;

      let config = await prisma.bIAScoringConfig.findFirst({
        where: { ...tenantFilter, isActive: true },
      });

      // If no config exists and we have a customerAccountId, create a default one
      if (!config && customerAccountId) {
        config = await prisma.bIAScoringConfig.create({
          data: {
            calculationType: "High of all",
            isActive: true,
            customerAccountId,
          },
        });
      }

      return NextResponse.json(config);
    } catch (error) {
      console.error("Error fetching BIA scoring config:", error);
      return NextResponse.json(
        { error: "Failed to fetch BIA scoring config" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "view" }
);

// PUT update BIA scoring configuration
export const PUT = withAuth(
  async (req, _context, session) => {
    try {
      const body = await req.json();
      const { calculationType } = body;
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = session.customerAccountId;

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "Customer account not found" },
          { status: 400 }
        );
      }

      const validTypes = ["High of all", "Addition of all", "Product of all"];
      if (!calculationType || !validTypes.includes(calculationType)) {
        return NextResponse.json(
          { error: "Invalid calculation type. Must be one of: High of all, Addition of all, Product of all" },
          { status: 400 }
        );
      }

      // Deactivate all existing configs for this tenant
      await prisma.bIAScoringConfig.updateMany({
        where: { ...tenantFilter, isActive: true },
        data: { isActive: false },
      });

      // Create new active config
      const config = await prisma.bIAScoringConfig.create({
        data: {
          calculationType,
          isActive: true,
          customerAccountId,
        },
      });

      return NextResponse.json(config);
    } catch (error) {
      console.error("Error updating BIA scoring config:", error);
      return NextResponse.json(
        { error: "Failed to update BIA scoring config" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.bia", action: "edit" }
);

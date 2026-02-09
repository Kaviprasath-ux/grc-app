import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET BIA scoring configuration - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = getCustomerAccountId(session);

      // Get or create default config for this tenant
      let config = await prisma.bIAScoringConfig.findFirst({
        where: tenantFilter,
      });

      if (!config) {
        // Create default config for this tenant
        config = await prisma.bIAScoringConfig.create({
          data: {
            customerAccountId,
            calculationType: "High of all",
            isActive: true,
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

// PUT update BIA scoring configuration - with tenant isolation
export const PUT = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { calculationType } = body;
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = getCustomerAccountId(session);

      // Get existing config or create one
      let config = await prisma.bIAScoringConfig.findFirst({
        where: tenantFilter,
      });

      if (config) {
        config = await prisma.bIAScoringConfig.update({
          where: { id: config.id },
          data: {
            ...(calculationType !== undefined && { calculationType }),
          },
        });
      } else {
        config = await prisma.bIAScoringConfig.create({
          data: {
            customerAccountId,
            calculationType: calculationType || "High of all",
            isActive: true,
          },
        });
      }

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

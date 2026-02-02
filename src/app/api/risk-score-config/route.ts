import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET risk score configuration - with tenant filtering
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = getCustomerAccountId(session);

      let config = await prisma.riskScoreConfig.findFirst({
        where: tenantFilter,
      });

      // If no config exists, create default for this tenant
      if (!config) {
        config = await prisma.riskScoreConfig.create({
          data: {
            customerAccountId,
            useLikelihood: true,
            useImpact: true,
            useAssetScore: false,
            useVulnerabilityScore: false,
            riskTolerance: 10,
          },
        });
      }

      return NextResponse.json(config);
    } catch (error) {
      console.error("Error fetching risk score config:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk score config" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// PUT update risk score configuration - with tenant filtering
export const PUT = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { useLikelihood, useImpact, useAssetScore, useVulnerabilityScore, riskTolerance } = body;

      // Get existing config for this tenant or create one
      let config = await prisma.riskScoreConfig.findFirst({
        where: tenantFilter,
      });

      if (config) {
        config = await prisma.riskScoreConfig.update({
          where: { id: config.id },
          data: {
            useLikelihood: useLikelihood ?? config.useLikelihood,
            useImpact: useImpact ?? config.useImpact,
            useAssetScore: useAssetScore ?? config.useAssetScore,
            useVulnerabilityScore: useVulnerabilityScore ?? config.useVulnerabilityScore,
            riskTolerance: riskTolerance !== undefined ? parseInt(riskTolerance) : config.riskTolerance,
          },
        });
      } else {
        config = await prisma.riskScoreConfig.create({
          data: {
            customerAccountId,
            useLikelihood: useLikelihood ?? true,
            useImpact: useImpact ?? true,
            useAssetScore: useAssetScore ?? false,
            useVulnerabilityScore: useVulnerabilityScore ?? false,
            riskTolerance: riskTolerance !== undefined ? parseInt(riskTolerance) : 10,
          },
        });
      }

      return NextResponse.json(config);
    } catch (error) {
      console.error("Error updating risk score config:", error);
      return NextResponse.json(
        { error: "Failed to update risk score config" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

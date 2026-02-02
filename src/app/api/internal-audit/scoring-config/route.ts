import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET scoring config
// Note: AuditScoringConfig model doesn't have customerAccountId field yet - tenant filtering disabled
export const GET = withAuth(
  async () => {
    try {
      let config = await prisma.auditScoringConfig.findFirst();

      // Create default config if none exists
      if (!config) {
        config = await prisma.auditScoringConfig.create({
          data: {
            probabilityImpactCalcType: "Product of all",
            riskRatingCalcType: "High of all",
          },
        });
      }

      return NextResponse.json(config);
    } catch (error) {
      console.error("Error fetching scoring config:", error);
      return NextResponse.json(
        { error: "Failed to fetch scoring config" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// PUT update scoring config
// Note: AuditScoringConfig model doesn't have customerAccountId field yet - tenant filtering disabled
export const PUT = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const { probabilityImpactCalcType, riskRatingCalcType } = body;

      let config = await prisma.auditScoringConfig.findFirst();

      if (!config) {
        // Create if doesn't exist
        config = await prisma.auditScoringConfig.create({
          data: {
            probabilityImpactCalcType: probabilityImpactCalcType || "Product of all",
            riskRatingCalcType: riskRatingCalcType || "High of all",
          },
        });
      } else {
        // Update existing
        config = await prisma.auditScoringConfig.update({
          where: { id: config.id },
          data: {
            ...(probabilityImpactCalcType !== undefined && { probabilityImpactCalcType }),
            ...(riskRatingCalcType !== undefined && { riskRatingCalcType }),
          },
        });
      }

      return NextResponse.json(config);
    } catch (error) {
      console.error("Error updating scoring config:", error);
      return NextResponse.json(
        { error: "Failed to update scoring config" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

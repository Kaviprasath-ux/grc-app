import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadFilter, getAuditHeadId } from "@/lib/api-auth";

// GET scoring config - filtered by audit head
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      let config = await prisma.auditScoringConfig.findFirst({
        where: { ...tenantFilter, ...auditHeadFilter },
      });

      // Create default config if none exists for this audit head
      if (!config) {
        const customerAccountId = getCustomerAccountId(session);
        const auditHeadId = getAuditHeadId(session);
        config = await prisma.auditScoringConfig.create({
          data: {
            customerAccountId,
            auditHeadId,
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

// PUT update scoring config - for current audit head
export const PUT = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { probabilityImpactCalcType, riskRatingCalcType } = body;
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      let config = await prisma.auditScoringConfig.findFirst({
        where: { ...tenantFilter, ...auditHeadFilter },
      });

      if (!config) {
        // Create if doesn't exist for this audit head
        const customerAccountId = getCustomerAccountId(session);
        const auditHeadId = getAuditHeadId(session);
        config = await prisma.auditScoringConfig.create({
          data: {
            customerAccountId,
            auditHeadId,
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

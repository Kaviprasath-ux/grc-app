import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";

// GET scoring config
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      let config = await prisma.auditScoringConfig.findFirst({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      // Create default config if none exists for this tenant/auditHead
      if (!config) {
        config = await prisma.auditScoringConfig.create({
          data: {
            probabilityImpactCalcType: "Product of all",
            riskRatingCalcType: "High of all",
            customerAccountId: session.customerAccountId,
            auditHeadId: auditHeadId,
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
  { resource: "audit.settings", action: "view" }
);

// PUT update scoring config
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const PUT = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { probabilityImpactCalcType, riskRatingCalcType } = body;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      let config = await prisma.auditScoringConfig.findFirst({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (!config) {
        // Create if doesn't exist for this tenant/auditHead
        config = await prisma.auditScoringConfig.create({
          data: {
            probabilityImpactCalcType: probabilityImpactCalcType || "Product of all",
            riskRatingCalcType: riskRatingCalcType || "High of all",
            customerAccountId: session.customerAccountId,
            auditHeadId: auditHeadId,
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

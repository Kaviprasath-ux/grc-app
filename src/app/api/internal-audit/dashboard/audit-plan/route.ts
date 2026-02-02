import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadFilter } from "@/lib/api-auth";

// GET annual audit plan
export const GET = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      // Multi-tenant + AuditHead filtering
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const currentYear = new Date().getFullYear();

      // Get audit engagements for the current year (with tenant and audit head filter)
      let engagements: any[] = [];
      try {
        engagements = await prisma.auditEngagement.findMany({
          where: {
            ...tenantFilter,
            ...auditHeadFilter,
            year: currentYear,
          },
          include: {
            auditableEntity: true,
          },
          orderBy: { plannedStartDate: "asc" },
        });
      } catch (e: any) {
        if (e.code === "P2021") {
          return NextResponse.json([]);
        }
        throw e;
      }

      // Transform to audit plan format
      const auditPlan = engagements.map((engagement) => {
        const startMonth = engagement.plannedStartDate
          ? new Date(engagement.plannedStartDate).getMonth()
          : 0;
        const endMonth = engagement.plannedEndDate
          ? new Date(engagement.plannedEndDate).getMonth()
          : startMonth;

        // Calculate days
        let days = 0;
        if (engagement.plannedStartDate && engagement.plannedEndDate) {
          const diffTime = Math.abs(
            new Date(engagement.plannedEndDate).getTime() -
              new Date(engagement.plannedStartDate).getTime()
          );
          days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        return {
          name: engagement.engagementTitle || engagement.auditableEntity?.name || "Unnamed Audit",
          days,
          startMonth,
          endMonth,
        };
      });

      return NextResponse.json(auditPlan);
    } catch (error) {
      console.error("Error fetching audit plan:", error);
      return NextResponse.json(
        { error: "Failed to fetch audit plan" },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.dashboard', action: 'view' }
);

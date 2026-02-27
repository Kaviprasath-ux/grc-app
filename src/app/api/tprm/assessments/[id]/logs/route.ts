import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET logs for a specific assessment
export const GET = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify assessment belongs to tenant
      const assessment = await prisma.tPRMAssessment.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, assessmentCode: true, vendor: { select: { name: true } } },
      });

      if (!assessment) {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      }

      const logs = await prisma.tPRMAssessmentLog.findMany({
        where: { assessmentId: id, ...tenantFilter },
        orderBy: { logDate: "desc" },
      });

      return NextResponse.json({
        assessment: {
          id: assessment.id,
          assessmentCode: assessment.assessmentCode,
          vendorName: assessment.vendor.name,
        },
        data: logs,
      });
    } catch (error) {
      console.error("Error fetching assessment logs:", error);
      return NextResponse.json(
        { error: "Failed to fetch assessment logs" },
        { status: 500 }
      );
    }
  },
  { resource: "tprm.assessments", action: "view" }
);

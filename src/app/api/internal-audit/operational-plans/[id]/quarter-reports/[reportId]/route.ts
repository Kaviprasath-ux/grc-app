import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string; reportId: string }>;
}

// DELETE - remove a quarter report (document + record).
export const DELETE = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const { id, reportId } = await (context as RouteContext).params;

      const report = await prisma.auditOperationalPlanQuarterReport.findUnique({
        where: { id: reportId },
      });
      if (!report || report.operationalPlanId !== id) {
        return NextResponse.json({ error: "Quarter report not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, report.customerAccountId)) {
        return forbidden("Access denied");
      }

      await prisma.auditOperationalPlanQuarterReport.delete({ where: { id: reportId } });

      return NextResponse.json({ message: "Quarter report removed" });
    } catch (error) {
      console.error("Error removing quarter report:", error);
      return NextResponse.json({ error: "Failed to remove quarter report" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "edit" }
);

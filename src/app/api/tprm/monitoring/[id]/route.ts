import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE /api/tprm/monitoring/[id]
// Remove a monitoring vendor and all its assessments / KPI rows.
// Cascade is handled by Prisma `onDelete: Cascade` on TPRMMonitoringAssessment
// and downstream models. The linked TPRMVendor (if any) is preserved — only
// the monitoring record is removed.
export const DELETE = withAuth<RouteContext>(
  async (_req: NextRequest, context, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session, { globalAccess: session.roles.includes("GRCAdministrator") });

      const monVendor = await prisma.tPRMMonitoringVendor.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, vendorName: true },
      });
      if (!monVendor) {
        return NextResponse.json({ error: "Monitoring vendor not found" }, { status: 404 });
      }

      await prisma.tPRMMonitoringVendor.delete({ where: { id: monVendor.id } });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("[TPRM Monitoring DELETE] Failed:", error);
      const err = error as { message?: string };
      return NextResponse.json(
        { error: err?.message ? `Failed to delete: ${err.message}` : "Failed to delete monitoring vendor" },
        { status: 500 }
      );
    }
  },
  { resource: ["tprm.monitoring", "tprm.bo-monitoring", "tprm.rm-monitoring"], action: "delete" }
);

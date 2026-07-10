import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET processes and engagements linked to an audit category
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const [processes, engagements] = await Promise.all([
        prisma.internalAuditProcess.findMany({
          where: { categoryId: id, ...tenantFilter },
          select: { id: true, name: true, processCode: true },
          orderBy: { name: "asc" },
        }),
        prisma.auditEngagement.findMany({
          where: {
            auditCategoryId: id,
            ...tenantFilter,
            ...(auditHeadId ? { auditHeadId } : {}),
          },
          select: { id: true, engagementTitle: true, auditId: true },
          orderBy: { engagementTitle: "asc" },
        }),
      ]);

      return NextResponse.json({
        processes: processes.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.processCode,
          type: "process" as const,
        })),
        engagements: engagements.map((e) => ({
          id: e.id,
          name: e.engagementTitle,
          code: e.auditId,
          type: "engagement" as const,
        })),
      });
    } catch (error) {
      console.error("Error fetching category entities:", error);
      return NextResponse.json(
        { error: "Failed to fetch entities" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "view" }
);

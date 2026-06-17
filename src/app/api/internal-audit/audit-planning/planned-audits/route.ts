import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";

// GET - All operational-plan audit line-items that are NOT yet linked to an
// engagement, across every operational plan / year / quarter for the tenant.
// These are "planned" audits that don't yet appear in the engagements list
// (engagements are only created when a plan is approved), so Audit Planning can
// show every planned audit together regardless of year/quarter/approval status.
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const items = await prisma.auditOperationalPlanItem.findMany({
        where: {
          engagementId: null,
          operationalPlan: {
            ...tenantFilter,
            ...(auditHeadId ? { auditHeadId } : {}),
          },
        },
        select: {
          id: true,
          title: true,
          auditType: true,
          plannedQuarter: true,
          riskLevel: true,
          departmentId: true,
          operationalPlan: { select: { planCode: true, year: true } },
        },
        orderBy: [{ operationalPlan: { year: "asc" } }, { priorityRank: "asc" }],
      });

      // Resolve department names in one query (AuditOperationalPlanItem has no
      // department relation, only a scalar departmentId).
      const deptIds = [...new Set(items.map((i) => i.departmentId).filter(Boolean) as string[])];
      const depts = deptIds.length
        ? await prisma.department.findMany({
            where: { id: { in: deptIds } },
            select: { id: true, name: true },
          })
        : [];
      const deptName = new Map(depts.map((d) => [d.id, d.name]));

      const planned = items.map((it) => ({
        id: it.id,
        title: it.title,
        auditType: it.auditType,
        plannedQuarter: it.plannedQuarter,
        riskLevel: it.riskLevel,
        departmentId: it.departmentId,
        departmentName: it.departmentId ? deptName.get(it.departmentId) ?? null : null,
        planCode: it.operationalPlan?.planCode ?? null,
        year: it.operationalPlan?.year ?? null,
      }));

      return NextResponse.json(planned);
    } catch (error) {
      console.error("Error fetching planned audits:", error);
      return NextResponse.json(
        { error: "Failed to fetch planned audits" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.planning", action: "view" }
);

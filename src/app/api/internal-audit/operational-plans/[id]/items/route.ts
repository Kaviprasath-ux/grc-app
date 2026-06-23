import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST add an audit to an operational plan
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const body = await req.json();

      const plan = await prisma.auditOperationalPlan.findUnique({ where: { id } });
      if (!plan) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, plan.customerAccountId)) {
        return forbidden("Access denied");
      }

      if (!body.title || !String(body.title).trim()) {
        return NextResponse.json({ error: "Audit title is required" }, { status: 400 });
      }

      // Next priority rank within this plan
      const maxRank = await prisma.auditOperationalPlanItem.aggregate({
        where: { operationalPlanId: id },
        _max: { priorityRank: true },
      });

      const item = await prisma.auditOperationalPlanItem.create({
        data: {
          operationalPlanId: id,
          title: body.title,
          departmentId: body.departmentId || null,
          auditableEntityId: body.auditableEntityId || null,
          riskId: body.riskId || null,
          auditType: body.auditType || null,
          auditCategory: body.auditCategory || null,
          plannedQuarter: body.plannedQuarter || null,
          assignedAuditorId: body.assignedAuditorId || null,
          auditorInChargeId: body.auditorInChargeId || null,
          residualScore:
            body.residualScore === "" || body.residualScore === null || body.residualScore === undefined
              ? null
              : Number(body.residualScore),
          riskLevel: body.riskLevel || null,
          proposedPeriodical: body.proposedPeriodical || null,
          estimatedHours:
            body.estimatedHours === "" || body.estimatedHours === null || body.estimatedHours === undefined
              ? null
              : Number(body.estimatedHours),
          priorityRank: (maxRank._max.priorityRank ?? 0) + 1,
          notes: body.notes || null,
        },
      });

      return NextResponse.json(item, { status: 201 });
    } catch (error) {
      console.error("Error adding operational plan item:", error);
      return NextResponse.json({ error: "Failed to add audit" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "edit" }
);

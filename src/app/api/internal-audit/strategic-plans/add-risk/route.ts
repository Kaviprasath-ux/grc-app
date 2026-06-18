import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  withAuth,
  getTenantFilter,
  getCustomerAccountId,
  getAuditHeadId,
  resolveAuditHeadIdForCreate,
} from "@/lib/api-auth";

// POST - Add an assessed risk to the strategic plan.
// Body: { riskId }  (the InternalAuditRisk id)
// Ensures an active strategic plan exists, adds the risk as an item, then
// re-ranks all items by residual score and re-distributes them across the
// plan years (highest-risk in the earliest years).
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const riskId: string | undefined = body.riskId;
      if (!riskId) {
        return NextResponse.json({ error: "riskId is required" }, { status: 400 });
      }

      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const customerAccountId = getCustomerAccountId(session);
      if (!customerAccountId) {
        return NextResponse.json({ error: "No customer account associated" }, { status: 400 });
      }

      // Risk must exist in this tenant and be fully assessed.
      const risk = await prisma.internalAuditRisk.findFirst({
        where: { id: riskId, ...tenantFilter },
        include: { auditType: true },
      });
      if (!risk) {
        return NextResponse.json({ error: "Risk not found" }, { status: 404 });
      }
      if (risk.inherentScore == null || risk.residualScore == null) {
        return NextResponse.json(
          { error: "Risk is not fully assessed (needs inherent and residual)." },
          { status: 400 }
        );
      }

      // Find the active strategic plan (latest for this tenant / audit head) or create one.
      let plan = await prisma.auditStrategicPlan.findFirst({
        where: { ...tenantFilter, ...(auditHeadId ? { auditHeadId } : {}) },
        orderBy: { createdAt: "desc" },
      });

      if (!plan) {
        const createAuditHeadId = await resolveAuditHeadIdForCreate(session);
        const existingPlans = await prisma.auditStrategicPlan.findMany({
          where: tenantFilter,
          select: { planCode: true },
        });
        let maxNum = 0;
        for (const p of existingPlans) {
          const m = p.planCode.match(/(\d+)$/);
          if (m && parseInt(m[1], 10) > maxNum) maxNum = parseInt(m[1], 10);
        }
        const planCode = `SAP${String(maxNum + 1).padStart(3, "0")}`;
        const startYear = new Date().getFullYear();
        plan = await prisma.auditStrategicPlan.create({
          data: {
            customerAccountId,
            auditHeadId: createAuditHeadId || null,
            planCode,
            title: `Strategic Audit Plan ${startYear}-${startYear + 2}`,
            durationYears: 3,
            startYear,
            status: "Draft",
            generatedFromRisk: true,
            createdById: session.id || null,
          },
        });
      }

      // Don't add the same risk twice.
      const dup = await prisma.auditStrategicPlanItem.findFirst({
        where: { strategicPlanId: plan.id, riskId: risk.id },
        select: { id: true },
      });
      if (!dup) {
        await prisma.auditStrategicPlanItem.create({
          data: {
            strategicPlanId: plan.id,
            year: plan.startYear,
            title: risk.riskName,
            departmentId: risk.departmentId || null,
            riskId: risk.id,
            auditType: risk.auditType?.name || null,
            residualScore: risk.residualScore,
            riskLevel: risk.riskLevel,
            priorityRank: 1,
          },
        });
      }

      // Re-rank by residual score and re-distribute across the plan years.
      const items = await prisma.auditStrategicPlanItem.findMany({
        where: { strategicPlanId: plan.id },
        orderBy: [{ residualScore: "desc" }],
      });
      const perYear = Math.max(1, Math.ceil(items.length / plan.durationYears));
      await Promise.all(
        items.map((it, idx) => {
          const bucket = Math.min(plan!.durationYears - 1, Math.floor(idx / perYear));
          return prisma.auditStrategicPlanItem.update({
            where: { id: it.id },
            data: { priorityRank: idx + 1, year: plan!.startYear + bucket },
          });
        })
      );

      const updated = await prisma.auditStrategicPlan.findUnique({
        where: { id: plan.id },
        include: {
          items: { orderBy: [{ year: "asc" }, { priorityRank: "asc" }] },
          createdBy: { select: { id: true, fullName: true } },
        },
      });

      return NextResponse.json(updated, { status: 201 });
    } catch (error) {
      console.error("Error adding risk to strategic plan:", error);
      return NextResponse.json({ error: "Failed to add risk to plan" }, { status: 500 });
    }
  },
  { resource: "audit.strategic-plan", action: "create" }
);

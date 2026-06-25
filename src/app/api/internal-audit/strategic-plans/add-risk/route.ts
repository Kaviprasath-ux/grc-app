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
      // Plan duration chosen in the Add Plan popup (3, 4 or 5 years).
      const durationYears = [3, 4, 5].includes(Number(body.durationYears))
        ? Number(body.durationYears)
        : undefined;
      // Audit type chosen in the Add Plan popup (from Audit Settings); falls
      // back to the risk's linked audit type when not provided.
      const auditTypeOverride =
        typeof body.auditType === "string" && body.auditType.trim() ? body.auditType.trim() : null;

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
      // A risk is plannable if the assessment wizard marked it Assessed (sets
      // assessmentResidualScore) OR it carries the legacy inherent+residual scores.
      const effectiveResidual =
        risk.assessmentResidualScore != null
          ? Math.round(risk.assessmentResidualScore)
          : risk.residualScore;
      const isAssessed = risk.assessmentStatus === "Assessed" || effectiveResidual != null;
      if (!isAssessed) {
        return NextResponse.json(
          { error: "Risk is not fully assessed." },
          { status: 400 }
        );
      }

      // One strategic plan per distinct duration: route the risk to the plan
      // whose duration matches the chosen value, creating it if none exists.
      // This lets the user keep e.g. a 3-year plan AND a 4-year plan separately;
      // adding to one never changes the other's duration.
      const dur = durationYears || 3;
      let plan = await prisma.auditStrategicPlan.findFirst({
        where: { ...tenantFilter, ...(auditHeadId ? { auditHeadId } : {}), durationYears: dur },
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
            title: `${dur}-Year Strategic Audit Plan`,
            durationYears: dur,
            startYear,
            status: "Draft",
            generatedFromRisk: false,
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
            auditType: auditTypeOverride || risk.auditType?.name || null,
            reasonForScheduling:
              typeof body.reasonForScheduling === "string" && body.reasonForScheduling.trim()
                ? body.reasonForScheduling.trim()
                : null,
            notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
            residualScore: effectiveResidual,
            riskLevel: risk.riskLevel,
            priorityRank: 1,
          },
        });
      }

      // Rank items within each year by residual score; clamp years that fall
      // outside the (possibly shortened) plan range to the last year.
      const maxYear = plan.startYear + plan.durationYears - 1;
      const items = await prisma.auditStrategicPlanItem.findMany({
        where: { strategicPlanId: plan.id },
        orderBy: [{ year: "asc" }, { residualScore: "desc" }],
      });
      const perYearCount: Record<number, number> = {};
      await Promise.all(
        items.map((it) => {
          const yr = Math.min(maxYear, Math.max(plan!.startYear, it.year));
          perYearCount[yr] = (perYearCount[yr] || 0) + 1;
          return prisma.auditStrategicPlanItem.update({
            where: { id: it.id },
            data: { priorityRank: perYearCount[yr], year: yr },
          });
        })
      );

      // --- Auto-sync to operational plans ---------------------------------
      // Each strategic-plan year's audits should also appear in the operational
      // plan for that year. Create the operational plan when missing; append
      // new audits (by riskId) to an existing one without disturbing edits.
      const syncedItems = await prisma.auditStrategicPlanItem.findMany({
        where: { strategicPlanId: plan.id },
        orderBy: [{ year: "asc" }, { priorityRank: "asc" }],
      });
      const planYears = [...new Set(syncedItems.map((i) => i.year))];
      const opAuditHeadId = auditHeadId ?? (await resolveAuditHeadIdForCreate(session));
      const existingOpCodes = await prisma.auditOperationalPlan.findMany({
        where: tenantFilter,
        select: { planCode: true },
      });
      let opMax = 0;
      for (const p of existingOpCodes) {
        const m = p.planCode.match(/(\d+)$/);
        if (m && parseInt(m[1], 10) > opMax) opMax = parseInt(m[1], 10);
      }
      const toItemData = (it: (typeof syncedItems)[number]) => ({
        title: it.title,
        departmentId: it.departmentId,
        auditableEntityId: it.auditableEntityId,
        riskId: it.riskId,
        auditType: it.auditType,
        residualScore: it.residualScore,
        riskLevel: it.riskLevel,
        priorityRank: it.priorityRank,
      });
      for (const yr of planYears) {
        const yearItems = syncedItems.filter((i) => i.year === yr);
        const op = await prisma.auditOperationalPlan.findFirst({
          where: { strategicPlanId: plan.id, year: yr },
        });
        if (!op) {
          opMax += 1;
          await prisma.auditOperationalPlan.create({
            data: {
              customerAccountId,
              auditHeadId: opAuditHeadId || null,
              strategicPlanId: plan.id,
              year: yr,
              planCode: `OAP${String(opMax).padStart(3, "0")}`,
              title: `Operational Audit Plan ${yr}`,
              status: "Draft",
              createdById: session.id || null,
              items: { create: yearItems.map(toItemData) },
            },
          });
        } else {
          const existing = await prisma.auditOperationalPlanItem.findMany({
            where: { operationalPlanId: op.id },
            select: { riskId: true },
          });
          const existingRiskIds = new Set(
            existing.map((x) => x.riskId).filter(Boolean) as string[]
          );
          const toAdd = yearItems.filter((it) => it.riskId && !existingRiskIds.has(it.riskId));
          if (toAdd.length) {
            await prisma.auditOperationalPlanItem.createMany({
              data: toAdd.map((it) => ({ operationalPlanId: op.id, ...toItemData(it) })),
            });
          }
        }
      }

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

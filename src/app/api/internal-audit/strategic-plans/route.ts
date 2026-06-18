import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  withAuth,
  getTenantFilter,
  getCustomerAccountId,
  getAuditHeadId,
  resolveAuditHeadIdForCreate,
} from "@/lib/api-auth";

// GET all strategic audit plans for the tenant (Audit Head isolated)
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const search = searchParams.get("search");

      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const where: any = { ...tenantFilter, ...(auditHeadId ? { auditHeadId } : {}) };

      if (status) where.status = status;
      if (search) {
        where.OR = [
          { planCode: { contains: search } },
          { title: { contains: search } },
        ];
      }

      const plans = await prisma.auditStrategicPlan.findMany({
        where,
        include: {
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(plans);
    } catch (error) {
      console.error("Error fetching strategic plans:", error);
      return NextResponse.json(
        { error: "Failed to fetch strategic plans" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.strategic-plan", action: "view" }
);

// POST create a new strategic audit plan.
// Body: { title, description?, durationYears (3|4|5), startYear, generateFromRisk?: boolean, items?: [...] }
// When generateFromRisk is true, the plan is populated from the Risk Register, ranked by residual score,
// with the highest-risk audits scheduled in the earliest years.
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();

      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = await resolveAuditHeadIdForCreate(session);
      const tenantFilter = getTenantFilter(session);

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "No customer account associated with this user" },
          { status: 400 }
        );
      }

      const durationYears = [3, 4, 5].includes(Number(body.durationYears))
        ? Number(body.durationYears)
        : 3;
      const startYear = body.startYear
        ? parseInt(body.startYear)
        : new Date().getFullYear();

      // Generate plan code (SAP001, SAP002, ...) scoped to tenant
      const existingPlans = await prisma.auditStrategicPlan.findMany({
        where: tenantFilter,
        select: { planCode: true },
      });
      let maxNum = 0;
      for (const p of existingPlans) {
        const match = p.planCode.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      const planCode = `SAP${String(maxNum + 1).padStart(3, "0")}`;

      // Build the item list
      let itemsData: any[] = [];

      if (body.generateFromRisk) {
        // Pull risks ordered by residual score (highest first) and spread across the plan years.
        // Only risks that have BOTH inherent and residual assessments completed are
        // eligible — un-assessed risks do not appear in the strategic audit plan.
        const risks = await prisma.internalAuditRisk.findMany({
          where: {
            ...tenantFilter,
            ...(auditHeadId ? { auditHeadId } : {}),
            inherentScore: { not: null },
            residualScore: { not: null },
          },
          include: { department: true, auditType: true },
          orderBy: [{ residualScore: "desc" }, { inherentScore: "desc" }],
        });

        const total = risks.length;
        const perYear = Math.max(1, Math.ceil(total / durationYears));
        itemsData = risks.map((r, idx) => {
          const bucket = Math.min(durationYears - 1, Math.floor(idx / perYear));
          return {
            year: startYear + bucket,
            title: r.riskName,
            departmentId: r.departmentId || null,
            riskId: r.id,
            auditType: r.auditType?.name || null,
            residualScore: r.residualScore ?? null,
            riskLevel: r.riskLevel ?? null,
            priorityRank: idx + 1,
          };
        });
      } else if (Array.isArray(body.items)) {
        itemsData = body.items.map((it: any, idx: number) => ({
          year: it.year ? parseInt(it.year) : startYear,
          title: it.title || "Untitled Audit",
          departmentId: it.departmentId || null,
          auditableEntityId: it.auditableEntityId || null,
          riskId: it.riskId || null,
          auditType: it.auditType || null,
          residualScore: it.residualScore ?? null,
          riskLevel: it.riskLevel ?? null,
          priorityRank: it.priorityRank ?? idx + 1,
          notes: it.notes || null,
        }));
      }

      const plan = await prisma.auditStrategicPlan.create({
        data: {
          customerAccountId,
          auditHeadId: auditHeadId || null,
          planCode,
          title: body.title || `Strategic Audit Plan ${startYear}-${startYear + durationYears - 1}`,
          description: body.description || null,
          durationYears,
          startYear,
          status: "Draft",
          generatedFromRisk: !!body.generateFromRisk,
          createdById: session.id || null,
          items: itemsData.length ? { create: itemsData } : undefined,
        },
        include: {
          items: { orderBy: [{ year: "asc" }, { priorityRank: "asc" }] },
          createdBy: { select: { id: true, fullName: true } },
        },
      });

      return NextResponse.json(plan, { status: 201 });
    } catch (error) {
      console.error("Error creating strategic plan:", error);
      return NextResponse.json(
        { error: "Failed to create strategic plan" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.strategic-plan", action: "create" }
);

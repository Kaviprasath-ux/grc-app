import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  withAuth,
  getTenantFilter,
  getCustomerAccountId,
  getAuditHeadId,
  resolveAuditHeadIdForCreate,
} from "@/lib/api-auth";

// GET operational plans for the tenant (Audit Head isolated).
// Optional filters: strategicPlanId, year.
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const strategicPlanId = searchParams.get("strategicPlanId");
      const year = searchParams.get("year");

      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);
      const where: any = { ...tenantFilter, ...(auditHeadId ? { auditHeadId } : {}) };
      if (strategicPlanId) where.strategicPlanId = strategicPlanId;
      if (year) where.year = parseInt(year);

      const plans = await prisma.auditOperationalPlan.findMany({
        where,
        include: {
          items: { orderBy: [{ priorityRank: "asc" }] },
          // Quarter reports: metadata only — never pull the binary blob into list payloads.
          quarterReports: {
            select: {
              id: true,
              quarter: true,
              status: true,
              reportDocName: true,
              notes: true,
              uploadedAt: true,
            },
            orderBy: [{ quarter: "asc" }],
          },
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ year: "asc" }],
      });

      // Strip approval-doc binary from list payloads
      const safe = plans.map((p) => {
        const { approvalDocData, ...rest } = p as any;
        return { ...rest, hasApprovalDoc: !!p.approvalDocName };
      });

      return NextResponse.json(safe);
    } catch (error) {
      console.error("Error fetching operational plans:", error);
      return NextResponse.json(
        { error: "Failed to fetch operational plans" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.operational-plan", action: "view" }
);

// POST create (generate) an operational plan for a specific year of a strategic plan.
// Body: { strategicPlanId, year }
// Items are seeded from the strategic plan items scheduled in that year.
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const { strategicPlanId, year } = body;

      if (!strategicPlanId || year === undefined) {
        return NextResponse.json(
          { error: "strategicPlanId and year are required" },
          { status: 400 }
        );
      }

      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = await resolveAuditHeadIdForCreate(session);
      const tenantFilter = getTenantFilter(session);
      const yearNum = parseInt(year);

      if (!customerAccountId) {
        return NextResponse.json(
          { error: "No customer account associated with this user" },
          { status: 400 }
        );
      }

      // Validate the strategic plan belongs to this tenant
      const strategicPlan = await prisma.auditStrategicPlan.findFirst({
        where: { id: strategicPlanId, ...tenantFilter },
        include: { items: true },
      });
      if (!strategicPlan) {
        return NextResponse.json({ error: "Strategic plan not found" }, { status: 404 });
      }

      // One operational plan per (strategicPlan, year)
      const existing = await prisma.auditOperationalPlan.findFirst({
        where: { strategicPlanId, year: yearNum },
      });
      if (existing) {
        return NextResponse.json(
          { error: "An operational plan already exists for this year" },
          { status: 409 }
        );
      }

      // Generate plan code (OAP001, ...) scoped to tenant
      const existingPlans = await prisma.auditOperationalPlan.findMany({
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
      const planCode = `OAP${String(maxNum + 1).padStart(3, "0")}`;

      // Seed items from the strategic plan items for this year
      const seedItems = strategicPlan.items
        .filter((it) => it.year === yearNum)
        .map((it) => ({
          title: it.title,
          departmentId: it.departmentId,
          auditableEntityId: it.auditableEntityId,
          riskId: it.riskId,
          auditType: it.auditType,
          residualScore: it.residualScore,
          riskLevel: it.riskLevel,
          priorityRank: it.priorityRank,
        }));

      const plan = await prisma.auditOperationalPlan.create({
        data: {
          customerAccountId,
          auditHeadId: auditHeadId || null,
          strategicPlanId,
          year: yearNum,
          planCode,
          title: `Operational Audit Plan ${yearNum}`,
          status: "Draft",
          createdById: session.id || null,
          items: seedItems.length ? { create: seedItems } : undefined,
        },
        include: {
          items: { orderBy: [{ priorityRank: "asc" }] },
          createdBy: { select: { id: true, fullName: true } },
        },
      });

      return NextResponse.json(plan, { status: 201 });
    } catch (error) {
      console.error("Error creating operational plan:", error);
      return NextResponse.json(
        { error: "Failed to create operational plan" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.operational-plan", action: "create" }
);

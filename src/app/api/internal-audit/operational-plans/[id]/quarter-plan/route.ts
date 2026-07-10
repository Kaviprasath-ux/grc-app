import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

// PUT - set the per-quarter Annual-Audit-Plan fields for one quarter of a plan.
// Body: { quarter, residualScore, riskLevel, proposedPeriodical, estimatedHours, auditorInChargeId }
export const PUT = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const body = await req.json();
      const quarter = String(body.quarter || "");
      if (!QUARTERS.includes(quarter)) {
        return NextResponse.json({ error: "Invalid quarter" }, { status: 400 });
      }

      const plan = await prisma.auditOperationalPlan.findUnique({
        where: { id },
        select: { id: true, customerAccountId: true, quarterPlans: true },
      });
      if (!plan) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, plan.customerAccountId)) {
        return forbidden("Access denied");
      }

      const all: Record<string, unknown> = plan.quarterPlans ? JSON.parse(plan.quarterPlans) : {};
      const toNum = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));
      all[quarter] = {
        residualScore: toNum(body.residualScore),
        riskLevel: body.riskLevel || null,
        proposedPeriodical: body.proposedPeriodical || null,
        estimatedHours: toNum(body.estimatedHours),
        auditorInChargeId: body.auditorInChargeId || null,
      };

      await prisma.auditOperationalPlan.update({
        where: { id },
        data: { quarterPlans: JSON.stringify(all) },
      });

      return NextResponse.json({ quarter, data: all[quarter] });
    } catch (error) {
      console.error("Error saving quarter plan:", error);
      return NextResponse.json({ error: "Failed to save quarter plan" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "edit" }
);

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET a single strategic plan with its items
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const plan = await prisma.auditStrategicPlan.findFirst({
        where: { id, ...tenantFilter },
        include: {
          items: { orderBy: [{ year: "asc" }, { priorityRank: "asc" }] },
          createdBy: { select: { id: true, fullName: true } },
        },
      });

      if (!plan) {
        return NextResponse.json({ error: "Strategic plan not found" }, { status: 404 });
      }

      // Never ship the signed-copy binary in the JSON payload
      const { signedCopyData, ...safe } = plan as any;
      return NextResponse.json({ ...safe, hasSignedCopy: !!plan.signedCopyName });
    } catch (error) {
      console.error("Error fetching strategic plan:", error);
      return NextResponse.json({ error: "Failed to fetch strategic plan" }, { status: 500 });
    }
  },
  { resource: "audit.strategic-plan", action: "view" }
);

// PUT update plan metadata and optionally replace its items.
// Approved plans are locked from edits (re-open by clearing the signed copy via the approve route is not allowed here).
export const PUT = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const body = await req.json();

      const existing = await prisma.auditStrategicPlan.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Strategic plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied");
      }
      if (existing.status === "Approved") {
        return NextResponse.json(
          { error: "Approved plans cannot be edited" },
          { status: 409 }
        );
      }

      const durationYears =
        body.durationYears !== undefined && [3, 4, 5].includes(Number(body.durationYears))
          ? Number(body.durationYears)
          : existing.durationYears;

      // Replace items if a new list is supplied
      if (Array.isArray(body.items)) {
        await prisma.auditStrategicPlanItem.deleteMany({ where: { strategicPlanId: id } });
      }

      const plan = await prisma.auditStrategicPlan.update({
        where: { id },
        data: {
          title: body.title ?? existing.title,
          description: body.description !== undefined ? body.description : existing.description,
          durationYears,
          startYear: body.startYear !== undefined ? parseInt(body.startYear) : existing.startYear,
          status: body.status ?? existing.status,
          ...(Array.isArray(body.items)
            ? {
                items: {
                  create: body.items.map((it: any, idx: number) => ({
                    year: it.year ? parseInt(it.year) : existing.startYear,
                    title: it.title || "Untitled Audit",
                    departmentId: it.departmentId || null,
                    auditableEntityId: it.auditableEntityId || null,
                    riskId: it.riskId || null,
                    auditType: it.auditType || null,
                    residualScore: it.residualScore ?? null,
                    riskLevel: it.riskLevel ?? null,
                    priorityRank: it.priorityRank ?? idx + 1,
                    notes: it.notes || null,
                  })),
                },
              }
            : {}),
        },
        include: {
          items: { orderBy: [{ year: "asc" }, { priorityRank: "asc" }] },
          createdBy: { select: { id: true, fullName: true } },
        },
      });

      const { signedCopyData, ...safe } = plan as any;
      return NextResponse.json({ ...safe, hasSignedCopy: !!plan.signedCopyName });
    } catch (error) {
      console.error("Error updating strategic plan:", error);
      return NextResponse.json({ error: "Failed to update strategic plan" }, { status: 500 });
    }
  },
  { resource: "audit.strategic-plan", action: "edit" }
);

// DELETE a strategic plan (items cascade)
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      const existing = await prisma.auditStrategicPlan.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Strategic plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied");
      }

      await prisma.auditStrategicPlan.delete({ where: { id } });
      return NextResponse.json({ message: "Strategic plan deleted successfully" });
    } catch (error) {
      console.error("Error deleting strategic plan:", error);
      return NextResponse.json({ error: "Failed to delete strategic plan" }, { status: 500 });
    }
  },
  { resource: "audit.strategic-plan", action: "delete" }
);

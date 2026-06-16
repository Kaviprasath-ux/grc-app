import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string; itemId: string }>;
}

// PATCH update an audit within an operational plan
export const PATCH = withAuth(
  async (req, context, session) => {
    try {
      const { id, itemId } = await (context as RouteContext).params;
      const body = await req.json();

      const plan = await prisma.auditOperationalPlan.findUnique({ where: { id } });
      if (!plan) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, plan.customerAccountId)) {
        return forbidden("Access denied");
      }

      const existing = await prisma.auditOperationalPlanItem.findFirst({
        where: { id: itemId, operationalPlanId: id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Audit not found" }, { status: 404 });
      }

      const item = await prisma.auditOperationalPlanItem.update({
        where: { id: itemId },
        data: {
          title: body.title ?? existing.title,
          departmentId: body.departmentId !== undefined ? body.departmentId : existing.departmentId,
          auditType: body.auditType !== undefined ? body.auditType : existing.auditType,
          plannedQuarter: body.plannedQuarter !== undefined ? body.plannedQuarter : existing.plannedQuarter,
          assignedAuditorId: body.assignedAuditorId !== undefined ? body.assignedAuditorId : existing.assignedAuditorId,
          notes: body.notes !== undefined ? body.notes : existing.notes,
        },
      });

      return NextResponse.json(item);
    } catch (error) {
      console.error("Error updating operational plan item:", error);
      return NextResponse.json({ error: "Failed to update audit" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "edit" }
);

// DELETE an audit from an operational plan
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const { id, itemId } = await (context as RouteContext).params;

      const plan = await prisma.auditOperationalPlan.findUnique({ where: { id } });
      if (!plan) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, plan.customerAccountId)) {
        return forbidden("Access denied");
      }

      const existing = await prisma.auditOperationalPlanItem.findFirst({
        where: { id: itemId, operationalPlanId: id },
      });
      if (!existing) {
        return NextResponse.json({ error: "Audit not found" }, { status: 404 });
      }

      await prisma.auditOperationalPlanItem.delete({ where: { id: itemId } });
      return NextResponse.json({ message: "Audit deleted" });
    } catch (error) {
      console.error("Error deleting operational plan item:", error);
      return NextResponse.json({ error: "Failed to delete audit" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "delete" }
);

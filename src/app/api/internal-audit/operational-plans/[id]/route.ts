import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET a single operational plan with items
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const tenantFilter = getTenantFilter(session);

      const plan = await prisma.auditOperationalPlan.findFirst({
        where: { id, ...tenantFilter },
        include: {
          items: { orderBy: [{ priorityRank: "asc" }] },
          createdBy: { select: { id: true, fullName: true } },
          strategicPlan: { select: { id: true, planCode: true, title: true } },
        },
      });

      if (!plan) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }

      const { approvalDocData, ...safe } = plan as any;
      return NextResponse.json({ ...safe, hasApprovalDoc: !!plan.approvalDocName });
    } catch (error) {
      console.error("Error fetching operational plan:", error);
      return NextResponse.json({ error: "Failed to fetch operational plan" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "view" }
);

// PUT update operational plan metadata (title, status)
export const PUT = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;
      const body = await req.json();

      const existing = await prisma.auditOperationalPlan.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied");
      }

      const plan = await prisma.auditOperationalPlan.update({
        where: { id },
        data: {
          title: body.title ?? existing.title,
          status: body.status ?? existing.status,
        },
        include: {
          items: { orderBy: [{ priorityRank: "asc" }] },
          createdBy: { select: { id: true, fullName: true } },
        },
      });

      const { approvalDocData, ...safe } = plan as any;
      return NextResponse.json({ ...safe, hasApprovalDoc: !!plan.approvalDocName });
    } catch (error) {
      console.error("Error updating operational plan:", error);
      return NextResponse.json({ error: "Failed to update operational plan" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "edit" }
);

// DELETE an operational plan (items cascade)
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      const existing = await prisma.auditOperationalPlan.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Operational plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied");
      }

      await prisma.auditOperationalPlan.delete({ where: { id } });
      return NextResponse.json({ message: "Operational plan deleted successfully" });
    } catch (error) {
      console.error("Error deleting operational plan:", error);
      return NextResponse.json({ error: "Failed to delete operational plan" }, { status: 500 });
    }
  },
  { resource: "audit.operational-plan", action: "delete" }
);

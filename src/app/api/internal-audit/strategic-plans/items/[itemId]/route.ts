import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ itemId: string }>;
}

type Session = Parameters<typeof validateTenantAccess>[0];

// Load an item with its parent plan, enforcing tenant access. Returns null
// (with the response already built) when not found / forbidden / locked.
async function loadItem(itemId: string, session: Session) {
  const item = await prisma.auditStrategicPlanItem.findUnique({
    where: { id: itemId },
    include: { strategicPlan: true },
  });
  if (!item) return { error: NextResponse.json({ error: "Item not found" }, { status: 404 }) };
  if (!validateTenantAccess(session, item.strategicPlan.customerAccountId)) {
    return { error: forbidden("Access denied") };
  }
  if (item.strategicPlan.status === "Approved") {
    return { error: NextResponse.json({ error: "Approved plans cannot be edited" }, { status: 409 }) };
  }
  return { item };
}

// PATCH - edit a strategic plan item (audit title, type, year, notes).
export const PATCH = withAuth(
  async (req, context, session) => {
    try {
      const { itemId } = await (context as RouteContext).params;
      const { item, error } = await loadItem(itemId, session);
      if (error) return error;

      const body = await req.json();
      const data: Record<string, unknown> = {};
      if (typeof body.title === "string") data.title = body.title.trim() || item!.title;
      if (body.auditType !== undefined) data.auditType = body.auditType?.trim() || null;
      if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
      if (body.year !== undefined && body.year !== null && body.year !== "") {
        const minY = item!.strategicPlan.startYear;
        const maxY = item!.strategicPlan.startYear + item!.strategicPlan.durationYears - 1;
        data.year = Math.min(maxY, Math.max(minY, Number(body.year)));
      }

      const updated = await prisma.auditStrategicPlanItem.update({
        where: { id: itemId },
        data,
      });
      return NextResponse.json(updated);
    } catch (e) {
      console.error("Error updating strategic plan item:", e);
      return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
    }
  },
  { resource: "audit.strategic-plan", action: "edit" }
);

// DELETE - remove a strategic plan item (the planned audit).
export const DELETE = withAuth(
  async (req, context, session) => {
    try {
      const { itemId } = await (context as RouteContext).params;
      const { item, error } = await loadItem(itemId, session);
      if (error) return error;

      await prisma.auditStrategicPlanItem.delete({ where: { id: item!.id } });
      return NextResponse.json({ message: "Item deleted" });
    } catch (e) {
      console.error("Error deleting strategic plan item:", e);
      return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
    }
  },
  { resource: "audit.strategic-plan", action: "delete" }
);

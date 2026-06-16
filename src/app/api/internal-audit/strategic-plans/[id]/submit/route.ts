import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST - submit a Draft strategic plan for approval (Draft -> Pending Approval).
// The Audit Director submits; the plan then awaits sign-off via the approve route.
export const POST = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      const existing = await prisma.auditStrategicPlan.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Strategic plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied");
      }
      if (existing.status !== "Draft") {
        return NextResponse.json(
          { error: "Only draft plans can be submitted for approval" },
          { status: 409 }
        );
      }

      const updated = await prisma.auditStrategicPlan.update({
        where: { id },
        data: { status: "Pending Approval" },
      });

      const { signedCopyData, ...safe } = updated as any;
      return NextResponse.json({ ...safe, hasSignedCopy: !!updated.signedCopyName });
    } catch (error) {
      console.error("Error submitting strategic plan for approval:", error);
      return NextResponse.json({ error: "Failed to submit strategic plan" }, { status: 500 });
    }
  },
  { resource: "audit.strategic-plan", action: "edit" }
);

// DELETE - withdraw a submission (Pending Approval -> Draft).
export const DELETE = withAuth(
  async (request: NextRequest, context, session) => {
    try {
      const { id } = await (context as RouteContext).params;

      const existing = await prisma.auditStrategicPlan.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "Strategic plan not found" }, { status: 404 });
      }
      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied");
      }
      if (existing.status !== "Pending Approval") {
        return NextResponse.json(
          { error: "Only plans pending approval can be withdrawn" },
          { status: 409 }
        );
      }

      const updated = await prisma.auditStrategicPlan.update({
        where: { id },
        data: { status: "Draft" },
      });

      const { signedCopyData, ...safe } = updated as any;
      return NextResponse.json({ ...safe, hasSignedCopy: !!updated.signedCopyName });
    } catch (error) {
      console.error("Error withdrawing strategic plan submission:", error);
      return NextResponse.json({ error: "Failed to withdraw submission" }, { status: 500 });
    }
  },
  { resource: "audit.strategic-plan", action: "edit" }
);

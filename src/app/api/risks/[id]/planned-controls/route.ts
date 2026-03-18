import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id: riskId } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const controls = await prisma.riskPlannedControl.findMany({
        where: { riskId, ...tenantFilter },
        include: {
          plannedActions: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({ success: true, data: controls });
    } catch (error) {
      console.error("Error fetching planned controls:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch planned controls" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "view" }
);

// Generate control code: UC-XXX-NNNN-YYYY format
async function generateControlCode(customerAccountId: string, functionalGrouping?: string | null): Promise<string> {
  const abbr = functionalGrouping ? functionalGrouping.substring(0, 3).toUpperCase() : "GEN";
  const year = new Date().getFullYear();
  const existingControls = await prisma.control.findMany({
    where: { customerAccountId, controlCode: { startsWith: "UC-" } },
    select: { controlCode: true },
  });
  let maxSerial = 0;
  for (const c of existingControls) {
    const m = c.controlCode.match(/UC-[A-Z]{3}-(\d+)-\d{4}/);
    if (m) { const n = parseInt(m[1], 10); if (n > maxSerial) maxSerial = n; }
  }
  return `UC-${abbr}-${String(maxSerial + 1).padStart(4, "0")}-${year}`;
}

export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id: riskId } = await context.params;
      const body = await req.json();
      const customerAccountId = getCustomerAccountId(session);

      // Generate a proper sequential control code
      const controlCode = await generateControlCode(customerAccountId, body.functionalGrouping);

      // 1. Create the actual Control record in the compliance controls table
      const complianceControl = await prisma.control.create({
        data: {
          customerAccountId,
          controlCode,
          name: body.name,
          description: body.description || null,
          controlQuestion: body.controlQuestion || null,
          functionalGrouping: body.functionalGrouping || null,
          status: "Non Compliant",
          entities: "Organization Wide",
          domainId: body.domainId || null,
          departmentId: body.departmentId || null,
          assigneeId: body.assigneeId || null,
        },
      });

      // 2. Link the control to the risk via ControlRisk junction table
      await prisma.controlRisk.create({
        data: {
          controlId: complianceControl.id,
          riskId,
        },
      });

      // 3. Create the RiskPlannedControl for risk response tracking
      const plannedControl = await prisma.riskPlannedControl.create({
        data: {
          customerAccountId,
          riskId,
          controlCode,
          name: body.name,
          description: body.description || null,
          domain: body.domain || null,
          functionalGrouping: body.functionalGrouping || null,
          relativeControlWeighting: body.relativeControlWeighting || null,
          justification: body.justification || null,
          estimatedBudget: body.estimatedBudget ? parseFloat(body.estimatedBudget) : 0,
          startDate: body.startDate ? new Date(body.startDate) : null,
          targetDate: body.targetDate ? new Date(body.targetDate) : null,
        },
        include: { plannedActions: true },
      });

      return NextResponse.json({
        success: true,
        data: { ...plannedControl, controlId: plannedControl.controlCode },
      });
    } catch (error) {
      console.error("Error adding planned control:", error);
      return NextResponse.json(
        { success: false, error: "Failed to add planned control" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "edit" }
);

export const PATCH = withAuth(
  async (req, context: RouteContext) => {
    try {
      await context.params;
      const body = await req.json();
      const { controlId } = body;

      if (!controlId) {
        return NextResponse.json(
          { success: false, error: "Control ID is required" },
          { status: 400 }
        );
      }

      const updateData: Record<string, unknown> = {};
      if (body.status !== undefined) updateData.status = body.status;
      if (body.completionPercentage !== undefined) updateData.completionPercentage = parseFloat(body.completionPercentage);
      // Enforce completion percentage based on status
      if (updateData.status === "Open") updateData.completionPercentage = 0;
      else if (updateData.status === "Completed") updateData.completionPercentage = 100;
      if (body.amountUsed !== undefined) updateData.amountUsed = parseFloat(body.amountUsed);
      if (body.remarks !== undefined) updateData.remarks = body.remarks;
      if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
      if (body.targetDate !== undefined) updateData.targetDate = body.targetDate ? new Date(body.targetDate) : null;
      if (body.estimatedBudget !== undefined) updateData.estimatedBudget = body.estimatedBudget ? parseFloat(body.estimatedBudget) : 0;
      if (body.relativeControlWeighting !== undefined) updateData.relativeControlWeighting = body.relativeControlWeighting || null;

      const updated = await prisma.riskPlannedControl.update({
        where: { id: controlId },
        data: updateData,
        include: { plannedActions: true },
      });

      return NextResponse.json({ success: true, data: updated });
    } catch (error) {
      console.error("Error updating planned control:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update planned control" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "edit" }
);

export const DELETE = withAuth(
  async (req, context: RouteContext) => {
    try {
      await context.params;
      const { searchParams } = new URL(req.url);
      const controlId = searchParams.get("controlId");

      if (!controlId) {
        return NextResponse.json(
          { success: false, error: "Control ID is required" },
          { status: 400 }
        );
      }

      await prisma.riskPlannedControl.delete({ where: { id: controlId } });

      return NextResponse.json({ success: true, message: "Control removed successfully" });
    } catch (error) {
      console.error("Error removing planned control:", error);
      return NextResponse.json(
        { success: false, error: "Failed to remove planned control" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "edit" }
);

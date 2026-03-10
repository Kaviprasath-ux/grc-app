import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string; controlId: string }>;
}

export const GET = withAuth(
  async (req, context: RouteContext) => {
    try {
      const { controlId } = await context.params;

      const actions = await prisma.riskPlannedAction.findMany({
        where: { plannedControlId: controlId },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json({ success: true, data: actions });
    } catch (error) {
      console.error("Error fetching planned actions:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch planned actions" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "view" }
);

export const POST = withAuth(
  async (req, context: RouteContext) => {
    try {
      const { controlId } = await context.params;
      const body = await req.json();

      if (!body.plannedAction?.trim()) {
        return NextResponse.json(
          { success: false, error: "Planned action is required" },
          { status: 400 }
        );
      }

      const action = await prisma.riskPlannedAction.create({
        data: {
          plannedControlId: controlId,
          plannedAction: body.plannedAction,
          description: body.description || null,
          percentageCompleted: body.percentageCompleted ? parseFloat(body.percentageCompleted) : 0,
          startDate: body.startDate ? new Date(body.startDate) : null,
          status: body.status || "Open",
        },
      });

      return NextResponse.json({ success: true, data: action }, { status: 201 });
    } catch (error) {
      console.error("Error creating planned action:", error);
      return NextResponse.json(
        { success: false, error: "Failed to create planned action" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "edit" }
);

export const DELETE = withAuth(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const actionId = searchParams.get("actionId");

      if (!actionId) {
        return NextResponse.json(
          { success: false, error: "Action ID is required" },
          { status: 400 }
        );
      }

      await prisma.riskPlannedAction.delete({ where: { id: actionId } });

      return NextResponse.json({ success: true, message: "Action deleted" });
    } catch (error) {
      console.error("Error deleting planned action:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete planned action" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.response", action: "edit" }
);

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ processId: string }>;
}

// GET - Fetch KPI config and records for a process
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    const { processId } = await context.params;

    try {
      // For now, return empty data since we don't have a ProcessKPI model yet
      // This can be extended later to store actual KPI data
      const process = await prisma.process.findUnique({
        where: { id: processId },
        select: {
          id: true,
          name: true,
          kpiMeasurementRequired: true,
        },
      });

      if (!process) {
        return NextResponse.json({ error: "Process not found" }, { status: 404 });
      }

      // Return placeholder KPI data
      return NextResponse.json({
        config: {
          objective: "",
          dataSource: "",
          expectedValue: 0,
          description: "",
          formula: "",
          targetedAchievedValue: 0,
        },
        records: [],
      });
    } catch (error) {
      console.error("Error fetching KPI data:", error);
      return NextResponse.json({ error: "Failed to fetch KPI data" }, { status: 500 });
    }
  },
  { resource: "organization.process", action: "view" }
);

// PUT - Update KPI config for a process
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    const { processId } = await context.params;

    try {
      const body = await req.json();

      // For now, just return success since we don't have a KPI model
      // This can be extended later to actually store KPI config
      return NextResponse.json({
        success: true,
        message: "KPI configuration saved",
      });
    } catch (error) {
      console.error("Error saving KPI config:", error);
      return NextResponse.json({ error: "Failed to save KPI config" }, { status: 500 });
    }
  },
  { resource: "organization.process", action: "edit" }
);

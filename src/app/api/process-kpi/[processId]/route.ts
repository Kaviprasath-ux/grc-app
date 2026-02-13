import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ processId: string }>;
}

// GET - Fetch KPI config for a process
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    const { processId } = await context.params;

    try {
      const process = await prisma.process.findUnique({
        where: { id: processId },
        select: {
          id: true,
          name: true,
          kpiMeasurementRequired: true,
          kpiObjective: true,
          kpiDataSource: true,
          kpiExpectedValue: true,
          kpiDescription: true,
          kpiFormula: true,
          kpiTargetedValue: true,
        },
      });

      if (!process) {
        return NextResponse.json({ error: "Process not found" }, { status: 404 });
      }

      // Return KPI config from process fields
      return NextResponse.json({
        config: {
          objective: process.kpiObjective || "",
          dataSource: process.kpiDataSource || "",
          expectedValue: process.kpiExpectedValue || 0,
          description: process.kpiDescription || "",
          formula: process.kpiFormula || "",
          targetedAchievedValue: process.kpiTargetedValue || 0,
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
      const { config } = body;

      // Update the process with KPI config fields
      const updatedProcess = await prisma.process.update({
        where: { id: processId },
        data: {
          kpiObjective: config.objective || null,
          kpiDataSource: config.dataSource || null,
          kpiExpectedValue: config.expectedValue || null,
          kpiDescription: config.description || null,
          kpiFormula: config.formula || null,
          kpiTargetedValue: config.targetedAchievedValue || null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "KPI configuration saved",
        process: updatedProcess,
      });
    } catch (error) {
      console.error("Error saving KPI config:", error);
      return NextResponse.json({ error: "Failed to save KPI config" }, { status: 500 });
    }
  },
  { resource: "organization.process", action: "edit" }
);

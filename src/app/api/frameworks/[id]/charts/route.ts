import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import { calculateFrameworkCharts } from "@/services/FrameworkChartService";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/frameworks/{id}/charts
 * 
 * Retrieve calculated chart data for a framework.
 * Returns compliance, policy, and evidence percentages.
 */
async function handler(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
  session: AuthenticatedRequest["user"]
) {
  const { id } = await context.params;

  try {
    // Verify framework exists and belongs to customer
    const framework = await prisma.framework.findFirst({
      where: {
        id,
        ...(session.customerAccountId && { customerAccountId: session.customerAccountId }),
      },
    });

    if (!framework) {
      return NextResponse.json(
        { error: "Framework not found" },
        { status: 404 }
      );
    }

    // Calculate charts
    const chartData = await calculateFrameworkCharts(id);

    // Update framework with calculated percentages
    await prisma.framework.update({
      where: { id },
      data: {
        compliancePercentage: chartData.compliancePercentage,
        policyPercentage: chartData.policyPercentage,
        evidencePercentage: chartData.evidencePercentage,
      },
    });

    return NextResponse.json(chartData);
  } catch (error) {
    console.error("Error calculating framework charts:", error);
    return NextResponse.json(
      { error: "Failed to calculate charts" },
      { status: 500 }
    );
  }
}

export const GET = withAuthOnly(handler);

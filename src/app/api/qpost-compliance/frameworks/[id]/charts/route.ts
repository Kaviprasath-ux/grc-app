import { NextRequest, NextResponse } from "next/server";
import { withAuthOnly, AuthenticatedRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/qpost-compliance/frameworks/{id}/charts
 *
 * Retrieve calculated chart data for a QPost framework.
 * Returns compliance, policy, and evidence percentages.
 *
 * Note: Unlike the standard compliance charts endpoint, this does not use
 * FrameworkChartService since that service operates on standard Framework models.
 * Instead, it calculates percentages directly from QPost models.
 */
async function handler(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
  session: AuthenticatedRequest["user"]
) {
  const { id } = await context.params;

  try {
    // Verify framework exists and belongs to customer
    const framework = await prisma.qPostFramework.findFirst({
      where: {
        id,
        ...(session.customerAccountId && { customerAccountId: session.customerAccountId }),
      },
      include: {
        requirements: {
          include: {
            evidences: {
              include: {
                evidence: {
                  select: { id: true, status: true },
                },
              },
            },
            policies: {
              include: {
                policy: {
                  select: { id: true, status: true },
                },
              },
            },
          },
        },
      },
    });

    if (!framework) {
      return NextResponse.json(
        { error: "Framework not found" },
        { status: 404 }
      );
    }

    const requirements = framework.requirements;

    // Calculate compliance percentage based on requirement implementationStatus
    let compliancePercentage = 0;
    if (requirements.length > 0) {
      const implementedCount = requirements.filter(r => r.implementationStatus === "Implemented").length;
      compliancePercentage = Math.round((implementedCount / requirements.length) * 1000) / 10;
    }

    // Calculate policy percentage: requirements with at least one linked policy vs total
    let policyPercentage = 0;
    if (requirements.length > 0) {
      const withPolicy = requirements.filter(r => r.policies && r.policies.length > 0).length;
      policyPercentage = Math.round((withPolicy / requirements.length) * 1000) / 10;
    }

    // Calculate evidence percentage: requirements with at least one linked evidence vs total
    let evidencePercentage = 0;
    if (requirements.length > 0) {
      const withEvidence = requirements.filter(r => r.evidences && r.evidences.length > 0).length;
      evidencePercentage = Math.round((withEvidence / requirements.length) * 1000) / 10;
    }

    const chartData = {
      compliancePercentage,
      policyPercentage,
      evidencePercentage,
    };

    // Update framework with calculated percentages
    await prisma.qPostFramework.update({
      where: { id },
      data: {
        compliancePercentage: chartData.compliancePercentage,
        policyPercentage: chartData.policyPercentage,
        evidencePercentage: chartData.evidencePercentage,
      },
    });

    return NextResponse.json(chartData);
  } catch (error) {
    console.error("Error calculating QPost framework charts:", error);
    return NextResponse.json(
      { error: "Failed to calculate charts" },
      { status: 500 }
    );
  }
}

export const GET = withAuthOnly(handler);

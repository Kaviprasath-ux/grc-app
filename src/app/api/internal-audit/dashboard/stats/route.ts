import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Multi-tenant: Build filter based on customerAccountId
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;

    // Build tenant filter (GRCAdmin sees all, others see only their tenant)
    const tenantFilter = !isGRCAdmin && customerAccountId
      ? { customerAccountId }
      : {};

    // Total risks identified
    const totalRisksIdentified = await prisma.internalAuditRisk.count({
      where: tenantFilter,
    });

    // Risks with extreme severity (riskLevel = "Extreme" or very high score)
    const risksWithExtremeSeverity = await prisma.internalAuditRisk.count({
      where: {
        ...tenantFilter,
        OR: [
          { riskLevel: "Extreme" },
          { riskLevel: "Very High" },
          { residualScore: { gte: 250 } },
        ],
      },
    });

    // Ongoing audits (status = "In Progress" or "Planned")
    const ongoingAudits = await prisma.auditEngagement.count({
      where: {
        ...tenantFilter,
        status: { in: ["In Progress", "Planned", "InProgress"] },
      },
    });

    // Completed audits
    const completedAudits = await prisma.auditEngagement.count({
      where: {
        ...tenantFilter,
        status: "Completed",
      },
    });

    return NextResponse.json({
      totalRisksIdentified,
      risksWithExtremeSeverity,
      ongoingAudits,
      completedAudits,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}

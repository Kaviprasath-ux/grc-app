import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET dashboard statistics
export async function GET(request: NextRequest) {
  try {
    // Total risks identified
    const totalRisksIdentified = await prisma.internalAuditRisk.count();

    // Risks with extreme severity (riskLevel = "Extreme" or very high score)
    const risksWithExtremeSeverity = await prisma.internalAuditRisk.count({
      where: {
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
        status: { in: ["In Progress", "Planned", "InProgress"] },
      },
    });

    // Completed audits
    const completedAudits = await prisma.auditEngagement.count({
      where: {
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

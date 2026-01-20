import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET risk counts by rating
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

    // Get risk counts grouped by risk level (with tenant filter)
    const risks = await prisma.internalAuditRisk.groupBy({
      by: ["riskLevel"],
      where: tenantFilter,
      _count: {
        id: true,
      },
    });

    // Define the rating levels with their colors
    const ratingConfig = [
      { name: "Extreme", color: "#ef4444" },
      { name: "High", color: "#f97316" },
      { name: "Medium", color: "#eab308" },
      { name: "Low", color: "#22c55e" },
    ];

    // Map the results to include all levels
    const riskByRating = ratingConfig.map((config) => {
      const found = risks.find((r) => r.riskLevel === config.name);
      return {
        name: config.name,
        value: found ? found._count.id : 0,
        color: config.color,
      };
    });

    return NextResponse.json(riskByRating);
  } catch (error) {
    console.error("Error fetching risk by rating:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk by rating" },
      { status: 500 }
    );
  }
}

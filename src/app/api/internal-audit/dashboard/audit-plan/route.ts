import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET annual audit plan
export async function GET(request: NextRequest) {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    // Get audit engagements for the current year
    let engagements: any[] = [];
    try {
      engagements = await prisma.auditEngagement.findMany({
        where: {
          year: currentYear,
        },
        include: {
          auditableEntity: true,
        },
        orderBy: { plannedStartDate: "asc" },
      });
    } catch (e: any) {
      if (e.code === "P2021") {
        return NextResponse.json([]);
      }
      throw e;
    }

    // Transform to audit plan format
    const auditPlan = engagements.map((engagement) => {
      const startMonth = engagement.plannedStartDate
        ? new Date(engagement.plannedStartDate).getMonth()
        : 0;
      const endMonth = engagement.plannedEndDate
        ? new Date(engagement.plannedEndDate).getMonth()
        : startMonth;

      // Calculate days
      let days = 0;
      if (engagement.plannedStartDate && engagement.plannedEndDate) {
        const diffTime = Math.abs(
          new Date(engagement.plannedEndDate).getTime() -
            new Date(engagement.plannedStartDate).getTime()
        );
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      return {
        name: engagement.engagementTitle || engagement.auditableEntity?.name || "Unnamed Audit",
        days,
        startMonth,
        endMonth,
      };
    });

    return NextResponse.json(auditPlan);
  } catch (error) {
    console.error("Error fetching audit plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit plan" },
      { status: 500 }
    );
  }
}

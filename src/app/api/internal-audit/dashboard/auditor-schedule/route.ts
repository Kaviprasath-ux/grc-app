import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET auditor schedule
export async function GET(request: NextRequest) {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31);

    // Get audit engagements with auditors for the current year
    let engagements: any[] = [];
    try {
      engagements = await prisma.auditEngagement.findMany({
        where: {
          year: currentYear,
        },
        include: {
          assignedAuditor: true,
        },
      });
    } catch (e: any) {
      if (e.code === "P2021") {
        return NextResponse.json([]);
      }
      throw e;
    }

    // Group by auditor
    const auditorMap = new Map<
      string,
      {
        name: string;
        assignments: { month: number; duration: number }[];
      }
    >();

    engagements.forEach((engagement) => {
      const auditorName = engagement.assignedAuditor?.name || "Unassigned";
      if (auditorName === "Unassigned") return;

      if (!auditorMap.has(auditorName)) {
        auditorMap.set(auditorName, {
          name: auditorName,
          assignments: [],
        });
      }

      const auditor = auditorMap.get(auditorName)!;

      if (engagement.plannedStartDate) {
        const startMonth = new Date(engagement.plannedStartDate).getMonth();
        const endMonth = engagement.plannedEndDate
          ? new Date(engagement.plannedEndDate).getMonth()
          : startMonth;

        // Add assignment for each month in range
        for (let month = startMonth; month <= endMonth; month++) {
          const existing = auditor.assignments.find((a) => a.month === month);
          if (!existing) {
            auditor.assignments.push({ month, duration: 1 });
          }
        }
      }
    });

    const result = Array.from(auditorMap.values());

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching auditor schedule:", error);
    return NextResponse.json(
      { error: "Failed to fetch auditor schedule" },
      { status: 500 }
    );
  }
}

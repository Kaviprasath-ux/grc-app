import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET risk statistics for dashboard
export async function GET() {
  try {
    // Get all risks with related data
    const risks = await prisma.risk.findMany({
      include: {
        category: true,
      },
    });

    // Total counts (matching website: Total, Open, In Progress, Closed)
    const totalRisks = risks.length;
    const openRisks = risks.filter((r) => r.status === "Open").length;
    const inProgressRisks = risks.filter((r) => r.status === "In Progress").length;
    const closedRisks = risks.filter((r) => r.status === "Closed").length;

    // Risk rating distribution (matching website: Catastrophic, Very high, High, Low Risk)
    const riskRatingCounts = {
      Catastrophic: risks.filter((r) => r.riskRating === "Catastrophic").length,
      "Very high": risks.filter((r) => r.riskRating === "Very high").length,
      High: risks.filter((r) => r.riskRating === "High").length,
      "Low Risk": risks.filter((r) => r.riskRating === "Low Risk").length,
    };

    const highCriticalRisks =
      riskRatingCounts.Catastrophic +
      riskRatingCounts["Very high"] +
      riskRatingCounts.High;

    // Risk by category
    const categoryMap = new Map<string, number>();
    risks.forEach((risk) => {
      const categoryName = risk.category?.name || "Uncategorized";
      categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
    });

    const riskByCategory = Array.from(categoryMap.entries()).map(
      ([name, count]) => ({
        name,
        value: count,
      })
    );

    // Risk by status with colors (matching website)
    // Colors: Awaiting Approval (black), Pending Assessment (blue), Open (red), In Progress (yellow), Closed (green)
    const statusColors: Record<string, string> = {
      "Awaiting Approval": "#374151",
      "Pending Assessment": "#3B82F6",
      "Open": "#EF4444",
      "In Progress": "#FBBF24",
      "Closed": "#22C55E",
    };

    const statusMap = new Map<string, number>();
    risks.forEach((risk) => {
      statusMap.set(risk.status, (statusMap.get(risk.status) || 0) + 1);
    });

    const riskByStatus = Array.from(statusMap.entries()).map(
      ([name, count]) => ({
        name,
        value: count,
        color: statusColors[name] || "#6B7280",
      })
    );

    // Risk rating distribution for chart (matching website: Catastrophic, Very high, High, Low Risk)
    const riskRatingDistribution = [
      { name: "Catastrophic", value: riskRatingCounts.Catastrophic, color: "#dc2626" },
      { name: "Very high", value: riskRatingCounts["Very high"], color: "#ea580c" },
      { name: "High", value: riskRatingCounts.High, color: "#f59e0b" },
      { name: "Low Risk", value: riskRatingCounts["Low Risk"], color: "#22c55e" },
    ];

    // Response strategy distribution
    const responseMap = new Map<string, number>();
    risks.forEach((risk) => {
      if (risk.responseStrategy) {
        responseMap.set(
          risk.responseStrategy,
          (responseMap.get(risk.responseStrategy) || 0) + 1
        );
      }
    });

    const riskByResponse = Array.from(responseMap.entries()).map(
      ([name, count]) => ({
        name,
        value: count,
      })
    );

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyData: { month: string; open: number; mitigated: number; closed: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStr = date.toLocaleString("default", { month: "short" });
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthRisks = risks.filter((r) => {
        const created = new Date(r.createdAt);
        return created >= startOfMonth && created <= endOfMonth;
      });

      monthlyData.push({
        month: monthStr,
        open: monthRisks.filter((r) => r.status === "Open").length,
        mitigated: monthRisks.filter((r) => r.status === "Mitigate").length,
        closed: monthRisks.filter((r) => r.status === "Closed").length,
      });
    }

    // Risk matrix data (5x5 grid)
    const matrixData: { likelihood: number; impact: number; count: number; risks: string[] }[] = [];
    for (let l = 1; l <= 5; l++) {
      for (let i = 1; i <= 5; i++) {
        const cellRisks = risks.filter(
          (r) => r.likelihood === l && r.impact === i
        );
        matrixData.push({
          likelihood: l,
          impact: i,
          count: cellRisks.length,
          risks: cellRisks.map((r) => r.riskId),
        });
      }
    }

    // Risk by rating for bar chart (matching website: Catastrophic, Very high, High, Low Risk)
    const riskByRating = [
      { name: "Catastrophic", value: riskRatingCounts.Catastrophic },
      { name: "Very high", value: riskRatingCounts["Very high"] },
      { name: "High", value: riskRatingCounts.High },
      { name: "Low Risk", value: riskRatingCounts["Low Risk"] },
    ].filter((item) => item.value > 0);

    // Risk by strategy (Treat, Transfer, Avoid, Accept)
    const strategyMap = new Map<string, number>();
    risks.forEach((risk) => {
      const strategy = risk.responseStrategy || "Unassigned";
      strategyMap.set(strategy, (strategyMap.get(strategy) || 0) + 1);
    });

    const riskByStrategy = Array.from(strategyMap.entries()).map(
      ([name, count]) => ({
        name,
        value: count,
      })
    );

    return NextResponse.json({
      summary: {
        totalRisks,
        openRisks,
        inProgressRisks,
        closedRisks,
        highCriticalRisks,
      },
      charts: {
        riskByCategory,
        riskByStatus,
        riskByRating,
        riskByStrategy,
        riskRatingDistribution,
        riskByResponse,
        monthlyTrend: monthlyData,
        riskMatrix: matrixData,
      },
    });
  } catch (error) {
    console.error("Error fetching risk stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch risk statistics" },
      { status: 500 }
    );
  }
}

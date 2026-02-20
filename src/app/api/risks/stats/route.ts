import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getDataScopeFilter } from "@/lib/api-auth";

// GET risk statistics for dashboard - filtered by customer account and department scope
export const GET = withAuth(
  async (req, context, session) => {
    try {
      // Get tenant filter for multi-tenant isolation
      const tenantFilter = getTenantFilter(session);

      // Get department scope filter for DepartmentContributor/DepartmentReviewer roles
      const scopeFilter = getDataScopeFilter(session, "risk.register", "view");

      // Get all risks with related data (filtered by tenant and scope)
      const risks = await prisma.risk.findMany({
        where: {
          ...tenantFilter,
          ...scopeFilter,
        },
        include: {
          category: true,
        },
      });

    // Total counts (matching website: Total, Open, In Progress, Closed)
    const totalRisks = risks.length;
    const openRisks = risks.filter((r) => r.status === "Open").length;
    const inProgressRisks = risks.filter((r) => r.status === "In Progress").length;
    const closedRisks = risks.filter((r) => r.status === "Closed").length;

    // Risk rating distribution - dynamically count all rating values from data
    const riskRatingMap = new Map<string, number>();
    risks.forEach((risk) => {
      const rating = risk.riskRating || "Unrated";
      riskRatingMap.set(rating, (riskRatingMap.get(rating) || 0) + 1);
    });

    // Define rating colors and severity order
    const ratingColors: Record<string, string> = {
      "Catastrophic": "#7f1d1d",
      "Extreme": "#991b1b",
      "Very high": "#dc2626",
      "Very High": "#dc2626",
      "High": "#f59e0b",
      "Medium": "#eab308",
      "Low Risk": "#22c55e",
      "Low": "#16a34a",
      "Unrated": "#9ca3af",
    };

    // High/critical risks count (any rating that's High or above)
    const highCriticalLabels = ["Catastrophic", "Extreme", "Very high", "Very High", "High"];
    const highCriticalRisks = risks.filter((r) => highCriticalLabels.includes(r.riskRating || "")).length;

    // Risk by category
    const categoryMap = new Map<string, { id: string; name: string; count: number }>();
    risks.forEach((risk) => {
      const categoryName = risk.category?.name || "Uncategorized";
      const categoryId = risk.category?.id || "uncategorized";
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, { id: categoryId, name: categoryName, count: 0 });
      }
      categoryMap.get(categoryId)!.count++;
    });

    const riskByCategory = Array.from(categoryMap.values()).map(
      ({ id, name, count }) => ({
        id,
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

    // Risk rating distribution for chart - built from actual data
    const riskRatingDistribution = Array.from(riskRatingMap.entries()).map(
      ([name, count]) => ({
        name,
        value: count,
        color: ratingColors[name] || "#6B7280",
      })
    );

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

    // Risk by rating for bar chart - built from actual data
    const riskByRating = Array.from(riskRatingMap.entries())
      .map(([name, count]) => ({ name, value: count }))
      .filter((item) => item.value > 0);

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
  },
  { resource: "risk.register", action: "view" }
);

"use client";

import { useEffect, useState } from "react";
import { DonutChart, HorizontalBarChart } from "@/components/charts";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";

interface RiskStats {
  summary: {
    totalRisks: number;
  };
  charts: {
    riskByStatus: { name: string; value: number; color: string }[];
    riskByStrategy: { name: string; value: number }[];
    riskByRating: { name: string; value: number }[];
    riskByCategory: { name: string; value: number }[];
  };
}

export default function RiskDashboardPage() {
  const { canView, isLoading: permissionsLoading } = usePermissions('risk.register');
  const [stats, setStats] = useState<RiskStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/risks/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch risk stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-grc-primary"></div>
      </div>
    );
  }

  if (!canView) {
    return <Unauthorized description="You don't have permission to access the Risk Dashboard." />;
  }

  const totalRisks = stats?.summary?.totalRisks || 0;

  // Transform data for horizontal bar charts
  const riskByStrategyData = (stats?.charts?.riskByStrategy || []).map((item) => ({
    category: item.name,
    value: item.value,
  }));

  const riskByRatingData = (stats?.charts?.riskByRating || []).map((item) => ({
    category: item.name,
    value: item.value,
  }));

  const riskByCategory = stats?.charts?.riskByCategory || [];
  const riskByCategoryData = riskByCategory.map((item) => ({
    category: item.name,
    value: item.value,
  }));

  const riskByStatus = stats?.charts?.riskByStatus || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Risk by Status - Donut Chart (Top Left) */}
      <DonutChart
        title="Risk by Status"
        data={riskByStatus}
        centerLabel={totalRisks}
      />

      {/* Risk by Strategy - Horizontal Bar Chart (Top Right) */}
      <HorizontalBarChart
        title="Risk by Strategy"
        data={riskByStrategyData}
        yAxisDataKey="category"
        bars={[{ dataKey: "value", fill: "#146FF4", name: "Risks" }]}
      />

      {/* Risk by Rating - Horizontal Bar Chart (Bottom Left) */}
      <HorizontalBarChart
        title="Risk by Rating"
        data={riskByRatingData}
        yAxisDataKey="category"
        bars={[{ dataKey: "value", fill: "#146FF4", name: "Risks" }]}
      />

      {/* Risk by Category - Horizontal Bar Chart (Bottom Right) */}
      <HorizontalBarChart
        title="Risk by Category"
        data={riskByCategoryData}
        yAxisDataKey="category"
        bars={[{ dataKey: "value", fill: "#146FF4", name: "Risks" }]}
      />
    </div>
  );
}

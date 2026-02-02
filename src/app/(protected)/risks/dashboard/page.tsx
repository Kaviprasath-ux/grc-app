"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DonutChart, HorizontalBarChart } from "@/components/charts";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { Home, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const router = useRouter();
  const { t } = useLanguage();
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access the Risk Dashboard.")} />;
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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Dashboard")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Dashboard")}</h1>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk by Status - Donut Chart (Top Left) */}
        <DonutChart
          title={t("Risk by Status")}
          data={riskByStatus}
          centerLabel={totalRisks}
          onClick={() => router.push("/risks/register?from=risk-dashboard")}
        />

        {/* Risk by Strategy - Horizontal Bar Chart (Top Right) */}
        <HorizontalBarChart
          title={t("Risk by Strategy")}
          data={riskByStrategyData}
          yAxisDataKey="category"
          bars={[{ dataKey: "value", fill: "#146FF4", name: t("Risks") }]}
          onClick={() => router.push("/risks/response?from=risk-dashboard")}
        />

        {/* Risk by Rating - Horizontal Bar Chart (Bottom Left) */}
        <HorizontalBarChart
          title={t("Risk by Rating")}
          data={riskByRatingData}
          yAxisDataKey="category"
          bars={[{ dataKey: "value", fill: "#146FF4", name: t("Risks") }]}
          onClick={() => router.push("/risks/response?from=risk-dashboard")}
        />

        {/* Risk by Category - Horizontal Bar Chart (Bottom Right) */}
        <HorizontalBarChart
          title={t("Risk by Category")}
          data={riskByCategoryData}
          yAxisDataKey="category"
          bars={[{ dataKey: "value", fill: "#146FF4", name: t("Risks") }]}
          onClick={() => router.push("/risks/register?from=risk-dashboard")}
        />
      </div>
    </div>
  );
}

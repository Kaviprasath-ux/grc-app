"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  status: string;
  riskRating: string;
  responseStrategy: string | null;
  category: { name: string } | null;
}

// Chart colors
const statusColors: Record<string, string> = {
  "Open": "#3b82f6",
  "In-Progress": "#f59e0b",
  "Completed": "#22c55e",
  "Awaiting Approval": "#8b5cf6",
  "Closed": "#6b7280",
};

const ratingColors: Record<string, string> = {
  "Low Risk": "#22c55e",
  "High": "#f59e0b",
  "very high": "#eab308",
  "Catastrophic": "#ef4444",
};

const strategyColors: Record<string, string> = {
  "Accept": "#22c55e",
  "Avoid": "#3b82f6",
  "Transfer": "#8b5cf6",
  "Treat": "#f59e0b",
};

export default function RiskDashboardPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRisks = async () => {
      setLoading(true);
      const res = await fetch("/api/risks");
      const data = await res.json();
      setRisks(data);
      setLoading(false);
    };
    fetchRisks();
  }, []);

  // Calculate chart data
  const statusData = Object.entries(
    risks.reduce((acc, risk) => {
      acc[risk.status] = (acc[risk.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  );

  const strategyData = Object.entries(
    risks.reduce((acc, risk) => {
      if (risk.responseStrategy) {
        acc[risk.responseStrategy] = (acc[risk.responseStrategy] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>)
  );

  const ratingData = Object.entries(
    risks.reduce((acc, risk) => {
      acc[risk.riskRating] = (acc[risk.riskRating] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  );

  const categoryData = Object.entries(
    risks.reduce((acc, risk) => {
      const catName = risk.category?.name || "Uncategorized";
      acc[catName] = (acc[catName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).slice(0, 7);

  // Simple bar/pie chart rendering helpers
  const renderPieChart = (data: [string, number][], colors: Record<string, string>) => {
    const total = data.reduce((sum, [, count]) => sum + count, 0);
    if (total === 0) return <p className="text-muted-foreground text-center py-8">No data available</p>;

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 100 100" className="transform -rotate-90">
            {data.reduce((acc, [label, count], index) => {
              const percentage = (count / total) * 100;
              const offset = acc.offset;
              acc.offset += percentage;
              acc.elements.push(
                <circle
                  key={label}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke={colors[label] || `hsl(${index * 60}, 70%, 50%)`}
                  strokeWidth="20"
                  strokeDasharray={`${percentage * 2.51} 251`}
                  strokeDashoffset={`${-offset * 2.51}`}
                />
              );
              return acc;
            }, { offset: 0, elements: [] as React.ReactNode[] }).elements}
          </svg>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          {data.map(([label, count]) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: colors[label] || "#888" }}
              />
              <span>{label}: {count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBarChart = (data: [string, number][], colors: Record<string, string>) => {
    const maxValue = Math.max(...data.map(([, count]) => count), 1);
    if (data.length === 0) return <p className="text-muted-foreground text-center py-8">No data available</p>;

    return (
      <div className="space-y-2">
        {data.map(([label, count]) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-24 text-xs truncate">{label}</div>
            <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${(count / maxValue) * 100}%`,
                  backgroundColor: colors[label] || "#3b82f6",
                }}
              />
            </div>
            <div className="w-8 text-xs text-right">{count}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Dashboard"
        description="Overview of organizational risk metrics"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{risks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {risks.filter(r => r.status === "Open").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {risks.filter(r => r.riskRating === "High" || r.riskRating === "very high").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Catastrophic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {risks.filter(r => r.riskRating === "Catastrophic").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Risk by Status - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Risk by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {renderPieChart(statusData, statusColors)}
          </CardContent>
        </Card>

        {/* Risk by Strategy - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Risk by Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            {renderBarChart(strategyData, strategyColors)}
          </CardContent>
        </Card>

        {/* Risk by Rating - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Risk by Rating</CardTitle>
          </CardHeader>
          <CardContent>
            {renderBarChart(ratingData, ratingColors)}
          </CardContent>
        </Card>

        {/* Risk by Category - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Risk by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {renderBarChart(categoryData, {})}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, BarChart3, PieChart, Users, Tag, Layers, Target, ArrowRight, Download } from "lucide-react";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  status: string;
  riskRating: string;
  riskType: string;
  responseStrategy: string | null;
  category: { name: string } | null;
  owner: { fullName: string } | null;
}

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  groupBy: string;
}

const reportTypes: ReportType[] = [
  { id: "by-category", title: "Risk By Category", description: "View risks grouped by category", icon: Layers, groupBy: "category" },
  { id: "by-strategy", title: "Risk By Strategy", description: "View risks grouped by response strategy", icon: Target, groupBy: "responseStrategy" },
  { id: "by-rating", title: "Risk By Rating", description: "View risks grouped by risk rating", icon: BarChart3, groupBy: "riskRating" },
  { id: "by-status", title: "Risk By Status", description: "View risks grouped by status", icon: PieChart, groupBy: "status" },
  { id: "by-type", title: "Risk By Type", description: "View risks grouped by risk type", icon: Tag, groupBy: "riskType" },
  { id: "by-owner", title: "Risk By Owner", description: "View risks grouped by owner", icon: Users, groupBy: "owner" },
];

const ratingColors: Record<string, string> = {
  "Low Risk": "bg-green-500",
  "High": "bg-orange-500",
  "very high": "bg-yellow-500",
  "Catastrophic": "bg-red-500",
};

export default function RiskReportsPage() {
  const router = useRouter();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRisks = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/risks");
        setRisks(await res.json());
      } catch (error) {
        console.error("Error fetching risks:", error);
      }
      setLoading(false);
    };
    fetchRisks();
  }, []);

  // Summary statistics
  const totalRisks = risks.length;
  const highRisks = risks.filter(r => r.riskRating === "High" || r.riskRating === "very high" || r.riskRating === "Catastrophic").length;
  const openRisks = risks.filter(r => r.status === "Open").length;
  const completedRisks = risks.filter(r => r.status === "Completed").length;

  // Rating distribution
  const ratingDistribution = {
    "Low Risk": risks.filter(r => r.riskRating === "Low Risk").length,
    "High": risks.filter(r => r.riskRating === "High").length,
    "very high": risks.filter(r => r.riskRating === "very high").length,
    "Catastrophic": risks.filter(r => r.riskRating === "Catastrophic").length,
  };

  // Status distribution
  const statusDistribution = {
    "Open": risks.filter(r => r.status === "Open").length,
    "In-Progress": risks.filter(r => r.status === "In-Progress").length,
    "Completed": risks.filter(r => r.status === "Completed").length,
  };

  const getReportPreview = (reportType: ReportType) => {
    const groupBy = reportType.groupBy;
    const grouped: Record<string, number> = {};

    risks.forEach(risk => {
      let key: string;
      if (groupBy === "category") {
        key = risk.category?.name || "Uncategorized";
      } else if (groupBy === "owner") {
        key = risk.owner?.fullName || "Unassigned";
      } else if (groupBy === "responseStrategy") {
        key = risk.responseStrategy || "No Strategy";
      } else if (groupBy === "riskRating") {
        key = risk.riskRating || "Not Assessed";
      } else if (groupBy === "status") {
        key = risk.status;
      } else if (groupBy === "riskType") {
        key = risk.riskType;
      } else {
        key = "Unknown";
      }

      grouped[key] = (grouped[key] || 0) + 1;
    });

    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, count]) => ({ group: key, count }));
  };

  const handleExportAll = () => {
    const headers = ["Risk ID", "Name", "Category", "Rating", "Status", "Owner", "Strategy", "Type"];
    const rows = risks.map(risk => [
      risk.riskId,
      risk.name,
      risk.category?.name || "",
      risk.riskRating || "",
      risk.status,
      risk.owner?.fullName || "",
      risk.responseStrategy || "",
      risk.riskType,
    ]);

    const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "risk-management-report.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Reports"
        description="Generate and view risk management reports"
        actions={[
          {
            label: "Export All Risks",
            onClick: handleExportAll,
            variant: "default" as const,
            icon: Download,
          },
        ]}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRisks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{highRisks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{openRisks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedRisks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Charts */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Risk Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(ratingDistribution).map(([rating, count]) => (
                <div key={rating} className="flex items-center gap-3">
                  <div className="w-24 text-sm">{rating}</div>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${ratingColors[rating]}`}
                      style={{ width: `${totalRisks > 0 ? (count / totalRisks) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-8 text-sm text-right">{count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(statusDistribution).map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-24 text-sm">{status}</div>
                  <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all bg-primary"
                      style={{ width: `${totalRisks > 0 ? (count / totalRisks) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-8 text-sm text-right">{count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map(report => {
          const preview = getReportPreview(report);
          return (
            <Card
              key={report.id}
              className="cursor-pointer hover:shadow-lg transition-shadow group"
              onClick={() => router.push(`/risk-management/reports/${report.id}`)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <report.icon className="h-5 w-5 text-primary" />
                    {report.title}
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {preview.map(item => (
                    <div key={item.group} className="flex justify-between text-sm">
                      <span className="truncate">{item.group}</span>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                  {preview.length === 0 && (
                    <div className="text-sm text-muted-foreground">No data available</div>
                  )}
                </div>
                <Button variant="link" className="mt-4 p-0 h-auto">
                  View Full Report
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

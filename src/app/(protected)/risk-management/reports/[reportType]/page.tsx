"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { PageHeader, DataGrid } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  status: string;
  riskRating: string;
  riskType: string;
  responseStrategy: string | null;
  category: { name: string } | null;
  owner: { fullName: string } | null;
  inherentRiskRating: number | null;
  residualRiskRating: number | null;
}

interface RiskCategory {
  id: string;
  name: string;
}

const reportTitles: Record<string, string> = {
  "by-category": "Risk By Category",
  "by-strategy": "Risk By Strategy",
  "by-rating": "Risk By Rating",
  "by-status": "Risk By Status",
  "by-type": "Risk By Type",
  "by-owner": "Risk By Owner",
};

const ratingColors: Record<string, string> = {
  "Low Risk": "bg-green-500",
  "High": "bg-orange-500",
  "very high": "bg-yellow-500",
  "Catastrophic": "bg-red-500",
};

export default function RiskReportDetailPage({ params }: { params: Promise<{ reportType: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<RiskCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const reportType = resolvedParams.reportType;
  const reportTitle = reportTitles[reportType] || "Risk Report";

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [risksRes, categoriesRes] = await Promise.all([
          fetch("/api/risks"),
          fetch("/api/risk-categories"),
        ]);
        setRisks(await risksRes.json());
        setCategories(await categoriesRes.json());
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter risks
  const filteredRisks = risks.filter(risk => {
    if (categoryFilter !== "all" && risk.category?.name !== categoryFilter) return false;
    if (statusFilter !== "all" && risk.status !== statusFilter) return false;
    if (ratingFilter !== "all" && risk.riskRating !== ratingFilter) return false;
    if (typeFilter !== "all" && risk.riskType !== typeFilter) return false;
    return true;
  });

  // Get group key based on report type
  const getGroupKey = (risk: Risk): string => {
    switch (reportType) {
      case "by-category":
        return risk.category?.name || "Uncategorized";
      case "by-strategy":
        return risk.responseStrategy || "No Strategy";
      case "by-rating":
        return risk.riskRating || "Not Assessed";
      case "by-status":
        return risk.status || "Unknown";
      case "by-type":
        return risk.riskType || "Unknown";
      case "by-owner":
        return risk.owner?.fullName || "Unassigned";
      default:
        return "Unknown";
    }
  };

  // Group risks
  const groupedData = () => {
    const grouped: Record<string, Risk[]> = {};

    filteredRisks.forEach(risk => {
      const key = getGroupKey(risk);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(risk);
    });

    return Object.entries(grouped)
      .map(([group, items]) => ({ group, count: items.length, risks: items }))
      .sort((a, b) => b.count - a.count);
  };

  const groups = groupedData();

  // Summary statistics
  const totalRisks = filteredRisks.length;
  const highRisks = filteredRisks.filter(r => r.riskRating === "High" || r.riskRating === "very high" || r.riskRating === "Catastrophic").length;
  const completedRisks = filteredRisks.filter(r => r.status === "Completed").length;

  const columns: ColumnDef<Risk>[] = [
    { accessorKey: "riskId", header: "Risk ID" },
    { accessorKey: "name", header: "Risk Name" },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="truncate max-w-[200px] block">{row.original.description || "-"}</span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => row.original.category?.name || "-",
    },
    {
      accessorKey: "riskRating",
      header: "Rating",
      cell: ({ row }) => row.original.riskRating ? (
        <Badge className={ratingColors[row.original.riskRating]}>{row.original.riskRating}</Badge>
      ) : (
        <Badge variant="outline">Not Assessed</Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
    },
    {
      accessorKey: "owner",
      header: "Owner",
      cell: ({ row }) => row.original.owner?.fullName || "-",
    },
    {
      accessorKey: "responseStrategy",
      header: "Strategy",
      cell: ({ row }) => row.original.responseStrategy || "-",
    },
  ];

  const handleExport = () => {
    // Simple CSV export
    const headers = ["Risk ID", "Name", "Category", "Rating", "Status", "Owner", "Strategy"];
    const rows = filteredRisks.map(risk => [
      risk.riskId,
      risk.name,
      risk.category?.name || "",
      risk.riskRating || "",
      risk.status,
      risk.owner?.fullName || "",
      risk.responseStrategy || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={reportTitle}
        description="Risk Management Report"
        actions={[
          {
            label: "Back",
            onClick: () => router.push("/risk-management/reports"),
            variant: "outline" as const,
            icon: ArrowLeft,
          },
          {
            label: "Export CSV",
            onClick: handleExport,
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedRisks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {groups.map(group => (
              <div key={group.group} className="flex items-center gap-3">
                <div className="w-32 text-sm truncate">{group.group}</div>
                <div className="flex-1 h-8 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      reportType === "by-rating" ? (ratingColors[group.group] || "bg-gray-400") : "bg-primary"
                    )}
                    style={{ width: `${totalRisks > 0 ? (group.count / totalRisks) * 100 : 0}%` }}
                  />
                </div>
                <div className="w-16 text-sm text-right">
                  {group.count} ({totalRisks > 0 ? ((group.count / totalRisks) * 100).toFixed(1) : 0}%)
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In-Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Risk Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="Low Risk">Low Risk</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="very high">Very High</SelectItem>
                <SelectItem value="Catastrophic">Catastrophic</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Risk Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Asset Risk">Asset Risk</SelectItem>
                <SelectItem value="Process Risk">Process Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grouped Data Tables */}
      {groups.map(group => (
        <Card key={group.group}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{group.group}</span>
                {reportType === "by-rating" && (
                  <Badge className={ratingColors[group.group]}>{group.group}</Badge>
                )}
              </div>
              <Badge variant="secondary">{group.count} risks</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataGrid columns={columns} data={group.risks} />
          </CardContent>
        </Card>
      ))}

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No risks found matching the selected filters
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface KPI {
  id: string;
  code: string;
  objective: string | null;
  description: string | null;
  expectedScore: number | null;
  actualScore: number | null;
  reviewDate: string | null;
  status: string;
  department?: { id: string; name: string } | null;
  evidence?: {
    id: string;
    evidenceCode: string;
    name: string;
    reviewDate: string | null;
    department?: { id: string; name: string } | null;
  } | null;
}

const statusColors: Record<string, string> = {
  Scheduled: "bg-info-light text-info-dark",
  Missed: "bg-error-light text-error-dark",
  Overdue: "bg-warning-light text-warning-dark",
  Achieved: "bg-success-light text-success-dark",
};

const statuses = ["Scheduled", "Missed", "Overdue", "Achieved"];

export default function KPIsPage() {
  const router = useRouter();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchKPIs = useCallback(async () => {
    try {
      const response = await fetch("/api/kpis");
      if (response.ok) {
        const result = await response.json();
        setKpis(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching KPIs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  // Filter KPIs based on search and status
  const filteredKpis = kpis.filter((kpi) => {
    const matchesSearch =
      !searchTerm ||
      kpi.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kpi.objective?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kpi.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kpi.evidence?.evidenceCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || kpi.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Status counts
  const statusCounts = {
    total: kpis.length,
    scheduled: kpis.filter((k) => k.status === "Scheduled").length,
    missed: kpis.filter((k) => k.status === "Missed").length,
    overdue: kpis.filter((k) => k.status === "Overdue").length,
    achieved: kpis.filter((k) => k.status === "Achieved").length,
  };

  // Department counts - use evidence department if KPI department is not set
  const departmentCounts = kpis.reduce(
    (acc, kpi) => {
      const deptName =
        kpi.department?.name || kpi.evidence?.department?.name || "Unassigned";
      acc[deptName] = (acc[deptName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate status percentages
  const getStatusPercentage = (count: number) => {
    if (statusCounts.total === 0) return 0;
    return Math.round((count / statusCounts.total) * 100 * 10) / 10;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">KPI Dashboard</h1>
      </div>

      {/* Search and Filter Row */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by code, objective or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md bg-white"
        />
        <Select
          value={statusFilter || "all"}
          onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
      </div>

      {/* Summary Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Status Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Status</h3>
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-info" />
                <span className="text-sm text-slate-600">Scheduled</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {getStatusPercentage(statusCounts.scheduled)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-error" />
                <span className="text-sm text-slate-600">Missed</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {getStatusPercentage(statusCounts.missed)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-warning" />
                <span className="text-sm text-slate-600">Overdue</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {getStatusPercentage(statusCounts.overdue)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-success" />
                <span className="text-sm text-slate-600">Achieved</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {getStatusPercentage(statusCounts.achieved)}%
                </span>
              </div>
            </div>
            <div className="text-center ml-8">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-3xl font-bold text-slate-800">{statusCounts.total}</p>
            </div>
          </div>
        </div>

        {/* Department Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Department</h3>
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              {Object.entries(departmentCounts)
                .slice(0, 4)
                .map(([dept, count], idx) => (
                  <div key={dept} className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full ${
                        idx === 0
                          ? "bg-info"
                          : idx === 1
                            ? "bg-success"
                            : idx === 2
                              ? "bg-warning"
                              : "bg-primary-500"
                      }`}
                    />
                    <span className="text-sm text-slate-600 truncate max-w-[150px]">
                      {dept}
                    </span>
                    <span className="text-sm font-medium text-slate-800 ml-auto">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
            <div className="text-center ml-8">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-3xl font-bold text-slate-800">{statusCounts.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 py-3">Code</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">KPI Objective</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">KPI Description</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">Expected Score</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">Review Date</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">Status</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">Department</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredKpis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-slate-500">No KPIs found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredKpis.map((kpi) => {
                // Use evidence code if KPI is linked to evidence, otherwise use KPI code
                const displayCode = kpi.evidence?.evidenceCode || kpi.code;
                // Use evidence department if KPI department is not set
                const displayDepartment =
                  kpi.department?.name || kpi.evidence?.department?.name || "-";
                // Use evidence reviewDate if KPI reviewDate is not set
                const displayReviewDate = kpi.reviewDate || kpi.evidence?.reviewDate;

                return (
                  <TableRow
                    key={kpi.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/compliance/kpis/${kpi.id}`)}
                  >
                    <TableCell className="font-medium text-slate-900">{displayCode}</TableCell>
                    <TableCell className="text-slate-600">
                      <span className="line-clamp-1">{kpi.objective || "-"}</span>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <span className="line-clamp-1 max-w-[200px]">
                        {kpi.description || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">{kpi.expectedScore ?? "-"}</TableCell>
                    <TableCell className="text-slate-600">
                      {displayReviewDate
                        ? new Date(displayReviewDate).toLocaleDateString("en-GB")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[kpi.status] || "bg-slate-100 text-slate-600"}>
                        {kpi.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{displayDepartment}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100">
          <span className="text-sm text-slate-500">
            {filteredKpis.length > 0
              ? `Showing 1 to ${filteredKpis.length} of ${filteredKpis.length}`
              : "No KPIs"}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={true} className="h-8 w-8">
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" disabled={true} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" disabled={true} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" disabled={true} className="h-8 w-8">
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

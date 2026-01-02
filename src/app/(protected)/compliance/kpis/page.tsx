"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
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
  evidence?: { id: string; evidenceCode: string; name: string } | null;
}

const statusColors: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-800",
  Missed: "bg-red-100 text-red-800",
  Overdue: "bg-orange-100 text-orange-800",
  Achieved: "bg-green-100 text-green-800",
};

const statusIcons: Record<string, React.ReactNode> = {
  Scheduled: <Clock className="h-5 w-5 text-blue-600" />,
  Missed: <XCircle className="h-5 w-5 text-red-600" />,
  Overdue: <AlertTriangle className="h-5 w-5 text-orange-600" />,
  Achieved: <CheckCircle className="h-5 w-5 text-green-600" />,
};

export default function KPIsPage() {
  const router = useRouter();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Status counts
  const statusCounts = {
    total: kpis.length,
    scheduled: kpis.filter((k) => k.status === "Scheduled").length,
    missed: kpis.filter((k) => k.status === "Missed").length,
    overdue: kpis.filter((k) => k.status === "Overdue").length,
    achieved: kpis.filter((k) => k.status === "Achieved").length,
  };

  // Department counts
  const departmentCounts = kpis.reduce((acc, kpi) => {
    const deptName = kpi.department?.name || "Unassigned";
    acc[deptName] = (acc[deptName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate status percentages
  const getStatusPercentage = (count: number) => {
    if (statusCounts.total === 0) return 0;
    return Math.round((count / statusCounts.total) * 100 * 10) / 10;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">KPI Dashboard</h1>
      </div>

      {/* Summary Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Status Chart Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500" />
                  <span className="text-sm">Scheduled</span>
                  <span className="text-sm font-medium ml-auto">
                    {getStatusPercentage(statusCounts.scheduled)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500" />
                  <span className="text-sm">Missed</span>
                  <span className="text-sm font-medium ml-auto">
                    {getStatusPercentage(statusCounts.missed)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500" />
                  <span className="text-sm">Overdue</span>
                  <span className="text-sm font-medium ml-auto">
                    {getStatusPercentage(statusCounts.overdue)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500" />
                  <span className="text-sm">Achieved</span>
                  <span className="text-sm font-medium ml-auto">
                    {getStatusPercentage(statusCounts.achieved)}%
                  </span>
                </div>
              </div>
              <div className="text-center ml-8">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-3xl font-bold">{statusCounts.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Department Chart Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                {Object.entries(departmentCounts)
                  .slice(0, 4)
                  .map(([dept, count], idx) => (
                    <div key={dept} className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full ${
                          idx === 0
                            ? "bg-blue-500"
                            : idx === 1
                            ? "bg-green-500"
                            : idx === 2
                            ? "bg-yellow-500"
                            : "bg-purple-500"
                        }`}
                      />
                      <span className="text-sm truncate max-w-[150px]">{dept}</span>
                      <span className="text-sm font-medium ml-auto">{count}</span>
                    </div>
                  ))}
              </div>
              <div className="text-center ml-8">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-3xl font-bold">{statusCounts.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">Code</div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">KPI Objective</div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">Kpi Description</div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">Expected Score</div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">Review Date</div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">Status</div>
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-1">Department</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-500">No KPIs found</p>
                  </TableCell>
                </TableRow>
              ) : (
                kpis.map((kpi) => (
                  <TableRow
                    key={kpi.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/compliance/kpis/${kpi.id}`)}
                  >
                    <TableCell className="font-medium">{kpi.code}</TableCell>
                    <TableCell>
                      <span className="line-clamp-1">{kpi.objective || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-1 max-w-[200px]">
                        {kpi.description || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{kpi.expectedScore ?? "-"}</TableCell>
                    <TableCell>
                      {kpi.reviewDate
                        ? new Date(kpi.reviewDate).toLocaleDateString("en-GB")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[kpi.status] || "bg-gray-100"}>
                        {kpi.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{kpi.department?.name || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>
              Currently showing 1 to {kpis.length} of {kpis.length}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

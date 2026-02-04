"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  ClipboardList,
  Building2,
  Home,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

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
  const { t } = useLanguage();
  const { data: session } = useSession();
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Check if user is Customer Administrator
  const userRoles = (session?.user?.roles as string[]) || [];
  const isCustomerAdmin = userRoles.includes("CustomerAdministrator");

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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("KPIs")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("KPI Dashboard")}</h1>
      </div>

      {/* Summary Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Status Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">{t("Status")}</h3>
            <span className="ml-auto text-2xl font-bold text-slate-800">{statusCounts.total}</span>
          </div>
          {isCustomerAdmin ? (
            <div className="h-[200px]">
              {statusCounts.total > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: t("Scheduled"), value: statusCounts.scheduled, color: "#3b82f6" },
                        { name: t("Missed"), value: statusCounts.missed, color: "#ef4444" },
                        { name: t("Overdue"), value: statusCounts.overdue, color: "#f59e0b" },
                        { name: t("Achieved"), value: statusCounts.achieved, color: "#22c55e" },
                      ].filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {[
                        { name: t("Scheduled"), value: statusCounts.scheduled, color: "#3b82f6" },
                        { name: t("Missed"), value: statusCounts.missed, color: "#ef4444" },
                        { name: t("Overdue"), value: statusCounts.overdue, color: "#f59e0b" },
                        { name: t("Achieved"), value: statusCounts.achieved, color: "#22c55e" },
                      ].filter(item => item.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="text-xs text-slate-600">
                              {data.name}: {data.value}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  {t("No data")}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-info" />
                <span className="text-sm text-slate-600">{t("Scheduled")}</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {getStatusPercentage(statusCounts.scheduled)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-error" />
                <span className="text-sm text-slate-600">{t("Missed")}</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {getStatusPercentage(statusCounts.missed)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-warning" />
                <span className="text-sm text-slate-600">{t("Overdue")}</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {getStatusPercentage(statusCounts.overdue)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-success" />
                <span className="text-sm text-slate-600">{t("Achieved")}</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {getStatusPercentage(statusCounts.achieved)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Department Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <Building2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">{t("Department")}</h3>
            <span className="ml-auto text-2xl font-bold text-slate-800">{statusCounts.total}</span>
          </div>
          {isCustomerAdmin ? (
            <div className="h-[200px]">
              {statusCounts.total > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(departmentCounts).map(([name, value], idx) => ({
                        name,
                        value,
                        color: ["#3b82f6", "#22c55e", "#f59e0b", "#6366f1", "#ef4444", "#8b5cf6", "#ec4899"][idx % 7]
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {Object.entries(departmentCounts).map(([, ], idx) => (
                        <Cell key={`cell-${idx}`} fill={["#3b82f6", "#22c55e", "#f59e0b", "#6366f1", "#ef4444", "#8b5cf6", "#ec4899"][idx % 7]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="text-xs text-slate-600">
                              {data.name}: {data.value}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  {t("No data")}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 mt-4">
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
          )}
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="flex items-center gap-3">
        <Input
          placeholder={t("Search by code, objective or description...")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm h-9 border-slate-200 bg-white"
        />
        <Select
          value={statusFilter || "all"}
          onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}
        >
          <SelectTrigger className="w-[180px] h-9 bg-white border-slate-200">
            <SelectValue placeholder={t("All Statuses")} />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">{t("All Statuses")}</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {t(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
      </div>

      {/* KPI Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table className="min-w-[930px]">
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4 w-[100px]">{t("Code")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 w-[180px]">{t("KPI Objective")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 w-[200px]">{t("KPI Description")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 w-[120px]">{t("Expected Score")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 w-[110px]">{t("Review Date")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 w-[90px]">{t("Status")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[130px]">{t("Department")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredKpis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-slate-500">{t("No KPIs found")}</p>
                  <p className="text-xs text-slate-400 mt-1">{t("Try adjusting your search or filter")}</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredKpis.map((kpi) => {
                const displayCode = kpi.evidence?.evidenceCode || kpi.code;
                const displayDepartment =
                  kpi.department?.name || kpi.evidence?.department?.name || "-";
                const displayReviewDate = kpi.reviewDate || kpi.evidence?.reviewDate;

                return (
                  <TableRow
                    key={kpi.id}
                    className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/compliance/kpis/${kpi.id}`)}
                  >
                    <TableCell className="py-5 text-sm font-medium text-slate-800 pl-4 w-[100px]">
                      {displayCode}
                    </TableCell>
                    <TableCell className="py-5 text-sm text-slate-700 w-[180px]">
                      <span className="line-clamp-1">{kpi.objective || "-"}</span>
                    </TableCell>
                    <TableCell className="py-5 text-sm text-slate-700 w-[200px]">
                      <span className="line-clamp-1">{kpi.description || "-"}</span>
                    </TableCell>
                    <TableCell className="py-5 text-sm text-slate-700 w-[120px]">
                      {kpi.expectedScore ?? "-"}
                    </TableCell>
                    <TableCell className="py-5 text-sm text-slate-700 w-[110px]">
                      {displayReviewDate
                        ? new Date(displayReviewDate).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="py-5 text-sm w-[90px]">
                      <Badge className={statusColors[kpi.status] || "bg-slate-100 text-slate-600"}>
                        {t(kpi.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-5 text-sm text-slate-700 pr-4 w-[130px]">
                      {displayDepartment}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-sm text-slate-500">
            {filteredKpis.length > 0
              ? `${t("Showing")} 1 ${t("to")} ${filteredKpis.length} ${t("of")} ${filteredKpis.length}`
              : t("No KPIs")}
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

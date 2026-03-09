"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useHasRole } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Eye,
  Home,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";

interface Department {
  id: string;
  name: string;
}
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
  const isGRCAdmin = useHasRole("GRCAdministrator");
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Check if user is Customer Administrator
  const userRoles = (session?.user?.roles as string[]) || [];
  const isCustomerAdmin = userRoles.includes("CustomerAdministrator");

  // Dynamic translations
  const { data: translatedKpis } = useTranslatedData(kpis, { modelName: 'KPI' });
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });

  // Translated department name lookup
  const tDept = useCallback((deptId: string | undefined, fallback: string) => {
    if (!deptId) return fallback;
    return translatedDepartments.find(d => d.id === deptId)?.name || fallback;
  }, [translatedDepartments]);

  const fetchKPIs = useCallback(async () => {
    try {
      const [kpiRes, deptRes] = await Promise.all([
        fetch("/api/kpis"),
        fetch("/api/departments"),
      ]);
      if (kpiRes.ok) {
        const result = await kpiRes.json();
        setKpis(result.data || []);
      }
      if (deptRes.ok) {
        const deptResult = await deptRes.json();
        setDepartments(deptResult.data || deptResult || []);
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
  const filteredKpis = translatedKpis.filter((kpi) => {
    const matchesSearch =
      !searchTerm ||
      kpi.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kpi.objective?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kpi.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || kpi.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Status counts
  const statusCounts = {
    total: translatedKpis.length,
    scheduled: translatedKpis.filter((k) => k.status === "Scheduled").length,
    missed: translatedKpis.filter((k) => k.status === "Missed").length,
    overdue: translatedKpis.filter((k) => k.status === "Overdue").length,
    achieved: translatedKpis.filter((k) => k.status === "Achieved").length,
  };

  // Department counts - use translated department names
  const departmentCounts = translatedKpis.reduce(
    (acc, kpi) => {
      const deptId = kpi.department?.id || kpi.evidence?.department?.id;
      const rawName = kpi.department?.name || kpi.evidence?.department?.name || t("Unassigned");
      const deptName = tDept(deptId, rawName);
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

  // Pagination
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredKpis.length / itemsPerPage);
  const paginatedKpis = filteredKpis.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        {isGRCAdmin ? (
          <>
            <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
              <Home className="h-4 w-4" />
              <span>{t("GRC")}</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
            <span className="text-slate-500">{t("Compliance")}</span>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500 ">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </div>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("KPIs")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("KPI Dashboard")}</h1>
      </div>

      {/* Summary Charts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Status Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5">
          <h3 className="text-sm font-medium text-slate-500 mb-2">{t("Status")}</h3>
          {isCustomerAdmin ? (
            <div className="h-[200px]">
              {statusCounts.total > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5">
          <h3 className="text-sm font-medium text-slate-500 mb-2">{t("Department")}</h3>
          {isCustomerAdmin ? (
            <div className="h-[200px]">
              {statusCounts.total > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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

      {/* KPI Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search and Filter Toolbar */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search by code, objective or description...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-[300px] ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
          <div className="w-full sm:w-auto ltr:sm:ml-auto rtl:sm:mr-auto">
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
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
          </div>
        </div>
        <div className="overflow-x-auto">
        <Table className="min-w-[930px]">
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pl-5">{t("Code")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("KPI Objective")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("KPI Description")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Expected Score")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Actual Score")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Review Date")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Department")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pr-5">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedKpis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
                      <BarChart3 className="h-6 w-6 text-primary-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-800">{t("No KPIs found")}</p>
                    <p className="text-xs text-slate-500 mt-1">{t("Try adjusting your search or filter")}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedKpis.map((kpi) => {
                const displayCode = kpi.code;
                const deptId = kpi.department?.id || kpi.evidence?.department?.id;
                const rawDeptName = kpi.department?.name || kpi.evidence?.department?.name || "-";
                const displayDepartment = tDept(deptId, rawDeptName);
                const displayReviewDate = kpi.reviewDate || kpi.evidence?.reviewDate;

                return (
                  <TableRow
                    key={kpi.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <TableCell className="py-3 pl-5 text-sm font-medium text-slate-800">
                      {displayCode}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      <span className="line-clamp-1">{kpi.objective || "-"}</span>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      <span className="line-clamp-1">{kpi.description || "-"}</span>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      {kpi.expectedScore ?? "-"}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      {kpi.actualScore ?? "-"}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      {displayReviewDate
                        ? new Date(displayReviewDate).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      <Badge className={statusColors[kpi.status] || "bg-slate-100 text-slate-600"}>
                        {t(kpi.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      {displayDepartment}
                    </TableCell>
                    <TableCell className="py-3 pr-5">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                          onClick={() => router.push(`/compliance/kpis/${kpi.id}`)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {filteredKpis.length > 0
              ? `${t("Showing")} ${(currentPage - 1) * itemsPerPage + 1} ${t("to")} ${Math.min(currentPage * itemsPerPage, filteredKpis.length)} ${t("of")} ${filteredKpis.length}`
              : t("No KPIs")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
            >
              <ChevronLeft className="h-4 w-4 ltr:rotate-0 rtl:rotate-180" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
            >
              <ChevronRight className="h-4 w-4 ltr:rotate-0 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

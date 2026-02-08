"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronRight, Download, Home } from "lucide-react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

interface Process {
  id: string;
  name: string;
  department?: { name: string } | null;
  criticality?: string | null;
  owner?: { fullName: string } | null;
  riskScore?: number | null;
}

interface KPI {
  id: string;
  name: string;
  department?: { name: string } | null;
  measurement?: string | null;
  performance?: string | null;
  status?: string | null;
}

// Color palettes for charts
const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const BAR_COLORS: Record<string, string> = {
  Achieved: "#22c55e",
  Missed: "#ef4444",
  Overdue: "#f59e0b",
  Scheduled: "#3b82f6",
  "Not Set": "#9ca3af",
};

function ManagementReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  const selectedOptions = searchParams.get("options")?.split(",") || [];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch processes
        const processRes = await fetch("/api/processes");
        if (processRes.ok) {
          const data = await processRes.json();
          setProcesses(data.data || data || []);
        }

        // Fetch KPIs
        const kpiRes = await fetch("/api/kpis");
        if (kpiRes.ok) {
          const data = await kpiRes.json();
          setKpis(data.data || data || []);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDownloadReport = () => {
    const content = reportRef.current;
    if (!content) return;

    // Create a new window for printing
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Get computed styles and clone the content
    const styles = Array.from(document.styleSheets)
      .map((styleSheet) => {
        try {
          return Array.from(styleSheet.cssRules)
            .map((rule) => rule.cssText)
            .join("");
        } catch {
          return "";
        }
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Process Management Report</title>
          <style>
            ${styles}
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                padding: 20px;
              }
              .recharts-wrapper { break-inside: avoid; }
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              padding: 20px;
              background: white;
            }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  };

  // Calculate process by department data for pie chart
  const processByDepartmentData = Object.entries(
    processes.reduce((acc, process) => {
      const dept = process.department?.name || "Unassigned";
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Calculate process by criticality data for pie chart
  const processByCriticalityData = Object.entries(
    processes.reduce((acc, process) => {
      const crit = process.criticality || "Not Set";
      acc[crit] = (acc[crit] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Get top 5 process risk
  const top5ProcessRisk = [...processes]
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
    .slice(0, 5);

  // Calculate KPI by measurement for pie chart
  const kpiByMeasurementData = Object.entries(
    kpis.reduce((acc, kpi) => {
      const measurement = kpi.measurement || "Not Set";
      acc[measurement] = (acc[measurement] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Calculate process by risk for pie chart
  const processByRiskData = processes
    .filter(p => (p.riskScore || 0) > 0)
    .slice(0, 8)
    .map(process => ({
      name: process.name.length > 15 ? process.name.substring(0, 15) + "..." : process.name,
      value: process.riskScore || 0,
    }));

  // Calculate KPI by performance for bar chart
  const kpiByPerformanceData = Object.entries(
    kpis.reduce((acc, kpi) => {
      const status = kpi.status || "Not Set";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value, fill: BAR_COLORS[name] || "#9ca3af" }));

  // Legend component for pie charts
  const ChartLegend = ({ data, colors }: { data: { name: string; value: number }[]; colors: string[] }) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-4">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="text-xs text-slate-600">
              {entry.name} ({total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/organization/reports" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Reports")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Management Report")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Management Report")}</h1>
        <Button size="sm" onClick={handleDownloadReport}>
          <Download className="h-4 w-4 me-2" />
          {t("Download Report")}
        </Button>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="space-y-6">
        {/* Report Title Card */}
        <div className="bg-white rounded-xl border border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800">{t("Process Management Report")}</h2>
          <p className="text-sm text-slate-500 mt-1">{t("Generated on")} {new Date().toLocaleDateString()}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Process by Department - Pie Chart */}
          {selectedOptions.includes("process-by-department") && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-800">{t("Process by Department")}</h3>
              </div>
              <div className="p-6">
                {processByDepartmentData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={processByDepartmentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          stroke="white"
                          strokeWidth={2}
                        >
                          {processByDepartmentData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, t("Processes")]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <ChartLegend data={processByDepartmentData} colors={PIE_COLORS} />
                  </>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">{t("No data available")}</p>
                )}
              </div>
            </div>
          )}

          {/* Process by Criticality - Pie Chart */}
          {selectedOptions.includes("process-by-criticality") && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-800">{t("Process by Criticality")}</h3>
              </div>
              <div className="p-6">
                {processByCriticalityData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={processByCriticalityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          stroke="white"
                          strokeWidth={2}
                        >
                          {processByCriticalityData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, t("Processes")]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <ChartLegend data={processByCriticalityData} colors={PIE_COLORS} />
                  </>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">{t("No data available")}</p>
                )}
              </div>
            </div>
          )}

          {/* KPI Measurement by Department - Pie Chart */}
          {selectedOptions.includes("kpi-by-measurement") && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-800">{t("KPI Measurement by Department")}</h3>
              </div>
              <div className="p-6">
                {kpiByMeasurementData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={kpiByMeasurementData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          stroke="white"
                          strokeWidth={2}
                        >
                          {kpiByMeasurementData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, t("KPIs")]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <ChartLegend data={kpiByMeasurementData} colors={PIE_COLORS} />
                  </>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">{t("No KPI data available")}</p>
                )}
              </div>
            </div>
          )}

          {/* Process by Risk - Pie Chart */}
          {selectedOptions.includes("process-by-risk") && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-800">{t("Process by Risk")}</h3>
              </div>
              <div className="p-6">
                {processByRiskData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={processByRiskData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          stroke="white"
                          strokeWidth={2}
                        >
                          {processByRiskData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, t("Risk Score")]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <ChartLegend data={processByRiskData} colors={PIE_COLORS} />
                  </>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">{t("No risk data available")}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Top 5 Process Risk - List */}
        {selectedOptions.includes("top-5-process-risk") && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800">{t("Top 5 Process Risk")}</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-4 pl-4 text-xs font-semibold text-slate-600">#</th>
                  <th className="text-left py-4 text-xs font-semibold text-slate-600">{t("Process Name")}</th>
                  <th className="text-left py-4 pr-4 text-xs font-semibold text-slate-600">{t("Risk Score")}</th>
                </tr>
              </thead>
              <tbody>
                {top5ProcessRisk.map((process, idx) => (
                  <tr key={process.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="py-4 pl-4 text-sm text-slate-700">#{idx + 1}</td>
                    <td className="py-4 text-sm text-slate-700">{process.name}</td>
                    <td className="py-4 pr-4 text-sm text-slate-700">{process.riskScore || 0}</td>
                  </tr>
                ))}
                {top5ProcessRisk.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500">
                      {t("No process risk data available")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* KPI Performance by Department - Bar Chart (Full Width at Bottom) */}
        {selectedOptions.includes("kpi-by-performance") && (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-800">{t("KPI Performance by Department")}</h3>
            </div>
            <div className="p-6">
              {kpiByPerformanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={kpiByPerformanceData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" name={t("Count")}>
                      {kpiByPerformanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">{t("No KPI performance data available")}</p>
              )}
              {/* Legend */}
              <div className="flex gap-4 mt-4 text-xs justify-center">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span className="text-slate-600">{t("Overdue")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-slate-600">{t("Achieved")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-slate-600">{t("Missed")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-slate-600">{t("Scheduled")}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrganizationManagementReportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
      </div>
    }>
      <ManagementReportContent />
    </Suspense>
  );
}

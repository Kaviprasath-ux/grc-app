"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download } from "lucide-react";
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

  // Custom label for pie charts
  const renderCustomLabel = ({ name, percent }: { name?: string; percent?: number }) => {
    return `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/organization/reports")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <span className="text-sm text-muted-foreground">Report</span>
            <h1 className="text-xl font-semibold">Management Report</h1>
          </div>
        </div>
        <Button onClick={handleDownloadReport}>
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="space-y-6 bg-white">
        <h2 className="text-lg font-semibold border-b pb-2">Process Management Report</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Process by Department - Pie Chart */}
          {selectedOptions.includes("process-by-department") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Process by Department</CardTitle>
              </CardHeader>
              <CardContent>
                {processByDepartmentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={processByDepartmentData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={renderCustomLabel}
                      >
                        {processByDepartmentData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Process by Criticality - Pie Chart */}
          {selectedOptions.includes("process-by-criticality") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Process by Criticality</CardTitle>
              </CardHeader>
              <CardContent>
                {processByCriticalityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={processByCriticalityData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={renderCustomLabel}
                      >
                        {processByCriticalityData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* KPI Measurement by Department - Pie Chart */}
          {selectedOptions.includes("kpi-by-measurement") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">KPI Measurement by Department</CardTitle>
              </CardHeader>
              <CardContent>
                {kpiByMeasurementData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={kpiByMeasurementData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={renderCustomLabel}
                      >
                        {kpiByMeasurementData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No KPI data available</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Process by Risk - Pie Chart */}
          {selectedOptions.includes("process-by-risk") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Process by Risk</CardTitle>
              </CardHeader>
              <CardContent>
                {processByRiskData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={processByRiskData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={renderCustomLabel}
                      >
                        {processByRiskData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No risk data available</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Top 5 Process Risk - List */}
        {selectedOptions.includes("top-5-process-risk") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 5 Process Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 text-sm font-medium">#</th>
                    <th className="text-left p-2 text-sm font-medium">Process Name</th>
                    <th className="text-left p-2 text-sm font-medium">Risk Score</th>
                  </tr>
                </thead>
                <tbody>
                  {top5ProcessRisk.map((process, idx) => (
                    <tr key={process.id} className="border-b">
                      <td className="p-2 text-sm">#{idx + 1}</td>
                      <td className="p-2 text-sm">{process.name}</td>
                      <td className="p-2 text-sm">{process.riskScore || 0}</td>
                    </tr>
                  ))}
                  {top5ProcessRisk.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-muted-foreground">
                        No process risk data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* KPI Performance by Department - Bar Chart (Full Width at Bottom) */}
        {selectedOptions.includes("kpi-by-performance") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">KPI Performance by Department</CardTitle>
            </CardHeader>
            <CardContent>
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
                    <Bar dataKey="value" name="Count">
                      {kpiByPerformanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No KPI performance data available</p>
              )}
              {/* Legend */}
              <div className="flex gap-4 mt-4 text-xs justify-center">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span>Overdue</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Achieved</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Missed</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Scheduled</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function OrganizationManagementReportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <ManagementReportContent />
    </Suspense>
  );
}

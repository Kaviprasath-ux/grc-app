"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

interface DashboardData {
  riskStats: {
    total: number;
    extreme: number;
    high: number;
    medium: number;
    low: number;
  };
  auditStats: {
    ongoing: number;
    completed: number;
    planned: number;
  };
  capaStatusByDepartment: Array<{
    name: string;
    open: { high: number; medium: number; low: number };
    closed: { high: number; medium: number; low: number };
  }>;
  annualAuditPlan: Array<{
    id: string;
    auditId: string;
    engagementTitle: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
    department: { name: string } | null;
    durationDays: number;
    startMonth: number;
    endMonth: number;
  }>;
  currentYear: number;
  stats: {
    evidenceRequests: {
      pending: number;
      inProgress: number;
      submitted: number;
      reviewed: number;
      overdue: number;
      total: number;
    };
    capa: {
      open: number;
      inProgress: number;
      closed: number;
      overdue: number;
      total: number;
    };
  };
  recentEvidenceRequests: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    engagement: {
      auditId: string;
      engagementTitle: string;
      department: { name: string } | null;
    };
  }>;
  recentCAPAs: Array<{
    id: string;
    capaId: string;
    title: string;
    status: string;
    targetDate: string | null;
    finding: {
      findingId: string;
      finding: string;
      engagement: { auditId: string; engagementTitle: string };
    };
  }>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function InternalAuditDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [capaPage, setCapaPage] = useState(0);
  const itemsPerPage = 2;

  const isAuditee =
    session?.user?.roles?.includes("Auditee") &&
    !session?.user?.roles?.includes("AuditHead") &&
    !session?.user?.roles?.includes("Auditor");

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/internal-audit/dashboard");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        toast.error("Failed to fetch dashboard data");
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      toast.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // Prepare risk chart data
  const riskChartData = data ? [
    { name: "Extreme", value: data.riskStats.extreme, color: "#dc2626" },
    { name: "High", value: data.riskStats.high, color: "#f97316" },
    { name: "Medium", value: data.riskStats.medium, color: "#3b82f6" },
    { name: "Low", value: data.riskStats.low, color: "#22c55e" },
  ] : [];

  // Paginated CAPA data
  const totalCapaPages = data ? Math.ceil(data.capaStatusByDepartment.length / itemsPerPage) : 0;
  const paginatedCapaData = data?.capaStatusByDepartment.slice(
    capaPage * itemsPerPage,
    (capaPage + 1) * itemsPerPage
  ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Auditee view - simplified dashboard
  if (isAuditee) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Audit Tasks</h1>
          <p className="text-gray-500 mt-1">Track your evidence requests and corrective actions</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/internal-audit/fieldwork")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Evidence Requests</CardTitle>
              <Activity className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.stats.evidenceRequests.total || 0}</div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">{data?.stats.evidenceRequests.pending || 0} Pending</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/internal-audit/capa-tracking")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Corrective Actions</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.stats.capa.total || 0}</div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">{data?.stats.capa.open || 0} Open</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Pending Actions</CardTitle>
              <Clock className="h-5 w-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(data?.stats.evidenceRequests.pending || 0) + (data?.stats.capa.open || 0)}
              </div>
              <p className="text-xs text-gray-500 mt-2">Items requiring attention</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow border-red-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Overdue Items</CardTitle>
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {(data?.stats.evidenceRequests.overdue || 0) + (data?.stats.capa.overdue || 0)}
              </div>
              <p className="text-xs text-red-500 mt-2">Requires immediate attention</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main dashboard view for Audit Head / Auditor
  return (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 font-medium">Total Risks Identified</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{data?.riskStats.total || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 font-medium">Risks with Extreme Severity</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{data?.riskStats.extreme || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 font-medium">Ongoing Audits</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{data?.auditStats.ongoing || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 font-medium">Completed Audits</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{data?.auditStats.completed || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk by Rating Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-blue-900">Risk by Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={riskChartData}
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 'auto']} />
                  <YAxis type="category" dataKey="name" width={60} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {riskChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList dataKey="value" position="right" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* CAPA Status Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-blue-900">CAPA Status Overview</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setCapaPage(Math.max(0, capaPage - 1))}
                disabled={capaPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>{capaPage + 1} to {Math.min((capaPage + 1) * itemsPerPage, data?.capaStatusByDepartment.length || 0)} of {data?.capaStatusByDepartment.length || 0}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setCapaPage(Math.min(totalCapaPages - 1, capaPage + 1))}
                disabled={capaPage >= totalCapaPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {paginatedCapaData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No CAPA data available</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {paginatedCapaData.map((dept, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-center mb-3">{dept.name}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Open</span>
                        <div className="flex gap-1">
                          {dept.open.high > 0 && (
                            <Badge className="bg-red-500 text-white text-xs">H: {dept.open.high}</Badge>
                          )}
                          {dept.open.medium > 0 && (
                            <Badge className="bg-blue-500 text-white text-xs">M: {dept.open.medium}</Badge>
                          )}
                          {dept.open.low > 0 && (
                            <Badge className="bg-green-500 text-white text-xs">L: {dept.open.low}</Badge>
                          )}
                          {dept.open.high === 0 && dept.open.medium === 0 && dept.open.low === 0 && (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Closed</span>
                        <div className="flex gap-1">
                          {dept.closed.high > 0 && (
                            <Badge className="bg-red-500 text-white text-xs">H: {dept.closed.high}</Badge>
                          )}
                          {dept.closed.medium > 0 && (
                            <Badge className="bg-blue-500 text-white text-xs">M: {dept.closed.medium}</Badge>
                          )}
                          {dept.closed.low > 0 && (
                            <Badge className="bg-green-500 text-white text-xs">L: {dept.closed.low}</Badge>
                          )}
                          {dept.closed.high === 0 && dept.closed.medium === 0 && dept.closed.low === 0 && (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Annual Audit Plan Gantt Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-blue-900">
            Annual Audit Plan - {data?.currentYear || new Date().getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Audit Name</TableHead>
                  {MONTHS.map((month) => (
                    <TableHead key={month} className="text-center min-w-[60px]">{month}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.annualAuditPlan && data.annualAuditPlan.length > 0 ? (
                  data.annualAuditPlan.map((audit) => (
                    <TableRow key={audit.id}>
                      <TableCell className="font-medium">{audit.engagementTitle || audit.auditId}</TableCell>
                      {MONTHS.map((month, monthIndex) => {
                        const isInRange = monthIndex >= audit.startMonth && monthIndex <= audit.endMonth;
                        const isStart = monthIndex === audit.startMonth;
                        return (
                          <TableCell key={month} className="p-1">
                            {isStart ? (
                              <Badge className="bg-orange-500 text-white text-xs whitespace-nowrap">
                                {audit.durationDays} Days
                              </Badge>
                            ) : isInRange ? (
                              <div className="h-6 bg-orange-200 rounded-sm"></div>
                            ) : null}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                      No audit plans for this year
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

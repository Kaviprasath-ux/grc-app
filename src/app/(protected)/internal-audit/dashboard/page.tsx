"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  ExternalLink,
  FileText,
  Shield,
  ClipboardList,
  Calendar,
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
    auditorName: string | null;
    durationDays: number;
    startMonth: number;
    endMonth: number;
  }>;
  auditorSchedule: Array<{
    id: string;
    name: string;
    assignments: Array<{
      auditId: string;
      engagementTitle: string;
      startMonth: number;
      endMonth: number;
      durationDays: number;
    }>;
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

interface DrillDownData {
  type: string;
  filter?: string;
  data: Array<Record<string, unknown>>;
  total: number;
}

interface DrillDownDialogState {
  open: boolean;
  type: 'risks' | 'audits' | 'capa' | 'audit-detail' | null;
  title: string;
  filter?: string;
  department?: string;
  status?: string;
  auditId?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Severity badge component
const SeverityBadge = ({ severity }: { severity: string }) => {
  const colors: Record<string, string> = {
    extreme: "bg-red-600 text-white",
    critical: "bg-red-600 text-white",
    high: "bg-red-500 text-white",
    medium: "bg-blue-500 text-white",
    moderate: "bg-blue-500 text-white",
    low: "bg-green-500 text-white",
  };
  const color = colors[severity?.toLowerCase()] || "bg-gray-500 text-white";
  return <Badge className={color}>{severity || 'N/A'}</Badge>;
};

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    open: "bg-yellow-500 text-white",
    "in progress": "bg-blue-500 text-white",
    ongoing: "bg-blue-500 text-white",
    completed: "bg-green-500 text-white",
    closed: "bg-green-500 text-white",
    planned: "bg-purple-500 text-white",
  };
  const color = colors[status?.toLowerCase()] || "bg-gray-500 text-white";
  return <Badge className={color}>{status || 'N/A'}</Badge>;
};

export default function InternalAuditDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const { canView, isLoading: permissionsLoading } = usePermissions('audit.dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [capaPage, setCapaPage] = useState(0);
  const itemsPerPage = 2;

  // Drill-down state
  const [drillDown, setDrillDown] = useState<DrillDownDialogState>({
    open: false,
    type: null,
    title: '',
  });
  const [drillDownData, setDrillDownData] = useState<DrillDownData | null>(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);

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

  // Fetch drill-down data
  const fetchDrillDownData = async (type: string, params: Record<string, string> = {}) => {
    try {
      setDrillDownLoading(true);
      const queryParams = new URLSearchParams({ type, ...params });
      const response = await fetch(`/api/internal-audit/dashboard/drill-down?${queryParams}`);
      if (response.ok) {
        const result = await response.json();
        setDrillDownData(result);
      } else {
        toast.error("Failed to fetch detailed data");
      }
    } catch (error) {
      console.error("Error fetching drill-down data:", error);
      toast.error("Failed to fetch detailed data");
    } finally {
      setDrillDownLoading(false);
    }
  };

  // Handle card clicks
  const handleRiskCardClick = (filter: string, title: string) => {
    setDrillDown({
      open: true,
      type: 'risks',
      title,
      filter,
    });
    fetchDrillDownData('risks', { filter });
  };

  const handleAuditCardClick = (filter: string, title: string) => {
    setDrillDown({
      open: true,
      type: 'audits',
      title,
      filter,
    });
    fetchDrillDownData('audits', { filter });
  };

  const handleCapaClick = (department: string, status: string) => {
    setDrillDown({
      open: true,
      type: 'capa',
      title: `CAPA - ${department} (${status})`,
      department,
      status,
    });
    fetchDrillDownData('capa', { department, status });
  };

  const handleAuditPlanClick = (auditId: string, title: string) => {
    setDrillDown({
      open: true,
      type: 'audit-detail',
      title: `Audit Details - ${title}`,
      auditId,
    });
    fetchDrillDownData('audit-plan', { auditId });
  };

  // Handle chart bar click
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartBarClick = (data: any) => {
    if (data && data.name) {
      const riskLevel = data.name.toLowerCase();
      handleRiskCardClick(riskLevel, `${data.name} Risk Details`);
    }
  };

  // Close drill-down dialog
  const closeDrillDown = () => {
    setDrillDown({ open: false, type: null, title: '' });
    setDrillDownData(null);
  };

  // Navigate to detail page
  const navigateToDetail = (type: string, id: string) => {
    closeDrillDown();
    switch (type) {
      case 'risk':
        router.push(`/internal-audit/risk-register`);
        break;
      case 'audit':
        router.push(`/internal-audit/fieldwork/${id}`);
        break;
      case 'capa':
        router.push(`/internal-audit/capa-tracking`);
        break;
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

  // Show loading state while permissions or data is being fetched
  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description="You don't have permission to access the Internal Audit Dashboard." />;
  }

  // Render drill-down dialog content
  const renderDrillDownContent = () => {
    if (drillDownLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      );
    }

    if (!drillDownData || !drillDownData.data) {
      return (
        <div className="text-center py-12 text-gray-500">
          No data available
        </div>
      );
    }

    switch (drillDown.type) {
      case 'risks':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk ID</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillDownData.data.map((risk: Record<string, unknown>) => (
                  <TableRow key={risk.id as string} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{risk.riskId as string}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={risk.riskDescription as string}>
                      {risk.riskDescription as string}
                    </TableCell>
                    <TableCell>{risk.department as string}</TableCell>
                    <TableCell>{risk.category as string}</TableCell>
                    <TableCell><SeverityBadge severity={risk.riskLevel as string} /></TableCell>
                    <TableCell><StatusBadge status={risk.status as string} /></TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToDetail('risk', risk.id as string)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 text-sm text-gray-500 text-center">
              Showing {drillDownData.data.length} of {drillDownData.total} records
            </div>
          </div>
        );

      case 'audits':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Audit ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillDownData.data.map((audit: Record<string, unknown>) => (
                  <TableRow key={audit.id as string} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{audit.auditId as string}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={audit.engagementTitle as string}>
                      {audit.engagementTitle as string}
                    </TableCell>
                    <TableCell>{audit.department as string}</TableCell>
                    <TableCell>{audit.auditType as string}</TableCell>
                    <TableCell>{audit.auditor as string}</TableCell>
                    <TableCell><StatusBadge status={audit.status as string} /></TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToDetail('audit', audit.id as string)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 text-sm text-gray-500 text-center">
              Showing {drillDownData.data.length} of {drillDownData.total} records
            </div>
          </div>
        );

      case 'capa':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CAPA ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Finding</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Responsible</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillDownData.data.map((capa: Record<string, unknown>) => (
                  <TableRow key={capa.id as string} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{capa.capaId as string}</TableCell>
                    <TableCell className="max-w-[150px] truncate" title={capa.title as string}>
                      {capa.title as string}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate" title={capa.finding as string}>
                      {capa.finding as string}
                    </TableCell>
                    <TableCell><SeverityBadge severity={capa.severity as string} /></TableCell>
                    <TableCell>{capa.responsiblePerson as string}</TableCell>
                    <TableCell>
                      {capa.targetDate
                        ? new Date(capa.targetDate as string).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell><StatusBadge status={capa.status as string} /></TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigateToDetail('capa', capa.id as string)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 text-sm text-gray-500 text-center">
              Showing {drillDownData.data.length} of {drillDownData.total} records
            </div>
          </div>
        );

      case 'audit-detail':
        const auditDetail = drillDownData.data as unknown as {
          id?: string;
          auditId?: string;
          engagementTitle?: string;
          status?: string;
          department?: string;
          auditType?: string;
          auditor?: { name?: string; email?: string };
          startDate?: string;
          endDate?: string;
          objectives?: string;
          scope?: string;
          findingsCount?: number;
          evidenceRequestsCount?: number;
        };
        if (!auditDetail) return <div className="text-center py-12 text-gray-500">No data available</div>;

        return (
          <div className="max-h-[60vh] overflow-auto space-y-6">
            {/* Audit Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-500">Audit ID:</span>
                  <span className="font-medium">{auditDetail.auditId || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-500">Department:</span>
                  <span className="font-medium">{auditDetail.department || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-500">Type:</span>
                  <span className="font-medium">{auditDetail.auditType || 'N/A'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-500">Status:</span>
                  <StatusBadge status={auditDetail.status || ''} />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-500">Duration:</span>
                  <span className="font-medium">
                    {auditDetail.startDate
                      ? new Date(auditDetail.startDate).toLocaleDateString()
                      : 'N/A'} - {auditDetail.endDate
                      ? new Date(auditDetail.endDate).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-500">Auditor:</span>
                  <span className="font-medium">
                    {auditDetail.auditor?.name || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{auditDetail.findingsCount || 0}</div>
                  <div className="text-sm text-gray-500">Findings</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{auditDetail.evidenceRequestsCount || 0}</div>
                  <div className="text-sm text-gray-500">Evidence Requests</div>
                </CardContent>
              </Card>
            </div>

            {/* Objectives & Scope */}
            {(auditDetail.objectives || auditDetail.scope) && (
              <div className="space-y-3">
                {auditDetail.objectives && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Objectives</h4>
                    <p className="text-sm text-gray-600">{auditDetail.objectives}</p>
                  </div>
                )}
                {auditDetail.scope && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Scope</h4>
                    <p className="text-sm text-gray-600">{auditDetail.scope}</p>
                  </div>
                )}
              </div>
            )}

            {/* View Full Details Button */}
            <div className="flex justify-end">
              <Button onClick={() => navigateToDetail('audit', auditDetail.id || '')}>
                View Full Details
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

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
      {/* Drill-down Dialog */}
      <Dialog open={drillDown.open} onOpenChange={(open) => !open && closeDrillDown()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              {drillDown.title}
            </DialogTitle>
            <DialogDescription>
              Click on any row to view more details
            </DialogDescription>
          </DialogHeader>
          {renderDrillDownContent()}
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="bg-white cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-l-4 border-l-blue-500"
          onClick={() => handleRiskCardClick('all', 'All Risks')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Risks Identified</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{data?.riskStats.total || 0}</p>
              </div>
              <Shield className="h-10 w-10 text-blue-500 opacity-20" />
            </div>
            <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
              Click to view details <ExternalLink className="h-3 w-3" />
            </p>
          </CardContent>
        </Card>

        <Card
          className="bg-white cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-l-4 border-l-red-500"
          onClick={() => handleRiskCardClick('extreme', 'Extreme Severity Risks')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Risks with Extreme Severity</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{data?.riskStats.extreme || 0}</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-red-500 opacity-20" />
            </div>
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
              Click to view details <ExternalLink className="h-3 w-3" />
            </p>
          </CardContent>
        </Card>

        <Card
          className="bg-white cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-l-4 border-l-yellow-500"
          onClick={() => handleAuditCardClick('ongoing', 'Ongoing Audits')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Ongoing Audits</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{data?.auditStats.ongoing || 0}</p>
              </div>
              <Activity className="h-10 w-10 text-yellow-500 opacity-20" />
            </div>
            <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
              Click to view details <ExternalLink className="h-3 w-3" />
            </p>
          </CardContent>
        </Card>

        <Card
          className="bg-white cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-l-4 border-l-green-500"
          onClick={() => handleAuditCardClick('completed', 'Completed Audits')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Completed Audits</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{data?.auditStats.completed || 0}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-green-500 opacity-20" />
            </div>
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              Click to view details <ExternalLink className="h-3 w-3" />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk by Rating Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-blue-900">Risk by Rating</CardTitle>
            <p className="text-xs text-gray-500">Click on a bar to view risks of that severity</p>
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
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white border rounded-lg p-2 shadow-lg">
                            <p className="font-medium">{payload[0].payload.name}</p>
                            <p className="text-sm text-gray-600">{payload[0].value} risks</p>
                            <p className="text-xs text-blue-600 mt-1">Click to drill down</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                    className="cursor-pointer"
                    onClick={(data) => handleChartBarClick(data)}
                  >
                    {riskChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        className="hover:opacity-80 transition-opacity"
                      />
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
            <div>
              <CardTitle className="text-lg font-semibold text-blue-900">CAPA Status Overview</CardTitle>
              <p className="text-xs text-gray-500">Click on a status badge to view details</p>
            </div>
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
                  <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <h4 className="font-semibold text-center mb-3">{dept.name}</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Open</span>
                        <div className="flex gap-1">
                          {dept.open.high > 0 && (
                            <Badge
                              className="bg-red-500 text-white text-xs cursor-pointer hover:bg-red-600"
                              onClick={() => handleCapaClick(dept.name, 'open')}
                            >
                              H: {dept.open.high}
                            </Badge>
                          )}
                          {dept.open.medium > 0 && (
                            <Badge
                              className="bg-blue-500 text-white text-xs cursor-pointer hover:bg-blue-600"
                              onClick={() => handleCapaClick(dept.name, 'open')}
                            >
                              M: {dept.open.medium}
                            </Badge>
                          )}
                          {dept.open.low > 0 && (
                            <Badge
                              className="bg-green-500 text-white text-xs cursor-pointer hover:bg-green-600"
                              onClick={() => handleCapaClick(dept.name, 'open')}
                            >
                              L: {dept.open.low}
                            </Badge>
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
                            <Badge
                              className="bg-red-500 text-white text-xs cursor-pointer hover:bg-red-600"
                              onClick={() => handleCapaClick(dept.name, 'closed')}
                            >
                              H: {dept.closed.high}
                            </Badge>
                          )}
                          {dept.closed.medium > 0 && (
                            <Badge
                              className="bg-blue-500 text-white text-xs cursor-pointer hover:bg-blue-600"
                              onClick={() => handleCapaClick(dept.name, 'closed')}
                            >
                              M: {dept.closed.medium}
                            </Badge>
                          )}
                          {dept.closed.low > 0 && (
                            <Badge
                              className="bg-green-500 text-white text-xs cursor-pointer hover:bg-green-600"
                              onClick={() => handleCapaClick(dept.name, 'closed')}
                            >
                              L: {dept.closed.low}
                            </Badge>
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
          <p className="text-xs text-gray-500">Click on an audit row to view details</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Audit Name</TableHead>
                  <TableHead className="min-w-[150px]">Auditor</TableHead>
                  {MONTHS.map((month) => (
                    <TableHead key={month} className="text-center min-w-[60px]">{month}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.annualAuditPlan && data.annualAuditPlan.length > 0 ? (
                  data.annualAuditPlan.map((audit) => (
                    <TableRow
                      key={audit.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleAuditPlanClick(audit.id, audit.engagementTitle || audit.auditId)}
                    >
                      <TableCell className="font-medium">
                        <span className="text-blue-600 hover:underline">
                          {audit.engagementTitle || audit.auditId}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-700">{audit.auditorName || '-'}</TableCell>
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
                    <TableCell colSpan={14} className="text-center py-8 text-gray-500">
                      No audit plans for this year
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Auditor Schedule Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-blue-900">
            Auditor Schedule - {data?.currentYear || new Date().getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Auditor Name</TableHead>
                  {MONTHS.map((month) => (
                    <TableHead key={month} className="text-center min-w-[60px]">{month}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.auditorSchedule && data.auditorSchedule.length > 0 ? (
                  data.auditorSchedule.map((auditor) => (
                    <TableRow key={auditor.id}>
                      <TableCell className="font-medium">{auditor.name}</TableCell>
                      {MONTHS.map((month, monthIndex) => {
                        // Find if auditor has any assignment in this month
                        const assignment = auditor.assignments.find(
                          (a) => monthIndex >= a.startMonth && monthIndex <= a.endMonth
                        );
                        const isStart = assignment && monthIndex === assignment.startMonth;
                        return (
                          <TableCell key={month} className="p-1">
                            {isStart ? (
                              <Badge
                                className="bg-blue-500 text-white text-xs whitespace-nowrap cursor-pointer hover:bg-blue-600"
                                onClick={() => handleAuditPlanClick(assignment.auditId, assignment.engagementTitle)}
                                title={assignment.engagementTitle}
                              >
                                {assignment.durationDays} Days
                              </Badge>
                            ) : assignment ? (
                              <div
                                className="h-6 bg-blue-200 rounded-sm cursor-pointer hover:bg-blue-300"
                                onClick={() => handleAuditPlanClick(assignment.auditId, assignment.engagementTitle)}
                                title={assignment.engagementTitle}
                              ></div>
                            ) : null}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                      No auditor schedules for this year
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

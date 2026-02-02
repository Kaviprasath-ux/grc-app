"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { StatsCard } from "@/components/shared";
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
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
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
  const color = colors[severity?.toLowerCase()] || "bg-slate-500 text-white";
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
  const color = colors[status?.toLowerCase()] || "bg-slate-500 text-white";
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
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading dashboard...</p>
        </div>
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
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-2 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      );
    }

    if (!drillDownData || !drillDownData.data) {
      return (
        <div className="text-center py-12 text-slate-500">
          No data available
        </div>
      );
    }

    switch (drillDown.type) {
      case 'risks':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Risk ID</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Description</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Department</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Category</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Severity</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillDownData.data.map((risk: Record<string, unknown>) => (
                  <TableRow key={risk.id as string} className="hover:bg-slate-50">
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
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => navigateToDetail('risk', risk.id as string)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 text-sm text-slate-500 text-center">
              Showing {drillDownData.data.length} of {drillDownData.total} records
            </div>
          </div>
        );

      case 'audits':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">Audit ID</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Title</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Department</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Type</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Auditor</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillDownData.data.map((audit: Record<string, unknown>) => (
                  <TableRow key={audit.id as string} className="hover:bg-slate-50">
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
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => navigateToDetail('audit', audit.id as string)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 text-sm text-slate-500 text-center">
              Showing {drillDownData.data.length} of {drillDownData.total} records
            </div>
          </div>
        );

      case 'capa':
        return (
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">CAPA ID</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Title</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Finding</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Severity</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Responsible</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Target Date</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillDownData.data.map((capa: Record<string, unknown>) => (
                  <TableRow key={capa.id as string} className="hover:bg-slate-50">
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
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => navigateToDetail('capa', capa.id as string)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 text-sm text-slate-500 text-center">
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
        if (!auditDetail) return <div className="text-center py-12 text-slate-500">No data available</div>;

        return (
          <div className="max-h-[60vh] overflow-auto space-y-6">
            {/* Audit Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-500">Audit ID:</span>
                  <span className="font-medium">{auditDetail.auditId || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-500">Department:</span>
                  <span className="font-medium">{auditDetail.department || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-500">Type:</span>
                  <span className="font-medium">{auditDetail.auditType || 'N/A'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-500">Status:</span>
                  <StatusBadge status={auditDetail.status || ''} />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-500">Duration:</span>
                  <span className="font-medium">
                    {auditDetail.startDate
                      ? new Date(auditDetail.startDate).toLocaleDateString()
                      : 'N/A'} - {auditDetail.endDate
                      ? new Date(auditDetail.endDate).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-500">Auditor:</span>
                  <span className="font-medium">
                    {auditDetail.auditor?.name || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-2xl font-bold text-slate-800">{auditDetail.findingsCount || 0}</div>
                <div className="text-sm text-slate-500">Findings</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-2xl font-bold text-slate-800">{auditDetail.evidenceRequestsCount || 0}</div>
                <div className="text-sm text-slate-500">Evidence Requests</div>
              </div>
            </div>

            {/* Objectives & Scope */}
            {(auditDetail.objectives || auditDetail.scope) && (
              <div className="space-y-3">
                {auditDetail.objectives && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-1">Objectives</h4>
                    <p className="text-sm text-slate-600">{auditDetail.objectives}</p>
                  </div>
                )}
                {auditDetail.scope && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-1">Scope</h4>
                    <p className="text-sm text-slate-600">{auditDetail.scope}</p>
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Audit Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">Track your evidence requests and corrective actions</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="Evidence Requests"
            value={data?.stats.evidenceRequests.total || 0}
            href="/internal-audit/fieldwork"
            icon={Activity}
            description={`${data?.stats.evidenceRequests.pending || 0} Pending`}
          />
          <StatsCard
            label="Corrective Actions"
            value={data?.stats.capa.total || 0}
            href="/internal-audit/capa-tracking"
            icon={CheckCircle}
            description={`${data?.stats.capa.open || 0} Open`}
          />
          <StatsCard
            label="Pending Actions"
            value={(data?.stats.evidenceRequests.pending || 0) + (data?.stats.capa.open || 0)}
            icon={Clock}
            description="Items requiring attention"
          />
          <StatsCard
            label="Overdue Items"
            value={(data?.stats.evidenceRequests.overdue || 0) + (data?.stats.capa.overdue || 0)}
            icon={AlertTriangle}
            description="Requires immediate attention"
          />
        </div>
      </div>
    );
  }

  // Main dashboard view for Audit Head / Auditor
  return (
    <div className="space-y-6">
      {/* Drill-down Dialog */}
      <Dialog open={drillDown.open} onOpenChange={(open) => !open && closeDrillDown()}>
        <DialogContent className="max-w-4xl p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">
              {drillDown.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Click on any row to view more details
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5">
            {renderDrillDownContent()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => handleRiskCardClick('all', 'All Risks')} className="cursor-pointer [&>div]:hover:border-slate-300 [&>div]:transition-colors">
          <StatsCard
            label="Total Risks"
            value={data?.riskStats.total || 0}
            icon={Shield}
          />
        </div>
        <div onClick={() => handleRiskCardClick('extreme', 'Extreme Severity Risks')} className="cursor-pointer [&>div]:hover:border-slate-300 [&>div]:transition-colors">
          <StatsCard
            label="Extreme Severity"
            value={data?.riskStats.extreme || 0}
            icon={AlertTriangle}
          />
        </div>
        <div onClick={() => handleAuditCardClick('ongoing', 'Ongoing Audits')} className="cursor-pointer [&>div]:hover:border-slate-300 [&>div]:transition-colors">
          <StatsCard
            label="Ongoing Audits"
            value={data?.auditStats.ongoing || 0}
            icon={Activity}
          />
        </div>
        <div onClick={() => handleAuditCardClick('completed', 'Completed Audits')} className="cursor-pointer [&>div]:hover:border-slate-300 [&>div]:transition-colors">
          <StatsCard
            label="Completed Audits"
            value={data?.auditStats.completed || 0}
            icon={CheckCircle}
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk by Rating Chart */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">Risk by Rating</h3>
            <p className="text-xs text-slate-400 mt-1">Click on a bar to view risks of that severity</p>
          </div>
          <div className="p-6 space-y-4">
            {riskChartData.map((item) => {
              const maxValue = Math.max(...riskChartData.map(d => d.value), 1);
              const percentage = (item.value / maxValue) * 100;
              return (
                <div
                  key={item.name}
                  className="cursor-pointer group"
                  onClick={() => handleRiskCardClick(item.name.toLowerCase(), `${item.name} Severity Risks`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-medium text-slate-700">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{item.value}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 group-hover:opacity-80"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {data?.riskStats.total === 0 && (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">No risk data available</p>
              </div>
            )}
          </div>
        </div>

        {/* CAPA Status Overview */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-800">CAPA Status Overview</h3>
              <p className="text-xs text-slate-400 mt-1">Click on a status badge to view details</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
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
          </div>
          <div className="p-6">
            {paginatedCapaData.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p>No CAPA data available</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {paginatedCapaData.map((dept, index) => (
                  <div key={index} className="bg-slate-50/50 border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
                    <h4 className="text-sm font-semibold text-slate-700 text-center mb-3">{dept.name}</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Open</span>
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
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Closed</span>
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
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Annual Audit Plan Gantt Chart */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">
            Annual Audit Plan - {data?.currentYear || new Date().getFullYear()}
          </h3>
          <p className="text-xs text-slate-400 mt-1">Click on an audit row to view details</p>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="min-w-[200px] text-xs font-semibold text-slate-600">Audit Name</TableHead>
                  <TableHead className="min-w-[150px] text-xs font-semibold text-slate-600">Auditor</TableHead>
                  {MONTHS.map((month) => (
                    <TableHead key={month} className="text-center min-w-[60px] text-xs font-semibold text-slate-600">{month}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.annualAuditPlan && data.annualAuditPlan.length > 0 ? (
                  data.annualAuditPlan.map((audit) => (
                    <TableRow
                      key={audit.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => handleAuditPlanClick(audit.id, audit.engagementTitle || audit.auditId)}
                    >
                      <TableCell className="font-medium">
                        <span className="text-blue-600 hover:underline">
                          {audit.engagementTitle || audit.auditId}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-700">{audit.auditorName || '-'}</TableCell>
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
                    <TableCell colSpan={14} className="text-center py-8 text-slate-500">
                      No audit plans for this year
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Auditor Schedule Chart */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">
            Auditor Schedule - {data?.currentYear || new Date().getFullYear()}
          </h3>
          <p className="text-xs text-slate-400 mt-1">Monthly allocation by auditor</p>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="min-w-[200px] text-xs font-semibold text-slate-600">Auditor Name</TableHead>
                  {MONTHS.map((month) => (
                    <TableHead key={month} className="text-center min-w-[60px] text-xs font-semibold text-slate-600">{month}</TableHead>
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
                    <TableCell colSpan={13} className="text-center py-8 text-slate-500">
                      No auditor schedules for this year
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

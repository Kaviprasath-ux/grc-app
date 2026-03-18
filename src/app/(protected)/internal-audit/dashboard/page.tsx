"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { useTranslatedData } from "@/hooks/useTranslatedData";
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
  Home,
  Building2,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { FieldworkDetailModal } from "../fieldwork/FieldworkDetailModal";

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

const MONTH_KEYS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Severity badge - muted pill style
const SeverityBadge = ({ severity, t }: { severity: string; t?: (key: string) => string }) => {
  const styles: Record<string, string> = {
    extreme: "bg-red-100 text-red-700",
    critical: "bg-red-100 text-red-700",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-amber-100 text-amber-700",
    moderate: "bg-amber-100 text-amber-700",
    low: "bg-emerald-100 text-emerald-700",
  };
  const style = styles[severity?.toLowerCase()] || "bg-slate-100 text-slate-600";
  const label = t ? t(severity || 'N/A') : (severity || 'N/A');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
};

// Status badge - muted pill style
const StatusBadge = ({ status, t }: { status: string; t?: (key: string) => string }) => {
  const styles: Record<string, string> = {
    open: "bg-amber-100 text-amber-700",
    "in progress": "bg-sky-100 text-sky-700",
    ongoing: "bg-sky-100 text-sky-700",
    completed: "bg-emerald-100 text-emerald-700",
    closed: "bg-emerald-100 text-emerald-700",
    planned: "bg-purple-100 text-purple-700",
  };
  const style = styles[status?.toLowerCase()] || "bg-slate-100 text-slate-600";
  const label = t ? t(status || 'N/A') : (status || 'N/A');
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${style}`}>
      {label}
    </span>
  );
};

export default function InternalAuditDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const { canView, isLoading: permissionsLoading } = usePermissions('audit.dashboard');
  const { t } = useLanguage();
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

  // Fieldwork detail modal
  const [fieldworkModalOpen, setFieldworkModalOpen] = useState(false);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);

  const isAuditee =
    session?.user?.roles?.includes("Auditee") &&
    !session?.user?.roles?.includes("AuditHead") &&
    !session?.user?.roles?.includes("Auditor");

  const canDrillDown =
    session?.user?.roles?.includes("AuditHead") ||
    session?.user?.roles?.includes("Auditor");

  // Dynamic data translation for audit plan entries
  const { data: translatedAuditPlan } = useTranslatedData(data?.annualAuditPlan || [], { modelName: 'AuditEngagement' });

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

  const handleRiskCardClick = (filter: string, title: string) => {
    if (!canDrillDown) return;
    setDrillDown({ open: true, type: 'risks', title, filter });
    fetchDrillDownData('risks', { filter });
  };

  const handleAuditCardClick = (filter: string, title: string) => {
    if (!canDrillDown) return;
    setDrillDown({ open: true, type: 'audits', title, filter });
    fetchDrillDownData('audits', { filter });
  };

  const handleCapaClick = (department: string, status: string) => {
    if (!canDrillDown) return;
    setDrillDown({
      open: true,
      type: 'capa',
      title: `${t("CAPA")} - ${department} (${t(status)})`,
      department,
      status,
    });
    fetchDrillDownData('capa', { department, status });
  };

  const handleAuditPlanClick = (auditId: string, title: string) => {
    if (!canDrillDown) return;
    setDrillDown({
      open: true,
      type: 'audit-detail',
      title: `${t("Audit Details")} - ${title}`,
      auditId,
    });
    fetchDrillDownData('audit-plan', { auditId });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartBarClick = (data: any) => {
    if (!canDrillDown) return;
    if (data && data.name) {
      const riskLevel = data.name.toLowerCase();
      handleRiskCardClick(riskLevel, `${t(data.name)} ${t("Risk Details")}`);
    }
  };

  const closeDrillDown = () => {
    setDrillDown({ open: false, type: null, title: '' });
    setDrillDownData(null);
  };

  // Navigate to detail - open modal for audit, navigate for others
  const navigateToDetail = (type: string, id: string) => {
    closeDrillDown();
    switch (type) {
      case 'risk':
        router.push(`/internal-audit/risk-register`);
        break;
      case 'audit':
        setSelectedEngagementId(id);
        setFieldworkModalOpen(true);
        break;
      case 'capa':
        router.push(`/internal-audit/capa-tracking`);
        break;
    }
  };

  // Risk chart data with Tailwind-friendly colors
  const riskChartData = data ? [
    { name: "Extreme", value: data.riskStats.extreme, barClass: "bg-red-400", dotClass: "bg-red-400" },
    { name: "High", value: data.riskStats.high, barClass: "bg-orange-400", dotClass: "bg-orange-400" },
    { name: "Medium", value: data.riskStats.medium, barClass: "bg-amber-400", dotClass: "bg-amber-400" },
    { name: "Low", value: data.riskStats.low, barClass: "bg-emerald-400", dotClass: "bg-emerald-400" },
  ] : [];

  // Paginated CAPA data
  const totalCapaPages = data ? Math.ceil(data.capaStatusByDepartment.length / itemsPerPage) : 0;
  const paginatedCapaData = data?.capaStatusByDepartment.slice(
    capaPage * itemsPerPage,
    (capaPage + 1) * itemsPerPage
  ) || [];

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading dashboard...")}</p>
        </div>
      </div>
    );
  }

  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access the Internal Audit Dashboard.")} />;
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
          {t("No data available")}
        </div>
      );
    }

    switch (drillDown.type) {
      case 'risks':
        return (
          <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden min-w-full">
              <Table>
                <TableHeader>
                  <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5 whitespace-nowrap">{t("Risk ID")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Description")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Department")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Category")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Severity")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5 whitespace-nowrap">{t("Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillDownData.data.map((risk: Record<string, unknown>) => (
                    <TableRow key={risk.id as string} className="border-b border-slate-100 last:border-0">
                      <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5 whitespace-nowrap">{risk.riskId as string}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 max-w-[180px] truncate" title={risk.riskDescription as string}>
                        {risk.riskDescription as string}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{risk.department as string}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{risk.category as string}</TableCell>
                      <TableCell className="py-3 whitespace-nowrap"><SeverityBadge t={t} severity={risk.riskLevel as string} /></TableCell>
                      <TableCell className="py-3 whitespace-nowrap"><StatusBadge t={t} status={risk.status as string} /></TableCell>
                      <TableCell className="py-3 pr-5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                          onClick={() => navigateToDetail('risk', risk.id as string)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-center px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">
                  {t("Showing")} {drillDownData.data.length} {t("of")} {drillDownData.total} {t("records")}
                </span>
              </div>
            </div>
          </div>
        );

      case 'audits':
        return (
          <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden min-w-full">
              <Table>
                <TableHeader>
                  <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5 whitespace-nowrap">{t("Audit ID")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Title")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Department")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Type")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Auditor")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5 whitespace-nowrap">{t("Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillDownData.data.map((audit: Record<string, unknown>) => (
                    <TableRow key={audit.id as string} className="border-b border-slate-100 last:border-0">
                      <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5 whitespace-nowrap">{audit.auditId as string}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 max-w-[180px] truncate" title={audit.engagementTitle as string}>
                        {audit.engagementTitle as string}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{audit.department as string}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{audit.auditType as string}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{audit.auditor as string}</TableCell>
                      <TableCell className="py-3 whitespace-nowrap"><StatusBadge t={t} status={audit.status as string} /></TableCell>
                      <TableCell className="py-3 pr-5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                          onClick={() => navigateToDetail('audit', audit.id as string)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-center px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">
                  {t("Showing")} {drillDownData.data.length} {t("of")} {drillDownData.total} {t("records")}
                </span>
              </div>
            </div>
          </div>
        );

      case 'capa':
        return (
          <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden min-w-full">
              <Table>
                <TableHeader>
                  <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5 whitespace-nowrap">{t("CAPA ID")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Title")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Finding")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Severity")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Responsible")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Target Date")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5 whitespace-nowrap">{t("Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillDownData.data.map((capa: Record<string, unknown>) => (
                    <TableRow key={capa.id as string} className="border-b border-slate-100 last:border-0">
                      <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5 whitespace-nowrap">{capa.capaId as string}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 max-w-[140px] truncate" title={capa.title as string}>
                        {capa.title as string}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 max-w-[140px] truncate" title={capa.finding as string}>
                        {capa.finding as string}
                      </TableCell>
                      <TableCell className="py-3 whitespace-nowrap"><SeverityBadge t={t} severity={capa.severity as string} /></TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{capa.responsiblePerson as string}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">
                        {capa.targetDate
                          ? new Date(capa.targetDate as string).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="py-3 whitespace-nowrap"><StatusBadge t={t} status={capa.status as string} /></TableCell>
                      <TableCell className="py-3 pr-5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                          onClick={() => navigateToDetail('capa', capa.id as string)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-center px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">
                  {t("Showing")} {drillDownData.data.length} {t("of")} {drillDownData.total} {t("records")}
                </span>
              </div>
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
        if (!auditDetail) return <div className="text-center py-12 text-slate-500">{t("No data available")}</div>;

        return (
          <div className="max-h-[60vh] overflow-y-auto space-y-6">
            {/* Audit Info */}
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-sm text-slate-500">{t("Audit ID")}:</span>
                    <span className="text-sm font-medium text-slate-800">{auditDetail.auditId || 'N/A'}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-sm text-slate-500">{t("Department")}:</span>
                    <span className="text-sm font-medium text-slate-800">{auditDetail.department || 'N/A'}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-sm text-slate-500">{t("Type")}:</span>
                    <span className="text-sm font-medium text-slate-800">{auditDetail.auditType || 'N/A'}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Activity className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-sm text-slate-500">{t("Status")}:</span>
                    <StatusBadge t={t} status={auditDetail.status || ''} />
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-sm text-slate-500">{t("Duration")}:</span>
                    <span className="text-sm font-medium text-slate-800">
                      {auditDetail.startDate
                        ? new Date(auditDetail.startDate).toLocaleDateString()
                        : 'N/A'} - {auditDetail.endDate
                        ? new Date(auditDetail.endDate).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-sm text-slate-500">{t("Auditor")}:</span>
                    <span className="text-sm font-medium text-slate-800">
                      {auditDetail.auditor?.name || t("Unassigned")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-5">
                <div className="text-2xl font-bold text-slate-800">{auditDetail.findingsCount || 0}</div>
                <div className="text-sm font-medium text-slate-500 mt-1">{t("Findings")}</div>
              </div>
              <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-5">
                <div className="text-2xl font-bold text-slate-800">{auditDetail.evidenceRequestsCount || 0}</div>
                <div className="text-sm font-medium text-slate-500 mt-1">{t("Evidence Requests")}</div>
              </div>
            </div>

            {/* Objectives & Scope */}
            {(auditDetail.objectives || auditDetail.scope) && (
              <div className="space-y-3">
                {auditDetail.objectives && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-1">{t("Objectives")}</h4>
                    <p className="text-sm text-slate-600">{auditDetail.objectives}</p>
                  </div>
                )}
                {auditDetail.scope && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-1">{t("Scope")}</h4>
                    <p className="text-sm text-slate-600">{auditDetail.scope}</p>
                  </div>
                )}
              </div>
            )}

            {/* View Full Details Button */}
            <div className="flex ltr:justify-end rtl:justify-start">
              <Button
                className="bg-primary-600 hover:bg-primary-700"
                onClick={() => navigateToDetail('audit', auditDetail.id || '')}
              >
                {t("View Full Details")}
                <ExternalLink className="h-4 w-4 ltr:ml-2 rtl:mr-2" />
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
      <div className="space-y-4 sm:space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("My Tasks")}</span>
        </nav>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("My Audit Tasks")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("Track your evidence requests and corrective actions")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Link href="/internal-audit/fieldwork" className="block">
            <div className="relative flex flex-col p-3 sm:p-5 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
                  <Activity className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-800">{data?.stats.evidenceRequests.total || 0}</div>
              <div className="mt-1">
                <span className="text-sm font-medium text-slate-500">{t("Evidence Requests")}</span>
                <p className="text-xs text-slate-400 mt-0.5">{data?.stats.evidenceRequests.pending || 0} {t("Pending")}</p>
              </div>
            </div>
          </Link>
          <Link href="/internal-audit/capa-tracking" className="block">
            <div className="relative flex flex-col p-3 sm:p-5 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-800">{data?.stats.capa.total || 0}</div>
              <div className="mt-1">
                <span className="text-sm font-medium text-slate-500">{t("Corrective Actions")}</span>
                <p className="text-xs text-slate-400 mt-0.5">{data?.stats.capa.open || 0} {t("Open")}</p>
              </div>
            </div>
          </Link>
          <div className="relative flex flex-col p-3 sm:p-5 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-800">{(data?.stats.evidenceRequests.pending || 0) + (data?.stats.capa.open || 0)}</div>
            <div className="mt-1">
              <span className="text-sm font-medium text-slate-500">{t("Pending Actions")}</span>
              <p className="text-xs text-slate-400 mt-0.5">{t("Items requiring attention")}</p>
            </div>
          </div>
          <div className="relative flex flex-col p-3 sm:p-5 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-red-600">{(data?.stats.evidenceRequests.overdue || 0) + (data?.stats.capa.overdue || 0)}</div>
            <div className="mt-1">
              <span className="text-sm font-medium text-slate-500">{t("Overdue Items")}</span>
              <p className="text-xs text-slate-400 mt-0.5">{t("Requires immediate attention")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard view for Audit Head / Auditor
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Dashboard")}</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Audit Dashboard")}</h1>
      </div>

      {/* Drill-down Dialog */}
      <Dialog open={drillDown.open} onOpenChange={(open) => !open && closeDrillDown()}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[85vh] flex flex-col">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <DialogTitle className="text-lg font-semibold text-slate-800">
              {drillDown.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              {t("Click on any row to view more details")}
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 sm:px-6 py-5 flex-1 overflow-hidden">
            {renderDrillDownContent()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div
          className={`relative flex flex-col p-3 sm:p-5 rounded-xl border border-slate-200 bg-white ${canDrillDown ? "cursor-pointer" : ""}`}
          onClick={() => handleRiskCardClick('all', t('All Risks'))}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <Shield className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">{data?.riskStats.total || 0}</div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("Total Risks")}</span>
          </div>
        </div>
        <div
          className={`relative flex flex-col p-3 sm:p-5 rounded-xl border border-slate-200 bg-white ${canDrillDown ? "cursor-pointer" : ""}`}
          onClick={() => handleRiskCardClick('extreme', t('Extreme Severity Risks'))}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">{data?.riskStats.extreme || 0}</div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("Extreme Severity")}</span>
          </div>
        </div>
        <div
          className={`relative flex flex-col p-3 sm:p-5 rounded-xl border border-slate-200 bg-white ${canDrillDown ? "cursor-pointer" : ""}`}
          onClick={() => handleAuditCardClick('ongoing', t('Ongoing Audits'))}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">{data?.auditStats.ongoing || 0}</div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("Ongoing Audits")}</span>
          </div>
        </div>
        <div
          className={`relative flex flex-col p-3 sm:p-5 rounded-xl border border-slate-200 bg-white ${canDrillDown ? "cursor-pointer" : ""}`}
          onClick={() => handleAuditCardClick('completed', t('Completed Audits'))}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">{data?.auditStats.completed || 0}</div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("Completed Audits")}</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Risk by Rating Chart */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Risk by Rating")}</h3>
            {canDrillDown && <p className="text-xs text-slate-400 mt-1">{t("Click on a bar to view risks of that severity")}</p>}
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {riskChartData.map((item) => {
              const maxValue = Math.max(...riskChartData.map(d => d.value), 1);
              const percentage = (item.value / maxValue) * 100;
              return (
                <div
                  key={item.name}
                  className={canDrillDown ? "cursor-pointer group" : "group"}
                  onClick={() => handleChartBarClick(item)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${item.dotClass}`} />
                      <span className="text-sm font-medium text-slate-700">{t(item.name)}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{item.value}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${item.barClass}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {data?.riskStats.total === 0 && (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">{t("No risk data available")}</p>
              </div>
            )}
          </div>
        </div>

        {/* CAPA Status Overview */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-800">{t("CAPA Status Overview")}</h3>
              {canDrillDown && <p className="text-xs text-slate-400 mt-1">{t("Click on a status badge to view details")}</p>}
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
              <span className="text-xs">{capaPage + 1} {t("to")} {Math.min((capaPage + 1) * itemsPerPage, data?.capaStatusByDepartment.length || 0)} {t("of")} {data?.capaStatusByDepartment.length || 0}</span>
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
          <div className="p-4 sm:p-6">
            {paginatedCapaData.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">{t("No CAPA data available")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {paginatedCapaData.map((dept, index) => (
                  <div key={index} className="bg-slate-50/50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 justify-center mb-3">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      <h4 className="text-sm font-semibold text-slate-700">{dept.name}</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">{t("Open")}</span>
                        <div className="flex gap-1">
                          {dept.open.high > 0 && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 ${canDrillDown ? "cursor-pointer hover:bg-red-200" : ""}`}
                              onClick={() => handleCapaClick(dept.name, 'open')}
                            >
                              H: {dept.open.high}
                            </span>
                          )}
                          {dept.open.medium > 0 && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 ${canDrillDown ? "cursor-pointer hover:bg-amber-200" : ""}`}
                              onClick={() => handleCapaClick(dept.name, 'open')}
                            >
                              M: {dept.open.medium}
                            </span>
                          )}
                          {dept.open.low > 0 && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 ${canDrillDown ? "cursor-pointer hover:bg-emerald-200" : ""}`}
                              onClick={() => handleCapaClick(dept.name, 'open')}
                            >
                              L: {dept.open.low}
                            </span>
                          )}
                          {dept.open.high === 0 && dept.open.medium === 0 && dept.open.low === 0 && (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">{t("Closed")}</span>
                        <div className="flex gap-1">
                          {dept.closed.high > 0 && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 ${canDrillDown ? "cursor-pointer hover:bg-red-200" : ""}`}
                              onClick={() => handleCapaClick(dept.name, 'closed')}
                            >
                              H: {dept.closed.high}
                            </span>
                          )}
                          {dept.closed.medium > 0 && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 ${canDrillDown ? "cursor-pointer hover:bg-amber-200" : ""}`}
                              onClick={() => handleCapaClick(dept.name, 'closed')}
                            >
                              M: {dept.closed.medium}
                            </span>
                          )}
                          {dept.closed.low > 0 && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 ${canDrillDown ? "cursor-pointer hover:bg-emerald-200" : ""}`}
                              onClick={() => handleCapaClick(dept.name, 'closed')}
                            >
                              L: {dept.closed.low}
                            </span>
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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">
            {t("Annual Audit Plan")} - {data?.currentYear || new Date().getFullYear()}
          </h3>
          {canDrillDown && <p className="text-xs text-slate-400 mt-1">{t("Click on an audit row to view details")}</p>}
        </div>
        <div className="p-3 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="min-w-[200px] text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Audit Name")}</TableHead>
                  <TableHead className="min-w-[150px] text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Auditor")}</TableHead>
                  {MONTH_KEYS.map((month) => (
                    <TableHead key={month} className="text-center min-w-[60px] text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t(month)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {translatedAuditPlan.length > 0 ? (
                  translatedAuditPlan.map((audit) => (
                    <TableRow
                      key={audit.id}
                      className={`border-b border-slate-100 last:border-0 ${canDrillDown ? "cursor-pointer hover:bg-slate-50/50" : ""}`}
                      onClick={() => handleAuditPlanClick(audit.id, audit.engagementTitle || audit.auditId)}
                    >
                      <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">
                        <span className={canDrillDown ? "text-primary-600" : ""}>
                          {audit.engagementTitle || audit.auditId}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-slate-700">{audit.auditorName || '-'}</TableCell>
                      {MONTH_KEYS.map((month, monthIndex) => {
                        const isInRange = monthIndex >= audit.startMonth && monthIndex <= audit.endMonth;
                        const isStart = monthIndex === audit.startMonth;
                        return (
                          <TableCell key={month} className="py-3 px-1 text-center">
                            {isStart ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700 whitespace-nowrap">
                                {audit.durationDays} {t("Days")}
                              </span>
                            ) : isInRange ? (
                              <div className="h-6 bg-sky-100 rounded-sm"></div>
                            ) : null}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={14} className="h-24 text-center text-sm text-slate-500">
                      {t("No audit plans for this year")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Auditor Schedule Chart */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">
            {t("Auditor Schedule")} - {data?.currentYear || new Date().getFullYear()}
          </h3>
          <p className="text-xs text-slate-400 mt-1">{t("Monthly allocation by auditor")}</p>
        </div>
        <div className="p-3 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                  <TableHead className="min-w-[200px] text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Auditor Name")}</TableHead>
                  {MONTH_KEYS.map((month) => (
                    <TableHead key={month} className="text-center min-w-[60px] text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t(month)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.auditorSchedule && data.auditorSchedule.length > 0 ? (
                  data.auditorSchedule.map((auditor) => (
                    <TableRow key={auditor.id} className="border-b border-slate-100 last:border-0">
                      <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">{auditor.name}</TableCell>
                      {MONTH_KEYS.map((month, monthIndex) => {
                        const assignment = auditor.assignments.find(
                          (a) => monthIndex >= a.startMonth && monthIndex <= a.endMonth
                        );
                        const isStart = assignment && monthIndex === assignment.startMonth;
                        return (
                          <TableCell key={month} className="py-3 px-1 text-center">
                            {isStart ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700 whitespace-nowrap ${canDrillDown ? "cursor-pointer hover:bg-primary-200" : ""}`}
                                onClick={() => handleAuditPlanClick(assignment.auditId, assignment.engagementTitle)}
                                title={assignment.engagementTitle}
                              >
                                {assignment.durationDays} {t("Days")}
                              </span>
                            ) : assignment ? (
                              <div
                                className={`h-6 bg-primary-100 rounded-sm ${canDrillDown ? "cursor-pointer hover:bg-primary-200" : ""}`}
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
                    <TableCell colSpan={13} className="h-24 text-center text-sm text-slate-500">
                      {t("No auditor schedules for this year")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Fieldwork Detail Modal */}
      <FieldworkDetailModal
        open={fieldworkModalOpen}
        onClose={() => { setFieldworkModalOpen(false); setSelectedEngagementId(null); }}
        engagementId={selectedEngagementId}
        mode="view"
      />
    </div>
  );
}

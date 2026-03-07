"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/usePagination";
import { Home, ChevronRight, Search, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { RiskRatingBadge } from "@/components/risks/risk-rating-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useUserRoles, usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskRating: string;
  status: string;
  responseStrategy: string | null;
  treatmentPlan: string | null;
  treatmentDueDate: string | null;
  likelihood: number;
  impact: number;
  owner: { fullName: string } | null;
  assessmentStatus?: string;
  responseStatus?: string; // Separate status for Risk Response Strategy workflow
  department?: { id: string; name: string } | null;
}

export default function RiskResponsePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userRoles = useUserRoles();
  const { canEdit, canApprove } = usePermissions('risk.response');
  const { t } = useLanguage();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if user is DepartmentReviewer or DepartmentContributor (department-scoped)
  const isDepartmentRole = userRoles.some(
    (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
  );
  const isDepartmentReviewer = userRoles.includes("DepartmentReviewer");
  const userDepartmentId = session?.user?.departmentId;

  // Filters - "all" shows all items without filtering
  const [searchTerm, setSearchTerm] = useState("");
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const ITEMS_PER_PAGE = 10;

  // Dialog states
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // (Response now uses full page navigation instead of dialog)

  useEffect(() => {
    fetchRisks();
  }, []);

  const fetchRisks = async () => {
    try {
      const response = await fetch("/api/risks");
      if (response.ok) {
        const data = await response.json();
        // Only show risks that have a response strategy assigned (Treat, Transfer, Accept, Avoid)
        const allRisks = data.data || [];
        const responseRisks = allRisks.filter((risk: Risk) =>
          risk.responseStrategy && ["Treat", "Transfer", "Accept", "Avoid"].includes(risk.responseStrategy)
        );
        setRisks(responseRisks);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (risk: Risk) => {
    router.push(`/risks/response/${risk.id}`);
  };

  // Handle Respond action - changes responseStatus from Open to In-Progress
  const handleRespond = async (risk: Risk, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(risk.id);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseStatus: "In-Progress" }),
      });
      if (response.ok) {
        // Update local state and navigate to detail page
        setRisks(prev => prev.map(r =>
          r.id === risk.id ? { ...r, responseStatus: "In-Progress" } : r
        ));
        router.push(`/risks/response/${risk.id}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("PATCH failed:", response.status, errorData);
        alert(`Failed to update: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to respond:", error);
      alert("Network error: Failed to respond");
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Submit for Approval action
  const handleSubmitForApproval = async (risk: Risk, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(risk.id);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseStatus: "Awaiting Approval" }),
      });
      if (response.ok) {
        setSuccessMessage(t("Risk Submit for Approval Successfully !"));
        setSuccessDialogOpen(true);
        // Update local state
        setRisks(prev => prev.map(r =>
          r.id === risk.id ? { ...r, responseStatus: "Awaiting Approval" } : r
        ));
      }
    } catch (error) {
      console.error("Failed to submit for approval:", error);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Approve action
  const handleApprove = async (risk: Risk, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(risk.id);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseStatus: "Completed" }),
      });
      if (response.ok) {
        setSuccessMessage(t("Risk Approved Successfully !"));
        setSuccessDialogOpen(true);
        // Update local state
        setRisks(prev => prev.map(r =>
          r.id === risk.id ? { ...r, responseStatus: "Completed" } : r
        ));
      }
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setActionLoading(null);
    }
  };

  // Normalize status to handle variations (e.g., "In Progress" vs "In-Progress")
  const normalizeStatus = (status: string): string => {
    const normalized = status.toLowerCase().replace(/\s+/g, '-');
    if (normalized === 'in-progress') return 'In-Progress';
    if (normalized === 'awaiting-approval') return 'Awaiting Approval';
    if (normalized === 'completed' || normalized === 'closed') return 'Completed';
    if (normalized === 'sent-back') return 'Sent Back';
    if (normalized === 'open') return 'Open';
    return status;
  };

  // Get action buttons based on risk responseStatus - matching source system exactly
  // Permission-gated: Submit for Approval requires edit, Approve requires approve permission
  const getActionButtons = (risk: Risk) => {
    // Use responseStatus for Risk Response Strategy workflow (separate from assessmentStatus)
    const rawStatus = risk.responseStatus || "Open";
    const status = normalizeStatus(rawStatus);
    const isLoading = actionLoading === risk.id;

    switch (status) {
      case "Open":
        // Open status: "Respond" button (changes status to In-Progress)
        return canEdit ? (
          <Button size="sm" className="h-8 text-xs" onClick={(e) => handleRespond(risk, e)} disabled={isLoading}>
            {isLoading ? "..." : t("Respond")}
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(risk)}>
            {t("View")}
          </Button>
        );
      case "In-Progress":
        // In-Progress status: "Resume" button only (Submit for Approval is in details page)
        return (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(risk)}>
            {t("Resume")}
          </Button>
        );
      case "Sent Back":
        // Sent Back status: "Resume" button to view and resubmit (if canEdit)
        return canEdit ? (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(risk)}>
            {t("Resume")}
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(risk)}>
            {t("View")}
          </Button>
        );
      case "Awaiting Approval":
        // Awaiting Approval status: "Approve" (if canApprove) + "View" buttons
        return (
          <div className="flex gap-2">
            {canApprove && (
              <Button size="sm" className="h-8 text-xs" onClick={(e) => handleApprove(risk, e)} disabled={isLoading}>
                {isLoading ? "..." : t("Approve")}
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(risk)}>
              {t("View")}
            </Button>
          </div>
        );
      case "Completed":
        // Completed status: "View" button only
        return (
          <Button size="sm" className="h-8 text-xs" onClick={() => openDetail(risk)}>
            {t("View")}
          </Button>
        );
      default:
        // Default fallback - treat as Open
        return canEdit ? (
          <Button size="sm" className="h-8 text-xs" onClick={(e) => handleRespond(risk, e)} disabled={isLoading}>
            {isLoading ? "..." : t("Respond")}
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDetail(risk)}>
            {t("View")}
          </Button>
        );
    }
  };

  // Get normalized responseStatus for a risk (for Risk Response Strategy workflow)
  const getRiskStatus = (risk: Risk) => {
    const rawStatus = risk.responseStatus || "Open";
    return normalizeStatus(rawStatus);
  };

  // Memoize entire filter chain to provide stable array refs for useTranslatedData
  const { departmentFilteredRisks, reviewerFilteredRisks, filteredByStrategy, filteredByProgress, displayRisks } = useMemo(() => {
    // First apply department filtering for department-scoped roles
    const deptFiltered = isDepartmentRole && userDepartmentId
      ? risks.filter((risk) => risk.department?.id === userDepartmentId)
      : risks;

    // DepartmentReviewer only sees items with "Awaiting Approval", "Sent Back", or "Completed" status
    const reviewerFiltered = isDepartmentReviewer
      ? deptFiltered.filter((risk) => {
          const status = normalizeStatus(risk.responseStatus || "Open");
          return status === "Awaiting Approval" || status === "Sent Back" || status === "Completed";
        })
      : deptFiltered;

    const byStrategy = strategyFilter === "all"
      ? reviewerFiltered
      : reviewerFiltered.filter((risk) => risk.responseStrategy === strategyFilter);

    // Filter risks based on progress status ("all" shows all items)
    const byProgress = progressFilter === "all"
      ? byStrategy
      : byStrategy.filter((risk) => {
          const rawStatus = risk.responseStatus || "Open";
          return normalizeStatus(rawStatus) === progressFilter;
        });

    // Search filter
    const display = byProgress.filter((risk) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        risk.riskId.toLowerCase().includes(term) ||
        risk.name.toLowerCase().includes(term) ||
        (risk.responseStrategy || "").toLowerCase().includes(term) ||
        (risk.owner?.fullName || "").toLowerCase().includes(term)
      );
    });

    return {
      departmentFilteredRisks: deptFiltered,
      reviewerFilteredRisks: reviewerFiltered,
      filteredByStrategy: byStrategy,
      filteredByProgress: byProgress,
      displayRisks: display,
    };
  }, [risks, isDepartmentRole, userDepartmentId, isDepartmentReviewer, strategyFilter, progressFilter, searchTerm]);

  // Calculate stats for strategy card
  const strategyTotal = filteredByStrategy.length;
  const strategyClosed = filteredByStrategy.filter(r => {
    const status = getRiskStatus(r);
    return status === "Completed" || r.status === "Closed";
  }).length;

  // Calculate stats for progress card
  const progressTotal = strategyTotal;
  const progressCount = filteredByProgress.length;

  // Get progress label based on filter selection
  const getProgressLabel = () => {
    switch (progressFilter) {
      case "all": return t("All");
      case "Open": return t("Open");
      case "In-Progress": return t("InProgress");
      case "Completed": return t("Completed");
      case "Awaiting Approval": return t("Awaiting Approval");
      case "Sent Back": return t("Sent Back");
      default: return progressFilter;
    }
  };

  // Translate dynamic risk names for non-English locales (before pagination to avoid unstable refs)
  const { data: translatedRisks } = useTranslatedData(displayRisks, { modelName: 'Risk' });

  // Pagination (on translated data)
  const { currentPage, setCurrentPage, totalPages, paginatedData: paginatedRisks } = usePagination({ data: translatedRisks, itemsPerPage: ITEMS_PER_PAGE });

  // Percentage calculations
  const strategyPct = strategyTotal > 0 ? Math.round((strategyClosed / strategyTotal) * 100) : 0;
  const progressPct = progressTotal > 0 ? Math.round((progressCount / progressTotal) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Risk Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Risk Dashboard")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Response")}</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{t("Risk Response Strategy")}</h1>
        </div>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Risk Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Response")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Risk Response Strategy")}</h1>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* Strategy Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">{t("Risk Response Strategy")}</h3>
            <Select value={strategyFilter} onValueChange={setStrategyFilter}>
              <SelectTrigger className="w-full sm:w-32 h-8 text-xs border-slate-200">
                <SelectValue placeholder={t("Strategy")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All")}</SelectItem>
                <SelectItem value="Transfer">{t("Transfer")}</SelectItem>
                <SelectItem value="Avoid">{t("Avoid")}</SelectItem>
                <SelectItem value="Accept">{t("Accept")}</SelectItem>
                <SelectItem value="Treat">{t("Treat")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-[120px] h-[120px] flex-shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="48"
                  fill="none" stroke="#6366f1" strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 - (2 * Math.PI * 48 * strategyPct) / 100}
                  transform="rotate(-90 60 60)"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-800">{strategyPct}%</span>
                <span className="text-[10px] text-slate-500 font-medium">{t("Closed")}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-xs text-slate-600">{t("Closed")}</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">{strategyClosed}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                  <span className="text-xs text-slate-600">{t("Total")}</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">{strategyTotal}</span>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500">{t("Resolution Progress")}</span>
                  <span className="font-semibold text-slate-700">{strategyPct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                    style={{ width: `${strategyPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">{t("Risk Response Progress")}</h3>
            <Select value={progressFilter} onValueChange={setProgressFilter}>
              <SelectTrigger className="w-full sm:w-40 h-8 text-xs border-slate-200">
                <SelectValue placeholder={t("Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All")}</SelectItem>
                {!isDepartmentReviewer && <SelectItem value="Open">{t("Open")}</SelectItem>}
                {!isDepartmentReviewer && <SelectItem value="In-Progress">{t("In-Progress")}</SelectItem>}
                <SelectItem value="Awaiting Approval">{t("Awaiting Approval")}</SelectItem>
                <SelectItem value="Sent Back">{t("Sent Back")}</SelectItem>
                <SelectItem value="Completed">{t("Completed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-[120px] h-[120px] flex-shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="48"
                  fill="none" stroke="#10b981" strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 - (2 * Math.PI * 48 * progressPct) / 100}
                  transform="rotate(-90 60 60)"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-800">{progressPct}%</span>
                <span className="text-[10px] text-slate-500 font-medium">{getProgressLabel()}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-600">{getProgressLabel()}</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">{progressCount}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                  <span className="text-xs text-slate-600">{t("Total")}</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">{progressTotal}</span>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500">{t("Completion")}</span>
                  <span className="font-semibold text-slate-700">{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-0 sm:min-w-[280px] max-w-md">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search risks...")}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
        </div>

        {/* Column Headers */}
        <div className="overflow-x-auto">
        <div className="grid grid-cols-[80px_1.5fr_100px_90px_90px_100px_90px] gap-2 sm:gap-4 px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[800px]">
          <span>{t("Risk ID")}</span>
          <span>{t("Risk Name")}</span>
          <span>{t("Risk Rating")}</span>
          <span>{t("Strategy")}</span>
          <span>{t("Due Date")}</span>
          <span>{t("Status")}</span>
          <span>{t("Action")}</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {paginatedRisks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="h-6 w-6 text-primary-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t("No risks found")}</p>
              <p className="text-xs text-slate-400">{t("Try adjusting your search or filters")}</p>
            </div>
          ) : (
            paginatedRisks.map((risk) => {
              // Find original risk for action buttons (needs untranslated data for API calls)
              const originalRisk = displayRisks.find(r => r.id === risk.id) || risk;
              return (
              <div
                key={risk.id}
                className="grid grid-cols-[80px_1.5fr_100px_90px_90px_100px_90px] gap-2 sm:gap-4 px-3 sm:px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors min-w-[800px]"
              >
                <span className="text-sm font-medium text-slate-800">{risk.riskId}</span>
                <span className="text-sm text-slate-700 truncate" title={risk.name}>{risk.name}</span>
                <span>
                  <RiskRatingBadge rating={originalRisk.riskRating || "-"} />
                </span>
                <span className="text-sm text-slate-600">{originalRisk.responseStrategy ? t(originalRisk.responseStrategy) : "-"}</span>
                <span className="text-sm text-slate-600">
                  {originalRisk.treatmentDueDate
                    ? new Date(originalRisk.treatmentDueDate).toLocaleDateString("en-GB")
                    : "-"}
                </span>
                <span>
                  <span className={cn(
                    "px-2 py-1 rounded text-xs font-medium",
                    (originalRisk.responseStatus || "Open") === "Completed" && "bg-green-100 text-green-800",
                    (originalRisk.responseStatus || "Open") === "Awaiting Approval" && "bg-purple-100 text-purple-800",
                    (originalRisk.responseStatus || "Open") === "In-Progress" && "bg-amber-100 text-amber-800",
                    (originalRisk.responseStatus || "Open") === "Sent Back" && "bg-red-100 text-red-800",
                    (originalRisk.responseStatus || "Open") === "Open" && "bg-blue-100 text-blue-800"
                  )}>
                    {t(originalRisk.responseStatus || "Open")}
                  </span>
                </span>
                <span>
                  {getActionButtons(originalRisk)}
                </span>
              </div>
              );
            })
          )}
        </div>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={displayRisks.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Success Dialog */}
      <AlertDialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <AlertDialogContent className="p-0 gap-0">
          <AlertDialogHeader className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <AlertDialogTitle>{t("Information")}</AlertDialogTitle>
            <AlertDialogDescription>
              {successMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogAction onClick={() => setSuccessDialogOpen(false)}>
              {t("OK")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Risk response now uses full page navigation at /risks/response/[id] */}
    </div>
  );
}

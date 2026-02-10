"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RiskRatingBadge } from "@/components/risks/risk-rating-badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions, useUserRoles } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  Activity,
  Search,
  Eye,
  Shield,
  AlertCircle,
  Clock,
  CheckCircle,
  Home,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { RiskDetailDialog } from "@/components/risks/risk-detail-dialog";
import { NewRiskWizard } from "@/components/risks/new-risk-wizard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskSources: string | null;
  category: { id: string; name: string } | null;
  type: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  owner: { id: string; fullName: string; email: string } | null;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskRating: string;
  status: string;
  responseStrategy: string | null;
  treatmentPlan?: string | null;
  treatmentDueDate?: string | null;
  treatmentStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  threats: { threat: { id: string; name: string } }[];
  vulnerabilities: { vulnerability: { id: string; name: string } }[];
  causes?: { cause: { id: string; name: string } }[];
  impactedAsset?: { id: string; assetId: string; name: string } | null;
  impactedProcess?: { id: string; processCode: string; name: string } | null;
  controlRisks?: { control: { id: string; controlCode: string; name: string; status: string } }[];
}

interface Category {
  id: string;
  name: string;
}

interface RiskType {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface ActivityLog {
  id: string;
  activity: string;
  description: string | null;
  actor: string;
  createdAt: string;
  risk: { riskId: string; name: string };
}

interface Stats {
  totalRisks: number;
  openRisks: number;
  inProgressRisks: number;
  closedRisks: number;
}

function RiskRegisterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const userRoles = useUserRoles();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions('risk.register');
  const initialStatus = searchParams.get("status") || "";
  const initialRating = searchParams.get("riskRating") || "";
  const fromParam = searchParams.get("from");
  const fromDashboard = fromParam === "dashboard" || fromParam === "risk-dashboard";

  // Check if user is DepartmentReviewer or DepartmentContributor (department-scoped)
  const isDepartmentRole = userRoles.some(
    (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
  );
  const userDepartmentId = session?.user?.departmentId;

  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [riskTypes, setRiskTypes] = useState<RiskType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalRisks: 0,
    openRisks: 0,
    inProgressRisks: 0,
    closedRisks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState(initialRating || "all");
  const [statusFilter, setStatusFilter] = useState(initialStatus || "");

  // Dialog states
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [riskToDelete, setRiskToDelete] = useState<Risk | null>(null);
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityLogsTotal, setActivityLogsTotal] = useState(0);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newRiskDialogOpen, setNewRiskDialogOpen] = useState(false);
  const [riskToEdit, setRiskToEdit] = useState<Risk | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchRisks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (categoryFilter && categoryFilter !== "all") params.append("categoryId", categoryFilter);
      if (typeFilter && typeFilter !== "all") params.append("typeId", typeFilter);
      if (ratingFilter && ratingFilter !== "all") params.append("riskRating", ratingFilter);
      if (statusFilter) params.append("status", statusFilter);

      const response = await fetch(`/api/risks?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRisks(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, typeFilter, ratingFilter, statusFilter]);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/risks/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/risk-categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const fetchRiskTypes = async () => {
    try {
      const response = await fetch("/api/risk-types");
      if (response.ok) {
        const data = await response.json();
        setRiskTypes(data);
      }
    } catch (error) {
      console.error("Failed to fetch risk types:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const response = await fetch("/api/risks/activity-log?limit=100");
      if (response.ok) {
        const data = await response.json();
        setActivityLogs(data.data || []);
        setActivityLogsTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    }
  };

  useEffect(() => {
    fetchRisks();
    fetchStats();
    fetchCategories();
    fetchRiskTypes();
    fetchDepartments();
  }, [fetchRisks]);

  const handleViewRisk = (risk: Risk) => {
    setSelectedRisk(risk);
    setEditMode(false);
    setDetailOpen(true);
  };

  const handleEditRisk = (risk: Risk) => {
    setRiskToEdit(risk);
    setNewRiskDialogOpen(true);
  };

  const handleNewRisk = () => {
    setRiskToEdit(null);
    setNewRiskDialogOpen(true);
  };

  const handleRiskWizardSuccess = () => {
    setNewRiskDialogOpen(false);
    setRiskToEdit(null);
    fetchRisks();
    fetchStats();
  };

  const handleDeleteClick = (risk: Risk) => {
    setRiskToDelete(risk);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!riskToDelete) return;

    try {
      const response = await fetch(`/api/risks/${riskToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchRisks();
        fetchStats();
      }
    } catch (error) {
      console.error("Failed to delete risk:", error);
    } finally {
      setDeleteDialogOpen(false);
      setRiskToDelete(null);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/risks/export?format=csv");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Risk-Register.csv";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Failed to export:", error);
    }
  };

  const handleActivityLogOpen = () => {
    fetchActivityLogs();
    setActivityLogOpen(true);
  };

  const handleStatusCardClick = (status: string) => {
    if (statusFilter === status) {
      setStatusFilter("");
    } else {
      setStatusFilter(status);
    }
  };

  // Show loading state while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Risk Register.")} />;
  }

  // Filter risks for department-scoped roles
  const displayRisks = isDepartmentRole && userDepartmentId
    ? risks.filter(r => r.department?.id === userDepartmentId)
    : risks;

  // Calculate pagination
  const totalPages = Math.ceil(displayRisks.length / ITEMS_PER_PAGE);
  const paginatedRisks = displayRisks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Risk Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Register")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Register")}</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <Shield className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">
            {stats.totalRisks}
          </div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("Total Risks")}</span>
          </div>
        </div>
        <button
          onClick={() => handleStatusCardClick("Open")}
          className={cn(
            "relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white text-left transition-colors",
            statusFilter === "Open" && "border-red-500 ring-2 ring-red-200"
          )}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-semantic-error">
            {stats.openRisks}
          </div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("Open Risks")}</span>
          </div>
        </button>
        <button
          onClick={() => handleStatusCardClick("In Progress")}
          className={cn(
            "relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white text-left transition-colors",
            statusFilter === "In Progress" && "border-amber-500 ring-2 ring-amber-200"
          )}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-warning-600">
            {stats.inProgressRisks}
          </div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("In Progress")}</span>
          </div>
        </button>
        <button
          onClick={() => handleStatusCardClick("Closed")}
          className={cn(
            "relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white text-left transition-colors",
            statusFilter === "Closed" && "border-green-500 ring-2 ring-green-200"
          )}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-semantic-success">
            {stats.closedRisks}
          </div>
          <div className="mt-1">
            <span className="text-sm font-medium text-slate-500">{t("Closed Risks")}</span>
          </div>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2">
        <PermissionGate resource="risk.register" action="create">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Import")}
          </Button>
        </PermissionGate>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Export")}
        </Button>
        <Button variant="outline" size="sm" onClick={handleActivityLogOpen}>
          <Activity className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Activity Log")}
        </Button>
        <PermissionGate resource="risk.register" action="create">
          <Button size="sm" onClick={handleNewRisk} className="bg-primary-600 hover:bg-primary-700">
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("New Risk")}
          </Button>
        </PermissionGate>
      </div>

      {/* Data Table with Search and Filters */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      ) : displayRisks.length > 0 || search || categoryFilter !== "all" || typeFilter !== "all" || ratingFilter !== "all" ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
            <div className="relative flex-1 min-w-[280px] max-w-md">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search risks...")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                  <SelectValue placeholder={t("Category")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">{t("All Categories")}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                  <SelectValue placeholder={t("Type")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">{t("All Types")}</SelectItem>
                  {riskTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ratingFilter} onValueChange={(v) => { setRatingFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                  <SelectValue placeholder={t("Rating")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">{t("All Ratings")}</SelectItem>
                  <SelectItem value="Catastrophic">{t("Catastrophic")}</SelectItem>
                  <SelectItem value="Very high">{t("Very high")}</SelectItem>
                  <SelectItem value="High">{t("High")}</SelectItem>
                  <SelectItem value="Low Risk">{t("Low Risk")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Column Headers */}
          <div className={`grid ${canEdit || canDelete ? "grid-cols-[100px_1.5fr_1fr_120px_120px_100px_72px]" : "grid-cols-[100px_1.5fr_1fr_120px_120px_100px]"} gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider`}>
            <span>{t("Risk ID")}</span>
            <span>{t("Risk Name")}</span>
            <span>{t("Risk Description")}</span>
            <span>{t("Risk Category")}</span>
            <span>{t("Risk Owner")}</span>
            <span>{t("Risk Rating")}</span>
            {(canEdit || canDelete) && <span className="text-end">{t("Actions")}</span>}
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {paginatedRisks.map((risk) => (
              <div
                key={risk.id}
                className={`grid ${canEdit || canDelete ? "grid-cols-[100px_1.5fr_1fr_120px_120px_100px_72px]" : "grid-cols-[100px_1.5fr_1fr_120px_120px_100px]"} gap-4 px-5 py-3.5 items-center hover:bg-slate-50/60 transition-colors cursor-pointer`}
                onClick={() => handleViewRisk(risk)}
              >
                <span className="text-sm font-medium text-slate-800">{risk.riskId}</span>
                <span className="text-sm text-slate-700 truncate" title={risk.name}>{risk.name}</span>
                <span className="text-sm text-slate-600 truncate" title={risk.description || ""}>{risk.description || "-"}</span>
                <span className="text-sm text-slate-600 truncate">{risk.category?.name || "-"}</span>
                <span className="text-sm text-slate-600 truncate">{risk.owner?.fullName || "-"}</span>
                <div>
                  <RiskRatingBadge rating={risk.riskRating} />
                </div>
                {(canEdit || canDelete) && (
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewRisk(risk);
                      }}
                      className="h-8 w-8 text-slate-400 hover:text-slate-600"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRisk(risk);
                        }}
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(risk);
                        }}
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
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
      ) : (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
          <Shield className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-slate-500">{t("No risks found")}</p>
        </div>
      )}

      {/* Risk Detail Dialog */}
      <RiskDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        risk={selectedRisk}
        editMode={editMode}
        onEditModeChange={setEditMode}
        onSuccess={() => {
          setDetailOpen(false);
          fetchRisks();
          fetchStats();
        }}
        categories={categories}
        departments={departments}
      />

      {/* New/Edit Risk Wizard Dialog */}
      <NewRiskWizard
        open={newRiskDialogOpen}
        onOpenChange={setNewRiskDialogOpen}
        onSuccess={handleRiskWizardSuccess}
        categories={categories}
        departments={departments}
        editData={riskToEdit}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle>{t("Confirmation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this risk?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activity Log Dialog */}
      <Dialog open={activityLogOpen} onOpenChange={setActivityLogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogTitle>{t("Activity Log")}</DialogTitle>
            <p className="text-sm text-slate-500">
              {t("Showing")} {activityLogs.length} {t("of")} {activityLogsTotal} {t("activities")}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="h-12">
                  <th className="text-left px-6 py-3 font-medium text-slate-700">{t("Date")}</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-700">{t("Risk")}</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-700">{t("Activity")}</th>
                  <th className="text-left px-6 py-3 font-medium text-slate-700">{t("Actor")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activityLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {new Date(log.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-primary-600">
                      {log.risk.riskId}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">{log.activity}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{log.actor}</td>
                  </tr>
                ))}
                {activityLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      {t("No activity logs found")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setSelectedFile(null);
        }
      }}>
        <DialogContent className="sm:max-w-[700px] flex flex-col p-0 gap-0">
          <DialogHeader className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogTitle>{t("Import Risks")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                {t("Upload a CSV file to import risks. Download the template first to see the required format.")}
              </p>
              <div className="bg-slate-50 p-3 rounded-md text-sm">
                <p className="font-medium mb-1 text-slate-700">{t("Required columns:")}</p>
                <p className="text-slate-500">
                  {t("Risk name, Risk description, Department, Risk sources, Risk category, Potential threat, Associated vulnerabilities")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/risks/import");
                      if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "Risk-Import-Template.csv";
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } else {
                        toast({
                          title: t("Error"),
                          description: t("Failed to download template"),
                          variant: "destructive",
                        });
                      }
                    } catch (error) {
                      console.error("Failed to download template:", error);
                      toast({
                        title: t("Error"),
                        description: t("Failed to download template"),
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t("Download Template")}
                </Button>
              </div>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                {selectedFile ? (
                  <p className="text-sm font-medium text-primary-600">{selectedFile.name}</p>
                ) : (
                  <p className="text-sm text-slate-500">
                    {t("Click to select a CSV file")}
                  </p>
                )}
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="risk-file-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => document.getElementById("risk-file-upload")?.click()}
                >
                  {t("Select File")}
                </Button>
              </div>
            </div>
          </div>
          {selectedFile && (
            <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => setSelectedFile(null)}
                disabled={importLoading}
              >
                {t("Clear")}
              </Button>
              <Button
                onClick={async () => {
                  if (!selectedFile) return;

                  setImportLoading(true);
                  try {
                    // Parse CSV file
                    const text = await selectedFile.text();
                    const lines = text.split(/\r?\n/).filter(line => line.trim());

                    if (lines.length < 2) {
                      toast({
                        title: t("Error"),
                        description: t("File is empty or has no data rows"),
                        variant: "destructive",
                      });
                      setImportLoading(false);
                      return;
                    }

                    // Parse headers
                    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));

                    // Parse data rows
                    const data = [];
                    for (let i = 1; i < lines.length; i++) {
                      const line = lines[i];
                      if (!line.trim()) continue;

                      // Simple CSV parsing (handles basic quoted values)
                      const values: string[] = [];
                      let current = "";
                      let inQuotes = false;

                      for (let j = 0; j < line.length; j++) {
                        const char = line[j];
                        if (char === '"') {
                          inQuotes = !inQuotes;
                        } else if (char === "," && !inQuotes) {
                          values.push(current.trim().replace(/^"|"$/g, ""));
                          current = "";
                        } else {
                          current += char;
                        }
                      }
                      values.push(current.trim().replace(/^"|"$/g, ""));

                      // Create row object
                      const row: Record<string, string> = {};
                      headers.forEach((header, index) => {
                        row[header] = values[index] || "";
                      });
                      data.push(row);
                    }

                    // Send to API
                    const response = await fetch("/api/risks/import", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        data,
                        columns: headers,
                        actor: session?.user?.name || "System",
                      }),
                    });

                    const result = await response.json();

                    if (!response.ok) {
                      toast({
                        title: t("Import Failed"),
                        description: result.error || t("Failed to import risks"),
                        variant: "destructive",
                      });

                      // Show detailed errors if available
                      if (result.results?.errors?.length > 0) {
                        const errorDetails = result.results.errors
                          .slice(0, 3)
                          .map((e: { row: number; error: string }) => `Row ${e.row}: ${e.error}`)
                          .join("\n");
                        console.error("Import errors:", result.results.errors);
                        toast({
                          title: t("Error Details"),
                          description: errorDetails,
                          variant: "destructive",
                        });
                      }
                    } else {
                      toast({
                        title: t("Import Successful"),
                        description: result.message,
                      });

                      // Close dialog and refresh data
                      setImportDialogOpen(false);
                      setSelectedFile(null);
                      fetchRisks();
                      fetchStats();
                    }
                  } catch (error) {
                    console.error("Import error:", error);
                    toast({
                      title: t("Error"),
                      description: t("Failed to process file. Please check the format."),
                      variant: "destructive",
                    });
                  } finally {
                    setImportLoading(false);
                  }
                }}
                disabled={importLoading}
              >
                {importLoading ? (
                  <>
                    <div className="relative h-4 w-4 mr-2">
                      <div className="absolute inset-0 rounded-full border-2 border-white/30"></div>
                      <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    </div>
                    {t("Importing...")}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {t("Import")}
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RiskRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      }
    >
      <RiskRegisterContent />
    </Suspense>
  );
}

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/usePagination";
import { usePermissions, useUserRoles } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { Unauthorized } from "@/components/ui/unauthorized";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiskRatingBadge } from "@/components/risks/risk-rating-badge";
import { RiskAssessmentWizardDialog } from "@/components/risks/risk-assessment-wizard-dialog";
import { cn } from "@/lib/utils";
import { Search, ChevronRight, Home, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskRating: string;
  category: { id: string; name: string } | null;
  owner: { id: string; fullName: string } | null;
  type: { id: string; name: string } | null;
  assessmentStatus: string;
  threats?: { threat: { id: string; name: string } }[];
  vulnerabilities?: { vulnerability: { id: string; name: string } }[];
  riskSources?: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface RiskType {
  id: string;
  name: string;
}

interface RiskRatingThreshold {
  min: number;
  max: number;
  rating: string;
  color: string;
}

interface RiskSettings {
  rating_matrix: {
    thresholds: RiskRatingThreshold[];
  };
}

const defaultRatingThresholds: RiskRatingThreshold[] = [
  { min: 1, max: 9, rating: "Low Risk", color: "#22c55e" },
  { min: 10, max: 14, rating: "High", color: "#f59e0b" },
  { min: 15, max: 19, rating: "Very high", color: "#ea580c" },
  { min: 20, max: 25, rating: "Catastrophic", color: "#dc2626" },
];

const statusStyles: Record<string, string> = {
  "Approved": "bg-green-100 text-green-800",
  "Completed": "bg-green-100 text-green-800",
  "Submitted": "bg-purple-100 text-purple-800",
  "Draft": "bg-slate-100 text-slate-700",
  "Rejected": "bg-red-100 text-red-800",
  "In-Progress": "bg-amber-100 text-amber-800",
  "Open": "bg-blue-100 text-blue-800",
  "Assessment Pending": "bg-slate-100 text-slate-700",
};

export default function RiskAssessmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromDashboard = searchParams.get("from") === "dashboard";
  const { canView, canCreate, canEdit, isLoading: permissionsLoading } = usePermissions('risk.assessment');
  const userRoles = useUserRoles();
  const { t } = useLanguage();

  const canApprove = userRoles.some(role =>
    ['Reviewer', 'DepartmentReviewer', 'CustomerAdministrator', 'GRCAdministrator'].includes(role)
  );
  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [riskTypes, setRiskTypes] = useState<RiskType[]>([]);
  const [loading, setLoading] = useState(true);

  const [ratingThresholds, setRatingThresholds] = useState<RiskRatingThreshold[]>(defaultRatingThresholds);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Pagination
  const ITEMS_PER_PAGE = 10;

  // Assessment modal state
  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [risksRes, categoriesRes, typesRes, settingsRes] = await Promise.all([
        fetch("/api/risks"),
        fetch("/api/risk-categories"),
        fetch("/api/risk-types"),
        fetch("/api/risk-settings"),
      ]);

      if (risksRes.ok) {
        const data = await risksRes.json();
        setRisks(data.data || []);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data);
      }
      if (typesRes.ok) {
        const data = await typesRes.json();
        setRiskTypes(data);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const defaults = settingsData.defaults as RiskSettings | undefined;

        if (defaults) {
          if (defaults.rating_matrix?.thresholds && defaults.rating_matrix.thresholds.length > 0) {
            setRatingThresholds(defaults.rating_matrix.thresholds);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter risks (memoized to prevent infinite re-renders with useTranslatedData)
  const filteredRisks = useMemo(() => risks.filter((risk) => {
    const matchesSearch =
      searchTerm === "" ||
      risk.riskId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      risk.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || (risk.assessmentStatus || "Open") === statusFilter;

    const matchesRating =
      ratingFilter === "all" || risk.riskRating === ratingFilter;

    const matchesCategory =
      categoryFilter === "all" || risk.category?.id === categoryFilter;

    const matchesType =
      typeFilter === "all" || risk.type?.id === typeFilter;

    return matchesSearch && matchesStatus && matchesRating && matchesCategory && matchesType;
  }), [risks, searchTerm, statusFilter, ratingFilter, categoryFilter, typeFilter]);

  // Pagination
  const { currentPage, setCurrentPage, totalPages, paginatedData: paginatedRisks } = usePagination({ data: filteredRisks, itemsPerPage: ITEMS_PER_PAGE });

  // Translate dynamic data for non-English locales
  const { data: translatedRisks } = useTranslatedData(paginatedRisks, { modelName: 'Risk' });
  const { data: translatedCategories } = useTranslatedData(categories, { modelName: 'RiskCategory' });
  const { data: translatedRiskTypes } = useTranslatedData(riskTypes, { modelName: 'RiskType' });

  // Translate risk owner names
  const uniqueOwners = useMemo(() => {
    const ownerMap = new Map<string, { id: string; fullName: string }>();
    paginatedRisks.forEach(risk => {
      if (risk.owner) {
        ownerMap.set(risk.owner.id, { id: risk.owner.id, fullName: risk.owner.fullName });
      }
    });
    return Array.from(ownerMap.values());
  }, [paginatedRisks]);
  const { data: translatedOwners } = useTranslatedData(uniqueOwners, { modelName: 'User' });

  const getStatusLabel = (status: string) => status || "Open";

  const getActionButton = (risk: Risk) => {
    const status = risk.assessmentStatus || "Open";
    switch (status) {
      case "Completed":
        return canCreate ? (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openAssessment(risk)}>
            {t("Re-assess")}
          </Button>
        ) : null;
      case "Approved":
      case "Submitted":
      case "Rejected":
        return canCreate ? (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openAssessment(risk)}>
            {t("Re-assess")}
          </Button>
        ) : null;
      case "Closed":
        // Closed = awaiting Risk Response Strategy approval, show Resume
        return canEdit ? (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openAssessment(risk)}>
            {t("Resume")}
          </Button>
        ) : null;
      case "Draft":
      case "In-Progress":
        return canEdit ? (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openAssessment(risk)}>
            {t("Resume")}
          </Button>
        ) : null;
      default:
        return canCreate ? (
          <Button size="sm" className="h-8 text-xs" onClick={() => openAssessment(risk)}>
            {t("Initiate")}
          </Button>
        ) : null;
    }
  };

  const handleApprove = async (riskId: string) => {
    try {
      const response = await fetch(`/api/risks/${riskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentStatus: "Approved",
        }),
      });

      if (response.ok) {
        fetchData();
      } else {
        const error = await response.json();
        console.error("Failed to approve:", error);
      }
    } catch (error) {
      console.error("Failed to approve assessment:", error);
    }
  };

  const handleReject = async (riskId: string) => {
    try {
      const response = await fetch(`/api/risks/${riskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentStatus: "Rejected",
        }),
      });

      if (response.ok) {
        fetchData();
      } else {
        const error = await response.json();
        console.error("Failed to reject:", error);
      }
    } catch (error) {
      console.error("Failed to reject assessment:", error);
    }
  };

  const openAssessment = (risk: Risk) => {
    setSelectedRiskId(risk.id);
    setAssessmentDialogOpen(true);
  };

  const handleAssessmentComplete = () => {
    fetchData();
  };

  if (permissionsLoading || loading) {
    return (
      <div className="space-y-6">
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
          <span className="text-primary-700 font-medium">{t("Assessment")}</span>
        </nav>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">{t("Risk Assessment")}</h1>
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

  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Risk Assessment.")} />;
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
        <span className="text-primary-700 font-medium">{t("Assessment")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Risk Assessment")}</h1>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search and Filters */}
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
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto sm:ms-auto">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Status")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Status")}</SelectItem>
                <SelectItem value="Assessment Pending">{t("Assessment Pending")}</SelectItem>
                <SelectItem value="Open">{t("Open")}</SelectItem>
                <SelectItem value="In-Progress">{t("In-Progress")}</SelectItem>
                <SelectItem value="Completed">{t("Completed")}</SelectItem>
                <SelectItem value="Awaiting Approval">{t("Awaiting Approval")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ratingFilter} onValueChange={(v) => { setRatingFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Rating")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Ratings")}</SelectItem>
                {ratingThresholds.map((threshold) => (
                  <SelectItem key={threshold.rating} value={threshold.rating}>
                    {t(threshold.rating)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Category")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Categories")}</SelectItem>
                {translatedCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Type")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Types")}</SelectItem>
                {translatedRiskTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Column Headers */}
        <div className="overflow-x-auto">
        <div className="grid grid-cols-[80px_1.5fr_1fr_90px_1fr_90px_90px_90px] gap-2 sm:gap-4 px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider min-w-[800px]">
          <span>{t("Risk ID")}</span>
          <span>{t("Risk Name")}</span>
          <span>{t("Description")}</span>
          <span>{t("Rating")}</span>
          <span>{t("Category")}</span>
          <span>{t("Owner")}</span>
          <span>{t("Status")}</span>
          <span className="text-end">{t("Action")}</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {translatedRisks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="h-6 w-6 text-primary-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t("No risks found")}</p>
              <p className="text-xs text-slate-400">{t("Try adjusting your search or filters")}</p>
            </div>
          ) : (
            translatedRisks.map((risk) => {
              const status = getStatusLabel(risk.assessmentStatus);
              return (
                <div
                  key={risk.id}
                  className="grid grid-cols-[80px_1.5fr_1fr_90px_1fr_90px_90px_90px] gap-2 sm:gap-4 px-3 sm:px-5 py-3 items-center hover:bg-slate-50/50 transition-colors min-w-[800px]"
                >
                  <span className="text-sm font-medium text-slate-800">{risk.riskId}</span>
                  <span className="text-sm text-slate-700 truncate">{risk.name}</span>
                  <span className="text-sm text-slate-500 truncate">{risk.description || "-"}</span>
                  <span>
                    {risk.riskRating ? <RiskRatingBadge rating={risk.riskRating} /> : <span className="text-sm text-slate-400">-</span>}
                  </span>
                  <span className="text-sm text-slate-600 truncate">{risk.category ? (translatedCategories.find(c => c.id === risk.category?.id)?.name || risk.category.name) : "-"}</span>
                  <span className="text-sm text-slate-600 truncate">{(risk.owner?.id ? translatedOwners.find(o => o.id === risk.owner?.id)?.fullName : null) || risk.owner?.fullName || "-"}</span>
                  <span>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      statusStyles[status] || "bg-slate-100 text-slate-700"
                    )}>
                      {t(status)}
                    </span>
                  </span>
                  <span className="flex justify-end">
                    {getActionButton(risk)}
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
          totalItems={filteredRisks.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Assessment Wizard Modal */}
      <RiskAssessmentWizardDialog
        open={assessmentDialogOpen}
        onOpenChange={setAssessmentDialogOpen}
        riskId={selectedRiskId}
        onAssessmentComplete={handleAssessmentComplete}
      />
    </div>
  );
}

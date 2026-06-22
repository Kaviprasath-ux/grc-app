"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  ChevronRight,
  Home,
  Search,
  FileText,
} from "lucide-react";
import { Pagination as PaginationUI } from "@/components/ui/pagination";
import Link from "next/link";
import { useHasRole, usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { OPINION_RATINGS } from "@/lib/internal-audit/report-shared";

interface CompletedEngagement {
  id: string;
  auditId: string;
  engagementTitle: string;
  departmentName: string;
  auditType: string;
  assignedAuditorName: string;
  status: string;
  hasReport: boolean;
  reportId: string | null;
  reportStatus: string | null;
}

export default function ReportsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const isAuditHead = useHasRole("AuditHead");
  const isAuditor = useHasRole("Auditor");
  const isAuditee = useHasRole("Auditee");
  const isAuditTeam = isAuditHead || isAuditor;
  const isAuditeeOnly = isAuditee && !isAuditTeam;

  // Engagements list state
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<CompletedEngagement[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Generate Report Dialog
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedEngagement, setSelectedEngagement] = useState<CompletedEngagement | null>(null);
  const [opinionRating, setOpinionRating] = useState<string>("Satisfactory");
  const [generating, setGenerating] = useState(false);

  const { data: translatedEngagements } = useTranslatedData(engagements, { modelName: 'AuditEngagement' });

  useEffect(() => {
    fetchCompletedEngagements();
  }, []);

  const fetchCompletedEngagements = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("limit", "999");
      const response = await fetch(`/api/internal-audit/report/completed-engagements?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEngagements(data.engagements || []);
      }
    } catch (error) {
      console.error("Failed to fetch completed engagements:", error);
      toast.error(t("Failed to fetch completed engagements"));
    } finally {
      setLoading(false);
    }
  };

  const openReport = (engagementId: string) => {
    router.push(`/internal-audit/report/${engagementId}`);
  };

  const handleRowClick = (engagement: CompletedEngagement) => {
    if (engagement.hasReport) {
      openReport(engagement.id);
    } else if (!isAuditeeOnly) {
      setSelectedEngagement(engagement);
      setOpinionRating("Satisfactory");
      setGenerateDialogOpen(true);
    }
  };

  const handleConfirmGenerate = async () => {
    if (!selectedEngagement) return;
    setGenerating(true);
    try {
      const response = await fetch(`/api/internal-audit/report/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId: selectedEngagement.id,
          opinionRating,
        }),
      });
      if (response.ok) {
        toast.success(t("Report generated successfully"));
        setGenerateDialogOpen(false);
        await fetchCompletedEngagements();
        openReport(selectedEngagement.id);
      } else {
        const error = await response.json();
        toast.error(error.error || t("Failed to generate report"));
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error(t("Failed to generate report"));
    } finally {
      setGenerating(false);
    }
  };

  // Client-side filtering and pagination
  const filteredEngagements = translatedEngagements.filter((e) => {
    const matchesSearch =
      e.engagementTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.departmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.auditType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.assignedAuditorName.toLowerCase().includes(searchTerm.toLowerCase());
    const isFinal = e.hasReport && e.reportStatus === "Final";
    const isDraft = e.hasReport && e.reportStatus !== "Final";
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "draft" && isDraft) ||
      (statusFilter === "final" && isFinal);
    return matchesSearch && matchesStatus;
  });
  const totalItems = filteredEngagements.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedEngagements = filteredEngagements.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const filterTabs = [
    { id: "all", label: "All", count: translatedEngagements.length },
    { id: "draft", label: "Draft", count: translatedEngagements.filter((e) => e.hasReport && e.reportStatus !== "Final").length },
    { id: "final", label: "Final", count: translatedEngagements.filter((e) => e.hasReport && e.reportStatus === "Final").length },
  ];

  const Breadcrumb = () => (
    <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Home className="h-4 w-4" />
        <span>{t("Internal Audit")}</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
      {canViewDashboard && (
        <>
          <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Dashboard")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        </>
      )}
      <span className="text-primary-700 font-medium">{t("Reports")}</span>
    </nav>
  );

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Breadcrumb />
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Reports")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading reports...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Breadcrumb />
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Reports")}</h1>

      {/* Engagements Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-1 overflow-x-auto">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t(tab.label)} <span className="ml-1 text-[10px] opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="absolute ltr:left-2.5 rtl:right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search engagements...")}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full ltr:pl-8 rtl:pr-8 ltr:pr-3 rtl:pl-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="divide-y divide-slate-100">
          {paginatedEngagements.length > 0 ? (
            paginatedEngagements.map((engagement) => {
              const isClickable = isAuditeeOnly ? engagement.hasReport : true;
              return (
                <button
                  key={engagement.id}
                  onClick={() => handleRowClick(engagement)}
                  disabled={!isClickable}
                  className={`group w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${
                    isClickable ? "hover:bg-slate-50/60 cursor-pointer" : "cursor-default opacity-70"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-slate-800">{engagement.engagementTitle}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {engagement.departmentName} &middot; {engagement.auditType} &middot; {engagement.assignedAuditorName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      !engagement.hasReport
                        ? "bg-amber-50 text-amber-700"
                        : engagement.reportStatus === "Final"
                          ? "bg-green-50 text-green-700"
                          : "bg-blue-50 text-blue-700"
                    }`}>
                      {!engagement.hasReport
                        ? t("Pending")
                        : engagement.reportStatus === "Final"
                          ? t("Final")
                          : t("Draft")}
                    </span>
                    {isClickable && (
                      <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500 ltr:rotate-0 rtl:rotate-180" />
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
                <FileText className="h-6 w-6 text-primary-600" />
              </div>
              <p className="text-sm font-medium text-slate-800">{t("No engagements found")}</p>
              <p className="text-xs text-slate-500 mt-1">{t("Try adjusting your search or filter")}</p>
            </div>
          )}
        </div>

        <PaginationUI
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Generate Report Dialog — Opinion rating */}
      {isAuditTeam && (
        <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[600px] p-0 gap-0">
            <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Generate Audit Report")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Select the overall audit opinion for")} &quot;{selectedEngagement?.engagementTitle}&quot;
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-4 sm:px-6 py-6">
              <Label className="text-sm font-medium text-slate-700 mb-2 block">{t("Overall Audit Opinion")}</Label>
              <Select value={opinionRating} onValueChange={setOpinionRating}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder={t("Select rating")} />
                </SelectTrigger>
                <SelectContent>
                  {OPINION_RATINGS.map((r) => (
                    <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-2">{t("You can refine the opinion and all report sections after generating.")}</p>
            </div>

            <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button className="bg-primary-600 hover:bg-primary-700" onClick={handleConfirmGenerate} disabled={generating}>
                {generating ? (<><Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />{t("Generating...")}</>) : t("Generate Report")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

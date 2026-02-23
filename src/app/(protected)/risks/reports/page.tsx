"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, ChevronRight, Home, FileBarChart, Search ,Upload } from "lucide-react";
import { Pagination as PaginationUI } from "@/components/ui/pagination";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";

// Risk Report Types matching UAT exactly
const reportTypes = [
  { id: "risk-by-category", title: "Risk By Category", description: "Risks grouped by their assigned category", columns: ["Risk Category", "Risk name"] },
  { id: "risk-by-strategy", title: "Risk By Strategy", description: "Risks grouped by response strategy", columns: ["Strategy", "Risk name"] },
  { id: "risk-by-rating", title: "Risk By Rating", description: "Risks grouped by risk rating level", columns: ["Rating", "Risk name"] },
  { id: "risk-by-status", title: "Risk By Status", description: "Risks grouped by current status", columns: ["Status", "Risk name"] },
  { id: "risk-by-type", title: "Risk By Type", description: "Risks grouped by risk type classification", columns: ["Type", "Risk name"] },
  { id: "risk-by-owner", title: "Risk By Owner", description: "Risks grouped by assigned risk owner", columns: ["Owner", "Risk name"] },
];

// Management Report Options matching UAT exactly
const managementReportOptions = [
  { id: "average-residual-risk", label: "Average Residual Risk", checked: true },
  { id: "average-inherent-risk", label: "Average Inherent Risk", checked: true },
  { id: "top-5-risk-severity", label: "Top 5 Risk with Severity", checked: true },
  { id: "top-5-assets", label: "Top 5 Assets", checked: true },
  { id: "top-5-departments", label: "Top 5 Departments", checked: true },
  { id: "top-5-threats", label: "Top 5 Threats", checked: true },
  { id: "active-risks-by-rating", label: "Active Risks by Rating", checked: true },
  { id: "top-5-risk-owners", label: "Top 5 Risk Owners", checked: true },
  { id: "risk-activity-trend", label: "Risk Activity Trend", checked: true },
  { id: "risk-activity-timeline", label: "Risk Activity based on Timeline", checked: true },
];

interface ReportData {
  [key: string]: string | number | null | undefined;
}

interface RawRisk {
  id: string;
  name: string;
  category?: { id: string; name: string };
  responseStrategy?: string;
  riskRating?: string;
  status?: string;
  type?: { id?: string; name: string };
  owner?: { id: string; fullName: string };
}

export default function RiskReportsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [selectedReport, setSelectedReport] = useState<typeof reportTypes[0] | null>(null);
  const [rawRisks, setRawRisks] = useState<RawRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isManagementDialogOpen, setIsManagementDialogOpen] = useState(false);
  const [managementOptions, setManagementOptions] = useState(
    managementReportOptions.map(opt => ({ ...opt }))
  );
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [yearError, setYearError] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");

  // Translation hooks for dynamic data
  const riskItems = useMemo(() =>
    rawRisks.map(r => ({ id: r.id, name: r.name })),
    [rawRisks]
  );
  const { data: translatedRiskItems } = useTranslatedData(riskItems, { modelName: 'Risk' });

  const uniqueCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    rawRisks.forEach(r => {
      if (r.category?.id) map.set(r.category.id, { id: r.category.id, name: r.category.name });
    });
    return Array.from(map.values());
  }, [rawRisks]);
  const { data: translatedCategories } = useTranslatedData(uniqueCategories, { modelName: 'RiskCategory' });

  const uniqueOwners = useMemo(() => {
    const map = new Map<string, { id: string; fullName: string }>();
    rawRisks.forEach(r => {
      if (r.owner?.id) map.set(r.owner.id, { id: r.owner.id, fullName: r.owner.fullName });
    });
    return Array.from(map.values());
  }, [rawRisks]);
  const { data: translatedOwners } = useTranslatedData(uniqueOwners, { modelName: 'User' });

  // Build translated report data
  const reportData: ReportData[] = useMemo(() => {
    if (!selectedReport || rawRisks.length === 0) return [];

    const getRiskName = (risk: RawRisk) =>
      translatedRiskItems.find(r => r.id === risk.id)?.name || risk.name;
    const getCategoryName = (risk: RawRisk) =>
      translatedCategories.find(c => c.id === risk.category?.id)?.name || risk.category?.name || "";
    const getOwnerName = (risk: RawRisk) =>
      translatedOwners.find(o => o.id === risk.owner?.id)?.fullName || risk.owner?.fullName || "";

    switch (selectedReport.id) {
      case "risk-by-category":
        return rawRisks.map(risk => ({ "Risk Category": getCategoryName(risk), "Risk name": getRiskName(risk) }));
      case "risk-by-strategy":
        return rawRisks.map(risk => ({ Strategy: risk.responseStrategy ? t(risk.responseStrategy) : "", "Risk name": getRiskName(risk) }));
      case "risk-by-rating":
        return rawRisks.map(risk => ({ Rating: risk.riskRating ? t(risk.riskRating) : "", "Risk name": getRiskName(risk) }));
      case "risk-by-status":
        return rawRisks.map(risk => ({ Status: risk.status ? t(risk.status) : "", "Risk name": getRiskName(risk) }));
      case "risk-by-type":
        return rawRisks.map(risk => ({ Type: risk.type?.name || "", "Risk name": getRiskName(risk) }));
      case "risk-by-owner":
        return rawRisks.map(risk => ({ Owner: getOwnerName(risk), "Risk name": getRiskName(risk) }));
      default:
        return [];
    }
  }, [rawRisks, selectedReport, translatedRiskItems, translatedCategories, translatedOwners, t]);

  const totalItems = reportData.length;

  const fetchRisks = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/risks");
      if (response.ok) {
        const result = await response.json();
        setRawRisks(result.data || result || []);
      }
    } catch (error) {
      console.error("Failed to fetch report data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReportClick = (report: typeof reportTypes[0]) => {
    setSelectedReport(report);
    setIsReportDialogOpen(true);
    setCurrentPage(1);
    if (rawRisks.length === 0) {
      fetchRisks();
    }
  };

  const handleExport = () => {
    if (!selectedReport || reportData.length === 0) return;

    // Get paginated data for export (only current view)
    const paginatedData = reportData.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

    const headers = selectedReport.columns;
    const csvRows = [headers.join(",")];

    paginatedData.forEach((row) => {
      const values = headers.map((col) => {
        const value = row[col] || "";
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedReport.title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleShowManagementReport = () => {
    // Validate year is always required
    if (!filterYear || filterYear.trim() === "") {
      setYearError(t("Year is required"));
      return;
    }

    // Clear any previous errors
    setYearError("");

    const selectedOptions = managementOptions.filter(opt => opt.checked).map(opt => opt.id);
    const queryString = selectedOptions.join(",");
    router.push(`/risks/reports/management?options=${queryString}&year=${filterYear}`);
  };

  const toggleManagementOption = (id: string) => {
    setManagementOptions(prev =>
      prev.map(opt => opt.id === id ? { ...opt, checked: !opt.checked } : opt)
    );
  };

  // Pagination
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedData = reportData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Risk Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Reports")}</span>
      </nav>

      {/* Page Header */}
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Reports")}</h1>

      {/* Management Report - Featured Card */}
      <button
        onClick={() => setIsManagementDialogOpen(true)}
        className="group w-full bg-primary-50/60 rounded-xl border border-primary-200/60 p-5 flex items-center gap-4 ltr:text-left rtl:text-right transition-all hover:bg-primary-50 hover:border-primary-300 hover:shadow-sm cursor-pointer"
      >
        <div className="p-2.5 bg-primary-100/80 rounded-lg flex-shrink-0">
          <FileBarChart className="h-5 w-5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-primary-900">{t("Management Report")}</h3>
          <p className="text-xs text-primary-600/70 mt-0.5">{t("Generate a comprehensive risk report with charts across categories, ratings, and owners")}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-primary-300 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500 ltr:rotate-0 rtl:rotate-180" />
      </button>

      {/* Reports Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar: Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Risk Reports")}</span>
          <div className="relative w-full sm:w-56">
            <Search className="absolute ltr:left-2.5 rtl:right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search reports...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ltr:pl-8 rtl:pr-8 ltr:pr-3 rtl:pl-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
        </div>

        {/* Report List */}
        <div className="divide-y divide-slate-100">
          {reportTypes
            .filter((r) => searchQuery === "" || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.description.toLowerCase().includes(searchQuery.toLowerCase()))
            .length > 0 ? (
            reportTypes
              .filter((r) => searchQuery === "" || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.description.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((report) => (
                <button
                  key={report.id}
                  onClick={() => handleReportClick(report)}
                  className="group w-full flex items-center justify-between px-5 py-3.5 ltr:text-left rtl:text-right hover:bg-slate-50/60 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-slate-800">{t(report.title)}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{t(report.description)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500 ltr:rotate-0 rtl:rotate-180" />
                </button>
              ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                <FileBarChart className="h-6 w-6 text-primary-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t("No reports found")}</p>
              <p className="text-xs text-slate-400">{t("Try adjusting your search")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Report Detail Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{selectedReport ? t(selectedReport.title) : ""}</DialogTitle>
          </DialogHeader>

          {/* Export Button */}
          <div className="flex-shrink-0 flex justify-end px-4 sm:px-6 py-3 border-b border-slate-100">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Export")}
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="relative h-8 w-8">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                  </div>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="h-12 bg-slate-50">
                      {selectedReport?.columns.map((col) => (
                        <th key={col} className="ltr:text-left rtl:text-right px-4 text-sm font-medium text-slate-700">
                          {t(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={selectedReport?.columns.length || 1} className="text-center py-8 text-slate-500">
                          {t("No data found")}
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((row, idx) => (
                        <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                          {selectedReport?.columns.map((col) => (
                            <td key={col} className="px-4 py-3 text-sm text-slate-600">
                              {String(row[col] || "")}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Pagination */}
          <PaginationUI
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={pageSize}
            onPageChange={setCurrentPage}
          />
        </DialogContent>
      </Dialog>

      {/* Management Report Parameters Dialog */}
      <Dialog open={isManagementDialogOpen} onOpenChange={setIsManagementDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Risk Report Parameters")}</DialogTitle>
          </DialogHeader>

          <div className="px-4 sm:px-6 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {managementOptions.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <Checkbox
                    id={option.id}
                    checked={option.checked}
                    onCheckedChange={() => toggleManagementOption(option.id)}
                  />
                  <label
                    htmlFor={option.id}
                    className="text-sm font-medium text-slate-700 leading-none cursor-pointer"
                  >
                    {t(option.label)}
                  </label>
                  {/* Year filter for timeline option */}
                  {option.id === "risk-activity-timeline" && option.checked && (
                    <div className="ltr:ml-2 rtl:mr-2">
                      <Input
                        type="text"
                        value={filterYear}
                        onChange={(e) => {
                          setFilterYear(e.target.value);
                          setYearError(""); // Clear error when user types
                        }}
                        className="w-20 h-7 text-sm bg-white"
                        placeholder={t("Year")}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Error message */}
            {yearError && (
              <p className="mt-3 text-sm text-red-600">{yearError}</p>
            )}
          </div>

          <div className="flex flex-row items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setIsManagementDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleShowManagementReport}>
              {t("Show Report")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

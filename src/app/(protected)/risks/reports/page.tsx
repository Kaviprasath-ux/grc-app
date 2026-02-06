"use client";

import { useState, useEffect } from "react";
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
import { Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Home } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

// Risk Report Types matching UAT exactly
const reportTypes = [
  { id: "risk-by-category", title: "Risk By Category", columns: ["Risk Category", "Risk name"] },
  { id: "risk-by-strategy", title: "Risk By Strategy", columns: ["Strategy", "Risk name"] },
  { id: "risk-by-rating", title: "Risk By Rating", columns: ["Rating", "Risk name"] },
  { id: "risk-by-status", title: "Risk By Status", columns: ["Status", "Risk name"] },
  { id: "risk-by-type", title: "Risk By Type", columns: ["Type", "Risk name"] },
  { id: "risk-by-owner", title: "Risk By Owner", columns: ["Owner", "Risk name"] },
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

export default function RiskReportsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [selectedReport, setSelectedReport] = useState<typeof reportTypes[0] | null>(null);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isManagementDialogOpen, setIsManagementDialogOpen] = useState(false);
  const [managementOptions, setManagementOptions] = useState(
    managementReportOptions.map(opt => ({ ...opt }))
  );
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  const fetchReportData = async (reportId: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/risks");
      if (!response.ok) {
        setReportData([]);
        return;
      }

      const result = await response.json();
      const risks = result.data || result || [];
      let data: ReportData[] = [];

      switch (reportId) {
        case "risk-by-category":
          data = risks.map((risk: { category?: { name: string }; name: string }) => ({
            "Risk Category": risk.category?.name || "",
            "Risk name": risk.name,
          }));
          break;

        case "risk-by-strategy":
          data = risks.map((risk: { responseStrategy?: string; name: string }) => ({
            Strategy: risk.responseStrategy || "",
            "Risk name": risk.name,
          }));
          break;

        case "risk-by-rating":
          data = risks.map((risk: { riskRating?: string; name: string }) => ({
            Rating: risk.riskRating || "",
            "Risk name": risk.name,
          }));
          break;

        case "risk-by-status":
          data = risks.map((risk: { status?: string; name: string }) => ({
            Status: risk.status || "",
            "Risk name": risk.name,
          }));
          break;

        case "risk-by-type":
          data = risks.map((risk: { type?: { name: string }; name: string }) => ({
            Type: risk.type?.name || "",
            "Risk name": risk.name,
          }));
          break;

        case "risk-by-owner":
          data = risks.map((risk: { owner?: { fullName: string }; name: string }) => ({
            Owner: risk.owner?.fullName || "",
            "Risk name": risk.name,
          }));
          break;
      }

      setTotalItems(data.length);
      setReportData(data);
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to fetch report data:", error);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReportClick = (report: typeof reportTypes[0]) => {
    setSelectedReport(report);
    setIsReportDialogOpen(true);
    fetchReportData(report.id);
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
  const startItem = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalItems);

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
        <span className="text-primary-700 font-medium">{t("Reports")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Reports")}</h1>
        <Button onClick={() => setIsManagementDialogOpen(true)}>
          {t("Get Management Report")}
        </Button>
      </div>

      {/* Report List */}
      <div className="space-y-2">
        {reportTypes.map((report) => (
          <Button
            key={report.id}
            variant="outline"
            className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-slate-50 text-slate-700"
            onClick={() => handleReportClick(report)}
          >
            {t(report.title)}
          </Button>
        ))}
      </div>

      {/* Report Detail Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{selectedReport ? t(selectedReport.title) : ""}</DialogTitle>
          </DialogHeader>

          {/* Export Button */}
          <div className="flex-shrink-0 flex justify-end px-6 py-3 border-b border-slate-100">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              {t("Export")}
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto px-6 py-4">
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
                        <th key={col} className="text-left px-4 text-sm font-medium text-slate-700">
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
          {totalItems > 0 && (
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-sm text-slate-500">
                {startItem} {t("to")} {endItem} {t("of")} {totalItems}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Management Report Parameters Dialog */}
      <Dialog open={isManagementDialogOpen} onOpenChange={setIsManagementDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Risk Report Parameters")}</DialogTitle>
          </DialogHeader>

          <div className="px-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              {managementOptions.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
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
                    <div className="ml-2">
                      <Input
                        type="text"
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="w-20 h-7 text-sm bg-white"
                        placeholder={t("Year")}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
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

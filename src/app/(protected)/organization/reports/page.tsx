"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Home, FileBarChart, Search,Upload } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

// Organization Report Types matching UAT exactly
const reportTypes = [
  { id: "issue-by-department", title: "Issue by Department", columns: ["DepartmentName", "Name"], category: "issues", description: "Issues distributed across departments" },
  { id: "issue-by-category", title: "Issue Count by Category", columns: ["Category Name", "Count"], category: "issues", description: "Breakdown of issues by category" },
  { id: "issue-by-stakeholder", title: "Issue Count By StakeHolders", columns: ["Stakeholder", "Count"], category: "issues", description: "Issues grouped by stakeholders" },
  { id: "users-by-department", title: "Users By Department", columns: ["Department Name", "User"], category: "users", description: "User distribution across departments" },
  { id: "users-by-roles", title: "Users By Roles", columns: ["Role", "User"], category: "users", description: "User count by assigned roles" },
  { id: "process-by-department", title: "Process By Department", columns: ["Department Name", "Process"], category: "processes", description: "Processes allocated across departments" },
  { id: "process-by-owners", title: "Process By Owners", columns: ["Owner", "Process"], category: "processes", description: "Processes grouped by owners" },
];
const categoryTabs = [
  { id: "all", label: "All" },
  { id: "issues", label: "Issues" },
  { id: "users", label: "Users" },
  { id: "processes", label: "Processes" },
];

// Management Report Options matching UAT exactly
const managementReportOptions = [
  { id: "process-by-department", label: "Process By Department", checked: true },
  { id: "process-by-criticality", label: "Process by Criticality", checked: true },
  { id: "kpi-by-measurement", label: "KPI by Measurement", checked: true },
  { id: "kpi-by-performance", label: "KPI by Performance", checked: true },
  { id: "top-5-process-risk", label: "Top 5 Process Risk", checked: true },
  { id: "process-by-risk", label: "Process by Risk", checked: true },
];

interface ReportData {
  [key: string]: string | number | null | undefined;
}

export default function OrganizationReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { t, isRTL } = useLanguage();

  // True when rendered under /internal-audit/organization/reports or
  // /tprm/organization/reports — both route files re-export this component.
  // In trimmed scope we hide:
  //   - The "Management Report" featured card (GRC-specific charts)
  //   - The "Processes" category tab + any process-by-* reports
  // Only Issue and User reports remain (5 cards total).
  const isTrimmedOrgScope =
    pathname?.startsWith("/internal-audit/") ||
    pathname?.startsWith("/tprm/") ||
    false;
  const [selectedReport, setSelectedReport] = useState<typeof reportTypes[0] | null>(null);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isManagementDialogOpen, setIsManagementDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [managementOptions, setManagementOptions] = useState(
    managementReportOptions.map(opt => ({ ...opt }))
  );

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  const fetchReportData = async (reportId: string) => {
    setLoading(true);
    try {
      let data: ReportData[] = [];

      switch (reportId) {
        case "issue-by-department":
          const issuesRes = await fetch("/api/issues");
          if (issuesRes.ok) {
            const issues = await issuesRes.json();
            data = (issues.data || issues).map((issue: { department?: { name: string }; title: string }) => ({
              DepartmentName: issue.department?.name || "",
              Name: issue.title,
            }));
          }
          break;

        case "issue-by-category":
          const issuesCatRes = await fetch("/api/issues");
          if (issuesCatRes.ok) {
            const issues = await issuesCatRes.json();
            const issuesList = issues.data || issues;
            // Aggregate by category and count
            const categoryCount: Record<string, number> = {};
            issuesList.forEach((issue: { category?: string }) => {
              const category = issue.category || "Uncategorized";
              categoryCount[category] = (categoryCount[category] || 0) + 1;
            });
            data = Object.entries(categoryCount).map(([category, count]) => ({
              "Category Name": category,
              Count: count,
            }));
          }
          break;

        case "issue-by-stakeholder":
          const issuesStakeRes = await fetch("/api/issues");
          if (issuesStakeRes.ok) {
            const issues = await issuesStakeRes.json();
            const issuesList = issues.data || issues;
            // Aggregate by stakeholder and count
            const stakeholderCount: Record<string, number> = {};
            issuesList.forEach((issue: { stakeholder?: { name: string } }) => {
              const stakeholder = issue.stakeholder?.name || "Unassigned";
              stakeholderCount[stakeholder] = (stakeholderCount[stakeholder] || 0) + 1;
            });
            data = Object.entries(stakeholderCount).map(([stakeholder, count]) => ({
              Stakeholder: stakeholder,
              Count: count,
            }));
          }
          break;

        case "users-by-department":
          const usersRes = await fetch("/api/users");
          if (usersRes.ok) {
            const users = await usersRes.json();
            data = (users.data || users).map((user: { department?: { name: string }; fullName: string }) => ({
              "Department Name": user.department?.name || "",
              User: user.fullName,
            }));
          }
          break;

        case "users-by-roles":
          const usersRolesRes = await fetch("/api/users?moduleCode=GRC");
          if (usersRolesRes.ok) {
            const users = await usersRolesRes.json();
            data = (users.data || users).map((user: { userRoles?: { role: { name: string } }[]; fullName: string }) => ({
              Role: user.userRoles?.[0]?.role?.name || "",
              User: user.fullName,
            }));
          }
          break;

        case "process-by-department":
          const processRes = await fetch("/api/processes");
          if (processRes.ok) {
            const processes = await processRes.json();
            data = (processes.data || processes).map((process: { department?: { name: string }; name: string }) => ({
              "Department Name": process.department?.name || "",
              Process: process.name,
            }));
          }
          break;

        case "process-by-owners":
          const processOwnersRes = await fetch("/api/processes");
          if (processOwnersRes.ok) {
            const processes = await processOwnersRes.json();
            data = (processes.data || processes).map((process: { owner?: { fullName: string }; name: string }) => ({
              Owner: process.owner?.fullName || "",
              Process: process.name,
            }));
          }
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
    router.push(`/organization/reports/management?options=${queryString}`);
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
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // In IA scope, drop the entire "processes" category — IA's Organization
  // Reports only show Issue + User reports.
  const visibleReportTypes = isTrimmedOrgScope
    ? reportTypes.filter((r) => r.category !== "processes")
    : reportTypes;
  const visibleCategoryTabs = isTrimmedOrgScope
    ? categoryTabs.filter((c) => c.id !== "processes")
    : categoryTabs;

  // Filter reports by category and search
  const filteredReports = visibleReportTypes.filter((report) => {
    const matchesCategory = activeCategory === "all" || report.category === activeCategory;
    const matchesSearch = searchQuery === "" ||
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // If the activeCategory is "processes" but we're in IA scope, snap back to "all"
  useEffect(() => {
    if (isTrimmedOrgScope && activeCategory === "processes") {
      setActiveCategory("all");
    }
  }, [isTrimmedOrgScope, activeCategory]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className={`flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
        <div className={`flex items-center gap-1.5 text-slate-500 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Dashboard")}
        </Link>
        <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
        <span className="text-primary-700 font-medium">{t("Reports")}</span>
      </nav>

      {/* Page Header */}
      <div style={isRTL ? { direction: 'rtl' } : undefined}>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Reports")}</h1>
      </div>

      {/* Management Report - Featured Card. Hidden in IA scope (GRC-only). */}
      {!isTrimmedOrgScope && (
      <button
        onClick={() => setIsManagementDialogOpen(true)}
        className="group w-full bg-primary-50/60 rounded-xl border border-primary-200/60 p-3 sm:p-5 flex items-center gap-3 sm:gap-4 text-start transition-all hover:bg-primary-50 hover:border-primary-300 hover:shadow-sm cursor-pointer"
        style={isRTL ? { direction: 'rtl' } : undefined}
      >
        <div className="p-2.5 bg-primary-100/80 rounded-lg flex-shrink-0">
          <FileBarChart className="h-5 w-5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-primary-900">{t("Management Report")}</h3>
          <p className="text-xs text-primary-600/70 mt-0.5">{t("Generate a comprehensive report with charts across processes, KPIs, and risks")}</p>
        </div>
        <ChevronRight className={`h-4 w-4 text-primary-300 flex-shrink-0 transition-transform group-hover:text-primary-500 ${isRTL ? "rotate-180 group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"}`} />
      </button>
      )}

      {/* Reports Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined}>
        {/* Toolbar: Tabs + Search */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 sm:px-5 py-3 border-b border-slate-100 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
          {/* Category Tabs */}
          <div className={`flex items-center gap-1 overflow-x-auto ${isRTL ? "flex-row-reverse" : ""}`}>
            {visibleCategoryTabs.map((tab) => {
              const count = tab.id === "all"
                ? visibleReportTypes.length
                : visibleReportTypes.filter((r) => r.category === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeCategory === tab.id
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t(tab.label)} <span className="ms-1 text-[10px] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search reports...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ps-8 pe-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
        </div>

        {/* Report List */}
        <div className="divide-y divide-slate-100">
          {filteredReports.length > 0 ? (
            filteredReports.map((report) => (
              <button
                key={report.id}
                onClick={() => handleReportClick(report)}
                className="group w-full flex items-center justify-between px-3 sm:px-5 py-3.5 text-start hover:bg-slate-50/60 transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-800">{t(report.title)}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{t(report.description)}</p>
                </div>
                <ChevronRight className={`h-4 w-4 text-slate-300 flex-shrink-0 transition-transform group-hover:text-primary-500 ${isRTL ? "rotate-180 group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"}`} />
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileBarChart className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">{t("No reports found")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Report Detail Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pe-8">
                <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{selectedReport ? t(selectedReport.title) : ""}</DialogTitle>
                <Button variant="outline" size="sm" onClick={handleExport} className="self-start sm:self-auto">
                  <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Export")}
                </Button>
              </div>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto px-3 sm:px-6 py-4 sm:py-6">
            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {selectedReport?.columns.map((col, idx, arr) => (
                        <th key={col} className={`text-start py-3 text-xs font-medium text-slate-500 uppercase tracking-wider ${idx === 0 ? "ps-5" : ""} ${idx === arr.length - 1 ? "pe-5" : ""}`}>
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
                        <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          {selectedReport?.columns.map((col, colIdx, arr) => (
                            <td key={col} className={`py-3 text-sm text-slate-700 text-start ${colIdx === 0 ? "ps-5" : ""} ${colIdx === arr.length - 1 ? "pe-5" : ""}`}>
                              {String(row[col] || "")}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer with Pagination */}
          {totalItems > 0 && (
            <div className={`flex-shrink-0 flex flex-row items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg ${isRTL ? "flex-row-reverse" : ""}`}>
              <span className="text-xs text-slate-500">
                {startItem} {t("to")} {endItem} {t("of")} {totalItems}
              </span>
              <div className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
                </Button>
                <span className="text-sm text-slate-600 px-2">
                  {t("Page")} {currentPage} {t("of")} {totalPages || 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Management Report Parameters Dialog */}
      <Dialog open={isManagementDialogOpen} onOpenChange={setIsManagementDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" style={isRTL ? { direction: 'rtl' } : undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-800">{t("Process Report Parameters")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {managementOptions.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <Checkbox
                    id={option.id}
                    checked={option.checked}
                    onCheckedChange={() => toggleManagementOption(option.id)}
                  />
                  <label
                    htmlFor={option.id}
                    className="text-sm font-medium text-slate-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {t(option.label)}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className={`flex flex-row items-center justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg ${isRTL ? "flex-row-reverse" : ""}`}>
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

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
  { id: "process-by-department", label: "Process by Department", checked: true },
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
  const { t } = useLanguage();
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
          const usersRolesRes = await fetch("/api/users");
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

  // Filter reports by category and search
  const filteredReports = reportTypes.filter((report) => {
    const matchesCategory = activeCategory === "all" || report.category === activeCategory;
    const matchesSearch = searchQuery === "" ||
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Reports")}</span>
      </nav>

      {/* Page Header */}
      <h1 className="text-2xl font-bold text-slate-800">{t("Reports")}</h1>

      {/* Management Report - Featured Card */}
      <button
        onClick={() => setIsManagementDialogOpen(true)}
        className="group w-full bg-primary-50/60 rounded-xl border border-primary-200/60 p-5 flex items-center gap-4 text-left transition-all hover:bg-primary-50 hover:border-primary-300 hover:shadow-sm cursor-pointer"
      >
        <div className="p-2.5 bg-primary-100/80 rounded-lg flex-shrink-0">
          <FileBarChart className="h-5 w-5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-primary-900">{t("Management Report")}</h3>
          <p className="text-xs text-primary-600/70 mt-0.5">{t("Generate a comprehensive report with charts across processes, KPIs, and risks")}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-primary-300 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500" />
      </button>

      {/* Reports Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar: Tabs + Search */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-100">
          {/* Category Tabs */}
          <div className="flex items-center gap-1">
            {categoryTabs.map((tab) => {
              const count = tab.id === "all"
                ? reportTypes.length
                : reportTypes.filter((r) => r.category === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    activeCategory === tab.id
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t(tab.label)} <span className="ml-1 text-[10px] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search reports...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
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
                className="group w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50/60 transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-800">{t(report.title)}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{t(report.description)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500" />
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
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="text-lg font-semibold text-slate-800">{selectedReport ? t(selectedReport.title) : ""}</DialogTitle>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Export")}
                </Button>
              </div>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto px-6 py-6">
            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {selectedReport?.columns.map((col, idx, arr) => (
                        <th key={col} className={`text-left py-3 text-xs font-medium text-slate-500 uppercase tracking-wider ${idx === 0 ? "pl-5" : ""} ${idx === arr.length - 1 ? "pr-5" : ""}`}>
                          {col}
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
                            <td key={col} className={`py-3 text-sm text-slate-700 ${colIdx === 0 ? "pl-5" : ""} ${colIdx === arr.length - 1 ? "pr-5" : ""}`}>
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

          {/* Fixed Footer with Pagination */}
          {totalItems > 0 && (
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <span className="text-xs text-slate-500">
                {startItem} {t("to")} {endItem} {t("of")} {totalItems}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
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
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
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
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Process Report Parameters")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
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
                    className="text-sm font-medium text-slate-700 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {t(option.label)}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
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

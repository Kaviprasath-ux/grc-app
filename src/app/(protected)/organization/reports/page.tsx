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
import { Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

// Organization Report Types matching UAT exactly
const reportTypes = [
  { id: "issue-by-department", title: "Issue by Department", columns: ["DepartmentName", "Name"] },
  { id: "issue-by-category", title: "Issue Count by Category", columns: ["Category Name", "Count"] },
  { id: "issue-by-stakeholder", title: "Issue Count By StakeHolders", columns: ["Stakeholder", "Count"] },
  { id: "users-by-department", title: "Users By Department", columns: ["Department Name", "User"] },
  { id: "users-by-roles", title: "Users By Roles", columns: ["Role", "User"] },
  { id: "process-by-department", title: "Process By Department", columns: ["Department Name", "Process"] },
  { id: "process-by-owners", title: "Process By Owners", columns: ["Owner", "Process"] },
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
  const [selectedReport, setSelectedReport] = useState<typeof reportTypes[0] | null>(null);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isManagementDialogOpen, setIsManagementDialogOpen] = useState(false);
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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Reports</h1>
        <Button onClick={() => setIsManagementDialogOpen(true)}>
          Get Management Report
        </Button>
      </div>

      {/* Report List */}
      <div className="space-y-2">
        {reportTypes.map((report) => (
          <Button
            key={report.id}
            variant="outline"
            className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-gray-50"
            onClick={() => handleReportClick(report)}
          >
            {report.title}
          </Button>
        ))}
      </div>

      {/* Report Detail Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title}</DialogTitle>
          </DialogHeader>

          {/* Export Button */}
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {selectedReport?.columns.map((col) => (
                      <th key={col} className="text-left p-3 text-sm font-medium border-b">
                        <button className="flex items-center gap-1 hover:text-primary">
                          {col}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={selectedReport?.columns.length || 1} className="text-center py-8 text-muted-foreground">
                        No data found
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        {selectedReport?.columns.map((col) => (
                          <td key={col} className="p-3 text-sm">
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

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">
                {startItem} to {endItem} of {totalItems}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Process Report Parameters</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {managementOptions.map((option) => (
              <div key={option.id} className="flex items-center space-x-2">
                <Checkbox
                  id={option.id}
                  checked={option.checked}
                  onCheckedChange={() => toggleManagementOption(option.id)}
                />
                <label
                  htmlFor={option.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleShowManagementReport}>
              Show Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

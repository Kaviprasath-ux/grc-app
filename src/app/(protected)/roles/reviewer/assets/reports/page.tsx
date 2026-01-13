"use client";

import { useState, useEffect } from "react";
import { X, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Asset {
  id: string;
  assetId: string;
  name: string;
  category: { id: string; name: string } | null;
  subCategory: { id: string; name: string } | null;
  group: { id: string; name: string } | null;
  location: string | null;
  sensitivity: { id: string; name: string } | null;
  ciaClassification: {
    id: string;
    confidentiality: { label: string } | null;
    integrity: { label: string } | null;
    availability: { label: string } | null;
    criticality: string | null;
  } | null;
}

type ReportType = "category" | "subcategory" | "group" | "location" | "criticality" | "sensitivity";

interface ReportConfig {
  id: ReportType;
  title: string;
  dialogTitle: string;
  column1Header: string;
  getColumn1Value: (asset: Asset) => string;
}

const reportConfigs: ReportConfig[] = [
  {
    id: "category",
    title: "Asset By Category",
    dialogTitle: "Report Asset BY Category",
    column1Header: "Category",
    getColumn1Value: (asset) => asset.category?.name || "",
  },
  {
    id: "subcategory",
    title: "Asset By Sub-Category",
    dialogTitle: "Report Asset BY SubCategory",
    column1Header: "Asset Sub Category",
    getColumn1Value: (asset) => asset.subCategory?.name || "",
  },
  {
    id: "group",
    title: "Asset By Group",
    dialogTitle: "Report Asset BY Group",
    column1Header: "Asset Group",
    getColumn1Value: (asset) => asset.group?.name || "",
  },
  {
    id: "location",
    title: "Asset By Location",
    dialogTitle: "Report Asset BY Location",
    column1Header: "Location",
    getColumn1Value: (asset) => asset.location || "",
  },
  {
    id: "criticality",
    title: "Asset By Criticality",
    dialogTitle: "Report Asset By Criticality",
    column1Header: "Asset Criticality",
    getColumn1Value: (asset) => asset.ciaClassification?.criticality || "",
  },
  {
    id: "sensitivity",
    title: "Asset By Sensitivity",
    dialogTitle: "Report Asset BY Sensitivity",
    column1Header: "Asset Sensitivity",
    getColumn1Value: (asset) => asset.sensitivity?.name || "",
  },
];

export default function AssetReportsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [sortColumn, setSortColumn] = useState<"col1" | "col2">("col1");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assets");
      if (res.ok) {
        setAssets(await res.json());
      }
    } catch (error) {
      console.error("Error fetching assets:", error);
    }
    setLoading(false);
  };

  const activeConfig = reportConfigs.find((r) => r.id === activeReport);

  // Get sorted and paginated data
  const getSortedData = () => {
    if (!activeConfig) return [];

    const sorted = [...assets].sort((a, b) => {
      let valA: string;
      let valB: string;

      if (sortColumn === "col1") {
        valA = activeConfig.getColumn1Value(a);
        valB = activeConfig.getColumn1Value(b);
      } else {
        valA = a.name;
        valB = b.name;
      }

      const comparison = valA.localeCompare(valB);
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  };

  const sortedData = getSortedData();
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedData = sortedData.slice(startIndex, endIndex);

  const handleSort = (column: "col1" | "col2") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleOpenReport = (reportType: ReportType) => {
    setActiveReport(reportType);
    setCurrentPage(1);
    setSortColumn("col1");
    setSortDirection("asc");
  };

  const handleCloseReport = () => {
    setActiveReport(null);
  };

  // Export to CSV
  const handleExport = () => {
    if (!activeConfig) return;

    const headers = [activeConfig.column1Header, "Asset Name"];
    const rows = sortedData.map((asset) => [
      activeConfig.getColumn1Value(asset),
      asset.name,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${activeConfig.id}_report_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" />

      {/* Report Containers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportConfigs.map((config) => (
          <button
            key={config.id}
            onClick={() => handleOpenReport(config.id)}
            className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left"
          >
            <span className="text-base font-medium text-gray-900">
              {config.title}
            </span>
          </button>
        ))}
      </div>

      {/* Report Dialog */}
      <Dialog open={activeReport !== null} onOpenChange={handleCloseReport}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
            <DialogTitle className="text-lg font-semibold">
              {activeConfig?.dialogTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Export Button */}
            <div className="py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>

            {/* Data Grid */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort("col1")}
                        className="flex items-center gap-2 text-sm font-medium hover:text-blue-600"
                      >
                        {activeConfig?.column1Header}
                        <span className="text-xs">
                          {sortColumn === "col1"
                            ? sortDirection === "asc"
                              ? "▲"
                              : "▼"
                            : ""}
                        </span>
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort("col2")}
                        className="flex items-center gap-2 text-sm font-medium hover:text-blue-600"
                      >
                        Asset Name
                        <span className="text-xs">
                          {sortColumn === "col2"
                            ? sortDirection === "asc"
                              ? "▲"
                              : "▼"
                            : ""}
                        </span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((asset, index) => (
                    <tr
                      key={asset.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-muted/20"}
                    >
                      <td className="px-4 py-3 text-sm">
                        {activeConfig?.getColumn1Value(asset) || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">{asset.name}</td>
                    </tr>
                  ))}
                  {paginatedData.length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalItems > 0 && (
              <div className="flex items-center justify-between py-3 border-t mt-2">
                <div className="text-sm text-muted-foreground">
                  Currently showing {startIndex + 1} to {endIndex} of {totalItems}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

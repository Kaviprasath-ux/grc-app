"use client";

import { useState, useEffect } from "react";
import { Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
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
  column1Header: string;
  getColumn1Value: (asset: Asset) => string;
}

const reportConfigs: ReportConfig[] = [
  {
    id: "category",
    title: "Asset By Category",
    column1Header: "Category",
    getColumn1Value: (asset) => asset.category?.name || "",
  },
  {
    id: "subcategory",
    title: "Asset By Sub-Category",
    column1Header: "Asset Sub Category",
    getColumn1Value: (asset) => asset.subCategory?.name || "",
  },
  {
    id: "group",
    title: "Asset By Group",
    column1Header: "Asset Group",
    getColumn1Value: (asset) => asset.group?.name || "",
  },
  {
    id: "location",
    title: "Asset By Location",
    column1Header: "Location",
    getColumn1Value: (asset) => asset.location || "",
  },
  {
    id: "criticality",
    title: "Asset By Criticality",
    column1Header: "Asset Criticality",
    getColumn1Value: (asset) => asset.ciaClassification?.criticality || "",
  },
  {
    id: "sensitivity",
    title: "Asset By Sensitivity",
    column1Header: "Asset Sensitivity",
    getColumn1Value: (asset) => asset.sensitivity?.name || "",
  },
];

export default function AssetReportsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

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

  // Get sorted data
  const sortedData = [...assets].sort((a, b) => {
    if (!activeConfig) return 0;
    const valA = activeConfig.getColumn1Value(a);
    const valB = activeConfig.getColumn1Value(b);
    return valA.localeCompare(valB);
  });

  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedData = sortedData.slice(startIndex, endIndex);
  const startItem = startIndex + 1;
  const endItem = endIndex;

  const handleOpenReport = (reportType: ReportType) => {
    setActiveReport(reportType);
    setCurrentPage(1);
    fetchAssets();
  };

  const handleCloseReport = () => {
    setActiveReport(null);
  };

  // Export to CSV
  const handleExport = () => {
    if (!activeConfig) return;

    const headers = [activeConfig.column1Header, "Asset Name"];
    const csvRows = [headers.join(",")];

    paginatedData.forEach((asset) => {
      const values = [
        activeConfig.getColumn1Value(asset),
        asset.name,
      ];
      csvRows.push(values.map((val) => `"${(val || "").replace(/"/g, '""')}"`).join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeConfig.title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Reports</h1>
      </div>

      {/* Report List */}
      <div className="space-y-2">
        {reportConfigs.map((config) => (
          <Button
            key={config.id}
            variant="outline"
            className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-gray-50"
            onClick={() => handleOpenReport(config.id)}
          >
            {config.title}
          </Button>
        ))}
      </div>

      {/* Report Detail Dialog */}
      <Dialog open={activeReport !== null} onOpenChange={handleCloseReport}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{activeConfig?.title}</DialogTitle>
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
                    <th className="text-left p-3 text-sm font-medium border-b">
                      <button className="flex items-center gap-1 hover:text-primary">
                        {activeConfig?.column1Header}
                      </button>
                    </th>
                    <th className="text-left p-3 text-sm font-medium border-b">
                      <button className="flex items-center gap-1 hover:text-primary">
                        Asset Name
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-center py-8 text-muted-foreground">
                        No data found
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((asset) => (
                      <tr key={asset.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">
                          {activeConfig?.getColumn1Value(asset) || "-"}
                        </td>
                        <td className="p-3 text-sm">{asset.name}</td>
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
    </div>
  );
}

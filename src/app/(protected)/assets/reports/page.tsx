"use client";

import { useState } from "react";
import { Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

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

export default function AssetReportsPage() {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const reportConfigs: ReportConfig[] = [
    {
      id: "category",
      title: t("Asset By Category"),
      column1Header: t("Category"),
      getColumn1Value: (asset) => asset.category?.name || "",
    },
    {
      id: "subcategory",
      title: t("Asset By Sub-Category"),
      column1Header: t("Asset Sub Category"),
      getColumn1Value: (asset) => asset.subCategory?.name || "",
    },
    {
      id: "group",
      title: t("Asset By Group"),
      column1Header: t("Asset Group"),
      getColumn1Value: (asset) => asset.group?.name || "",
    },
    {
      id: "location",
      title: t("Asset By Location"),
      column1Header: t("Location"),
      getColumn1Value: (asset) => asset.location || "",
    },
    {
      id: "criticality",
      title: t("Asset By Criticality"),
      column1Header: t("Asset Criticality"),
      getColumn1Value: (asset) => asset.ciaClassification?.criticality || "",
    },
    {
      id: "sensitivity",
      title: t("Asset By Sensitivity"),
      column1Header: t("Asset Sensitivity"),
      getColumn1Value: (asset) => asset.sensitivity?.name || "",
    },
  ];

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

    const headers = [activeConfig.column1Header, t("Asset Name")];
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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Asset Management")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Reports")}</span>
      </nav>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("Asset Reports")}</h1>
      </div>

      {/* Report List - Matching Organization Reports style */}
      <div className="space-y-2">
        {reportConfigs.map((config) => (
          <Button
            key={config.id}
            variant="outline"
            className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-slate-50 border-slate-200"
            onClick={() => handleOpenReport(config.id)}
          >
            {config.title}
          </Button>
        ))}
      </div>

      {/* Report Detail Dialog - Fixed width 700px */}
      <Dialog open={activeReport !== null} onOpenChange={handleCloseReport}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header - Export button with pr-8 to avoid overlap with X close button */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="text-lg font-semibold text-slate-800">{activeConfig?.title}</DialogTitle>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  {t("Export")}
                </Button>
              </div>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto px-6 py-6">
            {/* Table with proper container */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
                      <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">{t("Loading report...")}</p>
                  </div>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left pl-4 py-4 text-xs font-semibold text-slate-600">
                        {activeConfig?.column1Header}
                      </th>
                      <th className="text-left pr-4 py-4 text-xs font-semibold text-slate-600">
                        {t("Asset Name")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-center py-8 text-slate-500">
                          {t("No data found")}
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((asset) => (
                        <tr key={asset.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="pl-4 py-4 text-sm text-slate-700">
                            {activeConfig?.getColumn1Value(asset) || "-"}
                          </td>
                          <td className="pr-4 py-4 text-sm text-slate-700">{asset.name}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Fixed Footer - Pagination */}
          {totalItems > 0 && (
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
                <span className="text-sm text-slate-600 px-2">
                  {t("Page")} {currentPage} {t("of")} {totalPages || 1}
                </span>
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
    </div>
  );
}

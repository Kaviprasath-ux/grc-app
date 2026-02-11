"use client";

import { useState } from "react";
import { Download, ChevronRight, Home, FileBarChart, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination as PaginationUI } from "@/components/ui/pagination";
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
  description: string;
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
  const [searchQuery, setSearchQuery] = useState("");

  const reportConfigs: ReportConfig[] = [
    {
      id: "category",
      title: t("Asset By Category"),
      description: t("Assets grouped by their assigned category"),
      column1Header: t("Category"),
      getColumn1Value: (asset) => asset.category?.name || "",
    },
    {
      id: "subcategory",
      title: t("Asset By Sub-Category"),
      description: t("Assets grouped by sub-category classification"),
      column1Header: t("Asset Sub Category"),
      getColumn1Value: (asset) => asset.subCategory?.name || "",
    },
    {
      id: "group",
      title: t("Asset By Group"),
      description: t("Assets grouped by asset group"),
      column1Header: t("Asset Group"),
      getColumn1Value: (asset) => asset.group?.name || "",
    },
    {
      id: "location",
      title: t("Asset By Location"),
      description: t("Assets grouped by physical or logical location"),
      column1Header: t("Location"),
      getColumn1Value: (asset) => asset.location || "",
    },
    {
      id: "criticality",
      title: t("Asset By Criticality"),
      description: t("Assets grouped by criticality level"),
      column1Header: t("Asset Criticality"),
      getColumn1Value: (asset) => asset.ciaClassification?.criticality || "",
    },
    {
      id: "sensitivity",
      title: t("Asset By Sensitivity"),
      description: t("Assets grouped by sensitivity classification"),
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
        < div className="flex items-center gap-1.5 text-slate-500 ">
          <Home className="h-4 w-4" />
          <span>{t("Asset Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Reports")}</span>
      </nav>

      {/* Page Header */}
      <h1 className="text-2xl font-bold text-slate-800">{t("Asset Reports")}</h1>

      {/* Reports Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Toolbar: Search */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-100">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Asset Reports")}</span>
          <div className="relative w-56">
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
          {reportConfigs
            .filter((r) => searchQuery === "" || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.description.toLowerCase().includes(searchQuery.toLowerCase()))
            .length > 0 ? (
            reportConfigs
              .filter((r) => searchQuery === "" || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.description.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((config) => (
                <button
                  key={config.id}
                  onClick={() => handleOpenReport(config.id)}
                  className="group w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50/60 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-slate-800">{config.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500 ltr:rotate-0 rtl:rotate-180" />
                </button>
              ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
                <FileBarChart className="h-6 w-6 text-primary-600" />
              </div>
              <p className="text-sm font-medium text-slate-800">{t("No reports found")}</p>
              <p className="text-xs text-slate-500 mt-1">{t("Try adjusting your search")}</p>
            </div>
          )}
        </div>
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
    </div>
  );
}

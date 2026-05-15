"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useLanguage } from "@/contexts/LanguageContext";
import { ControlMappingPanel } from "@/components/technical-evidence/control-mapping-panel";
import {
  Home,
  ChevronRight,
  ChevronLeft,
  Database,
  RefreshCw,
  Loader2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface RecordData {
  id: string;
  data: Record<string, unknown>;
  collectedAt: string;
}

interface CollectionInfo {
  id: string;
  displayName: string;
  dataSource: string;
  platform: string;
  recordCount: number;
  lastCollectedAt: string | null;
}

export default function TechnicalEvidenceViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useLanguage();
  const { canView, canCreate, isLoading: permLoading } = usePermissions(
    "technical-evidence.dashboard"
  );
  const [records, setRecords] = useState<RecordData[]>([]);
  const [collection, setCollection] = useState<CollectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  useEffect(() => {
    async function fetchRecords() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/technical-evidence/${id}/records?page=${page}&limit=${limit}`
        );
        const json = await res.json();
        if (res.ok) {
          setRecords(json.data || []);
          setCollection(json.collection || null);
          setTotal(json.pagination?.total || 0);
          setTotalPages(json.pagination?.totalPages || 1);
        }
      } catch (err) {
        console.error("Error fetching records:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, [id, page]);

  const handleRecollect = async () => {
    setCollecting(true);
    try {
      const res = await fetch(`/api/technical-evidence/${id}/collect`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || t("Collection failed"));
        return;
      }
      toast.success(
        `${t("Collected")} ${json.data.recordCount} ${t("records")}`
      );
      setPage(1);
      // Refresh records
      const refreshRes = await fetch(
        `/api/technical-evidence/${id}/records?page=1&limit=${limit}`
      );
      const refreshJson = await refreshRes.json();
      if (refreshRes.ok) {
        setRecords(refreshJson.data || []);
        setCollection(refreshJson.collection || null);
        setTotal(refreshJson.pagination?.total || 0);
        setTotalPages(refreshJson.pagination?.totalPages || 1);
      }
    } catch {
      toast.error(t("Collection failed"));
    } finally {
      setCollecting(false);
    }
  };

  const handleExportCsv = () => {
    if (records.length === 0) return;

    // Get all unique keys from the data
    const allKeys = new Set<string>();
    records.forEach((r) => {
      Object.keys(r.data).forEach((k) => allKeys.add(k));
    });
    const headers = Array.from(allKeys);

    const csvRows = [
      headers.join(","),
      ...records.map((r) =>
        headers
          .map((h) => {
            const val = r.data[h];
            const str =
              val === null || val === undefined
                ? ""
                : typeof val === "object"
                ? JSON.stringify(val)
                : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${collection?.dataSource || "evidence"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!canView) {
    return <Unauthorized description={t("You don't have permission to view this data.")} />;
  }

  // Extract table columns from first few records
  const columnKeys = new Set<string>();
  records.slice(0, 5).forEach((r) => {
    Object.keys(r.data).forEach((k) => {
      // Skip nested objects and internal fields
      if (typeof r.data[k] !== "object" || r.data[k] === null) {
        columnKeys.add(k);
      }
    });
  });
  const columns = Array.from(columnKeys).slice(0, 8); // Limit visible columns

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <Link href="/technical-evidence/dashboard" className="hover:text-primary-600 transition-colors">
            {t("Technical Evidence")}
          </Link>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium truncate max-w-[200px]">
          {collection?.displayName || t("View Data")}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            {collection?.displayName || t("View Data")}
          </h1>
          {collection && (
            <p className="text-sm text-slate-500 mt-1">
              {total} {t("records")} &bull;{" "}
              {t("Last Collected")}:{" "}
              {collection.lastCollectedAt
                ? new Date(collection.lastCollectedAt).toLocaleString()
                : t("Never")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
              {t("Export CSV")}
            </Button>
          )}
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecollect}
              disabled={collecting}
            >
              {collecting ? (
                <Loader2 className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
              )}
              {t("Recollect")}
            </Button>
          )}
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Database className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium">{t("No records collected yet")}</p>
          <p className="text-xs mt-1">{t("Click Recollect to fetch data from the source.")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    #
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record, idx) => (
                  <tr
                    key={record.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {(page - 1) * limit + idx + 1}
                    </td>
                    {columns.map((col) => {
                      const val = record.data[col];
                      const displayVal =
                        val === null || val === undefined
                          ? "-"
                          : typeof val === "boolean"
                          ? val
                            ? "Yes"
                            : "No"
                          : String(val);
                      return (
                        <td
                          key={col}
                          className="px-3 py-2 text-xs text-slate-700 max-w-[200px] truncate"
                          title={displayVal}
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <span className="text-xs text-slate-500">
                {t("Page")} {page} {t("of")} {totalPages} ({total} {t("records")})
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Control Mapping Panel */}
      {!loading && collection && (
        <ControlMappingPanel collectionId={id} canEdit={canCreate} />
      )}
    </div>
  );
}

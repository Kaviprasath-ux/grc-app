"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import {
  ChevronRight,
  Link2,
  RefreshCw,
  Home,
  Search,
  AlertTriangle,
  Trash2,
  Shield,
  Layers,
  Eye,
} from "lucide-react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface LinkedControl {
  id: string;
  control: {
    id: string;
    controlCode: string;
    name: string;
    status: string;
  };
}

interface MatrixEntry {
  id: string;
  matrixEntryId: string;
  riskCode: string;
  name: string;
  description: string | null;
  riskRating: string | null;
  residualRiskRating: string | null;
  status: string;
  ownerName: string | null;
  riskId: string | null;
  risk: {
    id: string;
    riskId: string;
    name: string;
    status: string;
  } | null;
  linkedControls: LinkedControl[];
}

export default function RiskControlMatrixPage() {
  const router = useRouter();
  const { canView, canCreate, canDelete, isLoading: permissionsLoading } = usePermissions('risk.risk-matrix');
  const isCustomerAdmin = useHasRole('CustomerAdministrator');
  const { t } = useLanguage();
  const [entries, setEntries] = useState<MatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const ITEMS_PER_PAGE = 10;

  const fetchEntries = useCallback(async () => {
    try {
      const response = await fetch(`/api/risk-control-matrix?page=1&limit=1000`);
      if (response.ok) {
        const result = await response.json();
        const data = Array.isArray(result) ? result : result.data || [];
        setEntries(data);
      }
    } catch (error) {
      console.error("Error fetching matrix entries:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleDeleteEntry = async (entryId: string) => {
    setDeleting(`entry-${entryId}`);
    try {
      const response = await fetch(`/api/risk-control-matrix/${entryId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setEntries(prev => prev.filter(entry => entry.id !== entryId));
        toast({
          title: t("Entry deleted"),
          description: t("The matrix entry has been removed. The underlying risk is NOT affected."),
        });
      }
    } catch (error) {
      console.error("Error deleting matrix entry:", error);
      toast({
        title: t("Error"),
        description: t("Failed to delete matrix entry."),
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAllEntries = async () => {
    setDeleting("all-entries");
    try {
      const response = await fetch(`/api/risk-control-matrix`, {
        method: "DELETE",
      });
      if (response.ok) {
        setEntries([]);
        toast({
          title: t("All entries deleted"),
          description: t("All matrix entries have been removed. The underlying risks are NOT affected."),
        });
      }
    } catch (error) {
      console.error("Error deleting all matrix entries:", error);
      toast({
        title: t("Error"),
        description: t("Failed to delete matrix entries."),
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleImportRisks = async () => {
    setImporting(true);
    try {
      const response = await fetch(`/api/risk-control-matrix/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ includeControls: true }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: t("Import completed"),
          description: `${t("Imported")} ${result.imported} ${t("risks to the matrix.")} ${result.skipped} ${t("already existed.")}`,
        });
        setCurrentPage(1);
        fetchEntries();
      } else {
        const error = await response.json();
        toast({
          title: t("Import failed"),
          description: error.error || t("Failed to import risks."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error importing risks:", error);
      toast({
        title: t("Error"),
        description: t("Failed to import risks to matrix."),
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // Search filtering
  const filteredEntries = entries.filter((entry) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      entry.riskCode.toLowerCase().includes(term) ||
      entry.name.toLowerCase().includes(term) ||
      (entry.description || "").toLowerCase().includes(term) ||
      (entry.ownerName || "").toLowerCase().includes(term)
    );
  });

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Summary stats
  const withControls = entries.filter(e => e.linkedControls?.length > 0).length;
  const withoutControls = entries.filter(e => !e.linkedControls?.length).length;

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / ITEMS_PER_PAGE);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const showActions = isCustomerAdmin && canDelete;

  const gridCols = showActions
    ? "grid-cols-[90px_1.5fr_100px_100px_100px_80px_120px_80px]"
    : "grid-cols-[90px_1.5fr_100px_100px_100px_80px_120px_50px]";

  if (permissionsLoading || loading) {
    return (
      <div className="space-y-6">
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
          <span className="text-primary-700 font-medium">{t("Risk Control Matrix")}</span>
        </nav>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Risk Control Matrix.")} />;
  }

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
        <span className="text-primary-700 font-medium">{t("Risk Control Matrix")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Control Matrix")}</h1>
        <div className="flex items-center gap-2">
          {isCustomerAdmin && canDelete && entries.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                  disabled={deleting === "all-entries"}
                >
                  <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {deleting === "all-entries" ? t("Deleting...") : t("Delete All")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="p-0 gap-0">
                <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
                  <AlertDialogTitle>{t("Delete All Matrix Entries?")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {`${t("This will remove all")} ${entries.length} ${t("entry(ies) from the Risk Control Matrix.")}`}
                    <strong className="block mt-2 text-green-600">{t("The underlying Risk records will NOT be deleted.")}</strong>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
                  <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={handleDeleteAllEntries}
                  >
                    {t("Delete All")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {canCreate && (
            <Button
              size="sm"
              onClick={handleImportRisks}
              disabled={importing}
              className="bg-primary-600 hover:bg-primary-700"
            >
              <RefreshCw className={`h-4 w-4 ltr:mr-2 rtl:ml-2 ${importing ? 'animate-spin' : ''}`} />
              {importing ? t("Importing...") : t("Sync from Risks")}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Total Entries")}</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{entries.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <Layers className="h-5 w-5 text-primary-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("With Controls")}</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{withControls}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Shield className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t("Without Controls")}</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{withoutControls}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search Bar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search by risk code, name, or owner...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
        </div>

        {/* Column Headers */}
        <div className={`grid ${gridCols} gap-4 px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider`}>
          <span>{t("Risk Code")}</span>
          <span>{t("Risk Name")}</span>
          <span>{t("Inherent")}</span>
          <span>{t("Residual")}</span>
          <span>{t("Status")}</span>
          <span>{t("Controls")}</span>
          <span>{t("Owner")}</span>
          {showActions && <span>{t("Actions")}</span>}
          {!showActions && <span></span>}
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <AlertTriangle className="h-6 w-6 text-slate-400" />
              </div>
              {entries.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-slate-600">{t("No entries in the Risk Control Matrix")}</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">{t("Import risks from the risk register to get started")}</p>
                  {canCreate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleImportRisks}
                      disabled={importing}
                    >
                      <RefreshCw className={`h-4 w-4 ltr:mr-2 rtl:ml-2 ${importing ? 'animate-spin' : ''}`} />
                      {importing ? t("Importing...") : t("Import Risks")}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-600">{t("No risks found")}</p>
                  <p className="text-xs text-slate-400 mt-1">{t("Try adjusting your search")}</p>
                </>
              )}
            </div>
          ) : (
            paginatedEntries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => entry.riskId && router.push(`/risks/risk-control-matrix/${entry.riskId}`)}
                className={`grid ${gridCols} gap-4 px-5 py-3 items-center transition-colors ${entry.riskId ? "cursor-pointer hover:bg-slate-50/60" : ""}`}
              >
                {/* Risk Code */}
                <span className="text-sm font-medium text-slate-800">{entry.riskCode}</span>

                {/* Risk Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-slate-700 truncate">{entry.name}</span>
                  {!entry.riskId && (
                    <Badge variant="outline" className="text-[10px] text-slate-400 border-dashed border-slate-300 flex-shrink-0 px-1.5 py-0">
                      {t("Deleted")}
                    </Badge>
                  )}
                </div>

                {/* Inherent Risk Rating */}
                <span className="text-sm text-slate-600">{entry.riskRating || "--"}</span>

                {/* Residual Risk Rating */}
                <span className="text-sm text-slate-600">{entry.residualRiskRating || "--"}</span>

                {/* Status */}
                <span className="text-sm text-slate-600">{entry.status}</span>

                {/* Controls Count */}
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">{entry.linkedControls?.length || 0}</span>
                </div>

                {/* Owner */}
                <span className="text-sm text-slate-600 truncate">{entry.ownerName || "-"}</span>

                {/* Actions */}
                {showActions && (
                  <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-slate-600"
                      onClick={() => entry.riskId && router.push(`/risks/risk-control-matrix/${entry.riskId}`)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          disabled={deleting === `entry-${entry.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="p-0 gap-0">
                        <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
                          <AlertDialogTitle>{t("Delete Matrix Entry?")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {`${t("This will remove entry")} ${entry.riskCode} (${entry.name}) ${t("from the Risk Control Matrix.")}`}
                            <strong className="block mt-2 text-green-600">{t("The underlying Risk record will NOT be deleted.")}</strong>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
                          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => handleDeleteEntry(entry.id)}
                          >
                            {t("Delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}

                {/* View button when no delete permission */}
                {!showActions && (
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-slate-600"
                      onClick={() => entry.riskId && router.push(`/risks/risk-control-matrix/${entry.riskId}`)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {filteredEntries.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredEntries.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  );
}

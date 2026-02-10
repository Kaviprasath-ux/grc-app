"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronRight, Link2, Home, Box, GitBranch, Search, AlertTriangle, X, Shield, ExternalLink,
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
import { cn } from "@/lib/utils";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useLanguage } from "@/contexts/LanguageContext";
import { RiskRatingBadge } from "@/components/risks/risk-rating-badge";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/usePagination";

interface LinkedControl {
  id: string;
  control: {
    id: string;
    controlCode: string;
    name: string;
    status: string;
  };
}

interface ImpactedAsset {
  id: string;
  assetId: string;
  name: string;
  classification: string | null;
}

interface ImpactedProcess {
  id: string;
  processCode: string;
  name: string;
  description: string | null;
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
    impactedAsset: ImpactedAsset | null;
    impactedProcess: ImpactedProcess | null;
  } | null;
  linkedControls: LinkedControl[];
}

const controlStatusColors: Record<string, string> = {
  Compliant: "bg-green-100 text-green-800",
  "Non Compliant": "bg-red-100 text-red-800",
  "Partial Compliant": "bg-yellow-100 text-yellow-800",
  "Not Applicable": "bg-slate-100 text-slate-800",
};

const statusColors: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800",
  "In-Progress": "bg-amber-100 text-amber-800",
  Completed: "bg-green-100 text-green-800",
  Mitigate: "bg-purple-100 text-purple-800",
  Accept: "bg-teal-100 text-teal-800",
  Transfer: "bg-indigo-100 text-indigo-800",
  Avoid: "bg-orange-100 text-orange-800",
};

export default function RiskControlMatrixPage() {
  const { canView, canEdit, isLoading: permissionsLoading } = usePermissions('risk.risk-matrix');
  const isCustomerAdmin = useHasRole('CustomerAdministrator');
  const { t } = useLanguage();
  const [entries, setEntries] = useState<MatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const { toast } = useToast();

  // Search
  const [searchTerm, setSearchTerm] = useState("");
  const ITEMS_PER_PAGE = 20;

  // Detail dialog
  const [selectedEntry, setSelectedEntry] = useState<MatrixEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("controls");

  const fetchEntries = useCallback(async () => {
    try {
      const response = await fetch(`/api/risk-control-matrix?page=1&limit=500`);
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

  const openDetail = (entry: MatrixEntry) => {
    setSelectedEntry(entry);
    setActiveTab("controls");
    setDialogOpen(true);
  };

  const handleUnlinkControl = async (entryId: string, controlId: string) => {
    setUnlinking(`${entryId}-${controlId}`);
    try {
      const response = await fetch(`/api/risk-control-matrix/${entryId}/controls/${controlId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        const updater = (prev: MatrixEntry[]) => prev.map(entry => {
          if (entry.id === entryId) {
            return {
              ...entry,
              linkedControls: entry.linkedControls.filter(lc => lc.control.id !== controlId)
            };
          }
          return entry;
        });
        setEntries(updater);
        if (selectedEntry?.id === entryId) {
          setSelectedEntry(prev => prev ? {
            ...prev,
            linkedControls: prev.linkedControls.filter(lc => lc.control.id !== controlId)
          } : null);
        }
        toast({
          title: t("Control unlinked"),
          description: t("The control has been unlinked from this matrix entry."),
        });
      }
    } catch (error) {
      console.error("Error unlinking control:", error);
      toast({
        title: t("Error"),
        description: t("Failed to unlink control."),
        variant: "destructive",
      });
    } finally {
      setUnlinking(null);
    }
  };

  // Filter entries by search
  const filteredEntries = entries.filter((entry) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      entry.riskCode.toLowerCase().includes(term) ||
      entry.name.toLowerCase().includes(term) ||
      (entry.description || "").toLowerCase().includes(term) ||
      (entry.ownerName || "").toLowerCase().includes(term) ||
      entry.linkedControls.some(lc =>
        lc.control.controlCode.toLowerCase().includes(term) ||
        lc.control.name.toLowerCase().includes(term)
      )
    );
  });

  // Pagination
  const { currentPage, setCurrentPage, totalPages, paginatedData: paginatedEntries } = usePagination({ data: filteredEntries, itemsPerPage: ITEMS_PER_PAGE });

  if (permissionsLoading || loading) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Risk Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Risk Control Matrix")}</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Control Matrix")}</h1>
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

  const entry = selectedEntry;
  const controlCount = entry?.linkedControls?.length || 0;
  const assetCount = entry?.risk?.impactedAsset ? 1 : 0;
  const processCount = entry?.risk?.impactedProcess ? 1 : 0;

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

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Control Matrix")}</h1>
        <span className="text-sm text-slate-500">{filteredEntries.length} {t("entries")}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search Bar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search by risk code, name, owner, or control...")}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[100px_1fr_120px_100px_100px_80px] gap-3 px-5 py-2.5 bg-slate-50/60 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <span>{t("Code")}</span>
          <span>{t("Risk Name")}</span>
          <span>{t("Owner")}</span>
          <span className="text-center">{t("Status")}</span>
          <span className="text-center">{t("Rating")}</span>
          <span className="text-center">{t("Controls")}</span>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-slate-50">
          {paginatedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <AlertTriangle className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">{t("No entries found")}</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm
                  ? t("Try adjusting your search")
                  : t("Entries are automatically created from the Risk Register")}
              </p>
            </div>
          ) : (
            paginatedEntries.map((row) => (
              <div
                key={row.id}
                onClick={() => openDetail(row)}
                className="grid grid-cols-[100px_1fr_120px_100px_100px_80px] gap-3 px-5 py-3.5 items-center cursor-pointer transition-colors hover:bg-slate-50/60"
              >
                <span className="text-sm font-semibold text-primary-600">{row.riskCode}</span>
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-sm text-slate-700 truncate">{row.name}</span>
                  {!row.riskId && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 flex-shrink-0">
                      {t("Deleted")}
                    </span>
                  )}
                </div>
                <span className="text-sm text-slate-600 truncate">{row.ownerName || "-"}</span>
                <div className="flex justify-center">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap",
                    statusColors[row.status] || "bg-slate-100 text-slate-800"
                  )}>
                    {row.status}
                  </span>
                </div>
                <div className="flex justify-center">
                  <RiskRatingBadge rating={row.riskRating || "-"} />
                </div>
                <div className="flex justify-center">
                  <span className="flex items-center gap-1 text-sm text-slate-600">
                    <Link2 className="h-3.5 w-3.5 text-slate-400" />
                    {row.linkedControls?.length || 0}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredEntries.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" showCloseButton={false}>
          <DialogTitle className="sr-only">{entry?.name || t("Risk Control Matrix Entry")}</DialogTitle>
          <DialogDescription className="sr-only">{t("Details for risk control matrix entry")}</DialogDescription>

          {entry && (
            <>
              {/* Dialog Header */}
              <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-primary-600">{entry.riskCode}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        statusColors[entry.status] || "bg-slate-100 text-slate-800"
                      )}>
                        {entry.status}
                      </span>
                      <RiskRatingBadge rating={entry.riskRating || "-"} />
                    </div>
                    <h2 className="text-base font-semibold text-slate-800 leading-snug">{entry.name}</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                    onClick={() => setDialogOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Dialog Body */}
              <div className="flex-1 overflow-y-auto">
                {/* Risk Summary */}
                <div className="px-6 py-4 border-b border-slate-100">
                  {entry.description && (
                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">{entry.description}</p>
                  )}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">{t("Inherent Risk")}</p>
                      <RiskRatingBadge rating={entry.riskRating || "-"} />
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">{t("Residual Risk")}</p>
                      <RiskRatingBadge rating={entry.residualRiskRating || "-"} />
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">{t("Risk Owner")}</p>
                      <p className="text-sm font-medium text-slate-800">{entry.ownerName || t("Not assigned")}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">{t("Matrix ID")}</p>
                      <p className="text-sm font-medium text-slate-800">{entry.matrixEntryId}</p>
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="px-6 border-b border-slate-200">
                  <div className="flex items-center gap-1 -mb-px">
                    {[
                      { key: "controls", icon: Link2, label: t("Linked Controls"), count: controlCount },
                      { key: "asset", icon: Box, label: t("Asset Class"), count: assetCount },
                      { key: "process", icon: GitBranch, label: t("Linked Process"), count: processCount },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2",
                            activeTab === tab.key
                              ? "text-primary-600 border-primary-600"
                              : "text-slate-400 border-transparent hover:text-slate-600"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {tab.label}
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full",
                            activeTab === tab.key
                              ? "bg-primary-100 text-primary-700"
                              : "bg-slate-100 text-slate-500"
                          )}>
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="px-6 py-4">
                  {/* Controls Tab */}
                  {activeTab === "controls" && (
                    <div className="space-y-2">
                      {entry.linkedControls && entry.linkedControls.length > 0 ? (
                        entry.linkedControls.map((lc) => (
                          <div
                            key={lc.id}
                            className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-primary-600">{lc.control.controlCode}</span>
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                    controlStatusColors[lc.control.status] || "bg-slate-100 text-slate-800"
                                  )}>
                                    {lc.control.status}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-700 leading-snug">{lc.control.name}</p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Link
                                  href={`/compliance/control/${lc.control.id}`}
                                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-primary-600 transition-colors"
                                  title={t("View control")}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Shield className="h-3.5 w-3.5" />
                                </Link>
                                {(isCustomerAdmin || canEdit) && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <button
                                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                        disabled={unlinking === `${entry.id}-${lc.control.id}`}
                                        title={t("Unlink control")}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="p-0 gap-0">
                                      <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
                                        <AlertDialogTitle>{t("Unlink Control?")}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {`${t("This will remove the link between control")} ${lc.control.controlCode} ${t("and this matrix entry.")}`}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
                                        <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-red-600 hover:bg-red-700"
                                          onClick={() => handleUnlinkControl(entry.id, lc.control.id)}
                                        >
                                          {t("Unlink")}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-10 text-center">
                          <Link2 className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">{t("No linked controls")}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Asset Tab */}
                  {activeTab === "asset" && (
                    <div>
                      {entry.risk?.impactedAsset ? (
                        <div className="p-4 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2 mb-3">
                            <Box className="h-4 w-4 text-primary-500" />
                            <span className="text-sm font-semibold text-slate-800">{entry.risk.impactedAsset.name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{t("Asset ID")}</p>
                              <p className="text-sm font-medium text-primary-600">{entry.risk.impactedAsset.assetId}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{t("Classification")}</p>
                              <p className="text-sm font-medium text-slate-800">{entry.risk.impactedAsset.classification || "-"}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-10 text-center">
                          <Box className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">{t("No impacted asset")}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Process Tab */}
                  {activeTab === "process" && (
                    <div>
                      {entry.risk?.impactedProcess ? (
                        <div className="p-4 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2 mb-3">
                            <GitBranch className="h-4 w-4 text-primary-500" />
                            <span className="text-sm font-semibold text-slate-800">{entry.risk.impactedProcess.name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{t("Process Code")}</p>
                              <p className="text-sm font-medium text-primary-600">{entry.risk.impactedProcess.processCode}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{t("Description")}</p>
                              <p className="text-sm text-slate-600 leading-relaxed">{entry.risk.impactedProcess.description || "-"}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-10 text-center">
                          <GitBranch className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-sm text-slate-400">{t("No linked process")}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Dialog Footer */}
              <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Link2 className="h-3 w-3" /> {controlCount} {t("controls")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Box className="h-3 w-3" /> {assetCount} {t("assets")}
                    </span>
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" /> {processCount} {t("processes")}
                    </span>
                  </div>
                  <Link href={`/risks/risk-control-matrix/${entry.id}`}>
                    <Button variant="outline" size="sm" className="text-xs h-8">
                      <ExternalLink className="h-3 w-3 ltr:mr-1.5 rtl:ml-1.5" />
                      {t("Full View")}
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

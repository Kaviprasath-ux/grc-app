"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Home,
  Search,
  AlertTriangle,
  Plus,
  Minus,
  Unlink,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
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
    impactedAsset?: {
      id: string;
      assetId: string;
      name: string;
      description: string | null;
      classification: { name: string } | null;
    } | null;
    impactedProcess?: {
      id: string;
      processCode: string;
      name: string;
      description: string | null;
      status: string;
    } | null;
  } | null;
  linkedControls: LinkedControl[];
}

export default function RiskControlMatrixPage() {
  const router = useRouter();
  const { canView, canDelete, isLoading: permissionsLoading } = usePermissions('risk.risk-matrix');
  const { t } = useLanguage();
  const [entries, setEntries] = useState<MatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Record<string, Set<string>>>({});
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const { toast } = useToast();

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

  const toggleRisk = (entryId: string) => {
    setExpandedRisks(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const toggleSection = (entryId: string, section: string) => {
    setExpandedSections(prev => {
      const entrySections = new Set(prev[entryId] || []);
      if (entrySections.has(section)) entrySections.delete(section);
      else entrySections.add(section);
      return { ...prev, [entryId]: entrySections };
    });
  };

  const isSectionExpanded = (entryId: string, section: string) => {
    return expandedSections[entryId]?.has(section) || false;
  };

  const handleUnlinkControl = async (entryId: string, controlId: string) => {
    const key = `${entryId}-${controlId}`;
    setUnlinking(key);
    try {
      const response = await fetch(`/api/risk-control-matrix/${entryId}/controls/${controlId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setEntries(prev => prev.map(e => {
          if (e.id !== entryId) return e;
          return {
            ...e,
            linkedControls: e.linkedControls.filter(lc => lc.control.id !== controlId),
          };
        }));
        toast({ title: t("Control unlinked"), description: t("The control has been removed from this risk.") });
      } else {
        const err = await response.json().catch(() => ({}));
        toast({ title: t("Error"), description: err.error || t("Failed to unlink control."), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error unlinking control:", error);
      toast({ title: t("Error"), description: t("Failed to unlink control."), variant: "destructive" });
    } finally {
      setUnlinking(null);
    }
  };

  // Search filtering
  const filteredEntries = useMemo(() => entries.filter((entry) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      entry.riskCode.toLowerCase().includes(term) ||
      entry.name.toLowerCase().includes(term) ||
      (entry.description || "").toLowerCase().includes(term) ||
      (entry.ownerName || "").toLowerCase().includes(term)
    );
  }), [entries, searchTerm]);


  if (permissionsLoading || loading) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Risk Management")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Risk Dashboard")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
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
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/risks/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Risk Dashboard")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Risk Control Matrix")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-primary-700">{t("Risk Control Matrix")}</h1>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-3 sm:px-5 py-3">
        <div className="relative max-w-md">
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

      {/* Risk Accordion Cards */}
      {filteredEntries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="h-6 w-6 text-primary-400" />
          </div>
          {entries.length === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-600 mb-1">{t("No entries in the Risk Control Matrix")}</p>
              <p className="text-xs text-slate-400">{t("Risks from the risk register will appear here automatically")}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-600 mb-1">{t("No risks found")}</p>
              <p className="text-xs text-slate-400">{t("Try adjusting your search")}</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => {
            const isExpanded = expandedRisks.has(entry.id);
            const assetCount = entry.risk?.impactedAsset ? 1 : 0;
            const processCount = entry.risk?.impactedProcess ? 1 : 0;
            const controlCount = entry.linkedControls?.length || 0;

            return (
              <div key={entry.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Accordion Header */}
                <div className="flex items-center bg-primary-50 hover:bg-primary-100/80 transition-colors">
                  <button
                    onClick={() => toggleRisk(entry.id)}
                    className="flex-1 flex items-center justify-between px-4 sm:px-5 py-3 text-left"
                  >
                    <span className="text-sm font-semibold text-primary-700">
                      {entry.riskCode} - {entry.name} | {t("Mapped Asset")}: {assetCount} | {t("Mapped Process")}: {processCount} | {t("Mapped Controls")}: {controlCount} | {t("Risk Rating")}: {entry.riskRating ? t(entry.riskRating) : "-"}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-primary-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-primary-500 flex-shrink-0" />
                    )}
                  </button>
                  {entry.risk && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 ltr:mr-3 rtl:ml-3 text-primary-600 hover:text-primary-800 hover:bg-primary-100"
                      onClick={() => router.push(`/risks/register/${entry.risk!.id}/edit`)}
                      title={t("View Risk")}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="border-t border-slate-200">
                    {/* Risk Details */}
                    <div className="px-4 sm:px-6 py-4 space-y-4 border border-slate-100 mx-4 my-4 rounded-lg">
                      {/* Description */}
                      <div>
                        <p className="text-sm font-semibold text-primary-600 mb-1">{t("Description")}</p>
                        <p className="text-sm text-slate-700">{entry.description || "-"}</p>
                      </div>

                      {/* Ratings & Status Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm font-semibold text-primary-600 mb-1">{t("Inherent Risk Rating")}</p>
                          <p className="text-sm text-slate-700">{entry.riskRating ? t(entry.riskRating) : "-"}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-primary-600 mb-1">{t("Residual Risk Rating")}</p>
                          <p className="text-sm text-slate-700">{entry.residualRiskRating ? t(entry.residualRiskRating) : "-"}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-primary-600 mb-1">{t("Status")}</p>
                          <p className="text-sm text-slate-700">{t(entry.status)}</p>
                        </div>
                      </div>

                      {/* Risk Owner */}
                      <div>
                        <p className="text-sm font-semibold text-primary-600 mb-1">{t("Risk Owner")}</p>
                        <p className="text-sm text-slate-700">{entry.ownerName || "-"}</p>
                      </div>

                      {/* Linked Controls Section */}
                      <div className="bg-slate-50/50 rounded-lg border border-slate-100 overflow-hidden">
                        <button
                          onClick={() => toggleSection(entry.id, "controls")}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100/50 transition-colors text-left"
                        >
                          <span className="text-sm font-semibold text-primary-600">{t("Linked Controls")}</span>
                          {isSectionExpanded(entry.id, "controls") ? (
                            <Minus className="h-4 w-4 text-slate-500" />
                          ) : (
                            <Plus className="h-4 w-4 text-slate-500" />
                          )}
                        </button>
                        {isSectionExpanded(entry.id, "controls") && (
                          <div className="border-t border-slate-100">
                            {controlCount > 0 ? (
                              <table className="w-full">
                                <thead>
                                  <tr className="bg-primary-600 text-white">
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Control code")}</th>
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Control name")}</th>
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Status")}</th>
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Action")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.linkedControls.map((lc) => (
                                    <tr key={lc.id} className="border-b border-slate-100 last:border-0">
                                      <td className="py-2.5 px-4 text-sm text-slate-700">{lc.control.controlCode}</td>
                                      <td className="py-2.5 px-4 text-sm text-slate-700">{lc.control.name}</td>
                                      <td className="py-2.5 px-4 text-sm text-slate-700">{t(lc.control.status)}</td>
                                      <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-primary-600 hover:text-primary-800 hover:bg-primary-50"
                                            onClick={() => router.push(`/compliance/control/${lc.control.id}`)}
                                            title={t("View Control")}
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                          </Button>
                                          {canDelete && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                              disabled={unlinking === `${entry.id}-${lc.control.id}`}
                                              onClick={() => handleUnlinkControl(entry.id, lc.control.id)}
                                            >
                                              <Unlink className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                                              <span className="text-xs">{unlinking === `${entry.id}-${lc.control.id}` ? t("Unlinking...") : t("Unlink")}</span>
                                            </Button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="px-4 py-3 text-sm text-slate-400">{t("No linked controls")}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Asset Class Section */}
                      <div className="bg-slate-50/50 rounded-lg border border-slate-100 overflow-hidden">
                        <button
                          onClick={() => toggleSection(entry.id, "assets")}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100/50 transition-colors text-left"
                        >
                          <span className="text-sm font-semibold text-primary-600">{t("Asset Class")}</span>
                          {isSectionExpanded(entry.id, "assets") ? (
                            <Minus className="h-4 w-4 text-slate-500" />
                          ) : (
                            <Plus className="h-4 w-4 text-slate-500" />
                          )}
                        </button>
                        {isSectionExpanded(entry.id, "assets") && (
                          <div className="border-t border-slate-100">
                            {entry.risk?.impactedAsset ? (
                              <table className="w-full">
                                <thead>
                                  <tr className="bg-primary-600 text-white">
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Asset ID")}</th>
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Name")}</th>
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Classification")}</th>
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Action")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b border-slate-100">
                                    <td className="py-2.5 px-4 text-sm text-slate-700">{entry.risk.impactedAsset.assetId}</td>
                                    <td className="py-2.5 px-4 text-sm text-slate-700">{entry.risk.impactedAsset.name}</td>
                                    <td className="py-2.5 px-4 text-sm text-slate-700">{entry.risk.impactedAsset.classification?.name || "-"}</td>
                                    <td className="py-2.5 px-4">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-primary-600 hover:text-primary-800 hover:bg-primary-50"
                                        onClick={() => router.push("/assets/inventory")}
                                        title={t("View Asset")}
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            ) : (
                              <p className="px-4 py-3 text-sm text-slate-400">{t("No linked assets")}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Linked Process Section */}
                      <div className="bg-slate-50/50 rounded-lg border border-slate-100 overflow-hidden">
                        <button
                          onClick={() => toggleSection(entry.id, "processes")}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100/50 transition-colors text-left"
                        >
                          <span className="text-sm font-semibold text-primary-600">{t("Linked Process")}</span>
                          {isSectionExpanded(entry.id, "processes") ? (
                            <Minus className="h-4 w-4 text-slate-500" />
                          ) : (
                            <Plus className="h-4 w-4 text-slate-500" />
                          )}
                        </button>
                        {isSectionExpanded(entry.id, "processes") && (
                          <div className="border-t border-slate-100">
                            {entry.risk?.impactedProcess ? (
                              <table className="w-full">
                                <thead>
                                  <tr className="bg-primary-600 text-white">
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Reference ID")}</th>
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Name")}</th>
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Process status")}</th>
                                    <th className="text-xs font-medium uppercase tracking-wider py-2.5 px-4 text-left">{t("Action")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b border-slate-100">
                                    <td className="py-2.5 px-4 text-sm text-slate-700">{entry.risk.impactedProcess.processCode}</td>
                                    <td className="py-2.5 px-4 text-sm text-slate-700">{entry.risk.impactedProcess.name}</td>
                                    <td className="py-2.5 px-4 text-sm text-slate-700">{entry.risk.impactedProcess.status || "-"}</td>
                                    <td className="py-2.5 px-4">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-primary-600 hover:text-primary-800 hover:bg-primary-50"
                                        onClick={() => router.push("/organization/process")}
                                        title={t("View Process")}
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                      </Button>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            ) : (
                              <p className="px-4 py-3 text-sm text-slate-400">{t("No linked processes")}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

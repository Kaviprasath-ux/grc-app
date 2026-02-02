"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Link2, RefreshCw, Home } from "lucide-react";
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
  riskId: string | null; // Reference to original risk (may be null if risk was deleted)
  risk: {
    id: string;
    riskId: string;
    name: string;
    status: string;
  } | null;
  linkedControls: LinkedControl[];
}

const riskRatingColors: Record<string, string> = {
  Catastrophic: "bg-red-600 text-white",
  "Very High": "bg-red-500 text-white",
  "Very high": "bg-red-500 text-white",
  High: "bg-orange-500 text-white",
  Medium: "bg-yellow-500 text-black",
  Low: "bg-green-500 text-white",
  "Low Risk": "bg-green-500 text-white",
};

const controlStatusColors: Record<string, string> = {
  Compliant: "bg-green-100 text-green-800",
  "Non Compliant": "bg-red-100 text-red-800",
  "Partial Compliant": "bg-yellow-100 text-yellow-800",
  "Not Applicable": "bg-slate-100 text-slate-800",
};

const riskStatusColors: Record<string, string> = {
  Open: "bg-blue-500 text-white",
  "In-Progress": "bg-yellow-500 text-black",
  Completed: "bg-green-500 text-white",
  Mitigate: "bg-purple-500 text-white",
  Accept: "bg-teal-500 text-white",
  Transfer: "bg-indigo-500 text-white",
  Avoid: "bg-orange-500 text-white",
};

export default function RiskControlMatrixPage() {
  const { canView, canCreate, canDelete, isLoading: permissionsLoading } = usePermissions('risk.risk-matrix');
  const isCustomerAdmin = useHasRole('CustomerAdministrator');
  const { t } = useLanguage();
  const [entries, setEntries] = useState<MatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();
  const pageSize = 10;

  const fetchEntries = useCallback(async (pageNum: number, append: boolean = false) => {
    try {
      const response = await fetch(`/api/risk-control-matrix?page=${pageNum}&limit=${pageSize}`);
      if (response.ok) {
        const result = await response.json();
        const data = Array.isArray(result) ? result : result.data || [];

        if (append) {
          setEntries(prev => [...prev, ...data]);
        } else {
          setEntries(data);
          // Expand all entries by default
          setExpandedEntries(new Set(data.map((e: MatrixEntry) => e.id)));
        }

        // Check if there are more items
        if (result.pagination) {
          setHasMore(pageNum < result.pagination.totalPages);
        } else {
          setHasMore(data.length === pageSize);
        }
      }
    } catch (error) {
      console.error("Error fetching matrix entries:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(1);
  }, [fetchEntries]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchEntries(nextPage, true);
  };

  const toggleEntry = (entryId: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const toggleControls = (entryId: string) => {
    setExpandedControls(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  // Unlink control from matrix entry (does NOT delete the control)
  const handleUnlinkControl = async (entryId: string, controlId: string) => {
    setDeleting(`${entryId}-${controlId}`);
    try {
      const response = await fetch(`/api/risk-control-matrix/${entryId}/controls/${controlId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        // Update local state to remove the unlinked control
        setEntries(prev => prev.map(entry => {
          if (entry.id === entryId) {
            return {
              ...entry,
              linkedControls: entry.linkedControls.filter(lc => lc.control.id !== controlId)
            };
          }
          return entry;
        }));
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
      setDeleting(null);
    }
  };

  // Delete matrix entry (does NOT delete the underlying risk)
  const handleDeleteEntry = async (entryId: string) => {
    setDeleting(`entry-${entryId}`);
    try {
      const response = await fetch(`/api/risk-control-matrix/${entryId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        // Remove the entry from local state
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

  // Delete all matrix entries (does NOT delete the underlying risks)
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

  // Import risks to the matrix (creates matrix entries from existing risks)
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
          description: t("Imported {imported} risks to the matrix. {skipped} already existed.", { imported: result.imported, skipped: result.skipped }),
        });
        // Refresh the list
        setPage(1);
        fetchEntries(1);
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

  // Show loading state while permissions or data is being fetched
  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Risk Control Matrix.")} />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Risk Control Matrix")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Control Matrix")}</h1>
        <div className="flex gap-2">
          {/* Import from Risks button */}
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportRisks}
              disabled={importing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${importing ? 'animate-spin' : ''}`} />
              {importing ? t("Importing...") : t("Sync from Risks")}
            </Button>
          )}

          {/* Delete All button (CustomerAdmin only) */}
          {isCustomerAdmin && canDelete && entries.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 border-red-300 hover:bg-red-50 hover:text-red-700"
                  disabled={deleting === "all-entries"}
                >
                  {deleting === "all-entries" ? t("Deleting...") : t("Delete All")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="p-0 gap-0">
                <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
                  <AlertDialogTitle>{t("Delete All Matrix Entries?")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("This will remove all {count} entry(ies) from the Risk Control Matrix.", { count: entries.length })}
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
        </div>
      </div>

      {/* Matrix Entry Accordion List */}
      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 py-12 text-center">
            <p className="text-slate-500 mb-4">{t("No entries in the Risk Control Matrix")}</p>
            {canCreate && (
              <Button
                variant="outline"
                onClick={handleImportRisks}
                disabled={importing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${importing ? 'animate-spin' : ''}`} />
                {importing ? t("Importing...") : t("Import Risks")}
              </Button>
            )}
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              {/* Entry Header - Collapsible Trigger */}
              <Collapsible
                open={expandedEntries.has(entry.id)}
                onOpenChange={() => toggleEntry(entry.id)}
              >
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 flex-1">
                      {expandedEntries.has(entry.id) ? (
                        <ChevronDown className="h-5 w-5 text-slate-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-slate-500" />
                      )}
                      <span className="font-medium text-primary-600">{entry.riskCode}</span>
                      <span className="font-medium">{entry.name}</span>
                      {/* Show if original risk still exists */}
                      {!entry.riskId && (
                        <Badge variant="outline" className="text-slate-500 text-xs">
                          {t("Original risk deleted")}
                        </Badge>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  {isCustomerAdmin && canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-red-500 hover:text-red-700 p-0 h-auto"
                          disabled={deleting === `entry-${entry.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {deleting === `entry-${entry.id}` ? t("Deleting...") : t("Delete")}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="p-0 gap-0">
                        <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
                          <AlertDialogTitle>{t("Delete Matrix Entry?")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("This will remove entry {code} ({name}) from the Risk Control Matrix.", { code: entry.riskCode, name: entry.name })}
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
                  )}
                </div>

                <CollapsibleContent>
                  <div className="p-4">
                    {/* Entry Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Description */}
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-slate-500 mb-1">{t("Description")}</p>
                        <p className="text-sm">{entry.description || "-"}</p>
                      </div>

                      {/* Risk Ratings and Status Row */}
                      <div className="md:col-span-2 grid grid-cols-3 gap-4">
                        {/* Inherent Risk Rating */}
                        <div>
                          <p className="text-sm font-medium text-slate-500 mb-1">{t("Inherent Risk Rating")}</p>
                          {entry.riskRating ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskRatingColors[entry.riskRating] || "bg-slate-100 text-slate-800"}`}>
                              {entry.riskRating}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </div>

                        {/* Residual Risk Rating */}
                        <div>
                          <p className="text-sm font-medium text-slate-500 mb-1">{t("Residual Risk Rating")}</p>
                          {entry.residualRiskRating ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskRatingColors[entry.residualRiskRating] || "bg-slate-100 text-slate-800"}`}>
                              {entry.residualRiskRating}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </div>

                        {/* Status */}
                        <div>
                          <p className="text-sm font-medium text-slate-500 mb-1">{t("Status")}</p>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskStatusColors[entry.status] || "bg-slate-100 text-slate-800"}`}>
                            {entry.status}
                          </span>
                        </div>
                      </div>

                      {/* Risk Owner */}
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-slate-500 mb-1">{t("Risk Owner")}</p>
                        <p className="text-sm">{entry.ownerName || t("No items found")}</p>
                      </div>
                    </div>

                    {/* Linked Controls Section */}
                    <div className="border-t border-slate-100 pt-4">
                      <Collapsible
                        open={expandedControls.has(entry.id)}
                        onOpenChange={() => toggleControls(entry.id)}
                      >
                        <div className="flex items-center justify-between">
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              className="flex items-center gap-2 p-0 h-auto font-medium text-primary-600 hover:text-primary-700"
                            >
                              <Link2 className="h-4 w-4" />
                              {t("Linked Controls")} ({entry.linkedControls?.length || 0})
                              {expandedControls.has(entry.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>

                        </div>

                        <CollapsibleContent className="mt-3">
                          {entry.linkedControls && entry.linkedControls.length > 0 ? (
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="h-12 bg-slate-50 hover:bg-slate-50">
                                    <TableHead className="text-slate-700 font-medium">{t("Control Code")}</TableHead>
                                    <TableHead className="text-slate-700 font-medium">{t("Control Name")}</TableHead>
                                    <TableHead className="text-slate-700 font-medium">{t("Status")}</TableHead>
                                    <TableHead className="text-slate-700 font-medium w-[100px]">{t("Action")}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {entry.linkedControls.map((lc) => (
                                    <TableRow key={lc.id} className="hover:bg-slate-50">
                                      <TableCell className="py-3 font-medium text-primary-600">
                                        {lc.control.controlCode}
                                      </TableCell>
                                      <TableCell className="py-3 text-slate-800">{lc.control.name}</TableCell>
                                      <TableCell className="py-3">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${controlStatusColors[lc.control.status] || "bg-slate-100 text-slate-800"}`}>
                                          {lc.control.status}
                                        </span>
                                      </TableCell>
                                      <TableCell className="py-3">
                                      {isCustomerAdmin && (
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              variant="link"
                                              size="sm"
                                              className="text-red-500 hover:text-red-700 p-0 h-auto"
                                              disabled={deleting === `${entry.id}-${lc.control.id}`}
                                            >
                                              {deleting === `${entry.id}-${lc.control.id}` ? t("Unlinking...") : t("Unlink")}
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent className="p-0 gap-0">
                                            <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
                                              <AlertDialogTitle>{t("Unlink Control?")}</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                {t("This will remove the link between control {code} and this matrix entry.", { code: lc.control.controlCode })}
                                                <strong className="block mt-2 text-green-600">{t("The control itself will NOT be deleted.")}</strong>
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
                                    </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 py-2">{t("No linked controls")}</p>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {hasMore && entries.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            className="text-primary-600 hover:text-primary-700 hover:bg-primary-50"
          >
            {t("Load More")}
          </Button>
        </div>
      )}
    </div>
  );
}

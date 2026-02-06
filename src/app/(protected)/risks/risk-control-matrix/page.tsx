"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight, Link2, Home, Box, GitBranch } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { Unauthorized } from "@/components/ui/unauthorized";
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
  const { canView, isLoading: permissionsLoading } = usePermissions('risk.risk-matrix');
  const isCustomerAdmin = useHasRole('CustomerAdministrator');
  const { t } = useLanguage();
  const [entries, setEntries] = useState<MatrixEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const { toast } = useToast();
  const pageSize = 30;

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
          // Expand first entry by default if any
          if (data.length > 0) {
            setExpandedEntries(new Set([data[0].id]));
          }
        }

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

  const handleUnlinkControl = async (entryId: string, controlId: string) => {
    setUnlinking(`${entryId}-${controlId}`);
    try {
      const response = await fetch(`/api/risk-control-matrix/${entryId}/controls/${controlId}`, {
        method: "DELETE",
      });
      if (response.ok) {
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
      setUnlinking(null);
    }
  };

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

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Risk Control Matrix")}</h1>
      </div>

      {/* Matrix Entry Accordion List */}
      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 py-12 text-center">
            <p className="text-slate-500">{t("No entries in the Risk Control Matrix")}</p>
            <p className="text-slate-400 text-sm mt-2">{t("Entries are automatically created from the Risk Register")}</p>
          </div>
        ) : (
          entries.map((entry) => {
            const assetCount = entry.risk?.impactedAsset ? 1 : 0;
            const processCount = entry.risk?.impactedProcess ? 1 : 0;
            const controlCount = entry.linkedControls?.length || 0;

            return (
              <div key={entry.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <Collapsible
                  open={expandedEntries.has(entry.id)}
                  onOpenChange={() => toggleEntry(entry.id)}
                >
                  {/* Accordion Header with Counts */}
                  <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 flex-1">
                        {expandedEntries.has(entry.id) ? (
                          <ChevronDown className="h-5 w-5 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-500" />
                        )}
                        <span className="font-medium text-primary-600">{entry.riskCode}</span>
                        <span className="font-medium text-slate-800">-</span>
                        <span className="font-medium text-slate-800">{entry.name}</span>

                        {/* Separator */}
                        <span className="text-slate-300 mx-2">|</span>

                        {/* Counts */}
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Box className="h-3.5 w-3.5" />
                            {t("Mapped Asset")}: <strong>{assetCount}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3.5 w-3.5" />
                            {t("Mapped Process")}: <strong>{processCount}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Link2 className="h-3.5 w-3.5" />
                            {t("Mapped Controls")}: <strong>{controlCount}</strong>
                          </span>
                        </div>

                        {/* Separator */}
                        <span className="text-slate-300 mx-2">|</span>

                        {/* Risk Rating */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">{t("Risk Rating")}:</span>
                          {entry.riskRating ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${riskRatingColors[entry.riskRating] || "bg-slate-100 text-slate-800"}`}>
                              {entry.riskRating}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </div>

                        {!entry.riskId && (
                          <Badge variant="outline" className="text-slate-500 text-xs ml-2">
                            {t("Original risk deleted")}
                          </Badge>
                        )}
                      </div>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="p-4">
                      {/* Entry Details Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="md:col-span-2">
                          <p className="text-sm font-medium text-slate-500 mb-1">{t("Description")}</p>
                          <p className="text-sm">{entry.description || "-"}</p>
                        </div>

                        <div className="md:col-span-2 grid grid-cols-4 gap-4">
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

                          <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">{t("Status")}</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${riskStatusColors[entry.status] || "bg-slate-100 text-slate-800"}`}>
                              {entry.status}
                            </span>
                          </div>

                          <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">{t("Risk Owner")}</p>
                            <p className="text-sm">{entry.ownerName || t("Not assigned")}</p>
                          </div>
                        </div>
                      </div>

                      {/* Sub-tabs for Linked Controls, Asset Class, Linked Process */}
                      <div className="border-t border-slate-100 pt-4">
                        <Tabs defaultValue="controls" className="w-full">
                          <TabsList className="grid w-full grid-cols-3 mb-4">
                            <TabsTrigger value="controls" className="flex items-center gap-2">
                              <Link2 className="h-4 w-4" />
                              {t("Linked Controls")} ({controlCount})
                            </TabsTrigger>
                            <TabsTrigger value="asset" className="flex items-center gap-2">
                              <Box className="h-4 w-4" />
                              {t("Asset Class")} ({assetCount})
                            </TabsTrigger>
                            <TabsTrigger value="process" className="flex items-center gap-2">
                              <GitBranch className="h-4 w-4" />
                              {t("Linked Process")} ({processCount})
                            </TabsTrigger>
                          </TabsList>

                          {/* Linked Controls Tab */}
                          <TabsContent value="controls">
                            {entry.linkedControls && entry.linkedControls.length > 0 ? (
                              <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="h-12 bg-slate-50 hover:bg-slate-50">
                                      <TableHead className="text-slate-700 font-medium">{t("Control Code")}</TableHead>
                                      <TableHead className="text-slate-700 font-medium">{t("Control Name")}</TableHead>
                                      <TableHead className="text-slate-700 font-medium">{t("Status")}</TableHead>
                                      {isCustomerAdmin && (
                                        <TableHead className="text-slate-700 font-medium w-[100px]">{t("Action")}</TableHead>
                                      )}
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
                                        {isCustomerAdmin && (
                                          <TableCell className="py-3">
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button
                                                  variant="link"
                                                  size="sm"
                                                  className="text-red-500 hover:text-red-700 p-0 h-auto"
                                                  disabled={unlinking === `${entry.id}-${lc.control.id}`}
                                                >
                                                  {unlinking === `${entry.id}-${lc.control.id}` ? t("Unlinking...") : t("Unlink")}
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent className="p-0 gap-0">
                                                <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
                                                  <AlertDialogTitle>{t("Unlink Control?")}</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    {`${t("This will remove the link between control")} ${lc.control.controlCode} ${t("and this matrix entry.")}`}
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
                                          </TableCell>
                                        )}
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 py-4 text-center">{t("No linked controls")}</p>
                            )}
                          </TabsContent>

                          {/* Asset Class Tab */}
                          <TabsContent value="asset">
                            {entry.risk?.impactedAsset ? (
                              <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="h-12 bg-slate-50 hover:bg-slate-50">
                                      <TableHead className="text-slate-700 font-medium">{t("Asset ID")}</TableHead>
                                      <TableHead className="text-slate-700 font-medium">{t("Asset Name")}</TableHead>
                                      <TableHead className="text-slate-700 font-medium">{t("Classification")}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    <TableRow className="hover:bg-slate-50">
                                      <TableCell className="py-3 font-medium text-primary-600">
                                        {entry.risk.impactedAsset.assetId}
                                      </TableCell>
                                      <TableCell className="py-3 text-slate-800">
                                        {entry.risk.impactedAsset.name}
                                      </TableCell>
                                      <TableCell className="py-3 text-slate-600">
                                        {entry.risk.impactedAsset.classification || "-"}
                                      </TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 py-4 text-center">{t("No impacted asset")}</p>
                            )}
                          </TabsContent>

                          {/* Linked Process Tab */}
                          <TabsContent value="process">
                            {entry.risk?.impactedProcess ? (
                              <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="h-12 bg-slate-50 hover:bg-slate-50">
                                      <TableHead className="text-slate-700 font-medium">{t("Process Code")}</TableHead>
                                      <TableHead className="text-slate-700 font-medium">{t("Process Name")}</TableHead>
                                      <TableHead className="text-slate-700 font-medium">{t("Description")}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    <TableRow className="hover:bg-slate-50">
                                      <TableCell className="py-3 font-medium text-primary-600">
                                        {entry.risk.impactedProcess.processCode}
                                      </TableCell>
                                      <TableCell className="py-3 text-slate-800">
                                        {entry.risk.impactedProcess.name}
                                      </TableCell>
                                      <TableCell className="py-3 text-slate-600">
                                        {entry.risk.impactedProcess.description || "-"}
                                      </TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500 py-4 text-center">{t("No linked process")}</p>
                            )}
                          </TabsContent>
                        </Tabs>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })
        )}
      </div>

      {/* Load More */}
      {hasMore && entries.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            variant="link"
            onClick={handleLoadMore}
            className="text-primary-600 hover:text-primary-700"
          >
            {t("Load more...")}
          </Button>
        </div>
      )}
    </div>
  );
}

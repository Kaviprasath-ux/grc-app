"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ChevronDown, ChevronRight, Link2 } from "lucide-react";
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

interface LinkedControl {
  id: string;
  control: {
    id: string;
    controlCode: string;
    name: string;
    status: string;
  };
}

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  likelihood: number;
  impact: number;
  riskRating: string | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualRiskRating: string | null;
  status: string;
  owner: { id: string; fullName: string } | null;
  controlRisks?: LinkedControl[];
}

const riskRatingColors: Record<string, string> = {
  Catastrophic: "bg-red-600 text-white",
  "Very High": "bg-red-500 text-white",
  High: "bg-orange-500 text-white",
  Medium: "bg-yellow-500 text-black",
  Low: "bg-green-500 text-white",
  "Low Risk": "bg-green-500 text-white",
};

const controlStatusColors: Record<string, string> = {
  Compliant: "bg-green-100 text-green-800",
  "Non Compliant": "bg-red-100 text-red-800",
  "Partial Compliant": "bg-yellow-100 text-yellow-800",
  "Not Applicable": "bg-gray-100 text-gray-800",
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
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRisks, setExpandedRisks] = useState<Set<string>>(new Set());
  const [expandedControls, setExpandedControls] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const pageSize = 10;

  const fetchRisks = useCallback(async (pageNum: number, append: boolean = false) => {
    try {
      const response = await fetch(`/api/risks?page=${pageNum}&limit=${pageSize}&includeControls=true`);
      if (response.ok) {
        const result = await response.json();
        const data = Array.isArray(result) ? result : result.data || [];

        if (append) {
          setRisks(prev => [...prev, ...data]);
        } else {
          setRisks(data);
          // Expand all risks by default
          setExpandedRisks(new Set(data.map((r: Risk) => r.id)));
        }

        // Check if there are more items
        if (result.pagination) {
          setHasMore(pageNum < result.pagination.totalPages);
        } else {
          setHasMore(data.length === pageSize);
        }
      }
    } catch (error) {
      console.error("Error fetching risks:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRisks(1);
  }, [fetchRisks]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRisks(nextPage, true);
  };

  const toggleRisk = (riskId: string) => {
    setExpandedRisks(prev => {
      const next = new Set(prev);
      if (next.has(riskId)) {
        next.delete(riskId);
      } else {
        next.add(riskId);
      }
      return next;
    });
  };

  const toggleControls = (riskId: string) => {
    setExpandedControls(prev => {
      const next = new Set(prev);
      if (next.has(riskId)) {
        next.delete(riskId);
      } else {
        next.add(riskId);
      }
      return next;
    });
  };

  const handleDeleteControl = async (riskId: string, controlId: string) => {
    setDeleting(`${riskId}-${controlId}`);
    try {
      const response = await fetch(`/api/risks/${riskId}/controls/${controlId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        // Update local state to remove the deleted control
        setRisks(prev => prev.map(risk => {
          if (risk.id === riskId) {
            return {
              ...risk,
              controlRisks: risk.controlRisks?.filter(cr => cr.control.id !== controlId) || []
            };
          }
          return risk;
        }));
      }
    } catch (error) {
      console.error("Error deleting control link:", error);
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteRisk = async (riskId: string) => {
    setDeleting(`risk-${riskId}`);
    try {
      const response = await fetch(`/api/risks/${riskId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        // Remove the risk from local state
        setRisks(prev => prev.filter(risk => risk.id !== riskId));
      }
    } catch (error) {
      console.error("Error deleting risk:", error);
    } finally {
      setDeleting(null);
    }
  };

  // Show loading state while permissions or data is being fetched
  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description="You don't have permission to access Risk Control Matrix." />;
  }

  const handleDeleteAllRisks = async () => {
    setDeleting("all-risks");
    try {
      for (const risk of risks) {
        await fetch(`/api/risks/${risk.id}`, {
          method: "DELETE",
        });
      }
      setRisks([]);
    } catch (error) {
      console.error("Error deleting all risks:", error);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Risk Control Matrix</h1>
          <p className="text-gray-600">
            View and manage risks with their linked controls
          </p>
        </div>
        {isCustomerAdmin && risks.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 border-red-300 hover:bg-red-50 hover:text-red-700"
                disabled={deleting === "all-risks"}
              >
                {deleting === "all-risks" ? "Deleting..." : "Delete All"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete All Risks?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all {risks.length} risk(s) from the Risk Control Matrix. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-500 hover:bg-red-600"
                  onClick={handleDeleteAllRisks}
                >
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Risk Accordion List */}
      <div className="space-y-3">
        {risks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No risks found</p>
            </CardContent>
          </Card>
        ) : (
          risks.map((risk) => (
            <Card key={risk.id} className="overflow-hidden">
              {/* Risk Header - Collapsible Trigger */}
              <Collapsible
                open={expandedRisks.has(risk.id)}
                onOpenChange={() => toggleRisk(risk.id)}
              >
                <div className="flex items-center justify-between p-4 border-b">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 flex-1">
                      {expandedRisks.has(risk.id) ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                      <span className="font-medium text-blue-600">{risk.riskId}</span>
                      <span className="font-medium">{risk.name}</span>
                    </div>
                  </CollapsibleTrigger>
                  {isCustomerAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-red-500 hover:text-red-700 p-0 h-auto"
                          disabled={deleting === `risk-${risk.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {deleting === `risk-${risk.id}` ? "Deleting..." : "Delete"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Risk?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete risk {risk.riskId} ({risk.name}). This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => handleDeleteRisk(risk.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                <CollapsibleContent>
                  <CardContent className="pt-4">
                    {/* Risk Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Description */}
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-gray-500 mb-1">Description</p>
                        <p className="text-sm">{risk.description || "-"}</p>
                      </div>

                      {/* Risk Ratings and Status Row */}
                      <div className="md:col-span-2 grid grid-cols-3 gap-4">
                        {/* Inherent Risk Rating */}
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Inherent Risk Rating</p>
                          {risk.riskRating ? (
                            <Badge className={riskRatingColors[risk.riskRating] || "bg-gray-100"}>
                              {risk.riskRating}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>

                        {/* Residual Risk Rating */}
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Residual Risk Rating</p>
                          {risk.residualRiskRating ? (
                            <Badge className={riskRatingColors[risk.residualRiskRating] || "bg-gray-100"}>
                              {risk.residualRiskRating}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>

                        {/* Status */}
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
                          <Badge className={riskStatusColors[risk.status] || "bg-gray-100"}>
                            {risk.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Risk Owner */}
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-gray-500 mb-1">Risk Owner</p>
                        <p className="text-sm">{risk.owner?.fullName || "No items found"}</p>
                      </div>
                    </div>

                    {/* Linked Controls Section */}
                    <div className="border-t pt-4">
                      <Collapsible
                        open={expandedControls.has(risk.id)}
                        onOpenChange={() => toggleControls(risk.id)}
                      >
                        <div className="flex items-center justify-between">
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              className="flex items-center gap-2 p-0 h-auto font-medium text-blue-600 hover:text-blue-800"
                            >
                              <Link2 className="h-4 w-4" />
                              Linked Controls ({risk.controlRisks?.length || 0})
                              {expandedControls.has(risk.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>

                        </div>

                        <CollapsibleContent className="mt-3">
                          {risk.controlRisks && risk.controlRisks.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Control Code</TableHead>
                                  <TableHead>Control Name</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="w-[100px]">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {risk.controlRisks.map((cr) => (
                                  <TableRow key={cr.id}>
                                    <TableCell className="font-medium text-blue-600">
                                      {cr.control.controlCode}
                                    </TableCell>
                                    <TableCell>{cr.control.name}</TableCell>
                                    <TableCell>
                                      <Badge className={controlStatusColors[cr.control.status] || "bg-gray-100"}>
                                        {cr.control.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {isCustomerAdmin && (
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              variant="link"
                                              size="sm"
                                              className="text-red-500 hover:text-red-700 p-0 h-auto"
                                              disabled={deleting === `${risk.id}-${cr.control.id}`}
                                            >
                                              {deleting === `${risk.id}-${cr.control.id}` ? "Unlinking..." : "Unlink"}
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Unlink Control?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                This will remove the link between control {cr.control.controlCode} and risk {risk.riskId}. This action cannot be undone.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                className="bg-red-500 hover:bg-red-600"
                                                onClick={() => handleDeleteControl(risk.id, cr.control.id)}
                                              >
                                                Unlink
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
                          ) : (
                            <p className="text-sm text-gray-500 py-2">No linked controls</p>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
        )}
      </div>

      {/* Load More */}
      {hasMore && risks.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            variant="link"
            onClick={handleLoadMore}
            className="text-blue-600 hover:text-blue-800"
          >
            Load more...
          </Button>
        </div>
      )}
    </div>
  );
}

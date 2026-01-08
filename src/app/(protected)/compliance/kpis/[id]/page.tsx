"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Pencil, Trash2, Upload, Plus, Calendar } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface KPIActionPlan {
  id: string;
  plannedAction: string;
  description: string | null;
  percentageCompleted: number;
  startDate: string | null;
  status: string;
}

interface KPIReview {
  id: string;
  reviewDate: string;
  actualScore: number | null;
  status: string;
  documentPath: string | null;
  documentName: string | null;
  actionPlans: KPIActionPlan[];
}

interface KPI {
  id: string;
  code: string;
  objective: string | null;
  description: string | null;
  dataSource: string | null;
  calculationFormula: string | null;
  expectedScore: number | null;
  actualScore: number | null;
  reviewDate: string | null;
  status: string;
  department?: { id: string; name: string } | null;
  evidence?: { id: string; evidenceCode: string; name: string } | null;
  reviews: KPIReview[];
}

const statusColors: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-800",
  Missed: "bg-red-100 text-red-800",
  Overdue: "bg-orange-100 text-orange-800",
  Achieved: "bg-green-100 text-green-800",
};

const years = ["2028", "2027", "2026", "2025", "2024", "2023", "2022"];

export default function KPIDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    objective: "",
    description: "",
    dataSource: "",
    calculationFormula: "",
    expectedScore: "",
    actualScore: "",
  });

  // Update dialog state
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    actualScore: "",
    reviewId: "",
  });

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);

  // Action Plan dialog state
  const [actionPlanDialogOpen, setActionPlanDialogOpen] = useState(false);
  const [actionPlanReviewId, setActionPlanReviewId] = useState<string | null>(null);
  const [actionPlanForm, setActionPlanForm] = useState({
    plannedAction: "",
    description: "",
    percentageCompleted: "",
    startDate: "",
    status: "In-Progress",
  });

  const fetchKPI = useCallback(async () => {
    try {
      const response = await fetch(`/api/kpis/${id}`);
      if (response.ok) {
        const data = await response.json();
        setKpi(data);
        setFormData({
          objective: data.objective || "",
          description: data.description || "",
          dataSource: data.dataSource || "",
          calculationFormula: data.calculationFormula || "",
          expectedScore: data.expectedScore?.toString() || "",
          actualScore: data.actualScore?.toString() || "",
        });
      }
    } catch (error) {
      console.error("Error fetching KPI:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchKPI();
  }, [fetchKPI]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/kpis/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: formData.objective,
          description: formData.description,
          dataSource: formData.dataSource,
          calculationFormula: formData.calculationFormula,
          expectedScore: formData.expectedScore
            ? parseFloat(formData.expectedScore)
            : null,
          actualScore: formData.actualScore
            ? parseFloat(formData.actualScore)
            : null,
        }),
      });

      if (response.ok) {
        fetchKPI();
      }
    } catch (error) {
      console.error("Error saving KPI:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenUpdateDialog = (review: KPIReview) => {
    setUpdateForm({
      actualScore: review.actualScore?.toString() || "",
      reviewId: review.id,
    });
    setUpdateDialogOpen(true);
  };

  const handleUpdateReview = async () => {
    try {
      const response = await fetch(
        `/api/kpis/${id}/reviews/${updateForm.reviewId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actualScore: updateForm.actualScore
              ? parseFloat(updateForm.actualScore)
              : null,
          }),
        }
      );

      if (response.ok) {
        setUpdateDialogOpen(false);
        fetchKPI();
      }
    } catch (error) {
      console.error("Error updating review:", error);
    }
  };

  const handleDeleteReview = async () => {
    if (!reviewToDelete) return;

    try {
      const response = await fetch(`/api/kpis/${id}/reviews/${reviewToDelete}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setReviewToDelete(null);
        fetchKPI();
      }
    } catch (error) {
      console.error("Error deleting review:", error);
    }
  };

  const handleOpenActionPlanDialog = (reviewId: string) => {
    setActionPlanReviewId(reviewId);
    setActionPlanForm({
      plannedAction: "",
      description: "",
      percentageCompleted: "",
      startDate: "",
      status: "In-Progress",
    });
    setActionPlanDialogOpen(true);
  };

  const handleCreateActionPlan = async () => {
    if (!actionPlanReviewId) return;

    try {
      const response = await fetch(
        `/api/kpis/${id}/reviews/${actionPlanReviewId}/action-plans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plannedAction: actionPlanForm.plannedAction,
            description: actionPlanForm.description,
            percentageCompleted: actionPlanForm.percentageCompleted
              ? parseFloat(actionPlanForm.percentageCompleted)
              : 0,
            startDate: actionPlanForm.startDate,
            status: actionPlanForm.status,
          }),
        }
      );

      if (response.ok) {
        setActionPlanDialogOpen(false);
        setActionPlanReviewId(null);
        fetchKPI();
      }
    } catch (error) {
      console.error("Error creating action plan:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!kpi) {
    return (
      <div className="p-6">
        <p className="text-gray-500">KPI not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/compliance/kpis")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">KPI Detail Page</h1>
            <p className="text-gray-600">View and manage KPI details</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Chart and Form */}
        <div className="space-y-6">
          {/* Year Filter and Chart Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>KPI</CardTitle>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Year</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Chart placeholder - shows monthly data */}
              <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center border">
                <div className="text-center text-gray-500">
                  <p className="text-sm">Monthly KPI Chart</p>
                  <p className="text-xs">Actual Score vs Expected Score</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span>Actual Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded" />
                  <span>Expected Score</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Form */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">KPI Objective</Label>
                  <Input
                    placeholder="Enter Objective"
                    value={formData.objective}
                    onChange={(e) =>
                      setFormData({ ...formData, objective: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">KPI Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">KPI Data Source</Label>
                  <Input
                    placeholder="Enter Data Source"
                    value={formData.dataSource}
                    onChange={(e) =>
                      setFormData({ ...formData, dataSource: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">KPI Calculation Formula</Label>
                  <Input
                    placeholder="Enter the KPI Calculation Formula"
                    value={formData.calculationFormula}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        calculationFormula: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">KPI Expected Score</Label>
                  <Input
                    type="number"
                    value={formData.expectedScore}
                    onChange={(e) =>
                      setFormData({ ...formData, expectedScore: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">KPI Actual Score</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={formData.actualScore}
                      onChange={(e) =>
                        setFormData({ ...formData, actualScore: e.target.value })
                      }
                    />
                    <Button variant="outline" size="icon">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Review History */}
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Review Date</TableHead>
                  <TableHead>Kpi Actual Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpi.reviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-gray-500">No review history found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  kpi.reviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>
                        {new Date(review.reviewDate).toLocaleDateString("en-GB")}
                      </TableCell>
                      <TableCell>{review.actualScore ?? "-"}</TableCell>
                      <TableCell>
                        <Badge
                          className={statusColors[review.status] || "bg-gray-100"}
                        >
                          {review.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {review.documentName ? (
                          <a
                            href={review.documentPath || "#"}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            {review.documentName}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Update Actual score"
                            onClick={() => handleOpenUpdateDialog(review)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => {
                              setReviewToDelete(review.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {review.status === "Missed" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Add Action Plan"
                              onClick={() => handleOpenActionPlanDialog(review.id)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>
                Currently showing 1 to {kpi.reviews.length} of {kpi.reviews.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Update Actual Score Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Actual Score</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-medium">Actual Score</Label>
              <Input
                type="number"
                value={updateForm.actualScore}
                onChange={(e) =>
                  setUpdateForm({ ...updateForm, actualScore: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Upload document</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">
                  Drag and drop or select file.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setUpdateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateReview}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReview}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Action Plan Dialog */}
      <Dialog open={actionPlanDialogOpen} onOpenChange={setActionPlanDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Plan Action</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-medium">
                Planned Action <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Enter planned action"
                value={actionPlanForm.plannedAction}
                onChange={(e) =>
                  setActionPlanForm({
                    ...actionPlanForm,
                    plannedAction: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">Description</Label>
              <Textarea
                placeholder="Enter description"
                value={actionPlanForm.description}
                onChange={(e) =>
                  setActionPlanForm({
                    ...actionPlanForm,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">
                Percentage Completed <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={actionPlanForm.percentageCompleted}
                onChange={(e) =>
                  setActionPlanForm({
                    ...actionPlanForm,
                    percentageCompleted: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">
                Start Date <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="date"
                  value={actionPlanForm.startDate}
                  onChange={(e) =>
                    setActionPlanForm({
                      ...actionPlanForm,
                      startDate: e.target.value,
                    })
                  }
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium">
                Status <span className="text-red-500">*</span>
              </Label>
              <Select
                value={actionPlanForm.status}
                onValueChange={(value) =>
                  setActionPlanForm({ ...actionPlanForm, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In-Progress">In-Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setActionPlanDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateActionPlan}
                disabled={
                  !actionPlanForm.plannedAction ||
                  !actionPlanForm.percentageCompleted ||
                  !actionPlanForm.startDate
                }
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

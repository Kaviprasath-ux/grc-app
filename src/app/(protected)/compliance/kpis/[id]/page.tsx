"use client";

import { useState, useEffect, useCallback, use, useMemo } from "react";
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
import { toast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

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

interface Evidence {
  id: string;
  evidenceCode: string;
  name: string;
  reviewDate: string | null;
  recurrence: string | null;
  kpiExpectedScore: number | null;
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
  evidence?: Evidence | null;
  reviews: KPIReview[];
}

const statusColors: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-800",
  Missed: "bg-red-100 text-red-800",
  Overdue: "bg-orange-100 text-orange-800",
  Achieved: "bg-green-100 text-green-800",
};

// Generate years dynamically (current year + 2 years ahead and 5 years back)
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 8 }, (_, i) => String(currentYear + 2 - i));

/**
 * Calculate next review date based on recurrence type
 * @param currentDate - The current review date
 * @param recurrence - Recurrence type: Weekly, Monthly, Quarterly, Half-yearly, Yearly
 * @returns Next review date
 */
function calculateNextReviewDate(currentDate: Date, recurrence: string | null): Date {
  const next = new Date(currentDate);

  switch (recurrence) {
    case "Weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "Monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "Quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "Half-yearly":
      next.setMonth(next.getMonth() + 6);
      break;
    case "Yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      // Default to monthly if no recurrence specified
      next.setMonth(next.getMonth() + 1);
  }

  return next;
}

/**
 * Calculate status based on actual vs expected score
 * @param actualScore - The actual score entered
 * @param expectedScore - The expected score target
 * @returns "Achieved" if actual >= expected, "Missed" otherwise
 */
function calculateStatus(actualScore: number | null, expectedScore: number | null): string {
  if (actualScore === null || expectedScore === null) {
    return "Scheduled";
  }
  return actualScore >= expectedScore ? "Achieved" : "Missed";
}

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
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

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

  // Add Actual Score dialog state
  const [addScoreDialogOpen, setAddScoreDialogOpen] = useState(false);
  const [addScoreForm, setAddScoreForm] = useState({
    actualScore: "",
  });
  const [addingScore, setAddingScore] = useState(false);

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

  // Calculate next due review date based on Evidence review date + recurrence
  const nextDueReviewDate = useMemo(() => {
    if (!kpi) return null;

    // Get the initial review date from Evidence
    const evidenceReviewDate = kpi.evidence?.reviewDate
      ? new Date(kpi.evidence.reviewDate)
      : null;

    // If no reviews yet, use the Evidence review date as the first due date
    if (kpi.reviews.length === 0) {
      return evidenceReviewDate;
    }

    // Sort reviews by date ascending to get the latest one
    const sortedReviews = [...kpi.reviews].sort(
      (a, b) => new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime()
    );
    const lastReview = sortedReviews[sortedReviews.length - 1];
    const lastReviewDate = new Date(lastReview.reviewDate);

    // Calculate next date based on recurrence
    const recurrence = kpi.evidence?.recurrence || "Monthly";
    return calculateNextReviewDate(lastReviewDate, recurrence);
  }, [kpi]);

  // Get expected score from KPI or Evidence
  const expectedScore = useMemo(() => {
    if (!kpi) return null;
    return kpi.expectedScore ?? kpi.evidence?.kpiExpectedScore ?? null;
  }, [kpi]);

  // Filter reviews by selected year and sort ascending by date
  const filteredReviews = useMemo(() => {
    if (!kpi) return [];

    let reviews = [...kpi.reviews];

    // Filter by year if selected
    if (selectedYear) {
      reviews = reviews.filter((review) => {
        const reviewYear = new Date(review.reviewDate).getFullYear();
        return reviewYear === parseInt(selectedYear);
      });
    }

    // Sort ascending by review date (chronological order)
    return reviews.sort(
      (a, b) => new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime()
    );
  }, [kpi, selectedYear]);

  // Generate chart data from filtered reviews
  const chartData = useMemo(() => {
    if (!filteredReviews.length) return [];

    return filteredReviews.map((review) => {
      const date = new Date(review.reviewDate);
      return {
        date: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        fullDate: review.reviewDate,
        actualScore: review.actualScore,
        expectedScore: expectedScore,
      };
    });
  }, [filteredReviews, expectedScore]);

  // Handle adding new actual score entry
  const handleAddActualScore = async () => {
    if (!nextDueReviewDate || !addScoreForm.actualScore) return;

    setAddingScore(true);
    try {
      const actualScoreValue = parseFloat(addScoreForm.actualScore);
      const calculatedStatus = calculateStatus(actualScoreValue, expectedScore);

      const response = await fetch(`/api/kpis/${id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewDate: nextDueReviewDate.toISOString(),
          actualScore: actualScoreValue,
          status: calculatedStatus,
        }),
      });

      if (response.ok) {
        setAddScoreDialogOpen(false);
        setAddScoreForm({ actualScore: "" });
        toast({
          title: "Success",
          description: "KPI actual score saved successfully.",
        });
        fetchKPI();
      } else {
        toast({
          title: "Error",
          description: "Failed to save KPI actual score.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding actual score:", error);
      toast({
        title: "Error",
        description: "An error occurred while saving.",
        variant: "destructive",
      });
    } finally {
      setAddingScore(false);
    }
  };

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
      const actualScoreValue = updateForm.actualScore
        ? parseFloat(updateForm.actualScore)
        : null;
      const calculatedStatus = calculateStatus(actualScoreValue, expectedScore);

      const response = await fetch(
        `/api/kpis/${id}/reviews/${updateForm.reviewId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actualScore: actualScoreValue,
            status: calculatedStatus,
          }),
        }
      );

      if (response.ok) {
        setUpdateDialogOpen(false);
        toast({
          title: "Success",
          description: "Review updated successfully.",
        });
        fetchKPI();
      } else {
        toast({
          title: "Error",
          description: "Failed to update review.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating review:", error);
      toast({
        title: "Error",
        description: "An error occurred while updating.",
        variant: "destructive",
      });
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
              {/* Line Chart - Actual Score vs Expected Score */}
              <div className="h-64">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          value,
                          name === "actualScore" ? "Actual Score" : "Expected Score",
                        ]}
                        labelFormatter={(label) => `Review Date: ${label}`}
                      />
                      <Legend />
                      {/* Expected Score as horizontal reference line */}
                      {expectedScore !== null && (
                        <ReferenceLine
                          y={expectedScore}
                          stroke="#22c55e"
                          strokeDasharray="5 5"
                          strokeWidth={2}
                          label={{
                            value: `Expected: ${expectedScore}`,
                            fill: "#22c55e",
                            fontSize: 12,
                            position: "right",
                          }}
                        />
                      )}
                      {/* Actual Score line with dots */}
                      <Line
                        type="linear"
                        dataKey="actualScore"
                        name="Actual Score"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 6, fill: "#3b82f6", strokeWidth: 2 }}
                        activeDot={{ r: 8 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full bg-gray-50 rounded-lg flex items-center justify-center border">
                    <div className="text-center text-gray-500">
                      <p className="text-sm">No review data available</p>
                      <p className="text-xs">Add actual scores to see the chart</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span>Actual Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-green-500" style={{ borderStyle: "dashed" }} />
                  <span>Expected Score ({expectedScore ?? "-"})</span>
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
            {/* Next Due Review Date Info and Add Button */}
            <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg border">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Next Due Review Date
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {nextDueReviewDate
                    ? nextDueReviewDate.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "Not scheduled"}
                </p>
                {kpi.evidence?.recurrence && (
                  <p className="text-xs text-gray-500">
                    Recurrence: {kpi.evidence.recurrence}
                  </p>
                )}
              </div>
              <Button
                onClick={() => setAddScoreDialogOpen(true)}
                disabled={!nextDueReviewDate}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Actual Score
              </Button>
            </div>

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
                {filteredReviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-gray-500">No review history found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReviews.map((review) => (
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
                Currently showing 1 to {filteredReviews.length} of {filteredReviews.length}
                {selectedYear && ` (filtered by ${selectedYear})`}
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

      {/* Add Actual Score Dialog */}
      <Dialog open={addScoreDialogOpen} onOpenChange={setAddScoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add KPI Actual Score</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Display Review Date Context */}
            <div className="p-3 bg-gray-50 rounded-lg border">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Review Date</p>
                  <p className="font-medium">
                    {nextDueReviewDate
                      ? nextDueReviewDate.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Expected Score</p>
                  <p className="font-medium">{expectedScore ?? "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Recurrence</p>
                  <p className="font-medium">
                    {kpi?.evidence?.recurrence || "Monthly"}
                  </p>
                </div>
              </div>
            </div>

            {/* Actual Score Input */}
            <div className="space-y-2">
              <Label className="font-medium">
                Actual Score <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                placeholder="Enter actual score"
                value={addScoreForm.actualScore}
                onChange={(e) =>
                  setAddScoreForm({ actualScore: e.target.value })
                }
              />
              {addScoreForm.actualScore && expectedScore !== null && (
                <p className="text-sm">
                  Status:{" "}
                  <Badge
                    className={
                      parseFloat(addScoreForm.actualScore) >= expectedScore
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {parseFloat(addScoreForm.actualScore) >= expectedScore
                      ? "Achieved"
                      : "Missed"}
                  </Badge>
                </p>
              )}
            </div>

            {/* Upload Document (optional) */}
            <div className="space-y-2">
              <Label className="font-medium">Upload Document (Optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">
                  Drag and drop or select file.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setAddScoreDialogOpen(false);
                  setAddScoreForm({ actualScore: "" });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddActualScore}
                disabled={!addScoreForm.actualScore || addingScore}
              >
                {addingScore ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

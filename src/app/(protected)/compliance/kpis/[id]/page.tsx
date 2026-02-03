"use client";

import { useState, useEffect, useCallback, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Pencil, Trash2, Upload, Plus, Calendar, Home, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Scheduled: "bg-info-light text-info-dark",
  Missed: "bg-error-light text-error-dark",
  Overdue: "bg-warning-light text-warning-dark",
  Achieved: "bg-success-light text-success-dark",
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
  const { t } = useLanguage();
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
          title: t("Success"),
          description: t("KPI actual score saved successfully."),
        });
        fetchKPI();
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to save KPI actual score."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding actual score:", error);
      toast({
        title: t("Error"),
        description: t("An error occurred while saving."),
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
          title: t("Success"),
          description: t("Review updated successfully."),
        });
        fetchKPI();
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to update review."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating review:", error);
      toast({
        title: t("Error"),
        description: t("An error occurred while updating."),
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!kpi) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-500">{t("KPI not found")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/compliance/kpis" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("KPIs")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{kpi.code}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("KPI Detail")}</h1>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">{t("KPI Code")}</p>
          <p className="text-sm font-semibold text-slate-800">{kpi.evidence?.evidenceCode || kpi.code}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">{t("Status")}</p>
          <Badge className={statusColors[kpi.status] || "bg-slate-100 text-slate-600"}>
            {t(kpi.status)}
          </Badge>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">{t("Expected Score")}</p>
          <p className="text-sm font-semibold text-slate-800">{expectedScore ?? "-"}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">{t("Actual Score")}</p>
          <p className="text-sm font-semibold text-slate-800">{kpi.actualScore ?? "-"}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-1">{t("Department")}</p>
          <p className="text-sm font-semibold text-slate-800">{kpi.department?.name || kpi.evidence?.name || "-"}</p>
        </div>
      </div>

      {/* Chart and Review History Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">{t("Performance Trend")}</h3>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px] h-9 bg-white border-slate-200">
                <SelectValue placeholder={t("Year")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="h-56">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis domain={[0, "auto"]} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      name === "actualScore" ? t("Actual Score") : t("Expected Score"),
                    ]}
                    labelFormatter={(label) => `${t("Review Date")}: ${label}`}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                  />
                  {expectedScore !== null && (
                    <ReferenceLine
                      y={expectedScore}
                      stroke="#22c55e"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                    />
                  )}
                  <Line
                    type="linear"
                    dataKey="actualScore"
                    name={t("Actual Score")}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 5, fill: "#3b82f6", strokeWidth: 2 }}
                    activeDot={{ r: 7 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full bg-slate-50 rounded-lg flex items-center justify-center border border-slate-200">
                <div className="text-center text-slate-500">
                  <p className="text-sm">{t("No review data available")}</p>
                  <p className="text-xs mt-1">{t("Add actual scores to see the chart")}</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-info rounded-full" />
              <span className="text-xs text-slate-600">{t("Actual Score")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-0 border-t-2 border-dashed border-success" />
              <span className="text-xs text-slate-600">{t("Expected")} ({expectedScore ?? "-"})</span>
            </div>
          </div>
        </div>

        {/* Next Review & Quick Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-base font-semibold text-slate-800 mb-4">{t("Next Review")}</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-1">{t("Due Date")}</p>
              <p className="text-lg font-semibold text-slate-800">
                {nextDueReviewDate
                  ? nextDueReviewDate.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : t("Not scheduled")}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-1">{t("Recurrence")}</p>
              <p className="text-lg font-semibold text-slate-800">
                {t(kpi.evidence?.recurrence || "Monthly")}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setAddScoreDialogOpen(true)}
            disabled={!nextDueReviewDate}
            className="w-full bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Add Actual Score")}
          </Button>
        </div>
      </div>

      {/* KPI Details Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-800 mb-4">{t("KPI Details")}</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500">{t("KPI Objective")}</Label>
            <Input
              placeholder={t("Enter Objective")}
              value={formData.objective}
              onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
              className="h-9 border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500">{t("KPI Description")}</Label>
            <Input
              placeholder={t("Enter Description")}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="h-9 border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500">{t("Data Source")}</Label>
            <Input
              placeholder={t("Enter Data Source")}
              value={formData.dataSource}
              onChange={(e) => setFormData({ ...formData, dataSource: e.target.value })}
              className="h-9 border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500">{t("Calculation Formula")}</Label>
            <Input
              placeholder={t("Enter Formula")}
              value={formData.calculationFormula}
              onChange={(e) => setFormData({ ...formData, calculationFormula: e.target.value })}
              className="h-9 border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500">{t("Expected Score")}</Label>
            <Input
              type="number"
              placeholder="0"
              value={formData.expectedScore}
              onChange={(e) => setFormData({ ...formData, expectedScore: e.target.value })}
              className="h-9 border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500">{t("Actual Score")}</Label>
            <Input
              type="number"
              placeholder="0"
              value={formData.actualScore}
              onChange={(e) => setFormData({ ...formData, actualScore: e.target.value })}
              className="h-9 border-slate-200"
            />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-primary-600 hover:bg-primary-700">
            {saving ? t("Saving...") : t("Save Changes")}
          </Button>
        </div>
      </div>

      {/* Review History Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">{t("Review History")}</h3>
          <span className="text-xs text-slate-500">
            {selectedYear && `${t("Filtered by")} ${selectedYear}`}
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 py-3 pl-4">{t("Review Date")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">{t("Actual Score")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">{t("Status")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3">{t("Document")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-3 text-right pr-4">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="text-slate-400">
                    <Calendar className="h-10 w-10 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">{t("No review history found")}</p>
                    <p className="text-xs text-slate-400 mt-1">{t("Add your first actual score to start tracking")}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredReviews.map((review) => (
                <TableRow key={review.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 pl-4">
                    {new Date(review.reviewDate).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{review.actualScore ?? "-"}</TableCell>
                  <TableCell className="py-3 text-sm">
                    <Badge className={statusColors[review.status] || "bg-slate-100 text-slate-600"}>
                      {t(review.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-sm">
                    {review.documentName ? (
                      <a href={review.documentPath || "#"} className="text-primary-600 hover:underline">
                        {review.documentName}
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-sm pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t("Edit")}
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => handleOpenUpdateDialog(review)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t("Delete")}
                        className="h-8 w-8 text-slate-400 hover:text-error"
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
                          title={t("Add Action Plan")}
                          className="h-8 w-8 text-slate-400 hover:text-primary-600"
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-sm text-slate-500">
            {t("Showing")} {filteredReviews.length} {filteredReviews.length === 1 ? t("entry") : t("entries")}
          </span>
        </div>
      </div>

      {/* Update Actual Score Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Update Actual Score")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Actual Score")}</Label>
                <Input
                  type="number"
                  value={updateForm.actualScore}
                  onChange={(e) =>
                    setUpdateForm({ ...updateForm, actualScore: e.target.value })
                  }
                  className="h-9 border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Upload document")}</Label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500">
                    {t("Drag and drop or select file.")}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => setUpdateDialogOpen(false)}
              className="border-slate-200"
            >
              {t("Cancel")}
            </Button>
            <Button onClick={handleUpdateReview} className="bg-primary-600 hover:bg-primary-700">{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Confirmation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReview}>{t("OK")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Action Plan Dialog */}
      <Dialog open={actionPlanDialogOpen} onOpenChange={setActionPlanDialogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Update Plan Action")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Planned Action")} <span className="text-error">*</span>
                </Label>
                <Input
                  placeholder={t("Enter planned action")}
                  value={actionPlanForm.plannedAction}
                  onChange={(e) =>
                    setActionPlanForm({
                      ...actionPlanForm,
                      plannedAction: e.target.value,
                    })
                  }
                  className="h-9 border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                <Textarea
                  placeholder={t("Enter description")}
                  value={actionPlanForm.description}
                  onChange={(e) =>
                    setActionPlanForm({
                      ...actionPlanForm,
                      description: e.target.value,
                    })
                  }
                  className="border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Percentage Completed")} <span className="text-error">*</span>
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
                  className="h-9 border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Start Date")} <span className="text-error">*</span>
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
                    className="h-9 border-slate-200"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Status")} <span className="text-error">*</span>
                </Label>
                <Select
                  value={actionPlanForm.status}
                  onValueChange={(value) =>
                    setActionPlanForm({ ...actionPlanForm, status: value })
                  }
                >
                  <SelectTrigger className="h-9 bg-white border-slate-200">
                    <SelectValue placeholder={t("Select status")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="Open">{t("Open")}</SelectItem>
                    <SelectItem value="In-Progress">{t("In-Progress")}</SelectItem>
                    <SelectItem value="Completed">{t("Completed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => setActionPlanDialogOpen(false)}
              className="border-slate-200"
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleCreateActionPlan}
              disabled={
                !actionPlanForm.plannedAction ||
                !actionPlanForm.percentageCompleted ||
                !actionPlanForm.startDate
              }
              className="bg-primary-600 hover:bg-primary-700"
            >
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Actual Score Dialog */}
      <Dialog open={addScoreDialogOpen} onOpenChange={setAddScoreDialogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add KPI Actual Score")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-4">
              {/* Display Review Date Context */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">{t("Review Date")}</p>
                    <p className="font-medium text-slate-800">
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
                    <p className="text-slate-500">{t("Expected Score")}</p>
                    <p className="font-medium text-slate-800">{expectedScore ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{t("Recurrence")}</p>
                    <p className="font-medium text-slate-800">
                      {t(kpi?.evidence?.recurrence || "Monthly")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actual Score Input */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Actual Score")} <span className="text-error">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder={t("Enter actual score")}
                  value={addScoreForm.actualScore}
                  onChange={(e) =>
                    setAddScoreForm({ actualScore: e.target.value })
                  }
                  className="h-9 border-slate-200"
                />
                {addScoreForm.actualScore && expectedScore !== null && (
                  <p className="text-sm">
                    {t("Status")}:{" "}
                    <Badge
                      className={
                        parseFloat(addScoreForm.actualScore) >= expectedScore
                          ? "bg-success-light text-success-dark"
                          : "bg-error-light text-error-dark"
                      }
                    >
                      {parseFloat(addScoreForm.actualScore) >= expectedScore
                        ? t("Achieved")
                        : t("Missed")}
                    </Badge>
                  </p>
                )}
              </div>

              {/* Upload Document (optional) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Upload Document (Optional)")}</Label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500">
                    {t("Drag and drop or select file.")}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setAddScoreDialogOpen(false);
                setAddScoreForm({ actualScore: "" });
              }}
              className="border-slate-200"
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleAddActualScore}
              disabled={!addScoreForm.actualScore || addingScore}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {addingScore ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

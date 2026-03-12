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
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Upload, Plus, Calendar, Home, ChevronRight, Save, Eye } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedRecord, useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
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
  approvalStatus: string; // Draft, Submitted, Approved, Sent Back
  approvalComments: string | null;
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Update dialog state
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    actualScore: "",
    reviewId: "",
  });
  const [updateFile, setUpdateFile] = useState<File | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);

  // Action Plan dialog state
  const [actionPlanDialogOpen, setActionPlanDialogOpen] = useState(false);
  const [actionPlanReviewId, setActionPlanReviewId] = useState<string | null>(null);
  const [viewActionPlanDialogOpen, setViewActionPlanDialogOpen] = useState(false);
  const [viewActionPlans, setViewActionPlans] = useState<KPIActionPlan[]>([]);
  const [viewActionPlanReviewId, setViewActionPlanReviewId] = useState<string | null>(null);
  const [sendBackDialogOpen, setSendBackDialogOpen] = useState(false);
  const [sendBackPlanId, setSendBackPlanId] = useState<string | null>(null);
  const [sendBackComment, setSendBackComment] = useState("");
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
  const [addScoreFile, setAddScoreFile] = useState<File | null>(null);
  const [addingScore, setAddingScore] = useState(false);

  // Inline actual score save state
  const [savingInlineScore, setSavingInlineScore] = useState(false);

  // Dynamic translations
  const { data: translatedKpi } = useTranslatedRecord(kpi, { modelName: 'KPI' });
  const deptArray = useMemo(() => {
    const dept = kpi?.department;
    return dept ? [dept] : [];
  }, [kpi?.department]);
  const { data: translatedDepts } = useTranslatedData(deptArray, { modelName: 'Department' });
  const translatedDeptName = translatedDepts[0]?.name || kpi?.department?.name;

  // Populate form with translated KPI values when translations load
  useEffect(() => {
    if (translatedKpi && kpi) {
      setFormData(prev => ({
        ...prev,
        objective: translatedKpi.objective || prev.objective,
        description: translatedKpi.description || prev.description,
        dataSource: translatedKpi.dataSource || prev.dataSource,
        calculationFormula: translatedKpi.calculationFormula || prev.calculationFormula,
      }));
    }
  }, [translatedKpi?.objective, translatedKpi?.description, translatedKpi?.dataSource, translatedKpi?.calculationFormula, kpi?.id]);

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
          expectedScore: data.evidence?.kpiExpectedScore != null
            ? data.evidence.kpiExpectedScore.toString()
            : "",
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

  // Get expected score from Evidence record (source of truth)
  const expectedScore = useMemo(() => {
    if (!kpi) return null;
    return kpi.evidence?.kpiExpectedScore ?? null;
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
      };
    });
  }, [filteredReviews]);

  // Handle adding new actual score entry
  const handleAddActualScore = async () => {
    if (!nextDueReviewDate || !addScoreForm.actualScore) return;

    setAddingScore(true);
    try {
      const actualScoreValue = parseFloat(addScoreForm.actualScore);
      const calculatedStatus = calculateStatus(actualScoreValue, expectedScore);

      let documentPath: string | undefined;
      let documentName: string | undefined;

      // Upload file if selected
      if (addScoreFile) {
        const formData = new FormData();
        formData.append("file", addScoreFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          documentPath = uploadData.file?.filePath;
          documentName = addScoreFile.name;
        }
      }

      const response = await fetch(`/api/kpis/${id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewDate: nextDueReviewDate.toISOString(),
          actualScore: actualScoreValue,
          status: calculatedStatus,
          ...(documentPath && { documentPath }),
          ...(documentName && { documentName }),
        }),
      });

      if (response.ok) {
        setAddScoreDialogOpen(false);
        setAddScoreForm({ actualScore: "" });
        setAddScoreFile(null);
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

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.objective?.trim()) {
      errors.objective = t("KPI Objective cannot be empty");
    }
    if (!formData.dataSource?.trim()) {
      errors.dataSource = t("Data Source cannot be empty");
    }
    if (!formData.expectedScore?.trim()) {
      errors.expectedScore = t("KPI Expected Score cannot be empty");
    }
    if (!formData.description?.trim()) {
      errors.description = t("KPI Description cannot be empty");
    }
    if (!formData.calculationFormula?.trim()) {
      errors.calculationFormula = t("KPI Calculation Formula cannot be empty");
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: "" });
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const newExpectedScore = formData.expectedScore !== ""
        ? parseFloat(formData.expectedScore)
        : null;
      const newActualScore = formData.actualScore !== ""
        ? parseFloat(formData.actualScore)
        : null;
      const calculatedStatus = calculateStatus(newActualScore, newExpectedScore);

      // Update KPI details with calculated status
      const response = await fetch(`/api/kpis/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objective: formData.objective,
          description: formData.description,
          dataSource: formData.dataSource,
          calculationFormula: formData.calculationFormula,
          expectedScore: newExpectedScore,
          actualScore: newActualScore,
          status: calculatedStatus,
        }),
      });

      // Also update the Evidence record's kpiExpectedScore (source of truth)
      if (response.ok && kpi?.evidence?.id) {
        await fetch(`/api/evidences/${kpi.evidence.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kpiExpectedScore: newExpectedScore,
          }),
        });
      }

      // If actual score is provided, also create a review record for history
      if (response.ok && newActualScore !== null) {
        await fetch(`/api/kpis/${id}/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewDate: new Date().toISOString(),
            actualScore: newActualScore,
            status: calculatedStatus,
          }),
        });
      }

      if (response.ok) {
        // Trigger translation for KPI fields
        triggerTranslation('KPI', id, {
          objective: formData.objective,
          description: formData.description,
          dataSource: formData.dataSource,
          calculationFormula: formData.calculationFormula,
        });
        toast({
          title: t("Success"),
          description: t("KPI details saved successfully."),
        });
        fetchKPI();
      }
    } catch (error) {
      console.error("Error saving KPI:", error);
      toast({
        title: t("Error"),
        description: t("Failed to save KPI details."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Save actual score inline and create new review record
  const handleSaveInlineActualScore = async () => {
    if (!formData.actualScore) {
      toast({
        title: t("Error"),
        description: t("Please enter an actual score."),
        variant: "destructive",
      });
      return;
    }

    setSavingInlineScore(true);
    try {
      const actualScoreValue = parseFloat(formData.actualScore);
      const calculatedStatus = calculateStatus(actualScoreValue, expectedScore);

      // Create new review record
      const response = await fetch(`/api/kpis/${id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewDate: new Date().toISOString(),
          actualScore: actualScoreValue,
          status: calculatedStatus,
        }),
      });

      if (response.ok) {
        // Also update the KPI's actualScore
        await fetch(`/api/kpis/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actualScore: actualScoreValue,
            status: calculatedStatus,
          }),
        });

        toast({
          title: t("Success"),
          description: t("Actual score saved and added to review history."),
        });
        setFormData({ ...formData, actualScore: "" });
        fetchKPI();
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to save actual score."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving inline actual score:", error);
      toast({
        title: t("Error"),
        description: t("An error occurred while saving."),
        variant: "destructive",
      });
    } finally {
      setSavingInlineScore(false);
    }
  };

  const handleOpenUpdateDialog = (review: KPIReview) => {
    setUpdateForm({
      actualScore: review.actualScore?.toString() || "",
      reviewId: review.id,
    });
    setUpdateFile(null);
    setUpdateDialogOpen(true);
  };

  const handleUpdateReview = async () => {
    try {
      const actualScoreValue = updateForm.actualScore
        ? parseFloat(updateForm.actualScore)
        : null;
      const calculatedStatus = calculateStatus(actualScoreValue, expectedScore);

      let documentPath: string | undefined;
      let documentName: string | undefined;

      // Upload file if selected
      if (updateFile) {
        const formData = new FormData();
        formData.append("file", updateFile);
        formData.append("subDir", "kpi-reviews");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          documentPath = uploadData.file?.filePath;
          documentName = updateFile.name;
        }
      }

      const response = await fetch(
        `/api/kpis/${id}/reviews/${updateForm.reviewId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actualScore: actualScoreValue,
            status: calculatedStatus,
            ...(documentPath && { documentPath }),
            ...(documentName && { documentName }),
          }),
        }
      );

      if (response.ok) {
        setUpdateDialogOpen(false);
        setUpdateFile(null);
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

  // Update action plan fields (editable in Draft/Sent Back state)
  const handleUpdateActionPlan = async (planId: string, data: Record<string, unknown>) => {
    if (!viewActionPlanReviewId) return;
    try {
      const response = await fetch(
        `/api/kpis/${id}/reviews/${viewActionPlanReviewId}/action-plans/${planId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (response.ok) {
        fetchKPI();
        // Refresh view action plans
        const updatedPlan = await response.json();
        setViewActionPlans(prev => prev.map(p => p.id === planId ? { ...p, ...updatedPlan } : p));
      }
    } catch (error) {
      console.error("Error updating action plan:", error);
    }
  };

  const handleSubmitForApproval = async (planId: string) => {
    await handleUpdateActionPlan(planId, { approvalStatus: "Submitted" });
  };

  const handleApproveActionPlan = async (planId: string) => {
    await handleUpdateActionPlan(planId, { approvalStatus: "Approved" });
  };

  const handleSendBack = async () => {
    if (!sendBackPlanId || !sendBackComment.trim()) return;
    await handleUpdateActionPlan(sendBackPlanId, {
      approvalStatus: "Sent Back",
      approvalComments: sendBackComment.trim(),
    });
    setSendBackDialogOpen(false);
    setSendBackPlanId(null);
    setSendBackComment("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
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
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/compliance/kpis" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("KPIs")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{kpi.code}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("KPI Detail")}</h1>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{t("KPI Code")}</p>
          <p className="text-sm font-semibold text-slate-800">{kpi.code}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{t("Status")}</p>
          <Badge className={statusColors[kpi.status] || "bg-slate-100 text-slate-600"}>
            {t(kpi.status)}
          </Badge>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{t("Expected Score")}</p>
          <p className="text-sm font-semibold text-slate-800">{expectedScore ?? "-"}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{t("Actual Score")}</p>
          <p className="text-sm font-semibold text-slate-800">{kpi.actualScore ?? "-"}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{t("Department")}</p>
          <p className="text-sm font-semibold text-slate-800">{translatedDeptName || kpi.evidence?.name || "-"}</p>
        </div>
      </div>

      {/* Chart and Review History Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Chart Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-800">{t("Performance Trend")}</h3>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full sm:w-[120px] h-9 bg-white border-slate-200">
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
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5">
          <h3 className="text-base font-semibold text-slate-800 mb-4">{t("Next Review")}</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{t("Due Date")}</p>
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
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{t("Recurrence")}</p>
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
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5">
        <h3 className="text-base font-semibold text-slate-800 mb-4">{t("KPI Details")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {t("KPI Objective")} <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder={t("Enter Objective")}
              value={formData.objective}
              onChange={(e) => handleFieldChange("objective", e.target.value)}
              className={`h-9 ${formErrors.objective ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : "border-slate-200"}`}
            />
            {formErrors.objective && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.objective}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {t("KPI Data Source")} <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder={t("Enter Data Source")}
              value={formData.dataSource}
              onChange={(e) => handleFieldChange("dataSource", e.target.value)}
              className={`h-9 ${formErrors.dataSource ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : "border-slate-200"}`}
            />
            {formErrors.dataSource && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.dataSource}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {t("KPI Expected Score (%)")} <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              placeholder={t("Enter expected score")}
              value={formData.expectedScore}
              onChange={(e) => handleFieldChange("expectedScore", e.target.value)}
              disabled={expectedScore !== null}
              className={`h-9 ${expectedScore !== null ? "bg-slate-100 cursor-not-allowed" : ""} ${formErrors.expectedScore ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : "border-slate-200"}`}
            />
            {formErrors.expectedScore && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.expectedScore}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {t("KPI Description")} <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder={t("Enter KPI Description")}
              value={formData.description}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              className={`h-9 ${formErrors.description ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : "border-slate-200"}`}
            />
            {formErrors.description && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.description}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {t("KPI Calculation Formula")} <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder={t("Enter the KPI Calculation Formula")}
              value={formData.calculationFormula}
              onChange={(e) => handleFieldChange("calculationFormula", e.target.value)}
              className={`h-9 ${formErrors.calculationFormula ? "border-red-400 bg-red-50 focus-visible:ring-red-300" : "border-slate-200"}`}
            />
            {formErrors.calculationFormula && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded">{formErrors.calculationFormula}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {t("KPI Actual Score")} <span className="text-error">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="0"
                value={formData.actualScore}
                onChange={(e) => setFormData({ ...formData, actualScore: e.target.value })}
                className="h-9 border-slate-200"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleSaveInlineActualScore}
                disabled={savingInlineScore || !formData.actualScore}
                className="h-9 w-9 border-slate-200 hover:bg-primary-50 hover:border-primary-300"
                title={t("Save Actual Score")}
              >
                {savingInlineScore ? (
                  <div className="h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="h-4 w-4 text-primary-600" />
                )}
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex ltr:justify-end rtl:justify-start">
          <Button onClick={handleSave} disabled={saving} className="bg-primary-600 hover:bg-primary-700">
            {saving ? t("Saving...") : t("Save Changes")}
          </Button>
        </div>
      </div>

      {/* Review History Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">{t("Review History")}</h3>
          <span className="text-xs text-slate-500">
            {selectedYear && `${t("Filtered by")} ${selectedYear}`}
          </span>
        </div>
        <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider pl-5">{t("Review Date")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Actual Score")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Document")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider text-right pr-5">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReviews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
                      <Calendar className="h-6 w-6 text-primary-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-800">{t("No review history found")}</p>
                    <p className="text-xs text-slate-500 mt-1">{t("Add your first actual score to start tracking")}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredReviews.map((review) => (
                <TableRow key={review.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5">
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
                  <TableCell className="py-3 text-sm pr-5">
                    <div className="flex items-center ltr:justify-end rtl:justify-start gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t("Edit")}
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                        onClick={() => handleOpenUpdateDialog(review)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t("Delete")}
                        className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                        onClick={() => {
                          setReviewToDelete(review.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      {review.status === "Missed" && (
                        review.actionPlans?.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("View Action Plan")}
                            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                            onClick={() => {
                              setViewActionPlans(review.actionPlans);
                              setViewActionPlanReviewId(review.id);
                              setViewActionPlanDialogOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("Add Action Plan")}
                            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                            onClick={() => handleOpenActionPlanDialog(review.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        )
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {t("Showing")} {filteredReviews.length} {filteredReviews.length === 1 ? t("entry") : t("entries")}
          </span>
        </div>
      </div>

      {/* Update Actual Score Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Update Actual Score")}</DialogTitle>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Actual Score")}</Label>
              <Input
                type="number"
                value={updateForm.actualScore}
                onChange={(e) =>
                  setUpdateForm({ ...updateForm, actualScore: e.target.value })
                }
                className="h-9 border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Upload document")}</Label>
              <label className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors block">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setUpdateFile(file);
                  }}
                />
                {updateFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <Upload className="h-5 w-5 text-primary-500" />
                    <p className="text-sm text-primary-700 font-medium">{updateFile.name}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">
                      {t("Drag and drop or select file.")}
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
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
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <AlertDialogTitle className="text-base font-semibold text-slate-800">{t("Confirmation")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete this?")}
            </AlertDialogDescription>
          </div>
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel className="border-slate-200">{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReview} className="bg-semantic-error hover:bg-red-600">{t("Delete")}</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Action Plan Dialog */}
      <Dialog open={actionPlanDialogOpen} onOpenChange={setActionPlanDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Update Plan Action")}</DialogTitle>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Description")}</Label>
              <Textarea
                placeholder={t("Enter description")}
                value={actionPlanForm.description}
                onChange={(e) =>
                  setActionPlanForm({
                    ...actionPlanForm,
                    description: e.target.value,
                  })
                }
                className="border-slate-200 focus-visible:ring-2 focus-visible:ring-primary-500/20 focus-visible:ring-offset-0 focus-visible:border-primary-300"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("Start Date")} <span className="text-error">*</span>
              </Label>
              <DatePicker
                value={actionPlanForm.startDate || undefined}
                onChange={(date) =>
                  setActionPlanForm({
                    ...actionPlanForm,
                    startDate: date ? format(date, "yyyy-MM-dd") : "",
                  })
                }
                placeholder={t("Select date")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("Status")} <span className="text-error">*</span>
              </Label>
              <Select
                value={actionPlanForm.status}
                onValueChange={(value) =>
                  setActionPlanForm({ ...actionPlanForm, status: value })
                }
              >
                <SelectTrigger className="w-full h-9 bg-white border-slate-200">
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
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
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

      {/* View Action Plan Dialog */}
      <Dialog open={viewActionPlanDialogOpen} onOpenChange={setViewActionPlanDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Action Plan Details")}</DialogTitle>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {viewActionPlans.map((plan, idx) => {
              const isEditable = !plan.approvalStatus || plan.approvalStatus === "Draft" || plan.approvalStatus === "Sent Back";
              const isSubmitted = plan.approvalStatus === "Submitted";
              const isApproved = plan.approvalStatus === "Approved";

              return (
                <div key={plan.id} className="bg-slate-50 rounded-lg p-4 space-y-3">
                  {viewActionPlans.length > 1 && (
                    <p className="text-xs font-semibold text-slate-400 uppercase">{t("Action")} {idx + 1}</p>
                  )}
                  {/* Approval Status Badge */}
                  <div className="flex items-center gap-2">
                    <Badge className={
                      isApproved ? "bg-green-100 text-green-800" :
                      isSubmitted ? "bg-blue-100 text-blue-800" :
                      plan.approvalStatus === "Sent Back" ? "bg-red-100 text-red-800" :
                      "bg-slate-100 text-slate-600"
                    }>
                      {t(plan.approvalStatus || "Draft")}
                    </Badge>
                  </div>
                  {/* Sent Back Comments */}
                  {plan.approvalStatus === "Sent Back" && plan.approvalComments && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">{t("Send Back Comments")}</p>
                      <p className="text-sm text-red-800">{plan.approvalComments}</p>
                    </div>
                  )}
                  {/* Fields */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Planned Action")}</Label>
                    <Input
                      value={plan.plannedAction}
                      disabled={!isEditable}
                      onChange={(e) => setViewActionPlans(prev => prev.map(p => p.id === plan.id ? { ...p, plannedAction: e.target.value } : p))}
                      className={`h-9 ${!isEditable ? "bg-slate-100 cursor-not-allowed" : "border-slate-200"}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Description")}</Label>
                    <Textarea
                      value={plan.description || ""}
                      disabled={!isEditable}
                      onChange={(e) => setViewActionPlans(prev => prev.map(p => p.id === plan.id ? { ...p, description: e.target.value } : p))}
                      className={!isEditable ? "bg-slate-100 cursor-not-allowed" : "border-slate-200"}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Progress")} (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={plan.percentageCompleted}
                        disabled={!isEditable}
                        onChange={(e) => setViewActionPlans(prev => prev.map(p => p.id === plan.id ? { ...p, percentageCompleted: parseFloat(e.target.value) || 0 } : p))}
                        className={`h-9 ${!isEditable ? "bg-slate-100 cursor-not-allowed" : "border-slate-200"}`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Start Date")}</Label>
                      <Input
                        type="date"
                        value={plan.startDate ? new Date(plan.startDate).toISOString().split("T")[0] : ""}
                        disabled={!isEditable}
                        onChange={(e) => setViewActionPlans(prev => prev.map(p => p.id === plan.id ? { ...p, startDate: e.target.value } : p))}
                        className={`h-9 ${!isEditable ? "bg-slate-100 cursor-not-allowed" : "border-slate-200"}`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</Label>
                      <Select
                        value={plan.status}
                        disabled={!isEditable}
                        onValueChange={(value) => setViewActionPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: value } : p))}
                      >
                        <SelectTrigger className={`w-full h-9 ${!isEditable ? "bg-slate-100 cursor-not-allowed" : "bg-white border-slate-200"}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value="Open">{t("Open")}</SelectItem>
                          <SelectItem value="In-Progress">{t("In-Progress")}</SelectItem>
                          <SelectItem value="Completed">{t("Completed")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    {/* Save button - only when editable */}
                    {isEditable && (
                      <Button
                        size="sm"
                        className="bg-primary-600 hover:bg-primary-700"
                        onClick={() => handleUpdateActionPlan(plan.id, {
                          plannedAction: plan.plannedAction,
                          description: plan.description,
                          percentageCompleted: plan.percentageCompleted,
                          startDate: plan.startDate,
                          status: plan.status,
                        })}
                      >
                        {t("Save")}
                      </Button>
                    )}
                    {/* Submit for Approval - visible in Draft or Sent Back */}
                    {isEditable && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        onClick={() => handleSubmitForApproval(plan.id)}
                      >
                        {t("Submit for Approval")}
                      </Button>
                    )}
                    {/* Approve - visible only when Submitted */}
                    {isSubmitted && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleApproveActionPlan(plan.id)}
                      >
                        {t("Approve")}
                      </Button>
                    )}
                    {/* Send Back - visible only when Submitted */}
                    {isSubmitted && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setSendBackPlanId(plan.id);
                          setSendBackComment("");
                          setSendBackDialogOpen(true);
                        }}
                      >
                        {t("Send Back")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center ltr:justify-end rtl:justify-start px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setViewActionPlanDialogOpen(false)} className="border-slate-200">
              {t("Close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Back Comment Dialog */}
      <Dialog open={sendBackDialogOpen} onOpenChange={setSendBackDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md p-0 gap-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Send Back Action Plan")}</DialogTitle>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("Comments")} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder={t("Enter reason for sending back...")}
                value={sendBackComment}
                onChange={(e) => setSendBackComment(e.target.value)}
                className="border-slate-200 min-h-[100px]"
              />
            </div>
          </div>
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setSendBackDialogOpen(false)} className="border-slate-200">
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleSendBack}
              disabled={!sendBackComment.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t("Send Back")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Actual Score Dialog */}
      <Dialog open={addScoreDialogOpen} onOpenChange={setAddScoreDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Add KPI Actual Score")}</DialogTitle>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-4">
            {/* Display Review Date Context */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Review Date")}</p>
                  <p className="font-medium text-slate-800 mt-1">
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
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Expected Score")}</p>
                  <p className="font-medium text-slate-800 mt-1">{expectedScore ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Recurrence")}</p>
                  <p className="font-medium text-slate-800 mt-1">
                    {t(kpi?.evidence?.recurrence || "Monthly")}
                  </p>
                </div>
              </div>
            </div>

            {/* Actual Score Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Upload Document (Optional)")}</Label>
              <label className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors block">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setAddScoreFile(file);
                  }}
                />
                {addScoreFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <Upload className="h-5 w-5 text-primary-500" />
                    <p className="text-sm text-primary-700 font-medium">{addScoreFile.name}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500">
                      {t("Drag and drop or select file.")}
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
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

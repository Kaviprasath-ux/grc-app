"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDown, ArrowLeft, Plus, Home, ChevronRight, Link2, Trash2, Pencil, Unlink } from "lucide-react";
import Link from "next/link";
import { AddControlDialog } from "@/components/risks/add-control-dialog";
import { ChooseControlDialog } from "@/components/risks/choose-control-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ActivityLog {
  id: string;
  activity: string;
  description: string | null;
  actor: string;
  createdAt: string;
}

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskRating: string;
  status: string;
  responseStrategy: string | null;
  treatmentPlan: string | null;
  treatmentDueDate: string | null;
  likelihood: number;
  impact: number;
  riskScore: number;
  inherentRiskScore: number | null;
  residualRiskScore: number | null;
  owner: { fullName: string } | null;
  assessmentStatus?: string;
  responseStatus?: string; // Separate status for Risk Response Strategy workflow
  activityLogs?: ActivityLog[];
  controlRisks?: { control: { id: string; controlCode: string; name: string; description: string | null; relativeControlWeighting: number | null }; controlStrength: { id: string; name: string; score: number } | null }[];
}

interface Control {
  id: string;
  controlId: string;
  name: string;
  description: string | null;
  effectiveness: number;
}

interface PlannedAction {
  id: string;
  plannedAction: string;
  description: string | null;
  percentageCompleted: number;
  startDate: string | null;
  status: string;
}

interface PlannedControl {
  id: string;
  controlId: string;
  controlCode?: string;
  name: string;
  description: string | null;
  domain?: string;
  functionalGrouping?: string;
  relativeControlWeighting?: string | null;
  estimatedBudget?: number;
  startDate?: string | null;
  targetDate?: string | null;
  status?: string;
  completionPercentage?: number;
  amountUsed?: number;
  remarks?: string | null;
  plannedActions?: PlannedAction[];
}

export default function RiskViewPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { canEdit, canApprove } = usePermissions('risk.response');
  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);
  const [controls, setControls] = useState<Control[]>([]);
  const [expandedControls, setExpandedControls] = useState<string[]>([]);
  const [plannedControls, setPlannedControls] = useState<PlannedControl[]>([]);
  const [expandedPlannedControls, setExpandedPlannedControls] = useState<string[]>([]);
  const [addControlOpen, setAddControlOpen] = useState(false);
  const [chooseControlOpen, setChooseControlOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Planned action dialog states
  const [addActionOpen, setAddActionOpen] = useState(false);
  const [activeControlId, setActiveControlId] = useState<string | null>(null);
  const [actionForm, setActionForm] = useState({ plannedAction: "", description: "", percentageCompleted: "0", startDate: "", status: "Open" });
  const [savingAction, setSavingAction] = useState(false);
  // Per-control bottom form states
  const [controlFormData, setControlFormData] = useState<Record<string, { status: string; completionPercentage: string; amountUsed: string; remarks: string }>>({});
  const [savingControlUpdate, setSavingControlUpdate] = useState<string | null>(null);

  // Edit control details dialog states
  const [editControlOpen, setEditControlOpen] = useState(false);
  const [editControlId, setEditControlId] = useState<string | null>(null);
  const [editControlForm, setEditControlForm] = useState({ startDate: "", targetDate: "", estimatedBudget: "", relativeControlWeighting: "" });
  const [savingControlEdit, setSavingControlEdit] = useState(false);
  const [editControlErrors, setEditControlErrors] = useState<{ startDate?: string; targetDate?: string }>({});

  // Risk Treatment chart calculation
  const treatmentChartData = useMemo(() => {
    // plannedControls are already the planned controls linked to this risk
    const totalPlanned = plannedControls.length;

    // Sum completion percentages (only for controls that have a value)
    let sum = 0;
    for (const ctrl of plannedControls) {
      if (ctrl.completionPercentage != null && ctrl.completionPercentage !== undefined) {
        sum += Number(ctrl.completionPercentage) || 0;
      }
    }

    // Count by status
    const completedCount = plannedControls.filter(c => c.status === "Completed").length;
    const inProgressCount = plannedControls.filter(c => c.status === "In-Progress").length;
    const openCount = plannedControls.filter(c => c.status === "Open").length;

    // Average = sum / totalPlanned (or 0 if sum is 0)
    const average = sum !== 0 ? Math.round(sum / totalPlanned) : 0;

    // Budget calculation: sum estimatedBudget and amountUsed across all planned controls
    let totalEstimatedBudget = 0;
    let totalAmountUsed = 0;
    for (const ctrl of plannedControls) {
      totalEstimatedBudget += Number(ctrl.estimatedBudget) || 0;
      totalAmountUsed += Number(ctrl.amountUsed) || 0;
    }
    const remainingBudget = totalEstimatedBudget - totalAmountUsed;

    return {
      average,
      completedCount,
      inProgressCount,
      openCount,
      totalPlanned,
      totalEstimatedBudget,
      totalAmountUsed,
      remainingBudget,
    };
  }, [plannedControls]);

  // Send Back dialog states
  const [showSendBackDialog, setShowSendBackDialog] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("");
  const [processingSendBack, setProcessingSendBack] = useState(false);

  // Approve state
  const [approving, setApproving] = useState(false);
  const [controlStrengths, setControlStrengths] = useState<{ id: string; name: string; score: number }[]>([]);

  useEffect(() => {
    if (params.id) {
      fetchRisk(params.id as string);
      fetchPlannedControls(params.id as string);
      fetch("/api/control-strengths").then(r => r.ok ? r.json() : []).then(setControlStrengths).catch(() => {});
    }
  }, [params.id]);

  const fetchPlannedControls = async (riskId: string) => {
    try {
      const response = await fetch(`/api/risks/${riskId}/planned-controls`);
      if (response.ok) {
        const data = await response.json();
        setPlannedControls(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch planned controls:", error);
    }
  };

  const handleControlAdded = () => {
    // Re-fetch from DB to ensure we have the real DB-generated IDs
    fetchPlannedControls(params.id as string);
  };

  const openAddActionDialog = (controlId: string) => {
    setActiveControlId(controlId);
    setActionForm({ plannedAction: "", description: "", percentageCompleted: "0", startDate: "", status: "Open" });
    setAddActionOpen(true);
  };

  const handleAddAction = async () => {
    if (!activeControlId || !actionForm.plannedAction.trim()) return;
    setSavingAction(true);
    try {
      const res = await fetch(`/api/risks/${params.id}/planned-controls/${activeControlId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionForm),
      });
      if (res.ok) {
        const data = await res.json();
        setPlannedControls(prev => prev.map(pc =>
          pc.id === activeControlId
            ? { ...pc, plannedActions: [...(pc.plannedActions || []), data.data] }
            : pc
        ));
        setAddActionOpen(false);
      }
    } catch (error) {
      console.error("Failed to add action:", error);
    } finally {
      setSavingAction(false);
    }
  };

  const handleDeleteAction = async (controlId: string, actionId: string) => {
    try {
      const res = await fetch(`/api/risks/${params.id}/planned-controls/${controlId}/actions?actionId=${actionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlannedControls(prev => prev.map(pc =>
          pc.id === controlId
            ? { ...pc, plannedActions: (pc.plannedActions || []).filter(a => a.id !== actionId) }
            : pc
        ));
      }
    } catch (error) {
      console.error("Failed to delete action:", error);
    }
  };

  const handleDeletePlannedControl = async (controlId: string) => {
    try {
      const res = await fetch(`/api/risks/${params.id}/planned-controls?controlId=${controlId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlannedControls(prev => prev.filter(pc => pc.id !== controlId));
      }
    } catch (error) {
      console.error("Failed to delete control:", error);
    }
  };

  const openEditControlDialog = (control: PlannedControl) => {
    setEditControlId(control.id);
    setEditControlForm({
      startDate: control.startDate ? new Date(control.startDate).toISOString().split("T")[0] : "",
      targetDate: control.targetDate ? new Date(control.targetDate).toISOString().split("T")[0] : "",
      estimatedBudget: control.estimatedBudget ? String(control.estimatedBudget) : "",
      relativeControlWeighting: control.relativeControlWeighting || "",
    });
    setEditControlErrors({});
    setEditControlOpen(true);
  };

  const handleSaveControlEdit = async () => {
    if (!editControlId) return;
    const today = new Date().toISOString().split("T")[0];
    const errors: { startDate?: string; targetDate?: string } = {};
    if (editControlForm.startDate && editControlForm.startDate < today) {
      errors.startDate = t("Start Date must be today or a future date");
    }
    if (editControlForm.targetDate && editControlForm.startDate && editControlForm.targetDate <= editControlForm.startDate) {
      errors.targetDate = t("Target Date must be after Start Date");
    }
    if (editControlForm.targetDate && !editControlForm.startDate) {
      errors.startDate = t("Please select a Start Date first");
    }
    if (Object.keys(errors).length > 0) {
      setEditControlErrors(errors);
      return;
    }
    setEditControlErrors({});
    setSavingControlEdit(true);
    try {
      const res = await fetch(`/api/risks/${params.id}/planned-controls`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlId: editControlId,
          startDate: editControlForm.startDate || null,
          targetDate: editControlForm.targetDate || null,
          estimatedBudget: editControlForm.estimatedBudget || null,
          relativeControlWeighting: editControlForm.relativeControlWeighting || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlannedControls(prev => prev.map(pc => pc.id === editControlId ? { ...pc, ...data.data } : pc));
        setEditControlOpen(false);
      }
    } catch (error) {
      console.error("Failed to update control details:", error);
    } finally {
      setSavingControlEdit(false);
    }
  };

  const getControlFormData = (control: PlannedControl) => {
    return controlFormData[control.id] || {
      status: control.status || "Open",
      completionPercentage: String(control.completionPercentage || 0),
      amountUsed: String(control.amountUsed || 0),
      remarks: control.remarks || "",
    };
  };

  const updateControlFormField = (controlId: string, field: string, value: string) => {
    const current = { ...getControlFormData(plannedControls.find(c => c.id === controlId)!), [field]: value };
    // Auto-set completion percentage based on status
    if (field === "status") {
      if (value === "Open") current.completionPercentage = "0";
      else if (value === "Completed") current.completionPercentage = "100";
    }
    setControlFormData(prev => ({
      ...prev,
      [controlId]: current,
    }));
  };

  const handleSaveControlUpdate = async (controlId: string) => {
    const formData = getControlFormData(plannedControls.find(c => c.id === controlId)!);
    setSavingControlUpdate(controlId);
    try {
      const res = await fetch(`/api/risks/${params.id}/planned-controls`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlId,
          status: formData.status,
          completionPercentage: formData.completionPercentage,
          amountUsed: formData.amountUsed,
          remarks: formData.remarks,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlannedControls(prev => prev.map(pc => pc.id === controlId ? { ...pc, ...data.data } : pc));
      }
    } catch (error) {
      console.error("Failed to update control:", error);
    } finally {
      setSavingControlUpdate(null);
    }
  };

  const togglePlannedControl = (id: string) => {
    setExpandedPlannedControls(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSubmitForApproval = async () => {
    if (!risk) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseStatus: "Awaiting Approval",
        }),
      });

      if (response.ok) {
        setSuccessDialogOpen(true);
        // Update local state
        setRisk(prev => prev ? { ...prev, responseStatus: "Awaiting Approval" } : null);
      }
    } catch (error) {
      console.error("Failed to submit for approval:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Approve action
  const handleApprove = async () => {
    if (!risk) return;

    setApproving(true);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseStatus: "Completed",
        }),
      });

      if (response.ok) {
        setSuccessDialogOpen(true);
        // Update local state
        setRisk(prev => prev ? { ...prev, responseStatus: "Completed" } : null);
      }
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setApproving(false);
    }
  };

  // Handle Send Back action
  const handleSendBack = async () => {
    if (!risk || !sendBackComment.trim()) return;

    setProcessingSendBack(true);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseStatus: "Sent Back",
          responseComment: sendBackComment,
          responseCommentBy: session?.user?.name || "Reviewer",
        }),
      });

      if (response.ok) {
        setShowSendBackDialog(false);
        setSendBackComment("");
        // Update local state with the new activity log
        setRisk(prev => prev ? {
          ...prev,
          responseStatus: "Sent Back",
          activityLogs: [
            {
              id: Date.now().toString(),
              activity: "Sent Back",
              description: sendBackComment,
              actor: session?.user?.name || "Reviewer",
              createdAt: new Date().toISOString(),
            },
            ...(prev.activityLogs || []),
          ]
        } : null);
        // Show success message
        setSuccessDialogOpen(true);
      }
    } catch (error) {
      console.error("Failed to send back:", error);
    } finally {
      setProcessingSendBack(false);
    }
  };

  // Normalize status for display and logic
  const normalizeStatus = (status: string): string => {
    const normalized = status.toLowerCase().replace(/\s+/g, '-');
    if (normalized === 'in-progress') return 'In-Progress';
    if (normalized === 'awaiting-approval') return 'Awaiting Approval';
    if (normalized === 'completed' || normalized === 'closed') return 'Completed';
    if (normalized === 'sent-back') return 'Sent Back';
    if (normalized === 'open') return 'Open';
    return status;
  };

  // Get the current risk responseStatus (for Risk Response Strategy workflow)
  const getRiskStatus = () => {
    if (!risk) return 'Open';
    const rawStatus = risk.responseStatus || 'Open';
    return normalizeStatus(rawStatus);
  };

  const fetchRisk = async (id: string) => {
    try {
      const response = await fetch(`/api/risks/${id}`);
      if (response.ok) {
        const data = await response.json();
        setRisk(data);
        // Map linked controls from the risk's controlRisks relation
        const linkedControls: Control[] = (data.controlRisks || []).map((cr: { control: { id: string; controlCode: string; name: string; description: string | null; relativeControlWeighting: number | null } }) => ({
          id: cr.control.id,
          controlId: cr.control.controlCode,
          name: cr.control.name,
          description: cr.control.description,
          effectiveness: cr.control.relativeControlWeighting ?? 0,
        }));
        setControls(linkedControls);
      }
    } catch (error) {
      console.error("Failed to fetch risk:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleControl = (id: string) => {
    setExpandedControls(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Control Rating calculation
  const controlRatingResult = useMemo(() => {
    const linkedControls = risk?.controlRisks || [];
    const totalControlCount = linkedControls.length;
    if (totalControlCount === 0) return { rating: 0, count: 0, hasControls: false };

    const maxScore = controlStrengths.length > 0
      ? Math.max(...controlStrengths.map(cs => cs.score))
      : Math.max(...linkedControls.map(cr => cr.controlStrength?.score || 0), 0);

    if (maxScore === 0) return { rating: 0, count: totalControlCount, hasControls: true };

    let sumControlValues = 0;
    for (const cr of linkedControls) {
      const controlWeight = cr.controlStrength?.score || 0;
      const controlValue = (controlWeight / maxScore) * 100;
      sumControlValues += controlValue;
    }

    const rating = sumControlValues / totalControlCount;
    return { rating: Math.round(rating * 100) / 100, count: totalControlCount, hasControls: true };
  }, [risk?.controlRisks, controlStrengths]);

  // Residual Risk = InherentRiskScore / TotalControlStrength (if TotalControlStrength != 0)
  const totalControlStrength = useMemo(() => {
    const linkedControls = risk?.controlRisks || [];
    let total = 0;
    for (const cr of linkedControls) {
      const score = cr.controlStrength?.score || 0;
      if (score !== 0) total += score;
    }
    return total;
  }, [risk?.controlRisks]);

  // Calculate days remaining
  const getDaysRemaining = (dueDate: string | null) => {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const now = new Date();
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  // Get likelihood/impact labels
  const getLikelihoodLabel = (value: number) => {
    if (value >= 8) return t("High");
    if (value >= 5) return t("Moderate");
    return t("Rare");
  };

  const getImpactLabel = (value: number) => {
    if (value >= 8) return t("High impact");
    if (value >= 5) return t("Moderate");
    return t("Low");
  };

  // Get risk rating color
  const getRiskRatingColor = (rating: string) => {
    switch (rating) {
      case "Low Risk": return "text-green-600";
      case "High": return "text-orange-600";
      case "Very high": return "text-red-600";
      case "Catastrophic": return "text-red-800";
      default: return "text-slate-600";
    }
  };

  // Calculate days data per planned control for the Days Remaining chart
  const plannedControlDaysData = useMemo(() => {
    return plannedControls.map((ctrl) => {
      const startDate = ctrl.startDate ? new Date(ctrl.startDate) : null;
      const targetDate = ctrl.targetDate ? new Date(ctrl.targetDate) : null;
      const now = new Date();

      // Total days = daysBetween(startDate, targetDate)
      const totalDays = startDate && targetDate
        ? Math.round((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Remaining days = daysBetween(now, targetDate) — only if targetDate is in the future
      const remainingDays = targetDate && now < targetDate
        ? Math.round((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Overdue days = daysBetween(now, targetDate) — only if targetDate is in the past
      const overdueDays = targetDate && now > targetDate
        ? Math.round((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        name: ctrl.name || ctrl.controlCode || "Control",
        controlCode: ctrl.controlCode || "",
        totalDays,
        remainingDays,
        overdueDays,
      };
    });
  }, [plannedControls]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-8 w-8 text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="bg-white rounded-lg border border-slate-200 py-8 text-center text-slate-500">
          {t("Risk not found")}
        </div>
      </div>
    );
  }

  const daysRemaining = getDaysRemaining(risk.treatmentDueDate);
  const currentStatus = getRiskStatus();

  // Render action buttons based on current status
  const renderActionButtons = () => {
    switch (currentStatus) {
      case "Open":
        // No action buttons in detail view for Open status
        return null;
      case "In-Progress":
      case "Sent Back":
        // Show Submit for Approval button for users with edit permission
        return canEdit ? (
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleSubmitForApproval}
            disabled={submitting}
          >
            {submitting ? t("Submitting...") : t("Submit for Approval")}
          </Button>
        ) : null;
      case "Awaiting Approval":
        // Show Approve and Send Back buttons for users with approve permission
        return canApprove ? (
          <div className="flex gap-2">
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? t("Approving...") : t("Approve")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowSendBackDialog(true)}
              disabled={processingSendBack}
            >
              {t("Send Back")}
            </Button>
          </div>
        ) : null;
      case "Completed":
        // No action buttons for completed status
        return null;
      default:
        return null;
    }
  };

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
        <Link href="/risks/response" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Response")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{risk?.riskId || t("Risk View")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{risk?.name || t("Risk View")}</h1>
          <span className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium",
            currentStatus === "Open" && "bg-primary-50 text-primary-700",
            currentStatus === "In-Progress" && "bg-amber-100 text-amber-800",
            currentStatus === "Awaiting Approval" && "bg-purple-100 text-purple-800",
            currentStatus === "Sent Back" && "bg-red-100 text-red-800",
            currentStatus === "Completed" && "bg-green-100 text-green-800"
          )}>
            {currentStatus}
          </span>
        </div>
        {renderActionButtons()}
      </div>

      {/* Charts - 2x2 Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* Risk Treatment - Donut Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">{t("Risk Treatment")}</h3>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-sm font-medium text-slate-700 mb-3">{t("Task Progress")}</p>
            <div className="flex items-center gap-4">
              <div className="relative w-32 h-32">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Completed", value: treatmentChartData.average },
                        { name: "Remaining", value: 100 - treatmentChartData.average },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill="#3B82F6" />
                      <Cell fill="#E2E8F0" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-slate-500">{t("Total")}</span>
                  <span className="text-lg font-bold text-slate-800">{treatmentChartData.average}%</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                  <span className="text-slate-600">{t("Completed")} - {treatmentChartData.completedCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-sm"></div>
                  <span className="text-slate-600">{t("In-Progress")} - {treatmentChartData.inProgressCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-slate-300 rounded-sm"></div>
                  <span className="text-slate-600">{t("Open")} - {treatmentChartData.openCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary-500 rounded-sm"></div>
                  <span className="text-slate-600">{t("Total")} - {treatmentChartData.totalPlanned}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Budget Allocation Vs Used */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">{t("Budget Allocation Vs Used")}</h3>
          <div className="h-48 flex flex-col justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{t("Allocated")}</p>
              <p className="text-3xl font-bold text-slate-800">{treatmentChartData.totalEstimatedBudget.toLocaleString()}</p>
            </div>
            {treatmentChartData.totalEstimatedBudget > 0 && (
              <div className="w-full bg-slate-200 rounded-full h-3 mb-2">
                <div
                  className="bg-yellow-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min((treatmentChartData.totalAmountUsed / treatmentChartData.totalEstimatedBudget) * 100, 100)}%` }}
                />
              </div>
            )}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500"></div>
                <span className="text-slate-600">{t("Used")} - {treatmentChartData.totalAmountUsed.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-200"></div>
                <span className="text-slate-600">{t("Remaining")} - {treatmentChartData.remainingBudget.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Days Remaining - Vertical stacked bar per Planned Control */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">{t("Days Remaining")}</h3>
          {plannedControlDaysData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">
              {t("No planned controls")}
            </div>
          ) : (
            <div className="space-y-5">
              {plannedControlDaysData.map((ctrl, idx) => {
                const isOverdue = ctrl.overdueDays > 0;
                const elapsed = ctrl.totalDays - ctrl.remainingDays;
                const elapsedPct = ctrl.totalDays > 0 ? Math.min((elapsed / ctrl.totalDays) * 100, 100) : 0;
                const overduePct = ctrl.totalDays > 0 ? (ctrl.overdueDays / (ctrl.totalDays + ctrl.overdueDays)) * 100 : (ctrl.overdueDays > 0 ? 100 : 0);
                const basePct = ctrl.totalDays > 0 && ctrl.overdueDays > 0 ? (ctrl.totalDays / (ctrl.totalDays + ctrl.overdueDays)) * 100 : 100;

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-700 truncate" title={ctrl.name}>
                        {ctrl.controlCode ? `${ctrl.controlCode} - ` : ""}{ctrl.name}
                      </p>
                      <span className={cn("text-xs font-semibold whitespace-nowrap ltr:ml-2 rtl:mr-2", isOverdue ? "text-red-600" : "text-emerald-600")}>
                        {isOverdue ? `${ctrl.overdueDays}d ${t("overdue")}` : `${ctrl.remainingDays}d ${t("remaining")}`}
                      </span>
                    </div>
                    {/* Single stacked bar with tooltip */}
                    <div className="relative group cursor-pointer">
                      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden flex">
                        {isOverdue ? (
                          <>
                            <div
                              className="bg-primary-400 h-3 transition-all"
                              style={{ width: `${basePct}%` }}
                            />
                            <div
                              className="bg-red-400 h-3 transition-all"
                              style={{ width: `${overduePct}%` }}
                            />
                          </>
                        ) : (
                          <div
                            className="bg-emerald-400 h-3 rounded-full transition-all"
                            style={{ width: `${elapsedPct}%` }}
                          />
                        )}
                      </div>
                      {/* Hover tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm bg-primary-400" />
                            <span>{t("Total Days")}: {ctrl.totalDays}d</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm bg-emerald-400" />
                            <span>{t("Elapsed")}: {elapsed > 0 ? elapsed : 0}d</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm bg-slate-400" />
                            <span>{t("Remaining")}: {ctrl.remainingDays}d</span>
                          </div>
                          {isOverdue && (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-sm bg-red-400" />
                              <span>{t("Overdue")}: {ctrl.overdueDays}d</span>
                            </div>
                          )}
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Residual Risk Rating */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">{t("Residual Risk Rating")}</h3>
          <div className="h-48 flex flex-col justify-between">
            {/* Gauge-like display */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-4 border-orange-500 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              </div>
              <span className={cn("text-lg font-semibold", getRiskRatingColor(risk.riskRating))}>
                {risk.riskRating} ({(risk.residualRiskScore ?? risk.riskScore ?? 0).toFixed(2)})
              </span>
            </div>

            {/* Planned Residual Risk Rating */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-800 uppercase tracking-wide mb-2">{t("Planned Residual Risk Rating")}</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-orange-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                </div>
                <span className={cn("font-semibold", getRiskRatingColor(risk.riskRating))}>
                  {risk.riskRating} ({(risk.residualRiskScore ?? risk.riskScore ?? 0).toFixed(2)})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Details */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-bold text-lg text-primary-600">{risk.riskId}</span>
          <span className="text-slate-300">|</span>
          <span className="font-semibold text-lg text-slate-800">{risk.name}</span>
        </div>
        <p className="text-sm text-slate-500 mb-6">{risk.description}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{t("Risk Owner")}</p>
            <p className="font-medium text-slate-800">{risk.owner?.fullName || t("No items found")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{t("Likelihood")}</p>
            <p className="font-medium text-slate-800">{getLikelihoodLabel(risk.likelihood)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{t("Impact")}</p>
            <p className="font-medium text-slate-800">{getImpactLabel(risk.impact)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{t("Inherent Risk Rating")}</p>
            <p className="font-medium text-slate-800">-</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{t("Residual Risk Rating")}</p>
            <span className={cn("font-medium", getRiskRatingColor(risk.riskRating))}>
              {risk.riskRating}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{t("Control Rating")}</p>
            {controlRatingResult.hasControls ? (
              <p className="font-medium text-slate-800">{controlRatingResult.rating.toFixed(2)}%</p>
            ) : (
              <p className="font-medium text-slate-800">-</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{t("Risk Response Strategy")}</p>
            <p className="font-medium text-slate-800">{risk.responseStrategy || t("Treat")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{t("Assessment Date")}</p>
            <p className="font-medium text-slate-800">{new Date().toLocaleDateString("en-GB")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{t("Next Review Date")}</p>
            <p className="font-medium text-slate-800">-</p>
          </div>
        </div>
      </div>

      {/* Existing Controls */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">{t("Existing Controls")}</h3>
        {controls.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                <Link2 className="h-6 w-6 text-primary-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t("No existing controls found")}</p>
              <p className="text-xs text-slate-400">{t("No controls are currently linked to this risk")}</p>
            </div>
          </div>
        ) : (
        <div className="space-y-2">
          {controls.map((control) => (
            <div key={control.id} className="bg-white rounded-xl border border-slate-200">
              <Collapsible
                open={expandedControls.includes(control.id)}
                onOpenChange={() => toggleControl(control.id)}
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-4 h-auto hover:bg-slate-50">
                    <span className="flex items-center gap-2">
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform text-slate-400",
                        expandedControls.includes(control.id) && "rotate-180"
                      )} />
                      <span className="text-slate-800">{control.controlId} - {control.name}</span>
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <div className="border border-slate-100 rounded-lg p-4 bg-slate-50">
                      <p className="text-sm text-slate-500 mb-4">{control.description}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{t("Department")}</p>
                          <p className="text-sm font-medium text-slate-700">{t("Assigned To")}:</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-800">{control.effectiveness}%</p>
                          <p className="text-xs text-slate-500">{t("partially effective")}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Planned Controls */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Planned Controls")}</h3>
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddControlOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {t("Add New Control")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setChooseControlOpen(true)}>
                {t("Choose Control")}
              </Button>
            </div>
          )}
        </div>
        {plannedControls.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                <Link2 className="h-6 w-6 text-primary-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t("No planned controls found")}</p>
              <p className="text-xs text-slate-400">{t("Add controls to plan risk mitigation")}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {plannedControls.map((control) => (
              <div key={control.id} className="bg-white rounded-lg border border-slate-200">
                <Collapsible
                  open={expandedPlannedControls.includes(control.id)}
                  onOpenChange={() => togglePlannedControl(control.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-4 h-auto hover:bg-slate-50">
                      <span className="flex items-center gap-2">
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform text-slate-400",
                          expandedPlannedControls.includes(control.id) && "rotate-180"
                        )} />
                        <span className="text-slate-800">{control.controlId} - {control.name}</span>
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4">
                      {/* Control Details */}
                      <div className="border border-slate-100 rounded-lg p-4 bg-slate-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {control.description && (
                              <p className="text-sm text-slate-500 mb-3">{control.description}</p>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-primary-600" onClick={() => openEditControlDialog(control)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-600" onClick={() => handleDeletePlannedControl(control.id)} title={t("Unlink Control")}>
                                <Unlink className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">{t("Start Date")}</p>
                            <p className="font-medium text-slate-700">{control.startDate ? new Date(control.startDate).toLocaleDateString("en-GB") : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">{t("Target Date")}</p>
                            <p className="font-medium text-slate-700">{control.targetDate ? new Date(control.targetDate).toLocaleDateString("en-GB") : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">{t("Estimated Budget")}</p>
                            <p className="font-medium text-slate-700">{control.estimatedBudget ? control.estimatedBudget : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">{t("Relative Control Weighting")}</p>
                            <p className="font-medium text-slate-700">{control.relativeControlWeighting || "—"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {control.domain && (
                            <span className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-600">{control.domain}</span>
                          )}
                          {control.functionalGrouping && (
                            <span className="bg-primary-50 text-primary-700 px-2 py-1 rounded text-xs">{control.functionalGrouping}</span>
                          )}
                        </div>
                      </div>

                      {/* Planned Actions Section */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-slate-700">{t("Planned Actions")}</h4>
                          {canEdit && (
                            <Button variant="outline" size="sm" onClick={() => openAddActionDialog(control.id)}>
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              {t("Add planned Action")}
                            </Button>
                          )}
                        </div>
                        {(control.plannedActions && control.plannedActions.length > 0) ? (
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <th className="text-left px-3 py-2 font-medium text-slate-600">{t("Planned Actions")}</th>
                                  <th className="text-left px-3 py-2 font-medium text-slate-600">{t("Description")}</th>
                                  <th className="text-left px-3 py-2 font-medium text-slate-600">{t("% Completed")}</th>
                                  <th className="text-left px-3 py-2 font-medium text-slate-600">{t("Start Date")}</th>
                                  <th className="text-left px-3 py-2 font-medium text-slate-600">{t("Status")}</th>
                                  {canEdit && <th className="text-left px-3 py-2 font-medium text-slate-600">{t("Action")}</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {control.plannedActions.map((action) => (
                                  <tr key={action.id} className="border-b border-slate-100 last:border-0">
                                    <td className="px-3 py-2 text-slate-800">{action.plannedAction}</td>
                                    <td className="px-3 py-2 text-slate-600">{action.description || "-"}</td>
                                    <td className="px-3 py-2 text-slate-800">{action.percentageCompleted}%</td>
                                    <td className="px-3 py-2 text-slate-600">{action.startDate ? new Date(action.startDate).toLocaleDateString("en-GB") : "-"}</td>
                                    <td className="px-3 py-2">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-xs font-medium",
                                        action.status === "Completed" && "bg-green-100 text-green-700",
                                        action.status === "In-Progress" && "bg-amber-100 text-amber-700",
                                        action.status === "Open" && "bg-slate-100 text-slate-600",
                                      )}>
                                        {action.status}
                                      </span>
                                    </td>
                                    {canEdit && (
                                      <td className="px-3 py-2">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteAction(control.id, action.id)}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 py-2">{t("No planned actions added yet")}</p>
                        )}
                      </div>

                      {/* Control Status/Progress Section */}
                      <div className="border border-slate-200 rounded-lg p-4 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-xs text-slate-500">{t("Status")}</Label>
                            <Select
                              value={getControlFormData(control).status}
                              onValueChange={(val) => updateControlFormField(control.id, "status", val)}
                              disabled={!canEdit}
                            >
                              <SelectTrigger className="mt-1 h-9 bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Open">{t("Open")}</SelectItem>
                                <SelectItem value="In-Progress">{t("In-Progress")}</SelectItem>
                                <SelectItem value="Completed">{t("Completed")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">{t("Completion Percentage")}</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              className="mt-1 h-9 bg-white"
                              value={getControlFormData(control).completionPercentage}
                              onChange={(e) => updateControlFormField(control.id, "completionPercentage", e.target.value)}
                              disabled={!canEdit}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">{t("Amount Used")}</Label>
                            <Input
                              type="number"
                              min="0"
                              className="mt-1 h-9 bg-white"
                              value={getControlFormData(control).amountUsed}
                              onChange={(e) => updateControlFormField(control.id, "amountUsed", e.target.value)}
                              disabled={!canEdit}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">{t("Remarks")}</Label>
                            <Input
                              className="mt-1 h-9 bg-white"
                              value={getControlFormData(control).remarks}
                              onChange={(e) => updateControlFormField(control.id, "remarks", e.target.value)}
                              disabled={!canEdit}
                            />
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex justify-between items-center mt-4">
                            <Button
                              size="sm"
                              onClick={() => handleSaveControlUpdate(control.id)}
                              disabled={savingControlUpdate === control.id}
                            >
                              {savingControlUpdate === control.id ? t("Saving...") : t("Save")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddControlDialog
        open={addControlOpen}
        onOpenChange={setAddControlOpen}
        onControlAdded={handleControlAdded}
        riskId={params.id as string}
      />
      <ChooseControlDialog
        open={chooseControlOpen}
        onOpenChange={setChooseControlOpen}
        onControlSelected={handleControlAdded}
        riskId={params.id as string}
        excludeControlIds={(risk?.controlRisks || []).map(cr => cr.control.id)}
      />

      {/* Success Dialog */}
      <AlertDialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <AlertDialogContent className="p-0 gap-0">
          <AlertDialogHeader className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Information")}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              {currentStatus === "Completed" && t("Risk Approved Successfully!")}
              {currentStatus === "Awaiting Approval" && t("Risk Submitted for Approval Successfully!")}
              {currentStatus === "Sent Back" && t("Risk Sent Back Successfully!")}
              {!["Completed", "Awaiting Approval", "Sent Back"].includes(currentStatus) && t("Action completed successfully!")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogAction onClick={() => setSuccessDialogOpen(false)}>
              {t("OK")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Back Dialog */}
      <Dialog open={showSendBackDialog} onOpenChange={(open) => {
        setShowSendBackDialog(open);
        if (!open) setSendBackComment("");
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Send Back Risk Response")}</DialogTitle>
            <DialogDescription className="text-slate-500">
              {t("Add a comment explaining why this risk response is being sent back")}
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 sm:px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="sendBackComment" className="text-sm font-medium text-slate-700">{t("Comment")} *</Label>
              <Textarea
                id="sendBackComment"
                className="min-h-[100px] w-full bg-white"
                placeholder={t("Enter your feedback...")}
                value={sendBackComment}
                onChange={(e) => setSendBackComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="px-4 sm:px-6 py-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowSendBackDialog(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSendBack} disabled={processingSendBack || !sendBackComment.trim()}>
              {processingSendBack ? t("Sending...") : t("Send Back")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Planned Action Dialog */}
      <Dialog open={addActionOpen} onOpenChange={setAddActionOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add new planned action")}</DialogTitle>
            <DialogDescription className="text-slate-500">
              {t("Add a planned action to this control")}
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 sm:px-6 py-5 space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Planned Action")} *</Label>
              <Input
                className="mt-1 bg-white"
                placeholder={t("Enter planned action")}
                value={actionForm.plannedAction}
                onChange={(e) => setActionForm(prev => ({ ...prev, plannedAction: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Textarea
                className="mt-1 min-h-[80px] bg-white"
                placeholder={t("Enter description")}
                value={actionForm.description}
                onChange={(e) => setActionForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Percentage Completed")} *</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  className="mt-1 bg-white"
                  value={actionForm.percentageCompleted}
                  onChange={(e) => setActionForm(prev => ({ ...prev, percentageCompleted: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Start Date")}</Label>
                <Input
                  type="date"
                  className="mt-1 bg-white"
                  value={actionForm.startDate}
                  onChange={(e) => setActionForm(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
              <Select
                value={actionForm.status}
                onValueChange={(val) => setActionForm(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger className="mt-1 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">{t("Open")}</SelectItem>
                  <SelectItem value="In-Progress">{t("In-Progress")}</SelectItem>
                  <SelectItem value="Completed">{t("Completed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="px-4 sm:px-6 py-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setAddActionOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddAction} disabled={savingAction || !actionForm.plannedAction.trim()}>
              {savingAction ? t("Adding...") : t("Add Action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Control Details Dialog */}
      <Dialog open={editControlOpen} onOpenChange={setEditControlOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Control Details")}</DialogTitle>
            <DialogDescription className="text-slate-500">
              {t("Update the control schedule, budget, and weighting")}
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 sm:px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Start Date")}</Label>
                <Input
                  type="date"
                  className={cn("mt-1 bg-white", editControlErrors.startDate && "border-red-500 focus-visible:ring-red-500")}
                  value={editControlForm.startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditControlForm(prev => ({
                      ...prev,
                      startDate: val,
                      targetDate: prev.targetDate && prev.targetDate <= val ? "" : prev.targetDate,
                    }));
                    setEditControlErrors(prev => ({ ...prev, startDate: undefined }));
                  }}
                />
                {editControlErrors.startDate && (
                  <p className="text-xs text-red-500 mt-1">{editControlErrors.startDate}</p>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Target Date")}</Label>
                <Input
                  type="date"
                  className={cn("mt-1 bg-white", editControlErrors.targetDate && "border-red-500 focus-visible:ring-red-500")}
                  value={editControlForm.targetDate}
                  onChange={(e) => {
                    setEditControlForm(prev => ({ ...prev, targetDate: e.target.value }));
                    setEditControlErrors(prev => ({ ...prev, targetDate: undefined }));
                  }}
                />
                {editControlErrors.targetDate && (
                  <p className="text-xs text-red-500 mt-1">{editControlErrors.targetDate}</p>
                )}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Estimated Budget")}</Label>
              <Input
                type="number"
                min="0"
                className="mt-1 bg-white"
                placeholder={t("Enter estimated budget")}
                value={editControlForm.estimatedBudget}
                onChange={(e) => setEditControlForm(prev => ({ ...prev, estimatedBudget: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Relative Control Weighting")}</Label>
              <Select
                value={editControlForm.relativeControlWeighting}
                onValueChange={(val) => setEditControlForm(prev => ({ ...prev, relativeControlWeighting: val }))}
              >
                <SelectTrigger className="mt-1 bg-white">
                  <SelectValue placeholder={t("Select weighting")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Preventive">{t("Preventive")}</SelectItem>
                  <SelectItem value="Detective">{t("Detective")}</SelectItem>
                  <SelectItem value="Corrective">{t("Corrective")}</SelectItem>
                  <SelectItem value="Directive">{t("Directive")}</SelectItem>
                  <SelectItem value="Compensating">{t("Compensating")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="px-4 sm:px-6 py-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setEditControlOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveControlEdit} disabled={savingControlEdit}>
              {savingControlEdit ? t("Saving...") : t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Comments Section if Sent Back */}
      {currentStatus === "Sent Back" && risk.activityLogs && risk.activityLogs.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="text-base font-semibold text-red-800 mb-3">{t("Reviewer Comments")}</h3>
          <div className="space-y-3">
            {risk.activityLogs.map((log) => (
              <div key={log.id} className="bg-white p-3 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{log.description}</p>
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>{t("By")}: {log.actor}</span>
                  <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

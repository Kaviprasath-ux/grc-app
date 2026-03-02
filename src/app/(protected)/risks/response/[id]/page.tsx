"use client";

import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
import { ChevronDown, ArrowLeft, Plus, Home, ChevronRight, Link2 } from "lucide-react";
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
  owner: { fullName: string } | null;
  assessmentStatus?: string;
  responseStatus?: string; // Separate status for Risk Response Strategy workflow
  activityLogs?: ActivityLog[];
  controlRisks?: { control: { id: string; controlCode: string; name: string; description: string | null; relativeControlWeighting: number | null } }[];
}

interface Control {
  id: string;
  controlId: string;
  name: string;
  description: string | null;
  effectiveness: number;
}

interface PlannedControl {
  id: string;
  controlId: string;
  name: string;
  description: string | null;
  domain?: string;
  functionalGrouping?: string;
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

  // Send Back dialog states
  const [showSendBackDialog, setShowSendBackDialog] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("");
  const [processingSendBack, setProcessingSendBack] = useState(false);

  // Approve state
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchRisk(params.id as string);
      fetchPlannedControls(params.id as string);
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

  const handleControlAdded = (control: PlannedControl) => {
    setPlannedControls(prev => [...prev, control]);
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
                        { name: "Completed", value: 0 },
                        { name: "Remaining", value: 100 },
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
                  <span className="text-lg font-bold text-slate-800">100%</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary-500 rounded-sm"></div>
                  <span className="text-slate-600">{t("Completed")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-slate-200 rounded-sm"></div>
                  <span className="text-slate-600">{t("Total")}</span>
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
              <p className="text-3xl font-bold text-slate-800">0</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500"></div>
                <span className="text-slate-600">{t("Used")} - 0</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-200"></div>
                <span className="text-slate-600">{t("Remaining")} - 0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Days Remaining - Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">{t("Days Remaining")}</h3>
          <div className="h-48 flex items-center justify-center">
            <div className="w-full">
              {/* Simple bar representation */}
              <div className="flex items-end justify-center gap-1 h-32">
                {[0, 2, 4, 6].map((val, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "w-8 bg-primary-500 rounded-t",
                      daysRemaining >= val ? "opacity-100" : "opacity-30"
                    )}
                    style={{ height: `${(val + 1) * 15}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-center gap-1 mt-2 text-xs text-slate-500">
                <span className="w-8 text-center">0</span>
                <span className="w-8 text-center">2</span>
                <span className="w-8 text-center">4</span>
                <span className="w-8 text-center">6</span>
              </div>
            </div>
          </div>
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
                {risk.riskRating} (35.00)
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
                  {risk.riskRating} (35.00)
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
            <p className="font-medium text-slate-800">-</p>
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
                    <div className="px-4 pb-4">
                      <div className="border border-slate-100 rounded-lg p-4 bg-slate-50">
                        <p className="text-sm text-slate-500 mb-4">{control.description}</p>
                        <div className="flex items-center gap-4 text-sm">
                          {control.domain && (
                            <span className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-600">
                              {control.domain}
                            </span>
                          )}
                          {control.functionalGrouping && (
                            <span className="bg-primary-50 text-primary-700 px-2 py-1 rounded text-xs">
                              {control.functionalGrouping}
                            </span>
                          )}
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

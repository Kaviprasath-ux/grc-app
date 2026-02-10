"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, Plus, X } from "lucide-react";
import { RiskRatingBadge } from "@/components/risks/risk-rating-badge";
import { AddControlDialog } from "@/components/risks/add-control-dialog";
import { ChooseControlDialog } from "@/components/risks/choose-control-dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

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
  responseStatus?: string;
  activityLogs?: ActivityLog[];
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

interface RiskResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riskId: string | null;
  onStatusChange?: () => void;
}

export function RiskResponseDialog({
  open,
  onOpenChange,
  riskId,
  onStatusChange,
}: RiskResponseDialogProps) {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { canEdit, canApprove } = usePermissions("risk.response");

  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);
  const [controls, setControls] = useState<Control[]>([]);
  const [expandedControls, setExpandedControls] = useState<string[]>([]);
  const [plannedControls, setPlannedControls] = useState<PlannedControl[]>([]);
  const [expandedPlannedControls, setExpandedPlannedControls] = useState<string[]>([]);
  const [addControlOpen, setAddControlOpen] = useState(false);
  const [chooseControlOpen, setChooseControlOpen] = useState(false);

  // Action states
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showSendBackDialog, setShowSendBackDialog] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("");
  const [processingSendBack, setProcessingSendBack] = useState(false);

  useEffect(() => {
    if (open && riskId) {
      setRisk(null);
      setLoading(true);
      setControls([]);
      setPlannedControls([]);
      setExpandedControls([]);
      setExpandedPlannedControls([]);
      fetchRisk(riskId);
      fetchPlannedControls(riskId);
    }
  }, [open, riskId]);

  const fetchRisk = async (id: string) => {
    try {
      const response = await fetch(`/api/risks/${id}`);
      if (response.ok) {
        const data = await response.json();
        setRisk(data);
        setControls([
          {
            id: "1",
            controlId: "RSK-01.1",
            name: "Risk Framing",
            description:
              "Mechanisms exist to identify assumptions, constraints, risk tolerance, and priorities affecting risk assessments, risk response and risk monitoring.",
            effectiveness: 20,
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch risk:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlannedControls = async (id: string) => {
    try {
      const response = await fetch(`/api/risks/${id}/planned-controls`);
      if (response.ok) {
        const data = await response.json();
        setPlannedControls(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch planned controls:", error);
    }
  };

  const normalizeStatus = (status: string): string => {
    const normalized = status.toLowerCase().replace(/\s+/g, "-");
    if (normalized === "in-progress") return "In-Progress";
    if (normalized === "awaiting-approval") return "Awaiting Approval";
    if (normalized === "completed" || normalized === "closed") return "Completed";
    if (normalized === "sent-back") return "Sent Back";
    if (normalized === "open") return "Open";
    return status;
  };

  const currentStatus = risk
    ? normalizeStatus(risk.responseStatus || "Open")
    : "Open";

  const handleSubmitForApproval = async () => {
    if (!risk) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseStatus: "Awaiting Approval" }),
      });
      if (response.ok) {
        setRisk((prev) =>
          prev ? { ...prev, responseStatus: "Awaiting Approval" } : null
        );
        toast.success(t("Risk submitted for approval successfully"));
        onStatusChange?.();
      }
    } catch (error) {
      console.error("Failed to submit:", error);
      toast.error(t("Failed to submit for approval"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!risk) return;
    setApproving(true);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseStatus: "Completed" }),
      });
      if (response.ok) {
        setRisk((prev) =>
          prev ? { ...prev, responseStatus: "Completed" } : null
        );
        toast.success(t("Risk approved successfully"));
        onStatusChange?.();
      }
    } catch (error) {
      console.error("Failed to approve:", error);
      toast.error(t("Failed to approve"));
    } finally {
      setApproving(false);
    }
  };

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
        setRisk((prev) =>
          prev
            ? {
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
                ],
              }
            : null
        );
        toast.success(t("Risk sent back successfully"));
        onStatusChange?.();
      }
    } catch (error) {
      console.error("Failed to send back:", error);
      toast.error(t("Failed to send back"));
    } finally {
      setProcessingSendBack(false);
    }
  };

  const handleControlAdded = (control: PlannedControl) => {
    setPlannedControls((prev) => [...prev, control]);
  };

  const toggleControl = (id: string) => {
    setExpandedControls((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const togglePlannedControl = (id: string) => {
    setExpandedPlannedControls((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const getDaysRemaining = (dueDate: string | null) => {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const now = new Date();
    const diff = Math.ceil(
      (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 0;
  };

  const renderActionButtons = () => {
    switch (currentStatus) {
      case "In-Progress":
      case "Sent Back":
        return canEdit ? (
          <Button
            size="sm"
            onClick={handleSubmitForApproval}
            disabled={submitting}
          >
            {submitting ? t("Submitting...") : t("Submit for Approval")}
          </Button>
        ) : null;
      case "Awaiting Approval":
        return canApprove ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={handleApprove} disabled={approving}>
              {approving ? t("Approving...") : t("Approve")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowSendBackDialog(true)}
            >
              {t("Send Back")}
            </Button>
          </div>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0"
          showCloseButton={false}
        >
          {/* Fixed Header */}
          <DialogHeader className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold text-slate-800 truncate pe-2">
                  {risk
                    ? `${risk.riskId} - ${risk.name}`
                    : t("Risk Response")}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {t("Risk response details and actions")}
                </DialogDescription>
                {risk && (
                  <div className="flex items-center gap-2 mt-2">
                    <RiskRatingBadge rating={risk.riskRating} />
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium",
                        currentStatus === "Open" &&
                          "bg-blue-100 text-blue-800",
                        currentStatus === "In-Progress" &&
                          "bg-amber-100 text-amber-800",
                        currentStatus === "Awaiting Approval" &&
                          "bg-purple-100 text-purple-800",
                        currentStatus === "Sent Back" &&
                          "bg-red-100 text-red-800",
                        currentStatus === "Completed" &&
                          "bg-green-100 text-green-800"
                      )}
                    >
                      {currentStatus}
                    </span>
                    {risk.responseStrategy && (
                      <span className="px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                        {risk.responseStrategy}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="relative h-8 w-8">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              </div>
            ) : !risk ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-slate-500">{t("Risk not found")}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Reviewer Comments (if Sent Back) */}
                {currentStatus === "Sent Back" &&
                  risk.activityLogs &&
                  risk.activityLogs.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <h4 className="text-sm font-semibold text-red-800 mb-2">
                        {t("Reviewer Comments")}
                      </h4>
                      <div className="space-y-2">
                        {risk.activityLogs.map((log) => (
                          <div
                            key={log.id}
                            className="bg-white p-3 rounded-lg border border-slate-100"
                          >
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {log.description}
                            </p>
                            <div className="flex justify-between text-xs text-slate-500 mt-2">
                              <span>
                                {t("By")}: {log.actor}
                              </span>
                              <span>
                                {new Date(log.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Charts - 2x2 Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Risk Treatment - SVG Donut */}
                  <div className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                    <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wide mb-3">{t("Risk Treatment")}</h4>
                    <div className="flex items-center gap-3">
                      <div className="relative w-24 h-24 flex-shrink-0">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="38" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                          <circle cx="50" cy="50" r="38" fill="none" stroke="#3b82f6" strokeWidth="12" strokeDasharray={`${0} ${2 * Math.PI * 38}`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[10px] text-slate-500">{t("Total")}</span>
                          <span className="text-base font-bold text-slate-800">0%</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div>
                          <span className="text-slate-600">{t("Completed")}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-slate-200 rounded-sm"></div>
                          <span className="text-slate-600">{t("Total")}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Budget Allocation Vs Used */}
                  <div className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                    <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wide mb-3">{t("Budget Allocation Vs Used")}</h4>
                    <div className="flex flex-col justify-between h-[calc(100%-28px)]">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">{t("Allocated")}</p>
                        <p className="text-2xl font-bold text-slate-800">0</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs mt-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-yellow-500"></div>
                          <span className="text-slate-600">{t("Used")} - 0</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 bg-slate-200"></div>
                          <span className="text-slate-600">{t("Remaining")} - 0</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Days Remaining - Bar Chart */}
                  <div className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                    <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wide mb-3">{t("Days Remaining")}</h4>
                    <div className="flex items-end justify-center gap-1 h-20">
                      {[0, 2, 4, 6].map((val, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "w-6 bg-blue-500 rounded-t",
                            getDaysRemaining(risk.treatmentDueDate) >= val ? "opacity-100" : "opacity-30"
                          )}
                          style={{ height: `${(val + 1) * 15}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-center gap-1 mt-1.5 text-[10px] text-slate-500">
                      <span className="w-6 text-center">0</span>
                      <span className="w-6 text-center">2</span>
                      <span className="w-6 text-center">4</span>
                      <span className="w-6 text-center">6</span>
                    </div>
                  </div>

                  {/* Residual Risk Rating */}
                  <div className="bg-slate-50 rounded-lg border border-slate-100 p-4">
                    <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wide mb-3">{t("Residual Risk Rating")}</h4>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full border-[3px] border-orange-500 flex items-center justify-center flex-shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                        </div>
                        <span className="text-sm font-semibold text-orange-600">
                          {risk.riskRating} (35.00)
                        </span>
                      </div>
                      <div className="border-t border-slate-200 pt-2">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">{t("Planned Residual Risk Rating")}</p>
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full border-[3px] border-orange-500 flex items-center justify-center flex-shrink-0">
                            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                          </div>
                          <span className="text-xs font-semibold text-orange-600">
                            {risk.riskRating} (35.00)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Risk Details */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <h4 className="font-semibold text-slate-800 mb-3">
                    {t("Risk Details")}
                  </h4>
                  {risk.description && (
                    <p className="text-sm text-slate-500 mb-4">
                      {risk.description}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase mb-0.5">
                        {t("Risk Owner")}
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {risk.owner?.fullName || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase mb-0.5">
                        {t("Likelihood")}
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {risk.likelihood || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase mb-0.5">
                        {t("Impact")}
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {risk.impact || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase mb-0.5">
                        {t("Response Strategy")}
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {risk.responseStrategy || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase mb-0.5">
                        {t("Treatment Due Date")}
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {risk.treatmentDueDate
                          ? new Date(
                              risk.treatmentDueDate
                            ).toLocaleDateString("en-GB")
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase mb-0.5">
                        {t("Risk Rating")}
                      </p>
                      <p className="text-sm font-medium text-slate-800">
                        {risk.riskRating || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Existing Controls */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">
                    {t("Existing Controls")}
                  </h4>
                  {controls.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center text-sm text-slate-400">
                      {t("No controls found")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {controls.map((control) => (
                        <div
                          key={control.id}
                          className="bg-slate-50 rounded-lg border border-slate-100"
                        >
                          <Collapsible
                            open={expandedControls.includes(control.id)}
                            onOpenChange={() => toggleControl(control.id)}
                          >
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                className="w-full justify-between p-3 h-auto hover:bg-slate-100/50"
                              >
                                <span className="flex items-center gap-2 text-sm">
                                  <ChevronDown
                                    className={cn(
                                      "h-4 w-4 transition-transform text-slate-400",
                                      expandedControls.includes(control.id) &&
                                        "rotate-180"
                                    )}
                                  />
                                  <span className="text-slate-800">
                                    {control.controlId} - {control.name}
                                  </span>
                                </span>
                                <span className="text-xs font-medium text-slate-500">
                                  {control.effectiveness}%
                                </span>
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-3 pb-3">
                                <div className="bg-white rounded-lg border border-slate-100 p-3">
                                  <p className="text-sm text-slate-500">
                                    {control.description}
                                  </p>
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
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-800">
                      {t("Planned Controls")}
                    </h4>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setAddControlOpen(true)}
                        >
                          <Plus className="h-3 w-3 me-1" />
                          {t("Add New")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setChooseControlOpen(true)}
                        >
                          {t("Choose")}
                        </Button>
                      </div>
                    )}
                  </div>
                  {plannedControls.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center text-sm text-slate-400">
                      {t("No planned controls")}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {plannedControls.map((control) => (
                        <div
                          key={control.id}
                          className="bg-slate-50 rounded-lg border border-slate-100"
                        >
                          <Collapsible
                            open={expandedPlannedControls.includes(control.id)}
                            onOpenChange={() =>
                              togglePlannedControl(control.id)
                            }
                          >
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                className="w-full justify-between p-3 h-auto hover:bg-slate-100/50"
                              >
                                <span className="flex items-center gap-2 text-sm">
                                  <ChevronDown
                                    className={cn(
                                      "h-4 w-4 transition-transform text-slate-400",
                                      expandedPlannedControls.includes(
                                        control.id
                                      ) && "rotate-180"
                                    )}
                                  />
                                  <span className="text-slate-800">
                                    {control.controlId} - {control.name}
                                  </span>
                                </span>
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-3 pb-3">
                                <div className="bg-white rounded-lg border border-slate-100 p-3">
                                  <p className="text-sm text-slate-500">
                                    {control.description}
                                  </p>
                                  <div className="flex items-center gap-2 mt-2">
                                    {control.domain && (
                                      <span className="bg-slate-100 px-2 py-0.5 rounded text-xs text-slate-600">
                                        {control.domain}
                                      </span>
                                    )}
                                    {control.functionalGrouping && (
                                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
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
              </div>
            )}
          </div>

          {/* Sticky Footer with Action Buttons */}
          {risk && renderActionButtons() && (
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex items-center justify-end gap-2">
              {renderActionButtons()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / Choose Control Dialogs */}
      {riskId && (
        <>
          <AddControlDialog
            open={addControlOpen}
            onOpenChange={setAddControlOpen}
            onControlAdded={handleControlAdded}
            riskId={riskId}
          />
          <ChooseControlDialog
            open={chooseControlOpen}
            onOpenChange={setChooseControlOpen}
            onControlSelected={handleControlAdded}
            riskId={riskId}
          />
        </>
      )}

      {/* Send Back Dialog */}
      <Dialog
        open={showSendBackDialog}
        onOpenChange={(o) => {
          setShowSendBackDialog(o);
          if (!o) setSendBackComment("");
        }}
      >
        <DialogContent className="sm:max-w-[500px]" showCloseButton={false}>
          <DialogHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold text-slate-800">
                  {t("Send Back Risk Response")}
                </DialogTitle>
                <DialogDescription className="text-slate-500 mt-1">
                  {t(
                    "Add a comment explaining why this risk response is being sent back"
                  )}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSendBackDialog(false)}
                className="flex-shrink-0 h-8 w-8 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Label
              htmlFor="sendBackComment"
              className="text-sm font-medium text-slate-700"
            >
              {t("Comment")} *
            </Label>
            <Textarea
              id="sendBackComment"
              className="min-h-[100px] w-full bg-white"
              placeholder={t("Enter your feedback...")}
              value={sendBackComment}
              onChange={(e) => setSendBackComment(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setShowSendBackDialog(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleSendBack}
              disabled={processingSendBack || !sendBackComment.trim()}
            >
              {processingSendBack ? t("Sending...") : t("Send Back")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

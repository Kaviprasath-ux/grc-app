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
import { ChevronDown, Plus, X, CalendarDays, TrendingUp, Wallet, ShieldAlert } from "lucide-react";
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

  const daysRemaining = risk ? getDaysRemaining(risk.treatmentDueDate) : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0"
          showCloseButton={false}
        >
          {/* Fixed Header */}
          <DialogHeader className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-200">
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
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 flex-shrink-0"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
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
              <>
                {/* Reviewer Comments (if Sent Back) */}
                {currentStatus === "Sent Back" &&
                  risk.activityLogs &&
                  risk.activityLogs.length > 0 && (
                    <div className="mx-4 sm:mx-6 mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
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

                {/* Quick Stats Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200">
                  <div className="px-4 py-4 text-center border-r border-slate-100">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{t("Days Left")}</span>
                    </div>
                    <p className={cn(
                      "text-2xl font-bold",
                      daysRemaining <= 3 ? "text-red-600" : daysRemaining <= 7 ? "text-amber-600" : "text-slate-800"
                    )}>
                      {daysRemaining}
                    </p>
                  </div>
                  <div className="px-4 py-4 text-center border-r border-slate-100">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{t("Treatment")}</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">0%</p>
                  </div>
                  <div className="px-4 py-4 text-center border-r border-slate-100">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Wallet className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{t("Budget")}</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">0</p>
                    <p className="text-[10px] text-slate-400">{t("Used")} 0</p>
                  </div>
                  <div className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{t("Residual")}</span>
                    </div>
                    <RiskRatingBadge rating={risk.riskRating} />
                  </div>
                </div>

                {/* Risk Details Section */}
                <div className="px-4 sm:px-6 py-5 border-b border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">
                    {t("Risk Details")}
                  </h4>
                  {risk.description && (
                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                      {risk.description}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
                    <div className="flex justify-between py-2.5 border-b border-slate-100">
                      <span className="text-sm text-slate-500">{t("Risk Owner")}</span>
                      <span className="text-sm font-medium text-slate-800">{risk.owner?.fullName || "-"}</span>
                    </div>
                    <div className="flex justify-between py-2.5 border-b border-slate-100">
                      <span className="text-sm text-slate-500">{t("Response Strategy")}</span>
                      <span className="text-sm font-medium text-slate-800">{risk.responseStrategy || "-"}</span>
                    </div>
                    <div className="flex justify-between py-2.5 border-b border-slate-100">
                      <span className="text-sm text-slate-500">{t("Likelihood")}</span>
                      <span className="text-sm font-medium text-slate-800">{risk.likelihood || "-"}</span>
                    </div>
                    <div className="flex justify-between py-2.5 border-b border-slate-100">
                      <span className="text-sm text-slate-500">{t("Impact")}</span>
                      <span className="text-sm font-medium text-slate-800">{risk.impact || "-"}</span>
                    </div>
                    <div className="flex justify-between py-2.5 border-b border-slate-100">
                      <span className="text-sm text-slate-500">{t("Risk Rating")}</span>
                      <span className="text-sm font-medium text-slate-800">{risk.riskRating || "-"}</span>
                    </div>
                    <div className="flex justify-between py-2.5 border-b border-slate-100">
                      <span className="text-sm text-slate-500">{t("Treatment Due Date")}</span>
                      <span className="text-sm font-medium text-slate-800">
                        {risk.treatmentDueDate
                          ? new Date(risk.treatmentDueDate).toLocaleDateString("en-GB")
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Existing Controls Section */}
                <div className="px-4 sm:px-6 py-5 border-b border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">
                    {t("Existing Controls")}
                  </h4>
                  {controls.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">{t("No controls found")}</p>
                  ) : (
                    <div className="space-y-2">
                      {controls.map((control) => (
                        <Collapsible
                          key={control.id}
                          open={expandedControls.includes(control.id)}
                          onOpenChange={() => toggleControl(control.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <button
                              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
                            >
                              <span className="flex items-center gap-2 text-sm">
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 transition-transform text-slate-400",
                                    expandedControls.includes(control.id) &&
                                      "rotate-180"
                                  )}
                                />
                                <span className="font-medium text-primary-600">{control.controlId}</span>
                                <span className="text-slate-700">{control.name}</span>
                              </span>
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {control.effectiveness}%
                              </span>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ms-9 me-3 mb-2 p-3 rounded-lg bg-slate-50 text-sm text-slate-600 leading-relaxed">
                              {control.description}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  )}
                </div>

                {/* Planned Controls Section */}
                <div className="px-4 sm:px-6 py-5">
                  <div className="flex items-center justify-between mb-3">
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
                    <p className="text-sm text-slate-400 py-2">{t("No planned controls")}</p>
                  ) : (
                    <div className="space-y-2">
                      {plannedControls.map((control) => (
                        <Collapsible
                          key={control.id}
                          open={expandedPlannedControls.includes(control.id)}
                          onOpenChange={() =>
                            togglePlannedControl(control.id)
                          }
                        >
                          <CollapsibleTrigger asChild>
                            <button
                              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
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
                                <span className="font-medium text-primary-600">{control.controlId}</span>
                                <span className="text-slate-700">{control.name}</span>
                              </span>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ms-9 me-3 mb-2 p-3 rounded-lg bg-slate-50">
                              <p className="text-sm text-slate-600 leading-relaxed">
                                {control.description}
                              </p>
                              {(control.domain || control.functionalGrouping) && (
                                <div className="flex items-center gap-2 mt-2">
                                  {control.domain && (
                                    <span className="bg-slate-200 px-2 py-0.5 rounded text-xs text-slate-600">
                                      {control.domain}
                                    </span>
                                  )}
                                  {control.functionalGrouping && (
                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
                                      {control.functionalGrouping}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Sticky Footer with Action Buttons */}
          {risk && renderActionButtons() && (
            <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex items-center justify-end gap-2">
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
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]" showCloseButton={false}>
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
          <div className="flex flex-row justify-end gap-2 pt-4 border-t border-slate-100">
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

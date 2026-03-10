"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, FileText, Flag, CheckCircle2, XCircle, MinusCircle } from "lucide-react";

interface OffboardResponse {
  id: string;
  questionId: string;
  questionNo: number;
  questionTitle: string;
  questionText: string | null;
  response: string | null;
  comment: string | null;
  artifactUrl: string | null;
  artifactName: string | null;
  isFlagged: boolean;
}

interface AssessmentData {
  id: string;
  assessmentCode: string;
  status: string;
  vendorName: string;
  vendorCode: string;
  initiatedBy: string | null;
  createdAt: string;
  responses: OffboardResponse[];
}

interface OffboardReviewDialogProps {
  assessmentId: string | null;
  open: boolean;
  onClose: () => void;
  onActionComplete: () => void;
  role: "assessor" | "rm" | "bo";
}

export default function OffboardReviewDialog({
  assessmentId,
  open,
  onClose,
  onActionComplete,
  role,
}: OffboardReviewDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const fetchAssessment = useCallback(async () => {
    if (!assessmentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tprm/offboard-assessments/${assessmentId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      setAssessment(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load offboard assessment"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [assessmentId, toast, t]);

  useEffect(() => {
    if (open && assessmentId) fetchAssessment();
  }, [open, assessmentId, fetchAssessment]);

  const handleAction = async (action: string, requireComment: boolean) => {
    if (requireComment) {
      setPendingAction(action);
      setComment("");
      setCommentDialogOpen(true);
      return;
    }

    setPendingAction(action);
    setComment("");
    setCommentDialogOpen(true);
  };

  const executeAction = async () => {
    if (!assessmentId || !pendingAction) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/tprm/offboard-assessments/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: pendingAction,
          comment: comment.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: t("Error"), description: data.error || t("Action failed"), variant: "destructive" });
        return;
      }

      const actionLabels: Record<string, string> = {
        "assessor-approve": "Assessment approved and sent to RM",
        "assessor-send-back": "Assessment sent back to vendor",
        "rm-approve": "Assessment approved and sent to BO",
        "rm-send-back": "Assessment sent back to vendor",
        "bo-approve": "Vendor termination approved. All remediations closed.",
        "bo-send-to-rm": "Assessment sent back to RM",
      };

      toast({ title: t("Success"), description: t(actionLabels[pendingAction] || "Action completed") });
      setCommentDialogOpen(false);
      setPendingAction(null);
      setComment("");
      onClose();
      onActionComplete();
    } catch {
      toast({ title: t("Error"), description: t("Action failed"), variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const getResponseIcon = (response: string | null) => {
    switch (response) {
      case "Yes": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "No": return <XCircle className="h-4 w-4 text-red-500" />;
      case "NA": return <MinusCircle className="h-4 w-4 text-gray-400" />;
      default: return null;
    }
  };

  const getResponseBadge = (response: string | null) => {
    switch (response) {
      case "Yes": return <Badge className="bg-green-100 text-green-700 text-xs">{t("Yes")}</Badge>;
      case "No": return <Badge className="bg-red-100 text-red-700 text-xs">{t("No")}</Badge>;
      case "NA": return <Badge className="bg-gray-100 text-gray-600 text-xs">{t("N/A")}</Badge>;
      default: return <Badge variant="outline" className="text-xs">{t("Not Answered")}</Badge>;
    }
  };

  const sortedResponses = [...(assessment?.responses || [])].sort((a, b) => a.questionNo - b.questionNo);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="!max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {t("Offboard Assessment Review")}
              {assessment && (
                <Badge className="bg-orange-100 text-orange-700">{assessment.assessmentCode}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !assessment ? (
            <div className="py-8 text-center text-muted-foreground">{t("Assessment not found")}</div>
          ) : (
            <div className="space-y-4">
              {/* Assessment info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("Vendor")}:</span>{" "}
                  <span className="font-medium">{assessment.vendorName} ({assessment.vendorCode})</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("Status")}:</span>{" "}
                  <Badge className="bg-orange-100 text-orange-700">{t(assessment.status.replace(/_/g, " "))}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("Initiated By")}:</span>{" "}
                  <span>{assessment.initiatedBy || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("Date")}:</span>{" "}
                  <span>{new Date(assessment.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Responses (read-only) */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm">{t("Offboarding Responses")} ({sortedResponses.length})</h3>
                {sortedResponses.map((r, idx) => (
                  <Card key={r.id} className={r.isFlagged ? "border-amber-400 bg-amber-50/30" : ""}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground">Q{idx + 1}</span>
                            <span className="font-medium text-sm">{r.questionTitle}</span>
                            {r.isFlagged && <Flag className="h-3.5 w-3.5 text-amber-500" />}
                          </div>
                          {r.questionText && (
                            <p className="text-xs text-muted-foreground">{r.questionText}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {getResponseIcon(r.response)}
                          {getResponseBadge(r.response)}
                        </div>
                      </div>
                      {r.comment && (
                        <div className="text-xs bg-muted/50 rounded p-2">
                          <span className="font-medium">{t("Comment")}:</span> {r.comment}
                        </div>
                      )}
                      {r.artifactUrl && (
                        <div className="flex items-center gap-2 text-xs">
                          <FileText className="h-3.5 w-3.5 text-blue-500" />
                          <a href={r.artifactUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {r.artifactName || t("Attachment")}
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-4 border-t">
                {role === "assessor" && (
                  <>
                    <Button
                      onClick={() => handleAction("assessor-approve", false)}
                      className="bg-green-100 text-green-800 hover:bg-green-200 border border-green-200"
                      disabled={actionLoading}
                    >
                      {t("Approve")}
                    </Button>
                    <Button
                      onClick={() => handleAction("assessor-send-back", true)}
                      className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200"
                      disabled={actionLoading}
                    >
                      {t("Send Back to Vendor")}
                    </Button>
                  </>
                )}
                {role === "rm" && (
                  <>
                    <Button
                      onClick={() => handleAction("rm-approve", false)}
                      className="bg-green-100 text-green-800 hover:bg-green-200 border border-green-200"
                      disabled={actionLoading}
                    >
                      {t("Approve")}
                    </Button>
                    <Button
                      onClick={() => handleAction("rm-send-back", true)}
                      className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200"
                      disabled={actionLoading}
                    >
                      {t("Send to Vendor")}
                    </Button>
                  </>
                )}
                {role === "bo" && (
                  <>
                    <Button
                      onClick={() => handleAction("bo-approve", false)}
                      className="bg-red-100 text-red-800 hover:bg-red-200 border border-red-200"
                      disabled={actionLoading}
                    >
                      {t("Approve Termination")}
                    </Button>
                    <Button
                      onClick={() => handleAction("bo-send-to-rm", true)}
                      className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200"
                      disabled={actionLoading}
                    >
                      {t("Send to RM")}
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={onClose}>{t("Close")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Comment Dialog for actions */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="!max-w-md w-[90vw]">
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.includes("approve") ? t("Approve with Comment") :
               pendingAction?.includes("send-back") || pendingAction?.includes("send-to") ? t("Send Back with Comment") :
               t("Add Comment")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>{t("Comment")} {pendingAction?.includes("send-back") ? `(${t("required")})` : `(${t("optional")})`}</Label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t("Enter your comment...")}
              rows={4}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              onClick={executeAction}
              disabled={actionLoading || (pendingAction?.includes("send-back") && !comment.trim())}
              className="bg-primary/90 hover:bg-primary text-primary-foreground"
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Confirm")}
            </Button>
            <Button variant="outline" onClick={() => { setCommentDialogOpen(false); setPendingAction(null); }}>
              {t("Cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

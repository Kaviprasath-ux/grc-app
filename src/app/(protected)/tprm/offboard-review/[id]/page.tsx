"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
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
import {
  Home, ChevronRight, Loader2, FileText, Flag,
  CheckCircle2, XCircle, MinusCircle, ArrowLeft,
} from "lucide-react";
import { useHasRole } from "@/hooks/usePermissions";

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

export default function OffboardReviewPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const assessmentId = params.id as string;
  const role = (searchParams.get("role") || "assessor") as "assessor" | "rm" | "bo";
  const isAuditor = useHasRole("TPRMAuditor");

  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const backPath = role === "assessor"
    ? "/tprm/asr-assessments"
    : role === "rm"
    ? "/tprm/rm-assessments"
    : "/tprm/bo-assessments";

  const fetchAssessment = useCallback(async () => {
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
    fetchAssessment();
  }, [fetchAssessment]);

  const handleAction = (action: string) => {
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
      router.push(backPath);
    } catch {
      toast({ title: t("Error"), description: t("Action failed"), variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const getResponseIcon = (response: string | null) => {
    switch (response) {
      case "Yes": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "No": return <XCircle className="h-5 w-5 text-red-500" />;
      case "NA": return <MinusCircle className="h-5 w-5 text-gray-400" />;
      default: return null;
    }
  };

  const getResponseBadge = (response: string | null) => {
    switch (response) {
      case "Yes": return <Badge className="bg-green-100 text-green-700">{t("Yes")}</Badge>;
      case "No": return <Badge className="bg-red-100 text-red-700">{t("No")}</Badge>;
      case "NA": return <Badge className="bg-gray-100 text-gray-600">{t("N/A")}</Badge>;
      default: return <Badge variant="outline">{t("Not Answered")}</Badge>;
    }
  };

  const sortedResponses = [...(assessment?.responses || [])].sort((a, b) => a.questionNo - b.questionNo);

  const roleLabel = role === "assessor" ? t("Assessor") : role === "rm" ? t("Relationship Manager") : t("Business Owner");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="p-6 space-y-6">
        <Button variant="ghost" onClick={() => router.push(backPath)}>
          <ArrowLeft className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Back")}
        </Button>
        <div className="text-center py-12 text-muted-foreground">{t("Assessment not found")}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span
          className="text-slate-500 cursor-pointer hover:text-primary-700"
          onClick={() => router.push(backPath)}
        >
          {t("Assessments")}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Offboard Review")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(backPath)}>
            <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Back")}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t("Offboard Assessment Review")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {assessment.assessmentCode} &middot; {roleLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-orange-100 text-orange-700 text-sm px-3 py-1">
            {t(assessment.status.replace(/_/g, " "))}
          </Badge>
          {!isAuditor && role === "assessor" && (
            <>
              <Button
                onClick={() => handleAction("assessor-approve")}
                className="bg-green-600 text-white hover:bg-green-700"
                disabled={actionLoading}
              >
                <CheckCircle2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Approve")}
              </Button>
              <Button
                onClick={() => handleAction("assessor-send-back")}
                className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200"
                disabled={actionLoading}
              >
                {t("Send Back to Vendor")}
              </Button>
            </>
          )}
          {!isAuditor && role === "rm" && (
            <>
              <Button
                onClick={() => handleAction("rm-approve")}
                className="bg-green-600 text-white hover:bg-green-700"
                disabled={actionLoading}
              >
                <CheckCircle2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Approve")}
              </Button>
              <Button
                onClick={() => handleAction("rm-send-back")}
                className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200"
                disabled={actionLoading}
              >
                {t("Send to Vendor")}
              </Button>
            </>
          )}
          {!isAuditor && role === "bo" && (
            <>
              <Button
                onClick={() => handleAction("bo-approve")}
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={actionLoading}
              >
                {t("Approve Termination")}
              </Button>
              <Button
                onClick={() => handleAction("bo-send-to-rm")}
                className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200"
                disabled={actionLoading}
              >
                {t("Send to RM")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Assessment Info */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-3 uppercase text-muted-foreground">{t("Assessment Details")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block mb-0.5">{t("Vendor")}</span>
              <span className="font-medium">{assessment.vendorName}</span>
              <span className="text-muted-foreground ml-1">({assessment.vendorCode})</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">{t("Assessment Code")}</span>
              <span className="font-mono font-medium">{assessment.assessmentCode}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">{t("Initiated By")}</span>
              <span className="font-medium">{assessment.initiatedBy || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">{t("Date")}</span>
              <span className="font-medium">{new Date(assessment.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offboarding Responses */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          {t("Offboarding Responses")} ({sortedResponses.length})
        </h2>
        <div className="space-y-3">
          {sortedResponses.map((r, idx) => (
            <Card key={r.id} className={r.isFlagged ? "border-amber-400 bg-amber-50/30" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-muted-foreground">Q{idx + 1}</span>
                      <span className="font-medium">{r.questionTitle}</span>
                      {r.isFlagged && <Flag className="h-4 w-4 text-amber-500" />}
                    </div>
                    {r.questionText && (
                      <p className="text-sm text-muted-foreground mt-1">{r.questionText}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getResponseIcon(r.response)}
                    {getResponseBadge(r.response)}
                  </div>
                </div>
                {r.comment && (
                  <div className="text-sm bg-muted/50 rounded-md p-3">
                    <span className="font-medium">{t("Comment")}:</span> {r.comment}
                  </div>
                )}
                {r.artifactUrl && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <a href={r.artifactUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {r.artifactName || t("Attachment")}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

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
    </div>
  );
}

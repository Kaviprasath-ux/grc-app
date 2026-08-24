"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslatedRecord, triggerTranslation } from "@/hooks/useTranslatedData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Home, ArrowLeft, Send, Save, Flag, Upload, MessageSquare,
  Loader2, FileText, AlertCircle, CheckCircle2,
} from "lucide-react";

import { FileInput } from "@/components/shared/file-input";
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
  isDelegated: boolean;
  delegatedToId: string | null;
  delegatedTo: { id: string; fullName: string } | null;
}

interface AssessmentDetail {
  id: string;
  assessmentCode: string;
  status: string;
  vendorName: string;
  vendorCode: string;
  initiatedBy: string | null;
  createdAt: string;
  responses: OffboardResponse[];
}

export default function AMOffboardQuestionnairePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [responses, setResponses] = useState<Record<string, OffboardResponse>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic data translation for assessment
  const { data: translatedAssessment } = useTranslatedRecord(assessment, { modelName: 'TPRMAssessment' });

  const fetchAssessment = useCallback(async () => {
    try {
      const res = await fetch(`/api/tprm/offboard-assessments/${assessmentId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setAssessment(json);

      const respMap: Record<string, OffboardResponse> = {};
      if (json.responses) {
        for (const r of json.responses) {
          respMap[r.questionId] = r;
        }
      }
      setResponses(respMap);
    } catch {
      toast({ title: t("Error"), description: t("Failed to load offboard assessment"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [assessmentId, toast, t]);

  useEffect(() => { fetchAssessment(); }, [fetchAssessment]);

  const isReadOnly = assessment?.status && !["Offboard_In_Progress", "Offboard_Awaiting_Response"].includes(assessment.status);

  // Auto-save debounced
  const autoSave = useCallback((questionId: string, data: Partial<OffboardResponse>) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/tprm/offboard-assessments/${assessmentId}/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, ...data }),
        });
      } catch {
        console.error("Auto-save failed for question", questionId);
      }
    }, 800);
  }, [assessmentId]);

  const handleResponseChange = (questionId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionId, response: value } as OffboardResponse,
    }));
    autoSave(questionId, { response: value } as Partial<OffboardResponse>);
  };

  const handleFlagToggle = (questionId: string) => {
    const current = responses[questionId]?.isFlagged || false;
    setResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionId, isFlagged: !current } as OffboardResponse,
    }));
    autoSave(questionId, { isFlagged: !current } as Partial<OffboardResponse>);
  };

  const handleCommentSave = () => {
    if (!activeQuestionId) return;
    setResponses(prev => ({
      ...prev,
      [activeQuestionId]: { ...prev[activeQuestionId], questionId: activeQuestionId, comment: commentText } as OffboardResponse,
    }));
    autoSave(activeQuestionId, { comment: commentText } as Partial<OffboardResponse>);
    // Trigger translation for the comment
    if (commentText) {
      triggerTranslation('TPRMOffboardResponse', activeQuestionId, { comment: commentText });
    }
    setCommentDialogOpen(false);
    setActiveQuestionId(null);
    setCommentText("");
  };

  const handleFileUpload = async (questionId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("questionId", questionId);

    try {
      const res = await fetch(`/api/tprm/offboard-assessments/${assessmentId}/responses`, {
        method: "PUT",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      setResponses(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          questionId,
          artifactUrl: json.url,
          artifactName: json.name,
        } as OffboardResponse,
      }));
      toast({ title: t("Success"), description: t("File uploaded successfully") });
    } catch {
      toast({ title: t("Error"), description: t("Failed to upload file"), variant: "destructive" });
    }
  };

  const handleSaveAll = async () => {
    const allResponses = assessment?.responses || [];
    const answeredResponses = allResponses
      .filter(r => responses[r.questionId]?.response)
      .map(r => ({
        questionId: r.questionId,
        response: responses[r.questionId].response,
        comment: responses[r.questionId]?.comment || null,
      }));

    if (answeredResponses.length === 0) {
      toast({ title: t("No Data"), description: t("No responses to save"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/tprm/offboard-assessments/${assessmentId}/responses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: answeredResponses }),
      });
      if (!res.ok) throw new Error("Save failed");
      // Trigger translation for text-based response fields (comments)
      for (const r of answeredResponses) {
        if (r.comment) {
          triggerTranslation('TPRMOffboardResponse', r.questionId, { comment: r.comment });
        }
      }
      toast({ title: t("Success"), description: `${answeredResponses.length} ${t("responses saved successfully")}` });
    } catch {
      toast({ title: t("Error"), description: t("Failed to save responses"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setShowSubmitConfirm(false);
    try {
      const res = await fetch(`/api/tprm/offboard-assessments/${assessmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: t("Error"), description: json.error || t("Cannot submit assessment"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Offboard assessment submitted successfully") });
      // Trigger translation for the offboard assessment
      triggerTranslation('TPRMAssessment', assessmentId, {});
      router.push("/tprm/am-assessments");
    } catch {
      toast({ title: t("Error"), description: t("Failed to submit assessment"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Stats
  const totalQuestions = assessment?.responses?.length || 0;
  const answeredQuestions = assessment?.responses?.filter(r => responses[r.questionId]?.response).length || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {t("Offboard assessment not found")}
      </div>
    );
  }

  const sortedResponses = [...(assessment.responses || [])].sort((a, b) => a.questionNo - b.questionNo);

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <span>/</span>
        <span>{t("TPRM")}</span>
        <span>/</span>
        <button onClick={() => router.push("/tprm/am-assessments")} className="hover:underline">
          {t("Assessments")}
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">{t("Offboard Assessment")}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/tprm/am-assessments")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{t("Offboard Assessment")}</h1>
            <p className="text-sm text-muted-foreground">
              {assessment.assessmentCode} - {assessment.vendorName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="text-sm bg-orange-100 text-orange-700">{t(assessment.status.replace(/_/g, " "))}</Badge>
          <span className="text-sm text-muted-foreground">
            {answeredQuestions}/{totalQuestions} {t("answered")}
          </span>
          {!isReadOnly && (
            <Button variant="outline" onClick={handleSaveAll} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
              {t("Save")}
            </Button>
          )}
          {!isReadOnly && (
            <Button onClick={() => setShowSubmitConfirm(true)} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
              {t("Submit Assessment")}
            </Button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      {assessment.status === "Offboard_Awaiting_Response" && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
          {t("This assessment was returned for updates. Please review and resubmit.")}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {sortedResponses.map((qr, idx) => {
          const resp = responses[qr.questionId];
          return (
            <Card key={qr.id} className={`${resp?.isFlagged ? "border-amber-400 bg-amber-50/30" : ""}`}>
              <CardContent className="p-4 space-y-3">
                {/* Question header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">Q{idx + 1}</span>
                      <span className="font-medium text-sm">{qr.questionTitle}</span>
                    </div>
                    {qr.questionText && (
                      <p className="text-sm text-muted-foreground">{qr.questionText}</p>
                    )}
                  </div>
                  {/* Action buttons */}
                  {!isReadOnly && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={resp?.isFlagged ? "text-amber-500" : "text-muted-foreground"}
                        onClick={() => handleFlagToggle(qr.questionId)}
                        title={t("Flag for review")}
                      >
                        <Flag className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={resp?.comment ? "text-blue-500" : "text-muted-foreground"}
                        onClick={() => {
                          setActiveQuestionId(qr.questionId);
                          setCommentText(resp?.comment || "");
                          setCommentDialogOpen(true);
                        }}
                        title={t("Add comment")}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Response */}
                <div className="flex items-center gap-6">
                  <RadioGroup
                    value={resp?.response || ""}
                    onValueChange={v => handleResponseChange(qr.questionId, v)}
                    className="flex items-center gap-4"
                    disabled={!!isReadOnly}
                  >
                    {["Yes", "No", "NA"].map(opt => (
                      <div key={opt} className="flex items-center gap-1.5">
                        <RadioGroupItem value={opt} id={`${qr.questionId}-${opt}`} />
                        <Label htmlFor={`${qr.questionId}-${opt}`} className="text-sm cursor-pointer">
                          {t(opt)}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {resp?.response ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  )}
                </div>

                {/* Comment display (read-only or when filled) */}
                {resp?.comment && (
                  <div className="text-sm bg-muted/50 rounded p-2">
                    <span className="font-medium">{t("Comment")}:</span> {resp.comment}
                  </div>
                )}

                {/* Artifact upload */}
                <div className="flex items-center gap-3">
                  {resp?.artifactUrl && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <a href={resp.artifactUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {resp.artifactName || t("Uploaded")}
                      </a>
                    </div>
                  )}
                  {!isReadOnly && (
                    <Label className="cursor-pointer">
                      <FileInput
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(qr.questionId, file);
                        }}
                      />
                      <span className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                        <Upload className="h-3.5 w-3.5" />
                        {resp?.artifactUrl ? t("Replace file") : t("Upload file")}
                      </span>
                    </Label>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comment Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="!max-w-md w-[90vw]">
          <DialogHeader>
            <DialogTitle>{t("Add Comment")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder={t("Enter your comment...")}
            rows={4}
            disabled={!!isReadOnly}
          />
          <DialogFooter>
            {!isReadOnly && (
              <Button onClick={handleCommentSave} className="bg-primary/90 hover:bg-primary text-primary-foreground">
                {t("Save")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setCommentDialogOpen(false)}>
              {t("Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Confirmation */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="!max-w-md w-[90vw]">
          <DialogHeader>
            <DialogTitle>{t("Submit Offboard Assessment")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("Are you sure you want to submit this offboard assessment? It will be sent for review.")}
          </p>
          <p className="text-sm text-muted-foreground">
            {answeredQuestions}/{totalQuestions} {t("questions answered")}
          </p>
          <DialogFooter className="gap-2">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Submit")}
            </Button>
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>
              {t("Cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

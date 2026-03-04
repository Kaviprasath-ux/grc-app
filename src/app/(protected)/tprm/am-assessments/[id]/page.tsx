"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Home, ArrowLeft, Send, Flag, Users, Upload, MessageSquare,
  Loader2, FileText, AlertCircle, CheckCircle2, Filter,
} from "lucide-react";

interface Question {
  id: string;
  questionText: string;
  domainId: string | null;
  domainName: string;
  isParentQuestion: boolean;
  parentId: string | null;
  mandatoryAttachment: boolean;
  mandatoryQuestion: boolean;
  sortOrder: number;
  children: { id: string; questionText: string; mandatoryAttachment: boolean; mandatoryQuestion: boolean; sortOrder: number }[];
}

interface AssessmentResponse {
  id: string;
  questionId: string;
  response: string | null;
  comment: string | null;
  artifactUrl: string | null;
  artifactName: string | null;
  isFlagged: boolean;
  isDelegated: boolean;
}

interface Domain {
  id: string;
  name: string;
}

interface AssessmentDetail {
  id: string;
  assessmentCode: string;
  status: string;
  questionnaireTemplate: string | null;
  vendor: { id: string; name: string; vendorCode: string };
  initiatedBy: { fullName: string } | null;
  responses: AssessmentResponse[];
}

export default function AMResponseQuestionnairePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [responses, setResponses] = useState<Record<string, AssessmentResponse>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAssessment = useCallback(async () => {
    try {
      const res = await fetch(`/api/tprm/am-assessments/${assessmentId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setAssessment(json.assessment);
      setQuestions(json.questions || []);
      setDomains(json.domains || []);

      // Build response map
      const respMap: Record<string, AssessmentResponse> = {};
      if (json.assessment?.responses) {
        for (const r of json.assessment.responses) {
          respMap[r.questionId] = r;
        }
      }
      setResponses(respMap);
    } catch {
      toast({ title: t("Error"), description: t("Failed to load assessment"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [assessmentId, toast, t]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  // Auto-save debounced
  const autoSave = useCallback((questionId: string, data: Partial<AssessmentResponse>) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const question = questions.find(q => q.id === questionId) || questions.flatMap(q => q.children).find(c => c.id === questionId);
        await fetch(`/api/tprm/am-assessments/${assessmentId}/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId,
            domainId: questions.find(q => q.id === questionId)?.domainId,
            ...data,
          }),
        });
      } catch {
        console.error("Auto-save failed for question", questionId);
      }
    }, 800);
  }, [assessmentId, questions]);

  const handleResponseChange = (questionId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionId, response: value } as AssessmentResponse,
    }));
    autoSave(questionId, { response: value });
  };

  const handleFlagToggle = (questionId: string) => {
    const current = responses[questionId]?.isFlagged || false;
    setResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionId, isFlagged: !current } as AssessmentResponse,
    }));
    autoSave(questionId, { isFlagged: !current } as Partial<AssessmentResponse>);
  };

  const handleCommentSave = () => {
    if (!activeQuestionId) return;
    setResponses(prev => ({
      ...prev,
      [activeQuestionId]: { ...prev[activeQuestionId], questionId: activeQuestionId, comment: commentText } as AssessmentResponse,
    }));
    autoSave(activeQuestionId, { comment: commentText });
    setCommentDialogOpen(false);
    setActiveQuestionId(null);
    setCommentText("");
  };

  const handleFileUpload = async (questionId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("questionId", questionId);

    try {
      const res = await fetch(`/api/tprm/am-assessments/${assessmentId}/responses/upload`, {
        method: "POST",
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
        } as AssessmentResponse,
      }));
      toast({ title: t("Success"), description: t("File uploaded successfully") });
    } catch {
      toast({ title: t("Error"), description: t("Failed to upload file"), variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tprm/am-assessments/${assessmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: t("Validation Error"),
          description: json.error || t("Cannot submit assessment"),
          variant: "destructive",
        });
        return;
      }
      toast({ title: t("Success"), description: t("Assessment submitted successfully") });
      router.push("/tprm/am-assessments");
    } catch {
      toast({ title: t("Error"), description: t("Failed to submit assessment"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter questions by domain and mode
  const filteredQuestions = questions.filter(q => {
    if (selectedDomain !== "all" && q.domainId !== selectedDomain) return false;
    if (filterMode === "mandatory-attachments" && !q.mandatoryAttachment) return false;
    if (filterMode === "flagged" && !responses[q.id]?.isFlagged) return false;
    if (filterMode === "unanswered" && responses[q.id]?.response) return false;
    return true;
  });

  // Stats
  const totalQuestions = questions.length;
  const answeredQuestions = questions.filter(q => responses[q.id]?.response).length;
  const isReadOnly = assessment?.status && !["Draft", "In Progress", "Returned"].includes(assessment.status);

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
        {t("Assessment not found")}
      </div>
    );
  }

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
        <span className="text-foreground font-medium">{assessment.assessmentCode}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/tprm/am-assessments")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{t("Response Questionnaire")}</h1>
            <p className="text-sm text-muted-foreground">
              {assessment.assessmentCode} - {assessment.vendor.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="text-sm">{t(assessment.status)}</Badge>
          <span className="text-sm text-muted-foreground">
            {answeredQuestions}/{totalQuestions} {t("answered")}
          </span>
          {!isReadOnly && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
              {t("Submit Assessment")}
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm">{t("Domain")}:</Label>
          <Select value={selectedDomain} onValueChange={setSelectedDomain}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Domains")}</SelectItem>
              {domains.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterMode} onValueChange={setFilterMode}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Questions")}</SelectItem>
              <SelectItem value="mandatory-attachments">{t("Mandatory Attachments")}</SelectItem>
              <SelectItem value="flagged">{t("Flagged")}</SelectItem>
              <SelectItem value="unanswered">{t("Unanswered")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              {t("No questions match the selected filters")}
            </CardContent>
          </Card>
        ) : (
          filteredQuestions.map((q, idx) => {
            const resp = responses[q.id];
            return (
              <Card key={q.id} className={`${resp?.isFlagged ? "border-amber-400 bg-amber-50/30" : ""}`}>
                <CardContent className="p-4 space-y-3">
                  {/* Question header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-muted-foreground">Q{idx + 1}</span>
                        {q.domainName && (
                          <Badge variant="outline" className="text-xs">{q.domainName}</Badge>
                        )}
                        {q.mandatoryQuestion && (
                          <Badge variant="destructive" className="text-xs">{t("Mandatory")}</Badge>
                        )}
                        {q.mandatoryAttachment && (
                          <Badge className="bg-amber-100 text-amber-700 text-xs">{t("Attachment Required")}</Badge>
                        )}
                      </div>
                      <p className="text-sm">{q.questionText}</p>
                    </div>
                    {/* Action buttons */}
                    {!isReadOnly && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={resp?.isFlagged ? "text-amber-500" : "text-muted-foreground"}
                          onClick={() => handleFlagToggle(q.id)}
                          title={t("Flag for review")}
                        >
                          <Flag className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={resp?.comment ? "text-blue-500" : "text-muted-foreground"}
                          onClick={() => {
                            setActiveQuestionId(q.id);
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
                      onValueChange={v => handleResponseChange(q.id, v)}
                      className="flex items-center gap-4"
                      disabled={!!isReadOnly}
                    >
                      {["Yes", "No", "NA"].map(opt => (
                        <div key={opt} className="flex items-center gap-1.5">
                          <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                          <Label htmlFor={`${q.id}-${opt}`} className="text-sm cursor-pointer">
                            {t(opt)}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>

                    {/* Status indicator */}
                    {resp?.response ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : q.mandatoryQuestion ? (
                      <AlertCircle className="h-4 w-4 text-red-400" />
                    ) : null}
                  </div>

                  {/* Artifact upload */}
                  <div className="flex items-center gap-3">
                    {resp?.artifactUrl ? (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span className="text-blue-600">{resp.artifactName || t("Uploaded")}</span>
                      </div>
                    ) : null}
                    {!isReadOnly && (
                      <Label className="cursor-pointer">
                        <Input
                          type="file"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(q.id, file);
                          }}
                        />
                        <span className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                          <Upload className="h-3.5 w-3.5" />
                          {resp?.artifactUrl ? t("Replace") : t("Upload Artifact")}
                        </span>
                      </Label>
                    )}
                  </div>

                  {/* Comment display (read-only) */}
                  {resp?.comment && (
                    <div className="bg-slate-50 p-2 rounded text-sm text-muted-foreground">
                      <strong>{t("Comment")}:</strong> {resp.comment}
                    </div>
                  )}

                  {/* Child questions */}
                  {q.children && q.children.length > 0 && (
                    <div className="ltr:ml-6 rtl:mr-6 space-y-3 border-l-2 border-slate-200 ltr:pl-4 rtl:pr-4">
                      {q.children.map((child, cIdx) => {
                        const childResp = responses[child.id];
                        return (
                          <div key={child.id} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Q{idx + 1}.{cIdx + 1}</span>
                              {child.mandatoryQuestion && (
                                <Badge variant="destructive" className="text-xs">{t("Mandatory")}</Badge>
                              )}
                            </div>
                            <p className="text-sm">{child.questionText}</p>
                            <RadioGroup
                              value={childResp?.response || ""}
                              onValueChange={v => handleResponseChange(child.id, v)}
                              className="flex items-center gap-4"
                              disabled={!!isReadOnly}
                            >
                              {["Yes", "No", "NA"].map(opt => (
                                <div key={opt} className="flex items-center gap-1.5">
                                  <RadioGroupItem value={opt} id={`${child.id}-${opt}`} />
                                  <Label htmlFor={`${child.id}-${opt}`} className="text-sm cursor-pointer">
                                    {t(opt)}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Comment Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Add Comment")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder={t("Enter your comment...")}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentDialogOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleCommentSave}>{t("Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

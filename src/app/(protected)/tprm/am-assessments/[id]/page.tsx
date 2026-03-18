"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Home, ArrowLeft, Send, Save, Flag, Upload, Download, MessageSquare,
  Loader2, FileText, AlertCircle, CheckCircle2, Filter, ChevronDown,
  ChevronRight, Bot, RefreshCw, XCircle, ShieldCheck, ShieldAlert, ShieldOff, UserPlus,
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
  validateThroughAI?: boolean;
  sortOrder: number;
  children: { id: string; questionText: string; mandatoryAttachment: boolean; mandatoryQuestion: boolean; validateThroughAI?: boolean; sortOrder: number }[];
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
  delegatedToId?: string | null;
  delegatedTo?: { id: string; fullName: string } | null;
  // AI evaluation fields
  poScore?: number | null;
  poStatus?: string | null;
  poAnswer?: string | null;
  poIssue?: string | null;
  poRisk?: string | null;
  poRecommendation?: string | null;
  poSeverity?: string | null;
  aiEvaluatedAt?: string | null;
}

interface SME {
  id: string;
  fullName: string;
  email: string;
  tprmFunctionCategory: string | null;
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
  aiEvaluationStatus?: string | null;
  aiEvaluationStarted?: string | null;
  aiEvaluationCompleted?: string | null;
  aiEvaluationError?: string | null;
}

interface AIStatus {
  aiEvaluationStatus: string | null;
  aiEvaluationStarted: string | null;
  aiEvaluationCompleted: string | null;
  aiEvaluationError: string | null;
}

// AI status badge helper
function AIStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  switch (status) {
    case "Satisfactory":
      return <Badge className="bg-green-100 text-green-700 text-xs gap-1"><ShieldCheck className="h-3 w-3" />{status}</Badge>;
    case "Unsatisfactory":
      return <Badge className="bg-red-100 text-red-700 text-xs gap-1"><ShieldAlert className="h-3 w-3" />{status}</Badge>;
    case "Not_Applicable":
      return <Badge className="bg-gray-100 text-gray-600 text-xs gap-1"><ShieldOff className="h-3 w-3" />N/A</Badge>;
    case "Failed":
      return <Badge className="bg-orange-100 text-orange-700 text-xs gap-1"><XCircle className="h-3 w-3" />{status}</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

export default function AMResponseQuestionnairePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const { data: sessionData } = useSession();
  const assessmentId = params.id as string;

  const isSME = sessionData?.user?.roles?.includes("TPRMSME") || false;
  const currentUserId = sessionData?.user?.id;

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [responses, setResponses] = useState<Record<string, AssessmentResponse>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Translation hooks — must be before any early returns
  const { data: translatedQuestions } = useTranslatedData(questions, { modelName: 'TPRMMasterQuestion' });
  const { data: translatedDomains } = useTranslatedData(domains, { modelName: 'TPRMDomain' });

  // Vendor name translation
  const vendorArray = useMemo(() => assessment?.vendor ? [assessment.vendor] : [], [assessment]);
  const { data: translatedVendors } = useTranslatedData(vendorArray, { modelName: 'TPRMVendor' });
  const translatedVendorName = translatedVendors[0]?.name || assessment?.vendor?.name || "";

  // Domain name lookup for question badges
  const tDomain = useCallback((domainName: string) => {
    const found = translatedDomains.find(d => d.name === domainName || domains.find(od => od.name === domainName && od.id === d.id));
    return found?.name || domainName;
  }, [translatedDomains, domains]);

  // SME assignment state
  const [smeList, setSmeList] = useState<SME[]>([]);
  const [smeDialogOpen, setSmeDialogOpen] = useState(false);
  const [smeQuestionId, setSmeQuestionId] = useState<string | null>(null);
  const [selectedSmeId, setSelectedSmeId] = useState<string>("");

  // AI evaluation state
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [aiPolling, setAiPolling] = useState(false);
  const [retriggering, setRetriggering] = useState(false);
  const aiPollRef = useRef<NodeJS.Timeout | null>(null);

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

      // Set initial AI status from assessment
      if (json.assessment) {
        setAiStatus({
          aiEvaluationStatus: json.assessment.aiEvaluationStatus,
          aiEvaluationStarted: json.assessment.aiEvaluationStarted,
          aiEvaluationCompleted: json.assessment.aiEvaluationCompleted,
          aiEvaluationError: json.assessment.aiEvaluationError,
        });

        // Start polling if AI evaluation is in progress
        const status = json.assessment.aiEvaluationStatus;
        if (status === "Pending" || status === "Ingesting" || status === "Evaluating") {
          startAIPolling();
        }
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load assessment"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [assessmentId, toast, t]);

  useEffect(() => {
    fetchAssessment();
    return () => {
      if (aiPollRef.current) clearInterval(aiPollRef.current);
    };
  }, [fetchAssessment]);

  // AI status polling
  const startAIPolling = useCallback(() => {
    if (aiPollRef.current) clearInterval(aiPollRef.current);
    setAiPolling(true);

    aiPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/tprm/am-assessments/${assessmentId}/ai-status`);
        if (!res.ok) return;
        const data: AIStatus = await res.json();
        setAiStatus(data);

        // Stop polling when completed or failed
        if (data.aiEvaluationStatus === "Completed" || data.aiEvaluationStatus === "Failed") {
          if (aiPollRef.current) clearInterval(aiPollRef.current);
          setAiPolling(false);

          // Refresh assessment data to get AI results on responses
          if (data.aiEvaluationStatus === "Completed") {
            const assessRes = await fetch(`/api/tprm/am-assessments/${assessmentId}`);
            if (assessRes.ok) {
              const json = await assessRes.json();
              const respMap: Record<string, AssessmentResponse> = {};
              if (json.assessment?.responses) {
                for (const r of json.assessment.responses) {
                  respMap[r.questionId] = r;
                }
              }
              setResponses(respMap);
            }
          }
        }
      } catch {
        // Silently continue polling
      }
    }, 5000);
  }, [assessmentId]);

  // Auto-save debounced
  const autoSave = useCallback((questionId: string, data: Partial<AssessmentResponse>) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
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
    // Trigger translation for the comment
    if (commentText) {
      triggerTranslation('TPRMAssessmentResponse', activeQuestionId, { comment: commentText });
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

  const handleSaveAll = async () => {
    const allQuestions = questions.flatMap(q => [q, ...(q.children || []).map(c => ({ ...c, domainId: q.domainId }))]);
    const answeredResponses = allQuestions
      .filter(q => responses[q.id]?.response)
      .map(q => ({
        questionId: q.id,
        domainId: "domainId" in q ? q.domainId : null,
        response: responses[q.id].response,
        comment: responses[q.id]?.comment || null,
      }));

    if (answeredResponses.length === 0) {
      toast({ title: t("No Data"), description: t("No responses to save"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/tprm/am-assessments/${assessmentId}/responses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: answeredResponses }),
      });
      if (!res.ok) throw new Error("Save failed");
      // Trigger translation for text-based response fields (comments)
      for (const r of answeredResponses) {
        if (r.comment) {
          triggerTranslation('TPRMAssessmentResponse', r.questionId, { comment: r.comment });
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
      toast({ title: t("Success"), description: t("Assessment submitted successfully. AI evaluation has started.") });
      // Trigger translation for the assessment record
      if (assessment) {
        triggerTranslation('TPRMAssessment', assessmentId, {
          questionnaireTemplate: assessment.questionnaireTemplate || '',
        });
      }
      // Navigate back to assessments list
      router.push("/tprm/am-assessments");
    } catch {
      toast({ title: t("Error"), description: t("Failed to submit assessment"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetriggerAI = async () => {
    setRetriggering(true);
    try {
      const res = await fetch(`/api/tprm/am-assessments/${assessmentId}/ai-evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: t("Error"), description: json.error || t("Failed to re-trigger AI evaluation"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("AI evaluation re-triggered") });
      setAiStatus({ aiEvaluationStatus: "Pending", aiEvaluationStarted: new Date().toISOString(), aiEvaluationCompleted: null, aiEvaluationError: null });
      startAIPolling();
    } catch {
      toast({ title: t("Error"), description: t("Failed to re-trigger AI evaluation"), variant: "destructive" });
    } finally {
      setRetriggering(false);
    }
  };

  // Export questions to Excel
  const handleExport = async (domainOnly: boolean) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const targetQuestions = domainOnly && selectedDomain !== "all"
        ? translatedQuestions.filter(q => q.domainId === selectedDomain)
        : translatedQuestions;

      const rows: (string | null)[][] = [
        ["QuestionID", "Q#", "Domain", "Question", "Mandatory", "Response (Yes/No)", "Comment"],
      ];

      let qNum = 0;
      for (const q of targetQuestions) {
        qNum++;
        const resp = responses[q.id];
        rows.push([
          q.id,
          `Q${qNum}`,
          q.domainName || "",
          q.questionText,
          q.mandatoryQuestion ? "Yes" : "No",
          resp?.response || null,
          resp?.comment || null,
        ]);
        if (q.children?.length) {
          q.children.forEach((child, cIdx) => {
            const childResp = responses[child.id];
            rows.push([
              child.id,
              `Q${qNum}.${cIdx + 1}`,
              q.domainName || "",
              child.questionText,
              child.mandatoryQuestion ? "Yes" : "No",
              childResp?.response || null,
              childResp?.comment || null,
            ]);
          });
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [
        { wch: 0.1, hidden: true },
        { wch: 8 },
        { wch: 25 },
        { wch: 60 },
        { wch: 12 },
        { wch: 12 },
        { wch: 40 },
      ];

      const domainLabel = domainOnly && selectedDomain !== "all"
        ? domains.find(d => d.id === selectedDomain)?.name || "Domain"
        : "All";
      const sheetName = (domainLabel === "All" ? "All Questions" : domainLabel).substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const code = assessment?.assessmentCode || "Assessment";
      const safeDomain = domainLabel.replace(/[^a-zA-Z0-9]/g, "_");
      XLSX.writeFile(wb, `${code}_${safeDomain}_Questions.xlsx`);

      toast({ title: t("Success"), description: t("Questions exported successfully") });
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: t("Error"), description: t("Failed to export questions"), variant: "destructive" });
    }
  };

  // Import responses from Excel
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      const bulkResponses: { questionId: string; response: string; comment?: string; domainId?: string | null }[] = [];
      const allQuestionsFlat = questions.flatMap(q => [q, ...(q.children || []).map(c => ({ ...c, domainId: q.domainId }))]);

      for (const row of rows) {
        const questionId = row["QuestionID"];
        const rawResponse = (row["Response (Yes/No)"] || row["Response"] || "").trim();
        const comment = (row["Comment"] || "").trim();

        if (!questionId || !rawResponse) continue;

        const normalized = rawResponse.charAt(0).toUpperCase() + rawResponse.slice(1).toLowerCase();
        const validResponse = ["Yes", "No", "Na"].includes(normalized)
          ? (normalized === "Na" ? "NA" : normalized)
          : null;
        if (!validResponse) continue;

        const question = allQuestionsFlat.find(q => q.id === questionId);
        bulkResponses.push({
          questionId,
          response: validResponse,
          ...(comment ? { comment } : {}),
          domainId: question && "domainId" in question ? question.domainId : undefined,
        });
      }

      if (bulkResponses.length === 0) {
        toast({ title: t("No Data"), description: t("No valid responses found in the file"), variant: "destructive" });
        return;
      }

      const res = await fetch(`/api/tprm/am-assessments/${assessmentId}/responses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: bulkResponses }),
      });

      if (!res.ok) throw new Error("Bulk save failed");

      setResponses(prev => {
        const updated = { ...prev };
        for (const r of bulkResponses) {
          updated[r.questionId] = {
            ...updated[r.questionId],
            questionId: r.questionId,
            response: r.response,
            ...(r.comment ? { comment: r.comment } : {}),
          } as AssessmentResponse;
        }
        return updated;
      });

      // Trigger translation for imported comments
      for (const r of bulkResponses) {
        if (r.comment) {
          triggerTranslation('TPRMAssessmentResponse', r.questionId, { comment: r.comment });
        }
      }

      toast({
        title: t("Success"),
        description: `${t("Updated")} ${bulkResponses.length} ${t("of")} ${rows.length} ${t("responses")}`,
      });
    } catch (err) {
      console.error("Import error:", err);
      toast({ title: t("Error"), description: t("Failed to import responses"), variant: "destructive" });
    }
  };

  // Fetch SMEs for assignment (AM only)
  const fetchSMEs = useCallback(async () => {
    if (isSME) return;
    try {
      const res = await fetch("/api/tprm/am-sme-management");
      if (res.ok) {
        const json = await res.json();
        setSmeList((json.data || []).filter((s: SME & { isActive?: boolean }) => s.isActive !== false));
      }
    } catch { /* ignore */ }
  }, [isSME]);

  useEffect(() => { fetchSMEs(); }, [fetchSMEs]);

  const handleAssignSME = async () => {
    if (!smeQuestionId) return;
    const smeId = selectedSmeId === "__unassign__" ? "" : selectedSmeId;
    try {
      const res = await fetch(`/api/tprm/am-assessments/${assessmentId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: smeQuestionId,
          isDelegated: !!smeId,
          delegatedToId: smeId || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const smeUser = smeList.find(s => s.id === smeId);
      setResponses(prev => ({
        ...prev,
        [smeQuestionId]: {
          ...prev[smeQuestionId],
          questionId: smeQuestionId,
          isDelegated: !!smeId,
          delegatedToId: smeId || null,
          delegatedTo: smeUser ? { id: smeId, fullName: smeUser.fullName } : null,
        } as AssessmentResponse,
      }));
      setSmeDialogOpen(false);
      setSmeQuestionId(null);
      setSelectedSmeId("");
      toast({ title: t("Success"), description: smeId ? t("SME assigned successfully") : t("SME unassigned") });
    } catch {
      toast({ title: t("Error"), description: t("Failed to assign SME"), variant: "destructive" });
    }
  };

  // Filter questions by domain and mode
  const filteredQuestions = translatedQuestions.filter(q => {
    // SME users only see questions assigned to them
    if (isSME && currentUserId) {
      const resp = responses[q.id];
      if (!resp?.isDelegated || resp?.delegatedToId !== currentUserId) return false;
    }
    if (selectedDomain !== "all" && q.domainId !== selectedDomain) return false;
    if (filterMode === "mandatory-attachments" && !q.mandatoryAttachment) return false;
    if (filterMode === "flagged" && !responses[q.id]?.isFlagged) return false;
    if (filterMode === "unanswered" && responses[q.id]?.response) return false;
    return true;
  });

  // Stats
  const totalQuestions = translatedQuestions.length;
  const answeredQuestions = translatedQuestions.filter(q => responses[q.id]?.response).length;
  const isReadOnly = assessment?.status && !["Draft", "In Progress", "In-Progress", "Initiated", "Awaiting_Response"].includes(assessment.status);

  // AI evaluation status helpers
  const isAIInProgress = aiStatus?.aiEvaluationStatus === "Pending" || aiStatus?.aiEvaluationStatus === "Ingesting" || aiStatus?.aiEvaluationStatus === "Evaluating";
  const isAICompleted = aiStatus?.aiEvaluationStatus === "Completed";
  const isAIFailed = aiStatus?.aiEvaluationStatus === "Failed";
  const isAINotStarted = !aiStatus?.aiEvaluationStatus && assessment?.status === "Submitted";
  const showAIBanner = !!aiStatus?.aiEvaluationStatus || isAINotStarted;

  // Render AI result section for a question
  const renderAIResult = (resp: AssessmentResponse | undefined) => {
    if (!resp?.poStatus) return null;

    return (
      <Collapsible>
        <div className="flex items-center gap-2 mt-2">
          <Bot className="h-4 w-4 text-purple-500" />
          <span className="text-xs font-medium text-purple-700">{t("AI Evaluation")}</span>
          <AIStatusBadge status={resp.poStatus} />
          {resp.poScore != null && (
            <Badge variant="outline" className="text-xs">{Math.round(resp.poScore)}%</Badge>
          )}
          {(resp.poAnswer || resp.poIssue || resp.poRisk || resp.poRecommendation) && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 px-1">
                <ChevronRight className="h-3 w-3" />
                <span className="text-xs">{t("Details")}</span>
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
        <CollapsibleContent>
          <div className="mt-2 p-3 bg-purple-50/50 rounded-md border border-purple-100 space-y-2 text-sm">
            {resp.poAnswer && (
              <div>
                <span className="font-medium text-purple-800">{t("AI Answer")}:</span>
                <p className="text-muted-foreground mt-0.5">{resp.poAnswer}</p>
              </div>
            )}
            {resp.poIssue && (
              <div>
                <span className="font-medium text-red-700">{t("Issue")}:</span>
                <p className="text-muted-foreground mt-0.5">{resp.poIssue}</p>
              </div>
            )}
            {resp.poRisk && (
              <div>
                <span className="font-medium text-orange-700">{t("Risk")}:</span>
                <p className="text-muted-foreground mt-0.5">{resp.poRisk}</p>
              </div>
            )}
            {resp.poRecommendation && (
              <div>
                <span className="font-medium text-blue-700">{t("Recommendation")}:</span>
                <p className="text-muted-foreground mt-0.5">{resp.poRecommendation}</p>
              </div>
            )}
            {resp.poSeverity && (
              <div className="flex items-center gap-2">
                <span className="font-medium">{t("Severity")}:</span>
                <Badge variant="outline" className="text-xs">{resp.poSeverity}</Badge>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

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
              {assessment.assessmentCode} - {translatedVendorName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="text-sm">{t(assessment.status.replace(/_/g, " "))}</Badge>
          <span className="text-sm text-muted-foreground">
            {answeredQuestions}/{totalQuestions} {t("answered")}
          </span>

          {/* Export Dropdown - AM only */}
          {!isSME && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Export")}
                  <ChevronDown className="h-3 w-3 ltr:ml-1 rtl:mr-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport(false)}>
                  {t("Export All Questions")}
                </DropdownMenuItem>
                {selectedDomain !== "all" && (
                  <DropdownMenuItem onClick={() => handleExport(true)}>
                    {t("Export")} {translatedDomains.find(d => d.id === selectedDomain)?.name}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Import Button - AM only */}
          {!isReadOnly && !isSME && (
            <>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Import")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImport}
              />
            </>
          )}

          {!isReadOnly && (
            <Button variant="outline" onClick={handleSaveAll} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
              {t("Save")}
            </Button>
          )}
          {!isReadOnly && !isSME && (
            <Button onClick={() => setShowSubmitConfirm(true)} disabled={submitting}>
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
              {translatedDomains.map(d => (
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
              {isSME ? t("No questions have been assigned to you yet") : t("No questions match the selected filters")}
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
                          <Badge variant="outline" className="text-xs">{tDomain(q.domainName)}</Badge>
                        )}
                        {q.mandatoryQuestion && (
                          <Badge variant="destructive" className="text-xs">{t("Mandatory")}</Badge>
                        )}
                        {q.mandatoryAttachment && (
                          <Badge className="bg-amber-100 text-amber-700 text-xs">{t("Attachment Required")}</Badge>
                        )}
                        {q.validateThroughAI && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs gap-1">
                            <Bot className="h-3 w-3" />{t("AI Validated")}
                          </Badge>
                        )}
                        {resp?.isDelegated && resp?.delegatedTo && (
                          <Badge className="bg-green-100 text-green-700 text-xs gap-1">
                            <UserPlus className="h-3 w-3" />{resp.delegatedTo.fullName}
                          </Badge>
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
                        {!isSME && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={resp?.isDelegated ? "text-green-600" : "text-muted-foreground"}
                            onClick={() => {
                              setSmeQuestionId(q.id);
                              setSelectedSmeId(resp?.delegatedToId || "");
                              setSmeDialogOpen(true);
                            }}
                            title={resp?.isDelegated ? `${t("Assigned to")} ${resp?.delegatedTo?.fullName || t("SME")}` : t("Assign SME")}
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        )}
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

                  {/* AI Evaluation Result */}
                  {renderAIResult(resp)}

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
                              {child.validateThroughAI && (
                                <Badge className="bg-purple-100 text-purple-700 text-xs gap-1">
                                  <Bot className="h-3 w-3" />{t("AI")}
                                </Badge>
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
                            {/* AI result for child */}
                            {renderAIResult(childResp)}
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

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Confirm Submission")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("Are you sure you want to submit this assessment? Once submitted, AI evaluation will begin and you will not be able to make further changes.")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>{t("Cancel")}</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" /> : <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
              {t("Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Assign SME Dialog */}
      <Dialog open={smeDialogOpen} onOpenChange={(open) => { setSmeDialogOpen(open); if (!open) { setSmeQuestionId(null); setSelectedSmeId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Assign SME")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-sm">{t("Select a Subject Matter Expert")}</Label>
            {smeList.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("No SMEs available. Create SMEs in SME Management first.")}</p>
            ) : (
              <Select value={selectedSmeId} onValueChange={setSelectedSmeId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("Choose SME...")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassign__">{t("-- Unassign --")}</SelectItem>
                  {smeList.map(sme => (
                    <SelectItem key={sme.id} value={sme.id}>
                      {sme.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmeDialogOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleAssignSME} disabled={smeList.length === 0}>
              {t("Assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

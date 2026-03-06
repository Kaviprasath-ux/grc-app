"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Home, ArrowLeft, Eye, ChevronRight, ChevronDown,
  ShieldCheck, ShieldAlert, ShieldOff, Bot, MessageSquare,
  FileText, Download, Flag, Send, Loader2, Clock, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, ChevronLeft,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

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
  questionNo: string | null;
  domainId: string | null;
  response: string | null;
  comment: string | null;
  artifactUrl: string | null;
  artifactName: string | null;
  isFlagged: boolean;
  poScore?: number | null;
  poStatus?: string | null;
  poAnswer?: string | null;
  poIssue?: string | null;
  poRisk?: string | null;
  poRecommendation?: string | null;
  poSeverity?: string | null;
  assessorStatus?: string | null;
  assessorIssue?: string | null;
  assessorRisk?: string | null;
  assessorRecommendation?: string | null;
  assessorComment?: string | null;
  assessorSeverity?: string | null;
  assessorOverriddenAt?: string | null;
}

interface Domain { id: string; name: string; }

interface AssessmentDetail {
  id: string;
  assessmentCode: string;
  status: string;
  assessmentType: string;
  questionnaireTemplate: string | null;
  vendorSubmissionDate: string | null;
  assessorCompletionDate: string | null;
  vendor: { id: string; name: string; vendorCode: string };
  initiatedBy: { fullName: string } | null;
  assessor: { id: string; fullName: string } | null;
  approver: { id: string; fullName: string } | null;
  responses: AssessmentResponse[];
  logs: { id: string; logDate: string; logMessage: string; questionNo?: string }[];
}

interface Summary {
  yesCount: number; noCount: number; naCount: number;
  satisfactoryCount: number; unsatisfactoryCount: number;
  highCount: number; mediumCount: number; lowCount: number;
  totalResponses: number;
}

interface Clarification {
  id: string;
  questionNo: string | null;
  domainName: string | null;
  rejectComment: string | null;
  amResponse: string | null;
  status: string;
  requestedBy: { fullName: string } | null;
  createdAt: string;
}

interface InternalComment {
  id: string;
  questionId: string | null;
  message: string;
  author: { id: string; fullName: string };
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  switch (status) {
    case "Satisfactory":
      return <Badge className="bg-green-100 text-green-700 gap-1"><ShieldCheck className="h-3 w-3" />{status}</Badge>;
    case "Unsatisfactory":
      return <Badge className="bg-red-100 text-red-700 gap-1"><ShieldAlert className="h-3 w-3" />{status}</Badge>;
    case "Not_Applicable":
      return <Badge className="bg-gray-100 text-gray-600 gap-1"><ShieldOff className="h-3 w-3" />N/A</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  if (!severity) return null;
  switch (severity) {
    case "High": return <Badge className="bg-red-100 text-red-700">{severity}</Badge>;
    case "Medium": return <Badge className="bg-amber-100 text-amber-700">{severity}</Badge>;
    case "Low": return <Badge className="bg-blue-100 text-blue-700">{severity}</Badge>;
    default: return <Badge variant="outline">{severity}</Badge>;
  }
}

function ResponseBadge({ response }: { response: string | null }) {
  if (!response) return <Badge variant="outline">—</Badge>;
  switch (response) {
    case "Yes": return <Badge className="bg-green-100 text-green-700">{response}</Badge>;
    case "No": return <Badge className="bg-red-100 text-red-700">{response}</Badge>;
    case "NA": return <Badge className="bg-gray-100 text-gray-600">N/A</Badge>;
    default: return <Badge variant="outline">{response}</Badge>;
  }
}

function AssessmentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "Reviewed": case "Approved": case "Completed":
      return <Badge className="bg-green-100 text-green-700">{status}</Badge>;
    case "Returned": case "Rejected":
      return <Badge className="bg-red-100 text-red-700">{status}</Badge>;
    case "Submitted": case "Under Review":
      return <Badge className="bg-blue-100 text-blue-700">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Simple donut/pie chart component
function PieChart({ data, title }: { data: { label: string; value: number; color: string }[]; title: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <div className="text-center text-muted-foreground text-sm">{title}: No data</div>;

  let cumulativePercent = 0;
  const segments = data.filter(d => d.value > 0).map(d => {
    const percent = (d.value / total) * 100;
    const start = cumulativePercent;
    cumulativePercent += percent;
    return { ...d, percent, start };
  });

  // Build conic-gradient
  const gradientParts = segments.map(s => `${s.color} ${s.start}% ${s.start + s.percent}%`);
  const gradient = `conic-gradient(${gradientParts.join(", ")})`;

  // Find the dominant segment to show its percentage
  const dominant = segments.length > 0 ? segments.reduce((a, b) => a.percent > b.percent ? a : b) : null;

  return (
    <div className="flex flex-col items-center gap-3">
      {title && <h4 className="font-medium text-sm">{title}</h4>}
      <div className="relative w-44 h-44 rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-6 bg-background rounded-full flex items-center justify-center">
          <span className="text-lg font-bold">{dominant ? `${Math.round(dominant.percent)}%` : "0%"}</span>
        </div>
      </div>
      {title && (
        <div className="flex flex-wrap gap-3 justify-center">
          {data.map(d => (
            <div key={d.label} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
              <span>{d.label}: {d.value} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ASRAssessmentDetailPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;

  // Data
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [responses, setResponses] = useState<Record<string, AssessmentResponse>>({});
  const [loading, setLoading] = useState(true);

  // View state
  const [view, setView] = useState<"summary" | "detail">("summary");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [verifaiOpen, setVerifaiOpen] = useState(true);

  // Dialogs
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [clarificationOpen, setClarificationOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsScope, setLogsScope] = useState<"assessment" | "question">("assessment");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportResult, setReportResult] = useState<string>("Satisfactory");

  // Override form
  const [overrideStatus, setOverrideStatus] = useState<string>("");
  const [overrideIssue, setOverrideIssue] = useState("");
  const [overrideRisk, setOverrideRisk] = useState("");
  const [overrideRec, setOverrideRec] = useState("");
  const [overrideComment, setOverrideComment] = useState("");
  const [overrideSeverity, setOverrideSeverity] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  // Clarification
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [clarificationText, setClarificationText] = useState("");
  const [clarificationSaving, setClarificationSaving] = useState(false);

  // Comments
  const [comments, setComments] = useState<InternalComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  const [actionSaving, setActionSaving] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [summaryTab, setSummaryTab] = useState<"assessment" | "domain">("assessment");

  // ── Load Data ──────────────────────────────────────────────────────────

  const loadAssessment = useCallback(async () => {
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}`);
      if (!res.ok) throw new Error("Failed to load assessment");
      const data = await res.json();
      setAssessment(data.assessment);
      setQuestions(data.questions);
      setDomains(data.domains);
      setSummary(data.summary);

      // Build response map
      const respMap: Record<string, AssessmentResponse> = {};
      for (const r of data.assessment.responses) {
        respMap[r.questionId] = r;
      }
      setResponses(respMap);
    } catch {
      toast({ title: t("Error"), description: t("Failed to load assessment"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [assessmentId, toast, t]);

  useEffect(() => { loadAssessment(); }, [loadAssessment]);

  // ── Build flat question list ───────────────────────────────────────────

  const flatQuestions = (() => {
    const result: { question: Question | Question["children"][0]; isChild: boolean; parentIndex: number; questionNo: string; domainName: string; domainId: string | null }[] = [];
    let parentIdx = 0;
    for (const q of questions) {
      if (!q.isParentQuestion) continue;
      parentIdx++;
      // Domain filter
      if (selectedDomain !== "all" && q.domainId !== selectedDomain) continue;

      const qNo = String(parentIdx);
      result.push({ question: q, isChild: false, parentIndex: parentIdx, questionNo: qNo, domainName: q.domainName, domainId: q.domainId });

      for (let ci = 0; ci < q.children.length; ci++) {
        const child = q.children[ci];
        result.push({ question: child, isChild: true, parentIndex: parentIdx, questionNo: `${qNo}.${ci + 1}`, domainName: q.domainName, domainId: q.domainId });
      }
    }
    return result;
  })();

  // Apply filter
  const filteredQuestions = flatQuestions.filter(fq => {
    const resp = responses[fq.question.id];
    const effectiveStatus = resp?.assessorStatus || resp?.poStatus;
    switch (filterMode) {
      case "satisfactory": return effectiveStatus === "Satisfactory";
      case "unsatisfactory": return effectiveStatus === "Unsatisfactory";
      case "yes": return resp?.response === "Yes";
      case "no": return resp?.response === "No";
      case "na": return resp?.response === "NA";
      case "flagged": return resp?.isFlagged;
      case "mandatory": return fq.question.mandatoryAttachment;
      default: return true;
    }
  });

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
  const pageQuestions = filteredQuestions.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  // Selected question
  const selectedFlat = selectedQuestionId ? filteredQuestions.find(fq => fq.question.id === selectedQuestionId) : pageQuestions[0];
  const selectedQ = selectedFlat?.question;
  const selectedResp = selectedQ ? responses[selectedQ.id] : null;

  // ── Verifai Summary Table Data ─────────────────────────────────────────

  const verifaiRows = flatQuestions
    .filter(fq => {
      const resp = responses[fq.question.id];
      return resp && resp.response; // Show all answered questions
    })
    .map(fq => {
      const resp = responses[fq.question.id]!;
      const effectiveStatus = resp.assessorStatus || resp.poStatus;
      return {
        questionNo: fq.questionNo,
        domainName: fq.domainName,
        response: resp.response || "—",
        status: effectiveStatus || "—",
        issue: resp.assessorIssue || resp.poIssue || "—",
        risk: resp.assessorRisk || resp.poRisk || "—",
        recommendation: resp.assessorRecommendation || resp.poRecommendation || "—",
        severity: resp.assessorSeverity || resp.poSeverity || "—",
        questionId: fq.question.id,
      };
    });

  // ── Override AI ────────────────────────────────────────────────────────

  const openOverride = () => {
    if (!selectedResp) return;
    setOverrideStatus(selectedResp.assessorStatus || selectedResp.poStatus || "");
    setOverrideIssue(selectedResp.assessorIssue || selectedResp.poIssue || "");
    setOverrideRisk(selectedResp.assessorRisk || selectedResp.poRisk || "");
    setOverrideRec(selectedResp.assessorRecommendation || selectedResp.poRecommendation || "");
    setOverrideComment(selectedResp.assessorComment || "");
    setOverrideSeverity(selectedResp.assessorSeverity || selectedResp.poSeverity || "");
    setOverrideOpen(true);
  };

  const submitOverride = async () => {
    if (!selectedQ || !selectedResp) return;
    setOverrideSaving(true);
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: selectedQ.id,
          questionNo: selectedFlat?.questionNo,
          questionTitle: selectedQ.questionText?.substring(0, 100),
          assessorStatus: overrideStatus,
          assessorIssue: overrideIssue,
          assessorRisk: overrideRisk,
          assessorRecommendation: overrideRec,
          assessorComment: overrideComment,
          assessorSeverity: overrideSeverity,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: t("Override saved") });
      setOverrideOpen(false);
      // Update local state
      setResponses(prev => ({
        ...prev,
        [selectedQ.id]: {
          ...prev[selectedQ.id],
          assessorStatus: overrideStatus,
          assessorIssue: overrideIssue,
          assessorRisk: overrideRisk,
          assessorRecommendation: overrideRec,
          assessorComment: overrideComment,
          assessorSeverity: overrideSeverity,
          assessorOverriddenAt: new Date().toISOString(),
        },
      }));
    } catch {
      toast({ title: t("Error"), description: t("Failed to save override"), variant: "destructive" });
    } finally {
      setOverrideSaving(false);
    }
  };

  // ── Clarification ──────────────────────────────────────────────────────

  const openClarification = async () => {
    setClarificationOpen(true);
    try {
      const qNo = selectedFlat?.questionNo;
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/clarification?questionNo=${qNo || ""}`);
      if (res.ok) setClarifications(await res.json());
    } catch { /* ignore */ }
  };

  const submitClarification = async () => {
    if (!clarificationText.trim()) return;
    setClarificationSaving(true);
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/clarification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionNo: selectedFlat?.questionNo || null,
          domainName: selectedFlat?.domainName || null,
          rejectComment: clarificationText.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const newClr = await res.json();
      setClarifications(prev => [newClr, ...prev]);
      setClarificationText("");
      toast({ title: t("Success"), description: t("Clarification requested") });
    } catch {
      toast({ title: t("Error"), description: t("Failed to request clarification"), variant: "destructive" });
    } finally {
      setClarificationSaving(false);
    }
  };

  // ── Comments ───────────────────────────────────────────────────────────

  const openComments = async () => {
    setCommentsOpen(true);
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/comments?questionId=${selectedQ?.id || ""}`);
      if (res.ok) setComments(await res.json());
    } catch { /* ignore */ }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setCommentSaving(true);
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: selectedQ?.id || null, message: commentText.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const newComment = await res.json();
      setComments(prev => [...prev, newComment]);
      setCommentText("");
    } catch {
      toast({ title: t("Error"), description: t("Failed to post comment"), variant: "destructive" });
    } finally {
      setCommentSaving(false);
    }
  };

  // ── Complete / Return ──────────────────────────────────────────────────

  const handleComplete = async () => {
    setActionSaving(true);
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: t("Assessment marked as Reviewed") });
      setCompleteOpen(false);
      loadAssessment();
    } catch {
      toast({ title: t("Error"), description: t("Failed to complete"), variant: "destructive" });
    } finally {
      setActionSaving(false);
    }
  };

  // ── Re-run AI Evaluation ──────────────────────────────────────────────

  const handleRerunAI = async () => {
    setRerunning(true);
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/rerun-ai`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      toast({ title: t("Success"), description: t("AI re-evaluation started. This may take a few minutes.") });
      // Poll for completion
      const poll = setInterval(async () => {
        try {
          const r = await fetch(`/api/tprm/asr-assessments/${assessmentId}`);
          if (r.ok) {
            const d = await r.json();
            const aiStatus = d.assessment?.aiEvaluationStatus;
            if (aiStatus === "Completed" || aiStatus === "Failed") {
              clearInterval(poll);
              setRerunning(false);
              loadAssessment();
              toast({
                title: aiStatus === "Completed" ? t("AI Evaluation Complete") : t("AI Evaluation Failed"),
                description: aiStatus === "Completed"
                  ? t("AI re-evaluation finished successfully.")
                  : t("AI re-evaluation encountered errors."),
                variant: aiStatus === "Completed" ? "default" : "destructive",
              });
            }
          }
        } catch { /* ignore poll errors */ }
      }, 5000);
      // Safety timeout: stop polling after 10 minutes
      setTimeout(() => { clearInterval(poll); setRerunning(false); }, 600000);
    } catch (err) {
      toast({ title: t("Error"), description: err instanceof Error ? err.message : t("Failed to start AI re-evaluation"), variant: "destructive" });
      setRerunning(false);
    }
  };

  // ── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">{t("Assessment not found")}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/tprm/asr-assessments")}>
          <ArrowLeft className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Back")}
        </Button>
      </div>
    );
  }

  const totalSeverity = (summary?.highCount || 0) + (summary?.mediumCount || 0) + (summary?.lowCount || 0);

  // ── RENDER: Summary View ─────────────────────────────────────────────

  if (view === "summary") {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => router.push("/tprm/asr-assessments")}>
              <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Back")}
            </Button>
            <h1 className="text-xl font-semibold">{t("Assessment Summary")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRerunAI} disabled={rerunning}>
              {rerunning ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" /> : <RefreshCw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />}
              {rerunning ? t("Re-evaluating...") : t("Re-evaluate AI")}
            </Button>
            {(assessment.status === "Submitted" || assessment.status === "Under Review") && (
              <Button variant="outline" size="sm" onClick={() => setCompleteOpen(true)}>
                <CheckCircle2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Mark as Reviewed")}
              </Button>
            )}
            <Button size="sm" onClick={() => { setView("detail"); setCurrentPage(0); setSelectedQuestionId(null); }}>
              {t("Detailed Assessment")}
            </Button>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-primary text-primary-foreground rounded-lg px-6 py-3 flex items-center justify-between">
          <span className="font-medium">{t("Vendor")}:<span className="ltr:ml-1 rtl:mr-1">{assessment.vendor.name}</span></span>
          <span className="font-medium">{t("VerifAI Summary")}</span>
          <span className="text-sm">{t("Status")}: <span className="font-medium">{assessment.status}</span></span>
        </div>

        {/* Tab buttons — full width, two equal columns */}
        <div className="grid grid-cols-2 gap-0">
          <button
            onClick={() => setSummaryTab("assessment")}
            className={`py-2.5 text-sm font-semibold text-center rounded-l-lg transition-colors ${summaryTab === "assessment" ? "bg-primary text-primary-foreground" : "bg-background text-primary border border-primary/30 hover:bg-primary/5"}`}
          >
            {t("Assessment Summary")}
          </button>
          <button
            onClick={() => setSummaryTab("domain")}
            className={`py-2.5 text-sm font-semibold text-center rounded-r-lg transition-colors ${summaryTab === "domain" ? "bg-primary text-primary-foreground" : "bg-background text-primary border border-primary/30 hover:bg-primary/5"}`}
          >
            {t("Domain Summary")}
          </button>
        </div>

        {summaryTab === "assessment" && (
          <>
            {/* Legends row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {[
                  { label: t("Yes"), color: "#14b8a6" },
                  { label: t("No"), color: "#ef4444" },
                  { label: t("NA"), color: "#d1d5db" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
                    <span>{l.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4">
                {[
                  { label: t("Satisfactory"), color: "#14b8a6" },
                  { label: t("Unsatisfactory"), color: "#f87171" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-xs">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
                    <span>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Two large pie charts side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col items-center">
                <PieChart
                  title=""
                  data={[
                    { label: t("Yes"), value: summary?.yesCount || 0, color: "#14b8a6" },
                    { label: t("No"), value: summary?.noCount || 0, color: "#ef4444" },
                    { label: t("N/A"), value: summary?.naCount || 0, color: "#d1d5db" },
                  ]}
                />
                <p className="text-xs font-semibold text-muted-foreground mt-3 uppercase tracking-wider">{t("RESPONSE")}</p>
              </div>
              <div className="flex flex-col items-center">
                <PieChart
                  title=""
                  data={[
                    { label: t("Satisfactory"), value: summary?.satisfactoryCount || 0, color: "#14b8a6" },
                    { label: t("Unsatisfactory"), value: summary?.unsatisfactoryCount || 0, color: "#f87171" },
                  ]}
                />
                <p className="text-xs font-semibold text-muted-foreground mt-3 uppercase tracking-wider">{t("COMPLIANCE")}</p>
              </div>
            </div>

            {/* Severity horizontal bar */}
            <div className="border rounded-lg p-4">
              <div className="grid grid-cols-3 text-center mb-2">
                <div>
                  <span className="text-lg font-bold text-red-600">{summary?.highCount || 0}</span>
                  <p className="text-xs font-semibold text-red-600">{t("High")}</p>
                </div>
                <div>
                  <span className="text-lg font-bold text-amber-600">{summary?.mediumCount || 0}</span>
                  <p className="text-xs font-semibold text-amber-600">{t("Medium")}</p>
                </div>
                <div>
                  <span className="text-lg font-bold text-green-600">{summary?.lowCount || 0}</span>
                  <p className="text-xs font-semibold text-green-600">{t("Low")}</p>
                </div>
              </div>
              <div className="h-2 flex rounded-full overflow-hidden">
                {totalSeverity > 0 ? (
                  <>
                    <div className="bg-red-500 h-full" style={{ width: `${((summary?.highCount || 0) / totalSeverity) * 100}%` }} />
                    <div className="bg-amber-500 h-full" style={{ width: `${((summary?.mediumCount || 0) / totalSeverity) * 100}%` }} />
                    <div className="bg-green-500 h-full" style={{ width: `${((summary?.lowCount || 0) / totalSeverity) * 100}%` }} />
                  </>
                ) : (
                  <div className="bg-muted h-full w-full" />
                )}
              </div>
            </div>
          </>
        )}

        {summaryTab === "domain" && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {domains.map(domain => {
                  const domainResps = flatQuestions.filter(fq => fq.domainId === domain.id);
                  const total = domainResps.length;
                  const unsat = domainResps.filter(fq => {
                    const r = responses[fq.question.id];
                    return r && (r.assessorStatus || r.poStatus || '').toLowerCase() === "unsatisfactory";
                  }).length;
                  const pct = total > 0 ? Math.round((unsat / total) * 100) : 0;
                  return (
                    <div key={domain.id} className="flex items-center gap-3">
                      <span className="w-48 text-sm truncate" title={domain.name}>{domain.name}</span>
                      <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                        <div className="h-full bg-red-400 rounded" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* VerifAI Summary — Collapsible */}
        <Collapsible open={verifaiOpen} onOpenChange={setVerifaiOpen}>
          <div className="border rounded-lg">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30">
                <span className="font-semibold text-sm">{t("VerifAI Summary")}</span>
                <span className="text-muted-foreground text-lg">{verifaiOpen ? "−" : "+"}</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t">
                {/* Table header */}
                <div className="grid grid-cols-[50px_1fr_1fr_1fr_1fr_40px] gap-0 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase px-4 py-2.5">
                  <span>{t("Que.No")}</span>
                  <span>{t("Domain")}</span>
                  <span>{t("Issue")}</span>
                  <span>{t("Risk")}</span>
                  <span>{t("Recommendation")}</span>
                  <span>{t("Action")}</span>
                </div>
                {/* Table rows */}
                {verifaiRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("No answered questions found")}</p>
                ) : (
                  <div className="divide-y">
                    {verifaiRows.map(row => (
                      <div key={row.questionNo} className="grid grid-cols-[50px_1fr_1fr_1fr_1fr_40px] gap-0 px-4 py-3 text-sm hover:bg-muted/20 items-start">
                        <span className="font-medium text-muted-foreground">{row.questionNo}</span>
                        <span className="font-medium pr-3">{row.domainName}</span>
                        <span className="text-muted-foreground pr-3 leading-relaxed">{row.issue !== "—" ? row.issue : ""}</span>
                        <span className="text-muted-foreground pr-3 leading-relaxed">{row.risk !== "—" ? row.risk : ""}</span>
                        <span className="text-muted-foreground pr-3 leading-relaxed">{row.recommendation !== "—" ? row.recommendation : ""}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => {
                          setView("detail");
                          setSelectedQuestionId(row.questionId);
                          setCurrentPage(0);
                        }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Complete dialog */}
        <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("Mark as Reviewed")}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{t("Are you sure you want to mark this assessment as reviewed?")}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCompleteOpen(false)}>{t("Cancel")}</Button>
              <Button onClick={handleComplete} disabled={actionSaving}>
                {actionSaving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
                {t("Confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    );
  }

  // ── RENDER: Review Questionnaire View ────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => { setView("summary"); setSelectedDomain("all"); }}>
            <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Back")}
          </Button>
          <h1 className="text-xl font-semibold">{t("Review Questionnaire")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setLogsScope("assessment"); setLogsOpen(true); }}>
            <Clock className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Activity Logs")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRerunAI} disabled={rerunning}>
            {rerunning ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" /> : <RefreshCw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />}
            {rerunning ? t("Re-evaluating...") : t("Re-evaluate AI")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
            <FileText className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Generate Report")}
          </Button>
          {(assessment.status === "Submitted" || assessment.status === "Under Review") && (
            <Button size="sm" onClick={() => setCompleteOpen(true)}>
              <CheckCircle2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Mark as Reviewed")}
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar — 4 colored info cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--primary-200)", backgroundColor: "var(--primary-50)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--primary-600)" }}>{t("Domain")}</span>
          <Select value={selectedDomain} onValueChange={v => { setSelectedDomain(v); setCurrentPage(0); setSelectedQuestionId(null); }}>
            <SelectTrigger className="mt-1 h-8 bg-white/80" style={{ borderColor: "var(--primary-200)" }}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All Domains")}</SelectItem>
              {domains.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-light)", backgroundColor: "var(--surface-secondary)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{t("Vendor")}</span>
          <p className="mt-1 text-sm font-medium">{assessment.vendor.name}</p>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-light)", backgroundColor: "var(--surface-secondary)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{t("Date of Submission")}</span>
          <p className="mt-1 text-sm font-medium">{assessment.vendorSubmissionDate ? new Date(assessment.vendorSubmissionDate).toLocaleDateString() : "—"}</p>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--primary-200)", backgroundColor: "var(--primary-50)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--primary-600)" }}>{t("Status")}</span>
          <p className="mt-1 text-sm font-medium">{assessment.status}</p>
        </div>
      </div>

      {/* Main two-column layout — left: questions, right: AI review */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left column (3/5) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Question count + filter */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t("Number of Questions")} ({filteredQuestions.length})</span>
            <Select value={filterMode} onValueChange={v => { setFilterMode(v); setCurrentPage(0); setSelectedQuestionId(null); }}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All")}</SelectItem>
                <SelectItem value="satisfactory">{t("Satisfactory")}</SelectItem>
                <SelectItem value="unsatisfactory">{t("Unsatisfactory")}</SelectItem>
                <SelectItem value="flagged">{t("Flagged")}</SelectItem>
                <SelectItem value="mandatory">{t("Mandatory Attachments")}</SelectItem>
                <SelectItem value="yes">{t("Yes")}</SelectItem>
                <SelectItem value="no">{t("No")}</SelectItem>
                <SelectItem value="na">{t("N/A")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === 0} onClick={() => { setCurrentPage(p => p - 1); setSelectedQuestionId(null); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-1">
              {currentPage * ITEMS_PER_PAGE + 1} {t("to")} {Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredQuestions.length)} {t("of")} {filteredQuestions.length}
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages - 1} onClick={() => { setCurrentPage(p => p + 1); setSelectedQuestionId(null); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Question navigator pills */}
          <div className="flex flex-wrap gap-1.5">
            {pageQuestions.map(fq => {
              const isSelected = fq.question.id === (selectedQuestionId || pageQuestions[0]?.question.id);
              const resp = responses[fq.question.id];
              const effectiveStatus = resp?.assessorStatus || resp?.poStatus;
              const isSat = effectiveStatus === "Satisfactory";
              const isUnsat = effectiveStatus === "Unsatisfactory";

              return (
                <button
                  key={fq.question.id}
                  onClick={() => setSelectedQuestionId(fq.question.id)}
                  className={`w-9 h-9 text-xs font-semibold border transition-all flex items-center justify-center ${fq.isChild ? "rounded-full" : "rounded-md"} ${isSelected ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary ring-offset-1" : isSat ? "border-green-500 bg-green-50 text-green-700 hover:bg-green-100" : isUnsat ? "border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100" : "hover:opacity-80"}`}
                  style={!isSelected && !isSat && !isUnsat ? { borderColor: "#c4c4c4", backgroundColor: "#f9f9f9", color: "#555" } : undefined}
                >
                  {fq.questionNo}
                </button>
              );
            })}
          </div>

          {/* Selected question detail */}
          {selectedQ && (
            <div className="space-y-4">
              {/* Question text + flag */}
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium" style={{ color: "var(--primary-600)" }}>
                  <span className="font-bold">{selectedFlat?.questionNo}.</span> {selectedQ.questionText}
                </p>
                <button
                  className="shrink-0 mt-0.5"
                  onClick={() => {/* flag toggle placeholder */}}
                >
                  <Flag className={`h-5 w-5 ${selectedResp?.isFlagged ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`} />
                </button>
              </div>

              {/* Response badge */}
              <div>
                <ResponseBadge response={selectedResp?.response || null} />
              </div>

              {/* Evidence */}
              <div className="border-t pt-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <FileText className="h-4 w-4" />{t("Evidence")}
                </h4>
                {(selectedResp?.artifactUrl || selectedResp?.artifactName) ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{selectedResp?.artifactName || t("Attached file")}</span>
                    {selectedResp?.artifactUrl && (
                      <a href={selectedResp.artifactUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm"><Download className="h-3 w-3" /></Button>
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("No evidence attached")}</p>
                )}
              </div>

              {/* Vendor's Comment */}
              <div className="border-t pt-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <MessageSquare className="h-4 w-4" />{t("Vendor's Comment")}
                </h4>
                <div className="rounded-md border bg-muted/20 p-3 min-h-[40px]">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedResp?.comment || ""}</p>
                </div>
              </div>

              {/* Action buttons — centered, filled style */}
              <div className="flex flex-wrap gap-2 pt-3 justify-center">
                <Button size="sm" onClick={openOverride} disabled={assessment.status === "Reviewed"}>
                  {t("Override AI")}
                </Button>
                <Button size="sm" onClick={openClarification}>
                  {t("Clarification")}
                </Button>
                <Button size="sm" onClick={() => { setLogsScope("question"); setLogsOpen(true); }}>
                  {t("Activity Logs")}
                </Button>
                <Button size="sm" onClick={openComments}>
                  {t("Internal Comments")}
                </Button>
              </div>
            </div>
          )}

          {filteredQuestions.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              {t("No questions match the selected filters")}
            </div>
          )}
        </div>

        {/* Right column: AI Review panel (2/5) */}
        <div className="lg:col-span-2">
          <Card className="sticky top-4 bg-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("AI Review")}</CardTitle>
              {selectedResp?.assessorOverriddenAt && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 w-fit">{t("Overridden")}</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedQ ? (
                <>
                  {/* Status badge + Confidence */}
                  <div className="flex items-center justify-between">
                    <StatusBadge status={selectedResp?.assessorStatus || selectedResp?.poStatus} />
                    {selectedResp?.poScore != null && (
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground">{t("Confidence level of AI")}</span>
                        <div className="flex items-center gap-0.5 mt-1 justify-end">
                          {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, i) => (
                            <div
                              key={i}
                              className={`w-1.5 rounded-sm ${(selectedResp?.poScore ?? 0) >= threshold ? "bg-primary" : "bg-muted"}`}
                              style={{ height: `${12 + i * 4}px` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* VerifAI Summary */}
                  <div>
                    <h4 className="text-sm font-semibold mb-1">{t("VerifAI Summary")}</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedResp?.poStatus?.toLowerCase() === "failed"
                        ? t("AI evaluation could not be completed for this question. Please re-evaluate.")
                        : selectedResp?.poAnswer || "—"}
                    </p>
                  </div>

                  {/* Issue */}
                  {(selectedResp?.assessorIssue || selectedResp?.poIssue) && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">{t("Issue")}</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedResp?.assessorIssue || selectedResp?.poIssue}</p>
                    </div>
                  )}

                  {/* Risk */}
                  {(selectedResp?.assessorRisk || selectedResp?.poRisk) && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">{t("Risk")}</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedResp?.assessorRisk || selectedResp?.poRisk}</p>
                    </div>
                  )}

                  {/* Recommendation */}
                  {(selectedResp?.assessorRecommendation || selectedResp?.poRecommendation) && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">{t("Recommendation")}</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedResp?.assessorRecommendation || selectedResp?.poRecommendation}</p>
                    </div>
                  )}

                  {/* Severity */}
                  <div>
                    <h4 className="text-sm font-semibold mb-1">{t("Severity")}</h4>
                    <SeverityBadge severity={selectedResp?.assessorSeverity || selectedResp?.poSeverity} />
                  </div>

                  {/* Assessor Comment (if overridden) */}
                  {selectedResp?.assessorComment && (
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-semibold mb-1">{t("Assessor Comment")}</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedResp.assessorComment}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">{t("Select a question to view AI review")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}

      {/* Override AI Dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("Override AI Evaluation")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <span className="text-sm font-medium">{t("Question")}: </span>
              <span className="text-sm">{selectedQ?.questionText}</span>
            </div>
            <div>
              <span className="text-sm font-medium block mb-2">{t("Status")}</span>
              <div className="flex gap-2">
                {["Satisfactory", "Unsatisfactory", "Not_Applicable"].map(s => (
                  <Button
                    key={s}
                    variant={overrideStatus === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOverrideStatus(s)}
                    className={overrideStatus === s ? (s === "Satisfactory" ? "bg-green-600 hover:bg-green-700" : s === "Unsatisfactory" ? "bg-red-600 hover:bg-red-700" : "") : ""}
                  >
                    {s === "Not_Applicable" ? "N/A" : t(s)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium block mb-1">{t("Issue")}</span>
              <Textarea value={overrideIssue} onChange={e => setOverrideIssue(e.target.value)} rows={2} />
            </div>
            <div>
              <span className="text-sm font-medium block mb-1">{t("Risk")}</span>
              <Textarea value={overrideRisk} onChange={e => setOverrideRisk(e.target.value)} rows={2} />
            </div>
            <div>
              <span className="text-sm font-medium block mb-1">{t("Recommendation")}</span>
              <Textarea value={overrideRec} onChange={e => setOverrideRec(e.target.value)} rows={2} />
            </div>
            <div>
              <span className="text-sm font-medium block mb-1">{t("Assessor Comment")}</span>
              <Textarea value={overrideComment} onChange={e => setOverrideComment(e.target.value)} rows={2} />
            </div>
            <div>
              <span className="text-sm font-medium block mb-2">{t("Severity")}</span>
              <div className="flex gap-2">
                {["Low", "Medium", "High"].map(s => (
                  <Button
                    key={s}
                    variant={overrideSeverity === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOverrideSeverity(s)}
                    className={overrideSeverity === s ? (s === "High" ? "bg-red-600 hover:bg-red-700" : s === "Medium" ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700") : ""}
                  >
                    {t(s)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={submitOverride} disabled={overrideSaving || !overrideStatus}>
              {overrideSaving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              {t("Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clarification Dialog */}
      <Dialog open={clarificationOpen} onOpenChange={setClarificationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("Clarification")} — Q{selectedFlat?.questionNo}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Existing clarifications */}
            {clarifications.length > 0 && (
              <div className="space-y-2">
                {clarifications.map(clr => (
                  <div key={clr.id} className="border rounded-lg p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{clr.requestedBy?.fullName || "—"}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{clr.status}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(clr.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p className="text-muted-foreground">{clr.rejectComment}</p>
                    {clr.amResponse && (
                      <div className="bg-muted/50 rounded p-2 mt-1">
                        <span className="text-xs font-medium">{t("AM Response")}:</span>
                        <p className="text-muted-foreground">{clr.amResponse}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* New clarification */}
            <div>
              <span className="text-sm font-medium block mb-1">{t("Request Clarification")}</span>
              <Textarea
                value={clarificationText}
                onChange={e => setClarificationText(e.target.value)}
                placeholder={t("Enter your clarification request...")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClarificationOpen(false)}>{t("Close")}</Button>
            <Button onClick={submitClarification} disabled={clarificationSaving || !clarificationText.trim()}>
              {clarificationSaving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              <Send className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Internal Comments Dialog */}
      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("Internal Comments")}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t("No comments yet")}</p>
            )}
            {comments.map(c => (
              <div key={c.id} className="flex gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium flex-shrink-0">
                  {c.author.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.author.fullName}</span>
                    <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.message}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder={t("Type a comment...")}
              rows={2}
              className="flex-1"
            />
            <Button onClick={submitComment} disabled={commentSaving || !commentText.trim()} className="self-end">
              {commentSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Activity Logs Dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {logsScope === "question" && selectedFlat
                ? `${t("Activity Logs")} — Q${selectedFlat.questionNo}`
                : t("Activity Logs")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {(() => {
              const questionAllowedPrefixes = ["Clarification", "Assessor overrode", "Comment"];
              const logs = logsScope === "question" && selectedFlat
                ? assessment.logs.filter(log =>
                    log.questionNo === selectedFlat.questionNo &&
                    questionAllowedPrefixes.some(p => log.logMessage.startsWith(p))
                  )
                : assessment.logs.filter(log =>
                    !log.logMessage.startsWith("AI API ") &&
                    !log.logMessage.includes("AI API /api/") &&
                    !log.logMessage.startsWith("Document ingest")
                  );
              return logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t("No activity logs")}</p>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 border-b pb-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm">{log.logMessage}</p>
                      <span className="text-xs text-muted-foreground">{new Date(log.logDate).toLocaleString()}</span>
                      {logsScope === "assessment" && log.questionNo && <span className="text-xs text-muted-foreground"> — Q{log.questionNo}</span>}
                    </div>
                  </div>
                ))
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsOpen(false)}>{t("Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete / Return dialogs (same as summary view) */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Mark as Reviewed")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("Are you sure you want to mark this assessment as reviewed?")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleComplete} disabled={actionSaving}>
              {actionSaving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              {t("Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-[80vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{assessment.vendor.name}</span>
              <span className="text-sm font-semibold text-primary">VerifAI</span>
            </DialogTitle>
          </DialogHeader>

          {/* Summary text */}
          <p className="text-sm">
            {t("Third Party Risk Management Team conducted a due diligence review of")} <strong>{assessment.vendor.name}</strong> {t("from")} <strong>{assessment.vendorSubmissionDate ? new Date(assessment.vendorSubmissionDate).toLocaleDateString() : "—"}</strong> {t("till")} <strong>{new Date().toLocaleDateString()}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">{t("The control environment was found to be:")}</p>

          {/* Assessment Result radio */}
          <div className="flex items-center gap-6 border rounded-lg p-4">
            {["Satisfactory", "Unsatisfactory", "Deficient"].map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reportResult"
                  checked={reportResult === opt}
                  onChange={() => setReportResult(opt)}
                  className="accent-primary"
                />
                <span className="text-sm">{t(opt)}</span>
              </label>
            ))}
          </div>

          {/* Severity bar */}
          <div className="border rounded-lg p-4">
            <div className="grid grid-cols-3 text-center mb-2">
              <div>
                <span className="text-lg font-bold text-red-600">{summary?.highCount || 0}</span>
                <p className="text-xs font-semibold text-red-600">{t("High")}</p>
              </div>
              <div>
                <span className="text-lg font-bold text-amber-600">{summary?.mediumCount || 0}</span>
                <p className="text-xs font-semibold text-amber-600">{t("Medium")}</p>
              </div>
              <div>
                <span className="text-lg font-bold text-green-600">{summary?.lowCount || 0}</span>
                <p className="text-xs font-semibold text-green-600">{t("Low")}</p>
              </div>
            </div>
            <div className="h-2 flex rounded-full overflow-hidden">
              {totalSeverity > 0 ? (
                <>
                  <div className="bg-red-500 h-full" style={{ width: `${((summary?.highCount || 0) / totalSeverity) * 100}%` }} />
                  <div className="bg-amber-500 h-full" style={{ width: `${((summary?.mediumCount || 0) / totalSeverity) * 100}%` }} />
                  <div className="bg-green-500 h-full" style={{ width: `${((summary?.lowCount || 0) / totalSeverity) * 100}%` }} />
                </>
              ) : (
                <div className="bg-muted h-full w-full" />
              )}
            </div>
          </div>

          {/* Issues table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[50px_1fr_1fr_90px_1fr] gap-0 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2.5">
              <span>{t("Sr.No")}</span>
              <span>{t("Issue")}</span>
              <span>{t("Risk")}</span>
              <span>{t("Severity")}</span>
              <span>{t("Recommendation")}</span>
            </div>
            <div className="divide-y">
              {verifaiRows
                .filter(row => row.issue !== "—" || row.risk !== "—")
                .map((row, idx) => (
                  <div key={row.questionNo} className="grid grid-cols-[50px_1fr_1fr_90px_1fr] gap-0 px-4 py-3 text-sm items-start">
                    <span className="font-medium">{idx + 1}</span>
                    <span className="pr-3 leading-relaxed">{row.issue !== "—" ? row.issue : ""}</span>
                    <span className="pr-3 leading-relaxed text-muted-foreground">{row.risk !== "—" ? row.risk : ""}</span>
                    <span><SeverityBadge severity={row.severity !== "—" ? row.severity : null} /></span>
                    <span className="pr-3 leading-relaxed text-muted-foreground">{row.recommendation !== "—" ? row.recommendation : ""}</span>
                  </div>
                ))}
              {verifaiRows.filter(row => row.issue !== "—" || row.risk !== "—").length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">{t("No issues found")}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-sm pt-2">
            <p>{t("Sincerely,")}</p>
            <p className="font-semibold">{t("Third Party Risk Management Team.")}</p>
          </div>

          {/* Action buttons */}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}>{t("Download Report")}</Button>
            <Button onClick={() => { setReportOpen(false); setCompleteOpen(true); }}>{t("Complete Assessment")}</Button>
            <Button variant="outline" onClick={() => setReportOpen(false)}>{t("Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

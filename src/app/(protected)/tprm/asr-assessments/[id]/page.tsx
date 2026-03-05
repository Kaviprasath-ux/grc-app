"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  FileText, Download, Flag, Send, Loader2, Clock, RotateCcw,
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

  return (
    <div className="flex flex-col items-center gap-3">
      <h4 className="font-medium text-sm">{title}</h4>
      <div className="relative w-32 h-32 rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-4 bg-background rounded-full flex items-center justify-center">
          <span className="text-lg font-bold">{total}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
            <span>{d.label}: {d.value} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
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
  const [completeOpen, setCompleteOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

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

  // Return reason
  const [returnComment, setReturnComment] = useState("");
  const [actionSaving, setActionSaving] = useState(false);

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

  const handleReturn = async () => {
    setActionSaving(true);
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return", comment: returnComment }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: t("Assessment returned") });
      setReturnOpen(false);
      loadAssessment();
    } catch {
      toast({ title: t("Error"), description: t("Failed to return"), variant: "destructive" });
    } finally {
      setActionSaving(false);
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

  // ── RENDER: Summary View ─────────────────────────────────────────────

  if (view === "summary") {
    return (
      <div className="space-y-6">
        {/* Breadcrumb & header */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Home className="h-4 w-4" />
          <ChevronRight className="h-3 w-3" />
          <span className="cursor-pointer hover:underline" onClick={() => router.push("/tprm/asr-assessments")}>{t("Assessments")}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">{assessment.assessmentCode}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push("/tprm/asr-assessments")}>
              <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Back")}
            </Button>
            <h1 className="text-2xl font-bold">{t("Assessment Summary")}</h1>
          </div>
          <div className="flex items-center gap-2">
            {assessment.status === "Submitted" || assessment.status === "Under Review" ? (
              <>
                <Button variant="outline" onClick={() => setReturnOpen(true)}>
                  <RotateCcw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Return")}
                </Button>
                <Button onClick={() => setCompleteOpen(true)}>
                  <CheckCircle2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Mark as Reviewed")}
                </Button>
              </>
            ) : null}
            <Button onClick={() => { setView("detail"); setCurrentPage(0); setSelectedQuestionId(null); }}>
              <FileText className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Detailed Assessment")}
            </Button>
          </div>
        </div>

        {/* Info bar */}
        <Card>
          <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <span className="font-medium">{assessment.vendor.name}</span>
              <span className="text-sm text-muted-foreground">{assessment.assessmentCode}</span>
              <span className="text-sm text-muted-foreground">{assessment.assessmentType}</span>
            </div>
            <div className="flex items-center gap-3">
              <AssessmentStatusBadge status={assessment.status} />
              {assessment.vendorSubmissionDate && (
                <span className="text-xs text-muted-foreground">
                  {t("Submitted")}: {new Date(assessment.vendorSubmissionDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary tabs */}
        <Tabs defaultValue="assessment">
          <TabsList>
            <TabsTrigger value="assessment">{t("Assessment Summary")}</TabsTrigger>
            <TabsTrigger value="domain">{t("Domain Summary")}</TabsTrigger>
          </TabsList>

          <TabsContent value="assessment">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Pie Charts */}
              <Card>
                <CardContent className="pt-6">
                  <PieChart
                    title={t("Response Distribution")}
                    data={[
                      { label: t("Yes"), value: summary?.yesCount || 0, color: "#22c55e" },
                      { label: t("No"), value: summary?.noCount || 0, color: "#ef4444" },
                      { label: t("N/A"), value: summary?.naCount || 0, color: "#94a3b8" },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <PieChart
                    title={t("Compliance Status")}
                    data={[
                      { label: t("Satisfactory"), value: summary?.satisfactoryCount || 0, color: "#22c55e" },
                      { label: t("Unsatisfactory"), value: summary?.unsatisfactoryCount || 0, color: "#ef4444" },
                    ]}
                  />
                </CardContent>
              </Card>

              {/* Severity Counts */}
              <Card>
                <CardHeader><CardTitle className="text-sm">{t("Severity Distribution")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-red-500" />
                        <span className="text-sm">{t("High")}</span>
                      </div>
                      <span className="font-bold text-red-600">{summary?.highCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-amber-500" />
                        <span className="text-sm">{t("Medium")}</span>
                      </div>
                      <span className="font-bold text-amber-600">{summary?.mediumCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-blue-500" />
                        <span className="text-sm">{t("Low")}</span>
                      </div>
                      <span className="font-bold text-blue-600">{summary?.lowCount || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="domain">
            <Card>
              <CardContent className="pt-6">
                {/* Domain bar chart */}
                <div className="space-y-3">
                  {domains.map(domain => {
                    const domainResps = flatQuestions.filter(fq => fq.domainId === domain.id);
                    const total = domainResps.length;
                    const unsat = domainResps.filter(fq => {
                      const r = responses[fq.question.id];
                      return r && (r.assessorStatus || r.poStatus) === "Unsatisfactory";
                    }).length;
                    const pct = total > 0 ? Math.round((unsat / total) * 100) : 0;
                    return (
                      <div key={domain.id} className="flex items-center gap-3">
                        <span className="w-40 text-sm truncate" title={domain.name}>{domain.name}</span>
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
          </TabsContent>
        </Tabs>

        {/* VerifAI Summary */}
        <Collapsible open={verifaiOpen} onOpenChange={setVerifaiOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />{t("VerifAI Summary")}
                  <Badge variant="outline">{verifaiRows.length} {t("questions")}</Badge>
                </CardTitle>
                {verifaiOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {verifaiRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("No answered questions found")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 px-3 text-left">{t("Que.No")}</th>
                          <th className="py-2 px-3 text-left">{t("Domain")}</th>
                          <th className="py-2 px-3 text-left">{t("Response")}</th>
                          <th className="py-2 px-3 text-left">{t("AI Status")}</th>
                          <th className="py-2 px-3 text-left">{t("Issue")}</th>
                          <th className="py-2 px-3 text-left">{t("Risk")}</th>
                          <th className="py-2 px-3 text-left">{t("Recommendation")}</th>
                          <th className="py-2 px-3 text-left">{t("Severity")}</th>
                          <th className="py-2 px-3 text-center">{t("Action")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verifaiRows.map(row => (
                          <tr key={row.questionNo} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3 font-medium">{row.questionNo}</td>
                            <td className="py-2 px-3">{row.domainName}</td>
                            <td className="py-2 px-3"><ResponseBadge response={row.response} /></td>
                            <td className="py-2 px-3"><StatusBadge status={row.status === "—" ? null : row.status} /></td>
                            <td className="py-2 px-3 max-w-48 truncate" title={row.issue}>{row.issue}</td>
                            <td className="py-2 px-3 max-w-48 truncate" title={row.risk}>{row.risk}</td>
                            <td className="py-2 px-3 max-w-48 truncate" title={row.recommendation}>{row.recommendation}</td>
                            <td className="py-2 px-3"><SeverityBadge severity={row.severity} /></td>
                            <td className="py-2 px-3 text-center">
                              <Button variant="ghost" size="sm" onClick={() => {
                                setView("detail");
                                setSelectedQuestionId(row.questionId);
                                setCurrentPage(0);
                              }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Complete / Return dialogs */}
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

        <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("Return Assessment")}</DialogTitle></DialogHeader>
            <Textarea
              placeholder={t("Reason for returning...")}
              value={returnComment}
              onChange={e => setReturnComment(e.target.value)}
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnOpen(false)}>{t("Cancel")}</Button>
              <Button variant="destructive" onClick={handleReturn} disabled={actionSaving}>
                {actionSaving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
                {t("Return")}
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
          <Button variant="outline" size="sm" onClick={() => setView("summary")}>
            <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Back to Summary")}
          </Button>
          <h1 className="text-2xl font-bold">{t("Review Questionnaire")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLogsOpen(true)}>
            <Clock className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Activity Logs")}
          </Button>
          {(assessment.status === "Submitted" || assessment.status === "Under Review") && (
            <>
              <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)}>
                <RotateCcw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Return")}
              </Button>
              <Button size="sm" onClick={() => setCompleteOpen(true)}>
                <CheckCircle2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Mark as Reviewed")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t("Domain")}:</span>
            <Select value={selectedDomain} onValueChange={v => { setSelectedDomain(v); setCurrentPage(0); setSelectedQuestionId(null); }}>
              <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Domains")}</SelectItem>
                {domains.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t("Vendor")}: <strong>{assessment.vendor.name}</strong></span>
            {assessment.vendorSubmissionDate && (
              <span>| {t("Submitted")}: {new Date(assessment.vendorSubmissionDate).toLocaleDateString()}</span>
            )}
          </div>
          <div className="ltr:ml-auto rtl:mr-auto">
            <AssessmentStatusBadge status={assessment.status} />
          </div>
        </CardContent>
      </Card>

      {/* Question count + filter + pagination */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{t("Questions")} ({filteredQuestions.length})</span>
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {currentPage * ITEMS_PER_PAGE + 1} - {Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredQuestions.length)} {t("of")} {filteredQuestions.length}
          </span>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === 0} onClick={() => { setCurrentPage(p => p - 1); setSelectedQuestionId(null); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages - 1} onClick={() => { setCurrentPage(p => p + 1); setSelectedQuestionId(null); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Question navigator pills */}
      <div className="flex flex-wrap gap-1.5">
        {pageQuestions.map(fq => {
          const isSelected = fq.question.id === (selectedQuestionId || pageQuestions[0]?.question.id);
          const resp = responses[fq.question.id];
          const effectiveStatus = resp?.assessorStatus || resp?.poStatus;
          let pillColor = "bg-gray-100 text-gray-600 border-gray-300";
          if (effectiveStatus === "Satisfactory") pillColor = "bg-green-100 text-green-700 border-green-300";
          else if (effectiveStatus === "Unsatisfactory") pillColor = "bg-red-100 text-red-700 border-red-300";

          return (
            <button
              key={fq.question.id}
              onClick={() => setSelectedQuestionId(fq.question.id)}
              className={`px-2.5 py-1 text-xs font-medium border transition-all ${fq.isChild ? "rounded-full" : "rounded-md"} ${pillColor} ${isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:opacity-80"}`}
            >
              {fq.questionNo}
            </button>
          );
        })}
      </div>

      {/* Main two-column layout */}
      {selectedQ && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left column: Question detail (3/5) */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* Question header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg">{selectedFlat?.questionNo}</span>
                      {selectedResp?.isFlagged && <Flag className="h-4 w-4 text-amber-500 fill-amber-500" />}
                    </div>
                    <p className="text-sm">{selectedQ.questionText}</p>
                  </div>
                  <ResponseBadge response={selectedResp?.response || null} />
                </div>

                {/* Evidence */}
                {(selectedResp?.artifactUrl || selectedResp?.artifactName) && (
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />{t("Evidence")}
                    </h4>
                    {selectedResp.artifactName && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{selectedResp.artifactName}</span>
                        {selectedResp.artifactUrl && (
                          <a href={selectedResp.artifactUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm"><Download className="h-3 w-3" /></Button>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Vendor's Comment */}
                {selectedResp?.comment && (
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <h4 className="text-sm font-medium mb-1">{t("Vendor's Comment")}</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedResp.comment}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={openOverride} disabled={assessment.status === "Reviewed"}>
                    <Bot className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Override AI")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={openClarification}>
                    <AlertTriangle className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Clarification")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLogsOpen(true)}>
                    <Clock className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Activity Logs")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={openComments}>
                    <MessageSquare className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Internal Comments")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: AI Review panel (2/5) */}
          <div className="lg:col-span-2">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-5 w-5" />{t("AI Review")}
                  {selectedResp?.assessorOverriddenAt && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">{t("Overridden")}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("Status")}</span>
                  <StatusBadge status={selectedResp?.assessorStatus || selectedResp?.poStatus} />
                </div>

                {/* Confidence */}
                {selectedResp?.poScore != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">{t("Confidence")}</span>
                      <span className="text-sm font-medium">{Math.round(selectedResp.poScore * 100)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${selectedResp.poScore >= 0.7 ? "bg-green-500" : selectedResp.poScore >= 0.4 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${selectedResp.poScore * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* VerifAI Summary */}
                {(selectedResp?.poAnswer) && (
                  <div>
                    <span className="text-sm font-medium">{t("VerifAI Summary")}</span>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{selectedResp.poAnswer}</p>
                  </div>
                )}

                {/* Issue */}
                {(selectedResp?.assessorIssue || selectedResp?.poIssue) && (
                  <div>
                    <span className="text-sm font-medium">{t("Issue")}</span>
                    <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{selectedResp.assessorIssue || selectedResp.poIssue}</p>
                  </div>
                )}

                {/* Risk */}
                {(selectedResp?.assessorRisk || selectedResp?.poRisk) && (
                  <div>
                    <span className="text-sm font-medium">{t("Risk")}</span>
                    <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{selectedResp.assessorRisk || selectedResp.poRisk}</p>
                  </div>
                )}

                {/* Recommendation */}
                {(selectedResp?.assessorRecommendation || selectedResp?.poRecommendation) && (
                  <div>
                    <span className="text-sm font-medium">{t("Recommendation")}</span>
                    <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{selectedResp.assessorRecommendation || selectedResp.poRecommendation}</p>
                  </div>
                )}

                {/* Severity */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("Severity")}</span>
                  <SeverityBadge severity={selectedResp?.assessorSeverity || selectedResp?.poSeverity} />
                </div>

                {/* Assessor Comment (if overridden) */}
                {selectedResp?.assessorComment && (
                  <div className="border-t pt-3">
                    <span className="text-sm font-medium">{t("Assessor Comment")}</span>
                    <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{selectedResp.assessorComment}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {filteredQuestions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("No questions match the selected filters")}
          </CardContent>
        </Card>
      )}

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
                    className={overrideSeverity === s ? (s === "High" ? "bg-red-600 hover:bg-red-700" : s === "Medium" ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700") : ""}
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
          <DialogHeader><DialogTitle>{t("Activity Logs")}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {assessment.logs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t("No activity logs")}</p>
            )}
            {assessment.logs.map(log => (
              <div key={log.id} className="flex items-start gap-3 border-b pb-2">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm">{log.logMessage}</p>
                  <span className="text-xs text-muted-foreground">{new Date(log.logDate).toLocaleString()}</span>
                  {log.questionNo && <span className="text-xs text-muted-foreground"> — Q{log.questionNo}</span>}
                </div>
              </div>
            ))}
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

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Return Assessment")}</DialogTitle></DialogHeader>
          <Textarea
            placeholder={t("Reason for returning...")}
            value={returnComment}
            onChange={e => setReturnComment(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>{t("Cancel")}</Button>
            <Button variant="destructive" onClick={handleReturn} disabled={actionSaving}>
              {actionSaving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              {t("Return")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
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
  FileText, FileSpreadsheet, Download, Flag, Send, Loader2, Clock, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, ChevronLeft, RotateCcw, UserCheck,
} from "lucide-react";
import { useHasRole } from "@/hooks/usePermissions";

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
  const { t } = useLanguage();
  if (!status) return null;
  switch (status) {
    case "Satisfactory":
      return <Badge className="bg-green-100 text-green-700 gap-1"><ShieldCheck className="h-3 w-3" />{t("Satisfactory")}</Badge>;
    case "Unsatisfactory":
      return <Badge className="bg-red-100 text-red-700 gap-1"><ShieldAlert className="h-3 w-3" />{t("Unsatisfactory")}</Badge>;
    case "Not_Applicable":
      return <Badge className="bg-gray-100 text-gray-600 gap-1"><ShieldOff className="h-3 w-3" />{t("N/A")}</Badge>;
    default:
      return <Badge variant="outline">{t(status)}</Badge>;
  }
}

// Report-only remediation SLA (days from report generation).
// Keep in sync with /api/tprm/asr-assessments/[id]/complete which reads the
// authoritative Control Center config at approval time. Higher severity →
// shorter window. The previous mapping here was inverted (High=60, Low=40),
// producing nonsensical "High severity, longest deadline" report rows.
function remediationDaysForSeverity(severity: string | null | undefined): number {
  switch (severity) {
    case "Critical": return 7;
    case "High": return 14;
    case "Medium":
    case "Moderate": return 30;
    case "Low": return 60;
    default: return 0;
  }
}

// Sort weight — drives the "High → Medium → Low" ordering in the report table
// and the corresponding CSV/PDF exports. Unknown/empty severities sink to the
// bottom so rows with real findings always appear first.
const SEVERITY_RANK: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Moderate: 2,
  Low: 3,
};
function severityRank(sev: string | null | undefined): number {
  return sev && SEVERITY_RANK[sev] != null ? SEVERITY_RANK[sev] : 99;
}

function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  const { t } = useLanguage();
  if (!severity) return null;
  switch (severity) {
    case "High": return <Badge className="bg-red-100 text-red-700">{t("High")}</Badge>;
    case "Medium": return <Badge className="bg-amber-100 text-amber-700">{t("Medium")}</Badge>;
    case "Low": return <Badge className="bg-blue-100 text-blue-700">{t("Low")}</Badge>;
    default: return <Badge variant="outline">{t(severity)}</Badge>;
  }
}

function ResponseBadge({ response }: { response: string | null }) {
  const { t } = useLanguage();
  if (!response) return <Badge variant="outline">—</Badge>;
  switch (response) {
    case "Yes": return <Badge className="bg-green-100 text-green-700">{t("Yes")}</Badge>;
    case "No": return <Badge className="bg-red-100 text-red-700">{t("No")}</Badge>;
    case "NA": return <Badge className="bg-gray-100 text-gray-600">{t("N/A")}</Badge>;
    default: return <Badge variant="outline">{t(response)}</Badge>;
  }
}

function AssessmentStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  switch (status) {
    case "Reviewed": case "Approved": case "Completed":
      return <Badge className="bg-green-100 text-green-700">{t(status)}</Badge>;
    case "Returned": case "Rejected":
      return <Badge className="bg-red-100 text-red-700">{t(status)}</Badge>;
    case "Submitted": case "Under Review": case "In-Progress(approver)":
      return <Badge className="bg-blue-100 text-blue-700">{t(status)}</Badge>;
    case "In-Progress":
      return <Badge className="bg-amber-100 text-amber-700">{t(status)}</Badge>;
    default:
      return <Badge variant="outline">{t(status)}</Badge>;
  }
}

// Simple donut/pie chart component
function PieChart({ data, title }: { data: { label: string; value: number; color: string }[]; title: string }) {
  const { t } = useLanguage();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <div className="text-center text-muted-foreground text-sm">{title}: {t("No data")}</div>;

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
  const searchParams = useSearchParams();
  const assessmentId = params.id as string;
  const fromPage = searchParams.get("from");
  const deepLinkQuestionNo = searchParams.get("questionNo");
  const backUrl = fromPage === "task-queue" ? "/tprm/task-queue" : "/tprm/asr-assessments";

  // Data
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [responses, setResponses] = useState<Record<string, AssessmentResponse>>({});
  const [monitoringScores, setMonitoringScores] = useState<{ overallScore: number | null; securityPostureScore: number | null; threatExposureScore: number | null } | null>(null);
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
  const [returnComment, setReturnComment] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);

  // Send to Approver dialog
  const [sendToApproverOpen, setSendToApproverOpen] = useState(false);
  const [approvers, setApprovers] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [selectedApproverId, setSelectedApproverId] = useState<string>("");
  const [sendingToApprover, setSendingToApprover] = useState(false);

  // Translation hooks — must be before any early returns
  const { data: translatedQuestions } = useTranslatedData(questions, { modelName: 'TPRMMasterQuestion' });
  const { data: translatedDomains } = useTranslatedData(domains, { modelName: 'TPRMDomain' });
  const { data: translatedClarifications } = useTranslatedData(clarifications, { modelName: 'TPRMClarification' });
  const { data: translatedComments } = useTranslatedData(comments, { modelName: 'TPRMInternalComment' });

  // Role detection — approver sees different buttons than assessor
  const isApprover = useHasRole("TPRMApprover");
  const isAuditor = useHasRole("TPRMAuditor");

  // Customer name for the "Sincerely" signature on the report. The report is
  // authored by the customer's TPRM team (e.g. "One World") for their vendor —
  // previously we accidentally signed it as the vendor (e.g. "ICICI Bank").
  const { data: session } = useSession();
  const customerName = session?.user?.customerAccountName || t("Third Party Risk Management Team");

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
      setMonitoringScores(data.monitoringScores || null);

      // Initialize report result from saved assessment result
      if (data.assessment.assessmentResult) {
        setReportResult(data.assessment.assessmentResult);
      }

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

  // Honour ?questionNo=… deep-links (used by notification click-throughs,
  // e.g. "Clarification response received"). Once data is loaded, jump to the
  // detail view, scroll the right row into the current page, and select it.
  // Guarded by a ref so the user can navigate away from that question freely.
  const deepLinkAppliedRef = useRef(false);
  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    if (!deepLinkQuestionNo || questions.length === 0) return;
    // Rebuild the parent-index numbering used in `flatQuestions` so the URL
    // value "3" or "3.1" resolves to a stable question id.
    let parentIdx = 0;
    let targetId: string | null = null;
    let targetIndex = -1;
    const list: string[] = [];
    for (const q of questions) {
      parentIdx++;
      const qNo = String(parentIdx);
      list.push(qNo);
      if (qNo === deepLinkQuestionNo) targetId = q.id;
      if (q.children?.length) {
        for (let ci = 0; ci < q.children.length; ci++) {
          const childNo: string = `${qNo}.${ci + 1}`;
          list.push(childNo);
          if (childNo === deepLinkQuestionNo) targetId = q.children[ci].id;
        }
      }
    }
    if (!targetId) return;
    targetIndex = list.indexOf(deepLinkQuestionNo);
    deepLinkAppliedRef.current = true;
    setView("detail");
    setSelectedDomain("all");
    setFilterMode("all");
    setSelectedQuestionId(targetId);
    if (targetIndex >= 0) setCurrentPage(Math.floor(targetIndex / 10));
  }, [deepLinkQuestionNo, questions]);

  // ── Build flat question list ───────────────────────────────────────────

  const flatQuestions = (() => {
    const result: { question: Question | Question["children"][0]; isChild: boolean; parentIndex: number; questionNo: string; domainName: string; domainId: string | null }[] = [];
    let parentIdx = 0;
    for (const q of translatedQuestions) {
      parentIdx++;
      // Domain filter
      if (selectedDomain !== "all" && q.domainId !== selectedDomain) continue;

      const qNo = String(parentIdx);
      result.push({ question: q, isChild: false, parentIndex: parentIdx, questionNo: qNo, domainName: q.domainName, domainId: q.domainId });

      if (q.children && q.children.length > 0) {
        for (let ci = 0; ci < q.children.length; ci++) {
          const child = q.children[ci];
          result.push({ question: child, isChild: true, parentIndex: parentIdx, questionNo: `${qNo}.${ci + 1}`, domainName: q.domainName, domainId: q.domainId });
        }
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

  // Rows that are actual findings (for the VerifAI summary, in-app Assessment
  // Report dialog, CSV export and PDF export). Two things the old code got
  // wrong: (1) it kept "Satisfactory" rows whose AI text happened to be
  // non-empty, inflating the issue count; (2) it preserved question order,
  // so a Low finding could appear above High ones. Filter on the effective
  // status instead, and sort highest severity first.
  const reportIssueRows = verifaiRows
    .filter(row => row.status === "Unsatisfactory")
    .slice()
    .sort((a, b) => {
      const r = severityRank(a.severity) - severityRank(b.severity);
      if (r !== 0) return r;
      // Stable tiebreak by question number so the ordering is deterministic.
      return a.questionNo.localeCompare(b.questionNo, undefined, { numeric: true });
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
      // Trigger translation for the override fields
      triggerTranslation('TPRMAssessmentResponse', selectedResp.id, {
        assessorIssue: overrideIssue,
        assessorRisk: overrideRisk,
        assessorRecommendation: overrideRec,
        assessorComment: overrideComment,
      });
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
      // Server writes a `TPRMAssessmentLog` row on override. Mirror it into
      // the in-memory `assessment.logs` so the Activity Logs dialog surfaces
      // the new entry immediately (otherwise users only see it after a full
      // page reload — the behaviour reported as a "delay").
      setAssessment(prev => prev ? {
        ...prev,
        logs: [
          ...prev.logs,
          {
            id: `local-${Date.now()}`,
            logDate: new Date().toISOString(),
            logMessage: `Assessor overrode AI evaluation: ${overrideStatus}`,
            questionNo: selectedFlat?.questionNo,
          },
        ],
      } : prev);
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
      triggerTranslation('TPRMClarification', newClr.id, { rejectComment: newClr.rejectComment });
      toast({ title: t("Success"), description: t("Clarification requested") });
      // Mirror the server-side log entry into local state — see submitOverride.
      const preview = clarificationText.trim().substring(0, 100);
      setAssessment(prev => prev ? {
        ...prev,
        logs: [
          ...prev.logs,
          {
            id: `local-${Date.now()}`,
            logDate: new Date().toISOString(),
            logMessage: `Clarification requested: ${preview}`,
            questionNo: selectedFlat?.questionNo,
          },
        ],
      } : prev);
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
      triggerTranslation('TPRMInternalComment', newComment.id, { message: newComment.message });
    } catch {
      toast({ title: t("Error"), description: t("Failed to post comment"), variant: "destructive" });
    } finally {
      setCommentSaving(false);
    }
  };

  // ── Approve (Approver role) ───────────────────────────────────────────

  const handleApprove = async () => {
    // Validate clarifications before approving
    const ok = await checkOpenClarifications();
    if (!ok) return;
    setActionSaving(true);
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", assessmentResult: reportResult }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      toast({ title: t("Success"), description: t("Assessment approved") });
      setReportOpen(false);
      router.push(backUrl);
    } catch (err) {
      toast({ title: t("Error"), description: err instanceof Error ? err.message : t("Failed to approve assessment"), variant: "destructive" });
    } finally {
      setActionSaving(false);
    }
  };

  // ── Return to Assessor (Approver role) ──────────────────────────────

  const handleReturnToAssessor = async () => {
    setActionSaving(true);
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return_to_assessor", comment: returnComment }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: t("Assessment returned to assessor") });
      setReturnOpen(false);
      setReturnComment("");
      setReportOpen(false);
      router.push(backUrl);
    } catch {
      toast({ title: t("Error"), description: t("Failed to return assessment"), variant: "destructive" });
    } finally {
      setActionSaving(false);
    }
  };

  // ── Send to Approver (Assessor role) ──────────────────────────────────

  // Check for open clarifications (used before send-to-approver and approve)
  const [clarificationWarningOpen, setClarificationWarningOpen] = useState(false);
  const checkOpenClarifications = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/clarification?questionNo=`);
      if (res.ok) {
        const data = await res.json();
        const open = (data || []).filter((c: Clarification) => c.status !== "Closed" && c.status !== "Submitted");
        if (open.length > 0) {
          setClarificationWarningOpen(true);
          return false;
        }
      }
    } catch { /* ignore, server-side will catch */ }
    return true;
  };

  const openSendToApprover = async () => {
    // Validate clarifications before opening approver selection
    const ok = await checkOpenClarifications();
    if (!ok) return;
    setSendToApproverOpen(true);
    setSelectedApproverId("");
    try {
      const res = await fetch("/api/tprm/asr-assessments/approvers");
      if (res.ok) setApprovers(await res.json());
    } catch {
      toast({ title: t("Error"), description: t("Failed to load approvers"), variant: "destructive" });
    }
  };

  const handleSendToApprover = async () => {
    if (!selectedApproverId) return;
    setSendingToApprover(true);
    try {
      const res = await fetch(`/api/tprm/asr-assessments/${assessmentId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_to_approver", approverId: selectedApproverId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      const approverName = approvers.find(a => a.id === selectedApproverId)?.fullName || "";
      toast({ title: t("Success"), description: `${t("Assessment sent to approver")} ${approverName}` });
      setSendToApproverOpen(false);
      router.push(backUrl);
    } catch (err) {
      toast({ title: t("Error"), description: err instanceof Error ? err.message : t("Failed to send to approver"), variant: "destructive" });
    } finally {
      setSendingToApprover(false);
    }
  };

  // ── Download Excel Report ───────────────────────────────────────────

  const handleDownloadExcel = () => {
    if (!assessment) return;

    const issueRows = reportIssueRows;

    const getDueBy = (severity: string) => {
      const days = remediationDaysForSeverity(severity);
      if (!days) return "—";
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
    };

    // Build CSV content
    const headers = [t("Sr"), t("Issue"), t("Risk"), t("Severity"), t("Due By"), t("Recommendation")];
    const rows = issueRows.map((row, idx) => [
      idx + 1,
      `"${(row.issue !== "—" ? row.issue : "").replace(/"/g, '""')}"`,
      `"${(row.risk !== "—" ? row.risk : "").replace(/"/g, '""')}"`,
      row.severity !== "—" ? row.severity : "",
      getDueBy(row.severity !== "—" ? row.severity : ""),
      `"${(row.recommendation !== "—" ? row.recommendation : "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [
      `${t("Assessment Report")} - ${assessment.vendor.name}`,
      `${t("Assessment Code")}: ${assessment.assessmentCode}`,
      `${t("Status")}: ${t(assessment.status)}`,
      `${t("Vendor")}: ${assessment.vendor.name}`,
      `${t("Submission Date")}: ${assessment.vendorSubmissionDate ? new Date(assessment.vendorSubmissionDate).toLocaleDateString() : "—"}`,
      `${t("High")}: ${summary?.highCount || 0}, ${t("Medium")}: ${summary?.mediumCount || 0}, ${t("Low")}: ${summary?.lowCount || 0}`,
      "",
      headers.join(","),
      ...rows.map(r => r.join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Assessment_Report_${assessment.vendor.name}_${assessment.assessmentCode}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

  // ── Download Report as PDF ─────────────────────────────────────────────

  const handleDownloadReport = () => {
    if (!assessment) return;

    const issueRows = reportIssueRows;

    const getDueBy = (severity: string) => {
      const days = remediationDaysForSeverity(severity);
      if (!days) return "—";
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
    };

    const today = new Date().toLocaleDateString("en-US");
    const submissionDate = assessment.vendorSubmissionDate
      ? new Date(assessment.vendorSubmissionDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")
      : "—";
    const todayFmt = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");

    const tableRows = issueRows.map((row, idx) => `
      <tr>
        <td style="padding:10px 8px;border:1px solid #e0e0e0;vertical-align:top;width:40px;">${idx + 1}</td>
        <td style="padding:10px 8px;border:1px solid #e0e0e0;vertical-align:top;">${row.issue !== "—" ? row.issue : ""}</td>
        <td style="padding:10px 8px;border:1px solid #e0e0e0;vertical-align:top;">${row.risk !== "—" ? row.risk : ""}</td>
        <td style="padding:10px 8px;border:1px solid #e0e0e0;vertical-align:top;width:70px;">${row.severity !== "—" ? row.severity : ""}</td>
        <td style="padding:10px 8px;border:1px solid #e0e0e0;vertical-align:top;width:90px;white-space:nowrap;">${getDueBy(row.severity !== "—" ? row.severity : "")}</td>
        <td style="padding:10px 8px;border:1px solid #e0e0e0;vertical-align:top;">${row.recommendation !== "—" ? row.recommendation : ""}</td>
      </tr>
    `).join("");

    // Severity-count strip that mirrors the in-app report dialog. Widths are
    // proportional; if there are no findings the bar renders muted.
    const highCount = summary?.highCount || 0;
    const mediumCount = summary?.mediumCount || 0;
    const lowCount = summary?.lowCount || 0;
    const totalSev = highCount + mediumCount + lowCount;
    const barSegments = totalSev > 0
      ? `<span style="display:inline-block;height:100%;background:#ef4444;width:${(highCount / totalSev) * 100}%"></span>`
        + `<span style="display:inline-block;height:100%;background:#f59e0b;width:${(mediumCount / totalSev) * 100}%"></span>`
        + `<span style="display:inline-block;height:100%;background:#22c55e;width:${(lowCount / totalSev) * 100}%"></span>`
      : `<span style="display:inline-block;height:100%;background:#e5e7eb;width:100%"></span>`;

    const resultBadgeColor = reportResult === "Satisfactory"
      ? "#15803d"
      : reportResult === "Unsatisfactory"
        ? "#b91c1c"
        : "#c2410c";

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Assessment Report - ${assessment.vendor.name}</title>
  <style>
    @page { margin: 40px 50px; size: A4; }
    body { font-family: Arial, Helvetica, sans-serif; color: #222; font-size: 11px; line-height: 1.5; margin: 0; padding: 0; }
    table { border-collapse: collapse; width: 100%; }
    .header { text-align: center; position: relative; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #333; }
    .header h1 { font-size: 24px; margin: 0; font-weight: bold; }
    .header h2 { font-size: 20px; margin: 0; font-weight: bold; }
    .verifai { position: absolute; top: 0; right: 0; font-size: 18px; font-weight: bold; }
    .verifai span { color: #d4a017; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; }
    .summary { font-size: 11px; margin-bottom: 5px; }
    .summary strong { font-weight: bold; }
    .result-badge { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 12px; font-weight: bold; color: white; font-size: 11px; }
    .scores { font-size: 11px; margin: 12px 0; padding-left: 10px; }
    .scores div { margin-bottom: 2px; }
    .sev-box { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px 14px; margin: 12px 0 16px; }
    .sev-grid { display: table; width: 100%; margin-bottom: 10px; text-align: center; table-layout: fixed; }
    .sev-cell { display: table-cell; vertical-align: top; }
    .sev-cell .num { font-size: 20px; font-weight: bold; }
    .sev-cell .lbl { font-size: 10px; font-weight: 600; margin-top: 2px; }
    .sev-cell.high .num, .sev-cell.high .lbl { color: #dc2626; }
    .sev-cell.med .num, .sev-cell.med .lbl { color: #d97706; }
    .sev-cell.low .num, .sev-cell.low .lbl { color: #16a34a; }
    .sev-bar { height: 10px; border-radius: 999px; overflow: hidden; background: #f3f4f6; font-size: 0; line-height: 0; }
    .issue-table th { background-color: #f3f3f3; padding: 10px 8px; border: 1px solid #e0e0e0; text-align: left; font-size: 11px; font-weight: bold; }
    .footer { margin-top: 30px; font-size: 11px; }
    .footer-sign { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="verifai">Verif<span>AI</span></div>
    <h1>${t("Assessment Report")}</h1>
    <h2>- ${assessment.vendor.name}</h2>
  </div>
  <div class="meta">
    <span>${today}</span>
    <span>${t("Version")}: ${t("Draft")}</span>
  </div>

  <p class="summary">
    <strong>${t("Third Party Risk Management Team conducted a due diligence review of")} ${assessment.vendor.name} ${t("from")} ${submissionDate} ${t("till")} ${todayFmt}. ${t("The control environment was found to be")}:</strong>
    <span class="result-badge" style="background:${resultBadgeColor}">${t(reportResult)}</span>
  </p>
  ${monitoringScores ? `<div class="scores">
    <div>${t("Overall Cybersecurity Score")} : ${monitoringScores.overallScore != null ? Math.round(monitoringScores.overallScore) : ""}</div>
    <div>${t("Security Posture Score")} : ${monitoringScores.securityPostureScore != null ? Math.round(monitoringScores.securityPostureScore) : ""}</div>
    <div>${t("Threat Exposure Score")} : ${monitoringScores.threatExposureScore != null ? Math.round(monitoringScores.threatExposureScore) : ""}</div>
  </div>` : ""}

  <div class="sev-box">
    <div class="sev-grid">
      <div class="sev-cell high"><div class="num">${highCount}</div><div class="lbl">${t("High")}</div></div>
      <div class="sev-cell med"><div class="num">${mediumCount}</div><div class="lbl">${t("Medium")}</div></div>
      <div class="sev-cell low"><div class="num">${lowCount}</div><div class="lbl">${t("Low")}</div></div>
    </div>
    <div class="sev-bar">${barSegments}</div>
  </div>

  <table class="issue-table">
    <thead>
      <tr>
        <th style="width:40px;">${t("Sr")}</th>
        <th>${t("Issue")}</th>
        <th>${t("Risk")}</th>
        <th style="width:70px;">${t("Severity")}</th>
        <th style="width:90px;">${t("Due By")}</th>
        <th>${t("Recommendation")}</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows.length > 0 ? tableRows : `<tr><td colspan="6" style="padding:20px;text-align:center;border:1px solid #e0e0e0;">${t("No issues found")}</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    <p>${t("For any further questions or follow-ups on this report, please reach out to us.")}</p>
    <p style="text-align:right;">${t("Sincerely")},<br/><strong>${customerName}</strong></p>
  </div>

  <div class="footer-sign">
    <span>${t("Prepared By")} : ${assessment.assessor?.fullName || t("Assessor")}</span>
    <span>${t("Third Party Risk Management Team")}.</span>
  </div>

</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.onload = () => w.print();
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
        <Button variant="outline" className="mt-4" onClick={() => router.push(backUrl)}>
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
            <Button size="sm" onClick={() => router.push(backUrl)}>
              <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Back")}
            </Button>
            <h1 className="text-xl font-semibold">{t("Assessment Summary")}</h1>
          </div>
          <div className="flex items-center gap-2">
            {!isApprover && !isAuditor && (assessment.status === "In-Progress" || assessment.status === "Returned" || assessment.status === "Submitted" || assessment.status === "Under Review") && (
              <Button variant="outline" size="sm" onClick={handleRerunAI} disabled={rerunning}>
                {rerunning ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" /> : <RefreshCw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />}
                {rerunning ? t("Re-evaluating...") : t("Re-evaluate AI")}
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
          <span className="text-sm">{t("Status")}: <span className="font-medium">{t(assessment.status)}</span></span>
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
                {translatedDomains.map(domain => {
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
                {/* Table rows — only Unsatisfactory findings, sorted High→Low */}
                {reportIssueRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("No issues found")}</p>
                ) : (
                  <div className="divide-y">
                    {reportIssueRows.map(row => (
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

        {/* Send to Approver dialog */}
        <Dialog open={sendToApproverOpen} onOpenChange={setSendToApproverOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{t("Complete Assessment")}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{t("Select an approver to send this assessment for final approval.")}</p>
            <div>
              <span className="text-sm font-medium block mb-2">{t("Approver")}</span>
              <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                <SelectTrigger><SelectValue placeholder={t("Select an approver")} /></SelectTrigger>
                <SelectContent>
                  {approvers.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {approvers.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">{t("No approvers found. Please add users with the TPRMApprover role.")}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendToApproverOpen(false)}>{t("Cancel")}</Button>
              <Button onClick={handleSendToApprover} disabled={sendingToApprover || !selectedApproverId}>
                {sendingToApprover && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
                <Send className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Send to Approver")}
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
          <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
            <FileText className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Generate Report")}
          </Button>
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
              {translatedDomains.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
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
          <p className="mt-1 text-sm font-medium">{t(assessment.status)}</p>
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

          {/* Pagination — only show when more than one page */}
          {totalPages > 1 && (
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
          )}

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
                {!isAuditor && assessment.status !== "Approved" && (
                  <>
                    <Button size="sm" onClick={openOverride}>
                      {t("Override AI")}
                    </Button>
                    <Button size="sm" onClick={openClarification}>
                      {t("Clarification")}
                    </Button>
                  </>
                )}
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
                      <h4 className="text-sm font-semibold mb-1">{isApprover ? t("Approver Comment") : t("Assessor Comment")}</h4>
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
                    {s === "Not_Applicable" ? t("N/A") : t(s)}
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
              <span className="text-sm font-medium block mb-1">{isApprover ? t("Approver Comment") : t("Assessor Comment")}</span>
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
            {translatedClarifications.length > 0 && (
              <div className="space-y-2">
                {translatedClarifications.map(clr => (
                  <div key={clr.id} className="border rounded-lg p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{clr.requestedBy?.fullName || "—"}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{t(clr.status)}</Badge>
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
            {translatedComments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t("No comments yet")}</p>
            )}
            {translatedComments.map(c => (
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
          {!isAuditor && (
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
          )}
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

      {/* Send to Approver dialog (detail view, same as summary) */}
      <Dialog open={sendToApproverOpen} onOpenChange={setSendToApproverOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("Complete Assessment")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("Select an approver to send this assessment for final approval.")}</p>
          <div>
            <span className="text-sm font-medium block mb-2">{t("Approver")}</span>
            <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
              <SelectTrigger><SelectValue placeholder={t("Select an approver")} /></SelectTrigger>
              <SelectContent>
                {approvers.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {approvers.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">{t("No approvers found. Please add users with the TPRMApprover role.")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendToApproverOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleSendToApprover} disabled={sendingToApprover || !selectedApproverId}>
              {sendingToApprover && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              <Send className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Send to Approver")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-[85vw] max-h-[90vh] overflow-y-auto p-0" showCloseButton={false} accessibleTitle="Assessment Report">
          {/* Report document area — styled like a PDF preview */}
          <div className="bg-white dark:bg-background">
            {/* Header with border bottom */}
            <div className="px-8 pt-8 pb-4 border-b-2 border-foreground/80">
              <div className="flex items-start justify-between">
                <div className="text-center flex-1">
                  <h1 className="text-2xl font-bold tracking-tight">{t("Assessment Report")}</h1>
                  <h2 className="text-xl font-bold mt-0.5">- {assessment.vendor.name}</h2>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-bold">Verif<span className="text-amber-500">AI</span></span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>{new Date().toLocaleDateString()}</span>
                <span>{t("Version")}: {t("Draft")}</span>
              </div>
            </div>

            {/* Body content */}
            <div className="px-8 py-5 space-y-5">
              {/* Summary paragraph */}
              <p className="text-sm leading-relaxed">
                <strong>
                  {t("Third Party Risk Management Team conducted a due diligence review of")} {assessment.vendor.name} {t("from")} {assessment.vendorSubmissionDate ? new Date(assessment.vendorSubmissionDate).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-") : "—"} {t("till")} {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")}. {t("The control environment was found to be:")}
                </strong>
              </p>

              {/* Assessment Result radio — inline with summary feel */}
              <div className="flex items-center gap-8 pl-2">
                {assessment.status === "Approved" ? (
                  <Badge className={
                    reportResult === "Satisfactory" ? "bg-green-100 text-green-700 border-green-300" :
                    reportResult === "Unsatisfactory" ? "bg-red-100 text-red-700 border-red-300" :
                    "bg-orange-100 text-orange-700 border-orange-300"
                  }>
                    {t(reportResult)}
                  </Badge>
                ) : (
                  ["Satisfactory", "Unsatisfactory", "Deficient"].map(opt => (
                    <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="reportResultRadio"
                        value={opt}
                        checked={reportResult === opt}
                        onChange={() => setReportResult(opt)}
                        className="accent-primary w-4 h-4 cursor-pointer"
                      />
                      <span className={`text-sm ${reportResult === opt ? "font-semibold" : ""}`}>{t(opt)}</span>
                    </label>
                  ))
                )}
              </div>

              {/* Monitoring Scores — only shown if monitoring data exists */}
              {monitoringScores && (
                <div className="text-sm space-y-0.5 pl-2">
                  <p className="text-muted-foreground">{t("Overall Cybersecurity Score")} : {monitoringScores.overallScore != null ? <span className="font-semibold text-foreground">{Math.round(monitoringScores.overallScore)}</span> : ""}</p>
                  <p className="text-muted-foreground">{t("Security Posture Score")} : {monitoringScores.securityPostureScore != null ? <span className="font-semibold text-foreground">{Math.round(monitoringScores.securityPostureScore)}</span> : ""}</p>
                  <p className="text-muted-foreground">{t("Threat Exposure Score")} : {monitoringScores.threatExposureScore != null ? <span className="font-semibold text-foreground">{Math.round(monitoringScores.threatExposureScore)}</span> : ""}</p>
                </div>
              )}

              {/* Severity summary bar */}
              <div className="border rounded-lg p-4">
                <div className="grid grid-cols-3 text-center mb-3">
                  <div>
                    <span className="text-2xl font-bold text-red-600">{summary?.highCount || 0}</span>
                    <p className="text-xs font-semibold text-red-600 mt-0.5">{t("High")}</p>
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-amber-600">{summary?.mediumCount || 0}</span>
                    <p className="text-xs font-semibold text-amber-600 mt-0.5">{t("Medium")}</p>
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-green-600">{summary?.lowCount || 0}</span>
                    <p className="text-xs font-semibold text-green-600 mt-0.5">{t("Low")}</p>
                  </div>
                </div>
                <div className="h-3 flex rounded-full overflow-hidden">
                  {totalSeverity > 0 ? (
                    <>
                      <div className="bg-red-500 h-full transition-all" style={{ width: `${((summary?.highCount || 0) / totalSeverity) * 100}%` }} />
                      <div className="bg-amber-500 h-full transition-all" style={{ width: `${((summary?.mediumCount || 0) / totalSeverity) * 100}%` }} />
                      <div className="bg-green-500 h-full transition-all" style={{ width: `${((summary?.lowCount || 0) / totalSeverity) * 100}%` }} />
                    </>
                  ) : (
                    <div className="bg-muted h-full w-full" />
                  )}
                </div>
              </div>

              {/* Issues table — clean bordered table style matching PDF */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="border border-border/60 px-3 py-2.5 text-left font-semibold w-[45px]">{t("Sr")}</th>
                      <th className="border border-border/60 px-3 py-2.5 text-left font-semibold">{t("Issue")}</th>
                      <th className="border border-border/60 px-3 py-2.5 text-left font-semibold">{t("Risk")}</th>
                      <th className="border border-border/60 px-3 py-2.5 text-left font-semibold w-[80px]">{t("Severity")}</th>
                      <th className="border border-border/60 px-3 py-2.5 text-left font-semibold w-[95px]">{t("Due By")}</th>
                      <th className="border border-border/60 px-3 py-2.5 text-left font-semibold">{t("Recommendation")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportIssueRows
                      .map((row, idx) => {
                        const dueDays = remediationDaysForSeverity(row.severity);
                        const dueDate = new Date(); if (dueDays) dueDate.setDate(dueDate.getDate() + dueDays);
                        const dueBy = dueDays ? dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-") : "—";
                        return (
                          <tr key={row.questionNo} className="align-top">
                            <td className="border border-border/60 px-3 py-2.5">{idx + 1}</td>
                            <td className="border border-border/60 px-3 py-2.5">{row.issue !== "—" ? row.issue : ""}</td>
                            <td className="border border-border/60 px-3 py-2.5 text-muted-foreground">{row.risk !== "—" ? row.risk : ""}</td>
                            <td className="border border-border/60 px-3 py-2.5">{row.severity !== "—" ? row.severity : ""}</td>
                            <td className="border border-border/60 px-3 py-2.5 whitespace-nowrap">{dueBy}</td>
                            <td className="border border-border/60 px-3 py-2.5 text-muted-foreground">{row.recommendation !== "—" ? row.recommendation : ""}</td>
                          </tr>
                        );
                      })}
                    {reportIssueRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="border border-border/60 px-3 py-8 text-center text-muted-foreground">{t("No issues found")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer text — signed by the customer (report author), not
                  the vendor being assessed. */}
              <div className="pt-4 space-y-4 text-sm">
                <p>{t("For any further questions or follow-ups on this report, please reach out to us.")}</p>
                <div className="text-right">
                  <p>{t("Sincerely,")}</p>
                  <p className="font-bold">{customerName}</p>
                </div>
              </div>

              {/* Prepared By / Team line */}
              <div className="flex items-center justify-between pt-2 border-t text-sm text-muted-foreground">
                <span>{t("Prepared By")} : {assessment.assessor?.fullName || t("Assessor")}</span>
                <span>{t("Third Party Risk Management Team.")}</span>
              </div>
            </div>
          </div>

          {/* Action bar — sticky at bottom */}
          <div className="sticky bottom-0 bg-muted/50 backdrop-blur-sm border-t px-8 py-3 flex items-center justify-end gap-3">
            {isAuditor ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setReportOpen(false)}>{t("Close")}</Button>
                <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
                  <FileSpreadsheet className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />{t("Download Excel Report")}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                  <Download className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />{t("Download Report")}
                </Button>
              </>
            ) : isApprover ? (
              <>
                <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                  <Download className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />{t("Download PDF Report")}
                </Button>
                {assessment.status === "In-Progress(approver)" && (
                  <>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={actionSaving}>
                      {actionSaving ? <Loader2 className="h-4 w-4 animate-spin ltr:mr-1.5 rtl:ml-1.5" /> : <CheckCircle2 className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />}
                      {t("Approve")}
                    </Button>
                    <Button variant="outline" size="sm" className="border-amber-500 text-amber-700 hover:bg-amber-50" onClick={() => setReturnOpen(true)}>
                      <RotateCcw className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />{t("Return to Assessor")}
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => setReportOpen(false)}>{t("Close")}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setReportOpen(false)}>{t("Close")}</Button>
                <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
                  <FileSpreadsheet className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />{t("Download Excel Report")}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                  <Download className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />{t("Download Report")}
                </Button>
                {assessment.status !== "In-Progress(approver)" && assessment.status !== "Approved" && (
                  <Button size="sm" onClick={() => { setReportOpen(false); openSendToApprover(); }}>
                    <UserCheck className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />{t("Complete Assessment")}
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Return to Assessor Dialog (Approver only) */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Return to Assessor")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("This will return the assessment back to the assessor for further review.")}</p>
          <div>
            <span className="text-sm font-medium block mb-1">{t("Comment")}</span>
            <Textarea
              value={returnComment}
              onChange={e => setReturnComment(e.target.value)}
              placeholder={t("Reason for returning (optional)...")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>{t("Cancel")}</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleReturnToAssessor} disabled={actionSaving}>
              {actionSaving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              <RotateCcw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />{t("Return to Assessor")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open Clarifications Warning Dialog */}
      <Dialog open={clarificationWarningOpen} onOpenChange={setClarificationWarningOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("Open Clarifications")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("There are open clarifications. Please resolve all clarifications before proceeding.")}
          </p>
          <DialogFooter>
            <Button onClick={() => setClarificationWarningOpen(false)}>{t("OK")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

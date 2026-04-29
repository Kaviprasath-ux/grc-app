"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Download, Search, X, AlertTriangle, Home, ChevronRight, Loader2,
  Eye, FileText, ExternalLink, MessageSquare, ShieldCheck, Send, Ban, ArrowLeft, Forward, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataGrid } from "@/components/shared";
import { ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
import { useLanguage } from "@/contexts/LanguageContext";
import { RemediationComments } from "@/components/tprm/remediation-comments";

// ==================== TYPES ====================

interface IssueRegisterEntry {
  id: string;
  department: string | null;
  vendorName: string;
  vendorCode: string | null;
  high: number;
  medium: number;
  low: number;
  total: number;
  status: string;
}

interface RemediationComment {
  id: string;
  message: string;
  userRole: string | null;
  userName: string;
  createdAt: string;
}

interface IssueRemediationEntry {
  id: string;
  issueCode: string | null;
  vendorId: string | null;
  vendorName: string;
  vendorCode: string;
  domain: string | null;
  severity: string;
  issue: string | null;
  risk: string | null;
  recommendation: string | null;
  questionNo: string | null;
  questionText: string | null;
  questionResponse: string | null;
  reassignComment: string | null;
  amResponse: string | null;
  amComment: string | null;
  assessorComment: string | null;
  artifactUrl: string | null;
  artifactName: string | null;
  assignedTo: string | null;
  requestedDate: string | null;
  responseDate: string | null;
  dueDate: string | null;
  status: string;
  createdAt: string;
  comments: RemediationComment[];
}

interface VendorRiskIssue {
  id: string;
  remediationId: string | null;
  domain: string | null;
  severity: string;
  issue: string | null;
  risk: string | null;
  recommendation: string | null;
  assessmentCode: string | null;
  dueDate: string | null;
  status: string;
  issueCode: string;
  questionNo: string | null;
}

interface VendorIssueEntry {
  id: string;
  title: string;
  description: string | null;
  vendorName: string;
  vendorCode: string;
  severity: string;
  dueDate: string | null;
  resolution: string | null;
  status: string;
  reportedBy: string | null;
  createdAt: string;
}

// ==================== HELPERS ====================

const SEVERITY_COLORS: Record<string, string> = {
  High: "border-red-300 bg-red-50 text-red-700",
  Critical: "border-red-300 bg-red-50 text-red-700",
  Medium: "border-orange-300 bg-orange-50 text-orange-700",
  Low: "border-green-300 bg-green-50 text-green-700",
};

const STATUS_COLORS: Record<string, string> = {
  Open: "border-blue-300 bg-blue-50 text-blue-700",
  "In Progress": "border-yellow-300 bg-yellow-50 text-yellow-700",
  Closed: "border-slate-300 bg-slate-50 text-slate-700",
  Resolved: "border-green-300 bg-green-50 text-green-700",
  "Awaiting Response": "border-purple-300 bg-purple-50 text-purple-700",
  Rejected: "border-red-300 bg-red-50 text-red-700",
  Terminated: "border-red-300 bg-red-50 text-red-700",
  Pending: "border-yellow-300 bg-yellow-50 text-yellow-700",
  "Assigned to BO": "border-blue-300 bg-blue-50 text-blue-700",
  "Assigned to IT": "border-indigo-300 bg-indigo-50 text-indigo-700",
  "IT Submitted": "border-teal-300 bg-teal-50 text-teal-700",
  "IT Approved": "border-emerald-300 bg-emerald-50 text-emerald-700",
  "Returned to IT": "border-rose-300 bg-rose-50 text-rose-700",
  Submitted: "border-orange-300 bg-orange-50 text-orange-700",
  Overdue: "border-red-300 bg-red-50 text-red-700",
  "Sent to Vendor": "border-amber-300 bg-amber-50 text-amber-700",
};

const SEVERITIES = ["High", "Medium", "Low"];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

function getSeverityVariant(severity: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "High": return "destructive";
    case "Medium": return "secondary";
    case "Low": return "default";
    default: return "outline";
  }
}

// ==================== MAIN COMPONENT ====================

export default function BOIssuesPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("register");

  // Data
  const [registerEntries, setRegisterEntries] = useState<IssueRegisterEntry[]>([]);
  const [remediationEntries, setRemediationEntries] = useState<IssueRemediationEntry[]>([]);
  const [vendorIssueEntries, setVendorIssueEntries] = useState<VendorIssueEntry[]>([]);

  // Issue Register filters
  const [regVendorSearch, setRegVendorSearch] = useState("");
  const [regStatusFilter, setRegStatusFilter] = useState("all");

  // Vendor risk register drill-down
  const [selectedVendor, setSelectedVendor] = useState<{ id: string; name: string } | null>(null);
  const [vendorRiskIssues, setVendorRiskIssues] = useState<VendorRiskIssue[]>([]);
  const [vendorRiskLoading, setVendorRiskLoading] = useState(false);
  const [riskDomainSearch, setRiskDomainSearch] = useState("");
  const [viewIssueDetail, setViewIssueDetail] = useState<VendorRiskIssue | null>(null);

  // Issue Remediation filters
  const [remSearch, setRemSearch] = useState("");
  const [remSeverityFilter, setRemSeverityFilter] = useState("all");
  const [remSubTab, setRemSubTab] = useState("Open");
  const [remDateFilter, setRemDateFilter] = useState("");

  // Vendor Issues filters
  const [viSeverityFilter, setViSeverityFilter] = useState("all");
  const [viSubTab, setViSubTab] = useState("Open");

  // Remediation detail modal
  const [viewRemediation, setViewRemediation] = useState<IssueRemediationEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Comment dialog (for Accept Risk, Send To Assessor)
  const [commentAction, setCommentAction] = useState<{ remediationId: string; targetStatus: string } | null>(null);
  const [commentText, setCommentText] = useState("");

  // Terminate Vendor confirmation dialog
  const [terminateConfirm, setTerminateConfirm] = useState<{ remediationId: string; vendorId: string } | null>(null);

  // Vendor Issue detail dialog
  const [viewVendorIssue, setViewVendorIssue] = useState<VendorIssueEntry | null>(null);
  const [closingVendorIssueId, setClosingVendorIssueId] = useState<string | null>(null);
  const [commentsOnlyId, setCommentsOnlyId] = useState<string | null>(null);

  // Dynamic data translation
  const { data: translatedVendorRiskIssues } = useTranslatedData(vendorRiskIssues, { modelName: 'TPRMIssueRemediation' });
  const { data: translatedRemediationEntries } = useTranslatedData(remediationEntries, { modelName: 'TPRMIssueRemediation' });
  const { data: translatedVendorIssueEntries } = useTranslatedData(vendorIssueEntries, { modelName: 'TPRMVendorIssue' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [regRes, remRes, viRes] = await Promise.all([
        fetch("/api/tprm/bo-issues?tab=register"),
        fetch("/api/tprm/bo-issues?tab=remediation"),
        fetch("/api/tprm/bo-issues?tab=vendor-issues"),
      ]);

      if (regRes.ok) {
        const regData = await regRes.json();
        setRegisterEntries(regData.data || []);
      }
      if (remRes.ok) {
        const remData = await remRes.json();
        setRemediationEntries(remData.data || []);
      }
      if (viRes.ok) {
        const viData = await viRes.json();
        setVendorIssueEntries(viData.data || []);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load data"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { loadData(); }, [loadData]);

  // Close a vendor issue (BO action on Vendor Issues tab)
  const handleCloseVendorIssue = useCallback(async (issueId: string) => {
    setClosingVendorIssueId(issueId);
    try {
      const res = await fetch("/api/tprm/bo-issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: issueId, kind: "vendor-issue", status: "Closed" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: t("Vendor issue closed") });
      setViewVendorIssue(null);
      loadData();
    } catch {
      toast({ title: t("Error"), description: t("Failed to close vendor issue"), variant: "destructive" });
    } finally {
      setClosingVendorIssueId(null);
    }
  }, [toast, t, loadData]);

  // Opens the comment dialog before performing an action
  const openCommentDialog = useCallback((remediationId: string, targetStatus: string) => {
    setCommentAction({ remediationId, targetStatus });
    setCommentText("");
    setViewRemediation(null);
  }, []);

  // Saves the comment and performs the action
  const handleCommentSave = useCallback(async () => {
    if (!commentAction) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/tprm/bo-issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: commentAction.remediationId,
          status: commentAction.targetStatus,
          addComment: commentText.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        // Trigger translation for the comment if one was added
        if (commentText.trim() && data.commentId) {
          triggerTranslation('TPRMRemediationComment', data.commentId, { message: commentText.trim() });
        }
        toast({ title: t("Success"), description: t("Issue updated successfully") });
        setCommentAction(null);
        setCommentText("");
        loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: t("Error"), description: data.error || t("Failed to update issue"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to update issue"), variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }, [commentAction, commentText, toast, t, loadData]);

  // Handles the Terminate Vendor → creates offboard assessment
  const handleTerminateInitiate = useCallback(async () => {
    if (!terminateConfirm) return;
    setActionLoading(true);
    try {
      // Create offboard assessment for the vendor
      const res = await fetch("/api/tprm/offboard-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: terminateConfirm.vendorId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // Add comment to the remediation about termination initiation
        const terminationComment = `Vendor termination initiated - offboarding assessment ${data.assessmentCode || ""} created`;
        const commentRes = await fetch("/api/tprm/bo-issues", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: terminateConfirm.remediationId,
            addComment: terminationComment,
          }),
        });
        const commentData = await commentRes.json().catch(() => ({}));
        if (commentData.commentId) {
          triggerTranslation('TPRMRemediationComment', commentData.commentId, { message: terminationComment });
        }
        toast({ title: t("Success"), description: t("Offboard assessment created. The vendor will receive the offboarding questionnaire.") });
        setTerminateConfirm(null);
        loadData();
      } else {
        toast({ title: t("Error"), description: data.error || t("Failed to initiate termination"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to initiate termination"), variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }, [terminateConfirm, toast, t, loadData]);

  // ==================== VENDOR RISK REGISTER DRILL-DOWN ====================
  const loadVendorRiskIssues = useCallback(async (vendorId: string, vendorName: string) => {
    setSelectedVendor({ id: vendorId, name: vendorName });
    setVendorRiskLoading(true);
    setRiskDomainSearch("");
    try {
      const res = await fetch(`/api/tprm/bo-issues?tab=register-detail&vendorId=${vendorId}`);
      if (res.ok) {
        const json = await res.json();
        setVendorRiskIssues(json.data || []);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load vendor issues"), variant: "destructive" });
    } finally {
      setVendorRiskLoading(false);
    }
  }, [toast, t]);

  // ==================== ISSUE REGISTER ====================

  const filteredRegister = useMemo(() => {
    return registerEntries.filter((e) => {
      const matchesSearch = regVendorSearch === "" ||
        e.vendorName.toLowerCase().includes(regVendorSearch.toLowerCase());
      const matchesStatus = regStatusFilter === "all" || e.status === regStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [registerEntries, regVendorSearch, regStatusFilter]);

  const registerColumns: ColumnDef<IssueRegisterEntry>[] = [
    { accessorKey: "vendorCode", header: t("Vendor ID"), cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.vendorCode || "-"}</span> },
    {
      accessorKey: "vendorName", header: t("Vendor Name"),
      cell: ({ row }) => (
        <button className="font-medium text-sm text-primary hover:underline cursor-pointer" onClick={() => loadVendorRiskIssues(row.original.id, row.original.vendorName)}>
          {row.original.vendorName}
        </button>
      ),
    },
    { accessorKey: "high", header: t("High"), cell: ({ row }) => <span className={`text-sm font-medium ${row.original.high > 0 ? "text-red-600" : "text-muted-foreground"}`}>{row.original.high}</span> },
    { accessorKey: "medium", header: t("Medium"), cell: ({ row }) => <span className={`text-sm font-medium ${row.original.medium > 0 ? "text-orange-600" : "text-muted-foreground"}`}>{row.original.medium}</span> },
    { accessorKey: "low", header: t("Low"), cell: ({ row }) => <span className={`text-sm font-medium ${row.original.low > 0 ? "text-green-600" : "text-muted-foreground"}`}>{row.original.low}</span> },
    { accessorKey: "total", header: t("Total"), cell: ({ row }) => <span className="text-sm font-bold">{row.original.total}</span> },
    { accessorKey: "status", header: t("Status"), cell: ({ row }) => <Badge variant="outline" className={`${STATUS_COLORS[row.original.status] || ""} text-xs font-medium`}>{t(row.original.status)}</Badge> },
  ];

  const handleExport = () => {
    const headers = ["Vendor ID", "Vendor Name", "High", "Medium", "Low", "Total", "Status"];
    const rows = filteredRegister.map((e) => [e.vendorCode || "", e.vendorName, e.high, e.medium, e.low, e.total, e.status]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bo-issue-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==================== ISSUE REMEDIATION ====================

  const filteredRemediation = useMemo(() => {
    const filtered = translatedRemediationEntries.filter((e) => {
      const matchesSearch = remSearch === "" ||
        e.vendorName.toLowerCase().includes(remSearch.toLowerCase()) ||
        (e.issueCode && e.issueCode.toLowerCase().includes(remSearch.toLowerCase()));
      const matchesSeverity = remSeverityFilter === "all" || e.severity === remSeverityFilter;
      const matchesSubTab =
        remSubTab === "Open"
          ? e.status === "Assigned to BO"
          : remSubTab === "Closed"
          ? ["Closed", "Submitted", "Terminated", "Sent to Vendor"].includes(e.status)
          : remSubTab === "Rejected"
          ? e.status === "Rejected"
          : true;
      const matchesDate = !remDateFilter || (e.responseDate && e.responseDate.startsWith(remDateFilter));
      return matchesSearch && matchesSeverity && matchesSubTab && matchesDate;
    });
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered;
  }, [translatedRemediationEntries, remSearch, remSeverityFilter, remSubTab, remDateFilter]);

  const remediationColumns: ColumnDef<IssueRemediationEntry>[] = [
    { accessorKey: "issueCode", header: t("Issue ID"), cell: ({ row }) => <span className="font-mono text-sm">{row.original.issueCode || row.original.id.slice(0, 6).toUpperCase()}</span> },
    { accessorKey: "vendorName", header: t("Vendor Name"), cell: ({ row }) => <span className="text-sm font-medium">{row.original.vendorName}</span> },
    { accessorKey: "domain", header: t("Domain"), cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.domain || "-"}</span> },
    { accessorKey: "severity", header: t("Severity"), cell: ({ row }) => row.original.severity ? <Badge variant={getSeverityVariant(row.original.severity)}>{t(row.original.severity)}</Badge> : <span>-</span> },
    { accessorKey: "responseDate", header: t("Response Date"), cell: ({ row }) => <span className="text-sm">{formatDate(row.original.responseDate || row.original.requestedDate)}</span> },
    { accessorKey: "dueDate", header: t("Due Date"), cell: ({ row }) => <span className="text-sm">{formatDate(row.original.dueDate)}</span> },
    {
      id: "comments", header: t("Comments"),
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setCommentsOnlyId(row.original.id)}>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </Button>
      ),
    },
    {
      id: "actions", header: t("Action"),
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setViewRemediation(row.original)}>
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  // ==================== VENDOR ISSUES ====================

  const filteredVendorIssues = useMemo(() => {
    return translatedVendorIssueEntries.filter((e) => {
      const matchesSeverity = viSeverityFilter === "all" || e.severity === viSeverityFilter;
      const matchesSubTab =
        viSubTab === "Open" ? ["Open", "Pending"].includes(e.status)
        : viSubTab === "Closed" ? ["Closed", "Resolved"].includes(e.status)
        : viSubTab === "Awaiting Response" ? ["Submitted", "Awaiting Response"].includes(e.status)
        : e.status === viSubTab;
      return matchesSeverity && matchesSubTab;
    });
  }, [translatedVendorIssueEntries, viSeverityFilter, viSubTab]);

  const vendorIssueColumns: ColumnDef<VendorIssueEntry>[] = [
    { accessorKey: "title", header: t("Title"), cell: ({ row }) => <span className="text-sm font-medium">{row.original.title}</span> },
    { accessorKey: "status", header: t("Status"), cell: ({ row }) => <Badge variant="outline" className={`${STATUS_COLORS[row.original.status] || ""} text-xs font-medium`}>{t(row.original.status)}</Badge> },
    { accessorKey: "severity", header: t("Severity"), cell: ({ row }) => row.original.severity ? <Badge variant="outline" className={`${SEVERITY_COLORS[row.original.severity] || ""} text-xs font-medium`}>{t(row.original.severity)}</Badge> : <span>-</span> },
    { accessorKey: "dueDate", header: t("Due Date"), cell: ({ row }) => <span className="text-sm">{formatDate(row.original.dueDate)}</span> },
    {
      id: "actions", header: t("Action"),
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setViewVendorIssue(row.original)} title={t("View")}>
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  const remSubTabs = [
    { value: "Open", label: t("Open Issues") },
    { value: "Closed", label: t("Closed Issues") },
  ];

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Issue Management")}</span>
      </nav>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setRemSearch(""); }}>
        <TabsList className="ltr:justify-start rtl:justify-end">
          <TabsTrigger value="register">{t("Issue Register")}</TabsTrigger>
          <TabsTrigger value="remediation">{t("Issue Remediation")}</TabsTrigger>
          <TabsTrigger value="vendor-issues">{t("Vendor Issues")}</TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: ISSUE REGISTER ==================== */}
        <TabsContent value="register" className="space-y-4 mt-4">
          {selectedVendor ? (
            /* ---- Vendor Risk Register Drill-down ---- */
            <>
              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" size="sm" onClick={() => { setSelectedVendor(null); setVendorRiskIssues([]); }}>
                  <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("Back")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const headers = ["Domain", "Severity", "Issue", "Risk", "Assessment ID", "Due Date", "Status"];
                  const rows = translatedVendorRiskIssues.map((i) => [
                    i.domain || "", i.severity, (i.issue || "").replace(/,/g, ";"), (i.risk || "").replace(/,/g, ";"),
                    i.assessmentCode || "", i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "", i.status,
                  ]);
                  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `risk-register-${selectedVendor.name}.csv`; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Export")}
                </Button>
              </div>

              <h2 className="text-xl font-bold">{t("Risk Register For")} {selectedVendor.name}</h2>

              <div className="relative max-w-sm">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t("Search Domain")} value={riskDomainSearch} onChange={(e) => setRiskDomainSearch(e.target.value)} className="ltr:pl-9 rtl:pr-9" />
                {riskDomainSearch && (
                  <button className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2" onClick={() => setRiskDomainSearch("")}>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {vendorRiskLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (() => {
                const filteredRisk = translatedVendorRiskIssues.filter((i) =>
                  !riskDomainSearch || (i.domain && i.domain.toLowerCase().includes(riskDomainSearch.toLowerCase()))
                );
                return filteredRisk.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>{t("No issues found")}</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[1fr_100px_1.5fr_1.5fr_120px_100px_100px] bg-muted/50 border-b px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                      <span>{t("Domain")}</span>
                      <span>{t("Severity")}</span>
                      <span>{t("Issue")}</span>
                      <span>{t("Risk")}</span>
                      <span>{t("Assessment ID")}</span>
                      <span>{t("Due Date")}</span>
                      <span>{t("Status")}</span>
                    </div>
                    <div className="divide-y">
                      {filteredRisk.map((issue) => (
                        <div key={issue.id} className="grid grid-cols-[1fr_100px_1.5fr_1.5fr_120px_100px_100px] px-4 py-3 text-sm items-start gap-y-1">
                          <span className="text-primary font-medium">{issue.domain || "-"}</span>
                          <span>
                            <Badge variant={getSeverityVariant(issue.severity)} className="text-xs">{t(issue.severity)}</Badge>
                          </span>
                          <span className="text-muted-foreground line-clamp-2">{issue.issue || "-"}</span>
                          <span className="text-muted-foreground line-clamp-2">{issue.risk || "-"}</span>
                          <span className="font-mono text-xs">{issue.assessmentCode || "-"}</span>
                          <span>{formatDate(issue.dueDate)}</span>
                          <span>
                            <button onClick={() => setViewIssueDetail(issue)}>
                              <Badge variant="outline" className={`${STATUS_COLORS[issue.status] || ""} text-xs font-medium cursor-pointer hover:opacity-80`}>
                                {t(issue.status)}
                              </Badge>
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            /* ---- Main Issue Register Table ---- */
            <>
              <h2 className="text-xl font-bold">{t("Issue Register")}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={t("Search")} value={regVendorSearch} onChange={(e) => setRegVendorSearch(e.target.value)} className="ltr:pl-9 rtl:pr-9" />
                  {regVendorSearch && <button className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2" onClick={() => setRegVendorSearch("")}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
                </div>
                <Select value={regStatusFilter} onValueChange={setRegStatusFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder={t("Status")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("All Statuses")}</SelectItem>
                    {["Open", "Closed"].map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="ltr:ml-auto rtl:mr-auto">
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Export")}
                  </Button>
                </div>
              </div>
              {filteredRegister.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground"><AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" /><p>{t("No issues found")}</p></div>
              ) : (
                <DataGrid columns={registerColumns} data={filteredRegister} hideSearch />
              )}
            </>
          )}
        </TabsContent>

        {/* ==================== TAB 2: ISSUE REMEDIATION ==================== */}
        <TabsContent value="remediation" className="space-y-4 mt-4">
          <h2 className="text-xl font-bold">{t("Issue Remediation")}</h2>
          <div className="flex gap-0 rounded-lg overflow-hidden border">
            {remSubTabs.map((st) => (
              <button key={st.value} onClick={() => setRemSubTab(st.value)}
                className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${remSubTab === st.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {st.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t("Search")} value={remSearch} onChange={(e) => setRemSearch(e.target.value)} />
            </div>
            <div className="w-[160px]">
              <Select value={remSeverityFilter} onValueChange={setRemSeverityFilter}>
                <SelectTrigger><SelectValue placeholder={t("Severity")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All")}</SelectItem>
                  {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input type="date" value={remDateFilter} onChange={(e) => setRemDateFilter(e.target.value)} className="w-[180px]" placeholder={t("Response Date")} />
          </div>
          {filteredRemediation.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" /><p>{t("No issues found")}</p></div>
          ) : (
            <DataGrid columns={remediationColumns} data={filteredRemediation} hideSearch />
          )}
        </TabsContent>

        {/* ==================== TAB 3: VENDOR ISSUES ==================== */}
        <TabsContent value="vendor-issues" className="space-y-4 mt-4">
          <h2 className="text-xl font-bold">{t("Vendor Issues")}</h2>
          <div className="flex gap-0 rounded-lg overflow-hidden border">
            {["Open", "Awaiting Response", "Closed"].map((tab) => (
              <button key={tab} onClick={() => setViSubTab(tab)}
                className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${viSubTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                {t(tab)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-[160px]">
              <Select value={viSeverityFilter} onValueChange={setViSeverityFilter}>
                <SelectTrigger><SelectValue placeholder={t("Severity")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All")}</SelectItem>
                  {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {filteredVendorIssues.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" /><p>{t("No issues found")}</p></div>
          ) : (
            <DataGrid columns={vendorIssueColumns} data={filteredVendorIssues} hideSearch />
          )}
        </TabsContent>

      </Tabs>

      {/* ==================== VENDOR ISSUE DETAIL DIALOG ==================== */}
      <Dialog open={!!viewVendorIssue} onOpenChange={(open) => { if (!open) setViewVendorIssue(null); }}>
        <DialogContent className="!max-w-2xl w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Vendor Issue Details")}</DialogTitle>
          </DialogHeader>
          {viewVendorIssue && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">{t("Title")}</Label>
                  <p className="text-sm mt-1">{viewVendorIssue.title}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">{t("Vendor")}</Label>
                  <p className="text-sm mt-1">{viewVendorIssue.vendorName}</p>
                </div>
              </div>
              {viewVendorIssue.description && (
                <div>
                  <Label className="text-xs font-semibold">{t("Description")}</Label>
                  <p className="text-sm mt-1 text-muted-foreground">{viewVendorIssue.description}</p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold">{t("Severity")}</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={`${SEVERITY_COLORS[viewVendorIssue.severity] || ""} text-xs font-medium`}>{t(viewVendorIssue.severity)}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">{t("Status")}</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={`${STATUS_COLORS[viewVendorIssue.status] || ""} text-xs font-medium`}>{t(viewVendorIssue.status)}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">{t("Due Date")}</Label>
                  <p className="text-sm mt-1">{formatDate(viewVendorIssue.dueDate)}</p>
                </div>
              </div>
              {viewVendorIssue.resolution && (
                <div>
                  <Label className="text-xs font-semibold">{t("Response")}</Label>
                  <p className="text-sm mt-1 text-muted-foreground whitespace-pre-wrap">{viewVendorIssue.resolution}</p>
                </div>
              )}
              {viewVendorIssue.reportedBy && (
                <div>
                  <Label className="text-xs font-semibold">{t("Reported By")}</Label>
                  <p className="text-sm mt-1">{viewVendorIssue.reportedBy}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="!flex-col !items-stretch sm:!flex-col gap-2">
            <Button variant="outline" onClick={() => setViewVendorIssue(null)}>{t("Close")}</Button>
            {viewVendorIssue && !["Closed", "Resolved"].includes(viewVendorIssue.status) && (
              <Button
                onClick={() => handleCloseVendorIssue(viewVendorIssue.id)}
                disabled={closingVendorIssueId === viewVendorIssue.id}
              >
                {closingVendorIssueId === viewVendorIssue.id ? (
                  <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                )}
                {t("Close Issue")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== REMEDIATION DETAIL DIALOG (assessor style) ==================== */}
      <Dialog open={!!viewRemediation} onOpenChange={(open) => { if (!open) setViewRemediation(null); }}>
        <DialogContent className="!max-w-5xl w-[96vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Remediation")}</DialogTitle>
          </DialogHeader>
          {viewRemediation && (
            <div className="space-y-5">
              {/* Question */}
              <div>
                <h5 className="font-semibold text-sm">{t("Question")} {viewRemediation.questionNo} —</h5>
                <p className="text-sm text-muted-foreground mt-1">{viewRemediation.questionText || "-"}</p>
              </div>

              {/* Selected Response */}
              {viewRemediation.questionResponse && (
                <div>
                  <Badge variant="outline" className={`text-sm ${
                    viewRemediation.questionResponse === "Yes" ? "bg-green-50 text-green-700 border-green-300" :
                    viewRemediation.questionResponse === "No" ? "bg-red-50 text-red-700 border-red-300" :
                    "bg-gray-50 text-gray-700 border-gray-300"
                  }`}>{t(viewRemediation.questionResponse)}</Badge>
                </div>
              )}

              {/* Assessor reassign comment */}
              {viewRemediation.reassignComment && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      {t("Assigned")}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("Assessor comment")}</span>
                  </div>
                  <p className="text-sm text-orange-900">{viewRemediation.reassignComment}</p>
                </div>
              )}

              {/* VerifAI Summary */}
              <h5 className="font-semibold text-sm border-b pb-1">{t("VerifAI Summary")}</h5>
              {!viewRemediation.risk && !viewRemediation.recommendation ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {viewRemediation.issue && (
                    <div>
                      <Label className="text-xs font-semibold">{t("Issue")}</Label>
                      <Textarea value={viewRemediation.issue} readOnly rows={4} className="mt-1 bg-muted/50 text-sm" />
                    </div>
                  )}
                  <div>
                    <RemediationComments remediationId={viewRemediation.id} readOnly={false} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">{t("Issue")}</Label>
                      <Textarea value={viewRemediation.issue || ""} readOnly rows={4} className="mt-1 bg-muted/50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">{t("Risk")}</Label>
                      <Textarea value={viewRemediation.risk || ""} readOnly rows={4} className="mt-1 bg-muted/50 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold">{t("Recommendation")}</Label>
                      <Textarea value={viewRemediation.recommendation || ""} readOnly rows={4} className="mt-1 bg-muted/50 text-sm" />
                    </div>
                    <div>
                      <RemediationComments remediationId={viewRemediation.id} readOnly={false} />
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">{t("Severity")}</Label>
                  <div className="mt-1">
                    {viewRemediation.severity ? <Badge variant={getSeverityVariant(viewRemediation.severity)}>{t(viewRemediation.severity)}</Badge> : "-"}
                  </div>
                </div>
                {viewRemediation.artifactName && (
                  <div>
                    <Label className="text-xs font-semibold">{t("Supporting Artifacts")}</Label>
                    <div className="mt-2 space-y-1">
                      {viewRemediation.artifactName.split(", ").map((name, idx) => {
                        const urls = viewRemediation.artifactUrl?.split(", ") || [];
                        const rawUrl = urls[idx];
                        const url = rawUrl ? (rawUrl.startsWith("/uploads/") ? `/api${rawUrl}` : rawUrl) : null;
                        return (
                          <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 text-sm">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate flex-1">{name}</span>
                            {url && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t("View")} onClick={() => window.open(url, "_blank")}>
                                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                </Button>
                                <a href={url} download={name} title={t("Download")} className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent">
                                  <Download className="h-3.5 w-3.5 text-primary" />
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {viewRemediation && viewRemediation.status === "Assigned to BO" && (
              <>
                <Button onClick={() => openCommentDialog(viewRemediation.id, "Closed")} disabled={actionLoading} className="bg-green-100 text-green-800 hover:bg-green-200 border border-green-200">
                  <ShieldCheck className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Accept Risk")}
                </Button>
                <Button onClick={() => openCommentDialog(viewRemediation.id, "Sent to Vendor")} disabled={actionLoading} className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200">
                  <Forward className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Send To Vendor")}
                </Button>
                <Button onClick={() => openCommentDialog(viewRemediation.id, "Submitted")} disabled={actionLoading} className="bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200">
                  <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Send To Assessor")}
                </Button>
                <Button onClick={() => { setTerminateConfirm({ remediationId: viewRemediation.id, vendorId: viewRemediation.vendorId || "" }); setViewRemediation(null); }} disabled={actionLoading} className="bg-red-100 text-red-800 hover:bg-red-200 border border-red-200">
                  <Ban className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Terminate Vendor")}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setViewRemediation(null)}>{t("Cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== COMMENT DIALOG (before action) ==================== */}
      <Dialog open={!!commentAction} onOpenChange={(open) => { if (!open) { setCommentAction(null); setCommentText(""); } }}>
        <DialogContent className="!max-w-lg w-[90vw]">
          <DialogHeader>
            <DialogTitle>{t("Comment")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={5}
            placeholder={t("Enter your comment...")}
            className="w-full"
          />
          <DialogFooter className="gap-2">
            <Button onClick={handleCommentSave} disabled={actionLoading} className="bg-primary/90 hover:bg-primary text-primary-foreground">
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Save")}
            </Button>
            <Button variant="outline" onClick={() => { setCommentAction(null); setCommentText(""); }}>{t("Cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== ISSUE REGISTER DETAILS DIALOG ==================== */}
      <Dialog open={!!viewIssueDetail} onOpenChange={(open) => { if (!open) setViewIssueDetail(null); }}>
        <DialogContent className="!max-w-3xl w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Issue Register Details")}</DialogTitle>
          </DialogHeader>
          {viewIssueDetail && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h5 className="font-semibold text-sm">{t("Issue")} : {viewIssueDetail.issueCode}</h5>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-semibold">{t("Due Date")}: {formatDate(viewIssueDetail.dueDate)}</span>
                  <Badge variant="outline" className={`${STATUS_COLORS[viewIssueDetail.status] || ""} text-xs font-medium`}>
                    {t(viewIssueDetail.status)}
                  </Badge>
                </div>
              </div>
              <div>
                <Textarea value={viewIssueDetail.issue || ""} readOnly rows={5} className="bg-muted/50 text-sm" />
              </div>
              <div>
                <h5 className="font-semibold text-sm mb-2">{t("Risk")}</h5>
                <Textarea value={viewIssueDetail.risk || ""} readOnly rows={4} className="bg-muted/50 text-sm" />
              </div>
              <div>
                <h5 className="font-semibold text-sm mb-2">{t("Recommendation")}</h5>
                <Textarea value={viewIssueDetail.recommendation || ""} readOnly rows={4} className="bg-muted/50 text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-semibold text-sm mb-2">{t("Severity")}</h5>
                  <Badge variant={getSeverityVariant(viewIssueDetail.severity)} className="text-sm">
                    {t(viewIssueDetail.severity)}
                  </Badge>
                </div>
                {viewIssueDetail.remediationId && (
                  <RemediationComments remediationId={viewIssueDetail.remediationId} readOnly />
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewIssueDetail(null)}>{t("Cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== COMMENTS ONLY DIALOG ==================== */}
      <Dialog open={!!commentsOnlyId} onOpenChange={(open) => { if (!open) setCommentsOnlyId(null); }}>
        <DialogContent className="!max-w-lg w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Comments")}</DialogTitle>
          </DialogHeader>
          {commentsOnlyId && <RemediationComments remediationId={commentsOnlyId} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentsOnlyId(null)}>{t("Close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== TERMINATE VENDOR CONFIRMATION DIALOG ==================== */}
      <Dialog open={!!terminateConfirm} onOpenChange={(open) => { if (!open) setTerminateConfirm(null); }}>
        <DialogContent className="!max-w-md w-[90vw]">
          <DialogHeader>
            <DialogTitle>{t("Edit Remediation")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("Are you sure you want to initiate offboard?")}</p>
          <DialogFooter className="gap-2">
            <Button onClick={handleTerminateInitiate} disabled={actionLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Initiate")}
            </Button>
            <Button variant="outline" onClick={() => setTerminateConfirm(null)}>{t("Cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

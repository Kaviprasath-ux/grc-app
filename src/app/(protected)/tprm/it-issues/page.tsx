"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Download, Search, X, AlertTriangle, Home, ChevronRight, Send, Loader2,
  Eye, FileText, ExternalLink, Upload, Trash2,
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
import { useLanguage } from "@/contexts/LanguageContext";
import { RemediationComments } from "@/components/tprm/remediation-comments";

// ==================== TYPES ====================

interface IssueRegisterEntry {
  id: string;
  department: string | null;
  vendorName: string;
  vendorCode: string | null;
  serviceCategory: string | null;
  high: number;
  medium: number;
  low: number;
  total: number;
  status: string;
}

interface IssueRemediationEntry {
  id: string;
  issueCode: string | null;
  vendorName: string;
  vendorCode: string;
  domain: string | null;
  severity: string;
  description: string | null;
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
  itArtifactUrl: string | null;
  itArtifactName: string | null;
  assignedTo: string | null;
  assignedAt: string | null;
  requestedDate: string | null;
  responseDate: string | null;
  dueDate: string | null;
  status: string;
  createdAt: string;
}

// ==================== HELPERS ====================

const STATUS_COLORS: Record<string, string> = {
  Open: "border-blue-300 bg-blue-50 text-blue-700",
  Closed: "border-slate-300 bg-slate-50 text-slate-700",
  "Assigned to IT": "border-indigo-300 bg-indigo-50 text-indigo-700",
  "IT Submitted": "border-orange-300 bg-orange-50 text-orange-700",
  "IT Approved": "border-green-300 bg-green-50 text-green-700",
  "Returned to IT": "border-red-300 bg-red-50 text-red-700",
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

export default function ITIssuesPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("register");

  // Data
  const [registerEntries, setRegisterEntries] = useState<IssueRegisterEntry[]>([]);
  const [remediationEntries, setRemediationEntries] = useState<IssueRemediationEntry[]>([]);

  // Issue Register filters
  const [regVendorSearch, setRegVendorSearch] = useState("");
  const [regStatusFilter, setRegStatusFilter] = useState("all");

  // Issue Remediation filters
  const [remSearch, setRemSearch] = useState("");
  const [remSeverityFilter, setRemSeverityFilter] = useState("all");
  const [remSubTab, setRemSubTab] = useState("Open");
  const [remDateFilter, setRemDateFilter] = useState("");

  // Remediation detail modal
  const [viewRemediation, setViewRemediation] = useState<IssueRemediationEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Submit form state
  const [submitComment, setSubmitComment] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [regRes, remRes] = await Promise.all([
        fetch("/api/tprm/it-issues?tab=register"),
        fetch("/api/tprm/it-issues?tab=remediation"),
      ]);

      if (regRes.ok) {
        const regData = await regRes.json();
        setRegisterEntries(regData.data || []);
      }
      if (remRes.ok) {
        const remData = await remRes.json();
        setRemediationEntries(remData.data || []);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load data"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitResponse = useCallback(async () => {
    if (!viewRemediation) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append("id", viewRemediation.id);
      formData.append("action", "submit");
      if (submitComment.trim()) {
        formData.append("comment", submitComment.trim());
      }
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const res = await fetch("/api/tprm/it-issues", {
        method: "PATCH",
        body: formData,
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Response submitted successfully") });
        setViewRemediation(null);
        setSubmitComment("");
        setSelectedFiles([]);
        loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: t("Error"), description: data.error || t("Failed to submit response"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to submit response"), variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }, [toast, t, loadData, viewRemediation, submitComment, selectedFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteITArtifact = useCallback(async (artifactIndex: number) => {
    if (!viewRemediation) return;
    try {
      const res = await fetch(`/api/tprm/it-issues?id=${viewRemediation.id}&artifactIndex=${artifactIndex}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Attachment deleted") });
        const names = viewRemediation.itArtifactName?.split(", ") || [];
        const urls = viewRemediation.itArtifactUrl?.split(", ") || [];
        names.splice(artifactIndex, 1);
        urls.splice(artifactIndex, 1);
        setViewRemediation({
          ...viewRemediation,
          itArtifactName: names.length > 0 ? names.join(", ") : null,
          itArtifactUrl: urls.length > 0 ? urls.join(", ") : null,
        });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: t("Error"), description: data.error || t("Failed to delete attachment"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete attachment"), variant: "destructive" });
    }
  }, [viewRemediation, toast, t]);

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
    {
      accessorKey: "department",
      header: t("Department"),
      cell: ({ row }) => <span className="text-sm">{row.original.department || "-"}</span>,
    },
    {
      accessorKey: "vendorName",
      header: t("Vendor Name"),
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.vendorName}</span>,
    },
    {
      accessorKey: "vendorCode",
      header: t("Vendor ID"),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.vendorCode || "-"}</span>,
    },
    {
      accessorKey: "high",
      header: t("High"),
      cell: ({ row }) => (
        <span className={`text-sm font-medium ${row.original.high > 0 ? "text-red-600" : "text-muted-foreground"}`}>
          {row.original.high}
        </span>
      ),
    },
    {
      accessorKey: "medium",
      header: t("Medium"),
      cell: ({ row }) => (
        <span className={`text-sm font-medium ${row.original.medium > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
          {row.original.medium}
        </span>
      ),
    },
    {
      accessorKey: "low",
      header: t("Low"),
      cell: ({ row }) => (
        <span className={`text-sm font-medium ${row.original.low > 0 ? "text-green-600" : "text-muted-foreground"}`}>
          {row.original.low}
        </span>
      ),
    },
    {
      accessorKey: "total",
      header: t("Total"),
      cell: ({ row }) => <span className="text-sm font-bold">{row.original.total}</span>,
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant="outline" className={`${STATUS_COLORS[row.original.status] || ""} text-xs font-medium`}>
          {t(row.original.status)}
        </Badge>
      ),
    },
  ];

  const handleExport = () => {
    const headers = ["Department", "Vendor Name", "Vendor ID", "High", "Medium", "Low", "Total", "Status"];
    const rows = filteredRegister.map((e) => [
      e.department || "", e.vendorName, e.vendorCode || "", e.high, e.medium, e.low, e.total, e.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "it-issue-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==================== ISSUE REMEDIATION ====================

  const filteredRemediation = useMemo(() => {
    const filtered = remediationEntries.filter((e) => {
      const matchesSearch = remSearch === "" ||
        e.vendorName.toLowerCase().includes(remSearch.toLowerCase()) ||
        e.vendorCode.toLowerCase().includes(remSearch.toLowerCase()) ||
        (e.issueCode && e.issueCode.toLowerCase().includes(remSearch.toLowerCase()));
      const matchesSeverity = remSeverityFilter === "all" || e.severity === remSeverityFilter;
      const matchesSubTab =
        remSubTab === "Open"
          ? e.status === "Assigned to IT"
          : remSubTab === "Returned"
          ? e.status === "Returned to IT"
          : remSubTab === "Approved"
          ? ["IT Submitted", "IT Approved"].includes(e.status)
          : true;
      const matchesDate = !remDateFilter ||
        (e.responseDate && e.responseDate.startsWith(remDateFilter));
      return matchesSearch && matchesSeverity && matchesSubTab && matchesDate;
    });
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered;
  }, [remediationEntries, remSearch, remSeverityFilter, remSubTab, remDateFilter]);

  const remediationColumns: ColumnDef<IssueRemediationEntry>[] = [
    {
      accessorKey: "issueCode",
      header: t("Issue ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.issueCode || "-"}</span>,
    },
    {
      accessorKey: "vendorName",
      header: t("Vendor Name"),
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.vendorName}</span>,
    },
    {
      accessorKey: "domain",
      header: t("Domain"),
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.domain || "-"}</span>,
    },
    {
      accessorKey: "severity",
      header: t("Severity"),
      cell: ({ row }) => {
        const sev = row.original.severity;
        return sev ? <Badge variant={getSeverityVariant(sev)}>{t(sev)}</Badge> : "-";
      },
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant="outline" className={`${STATUS_COLORS[row.original.status] || ""} text-xs`}>
          {row.original.status === "Returned to IT" ? t("Returned") : row.original.status === "IT Approved" ? t("Approved") : row.original.status === "IT Submitted" ? t("Submitted") : t(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "responseDate",
      header: t("Response Date"),
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.responseDate || row.original.requestedDate)}</span>,
    },
    {
      accessorKey: "dueDate",
      header: t("Due Date"),
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.dueDate)}</span>,
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => { setViewRemediation(row.original); setSubmitComment(""); setSelectedFiles([]); }}>
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  const remSubTabs = [
    { value: "Open", label: t("Open Issues") },
    { value: "Returned", label: t("Returned Issues") },
    { value: "Approved", label: t("Approved Issues") },
  ];

  // Can IT submit on this item?
  const canSubmit = viewRemediation && (viewRemediation.status === "Assigned to IT" || viewRemediation.status === "Returned to IT");

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
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Issue Management")}</span>
      </nav>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setRemSearch(""); }}>
        <TabsList>
          <TabsTrigger value="register">{t("Issue Register")}</TabsTrigger>
          <TabsTrigger value="remediation">{t("Issue Remediation")}</TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: ISSUE REGISTER ==================== */}
        <TabsContent value="register" className="space-y-4 mt-4">
          <h2 className="text-xl font-bold">{t("Issue Register")}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search")}
                value={regVendorSearch}
                onChange={(e) => setRegVendorSearch(e.target.value)}
                className="pl-9"
              />
              {regVendorSearch && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setRegVendorSearch("")}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <Select value={regStatusFilter} onValueChange={setRegStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Statuses")}</SelectItem>
                {["Open", "Closed"].map((s) => (
                  <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ltr:ml-auto rtl:mr-auto">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Export")}
              </Button>
            </div>
          </div>

          {filteredRegister.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{t("No issues found")}</p>
            </div>
          ) : (
            <DataGrid columns={registerColumns} data={filteredRegister} hideSearch />
          )}
        </TabsContent>

        {/* ==================== TAB 2: ISSUE REMEDIATION ==================== */}
        <TabsContent value="remediation" className="space-y-4 mt-4">
          <h2 className="text-xl font-bold">{t("Issue Remediation")}</h2>

          {/* Sub-tabs */}
          <div className="flex gap-0 rounded-lg overflow-hidden border">
            {remSubTabs.map((st) => (
              <button
                key={st.value}
                onClick={() => setRemSubTab(st.value)}
                className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${
                  remSubTab === st.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t("Search")}
                value={remSearch}
                onChange={(e) => setRemSearch(e.target.value)}
              />
            </div>
            <div className="w-[160px]">
              <Select value={remSeverityFilter} onValueChange={setRemSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("Severity")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All")}</SelectItem>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="date"
              value={remDateFilter}
              onChange={(e) => setRemDateFilter(e.target.value)}
              className="w-[180px]"
              placeholder={t("Response Date")}
            />
          </div>

          {filteredRemediation.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{t("No issues found")}</p>
            </div>
          ) : (
            <DataGrid columns={remediationColumns} data={filteredRemediation} hideSearch />
          )}
        </TabsContent>
      </Tabs>

      {/* ==================== REMEDIATION DETAIL DIALOG ==================== */}
      <Dialog open={!!viewRemediation} onOpenChange={(open) => { if (!open) { setViewRemediation(null); setSubmitComment(""); setSelectedFiles([]); } }}>
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
                  }`}>{viewRemediation.questionResponse}</Badge>
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

              {/* Returned comment (when assessor sends back) */}
              {viewRemediation.status === "Returned to IT" && viewRemediation.assessorComment && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      {t("Returned")}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("Assessor sent this back")}</span>
                  </div>
                  <p className="text-sm text-red-900">{viewRemediation.assessorComment}</p>
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
                    <RemediationComments remediationId={viewRemediation.id} readOnly={!canSubmit} />
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
                      <RemediationComments remediationId={viewRemediation.id} readOnly={!canSubmit} />
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">{t("Severity")}</Label>
                  <div className="mt-1">
                    {viewRemediation.severity ? (
                      <Badge variant={getSeverityVariant(viewRemediation.severity)}>{t(viewRemediation.severity)}</Badge>
                    ) : "-"}
                  </div>
                </div>
                {/* AM Artifacts (read-only) */}
                {viewRemediation.artifactName && (
                  <div>
                    <Label className="text-xs font-semibold">{t("AM Artifacts")}</Label>
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
              {/* IT Artifacts (with delete when submittable) */}
              {viewRemediation.itArtifactName && (
                <div>
                  <Label className="text-xs font-semibold">{t("IT Attachments")}</Label>
                  <div className="mt-2 space-y-1">
                    {viewRemediation.itArtifactName.split(", ").map((name, idx) => {
                      const urls = viewRemediation.itArtifactUrl?.split(", ") || [];
                      const rawUrl = urls[idx];
                      const url = rawUrl ? (rawUrl.startsWith("/uploads/") ? `/api${rawUrl}` : rawUrl) : null;
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate flex-1">{name}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {url && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t("View")} onClick={() => window.open(url, "_blank")}>
                                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                </Button>
                                <a href={url} download={name} title={t("Download")} className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent">
                                  <Download className="h-3.5 w-3.5 text-primary" />
                                </a>
                              </>
                            )}
                            {canSubmit && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t("Delete")} onClick={() => handleDeleteITArtifact(idx)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* IT Submit section: comment + file upload */}
              {canSubmit && (
                <div className="space-y-4 border-t pt-4">
                  <h5 className="font-semibold text-sm">{t("IT Response")}</h5>
                  <div>
                    <Label className="text-xs font-semibold">{t("Comment")}</Label>
                    <Textarea
                      value={submitComment}
                      onChange={(e) => setSubmitComment(e.target.value)}
                      rows={3}
                      placeholder={t("Add your response or comment...")}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">{t("Attachments")}</Label>
                    <div className="mt-2 space-y-2">
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 text-sm">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate flex-1">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {(file.size / 1024).toFixed(0)} KB
                          </span>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeSelectedFile(idx)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                        {t("Add File")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {canSubmit && (
              <Button onClick={handleSubmitResponse} disabled={actionLoading} className="bg-green-600 hover:bg-green-700">
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                <Send className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Submit Response")}
              </Button>
            )}
            <Button variant="outline" onClick={() => { setViewRemediation(null); setSubmitComment(""); setSelectedFiles([]); }}>{t("Cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

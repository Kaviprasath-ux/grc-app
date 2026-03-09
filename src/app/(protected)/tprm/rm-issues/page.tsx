"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download, Search, X, AlertTriangle, Home, ChevronRight, Send, Loader2,
  Eye, MessageSquare, Plus, FileSpreadsheet, FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

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
  assignedTo: string | null;
  assignedAt: string | null;
  requestedDate: string | null;
  responseDate: string | null;
  dueDate: string | null;
  status: string;
  createdAt: string;
  comments: RemediationComment[];
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
  Pending: "border-yellow-300 bg-yellow-50 text-yellow-700",
  "Assigned to BO": "border-blue-300 bg-blue-50 text-blue-700",
  "Assigned to IT": "border-indigo-300 bg-indigo-50 text-indigo-700",
  Submitted: "border-orange-300 bg-orange-50 text-orange-700",
};

const SEVERITIES = ["High", "Medium", "Low"];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ==================== MAIN COMPONENT ====================

export default function RMIssuesPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);

  // Read initial tab/subtab from URL query params
  const initialTab = searchParams.get("tab") || "register";
  const initialViSubTab = searchParams.get("subtab") || "Open";

  const [activeTab, setActiveTab] = useState(initialTab);

  // Data from API
  const [registerEntries, setRegisterEntries] = useState<IssueRegisterEntry[]>([]);
  const [remediationEntries, setRemediationEntries] = useState<IssueRemediationEntry[]>([]);
  const [vendorIssueEntries, setVendorIssueEntries] = useState<VendorIssueEntry[]>([]);

  // Issue Register filters
  const [regVendorSearch, setRegVendorSearch] = useState("");
  const [regStatusFilter, setRegStatusFilter] = useState("all");

  // Issue Remediation filters
  const [remSearch, setRemSearch] = useState("");
  const [remSeverityFilter, setRemSeverityFilter] = useState("all");
  const [remSubTab, setRemSubTab] = useState("Open");
  const [remResponseDateFilter, setRemResponseDateFilter] = useState("");

  // Remediation assign to BO/IT
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Remediation detail modal
  const [selectedRemediation, setSelectedRemediation] = useState<IssueRemediationEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Vendor Issues filters
  const [viSeverityFilter, setViSeverityFilter] = useState("all");
  const [viSubTab, setViSubTab] = useState(initialViSubTab);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [regRes, remRes, viRes] = await Promise.all([
        fetch("/api/tprm/rm-issues?tab=register"),
        fetch("/api/tprm/rm-issues?tab=remediation"),
        fetch("/api/tprm/rm-issues?tab=vendor-issues"),
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

  const handleAssign = useCallback(async (remediationId: string, assignTo: string) => {
    setAssigningId(remediationId);
    try {
      const res = await fetch("/api/tprm/rm-issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: remediationId, status: assignTo }),
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t(`Issue assigned successfully`) });
        loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: t("Error"), description: data.error || t("Failed to assign issue"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to assign issue"), variant: "destructive" });
    } finally {
      setAssigningId(null);
    }
  }, [toast, t, loadData]);

  const handleAddComment = useCallback(async () => {
    if (!selectedRemediation || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch("/api/tprm/rm-issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedRemediation.id,
          addComment: newComment.trim(),
        }),
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Comment added") });
        setNewComment("");
        // Reload data and refresh dialog
        const remRes = await fetch("/api/tprm/rm-issues?tab=remediation");
        if (remRes.ok) {
          const remData = await remRes.json();
          const entries = remData.data || [];
          setRemediationEntries(entries);
          const updated = entries.find((e: IssueRemediationEntry) => e.id === selectedRemediation.id);
          if (updated) setSelectedRemediation(updated);
        }
      } else {
        toast({ title: t("Error"), description: t("Failed to add comment"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to add comment"), variant: "destructive" });
    } finally {
      setSubmittingComment(false);
    }
  }, [selectedRemediation, newComment, toast, t]);

  const openRemediationDetail = (entry: IssueRemediationEntry) => {
    setSelectedRemediation(entry);
    setDetailOpen(true);
    setShowComments(false);
    setNewComment("");
  };

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
    a.download = "issue-register.csv";
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
          ? ["Open", "Pending", "In-Progress", "In Progress", "Awaiting Response", "Submitted", "Assigned to BO", "Assigned to IT"].includes(e.status)
          : remSubTab === "Assigned to IT"
          ? e.status === "Assigned to IT"
          : remSubTab === "Assigned to BO"
          ? e.status === "Assigned to BO"
          : true;
      const matchesResponseDate = !remResponseDateFilter ||
        (e.responseDate && e.responseDate.startsWith(remResponseDateFilter));
      return matchesSearch && matchesSeverity && matchesSubTab && matchesResponseDate;
    });
    // Sort descending by createdAt (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered;
  }, [remediationEntries, remSearch, remSeverityFilter, remSubTab, remResponseDateFilter]);

  const remediationColumns: ColumnDef<IssueRemediationEntry>[] = [
    {
      accessorKey: "issueCode",
      header: t("ID"),
      cell: ({ row }) => (
        <span className="text-sm font-medium text-muted-foreground">
          {row.original.issueCode || row.original.id.slice(0, 6).toUpperCase()}
        </span>
      ),
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
      cell: ({ row }) => (
        <Badge variant="outline" className={`${SEVERITY_COLORS[row.original.severity] || ""} text-xs font-medium`}>
          {t(row.original.severity)}
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
      id: "commentsCol",
      header: t("Comments"),
      cell: ({ row }) => {
        const count = row.original.comments?.length || 0;
        return (
          <button
            className="flex items-center gap-1 text-muted-foreground hover:text-primary"
            onClick={() => openRemediationDetail(row.original)}
          >
            <MessageSquare className="h-4 w-4" />
            {count > 0 && <span className="text-xs">{count}</span>}
          </button>
        );
      },
    },
    {
      id: "action",
      header: t("Action"),
      cell: ({ row }) => (
        <Button
          variant="default"
          size="icon"
          className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90"
          onClick={() => openRemediationDetail(row.original)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // ==================== VENDOR ISSUES ====================

  const filteredVendorIssues = useMemo(() => {
    return vendorIssueEntries.filter((e) => {
      const matchesSeverity = viSeverityFilter === "all" || e.severity === viSeverityFilter;
      const matchesSubTab =
        viSubTab === "Open"
          ? ["Open", "Pending", "In-Progress", "In Progress"].includes(e.status)
          : viSubTab === "Closed"
          ? ["Closed", "Resolved"].includes(e.status)
          : e.status === viSubTab;
      return matchesSeverity && matchesSubTab;
    });
  }, [vendorIssueEntries, viSeverityFilter, viSubTab]);

  const vendorIssueColumns: ColumnDef<VendorIssueEntry>[] = [
    {
      accessorKey: "title",
      header: t("Title"),
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.title}</span>,
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
    {
      accessorKey: "severity",
      header: t("Severity"),
      cell: ({ row }) => (
        <Badge variant="outline" className={`${SEVERITY_COLORS[row.original.severity] || ""} text-xs font-medium`}>
          {t(row.original.severity)}
        </Badge>
      ),
    },
    {
      accessorKey: "dueDate",
      header: t("Due Date"),
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.dueDate)}</span>,
    },
    {
      accessorKey: "reportedBy",
      header: t("Action"),
      cell: ({ row }) => <span className="text-sm">{row.original.reportedBy || "-"}</span>,
    },
  ];

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Issue Management")}</span>
      </nav>
      <h1 className="text-2xl font-bold">{t("Issue Management")}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="register">{t("Issue Register")}</TabsTrigger>
          <TabsTrigger value="remediation">{t("Issue Remediation")}</TabsTrigger>
          <TabsTrigger value="vendor-issues">{t("Vendor Issues")}</TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: ISSUE REGISTER ==================== */}
        <TabsContent value="register" className="space-y-4 mt-4">
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
          {/* Sub-tabs matching reference: Open Issues, Assigned to IT, Assigned to BO */}
          <div className="flex gap-0">
            {["Open", "Assigned to IT", "Assigned to BO"].map((tab) => (
              <button
                key={tab}
                onClick={() => setRemSubTab(tab)}
                className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors rounded-lg ${
                  remSubTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t(tab === "Open" ? "Open Issues" : tab)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Search")}
                value={remSearch}
                onChange={(e) => setRemSearch(e.target.value)}
                className="pl-9"
              />
              {remSearch && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setRemSearch("")}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <Input
              type="date"
              placeholder={t("Response Date")}
              value={remResponseDateFilter}
              onChange={(e) => setRemResponseDateFilter(e.target.value)}
              className="w-[180px]"
            />
            <Select value={remSeverityFilter} onValueChange={setRemSeverityFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("Severity")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Severities")}</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        {/* ==================== TAB 3: VENDOR ISSUES ==================== */}
        <TabsContent value="vendor-issues" className="space-y-4 mt-4">
          {/* Sub-tabs */}
          <div className="flex gap-0">
            {["Open", "Awaiting Response", "Closed"].map((tab) => (
              <button
                key={tab}
                onClick={() => setViSubTab(tab)}
                className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors rounded-lg ${
                  viSubTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t(tab)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={viSeverityFilter} onValueChange={setViSeverityFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("Severity")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Severities")}</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredVendorIssues.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{t("No issues found")}</p>
            </div>
          ) : (
            <DataGrid columns={vendorIssueColumns} data={filteredVendorIssues} hideSearch />
          )}
        </TabsContent>
      </Tabs>

      {/* ==================== REMEDIATION DETAIL DIALOG ==================== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold bg-primary/5 -mx-6 -mt-6 px-6 py-4 border-b">
              {t("Remediation")}
            </DialogTitle>
          </DialogHeader>

          {selectedRemediation && (
            <div className="space-y-5 pt-2">
              {/* Question & Answer */}
              {selectedRemediation.questionNo && (
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("Question")} {selectedRemediation.questionNo} {selectedRemediation.questionText ? `- ${selectedRemediation.questionText}` : ""}
                  </p>
                  {selectedRemediation.questionResponse && (
                    <Badge
                      className={`mt-2 ${
                        selectedRemediation.questionResponse.toLowerCase() === "no"
                          ? "bg-slate-800 text-white hover:bg-slate-700"
                          : selectedRemediation.questionResponse.toLowerCase() === "yes"
                          ? "bg-green-600 text-white hover:bg-green-500"
                          : "bg-slate-500 text-white hover:bg-slate-400"
                      }`}
                    >
                      {selectedRemediation.questionResponse}
                    </Badge>
                  )}
                </div>
              )}

              {/* VerifAI Summary */}
              {(selectedRemediation.issue || selectedRemediation.risk || selectedRemediation.recommendation) && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">{t("VerifAI Summary")}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Issue */}
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">{t("Issue")}</label>
                      <div className="p-3 bg-muted/50 rounded-md border min-h-[80px] text-sm">
                        {selectedRemediation.issue || "-"}
                      </div>
                    </div>
                    {/* Risk */}
                    <div>
                      <label className="text-xs font-semibold text-foreground mb-1 block">{t("Risk")}</label>
                      <div className="p-3 bg-muted/50 rounded-md border min-h-[80px] text-sm">
                        {selectedRemediation.risk || "-"}
                      </div>
                    </div>
                  </div>
                  {/* Recommendation */}
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-foreground mb-1 block">{t("Recommendation")}</label>
                    <div className="p-3 bg-muted/50 rounded-md border min-h-[80px] text-sm">
                      {selectedRemediation.recommendation || "-"}
                    </div>
                  </div>
                </div>
              )}

              {/* Severity & Comments side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Severity */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">{t("Severity")}</label>
                  <Badge variant="outline" className={`${SEVERITY_COLORS[selectedRemediation.severity] || ""} text-xs font-medium`}>
                    {t(selectedRemediation.severity)}
                  </Badge>
                </div>

                {/* Comments section */}
                <div>
                  <button
                    className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                    onClick={() => setShowComments(!showComments)}
                  >
                    <span>{t("Comments")}</span>
                    <Plus className="h-4 w-4" />
                  </button>
                  {showComments && (
                    <div className="mt-2 space-y-2">
                      {selectedRemediation.comments.length > 0 ? (
                        <div className="max-h-40 overflow-y-auto space-y-2">
                          {selectedRemediation.comments.map((c) => (
                            <div key={c.id} className="p-2 bg-muted/50 rounded text-xs border">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium">{c.userName}</span>
                                <span className="text-muted-foreground">{formatDate(c.createdAt)}</span>
                              </div>
                              <p>{c.message}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t("No comments yet")}</p>
                      )}
                      <div className="flex gap-2">
                        <Textarea
                          placeholder={t("Add a comment...")}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="text-xs min-h-[60px]"
                        />
                        <Button
                          size="sm"
                          className="h-auto self-end"
                          onClick={handleAddComment}
                          disabled={submittingComment || !newComment.trim()}
                        >
                          {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Supporting Artifacts */}
              {selectedRemediation.artifactUrl && (
                <div>
                  <label className="text-xs font-semibold text-foreground mb-2 block">{t("Supporting Artifacts")}</label>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-md border">
                    <FileSpreadsheet className="h-8 w-8 text-green-700 flex-shrink-0" />
                    <span className="text-sm flex-1">{selectedRemediation.artifactName || t("Attachment")}</span>
                    <a
                      href={selectedRemediation.artifactUrl}
                      download
                      className="flex-shrink-0"
                    >
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                {remSubTab === "Open" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={assigningId === selectedRemediation.id}
                      onClick={() => {
                        handleAssign(selectedRemediation.id, "Assigned to IT");
                        setDetailOpen(false);
                      }}
                    >
                      <Send className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                      {t("Assign to IT")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={assigningId === selectedRemediation.id}
                      onClick={() => {
                        handleAssign(selectedRemediation.id, "Assigned to BO");
                        setDetailOpen(false);
                      }}
                    >
                      <Send className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                      {t("Assign to BO")}
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>
                  {t("Cancel")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

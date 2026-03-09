"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataGrid } from "@/components/shared/data-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, Home, ChevronRight, FileText, Download, ExternalLink } from "lucide-react";
import { RemediationComments } from "@/components/tprm/remediation-comments";
import { ColumnDef } from "@tanstack/react-table";

interface ClarificationItem {
  id: string;
  department: string | null;
  vendorId: string | null;
  vendorName: string | null;
  questionNo: string | null;
  date: string | null;
  domain: string | null;
  status: string;
}

interface RemediationItem {
  id: string;
  issueId: string | null;
  vendorName: string | null;
  engagementId: string | null;
  domain: string | null;
  severity: string | null;
  questionNo: string | null;
  questionText: string | null;
  questionResponse: string | null;
  issue: string | null;
  risk: string | null;
  recommendation: string | null;
  amComment: string | null;
  assessorComment: string | null;
  artifactUrl: string | null;
  artifactName: string | null;
  returnedAt: string | null;
  responseDate: string | null;
  dueDate: string | null;
  reassignStatus: string | null;
  status: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

function getSeverityVariant(severity: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "High":
      return "destructive";
    case "Medium":
      return "secondary";
    case "Low":
      return "default";
    default:
      return "outline";
  }
}

export default function AsrFollowUpsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "clarifications";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [clarSubTab, setClarSubTab] = useState("open");
  const [remSubTab, setRemSubTab] = useState("received");
  const [clarifications, setClarifications] = useState<ClarificationItem[]>([]);
  const [remediations, setRemediations] = useState<RemediationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [viewRemediation, setViewRemediation] = useState<RemediationItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showUnsatisfiedComment, setShowUnsatisfiedComment] = useState(false);
  const [unsatisfiedComment, setUnsatisfiedComment] = useState("");
  // Reassign flow (Send to Business / Reassign to IT): step 1 = comment, step 2 = select RM
  const [reassignStep, setReassignStep] = useState<0 | 1 | 2>(0);
  const [reassignAction, setReassignAction] = useState<"send-to-business" | "reassign-to-it">("send-to-business");
  const [reassignComment, setReassignComment] = useState("");
  const [rmUsers, setRmUsers] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [selectedRmId, setSelectedRmId] = useState("");
  const [rmLoading, setRmLoading] = useState(false);
  // Keep remediation ID when main dialog closes for send-to-business flow
  const [assigningRemediationId, setAssigningRemediationId] = useState<string | null>(null);

  const handleRemediationAction = async (action: string, label: string) => {
    if (!viewRemediation) return;
    if (action === "unsatisfied" && !showUnsatisfiedComment) {
      setShowUnsatisfiedComment(true);
      return;
    }
    if (action === "unsatisfied" && !unsatisfiedComment.trim()) {
      toast({ title: t("Required"), description: t("Please add a remediation comment"), variant: "destructive" });
      return;
    }
    // "Send to Business" and "Reassign to IT" trigger the multi-step dialog
    // Close main dialog first to avoid overlapping Radix dialogs
    if (action === "send-to-business" || action === "reassign-to-it") {
      setAssigningRemediationId(viewRemediation.id);
      setViewRemediation(null);
      setReassignAction(action as "send-to-business" | "reassign-to-it");
      setReassignStep(1);
      setReassignComment("");
      return;
    }
    setActionLoading(true);
    try {
      const body: Record<string, string> = { id: viewRemediation.id, action };
      if (action === "unsatisfied" && unsatisfiedComment.trim()) {
        body.comment = unsatisfiedComment;
      }
      const res = await fetch("/api/tprm/asr-follow-ups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("Success"), description: `${t("Remediation marked as")} ${label}` });
      setViewRemediation(null);
      setShowUnsatisfiedComment(false);
      setUnsatisfiedComment("");
      fetchData();
    } catch {
      toast({ title: t("Error"), description: t("Failed to update remediation"), variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  // Step 1 → Step 2: save comment, fetch RM users, show RM picker
  const handleReassignCommentSave = async () => {
    if (!reassignComment.trim()) {
      toast({ title: t("Required"), description: t("Please add a reassign comment"), variant: "destructive" });
      return;
    }
    setRmLoading(true);
    try {
      const roleQuery = reassignAction === "reassign-to-it" ? "?role=it" : "";
      const res = await fetch(`/api/tprm/asr-follow-ups/rm-users${roleQuery}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const json = await res.json();
      setRmUsers(json.data || []);
      setSelectedRmId("");
      setReassignStep(2);
    } catch {
      toast({ title: t("Error"), description: t("Failed to load RM users"), variant: "destructive" });
    } finally {
      setRmLoading(false);
    }
  };

  // Step 2: assign to selected RM
  const handleAssignToRM = async () => {
    if (!assigningRemediationId || !selectedRmId) {
      toast({ title: t("Required"), description: t("Please select an RM user"), variant: "destructive" });
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/tprm/asr-follow-ups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: assigningRemediationId,
          action: reassignAction,
          comment: reassignComment,
          assignedToUserId: selectedRmId,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const label = reassignAction === "send-to-business" ? t("Business") : t("IT");
      toast({ title: t("Success"), description: `${t("Issue assigned to RM for")} ${label}` });
      setReassignStep(0);
      setReassignComment("");
      setSelectedRmId("");
      setAssigningRemediationId(null);
      setViewRemediation(null);
      fetchData();
    } catch {
      toast({ title: t("Error"), description: t("Failed to assign to RM"), variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [cRes, rRes] = await Promise.all([
        fetch("/api/tprm/asr-follow-ups?type=clarifications&limit=200"),
        fetch("/api/tprm/asr-follow-ups?type=remediations&limit=200"),
      ]);
      if (cRes.ok) {
        const cJson = await cRes.json();
        setClarifications(cJson.data || []);
      }
      if (rRes.ok) {
        const rJson = await rRes.json();
        setRemediations(rJson.data || []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clarification sub-tab filtering
  const filteredClarifications = useMemo(() => {
    let data = clarifications;
    if (clarSubTab === "open") data = data.filter((c) => c.status === "Open");
    else if (clarSubTab === "vendor-response") data = data.filter((c) => c.status === "Responded");
    else if (clarSubTab === "closed") data = data.filter((c) => c.status === "Closed");

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (c) =>
          c.vendorName?.toLowerCase().includes(q) ||
          c.department?.toLowerCase().includes(q) ||
          c.domain?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [clarifications, clarSubTab, search]);

  // Remediation sub-tab filtering
  const filteredRemediations = useMemo(() => {
    let data = remediations;
    if (remSubTab === "received") data = data.filter((r) => r.status === "Received");
    else if (remSubTab === "business") data = data.filter((r) => r.status === "Assigned to BO");
    else if (remSubTab === "it") data = data.filter((r) => r.status === "Assigned to IT");
    else if (remSubTab === "awaiting") data = data.filter((r) => r.status === "Pending");
    else if (remSubTab === "vendor-issues") data = data.filter((r) => r.status === "Vendor Issue");
    else if (remSubTab === "closed") data = data.filter((r) => r.status === "Closed");
    else if (remSubTab === "overdue") data = data.filter((r) => r.status === "Overdue");
    else if (remSubTab === "logs") data = data;

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.vendorName?.toLowerCase().includes(q) ||
          r.domain?.toLowerCase().includes(q) ||
          r.issueId?.toLowerCase().includes(q)
      );
    }

    if (severityFilter !== "all") {
      data = data.filter((r) => r.severity === severityFilter);
    }

    return data;
  }, [remediations, remSubTab, search, severityFilter]);

  // Clarification columns
  const clarificationColumns: ColumnDef<ClarificationItem>[] = [
    { accessorKey: "department", header: t("Department"), cell: ({ row }) => row.getValue("department") || "-" },
    { accessorKey: "vendorId", header: t("Vendor ID"), cell: ({ row }) => row.getValue("vendorId") || "-" },
    { accessorKey: "vendorName", header: t("Vendor Name"), cell: ({ row }) => row.getValue("vendorName") || "-" },
    { accessorKey: "questionNo", header: t("Question No"), cell: ({ row }) => row.getValue("questionNo") || "-" },
    { accessorKey: "date", header: t("Date"), cell: ({ row }) => formatDate(row.getValue("date")) },
    { accessorKey: "domain", header: t("Domain"), cell: ({ row }) => row.getValue("domain") || "-" },
    {
      id: "actions",
      header: t("Action"),
      cell: () => (
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  // Remediation columns
  const remediationColumns: ColumnDef<RemediationItem>[] = [
    {
      accessorKey: "issueId",
      header: t("Issue ID"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{row.getValue("issueId") || "-"}</span>
          {row.original.returnedAt && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-300">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              {t("Returned")}
            </span>
          )}
        </div>
      ),
    },
    { accessorKey: "vendorName", header: t("Vendor Name"), cell: ({ row }) => row.getValue("vendorName") || "-" },
    { accessorKey: "engagementId", header: t("Engagement ID"), cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("engagementId") || "-"}</span> },
    { accessorKey: "domain", header: t("Domain"), cell: ({ row }) => row.getValue("domain") || "-" },
    {
      accessorKey: "severity",
      header: t("Severity"),
      cell: ({ row }) => {
        const sev = row.getValue("severity") as string;
        return sev ? <Badge variant={getSeverityVariant(sev)}>{sev}</Badge> : "-";
      },
    },
    { accessorKey: "responseDate", header: t("Response Date"), cell: ({ row }) => formatDate(row.getValue("responseDate")) },
    { accessorKey: "dueDate", header: t("Due Date"), cell: ({ row }) => formatDate(row.getValue("dueDate")) },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setViewRemediation(row.original)}>
          <Eye className="h-4 w-4 text-primary" />
        </Button>
      ),
    },
  ];

  const clarSubTabs = [
    { value: "open", label: t("Open Queries") },
    { value: "vendor-response", label: t("Vendor Response") },
    { value: "closed", label: t("Closed Queries") },
  ];

  const remSubTabs = [
    { value: "received", label: t("Received Response") },
    { value: "business", label: t("Business Issues") },
    { value: "it", label: t("IT Issues") },
    { value: "awaiting", label: t("Awaiting Vendor") },
    { value: "vendor-issues", label: t("Vendor Issues") },
    { value: "closed", label: t("Closed Issues") },
    { value: "overdue", label: t("Overdue Issues") },
    { value: "logs", label: t("Issue Logs") },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Follow-ups")}</span>
      </nav>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearch(""); }}>
        <TabsList>
          <TabsTrigger value="clarifications">{t("Clarifications")}</TabsTrigger>
          <TabsTrigger value="remediations">{t("Remediations")}</TabsTrigger>
        </TabsList>

        {/* Clarifications Tab */}
        <TabsContent value="clarifications" className="mt-4 space-y-4">
          <h2 className="text-xl font-bold">{t("Clarifications")}</h2>

          {/* Sub-tabs */}
          <div className="flex gap-0 rounded-lg overflow-hidden border">
            {clarSubTabs.map((st) => (
              <button
                key={st.value}
                onClick={() => setClarSubTab(st.value)}
                className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${
                  clarSubTab === st.value
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[180px]"
              placeholder={t("Requested Date")}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataGrid columns={clarificationColumns} data={filteredClarifications} hideSearch />
          )}
        </TabsContent>

        {/* Remediations Tab */}
        <TabsContent value="remediations" className="mt-4 space-y-4">
          <h2 className="text-xl font-bold">{t("Remediations")}</h2>

          {/* Sub-tabs */}
          <div className="flex gap-0 rounded-lg overflow-hidden border flex-wrap">
            {remSubTabs.map((st) => (
              <button
                key={st.value}
                onClick={() => setRemSubTab(st.value)}
                className={`flex-1 py-2.5 px-3 text-sm font-medium transition-colors min-w-[120px] ${
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-[160px]">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("Severity")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("All")}</SelectItem>
                  <SelectItem value="High">{t("High")}</SelectItem>
                  <SelectItem value="Medium">{t("Medium")}</SelectItem>
                  <SelectItem value="Low">{t("Low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[180px]"
              placeholder={t("Response Date")}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataGrid columns={remediationColumns} data={filteredRemediations} hideSearch />
          )}
        </TabsContent>
      </Tabs>

      {/* Remediation View Dialog */}
      <Dialog open={!!viewRemediation} onOpenChange={(open) => { if (!open) { setViewRemediation(null); setShowUnsatisfiedComment(false); setUnsatisfiedComment(""); } }}>
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

              {/* Assessor comment (previously returned) */}
              {viewRemediation.assessorComment && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      {t("Returned")}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("Previously marked as unsatisfactory")}</span>
                  </div>
                  <p className="text-sm text-orange-900">{viewRemediation.assessorComment}</p>
                </div>
              )}

              {/* VerifAI Summary */}
              <h5 className="font-semibold text-sm border-b pb-1">{t("VerifAI Summary")}</h5>
              {!viewRemediation.risk && !viewRemediation.recommendation ? (
                /* Monitoring-reported issue: compact 2-col layout */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {viewRemediation.issue && (
                    <div>
                      <Label className="text-xs font-semibold">{t("Issue")}</Label>
                      <Textarea value={viewRemediation.issue} readOnly rows={4} className="mt-1 bg-muted/50 text-sm" />
                    </div>
                  )}
                  <div>
                    <RemediationComments
                      remediationId={viewRemediation.id}
                      readOnly
                    />
                  </div>
                </div>
              ) : (
                /* Normal assessment remediation: original layout */
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
                      <RemediationComments
                        remediationId={viewRemediation.id}
                        readOnly
                      />
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
                {/* Supporting Artifacts */}
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
          {/* Unsatisfied comment box */}
          {showUnsatisfiedComment && (
            <div className="w-full space-y-2 border-t pt-4">
              <Label className="text-sm font-semibold">{t("Remediation Comment")}</Label>
              <Textarea
                value={unsatisfiedComment}
                onChange={e => setUnsatisfiedComment(e.target.value)}
                rows={3}
                placeholder={t("Explain why the response is unsatisfactory...")}
                className="text-sm"
              />
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {viewRemediation?.status === "Received" && (
              <>
                <Button onClick={() => handleRemediationAction("satisfied", t("Satisfied"))} disabled={actionLoading} className="bg-green-600 hover:bg-green-700">
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                  {t("Satisfied")}
                </Button>
                <Button onClick={() => handleRemediationAction("unsatisfied", t("Unsatisfied"))} disabled={actionLoading} variant="destructive">
                  {actionLoading && showUnsatisfiedComment && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                  {showUnsatisfiedComment ? t("Send Back to AM") : t("Unsatisfied")}
                </Button>
                <Button onClick={() => handleRemediationAction("send-to-business", t("Send to Business"))} disabled={actionLoading} variant="secondary">
                  {t("Send to Business")}
                </Button>
                <Button onClick={() => handleRemediationAction("reassign-to-it", t("Reassign to IT"))} disabled={actionLoading} variant="secondary">
                  {t("Reassign to IT")}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => { setViewRemediation(null); setShowUnsatisfiedComment(false); setUnsatisfiedComment(""); }}>{t("Cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign — Step 1: Comment */}
      <Dialog open={reassignStep === 1} onOpenChange={(open) => { if (!open) { setReassignStep(0); setAssigningRemediationId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reassignAction === "send-to-business" ? t("Send to Business") : t("Reassign to IT")} — {t("Comment")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-sm">{t("Add a comment for this reassignment")}</Label>
            <Textarea
              value={reassignComment}
              onChange={e => setReassignComment(e.target.value)}
              rows={4}
              placeholder={t("Enter reassignment comment...")}
              className="text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReassignStep(0); setAssigningRemediationId(null); }}>{t("Cancel")}</Button>
            <Button onClick={handleReassignCommentSave} disabled={rmLoading}>
              {rmLoading && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign — Step 2: Select RM */}
      <Dialog open={reassignStep === 2} onOpenChange={(open) => { if (!open) { setReassignStep(0); setAssigningRemediationId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reassignAction === "reassign-to-it" ? t("Assign to IT Team") : t("Assign to Relationship Manager")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-sm">
              {reassignAction === "reassign-to-it" ? t("Select an IT user to assign this issue") : t("Select an RM to assign this issue")}
            </Label>
            {rmUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {reassignAction === "reassign-to-it" ? t("No IT Team users found for this account") : t("No Relationship Managers found for this account")}
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {rmUsers.map(rm => (
                  <div
                    key={rm.id}
                    onClick={() => setSelectedRmId(rm.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedRmId === rm.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {rm.fullName?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{rm.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{rm.email}</p>
                    </div>
                    {selectedRmId === rm.id && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignStep(1)}>{t("Back")}</Button>
            <Button onClick={handleAssignToRM} disabled={actionLoading || !selectedRmId}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />}
              {t("Assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Share2,
  CheckCircle2,
  Loader2,
  Megaphone,
  Undo2,
  Plus,
  Trash2,
  Download,
  Sparkles,
  ClipboardCheck,
  FileText,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { confirm } from "@/components/ui/confirm";

type ReportingMode = "Continuous" | "Aggregated";

interface Finding {
  id: string;
  findingId: string;
  finding: string;
  severity: string;
  status: string;
  sharedWithAuditeeAt: string | null;
}

interface FindingsResponse {
  reportingMode: ReportingMode;
  findings: Finding[];
}

// ----- AI Findings Review (external Python API response shapes) -----
interface AiOverall {
  overall_compliance_status?: string;
  overall_confidence?: number;
  total_findings?: number;
  status_breakdown?: Record<string, number>;
  evaluated_findings?: number;
  compliance_rate_excluding_insufficient?: number;
}

interface AiEvidence {
  ref?: string;
  file_name?: string;
  page_label?: string;
  excerpt?: string;
  similarity_score?: number;
  cited_in_decision?: boolean;
}

interface AiVerification {
  supported?: boolean;
  contradiction?: boolean;
  notes?: string;
  initial_status?: string;
  final_status?: string;
}

interface AiFindingReview {
  index?: number;
  finding_title?: string;
  compliance_status?: string;
  confidence?: number;
  reasoning_summary?: string;
  evidence?: AiEvidence[];
  verification?: AiVerification;
}

interface FindingsCommunicationProps {
  engagementId: string;
  canEdit: boolean;
}

export default function FindingsCommunication({
  engagementId,
  canEdit,
}: FindingsCommunicationProps) {
  const { t } = useLanguage();

  const [reportingMode, setReportingMode] =
    useState<ReportingMode>("Continuous");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingMode, setSavingMode] = useState<boolean>(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState<boolean>(false);

  // ----- AI Findings Review -----
  const [aiBusy, setAiBusy] = useState<boolean>(false);
  const [aiOverall, setAiOverall] = useState<AiOverall | null>(null);
  const [aiReviewedAt, setAiReviewedAt] = useState<string | null>(null);
  const [aiReviews, setAiReviews] = useState<Record<string, AiFindingReview>>({});
  const [reviewDialog, setReviewDialog] = useState<AiFindingReview | null>(null);

  // ----- Add Finding -----
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [savingFinding, setSavingFinding] = useState<boolean>(false);
  const [persons, setPersons] = useState<Array<{ id: string; name: string }>>([]);
  const emptyFinding = {
    title: "",
    severity: "Medium",
    criteria: "",
    condition: "",
    cause: "",
    effect: "",
    recommendation: "",
    responsiblePersonId: "",
    status: "Open",
    targetDate: "",
  };
  const [findingForm, setFindingForm] = useState(emptyFinding);
  const setF = (k: keyof typeof emptyFinding, v: string) =>
    setFindingForm((p) => ({ ...p, [k]: v }));

  // ----- Aggregated: inline multi-row finding entry -----
  type FindingRow = typeof emptyFinding;
  const [bulkRows, setBulkRows] = useState<FindingRow[]>(() => [{ ...emptyFinding }]);
  const [savingBulk, setSavingBulk] = useState<boolean>(false);
  const addBulkRow = () => setBulkRows((p) => [...p, { ...emptyFinding }]);
  const updateBulkRow = (idx: number, k: keyof FindingRow, v: string) =>
    setBulkRows((p) => {
      const next = [...p];
      next[idx] = { ...next[idx], [k]: v };
      return next;
    });
  const removeBulkRow = (idx: number) =>
    setBulkRows((p) => p.filter((_, i) => i !== idx));

  const postFinding = async (f: FindingRow) => {
    const res = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.title.trim(),
        severity: f.severity || "Medium",
        criteria: f.criteria || null,
        condition: f.condition || null,
        cause: f.cause || null,
        effect: f.effect || null,
        recommendation: f.recommendation || null,
        responsiblePersonId: f.responsiblePersonId || null,
        status: f.status || "Open",
        targetDate: f.targetDate || null,
      }),
    });
    if (!res.ok) throw new Error("Failed");
  };

  const handleSaveBulk = async () => {
    const valid = bulkRows.filter((r) => r.title.trim());
    if (valid.length === 0) {
      toast.error(t("Finding title is required"));
      return;
    }
    if (valid.some((r) => !r.responsiblePersonId)) {
      toast.error(t("Responsible person is required"));
      return;
    }
    setSavingBulk(true);
    try {
      for (const r of valid) await postFinding(r);
      toast.success(t("Finding added successfully"));
      setBulkRows([{ ...emptyFinding }]);
      await loadFindings();
    } catch {
      toast.error(t("Failed to add finding"));
    } finally {
      setSavingBulk(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users/my-auditees");
        if (!res.ok) return;
        const data = await res.json();
        const list = (data?.auditees || data || []).map(
          (u: { id: string; fullName?: string; userName?: string; email?: string }) => ({
            id: u.id,
            name: u.fullName || u.userName || u.email || "",
          })
        );
        setPersons(list);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const handleAddFinding = async () => {
    if (!findingForm.title.trim()) {
      toast.error(t("Finding title is required"));
      return;
    }
    if (!findingForm.responsiblePersonId) {
      toast.error(t("Responsible person is required"));
      return;
    }
    setSavingFinding(true);
    try {
      const res = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: findingForm.title.trim(),
          severity: findingForm.severity || "Medium",
          criteria: findingForm.criteria || null,
          condition: findingForm.condition || null,
          cause: findingForm.cause || null,
          effect: findingForm.effect || null,
          recommendation: findingForm.recommendation || null,
          responsiblePersonId: findingForm.responsiblePersonId || null,
          status: findingForm.status || "Open",
          targetDate: findingForm.targetDate || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Finding added successfully"));
      setAddOpen(false);
      setFindingForm(emptyFinding);
      await loadFindings();
    } catch {
      toast.error(t("Failed to add finding"));
    } finally {
      setSavingFinding(false);
    }
  };

  const formatDate = useCallback((iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  }, []);

  const loadFindings = useCallback(async () => {
    setLoading(true);
    const url = `/api/internal-audit/engagements/${engagementId}/findings`;
    // Retry transient 401s (the dev session can momentarily fail to resolve)
    // and network blips before surfacing an error.
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.status === 401 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: FindingsResponse = await res.json();
        setReportingMode(data.reportingMode === "Aggregated" ? "Aggregated" : "Continuous");
        setFindings(Array.isArray(data.findings) ? data.findings : []);
        setLoading(false);
        return;
      } catch (e) {
        lastErr = e;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      }
    }
    console.error("Failed to load findings:", lastErr);
    toast.error(t("Failed to load findings"));
    setFindings([]);
    setLoading(false);
  }, [engagementId, t]);

  useEffect(() => {
    void loadFindings();
  }, [loadFindings]);

  // Re-hydrate any saved AI Findings Review so the summary + per-finding
  // verdicts survive a page reload.
  const loadAiReview = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}/findings/ai-review`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data: {
        overall: AiOverall | null;
        reviewedAt: string | null;
        findings: Array<{ id: string; review: AiFindingReview | null }>;
      } = await res.json();
      setAiOverall(data.overall ?? null);
      setAiReviewedAt(data.reviewedAt ?? null);
      const map: Record<string, AiFindingReview> = {};
      for (const f of data.findings || []) {
        if (f.review) map[f.id] = f.review;
      }
      setAiReviews(map);
    } catch {
      /* non-fatal */
    }
  }, [engagementId]);

  useEffect(() => {
    void loadAiReview();
  }, [loadAiReview]);

  const handleRunAiReview = async () => {
    setAiBusy(true);
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}/findings/ai-review`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || t("Failed to run AI review"));
        return;
      }
      setAiOverall(data.overall ?? null);
      setAiReviewedAt(data.reviewedAt ?? null);
      const map: Record<string, AiFindingReview> = {};
      for (const f of (data.findings || []) as Array<{
        id: string | null;
        review: AiFindingReview;
      }>) {
        if (f.id && f.review) map[f.id] = f.review;
      }
      setAiReviews(map);
      toast.success(t("AI review completed"));
    } catch {
      toast.error(t("Failed to run AI review"));
    } finally {
      setAiBusy(false);
    }
  };

  const handleModeChange = async (mode: ReportingMode) => {
    if (mode === reportingMode) return;
    const previous = reportingMode;
    setReportingMode(mode);
    setSavingMode(true);
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportingMode: mode }),
        }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Communication mode updated"));
      await loadFindings();
    } catch {
      setReportingMode(previous);
      toast.error(t("Failed to update communication mode"));
    } finally {
      setSavingMode(false);
    }
  };

  const handleShare = async (finding: Finding) => {
    setBusyId(finding.id);
    try {
      const res = await fetch(
        `/api/internal-audit/findings/${finding.id}/share`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Finding shared with auditor"));
      await loadFindings();
    } catch {
      toast.error(t("Failed to share finding"));
    } finally {
      setBusyId(null);
    }
  };

  const handleUnshare = async (finding: Finding) => {
    if (!(await confirm({ title: t("Unshare Finding?"), description: t("This action cannot be undone.") }))) return;
    setBusyId(finding.id);
    try {
      const res = await fetch(
        `/api/internal-audit/findings/${finding.id}/share`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Finding unshared"));
      await loadFindings();
    } catch {
      toast.error(t("Failed to unshare finding"));
    } finally {
      setBusyId(null);
    }
  };

  const handleShareAll = async () => {
    setBusyAll(true);
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}/findings/share-all`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      toast.success(
        t("Consolidated draft shared with auditor") +
          ` (${data.shared ?? findings.length})`
      );
      await loadFindings();
    } catch {
      toast.error(t("Failed to share consolidated draft"));
    } finally {
      setBusyAll(false);
    }
  };

  const handleUnshareAll = async () => {
    if (
      !(await confirm({
        title: t("Recall consolidated draft?"),
        description: t("This action cannot be undone."),
      }))
    )
      return;
    setBusyAll(true);
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}/findings/share-all`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Consolidated draft recalled"));
      await loadFindings();
    } catch {
      toast.error(t("Failed to recall consolidated draft"));
    } finally {
      setBusyAll(false);
    }
  };

  const sharedCount = findings.filter((f) => !!f.sharedWithAuditeeAt).length;
  const allShared = findings.length > 0 && sharedCount === findings.length;

  const severityBadgeClass = (severity: string): string => {
    switch (severity) {
      case "Critical":
      case "High":
        return "bg-red-100 text-red-700";
      case "Medium":
        return "bg-amber-100 text-amber-700";
      case "Low":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const complianceBadgeClass = (statusValue?: string): string => {
    switch ((statusValue || "").toLowerCase()) {
      case "compliant":
        return "bg-green-100 text-green-700";
      case "non-compliant":
        return "bg-red-100 text-red-700";
      case "partially compliant":
        return "bg-amber-100 text-amber-700";
      case "insufficient evidence":
        return "bg-slate-200 text-slate-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const formatPct = (value?: number): string =>
    typeof value === "number" ? `${Math.round(value * 100)}%` : "—";

  const modeHelper =
    reportingMode === "Continuous"
      ? t(
          "Findings are shared with the auditee individually as they are identified."
        )
      : t("Findings are consolidated into the draft detailed report.");

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-slate-500" />
              {t("Findings Communication")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `/api/internal-audit/engagements/${engagementId}/findings/export?mode=${reportingMode}`,
                    "_blank"
                  )
                }
              >
                <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {t("Export Excel")}
              </Button>
              {canEdit && reportingMode === "Continuous" && (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("Add Finding")}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-col gap-2">
            <Label>{t("Communication Mode")}</Label>
            {canEdit ? (
              <Select
                value={reportingMode}
                onValueChange={(v) => handleModeChange(v as ReportingMode)}
                disabled={savingMode}
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Continuous">{t("Continuous")}</SelectItem>
                  <SelectItem value="Aggregated">{t("Aggregated")}</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge className="bg-slate-100 text-slate-600 w-fit">
                {t(reportingMode)}
              </Badge>
            )}
          </div>
          <Separator />
          <p className="text-slate-500 flex items-center gap-2">
            {savingMode && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            )}
            {modeHelper}
          </p>
        </CardContent>
      </Card>

      {/* AI Findings Review */}
      {findings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              {t("AI Findings Review")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!aiOverall ? (
              // Button — hidden once the review completes and the summary shows
              <div className="flex flex-col items-start gap-2">
                {canEdit ? (
                  <Button onClick={handleRunAiReview} disabled={aiBusy}>
                    {aiBusy ? (
                      <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    )}
                    {aiBusy ? t("AI review in progress…") : t("AI Finding Summary")}
                  </Button>
                ) : (
                  <p className="text-sm text-slate-500">
                    {t("No AI review has been run yet.")}
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  {t(
                    "Evaluate all findings against the organization's policy documents."
                  )}
                </p>
              </div>
            ) : (
              // Overall summary card — shown in place of the button
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={complianceBadgeClass(
                        aiOverall.overall_compliance_status
                      )}
                    >
                      {t(aiOverall.overall_compliance_status || "—")}
                    </Badge>
                    <span className="text-sm text-slate-500">
                      {t("Confidence")}: {formatPct(aiOverall.overall_confidence)}
                    </span>
                  </div>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRunAiReview}
                      disabled={aiBusy}
                    >
                      {aiBusy ? (
                        <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                      )}
                      {t("Re-run AI Review")}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(aiOverall.status_breakdown || {}).map(
                    ([label, count]) => (
                      <div
                        key={label}
                        className="rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2"
                      >
                        <p className="text-xs text-slate-500">{t(label)}</p>
                        <p className="text-lg font-semibold text-slate-800">
                          {count}
                        </p>
                      </div>
                    )
                  )}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                  <span>
                    {t("Total findings")}: {aiOverall.total_findings ?? "—"}
                  </span>
                  <span>
                    {t("Evaluated")}: {aiOverall.evaluated_findings ?? "—"}
                  </span>
                  <span>
                    {t("Compliance rate")}:{" "}
                    {formatPct(aiOverall.compliance_rate_excluding_insufficient)}
                  </span>
                  {aiReviewedAt && (
                    <span>
                      {t("Reviewed")}: {formatDate(aiReviewedAt)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aggregated: add multiple findings inline (no separate page) */}
      {reportingMode === "Aggregated" && canEdit && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{t("Add Findings")}</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addBulkRow}>
                  <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("Add Row")}
                </Button>
                {bulkRows.length > 0 && (
                  <Button size="sm" onClick={handleSaveBulk} disabled={savingBulk}>
                    {savingBulk && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t("Save Findings")}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/60">
                    {[
                      ["#", "w-8"],
                      ["Finding Title *", "min-w-[170px]"],
                      ["Severity", "min-w-[120px]"],
                      ["Status", "min-w-[120px]"],
                      ["Criteria (What should be)", "min-w-[170px]"],
                      ["Condition (What is)", "min-w-[170px]"],
                      ["Cause (Why it happened)", "min-w-[170px]"],
                      ["Effect (The consequence)", "min-w-[170px]"],
                      ["Recommendation", "min-w-[170px]"],
                      ["Responsible Person *", "min-w-[150px]"],
                      ["Target Date", "min-w-[150px]"],
                      ["", "w-10"],
                    ].map(([label, w], i) => (
                      <th
                        key={i}
                        className={`${w} text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-2 px-1.5 whitespace-nowrap`}
                      >
                        {label ? t(label) : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, idx) => (
                    <tr key={idx} className="border-t border-slate-100 align-top">
                      <td className="py-1.5 px-1.5 text-slate-500">{idx + 1}</td>
                      <td className="py-1.5 px-1">
                        <Input
                          value={row.title}
                          onChange={(e) => updateBulkRow(idx, "title", e.target.value)}
                          placeholder={t("Enter finding title")}
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <Select value={row.severity} onValueChange={(v) => updateBulkRow(idx, "severity", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Critical", "High", "Medium", "Low"].map((s) => (
                              <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1.5 px-1">
                        <Select value={row.status} onValueChange={(v) => updateBulkRow(idx, "status", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Open", "In Progress", "Closed"].map((s) => (
                              <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {(["criteria", "condition", "cause", "effect", "recommendation"] as Array<keyof FindingRow>).map((k) => (
                        <td key={k} className="py-1.5 px-1">
                          <Textarea
                            rows={2}
                            className="min-w-[170px] text-xs"
                            value={row[k]}
                            onChange={(e) => updateBulkRow(idx, k, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="py-1.5 px-1">
                        <Select
                          value={row.responsiblePersonId}
                          onValueChange={(v) => updateBulkRow(idx, "responsiblePersonId", v)}
                        >
                          <SelectTrigger><SelectValue placeholder={t("Select person")} /></SelectTrigger>
                          <SelectContent>
                            {persons.length === 0 ? (
                              <div className="px-2 py-3 text-xs text-slate-400 text-center">
                                {t("No users found")}
                              </div>
                            ) : (
                              persons.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1.5 px-1">
                        <Input
                          type="date"
                          value={row.targetDate}
                          onChange={(e) => updateBulkRow(idx, "targetDate", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 px-1 text-center">
                        {bulkRows.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                            onClick={() => removeBulkRow(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aggregated: consolidated draft report sharing */}
      {reportingMode === "Aggregated" && findings.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium text-slate-700">
                  {t("Draft Detailed Report")}
                </p>
                <p className="text-sm text-slate-500">
                  {allShared
                    ? t("All findings consolidated and shared with the auditor.")
                    : t(
                        "Consolidate all findings into the draft detailed report and share them with the auditee at once."
                      )}{" "}
                  <span className="text-slate-400">
                    ({sharedCount}/{findings.length} {t("shared")})
                  </span>
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  {allShared ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyAll}
                      onClick={handleUnshareAll}
                    >
                      {busyAll ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Undo2 className="h-4 w-4 mr-1" />
                      )}
                      {t("Recall draft")}
                    </Button>
                  ) : (
                    <Button size="sm" disabled={busyAll} onClick={handleShareAll}>
                      {busyAll ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Share2 className="h-4 w-4 mr-1" />
                      )}
                      {t("Share consolidated draft with auditor")}
                    </Button>
                  )}
                </div>
              )}
            </div>
            {allShared && (
              <Badge className="mt-3 bg-green-100 text-green-700 flex items-center gap-1 w-fit">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("Shared")}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Findings list */}
      {findings.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-sm text-slate-500">
          <p>{t("No findings recorded yet.")}</p>
          <p className="mt-1 text-xs text-slate-400">
            {t("Use Add Finding to record an audit finding.")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((f) => {
            const shared = !!f.sharedWithAuditeeAt;
            const isBusy = busyId === f.id;
            return (
              <Card key={f.id} className="overflow-hidden">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">
                          {f.findingId}
                        </span>
                        <Badge className={severityBadgeClass(f.severity)}>
                          {t(f.severity)}
                        </Badge>
                        <Badge className="bg-slate-100 text-slate-600">
                          {t(f.status)}
                        </Badge>
                      </div>
                      <p className="font-medium text-slate-700 break-words">
                        {f.finding}
                      </p>
                      {aiReviews[f.id] && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Badge
                            className={complianceBadgeClass(
                              aiReviews[f.id].compliance_status
                            )}
                          >
                            {t(aiReviews[f.id].compliance_status || "—")}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {t("Confidence")}:{" "}
                            {formatPct(aiReviews[f.id].confidence)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setReviewDialog(aiReviews[f.id])}
                          >
                            <ClipboardCheck className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" />
                            {t("Review")}
                          </Button>
                        </div>
                      )}
                    </div>

                    {reportingMode === "Continuous" && (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {shared ? (
                          <>
                            <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {t("Shared")} · {formatDate(f.sharedWithAuditeeAt)}
                            </Badge>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-slate-500"
                                disabled={isBusy}
                                onClick={() => handleUnshare(f)}
                              >
                                {isBusy ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                                )}
                                {t("Unshare")}
                              </Button>
                            )}
                          </>
                        ) : (
                          canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleShare(f)}
                            >
                              {isBusy ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Share2 className="h-4 w-4 mr-1" />
                              )}
                              {t("Share with auditor")}
                            </Button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Finding dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Add Finding")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>
                {t("Finding Title")} <span className="text-red-500">*</span>
              </Label>
              <Input
                value={findingForm.title}
                onChange={(e) => setF("title", e.target.value)}
                placeholder={t("Enter finding title")}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{t("Severity")}</Label>
                <Select value={findingForm.severity} onValueChange={(v) => setF("severity", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Critical", "High", "Medium", "Low"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Status")}</Label>
                <Select value={findingForm.status} onValueChange={(v) => setF("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Open", "In Progress", "Closed"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(
              [
                ["criteria", "Criteria (What should be)"],
                ["condition", "Condition (What is)"],
                ["cause", "Cause (Why it happened)"],
                ["effect", "Effect (The consequence)"],
                ["recommendation", "Recommendation"],
              ] as Array<[keyof typeof emptyFinding, string]>
            ).map(([key, label]) => (
              <div key={key}>
                <Label>{t(label)}</Label>
                <Textarea
                  rows={2}
                  value={findingForm[key]}
                  onChange={(e) => setF(key, e.target.value)}
                  placeholder={t(`Enter ${key}`)}
                />
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>
                  {t("Responsible Person")} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={findingForm.responsiblePersonId}
                  onValueChange={(v) => setF("responsiblePersonId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select person")} />
                  </SelectTrigger>
                  <SelectContent>
                    {persons.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-slate-400 text-center">
                        {t("No users found")}
                      </div>
                    ) : (
                      persons.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Target Date")}</Label>
                <Input
                  type="date"
                  value={findingForm.targetDate}
                  onChange={(e) => setF("targetDate", e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={savingFinding}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddFinding} disabled={savingFinding}>
              {savingFinding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("Add Finding")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-finding AI review dialog */}
      <Dialog
        open={!!reviewDialog}
        onOpenChange={(open) => !open && setReviewDialog(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              {t("AI Review")}
            </DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4 py-2 text-sm">
              <p className="font-medium text-slate-800">
                {reviewDialog.finding_title}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={complianceBadgeClass(reviewDialog.compliance_status)}
                >
                  {t(reviewDialog.compliance_status || "—")}
                </Badge>
                <span className="text-slate-500">
                  {t("Confidence")}: {formatPct(reviewDialog.confidence)}
                </span>
              </div>

              {reviewDialog.reasoning_summary && (
                <div>
                  <Label className="text-slate-500">{t("Reasoning")}</Label>
                  <p className="mt-1 text-slate-700">
                    {reviewDialog.reasoning_summary}
                  </p>
                </div>
              )}

              {reviewDialog.verification?.notes && (
                <div>
                  <Label className="text-slate-500">
                    {t("Verification")}
                  </Label>
                  <p className="mt-1 text-slate-700">
                    {reviewDialog.verification.notes}
                  </p>
                </div>
              )}

              {Array.isArray(reviewDialog.evidence) &&
                reviewDialog.evidence.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-slate-500">{t("Evidence")}</Label>
                    {reviewDialog.evidence.map((ev, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-slate-200 bg-slate-50/60 p-3"
                      >
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                          <FileText className="h-3.5 w-3.5" />
                          <span className="font-medium">
                            {ev.file_name || ev.ref || `E${i}`}
                          </span>
                          {ev.cited_in_decision && (
                            <Badge className="bg-violet-100 text-violet-700 h-5">
                              {t("Cited")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 whitespace-pre-wrap">
                          {ev.excerpt}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>
              {t("Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

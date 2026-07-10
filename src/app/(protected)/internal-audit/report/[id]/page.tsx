"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NotFound } from "@/components/ui/unauthorized";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ChevronRight, Home, Download, Pencil } from "lucide-react";
import { useHasRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, useTranslatedRecord, triggerTranslation } from "@/hooks/useTranslatedData";
import {
  OPINION_RATINGS,
  FINDING_TYPES,
  PRIORITY_DEFINITIONS,
  FINDING_TYPE_DEFINITIONS,
  riskLevelOf,
  RISK_LEVELS,
  ratingBadgeClass,
  riskBadgeClass,
  type ReportFinding,
} from "@/lib/internal-audit/report-shared";

interface AuditReportData {
  id: string;
  reportCode: string;
  title: string;
  executiveSummary: string | null;
  scope: string | null;
  scopeExclusions: string | null;
  objectives: string | null;
  methodology: string | null;
  observations: string | null;
  recommendations: string | null;
  managementResponse: string | null;
  conclusion: string | null;
  opinionRating: string | null;
  opinionSummary: string | null;
  topMessages: string | null;
  keyRisks: string | null;
  summaryKeyFindings: string | null;
  mgmtAttentionImmediate: string | null;
  mgmtAttentionMediumTerm: string | null;
  followUp: string | null;
  overallResult: string | null;
  auditeeId: string | null;
  auditeeName: string | null;
  auditeeComment: string | null;
  status: string;
  draftGeneratedAt: string | null;
  updatedAt: string;
  engagement: {
    id: string;
    auditId: string;
    engagementTitle: string;
    engagementObjective: string | null;
    engagementScope: string | null;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
    actualStartDate: string | null;
    actualEndDate: string | null;
    department: { id: string; name: string } | null;
    assignedAuditor: { id: string; firstName: string; lastName: string } | null;
    auditee: { id: string; firstName: string; lastName: string } | null;
    process?: { id: string; name: string } | null;
    findings: ReportFinding[];
  };
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

const EMPTY_FORM = {
  executiveSummary: "",
  objectives: "",
  scope: "",
  scopeExclusions: "",
  methodology: "",
  opinionRating: "",
  opinionSummary: "",
  recommendations: "",
  topMessages: "",
  keyRisks: "",
  summaryKeyFindings: "",
  mgmtAttentionImmediate: "",
  mgmtAttentionMediumTerm: "",
  followUp: "",
  conclusion: "",
  auditeeId: "",
};

export default function AuditReportViewPage({ params }: PageProps) {
  const { id: engagementId } = use(params);
  const router = useRouter();
  const { t, locale } = useLanguage();
  const isAuditHead = useHasRole("AuditHead");
  const isAuditor = useHasRole("Auditor");
  const isAuditee = useHasRole("Auditee");
  void router;

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AuditReportData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAuditeeComment, setIsEditingAuditeeComment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAuditeeComment, setSavingAuditeeComment] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [auditeeComment, setAuditeeComment] = useState("");

  const { data: translatedReport } = useTranslatedRecord(report, { modelName: 'AuditReport' });
  const { data: translatedFindings } = useTranslatedData(report?.engagement?.findings ?? [], { modelName: 'InternalAuditFinding' });

  const dateLocaleMap: Record<string, string> = { en: "en-GB", ar: "ar-SA", lv: "lv-LV" };

  useEffect(() => {
    fetchReport();
    fetchUsers();
  }, [engagementId]);

  const formToData = (data: AuditReportData) => ({
    executiveSummary: data.executiveSummary || "",
    objectives: data.objectives || data.engagement.engagementObjective || "",
    scope: data.scope || data.engagement.engagementScope || "",
    scopeExclusions: data.scopeExclusions || "",
    methodology: data.methodology || "",
    opinionRating: data.opinionRating || "Satisfactory",
    opinionSummary: data.opinionSummary || "",
    recommendations: data.recommendations || "",
    topMessages: data.topMessages || "",
    keyRisks: data.keyRisks || "",
    summaryKeyFindings: data.summaryKeyFindings || "",
    mgmtAttentionImmediate: data.mgmtAttentionImmediate || "",
    mgmtAttentionMediumTerm: data.mgmtAttentionMediumTerm || "",
    followUp: data.followUp || "",
    conclusion: data.conclusion || "",
    auditeeId: data.auditeeId || "",
  });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/internal-audit/report/${engagementId}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data);
        setEditForm(formToData(data));
        setAuditeeComment(data.auditeeComment || "");
      }
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users/my-auditees");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.auditees || []);
      }
    } catch (error) {
      console.error("Error fetching auditees:", error);
    }
  };

  const handleSave = async () => {
    if (!report) return;
    setSaving(true);
    try {
      const selectedUser = users.find((u) => u.id === editForm.auditeeId);
      const auditeeName = selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : "";

      const payload = { ...editForm, auditeeName };

      const response = await fetch(`/api/internal-audit/report/${engagementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const updatedReport = await response.json();
        setReport(updatedReport);
        setIsEditing(false);
        toast.success(t("Report saved successfully"));
        triggerTranslation('AuditReport', updatedReport.id, {
          title: updatedReport.title,
          executiveSummary: updatedReport.executiveSummary,
          scope: updatedReport.scope,
          scopeExclusions: updatedReport.scopeExclusions,
          objectives: updatedReport.objectives,
          methodology: updatedReport.methodology,
          recommendations: updatedReport.recommendations,
          opinionSummary: updatedReport.opinionSummary,
          topMessages: updatedReport.topMessages,
          keyRisks: updatedReport.keyRisks,
          summaryKeyFindings: updatedReport.summaryKeyFindings,
          mgmtAttentionImmediate: updatedReport.mgmtAttentionImmediate,
          mgmtAttentionMediumTerm: updatedReport.mgmtAttentionMediumTerm,
          followUp: updatedReport.followUp,
          conclusion: updatedReport.conclusion,
        });
      } else {
        toast.error(t("Failed to save report"));
      }
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error(t("Failed to save report"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAuditeeComment = async () => {
    if (!report) return;
    setSavingAuditeeComment(true);
    try {
      const response = await fetch(`/api/internal-audit/report/${engagementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditeeComment }),
      });
      if (response.ok) {
        const updatedReport = await response.json();
        setReport(updatedReport);
        setIsEditingAuditeeComment(false);
        toast.success(t("Auditor comment saved successfully"));
        triggerTranslation('AuditReport', updatedReport.id, { auditeeComment: updatedReport.auditeeComment });
      } else {
        toast.error(t("Failed to save auditor comment"));
      }
    } catch (error) {
      console.error("Error saving auditee comment:", error);
      toast.error(t("Failed to save auditor comment"));
    } finally {
      setSavingAuditeeComment(false);
    }
  };

  const handleSetStatus = async (newStatus: "Draft" | "Final") => {
    if (!report) return;
    setFinalizing(true);
    try {
      const response = await fetch(`/api/internal-audit/report/${engagementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        const updatedReport = await response.json();
        setReport(updatedReport);
        toast.success(newStatus === "Final" ? t("Report finalized") : t("Report reverted to draft"));
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || t("Failed to update report status"));
      }
    } catch (error) {
      console.error("Error updating report status:", error);
      toast.error(t("Failed to update report status"));
    } finally {
      setFinalizing(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!report) return;
    try {
      const response = await fetch(`/api/internal-audit/report/${engagementId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${report.reportCode}_${report.title.replace(/\s+/g, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        toast.error(t("Failed to download report"));
      }
    } catch (error) {
      console.error("Error downloading report:", error);
      toast.error(t("Failed to download report"));
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString(dateLocaleMap[locale] || "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="p-3 sm:p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
        </div>
      </div>
    );
  }

  if (!report) {
    return <NotFound title={t("Report Not Found")} backHref="/internal-audit/report" />;
  }

  const tr = translatedReport || report;
  const canEdit = isAuditHead || isAuditor;
  const fieldworkPeriod = `${formatDate(report.engagement.actualStartDate || report.engagement.plannedStartDate)} to ${formatDate(report.engagement.actualEndDate || report.engagement.plannedEndDate)}`;
  const reportDate = formatDate(report.updatedAt);
  const distribution = t("Audit Committee, CFO, Controller, IT Head");

  // ── Derived data from findings ────────────────────────────────────────────
  const findings = (translatedFindings && translatedFindings.length ? translatedFindings : report.engagement.findings) as ReportFinding[];
  const total = findings.length;
  const countByLevel = (level: string) => findings.filter((f) => riskLevelOf(f.severity) === level).length;
  const highCount = countByLevel("High");
  const mediumCount = countByLevel("Medium");
  const lowCount = countByLevel("Low");

  // Findings-by-type × risk-level matrix for the summary chart
  const typeMatrix = FINDING_TYPES.map((type) => ({
    type,
    counts: RISK_LEVELS.map((lvl) => findings.filter((f) => f.findingType === type && riskLevelOf(f.severity) === lvl).length),
  }));
  const chartMax = Math.max(1, ...typeMatrix.flatMap((r) => r.counts));

  const rating = tr.opinionRating || "Satisfactory";

  // Small inline section helper
  const TextSection = ({ label, field, rows = 4, viewFallback }: { label: string; field: keyof typeof EMPTY_FORM; rows?: number; viewFallback?: string }) => (
    <div>
      <h2 className="font-bold text-base mb-2">{t(label)}</h2>
      {isEditing && canEdit ? (
        <Textarea
          value={editForm[field]}
          onChange={(e) => setEditForm((prev) => ({ ...prev, [field]: e.target.value }))}
          rows={rows}
          className="w-full"
        />
      ) : (
        <p className="text-sm whitespace-pre-wrap">
          {(tr[field as keyof AuditReportData] as string) || viewFallback || <span className="text-gray-400 italic">{t("Not provided")}</span>}
        </p>
      )}
    </div>
  );

  const Divider = () => <hr className="border-gray-300" />;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap">
        <Link href="/internal-audit/report" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/internal-audit/report" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Reports")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Report Details")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/internal-audit/report" className="flex items-center gap-1 text-slate-600 hover:text-primary-600">
          <ArrowLeft className="h-4 w-4" />
          {t("Back")}
        </Link>
        <span className="text-slate-400">|</span>
        <span className="text-primary-600 font-semibold">{t("Internal Audit Report")}</span>
        <span
          className={`ltr:ml-auto rtl:mr-auto px-2.5 py-0.5 rounded-full text-xs font-medium ${
            report.status === "Final" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {report.status === "Final" ? t("Final") : t("Draft")}
        </span>
      </div>

      {/* Report Content */}
      <div className="bg-white border rounded-lg p-4 sm:p-8 space-y-4 sm:space-y-6">
        <h1 className="text-lg font-bold text-center uppercase">{t("Internal Audit Report")}</h1>

        {/* Metadata */}
        <div className="space-y-2 text-sm">
          <div className="flex flex-col sm:flex-row">
            <span className="font-semibold w-auto sm:w-40">{t("Audit Title")}:</span>
            <span className="text-blue-600">{tr.title || report.title}</span>
          </div>
          <div className="flex flex-col sm:flex-row">
            <span className="font-semibold w-auto sm:w-40">{t("Report Number")}:</span>
            <span className="text-blue-600">{report.reportCode}</span>
          </div>
          <div className="flex flex-col sm:flex-row">
            <span className="font-semibold w-auto sm:w-40">{t("Report Date")}:</span>
            <span className="text-blue-600">{reportDate}</span>
          </div>
          <div className="flex flex-col sm:flex-row">
            <span className="font-semibold w-auto sm:w-40">{t("Fieldwork Period")}:</span>
            <span className="text-blue-600">{fieldworkPeriod}</span>
          </div>
          <div className="flex flex-col sm:flex-row">
            <span className="font-semibold w-auto sm:w-40">{t("Department")}:</span>
            <span className="text-blue-600">{report.engagement.department?.name || "-"}</span>
          </div>
          <div className="flex flex-col sm:flex-row">
            <span className="font-semibold w-auto sm:w-40">{t("Audit Manager")}:</span>
            <span>
              {report.engagement.assignedAuditor
                ? `${report.engagement.assignedAuditor.firstName} ${report.engagement.assignedAuditor.lastName}`
                : "-"}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row">
            <span className="font-semibold w-auto sm:w-40">{t("Distribution")}:</span>
            <span className="text-blue-600">{distribution}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center">
            <span className="font-semibold w-auto sm:w-40">{t("Auditor")}:</span>
            {isEditing && canEdit ? (
              <Select value={editForm.auditeeId} onValueChange={(value) => setEditForm((prev) => ({ ...prev, auditeeId: value }))}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={t("Select Auditor")} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-blue-600">
                {report.auditeeName ||
                  (report.engagement.auditee ? `${report.engagement.auditee.firstName} ${report.engagement.auditee.lastName}` : "-")}
              </span>
            )}
          </div>
        </div>

        <Divider />
        <TextSection label="Executive Summary" field="executiveSummary" rows={5} />
        <Divider />
        <TextSection label="Audit Objectives" field="objectives" rows={4} />
        <Divider />
        <TextSection label="Scope of Work" field="scope" rows={4} />
        <TextSection label="Exclusion from the Scope of Work" field="scopeExclusions" rows={2} />
        <Divider />
        <TextSection label="Audit Methodology" field="methodology" rows={5} />
        <Divider />

        {/* Opinion */}
        <div>
          <h2 className="font-bold text-base mb-2">{t("Opinion")}</h2>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-semibold">{t("Overall Audit Opinion")}:</span>
            {isEditing && canEdit ? (
              <Select value={editForm.opinionRating} onValueChange={(v) => setEditForm((prev) => ({ ...prev, opinionRating: v }))}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder={t("Select rating")} />
                </SelectTrigger>
                <SelectContent>
                  {OPINION_RATINGS.map((r) => (
                    <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ratingBadgeClass(rating)}`}>{t(rating)}</span>
            )}
          </div>
          {isEditing && canEdit ? (
            <Textarea value={editForm.opinionSummary} onChange={(e) => setEditForm((p) => ({ ...p, opinionSummary: e.target.value }))} rows={3} className="w-full" />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{tr.opinionSummary || <span className="text-gray-400 italic">{t("Not provided")}</span>}</p>
          )}

          {/* Auto observation counts */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
              <p className="text-2xl font-bold text-slate-800">{total}</p>
              <p className="text-xs text-slate-500">{t("Total Observations")}</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{highCount}</p>
              <p className="text-xs text-red-500">{t("High Risk")}</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{mediumCount}</p>
              <p className="text-xs text-amber-500">{t("Medium Risk")}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{lowCount}</p>
              <p className="text-xs text-emerald-500">{t("Low Risk")}</p>
            </div>
          </div>
        </div>

        <Divider />
        <TextSection label="Recommendations" field="recommendations" rows={4} />
        <Divider />
        <TextSection label="Top Messages for Senior Management" field="topMessages" rows={4} />
        <Divider />
        <TextSection label="Key Risks" field="keyRisks" rows={3} />
        <Divider />
        <TextSection label="Summary of Key Audit Findings" field="summaryKeyFindings" rows={4} />
        <Divider />

        {/* Areas Requiring Management's Attention */}
        <div>
          <h2 className="font-bold text-base mb-3">{t("Areas Requiring Management's Attention")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-sm mb-1.5">{t("Immediate Action")}</h3>
              {isEditing && canEdit ? (
                <Textarea value={editForm.mgmtAttentionImmediate} onChange={(e) => setEditForm((p) => ({ ...p, mgmtAttentionImmediate: e.target.value }))} rows={3} className="w-full" />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{tr.mgmtAttentionImmediate || <span className="text-gray-400 italic">{t("Not provided")}</span>}</p>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1.5">{t("Medium-Term Improvement")}</h3>
              {isEditing && canEdit ? (
                <Textarea value={editForm.mgmtAttentionMediumTerm} onChange={(e) => setEditForm((p) => ({ ...p, mgmtAttentionMediumTerm: e.target.value }))} rows={3} className="w-full" />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{tr.mgmtAttentionMediumTerm || <span className="text-gray-400 italic">{t("Not provided")}</span>}</p>
              )}
            </div>
          </div>
        </div>

        <Divider />
        <TextSection label="Follow up" field="followUp" rows={3} />

        {/* ─────────── DETAILED REPORT ─────────── */}
        <div className="pt-2">
          <h1 className="text-lg font-bold text-center uppercase border-t-2 border-slate-800 pt-4">{t("Detailed Report")}</h1>
        </div>

        {/* Priorities for implementation */}
        <div>
          <h2 className="font-bold text-base mb-3">{t("Priorities for the Implementation of Audit Recommendations")}</h2>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 ltr:text-left rtl:text-right font-semibold border-b w-24">{t("Priority")}</th>
                  <th className="px-4 py-2 ltr:text-left rtl:text-right font-semibold border-b">{t("Description")}</th>
                </tr>
              </thead>
              <tbody>
                {PRIORITY_DEFINITIONS.map((p) => (
                  <tr key={p.label} className="border-b last:border-b-0">
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${p.dot}`} />
                        {t(p.label)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{t(p.description)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">{t("High-priority audit observations are given precedence for implementation to assist management in directing resources toward the timely execution of corrective actions and mitigation of significant risks.")}</p>
        </div>

        {/* Definition of Finding Types */}
        <div>
          <h2 className="font-bold text-base mb-3">{t("Definition of Finding Types")}</h2>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 ltr:text-left rtl:text-right font-semibold border-b w-56">{t("Type")}</th>
                  <th className="px-4 py-2 ltr:text-left rtl:text-right font-semibold border-b">{t("Definition")}</th>
                </tr>
              </thead>
              <tbody>
                {FINDING_TYPE_DEFINITIONS.map((d) => (
                  <tr key={d.label} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-medium">{t(d.label)}</td>
                    <td className="px-4 py-2 text-slate-600">{t(d.description)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary of Audit Findings chart */}
        <div>
          <h2 className="font-bold text-base mb-3">{t("Summary of Audit Findings")}</h2>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-end gap-6 sm:gap-10 h-48 px-2">
              {typeMatrix.map((row) => (
                <div key={row.type} className="flex flex-col items-center flex-1 min-w-0">
                  <div className="flex items-end gap-1.5 h-40">
                    {row.counts.map((count, i) => (
                      <div key={i} className="flex flex-col items-center justify-end" title={`${t(RISK_LEVELS[i])}: ${count}`}>
                        {count > 0 && <span className="text-[10px] font-bold text-slate-700 mb-0.5">{count}</span>}
                        <div
                          className={`w-5 sm:w-6 rounded-t ${riskBarClass(RISK_LEVELS[i])}`}
                          style={{ height: `${(count / chartMax) * 140}px` }}
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-500 text-center mt-2 leading-tight">{t(row.type)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-600">
              {RISK_LEVELS.map((lvl) => (
                <div key={lvl} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded ${riskBarClass(lvl)}`} />
                  {t(lvl)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Index of Audit Notes */}
        <div>
          <h2 className="font-bold text-base mb-3">{t("Index of Audit Notes")}</h2>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 ltr:text-left rtl:text-right font-semibold border-b w-16">{t("Number")}</th>
                  <th className="px-4 py-2 ltr:text-left rtl:text-right font-semibold border-b">{t("Summary of Findings")}</th>
                  <th className="px-4 py-2 ltr:text-left rtl:text-right font-semibold border-b w-28">{t("Priority")}</th>
                </tr>
              </thead>
              <tbody>
                {findings.length > 0 ? (
                  findings.map((f, idx) => (
                    <tr key={f.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2">{f.finding}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskBadgeClass(riskLevelOf(f.severity))}`}>
                          {t(riskLevelOf(f.severity))}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-gray-500 italic">{t("No observations recorded")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Notes */}
        <div>
          <h2 className="font-bold text-base mb-3">{t("Detailed Notes")}</h2>
          {findings.length > 0 ? (
            <div className="space-y-4">
              {findings.map((f, idx) => (
                <div key={f.id} className="border rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-sm">{idx + 1}. {f.finding}</h3>
                    <div className="flex items-center gap-2">
                      {f.findingType && <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">{t(f.findingType)}</span>}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskBadgeClass(riskLevelOf(f.severity))}`}>{t(riskLevelOf(f.severity))}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <FindingRow label={t("Criteria")} value={f.criteria} />
                    <FindingRow label={t("Condition")} value={f.condition} />
                    <FindingRow label={t("Cause")} value={f.cause} />
                    <FindingRow label={t("Effect")} value={f.effect} />
                    <FindingRow label={t("Recommendation")} value={f.recommendation} full />
                    <FindingRow label={t("Responsible Person")} value={f.responsiblePerson} />
                    <FindingRow label={t("Target Date")} value={f.targetDate ? formatDate(f.targetDate) : ""} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">{t("No observations recorded")}</p>
          )}
        </div>

        {/* Auditor Comment */}
        <Divider />
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-base">{t("Auditor Comment")}</h2>
            {isAuditee && !isAuditHead && !isAuditor && !isEditingAuditeeComment && (
              <Button size="sm" variant="outline" onClick={() => setIsEditingAuditeeComment(true)}>
                <Pencil className="h-3 w-3 mr-1" />
                {t("Edit")}
              </Button>
            )}
          </div>
          {isEditingAuditeeComment ? (
            <div className="space-y-2">
              <Textarea value={auditeeComment} onChange={(e) => setAuditeeComment(e.target.value)} rows={4} className="w-full" placeholder={t("Enter your comment...")} />
              <div className="flex gap-2">
                <Button size="sm" className="bg-primary-600 hover:bg-primary-700" onClick={handleSaveAuditeeComment} disabled={savingAuditeeComment}>
                  {savingAuditeeComment ? (<><Loader2 className="h-3 w-3 ltr:mr-1 rtl:ml-1 animate-spin" />{t("Saving...")}</>) : t("Save")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setIsEditingAuditeeComment(false); setAuditeeComment(report.auditeeComment || ""); }}>
                  {t("Cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {tr.auditeeComment || <span className="text-gray-400 italic">{t("No comment provided")}</span>}
            </p>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-row flex-wrap ltr:justify-end rtl:justify-start items-center gap-3 pt-4 border-t border-slate-200">
        <Button className="bg-primary-600 hover:bg-primary-700" onClick={handleDownloadReport}>
          <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Download Report")}
        </Button>
        {isAuditHead && !isEditing && (
          report.status === "Final" ? (
            <Button variant="outline" onClick={() => handleSetStatus("Draft")} disabled={finalizing}>
              {finalizing ? <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" /> : null}
              {t("Revert to Draft")}
            </Button>
          ) : (
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleSetStatus("Final")} disabled={finalizing}>
              {finalizing ? <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" /> : null}
              {t("Finalize Report")}
            </Button>
          )
        )}
        {canEdit && (
          !isEditing ? (
            <Button className="bg-primary-600 hover:bg-primary-700" onClick={() => { setEditForm(formToData(tr as AuditReportData)); setIsEditing(true); }}>
              <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Edit")}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setIsEditing(false); setEditForm(formToData(tr as AuditReportData)); }}>
                {t("Cancel")}
              </Button>
              <Button className="bg-primary-600 hover:bg-primary-700" onClick={handleSave} disabled={saving}>
                {saving ? (<><Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />{t("Saving...")}</>) : t("Save")}
              </Button>
            </>
          )
        )}
      </div>
    </div>
  );
}

// Bar color for a risk level
function riskBarClass(level: string): string {
  return level === "High" ? "bg-red-500" : level === "Medium" ? "bg-amber-400" : "bg-emerald-500";
}

function FindingRow({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <span className="font-medium text-slate-500">{label}: </span>
      <span className="text-slate-700 whitespace-pre-wrap">{value || "-"}</span>
    </div>
  );
}

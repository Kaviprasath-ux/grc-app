"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Download, Pencil } from "lucide-react";
import { useHasRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface Finding {
  id: string;
  findingId: string;
  finding: string;
  description: string | null;
  severity: string;
  status: string;
}

interface AuditReportData {
  id: string;
  reportCode: string;
  title: string;
  executiveSummary: string | null;
  scope: string | null;
  objectives: string | null;
  methodology: string | null;
  observations: string | null;
  recommendations: string | null;
  managementResponse: string | null; // Used for Summary section
  conclusion: string | null;
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
    findings: Finding[];
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

export default function AuditReportViewPage({ params }: PageProps) {
  const { id: engagementId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const isAuditHead = useHasRole("AuditHead");
  const isAuditManager = useHasRole("AuditManager");
  const isAuditee = useHasRole("Auditee");

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AuditReportData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAuditeeComment, setIsEditingAuditeeComment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAuditeeComment, setSavingAuditeeComment] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Edit form state (for AuditHead)
  const [editForm, setEditForm] = useState({
    executiveSummary: "",
    overallResultText: "",
    background: "",
    objective: "",
    scope: "",
    recommendations: "",
    conclusion: "",
    auditeeId: "",
  });

  // Auditee comment state
  const [auditeeComment, setAuditeeComment] = useState("");

  useEffect(() => {
    fetchReport();
    fetchUsers();
  }, [engagementId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/internal-audit/report/${engagementId}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data);
        // Static template defaults (Objective and Scope default from engagement)
        const defaultExecutiveSummary = `This report presents the results of the internal audit conducted for ${data.title}. The audit was performed to assess the adequacy and effectiveness of internal controls, compliance with policies and procedures, and the efficiency of operations. Key findings and recommendations are detailed in the sections below.`;
        const defaultOverallResultText = "Based on our audit procedures and findings, the overall audit result is {RESULT}. The controls tested during the audit period were found to be operating as designed, with appropriate documentation and oversight in place to manage identified risks effectively.";
        const defaultBackground = "The internal audit function is an independent and objective assurance activity designed to add value and improve the organization's operations. This audit was conducted in accordance with the International Standards for the Professional Practice of Internal Auditing and the organization's internal audit charter.";
        const defaultObjective = "The objective of this audit was to evaluate the adequacy and effectiveness of internal controls, assess compliance with applicable policies and regulations, and identify opportunities for process improvements.";
        const defaultScope = "The scope of this audit covered the review of relevant documentation, interviews with key personnel, testing of controls, and analysis of processes for the period specified in this report.";
        const defaultRecommendations = "Based on our audit findings, we recommend that management implement the corrective actions identified in the detailed findings section above. These recommendations are designed to strengthen internal controls and improve operational efficiency.";
        const targetDate = new Date(data.engagement.actualEndDate || data.engagement.plannedEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const processName = data.engagement.process?.name || data.title;
        const defaultConclusion = `Based on the audit procedures performed and the evidence obtained, Internal Audit concludes that the system of internal control over ${processName} as of the audit period.\n\nThe control environment supports the integrity, accuracy, and reliability of the organization's financial data within the audited areas.\n\nAccordingly, this audit engagement is formally closed as of ${targetDate}.`;

        setEditForm({
          executiveSummary: data.executiveSummary || defaultExecutiveSummary,
          overallResultText: data.observations || defaultOverallResultText,
          background: data.methodology || defaultBackground,
          objective: data.objectives || data.engagement.engagementObjective || defaultObjective,
          scope: data.scope || data.engagement.engagementScope || defaultScope,
          recommendations: data.recommendations || defaultRecommendations,
          conclusion: data.conclusion || defaultConclusion,
          auditeeId: data.auditeeId || "",
        });
        setAuditeeComment(data.auditeeComment || "");
      } else {
        toast.error(t("Failed to fetch report"));
        router.push("/internal-audit/report");
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      toast.error(t("Failed to fetch report"));
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch only auditees under the current Audit Head
      const response = await fetch("/api/users/my-auditees");
      if (response.ok) {
        const data = await response.json();
        // my-auditees returns { auditees: [...], count: N }
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
      // Find selected auditee name
      const selectedUser = users.find((u) => u.id === editForm.auditeeId);
      const auditeeName = selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : "";

      // Map form fields to API fields
      const payload = {
        executiveSummary: editForm.executiveSummary,
        observations: editForm.overallResultText,
        methodology: editForm.background,
        objectives: editForm.objective,
        scope: editForm.scope,
        recommendations: editForm.recommendations,
        conclusion: editForm.conclusion,
        auditeeId: editForm.auditeeId,
        auditeeName,
      };

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
        toast.success(t("Auditee comment saved successfully"));
      } else {
        toast.error(t("Failed to save auditee comment"));
      }
    } catch (error) {
      console.error("Error saving auditee comment:", error);
      toast.error(t("Failed to save auditee comment"));
    } finally {
      setSavingAuditeeComment(false);
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
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t("Report not found")}</p>
      </div>
    );
  }

  const fieldworkPeriod = `${formatDate(report.engagement.actualStartDate || report.engagement.plannedStartDate)} to ${formatDate(report.engagement.actualEndDate || report.engagement.plannedEndDate)}`;
  const reportDate = formatDate(report.updatedAt);
  const distribution = "Audit Committee, CFO, Controller, IT Head";

  return (
    <div className="p-6 space-y-6">
      {/* Header with Back button and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/internal-audit/report" className="flex items-center gap-1 text-gray-600 hover:text-[#1e3a5f]">
            <ArrowLeft className="h-4 w-4" />
            {t("Back")}
          </Link>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">{t("Report")}</span>
          <span className="text-gray-400">|</span>
          <span className="text-[#1e3a5f] font-semibold">{t("Audit Report")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-[#1e3a5f] hover:bg-[#2e4a6f]"
            onClick={handleDownloadReport}
          >
            <Download className="h-4 w-4 mr-2" />
            {t("Download Report")}
          </Button>
          {(isAuditHead || isAuditManager) && (
            <>
              {!isEditing ? (
                <Button
                  className="bg-[#1e3a5f] hover:bg-[#2e4a6f]"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  {t("Edit")}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      // Static template defaults
                      const defaultExecutiveSummary = `This report presents the results of the internal audit conducted for ${report.title}. The audit was performed to assess the adequacy and effectiveness of internal controls, compliance with policies and procedures, and the efficiency of operations. Key findings and recommendations are detailed in the sections below.`;
                      const defaultOverallResultText = "Based on our audit procedures and findings, the overall audit result is {RESULT}. The controls tested during the audit period were found to be operating as designed, with appropriate documentation and oversight in place to manage identified risks effectively.";
                      const defaultBackground = "The internal audit function is an independent and objective assurance activity designed to add value and improve the organization's operations. This audit was conducted in accordance with the International Standards for the Professional Practice of Internal Auditing and the organization's internal audit charter.";
                      const defaultObjective = "The objective of this audit was to evaluate the adequacy and effectiveness of internal controls, assess compliance with applicable policies and regulations, and identify opportunities for process improvements.";
                      const defaultScope = "The scope of this audit covered the review of relevant documentation, interviews with key personnel, testing of controls, and analysis of processes for the period specified in this report.";
                      const defaultRecommendations = "Based on our audit findings, we recommend that management implement the corrective actions identified in the detailed findings section above. These recommendations are designed to strengthen internal controls and improve operational efficiency.";
                      const targetDate = new Date(report.engagement.actualEndDate || report.engagement.plannedEndDate || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      const processName = report.title;
                      const defaultConclusion = `Based on the audit procedures performed and the evidence obtained, Internal Audit concludes that the system of internal control over ${processName} as of the audit period.\n\nThe control environment supports the integrity, accuracy, and reliability of the organization's financial data within the audited areas.\n\nAccordingly, this audit engagement is formally closed as of ${targetDate}.`;

                      setEditForm({
                        executiveSummary: report.executiveSummary || defaultExecutiveSummary,
                        overallResultText: report.observations || defaultOverallResultText,
                        background: report.methodology || defaultBackground,
                        objective: report.objectives || report.engagement.engagementObjective || defaultObjective,
                        scope: report.scope || report.engagement.engagementScope || defaultScope,
                        recommendations: report.recommendations || defaultRecommendations,
                        conclusion: report.conclusion || defaultConclusion,
                        auditeeId: report.auditeeId || "",
                      });
                    }}
                  >
                    {t("Cancel")}
                  </Button>
                  <Button
                    className="bg-[#1e3a5f] hover:bg-[#2e4a6f]"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("Saving...")}
                      </>
                    ) : (
                      t("Save")
                    )}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white border rounded-lg p-8 space-y-6">
        {/* Report Title */}
        <h1 className="text-lg font-bold text-center uppercase">
          {t("REPORT ON INTERNAL AUDIT FOR THE PERIOD FROM")} {formatDate(report.engagement.actualStartDate || report.engagement.plannedStartDate)} {t("TO")} {formatDate(report.engagement.actualEndDate || report.engagement.plannedEndDate)}
        </h1>

        {/* Report Metadata */}
        <div className="space-y-2 text-sm">
          <div className="flex">
            <span className="font-semibold w-40">{t("Audit Title")}:</span>
            <span className="text-blue-600">{report.title}</span>
          </div>
          <div className="flex">
            <span className="font-semibold w-40">{t("Report Number")}:</span>
            <span className="text-blue-600">{report.reportCode}</span>
          </div>
          <div className="flex">
            <span className="font-semibold w-40">{t("Report Date")}:</span>
            <span className="text-blue-600">{reportDate}</span>
          </div>
          <div className="flex">
            <span className="font-semibold w-40">{t("Fieldwork Period")}:</span>
            <span className="text-blue-600">{fieldworkPeriod}</span>
          </div>
          <div className="flex">
            <span className="font-semibold w-40">{t("Assigned Auditor")}:</span>
            <span>
              {report.engagement.assignedAuditor
                ? `${report.engagement.assignedAuditor.firstName} ${report.engagement.assignedAuditor.lastName}`
                : ""}
            </span>
          </div>
          <div className="flex">
            <span className="font-semibold w-40">{t("Distribution")}:</span>
            <span className="text-blue-600">{distribution}</span>
          </div>
          <div className="flex items-center">
            <span className="font-semibold w-40">{t("Auditee")}:</span>
            {isEditing ? (
              <Select
                value={editForm.auditeeId}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, auditeeId: value }))}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={t("Select Auditee")} />
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
                  (report.engagement.auditee
                    ? `${report.engagement.auditee.firstName} ${report.engagement.auditee.lastName}`
                    : "")}
              </span>
            )}
          </div>
        </div>

        <hr className="border-gray-300" />

        {/* Executive Summary */}
        <div>
          <h2 className="font-bold text-base mb-2">{t("Executive Summary")}</h2>
          {isEditing ? (
            <Textarea
              value={editForm.executiveSummary}
              onChange={(e) => setEditForm((prev) => ({ ...prev, executiveSummary: e.target.value }))}
              rows={5}
              className="w-full"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {report.executiveSummary || `This report presents the results of the internal audit conducted for ${report.title}. The audit was performed to assess the adequacy and effectiveness of internal controls, compliance with policies and procedures, and the efficiency of operations. Key findings and recommendations are detailed in the sections below.`}
            </p>
          )}
        </div>

        <hr className="border-gray-300" />

        {/* Overall Result */}
        <div>
          <h2 className="font-bold text-base mb-2">{t("Overall Result")}</h2>
          {isEditing ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">{t("Use {RESULT} placeholder for dynamic Pass/Fail value")}</p>
              <Textarea
                value={editForm.overallResultText}
                onChange={(e) => setEditForm((prev) => ({ ...prev, overallResultText: e.target.value }))}
                rows={4}
                className="w-full"
              />
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {(report.observations || "Based on our audit procedures and findings, the overall audit result is {RESULT}. The controls tested during the audit period were found to be operating as designed, with appropriate documentation and oversight in place to manage identified risks effectively.")
                .replace(/{RESULT}/g, report.overallResult || "Pass")
                .split(report.overallResult || "Pass")
                .map((part, index, arr) => (
                  <span key={index}>
                    {part}
                    {index < arr.length - 1 && (
                      <span className={`font-semibold ${report.overallResult === "Pass" ? "text-green-700" : "text-red-700"}`}>
                        {report.overallResult || "Pass"}
                      </span>
                    )}
                  </span>
                ))}
            </p>
          )}
        </div>

        <hr className="border-gray-300" />

        {/* Background */}
        <div>
          <h2 className="font-bold text-base mb-2">{t("Background")}</h2>
          {isEditing ? (
            <Textarea
              value={editForm.background}
              onChange={(e) => setEditForm((prev) => ({ ...prev, background: e.target.value }))}
              rows={4}
              className="w-full"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {report.methodology || "The internal audit function is an independent and objective assurance activity designed to add value and improve the organization's operations. This audit was conducted in accordance with the International Standards for the Professional Practice of Internal Auditing and the organization's internal audit charter."}
            </p>
          )}
        </div>

        <hr className="border-gray-300" />

        {/* Objective */}
        <div>
          <h2 className="font-bold text-base mb-2">{t("Objective")}</h2>
          {isEditing ? (
            <Textarea
              value={editForm.objective}
              onChange={(e) => setEditForm((prev) => ({ ...prev, objective: e.target.value }))}
              rows={3}
              className="w-full"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {report.objectives || report.engagement.engagementObjective || "The objective of this audit was to evaluate the adequacy and effectiveness of internal controls, assess compliance with applicable policies and regulations, and identify opportunities for process improvements."}
            </p>
          )}
        </div>

        <hr className="border-gray-300" />

        {/* Scope */}
        <div>
          <h2 className="font-bold text-base mb-2">{t("Scope")}</h2>
          {isEditing ? (
            <Textarea
              value={editForm.scope}
              onChange={(e) => setEditForm((prev) => ({ ...prev, scope: e.target.value }))}
              rows={3}
              className="w-full"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {report.scope || report.engagement.engagementScope || "The scope of this audit covered the review of relevant documentation, interviews with key personnel, testing of controls, and analysis of processes for the period specified in this report."}
            </p>
          )}
        </div>

        <hr className="border-gray-300" />

        {/* Recommendations */}
        <div>
          <h2 className="font-bold text-base mb-2">{t("Recommendations")}</h2>
          {isEditing ? (
            <Textarea
              value={editForm.recommendations}
              onChange={(e) => setEditForm((prev) => ({ ...prev, recommendations: e.target.value }))}
              rows={4}
              className="w-full"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {report.recommendations || "Based on our audit findings, we recommend that management implement the corrective actions identified in the detailed findings section above. These recommendations are designed to strengthen internal controls and improve operational efficiency."}
            </p>
          )}
        </div>

        <hr className="border-gray-300" />

        {/* Conclusion */}
        <div>
          <h2 className="font-bold text-base mb-2">{t("Conclusion")}</h2>
          {isEditing ? (
            <Textarea
              value={editForm.conclusion}
              onChange={(e) => setEditForm((prev) => ({ ...prev, conclusion: e.target.value }))}
              rows={4}
              className="w-full"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {report.conclusion || "In conclusion, this audit has provided valuable insights into the current state of internal controls and compliance within the audited area. We appreciate the cooperation of all personnel involved in this audit and look forward to working with management to address the identified findings."}
            </p>
          )}
        </div>

        {/* Detail Findings */}
        <hr className="border-gray-300" />
        <div>
          <h2 className="font-bold text-base mb-4">{t("Detail Findings")}</h2>

          {/* Static template text - not editable, only Pass/Fail is dynamic */}
          <p className="text-sm mb-4">
            {t("The controls tested were found to be")}{" "}
            <span className={`font-semibold ${report.overallResult === "Pass" ? "text-green-700" : "text-red-700"}`}>
              {report.overallResult || "Pass"}
            </span>{t(", providing adequate assurance over financial reporting and operational integrity.")}
          </p>

          {/* Summary of Observation */}
          <h3 className="font-bold text-sm mb-3">{t("Summary of Observation")}</h3>
          <p className="text-sm mb-3">
            {t("The following table summarizes the observations identified during the audit, categorized by severity level.")}
          </p>

          {/* Summary Table */}
          <div className="border rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold border-b">{t("Severity")}</th>
                  <th className="px-4 py-2 text-left font-semibold border-b">{t("Findings")}</th>
                  <th className="px-4 py-2 text-left font-semibold border-b">{t("Recommendations")}</th>
                  <th className="px-4 py-2 text-left font-semibold border-b">{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {report.engagement.findings && report.engagement.findings.length > 0 ? (
                  report.engagement.findings.map((finding) => (
                    <tr key={finding.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          finding.severity === "Critical" ? "bg-red-100 text-red-700" :
                          finding.severity === "High" ? "bg-orange-100 text-orange-700" :
                          finding.severity === "Medium" ? "bg-yellow-100 text-yellow-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {finding.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2">{finding.finding}</td>
                      <td className="px-4 py-2">{finding.description || "-"}</td>
                      <td className="px-4 py-2">{finding.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-gray-500 italic">
                      {t("No observations recorded")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Total Findings */}
          <div className="text-sm font-semibold">
            {t("Total Findings")}: {report.engagement.findings?.length || 0}
          </div>
        </div>

        {/* Auditee Comment Section */}
        <hr className="border-gray-300" />
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-base">{t("Auditee Comment")}</h2>
            {isAuditee && !isAuditHead && !isAuditManager && !isEditingAuditeeComment && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditingAuditeeComment(true)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                {t("Edit")}
              </Button>
            )}
          </div>
          {isEditingAuditeeComment ? (
            <div className="space-y-2">
              <Textarea
                value={auditeeComment}
                onChange={(e) => setAuditeeComment(e.target.value)}
                rows={4}
                className="w-full"
                placeholder={t("Enter your comment...")}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-[#1e3a5f] hover:bg-[#2e4a6f]"
                  onClick={handleSaveAuditeeComment}
                  disabled={savingAuditeeComment}
                >
                  {savingAuditeeComment ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      {t("Saving...")}
                    </>
                  ) : (
                    t("Save")
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditingAuditeeComment(false);
                    setAuditeeComment(report.auditeeComment || "");
                  }}
                >
                  {t("Cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {report.auditeeComment || <span className="text-gray-400 italic">{t("No comment provided")}</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

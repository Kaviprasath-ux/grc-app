"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Download, Pencil } from "lucide-react";
import { useHasRole } from "@/hooks/usePermissions";

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
  managementResponse: string | null;
  conclusion: string | null;
  overallResult: string | null;
  auditeeComment: string | null;
  status: string;
  draftGeneratedAt: string | null;
  engagement: {
    id: string;
    auditId: string;
    engagementTitle: string;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
    actualStartDate: string | null;
    actualEndDate: string | null;
    department: { id: string; name: string } | null;
    assignedAuditor: { id: string; firstName: string; lastName: string } | null;
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AuditReportViewPage({ params }: PageProps) {
  const { id: engagementId } = use(params);
  const router = useRouter();
  const isAuditHead = useHasRole("AuditHead");
  const isAuditee = useHasRole("Auditee");

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AuditReportData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAuditeeComment, setIsEditingAuditeeComment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAuditeeComment, setSavingAuditeeComment] = useState(false);

  // Edit form state (for AuditHead)
  const [editForm, setEditForm] = useState({
    executiveSummary: "",
    observations: "",
    methodology: "",
    objectives: "",
    scope: "",
    recommendations: "",
    conclusion: "",
  });

  // Auditee comment state
  const [auditeeComment, setAuditeeComment] = useState("");

  useEffect(() => {
    fetchReport();
  }, [engagementId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/internal-audit/report/${engagementId}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data);
        setEditForm({
          executiveSummary: data.executiveSummary || "",
          observations: data.observations || "",
          methodology: data.methodology || "",
          objectives: data.objectives || "",
          scope: data.scope || "",
          recommendations: data.recommendations || "",
          conclusion: data.conclusion || "",
        });
        setAuditeeComment(data.auditeeComment || "");
      } else {
        toast.error("Failed to fetch report");
        router.push("/internal-audit/report");
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      toast.error("Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!report) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/internal-audit/report/${engagementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        const updatedReport = await response.json();
        setReport(updatedReport);
        setIsEditing(false);
        toast.success("Report saved successfully");
      } else {
        toast.error("Failed to save report");
      }
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error("Failed to save report");
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
        toast.success("Auditee comment saved successfully");
      } else {
        toast.error("Failed to save auditee comment");
      }
    } catch (error) {
      console.error("Error saving auditee comment:", error);
      toast.error("Failed to save auditee comment");
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
        toast.error("Failed to download report");
      }
    } catch (error) {
      console.error("Error downloading report:", error);
      toast.error("Failed to download report");
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
        <p className="text-gray-500">Report not found</p>
      </div>
    );
  }

  const fieldworkPeriod = `${formatDate(report.engagement.actualStartDate || report.engagement.plannedStartDate)} to ${formatDate(report.engagement.actualEndDate || report.engagement.plannedEndDate)}`;
  const reportDate = formatDate(report.draftGeneratedAt);
  const distribution = "Audit Committee, CFO, Controller, IT Head";

  return (
    <div className="p-6 space-y-6">
      {/* Header with Back button and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/internal-audit/report" className="flex items-center gap-1 text-gray-600 hover:text-[#1e3a5f]">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">Report</span>
          <span className="text-gray-400">|</span>
          <span className="text-[#1e3a5f] font-semibold">Audit Report</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-[#1e3a5f] hover:bg-[#2e4a6f]"
            onClick={handleDownloadReport}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
          {isAuditHead && (
            <>
              {!isEditing ? (
                <Button
                  className="bg-[#1e3a5f] hover:bg-[#2e4a6f]"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm({
                        executiveSummary: report.executiveSummary || "",
                        observations: report.observations || "",
                        methodology: report.methodology || "",
                        objectives: report.objectives || "",
                        scope: report.scope || "",
                        recommendations: report.recommendations || "",
                        conclusion: report.conclusion || "",
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-[#1e3a5f] hover:bg-[#2e4a6f]"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save"
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
          REPORT ON INTERNAL AUDIT FOR THE PERIOD FROM {formatDate(report.engagement.actualStartDate || report.engagement.plannedStartDate)} TO {formatDate(report.engagement.actualEndDate || report.engagement.plannedEndDate)}
        </h1>

        {/* Report Metadata */}
        <div className="space-y-2 text-sm">
          <div className="flex">
            <span className="font-semibold w-40">Audit Title:</span>
            <span className="text-blue-600">{report.title}</span>
          </div>
          <div className="flex">
            <span className="font-semibold w-40">Report Number:</span>
            <span className="text-blue-600">{report.reportCode}</span>
          </div>
          <div className="flex">
            <span className="font-semibold w-40">Report Date:</span>
            <span className="text-blue-600">{reportDate}</span>
          </div>
          <div className="flex">
            <span className="font-semibold w-40">Fieldwork Period:</span>
            <span className="text-blue-600">{fieldworkPeriod}</span>
          </div>
          <div className="flex">
            <span className="font-semibold w-40">Assigned Auditor:</span>
            <span>
              {report.engagement.assignedAuditor
                ? `${report.engagement.assignedAuditor.firstName} ${report.engagement.assignedAuditor.lastName}`
                : ""}
            </span>
          </div>
          <div className="flex">
            <span className="font-semibold w-40">Distribution:</span>
            <span className="text-blue-600">{distribution}</span>
          </div>
        </div>

        <hr className="border-gray-300" />

        {/* Executive Summary */}
        <div>
          <h2 className="font-bold text-base mb-2">Executive Summary</h2>
          {isEditing ? (
            <Textarea
              value={editForm.executiveSummary}
              onChange={(e) => setEditForm((prev) => ({ ...prev, executiveSummary: e.target.value }))}
              rows={6}
              className="w-full"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{report.executiveSummary}</p>
          )}
        </div>

        <hr className="border-gray-300" />

        {/* Overall Result */}
        <div>
          <h2 className="font-bold text-base mb-2">Overall Result</h2>
          {isEditing ? (
            <Textarea
              value={editForm.observations}
              onChange={(e) => setEditForm((prev) => ({ ...prev, observations: e.target.value }))}
              rows={4}
              className="w-full"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {report.observations?.replace("{Auditor's overall audit result}", report.overallResult || "Pass")}
            </p>
          )}
        </div>

        <hr className="border-gray-300" />

        {/* Background */}
        <div>
          <h2 className="font-bold text-base mb-2">Background</h2>
          {isEditing ? (
            <Textarea
              value={editForm.methodology}
              onChange={(e) => setEditForm((prev) => ({ ...prev, methodology: e.target.value }))}
              rows={4}
              className="w-full"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{report.methodology}</p>
          )}
        </div>

        <hr className="border-gray-300" />

        {/* Objective */}
        <div>
          <h2 className="font-bold text-base mb-2">Objective</h2>
          {isEditing ? (
            <Textarea
              value={editForm.objectives}
              onChange={(e) => setEditForm((prev) => ({ ...prev, objectives: e.target.value }))}
              rows={2}
              className="w-full"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{report.objectives}</p>
          )}
        </div>

        <hr className="border-gray-300" />

        {/* Scope */}
        <div>
          <h2 className="font-bold text-base mb-2">Scope</h2>
          {isEditing ? (
            <Textarea
              value={editForm.scope}
              onChange={(e) => setEditForm((prev) => ({ ...prev, scope: e.target.value }))}
              rows={2}
              className="w-full"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{report.scope}</p>
          )}
        </div>

        {/* Recommendations (if exists) */}
        {(report.recommendations || isEditing) && (
          <>
            <hr className="border-gray-300" />
            <div>
              <h2 className="font-bold text-base mb-2">Recommendations</h2>
              {isEditing ? (
                <Textarea
                  value={editForm.recommendations}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, recommendations: e.target.value }))}
                  rows={4}
                  className="w-full"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{report.recommendations}</p>
              )}
            </div>
          </>
        )}

        {/* Conclusion (if exists) */}
        {(report.conclusion || isEditing) && (
          <>
            <hr className="border-gray-300" />
            <div>
              <h2 className="font-bold text-base mb-2">Conclusion</h2>
              {isEditing ? (
                <Textarea
                  value={editForm.conclusion}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, conclusion: e.target.value }))}
                  rows={4}
                  className="w-full"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{report.conclusion}</p>
              )}
            </div>
          </>
        )}

        {/* Auditee Comment Section */}
        <hr className="border-gray-300" />
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-base">Auditee Comment</h2>
            {isAuditee && !isAuditHead && !isEditingAuditeeComment && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditingAuditeeComment(true)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
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
                placeholder="Enter your comment..."
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
                      Saving...
                    </>
                  ) : (
                    "Save"
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
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {report.auditeeComment || <span className="text-gray-400 italic">No comment provided</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

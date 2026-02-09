"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Home,
  Download,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { useHasRole, usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface CompletedEngagement {
  id: string;
  auditId: string;
  engagementTitle: string;
  departmentName: string;
  auditType: string;
  assignedAuditorName: string;
  status: string;
  hasReport: boolean;
  reportId: string | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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
  managementResponse: string | null;
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
    process?: { name: string } | null;
    findings: Finding[];
  };
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

export default function ReportsPage() {
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const isAuditHead = useHasRole("AuditHead");
  const isAuditManager = useHasRole("AuditManager");
  const isAuditor = useHasRole("Auditor");
  const isAuditee = useHasRole("Auditee");
  const isAuditTeam = isAuditHead || isAuditManager || isAuditor;
  const isAuditeeOnly = isAuditee && !isAuditTeam;

  // Engagements list state
  const [loading, setLoading] = useState(true);
  const [engagements, setEngagements] = useState<CompletedEngagement[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  // Generate Report Dialog
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedEngagement, setSelectedEngagement] = useState<CompletedEngagement | null>(null);
  const [overallResult, setOverallResult] = useState<string>("Pass");
  const [generating, setGenerating] = useState(false);

  // Report View/Edit Dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<AuditReportData | null>(null);
  const [currentEngagementId, setCurrentEngagementId] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAuditeeComment, setIsEditingAuditeeComment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAuditeeComment, setSavingAuditeeComment] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
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
  const [auditeeComment, setAuditeeComment] = useState("");

  useEffect(() => {
    fetchCompletedEngagements();
  }, [pagination.page]);

  const fetchCompletedEngagements = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", pagination.page.toString());
      params.append("limit", pagination.limit.toString());

      const response = await fetch(`/api/internal-audit/report/completed-engagements?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEngagements(data.engagements || []);
        setPagination(data.pagination || pagination);
      }
    } catch (error) {
      console.error("Failed to fetch completed engagements:", error);
      toast.error(t("Failed to fetch completed engagements"));
    } finally {
      setLoading(false);
    }
  };

  // --- Report Modal Functions ---

  const openReportModal = (engagementId: string) => {
    setCurrentEngagementId(engagementId);
    setReportDialogOpen(true);
    setIsEditing(false);
    setIsEditingAuditeeComment(false);
    fetchReport(engagementId);
    fetchUsers();
  };

  const closeReportModal = () => {
    setReportDialogOpen(false);
    setReport(null);
    setIsEditing(false);
    setIsEditingAuditeeComment(false);
    setCurrentEngagementId("");
  };

  const fetchReport = async (engagementId: string) => {
    setReportLoading(true);
    try {
      const response = await fetch(`/api/internal-audit/report/${engagementId}`);
      if (response.ok) {
        const data = await response.json();
        setReport(data);
        initEditForm(data);
        setAuditeeComment(data.auditeeComment || "");
      } else {
        toast.error(t("Failed to fetch report"));
        closeReportModal();
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      toast.error(t("Failed to fetch report"));
    } finally {
      setReportLoading(false);
    }
  };

  const initEditForm = (data: AuditReportData) => {
    const defaultExecutiveSummary = `This report presents the results of the internal audit conducted for ${data.title}. The audit was performed to assess the adequacy and effectiveness of internal controls, compliance with policies and procedures, and the efficiency of operations. Key findings and recommendations are detailed in the sections below.`;
    const defaultOverallResultText = "Based on our audit procedures and findings, the overall audit result is {RESULT}. The controls tested during the audit period were found to be operating as designed, with appropriate documentation and oversight in place to manage identified risks effectively.";
    const defaultBackground = "The internal audit function is an independent and objective assurance activity designed to add value and improve the organization's operations. This audit was conducted in accordance with the International Standards for the Professional Practice of Internal Auditing and the organization's internal audit charter.";
    const defaultObjective = "The objective of this audit was to evaluate the adequacy and effectiveness of internal controls, assess compliance with applicable policies and regulations, and identify opportunities for process improvements.";
    const defaultScope = "The scope of this audit covered the review of relevant documentation, interviews with key personnel, testing of controls, and analysis of processes for the period specified in this report.";
    const defaultRecommendations = "Based on our audit findings, we recommend that management implement the corrective actions identified in the detailed findings section above. These recommendations are designed to strengthen internal controls and improve operational efficiency.";
    const targetDate = new Date(data.engagement.actualEndDate || data.engagement.plannedEndDate || "").toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

  const handleSaveReport = async () => {
    if (!report) return;

    setSaving(true);
    try {
      const selectedUser = users.find((u) => u.id === editForm.auditeeId);
      const auditeeName = selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : "";

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

      const response = await fetch(`/api/internal-audit/report/${currentEngagementId}`, {
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
      const response = await fetch(`/api/internal-audit/report/${currentEngagementId}`, {
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
      const response = await fetch(`/api/internal-audit/report/${currentEngagementId}/download`);
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

  const handleCancelEdit = () => {
    if (report) {
      setIsEditing(false);
      initEditForm(report);
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

  // --- Engagements List Functions ---

  const handleGenerateReport = (engagement: CompletedEngagement) => {
    if (engagement.hasReport) {
      openReportModal(engagement.id);
    } else if (!isAuditeeOnly) {
      setSelectedEngagement(engagement);
      setOverallResult("Pass");
      setGenerateDialogOpen(true);
    }
  };

  const handleConfirmGenerate = async () => {
    if (!selectedEngagement) return;

    setGenerating(true);
    try {
      const response = await fetch(`/api/internal-audit/report/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementId: selectedEngagement.id,
          overallResult: overallResult,
        }),
      });

      if (response.ok) {
        toast.success(t("Report generated successfully"));
        setGenerateDialogOpen(false);
        // Refresh list to show hasReport = true, then open the modal
        await fetchCompletedEngagements();
        openReportModal(selectedEngagement.id);
      } else {
        const error = await response.json();
        toast.error(error.error || t("Failed to generate report"));
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error(t("Failed to generate report"));
    } finally {
      setGenerating(false);
    }
  };

  const startIndex = (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </>
        )}
        <span className="text-primary-700 font-medium">{t("Reports")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Reports")}</h1>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Engagement")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Department")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Audit Type")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Assigned Auditor")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-slate-500">
                  {t("Loading completed engagements...")}
                </TableCell>
              </TableRow>
            ) : engagements.length > 0 ? (
              engagements.map((engagement) => (
                <TableRow key={engagement.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 pl-5 text-sm font-medium text-slate-800 max-w-[200px]">
                    <span className="line-clamp-2">{engagement.engagementTitle}</span>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.departmentName}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.auditType}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.assignedAuditorName}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.status}</TableCell>
                  <TableCell className="py-3 pr-5">
                    {isAuditeeOnly ? (
                      engagement.hasReport ? (
                        <span
                          className="text-sm text-primary-600 hover:text-primary-700 cursor-pointer "
                          onClick={() => openReportModal(engagement.id)}
                        >
                          {t("View Report")}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">{t("No report")}</span>
                      )
                    ) : (
                      <span
                        className="text-sm text-primary-600 hover:text-primary-700 cursor-pointer "
                        onClick={() => handleGenerateReport(engagement)}
                      >
                        {engagement.hasReport ? t("View Report") : t("Generate Draft Report")}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-slate-500">
                  {t("No completed engagements found")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              {startIndex} {t("to")} {endIndex} {t("of")} {pagination.total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={pagination.page === 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: 1 }))}
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={pagination.page === 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: pagination.totalPages }))}
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Generate Report Dialog - Pass/Fail Selection */}
      {(isAuditHead || isAuditManager) && (
        <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
          <DialogContent className="sm:max-w-[450px] p-0 gap-0">
            {/* Fixed Header */}
            <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-800">{t("Generate Audit Report")}</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Select the overall audit result for")} &quot;{selectedEngagement?.engagementTitle}&quot;
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <Label className="text-sm font-medium text-slate-700 mb-3 block">{t("Overall Audit Result")}</Label>
              <RadioGroup
                value={overallResult}
                onValueChange={setOverallResult}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Pass" id="result-pass" />
                  <Label htmlFor="result-pass" className="font-normal cursor-pointer text-green-600">
                    {t("Pass")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Fail" id="result-fail" />
                  <Label htmlFor="result-fail" className="font-normal cursor-pointer text-red-600">
                    {t("Fail")}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Fixed Footer */}
            <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => setGenerateDialogOpen(false)}
              >
                {t("Cancel")}
              </Button>
              <Button
                className="bg-primary-600 hover:bg-primary-700"
                onClick={handleConfirmGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t("Generating...")}
                  </>
                ) : (
                  t("Generate Report")
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Report View/Edit Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={(open) => { if (!open) closeReportModal(); }}>
        <DialogContent className="sm:max-w-[900px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {report ? report.title : t("Audit Report")}
              </DialogTitle>
              {report && (
                <p className="text-sm text-slate-500 mt-0.5">{report.reportCode}</p>
              )}
            </DialogHeader>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {reportLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-sm text-slate-500">{t("Loading report...")}</div>
              </div>
            ) : report ? (
              <div className="space-y-6">
                {/* Report Title */}
                <h2 className="text-base font-bold text-center uppercase text-slate-800">
                  {t("REPORT ON INTERNAL AUDIT FOR THE PERIOD FROM")} {formatDate(report.engagement.actualStartDate || report.engagement.plannedStartDate)} {t("TO")} {formatDate(report.engagement.actualEndDate || report.engagement.plannedEndDate)}
                </h2>

                {/* Report Metadata */}
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="font-semibold w-40 text-slate-700">{t("Audit Title")}:</span>
                    <span className="text-primary-600">{report.title}</span>
                  </div>
                  <div className="flex">
                    <span className="font-semibold w-40 text-slate-700">{t("Report Number")}:</span>
                    <span className="text-primary-600">{report.reportCode}</span>
                  </div>
                  <div className="flex">
                    <span className="font-semibold w-40 text-slate-700">{t("Report Date")}:</span>
                    <span className="text-primary-600">{formatDate(report.updatedAt)}</span>
                  </div>
                  <div className="flex">
                    <span className="font-semibold w-40 text-slate-700">{t("Fieldwork Period")}:</span>
                    <span className="text-primary-600">
                      {formatDate(report.engagement.actualStartDate || report.engagement.plannedStartDate)} {t("to")} {formatDate(report.engagement.actualEndDate || report.engagement.plannedEndDate)}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="font-semibold w-40 text-slate-700">{t("Assigned Auditor")}:</span>
                    <span className="text-slate-700">
                      {report.engagement.assignedAuditor
                        ? `${report.engagement.assignedAuditor.firstName} ${report.engagement.assignedAuditor.lastName}`
                        : ""}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="font-semibold w-40 text-slate-700">{t("Distribution")}:</span>
                    <span className="text-primary-600">Audit Committee, CFO, Controller, IT Head</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-semibold w-40 text-slate-700">{t("Auditee")}:</span>
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
                      <span className="text-primary-600">
                        {report.auditeeName ||
                          (report.engagement.auditee
                            ? `${report.engagement.auditee.firstName} ${report.engagement.auditee.lastName}`
                            : "")}
                      </span>
                    )}
                  </div>
                </div>

                <hr className="border-slate-200" />

                {/* Executive Summary */}
                <div>
                  <h3 className="font-bold text-sm text-slate-800 mb-2">{t("Executive Summary")}</h3>
                  {isEditing ? (
                    <Textarea
                      value={editForm.executiveSummary}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, executiveSummary: e.target.value }))}
                      rows={5}
                      className="w-full"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {report.executiveSummary || `This report presents the results of the internal audit conducted for ${report.title}. The audit was performed to assess the adequacy and effectiveness of internal controls, compliance with policies and procedures, and the efficiency of operations. Key findings and recommendations are detailed in the sections below.`}
                    </p>
                  )}
                </div>

                <hr className="border-slate-200" />

                {/* Overall Result */}
                <div>
                  <h3 className="font-bold text-sm text-slate-800 mb-2">{t("Overall Result")}</h3>
                  {isEditing ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">{t("Use {RESULT} placeholder for dynamic Pass/Fail value")}</p>
                      <Textarea
                        value={editForm.overallResultText}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, overallResultText: e.target.value }))}
                        rows={4}
                        className="w-full"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
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

                <hr className="border-slate-200" />

                {/* Background */}
                <div>
                  <h3 className="font-bold text-sm text-slate-800 mb-2">{t("Background")}</h3>
                  {isEditing ? (
                    <Textarea
                      value={editForm.background}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, background: e.target.value }))}
                      rows={4}
                      className="w-full"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {report.methodology || "The internal audit function is an independent and objective assurance activity designed to add value and improve the organization's operations. This audit was conducted in accordance with the International Standards for the Professional Practice of Internal Auditing and the organization's internal audit charter."}
                    </p>
                  )}
                </div>

                <hr className="border-slate-200" />

                {/* Objective */}
                <div>
                  <h3 className="font-bold text-sm text-slate-800 mb-2">{t("Objective")}</h3>
                  {isEditing ? (
                    <Textarea
                      value={editForm.objective}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, objective: e.target.value }))}
                      rows={3}
                      className="w-full"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {report.objectives || report.engagement.engagementObjective || "The objective of this audit was to evaluate the adequacy and effectiveness of internal controls, assess compliance with applicable policies and regulations, and identify opportunities for process improvements."}
                    </p>
                  )}
                </div>

                <hr className="border-slate-200" />

                {/* Scope */}
                <div>
                  <h3 className="font-bold text-sm text-slate-800 mb-2">{t("Scope")}</h3>
                  {isEditing ? (
                    <Textarea
                      value={editForm.scope}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, scope: e.target.value }))}
                      rows={3}
                      className="w-full"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {report.scope || report.engagement.engagementScope || "The scope of this audit covered the review of relevant documentation, interviews with key personnel, testing of controls, and analysis of processes for the period specified in this report."}
                    </p>
                  )}
                </div>

                <hr className="border-slate-200" />

                {/* Recommendations */}
                <div>
                  <h3 className="font-bold text-sm text-slate-800 mb-2">{t("Recommendations")}</h3>
                  {isEditing ? (
                    <Textarea
                      value={editForm.recommendations}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, recommendations: e.target.value }))}
                      rows={4}
                      className="w-full"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {report.recommendations || "Based on our audit findings, we recommend that management implement the corrective actions identified in the detailed findings section above. These recommendations are designed to strengthen internal controls and improve operational efficiency."}
                    </p>
                  )}
                </div>

                <hr className="border-slate-200" />

                {/* Conclusion */}
                <div>
                  <h3 className="font-bold text-sm text-slate-800 mb-2">{t("Conclusion")}</h3>
                  {isEditing ? (
                    <Textarea
                      value={editForm.conclusion}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, conclusion: e.target.value }))}
                      rows={4}
                      className="w-full"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {report.conclusion || "In conclusion, this audit has provided valuable insights into the current state of internal controls and compliance within the audited area. We appreciate the cooperation of all personnel involved in this audit and look forward to working with management to address the identified findings."}
                    </p>
                  )}
                </div>

                {/* Detail Findings */}
                <hr className="border-slate-200" />
                <div>
                  <h3 className="font-bold text-sm text-slate-800 mb-3">{t("Detail Findings")}</h3>

                  <p className="text-sm text-slate-700 mb-4">
                    {t("The controls tested were found to be")}{" "}
                    <span className={`font-semibold ${report.overallResult === "Pass" ? "text-green-700" : "text-red-700"}`}>
                      {report.overallResult || "Pass"}
                    </span>{t(", providing adequate assurance over financial reporting and operational integrity.")}
                  </p>

                  <h4 className="font-bold text-sm text-slate-700 mb-2">{t("Summary of Observation")}</h4>
                  <p className="text-sm text-slate-700 mb-3">
                    {t("The following table summarizes the observations identified during the audit, categorized by severity level.")}
                  </p>

                  {/* Summary Table */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">{t("Severity")}</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">{t("Findings")}</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">{t("Recommendations")}</th>
                          <th className="px-4 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">{t("Status")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.engagement.findings && report.engagement.findings.length > 0 ? (
                          report.engagement.findings.map((finding) => (
                            <tr key={finding.id} className="border-b border-slate-100 last:border-b-0">
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
                              <td className="px-4 py-2 text-slate-700">{finding.finding}</td>
                              <td className="px-4 py-2 text-slate-700">{finding.description || "-"}</td>
                              <td className="px-4 py-2 text-slate-700">{finding.status}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-4 text-center text-slate-400 italic">
                              {t("No observations recorded")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-sm font-semibold text-slate-700">
                    {t("Total Findings")}: {report.engagement.findings?.length || 0}
                  </div>
                </div>

                {/* Auditee Comment Section */}
                <hr className="border-slate-200" />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm text-slate-800">{t("Auditee Comment")}</h3>
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
                          className="bg-primary-600 hover:bg-primary-700"
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
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {report.auditeeComment || <span className="text-slate-400 italic">{t("No comment provided")}</span>}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48">
                <p className="text-sm text-slate-500">{t("Report not found")}</p>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end items-center gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
            {report && (
              <Button
                variant="outline"
                onClick={handleDownloadReport}
              >
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Download")}
              </Button>
            )}
            {report && (isAuditHead || isAuditManager) && (
              <>
                {!isEditing ? (
                  <Button
                    className="bg-primary-600 hover:bg-primary-700"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Edit")}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                    >
                      {t("Cancel")}
                    </Button>
                    <Button
                      className="bg-primary-600 hover:bg-primary-700"
                      onClick={handleSaveReport}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
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
        </DialogContent>
      </Dialog>
    </div>
  );
}

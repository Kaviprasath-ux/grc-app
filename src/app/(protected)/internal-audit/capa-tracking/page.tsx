"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Loader2,
  Trash2,
  Eye,
  Pencil,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Bot,
  ChevronRight,
  Home,
  Search,
} from "lucide-react";
import { Pagination as PaginationUI } from "@/components/ui/pagination";
import Link from "next/link";
import { useHasRole, usePermissions } from "@/hooks/usePermissions";
import { DatePicker } from "@/components/ui/date-picker";
import { useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface FindingAttachment {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  uploadedBy: string | null;
  uploadedAt: string;
}

interface Finding {
  id: string;
  findingId: string;
  finding: string;
  description: string | null;
  severity: string;
  auditPlan: string;
  engagementId: string;
  departmentId: string | null;
  departmentName: string;
  responsiblePerson: string;
  targetDate: string | null;
  status: string;
  identifiedDate: string;
  closedDate: string | null;
  createdAt: string;
  // Additional fields for Edit CAPA
  criteria: string | null;
  condition: string | null;
  cause: string | null;
  effect: string | null;
  recommendation: string | null;
  auditeeComment: string | null;
  attachments?: FindingAttachment[];
  // AI Review fields
  aiReviewStatus: string | null;
  aiReviewDescription: string | null;
  aiReviewedAt: string | null;
  aiReviewApproved: boolean;
  aiApprovedAt: string | null;
  aiApprovedBy: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface AuditEngagement {
  id: string;
  engagementTitle: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function CAPATrackingPage() {
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const isAuditHead = useHasRole("AuditHead");
  const isAuditManager = useHasRole("AuditManager");
  const isAuditor = useHasRole("Auditor");
  const isAuditee = useHasRole("Auditee");
  const isAuditTeam = isAuditHead || isAuditManager || isAuditor;
  const isAuditeeOnly = isAuditee && !isAuditTeam;

  // Show actions column for audit team (full actions) or auditee (edit only)
  const showActions = isAuditHead || isAuditeeOnly;

  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  // Filters
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [engagementStatusFilter, setEngagementStatusFilter] = useState<string>("Completed");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [findingToDelete, setFindingToDelete] = useState<Finding | null>(null);
  const [deleting, setDeleting] = useState(false);

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [findingToView, setFindingToView] = useState<Finding | null>(null);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [findingToEdit, setFindingToEdit] = useState<Finding | null>(null);
  const [editForm, setEditForm] = useState({
    engagementId: "",
    finding: "",
    severity: "",
    criteria: "",
    condition: "",
    cause: "",
    effect: "",
    recommendation: "",
    status: "",
    targetDate: "",
    auditeeComment: "",
  });
  const [saving, setSaving] = useState(false);
  const [auditEngagements, setAuditEngagements] = useState<AuditEngagement[]>([]);

  // File upload for Edit CAPA
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<FindingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // AI Review state
  const [aiReviewing, setAiReviewing] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchAuditEngagements();
  }, []);

  useEffect(() => {
    fetchFindings();
  }, [selectedDepartment, engagementStatusFilter, searchQuery, pagination.page]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchAuditEngagements = async () => {
    try {
      const response = await fetch("/api/internal-audit/engagements");
      if (response.ok) {
        const data = await response.json();
        setAuditEngagements(Array.isArray(data) ? data : data.engagements || []);
      }
    } catch (error) {
      console.error("Failed to fetch audit engagements:", error);
    }
  };

  const fetchFindings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDepartment) {
        params.append("departmentId", selectedDepartment);
      }
      if (engagementStatusFilter) {
        params.append("engagementStatus", engagementStatusFilter);
      }
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      params.append("page", pagination.page.toString());
      params.append("limit", pagination.limit.toString());

      const response = await fetch(`/api/internal-audit/capa-tracking?${params}`);
      if (response.ok) {
        const data = await response.json();
        setFindings(data.findings || []);
        setPagination(data.pagination || pagination);
      }
    } catch (error) {
      console.error("Failed to fetch findings:", error);
      toast.error(t("Failed to fetch CAPA tracking data"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFinding = async () => {
    if (!findingToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/internal-audit/capa-tracking/${findingToDelete.id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        toast.success(t("Finding deleted successfully"));
        setDeleteDialogOpen(false);
        setFindingToDelete(null);
        fetchFindings();
      } else {
        toast.error(t("Failed to delete finding"));
      }
    } catch (error) {
      console.error("Error deleting finding:", error);
      toast.error(t("Failed to delete finding"));
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenEdit = (finding: Finding) => {
    // Debug logging for AI review
    console.log('[CAPA-Edit] Opening finding:', finding.findingId);
    console.log('[CAPA-Edit] isAuditHead:', isAuditHead);
    console.log('[CAPA-Edit] AI Review Status:', finding.aiReviewStatus);
    console.log('[CAPA-Edit] AI Review Description:', finding.aiReviewDescription);
    console.log('[CAPA-Edit] AI Review Approved:', finding.aiReviewApproved);

    setFindingToEdit(finding);
    setEditForm({
      engagementId: finding.engagementId,
      finding: finding.finding,
      severity: finding.severity,
      criteria: finding.criteria || "",
      condition: finding.condition || "",
      cause: finding.cause || "",
      effect: finding.effect || "",
      recommendation: finding.recommendation || "",
      status: finding.status,
      targetDate: finding.targetDate ? finding.targetDate.split("T")[0] : "",
      auditeeComment: finding.auditeeComment || "",
    });
    setUploadedFiles([]);
    setExistingAttachments(finding.attachments || []);
    setEditDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setUploadedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleUploadFiles = async (findingId: string): Promise<boolean> => {
    if (uploadedFiles.length === 0) return true;

    setUploading(true);
    try {
      const formData = new FormData();
      uploadedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(
        `/api/internal-audit/findings/${findingId}/attachments`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        const newAttachments = data.files || data;
        setExistingAttachments((prev) => [...(Array.isArray(newAttachments) ? newAttachments : []), ...prev]);
        setUploadedFiles([]);
        return true;
      } else {
        toast.error(t("Failed to upload files"));
        return false;
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error(t("Failed to upload files"));
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!findingToEdit) return;

    try {
      const response = await fetch(
        `/api/internal-audit/findings/${findingToEdit.id}/attachments?attachmentId=${attachmentId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setExistingAttachments((prev) =>
          prev.filter((att) => att.id !== attachmentId)
        );
        toast.success(t("Attachment deleted"));
      } else {
        toast.error(t("Failed to delete attachment"));
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error(t("Failed to delete attachment"));
    }
  };

  const handleSaveEdit = async () => {
    if (!findingToEdit) return;

    setSaving(true);
    try {
      // First, upload any new files
      if (uploadedFiles.length > 0) {
        const uploadSuccess = await handleUploadFiles(findingToEdit.id);
        if (!uploadSuccess) {
          setSaving(false);
          return;
        }
      }

      // For auditee, only send auditeeComment and isAuditeeSubmission flag
      const payload = isAuditeeOnly
        ? {
            auditeeComment: editForm.auditeeComment,
            isAuditeeSubmission: true, // This will set status to "Under Review"
          }
        : editForm;

      const response = await fetch(
        `/api/internal-audit/capa-tracking/${findingToEdit.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        // For auditee submission, trigger AI review
        if (isAuditeeOnly) {
          setAiReviewing(true);
          try {
            const aiReviewResponse = await fetch(
              `/api/internal-audit/capa-tracking/${findingToEdit.id}/ai-review`,
              { method: "POST" }
            );

            if (aiReviewResponse.ok) {
              toast.success(t("Documents submitted for Audit Head review"));
            } else {
              // AI review failed, but save was successful
              toast.success(t("CAPA submitted (AI review pending)"));
            }
          } catch (aiError) {
            console.error("AI review error:", aiError);
            toast.success(t("CAPA submitted (AI review pending)"));
          } finally {
            setAiReviewing(false);
          }
        } else {
          toast.success(t("Finding updated successfully"));
        }

        setEditDialogOpen(false);
        setFindingToEdit(null);
        fetchFindings();
      } else {
        toast.error(t("Failed to update finding"));
      }
    } catch (error) {
      console.error("Error updating finding:", error);
      toast.error(t("Failed to update finding"));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      high: "bg-red-100 text-red-700",
      critical: "bg-red-100 text-red-700",
      medium: "bg-amber-100 text-amber-700",
      low: "bg-green-100 text-green-700",
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[severity.toLowerCase()] || "bg-slate-100 text-slate-600"}`}>
        {severity}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: "bg-blue-100 text-blue-700",
      closed: "bg-green-100 text-green-700",
      "in progress": "bg-amber-100 text-amber-700",
      "under review": "bg-purple-100 text-purple-700",
      overdue: "bg-red-100 text-red-700",
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${styles[status.toLowerCase()] || "bg-slate-100 text-slate-600"}`}>
        {status}
      </span>
    );
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
        <span className="text-primary-700 font-medium">{t("CAPA Tracking")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">
          {t("Corrective & Preventive Actions (CAPA)")}
        </h1>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t("Search by Finding ID, Finding, Responsible...")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="pl-10 w-[300px] h-9 bg-slate-50 border-slate-200"
            />
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Select
              value={engagementStatusFilter}
              onValueChange={(value) => {
                setEngagementStatusFilter(value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-[180px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Engagement Status")} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="Completed">{t("Completed")}</SelectItem>
                <SelectItem value="In Progress">{t("In Progress")}</SelectItem>
                <SelectItem value="Planned">{t("Planned")}</SelectItem>
                <SelectItem value="All">{t("All Status")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={selectedDepartment}
              onValueChange={(value) => {
                setSelectedDepartment(value === "all" ? "" : value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-[200px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("All Departments")} />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">{t("All Departments")}</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap pl-5 min-w-[100px]">{t("Findings ID")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 min-w-[200px]">{t("Finding")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[90px]">{t("Severity")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 min-w-[180px]">{t("Audit Plan")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[120px]">{t("Department")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[130px]">{t("Responsible")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[100px]">{t("Target Date")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[100px]">{t("Status")}</TableHead>
              {showActions && (
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap pr-5 min-w-[90px]">{t("Actions")}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showActions ? 9 : 8} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <div className="relative h-6 w-6">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : findings.length > 0 ? (
              findings.map((finding) => (
                <TableRow key={finding.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 pl-5 text-sm font-medium text-slate-900 whitespace-nowrap">{finding.findingId}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 max-w-[250px]">
                    <span className="line-clamp-2">{finding.finding}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    {getSeverityBadge(finding.severity)}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 max-w-[200px]">
                    <span className="line-clamp-2">{finding.auditPlan}</span>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{finding.departmentName}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{finding.responsiblePerson}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{formatDate(finding.targetDate)}</TableCell>
                  <TableCell className="py-3">
                    {getStatusBadge(finding.status)}
                  </TableCell>
                  {showActions && (
                    <TableCell className="py-3 pr-5">
                      <div className="flex items-center gap-0.5">
                        {finding.status.toLowerCase() === "closed" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600"
                            title={t("View")}
                            onClick={() => {
                              setFindingToView(finding);
                              setViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-slate-600"
                              title={t("Edit")}
                              onClick={() => handleOpenEdit(finding)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {/* Delete only for Audit Head, not Auditee */}
                            {isAuditHead && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                                title={t("Delete")}
                                onClick={() => {
                                  setFindingToDelete(finding);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={showActions ? 9 : 8} className="h-24 text-center text-sm text-slate-500">
                  {t("No findings found")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        <PaginationUI
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Finding")}</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-1">
                {t("Are you sure you want to delete finding")} &quot;{findingToDelete?.findingId}&quot;? {t("This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setFindingToDelete(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFinding}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog (for Closed findings) */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("View CAPA")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {/* Audit Plan */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Audit plan")}</Label>
              <Input value={findingToView?.auditPlan || ""} readOnly className="bg-slate-50" />
            </div>

            {/* Finding Title */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Finding title")}</Label>
              <Input value={findingToView?.finding || ""} readOnly className="bg-slate-50" />
            </div>

            {/* Severity */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Severity")}</Label>
              <RadioGroup value={findingToView?.severity || ""} className="flex gap-6" disabled>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Low" id="view-severity-low" disabled />
                  <Label htmlFor="view-severity-low" className="font-normal">{t("Low")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Medium" id="view-severity-medium" disabled />
                  <Label htmlFor="view-severity-medium" className="font-normal">{t("Medium")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="High" id="view-severity-high" disabled />
                  <Label htmlFor="view-severity-high" className="font-normal">{t("High")}</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Criteria */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Criteria")}</Label>
              <Input value={findingToView?.criteria || ""} readOnly className="bg-slate-50" />
            </div>

            {/* Condition */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Condition")}</Label>
              <Input value={findingToView?.condition || ""} readOnly className="bg-slate-50" />
            </div>

            {/* Cause */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Cause")}</Label>
              <Input value={findingToView?.cause || ""} readOnly className="bg-slate-50" />
            </div>

            {/* Effect */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Effect")}</Label>
              <Input value={findingToView?.effect || ""} readOnly className="bg-slate-50" />
            </div>

            {/* Recommendation */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Recommendation")}</Label>
              <Input value={findingToView?.recommendation || ""} readOnly className="bg-slate-50" />
            </div>

            {/* Status */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Status")}</Label>
              <RadioGroup value={findingToView?.status || ""} className="flex gap-6" disabled>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Open" id="view-status-open" disabled />
                  <Label htmlFor="view-status-open" className="font-normal">{t("Open")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Closed" id="view-status-closed" disabled />
                  <Label htmlFor="view-status-closed" className="font-normal">{t("Closed")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Under Review" id="view-status-review" disabled />
                  <Label htmlFor="view-status-review" className="font-normal">{t("Under Review")}</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Target Date */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Target date")}</Label>
              <Input
                value={findingToView?.targetDate ? formatDate(findingToView.targetDate) : ""}
                readOnly
                className="bg-slate-50"
              />
            </div>

            {/* Auditee Comment */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-slate-800 font-medium pt-2">{t("Auditee Comment")}</Label>
              <Textarea
                value={findingToView?.auditeeComment || ""}
                readOnly
                className="bg-slate-50"
                rows={3}
              />
            </div>

            {/* AI Review Section (visible when approved for Auditee, always for Audit Team) */}
            {findingToView?.aiReviewStatus && (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-slate-800">{t("AI Review Result")}</h3>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <Label className="text-slate-800 font-medium">{t("Status")}</Label>
                  <div className="flex items-center gap-2">
                    {findingToView.aiReviewStatus === "Satisfactory" ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-green-600 font-medium">{t("Satisfactory")}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="text-red-600 font-medium">{t("Unsatisfactory")}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-start gap-4 mt-3">
                  <Label className="text-slate-800 font-medium pt-2">{t("Description")}</Label>
                  <Textarea
                    value={findingToView.aiReviewDescription || ""}
                    readOnly
                    className="bg-slate-50"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setViewDialogOpen(false);
                setFindingToView(null);
              }}
            >
              {t("Close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit CAPA")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {/* Audit Plan */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Audit plan")}</Label>
              <Select
                value={editForm.engagementId}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, engagementId: value }))
                }
                disabled={isAuditeeOnly}
              >
                <SelectTrigger className={isAuditeeOnly ? "bg-slate-50" : "bg-white"}>
                  <SelectValue placeholder={t("Select audit plan")} />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {auditEngagements.map((engagement) => (
                    <SelectItem key={engagement.id} value={engagement.id}>
                      {engagement.engagementTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Finding Title */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Finding title")}</Label>
              <Input
                value={editForm.finding}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, finding: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-slate-50" : "bg-white"}
              />
            </div>

            {/* Severity */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Severity")}</Label>
              <RadioGroup
                value={editForm.severity}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, severity: value }))
                }
                className="flex gap-6"
                disabled={isAuditeeOnly}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Low" id="severity-low" disabled={isAuditeeOnly} />
                  <Label htmlFor="severity-low" className="font-normal cursor-pointer">{t("Low")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Medium" id="severity-medium" disabled={isAuditeeOnly} />
                  <Label htmlFor="severity-medium" className="font-normal cursor-pointer">{t("Medium")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="High" id="severity-high" disabled={isAuditeeOnly} />
                  <Label htmlFor="severity-high" className="font-normal cursor-pointer">{t("High")}</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Criteria */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Criteria")}</Label>
              <Input
                value={editForm.criteria}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, criteria: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-slate-50" : "bg-white"}
              />
            </div>

            {/* Condition */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Condition")}</Label>
              <Input
                value={editForm.condition}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, condition: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-slate-50" : "bg-white"}
              />
            </div>

            {/* Cause */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Cause")}</Label>
              <Input
                value={editForm.cause}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, cause: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-slate-50" : "bg-white"}
              />
            </div>

            {/* Effect */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Effect")}</Label>
              <Input
                value={editForm.effect}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, effect: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-slate-50" : "bg-white"}
              />
            </div>

            {/* Recommendation */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Recommendation")}</Label>
              <Input
                value={editForm.recommendation}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, recommendation: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-slate-50" : "bg-white"}
              />
            </div>

            {/* Status */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Status")}</Label>
              <RadioGroup
                value={editForm.status}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, status: value }))
                }
                className="flex gap-6"
                disabled={isAuditeeOnly}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Open" id="status-open" disabled={isAuditeeOnly} />
                  <Label htmlFor="status-open" className="font-normal cursor-pointer">{t("Open")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Closed" id="status-closed" disabled={isAuditeeOnly} />
                  <Label htmlFor="status-closed" className="font-normal cursor-pointer">{t("Closed")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Under Review" id="status-review" disabled={isAuditeeOnly} />
                  <Label htmlFor="status-review" className="font-normal cursor-pointer">{t("Under Review")}</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Target Date */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-slate-800 font-medium">{t("Target date")}</Label>
              <DatePicker
                value={editForm.targetDate}
                onChange={(date) =>
                  setEditForm((prev) => ({ ...prev, targetDate: date ? date.toISOString().split('T')[0] : "" }))
                }
                disabled={isAuditeeOnly}
                placeholder={t("Select date")}
              />
            </div>

            {/* Auditee's comments - EDITABLE for auditee */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-slate-800 font-medium pt-2">{t("Auditee")}<br/>{t("Comment")}</Label>
              <Textarea
                value={editForm.auditeeComment}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, auditeeComment: e.target.value }))
                }
                rows={3}
              />
            </div>

            {/* Existing Attachments */}
            {existingAttachments.length > 0 && (
              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="text-slate-800 font-medium pt-2">{t("Attachments")}</Label>
                <div className="space-y-2">
                  {existingAttachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-700 flex-1 truncate">{att.fileName}</span>
                      <div className="flex items-center gap-1">
                        <a
                          href={`/api${att.filePath}`}
                          download={att.fileName}
                          className="text-slate-400 hover:text-primary-600 p-1"
                          title={t("Download")}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <a
                          href={`/api${att.filePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-primary-600 p-1"
                          title={t("View")}
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-700"
                          onClick={() => handleDeleteAttachment(att.id)}
                          title={t("Delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Upload - Only for auditees */}
            {isAuditeeOnly && (
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-slate-800 font-medium pt-2">{t("Upload Document")}</Label>
              <div
                className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <FileText className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-600 mb-1">{t("Drag and drop files here, or click to upload")}</p>
                  <p className="text-xs text-slate-400">{t("PDF, DOC, DOCX, XLS, XLSX, CSV, TXT")}</p>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
                          }}
                          className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            )}

            {/* AI Review Section for Audit Head (visible when AI review exists) */}
            {isAuditHead && (
              <div className="border-t pt-4 mt-4 bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-slate-800">{t("AI Review")}</h3>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <Label className="text-slate-800 font-medium">{t("Status")}</Label>
                  <span className="text-sm text-slate-600">{findingToEdit?.aiReviewStatus || "-"}</span>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-start gap-4 mt-3">
                  <Label className="text-slate-800 font-medium pt-2">{t("Description")}</Label>
                  <Textarea
                    value={findingToEdit?.aiReviewDescription || ""}
                    readOnly
                    placeholder="-"
                    className="bg-white"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Pending Audit Head Review message for Auditee (when AI review exists but not approved) */}
            {isAuditeeOnly && findingToEdit?.status === "Under Review" && !findingToEdit?.aiReviewApproved && (
              <div className="border-t pt-4 mt-4 bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-yellow-600" />
                  <span className="text-yellow-700 font-medium">{t("Pending Audit Head Review")}</span>
                </div>
                <p className="text-sm text-yellow-600 mt-2">
                  {t("Your documents have been submitted and are awaiting review by the Audit Head.")}
                </p>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setFindingToEdit(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              className="bg-primary-600 hover:bg-primary-700"
              onClick={handleSaveEdit}
              disabled={saving || uploading || aiReviewing}
            >
              {saving || uploading || aiReviewing ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {uploading ? t("Uploading...") : aiReviewing ? t("Analyzing...") : t("Saving...")}
                </>
              ) : (
                t("Save")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

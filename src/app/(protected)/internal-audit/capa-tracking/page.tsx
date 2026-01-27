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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, Trash2, Eye, Pencil, Download, FileText, CheckCircle2, XCircle, Bot } from "lucide-react";
import { useHasRole } from "@/hooks/usePermissions";
import { useRef } from "react";

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
  }, [selectedDepartment, pagination.page]);

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
      toast.error("Failed to fetch CAPA tracking data");
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
        toast.success("Finding deleted successfully");
        setDeleteDialogOpen(false);
        setFindingToDelete(null);
        fetchFindings();
      } else {
        toast.error("Failed to delete finding");
      }
    } catch (error) {
      console.error("Error deleting finding:", error);
      toast.error("Failed to delete finding");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenEdit = (finding: Finding) => {
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
        `/api/internal-audit/capa-tracking/${findingId}/attachments`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (response.ok) {
        const newAttachments = await response.json();
        setExistingAttachments((prev) => [...newAttachments, ...prev]);
        setUploadedFiles([]);
        return true;
      } else {
        toast.error('Failed to upload files');
        return false;
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!findingToEdit) return;

    try {
      const response = await fetch(
        `/api/internal-audit/capa-tracking/${findingToEdit.id}/attachments/${attachmentId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setExistingAttachments((prev) =>
          prev.filter((att) => att.id !== attachmentId)
        );
        toast.success('Attachment deleted');
      } else {
        toast.error('Failed to delete attachment');
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Failed to delete attachment');
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
              toast.success("Documents submitted for Audit Head review");
            } else {
              // AI review failed, but save was successful
              toast.success("CAPA submitted (AI review pending)");
            }
          } catch (aiError) {
            console.error("AI review error:", aiError);
            toast.success("CAPA submitted (AI review pending)");
          } finally {
            setAiReviewing(false);
          }
        } else {
          toast.success("Finding updated successfully");
        }

        setEditDialogOpen(false);
        setFindingToEdit(null);
        fetchFindings();
      } else {
        toast.error("Failed to update finding");
      }
    } catch (error) {
      console.error("Error updating finding:", error);
      toast.error("Failed to update finding");
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

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "high":
      case "critical":
        return "text-red-600 font-semibold";
      case "medium":
        return "text-orange-600 font-semibold";
      case "low":
        return "text-green-600 font-semibold";
      default:
        return "text-gray-600";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "open":
        return "text-blue-600";
      case "closed":
        return "text-green-600";
      case "in progress":
        return "text-orange-600";
      case "under review":
        return "text-purple-600";
      case "overdue":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const startIndex = (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-xl font-bold text-[#1e3a5f]">
          Corrective & Preventive Actions (CAPA)
        </h1>
      </div>

      {/* Filters */}
      <div className="flex justify-end">
        <div className="w-[200px]">
          <Select
            value={selectedDepartment}
            onValueChange={(value) => {
              setSelectedDepartment(value === "all" ? "" : value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Department</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-[#1e3a5f] font-semibold">FindingsId</TableHead>
              <TableHead className="text-[#1e3a5f] font-semibold">Finding</TableHead>
              <TableHead className="text-[#1e3a5f] font-semibold">Severity</TableHead>
              <TableHead className="text-[#1e3a5f] font-semibold">Audit Plan</TableHead>
              <TableHead className="text-[#1e3a5f] font-semibold">Department</TableHead>
              <TableHead className="text-[#1e3a5f] font-semibold">Responsible Person</TableHead>
              <TableHead className="text-[#1e3a5f] font-semibold">Target date</TableHead>
              <TableHead className="text-[#1e3a5f] font-semibold">Status</TableHead>
              {showActions && (
                <TableHead className="text-[#1e3a5f] font-semibold">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showActions ? 9 : 8} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1e3a5f]" />
                </TableCell>
              </TableRow>
            ) : findings.length > 0 ? (
              findings.map((finding) => (
                <TableRow key={finding.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{finding.findingId}</TableCell>
                  <TableCell className="max-w-[250px]">
                    <span className="line-clamp-2">{finding.finding}</span>
                  </TableCell>
                  <TableCell>
                    <span className={getSeverityColor(finding.severity)}>
                      {finding.severity}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <span className="line-clamp-2">{finding.auditPlan}</span>
                  </TableCell>
                  <TableCell>{finding.departmentName}</TableCell>
                  <TableCell>{finding.responsiblePerson}</TableCell>
                  <TableCell>{formatDate(finding.targetDate)}</TableCell>
                  <TableCell>
                    <span className={getStatusColor(finding.status)}>
                      {finding.status}
                    </span>
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {finding.status.toLowerCase() === "closed" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View"
                            onClick={() => {
                              setFindingToView(finding);
                              setViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 text-blue-500" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              onClick={() => handleOpenEdit(finding)}
                            >
                              <Pencil className="h-4 w-4 text-blue-500" />
                            </Button>
                            {/* Delete only for Audit Head, not Auditee */}
                            {isAuditHead && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => {
                                  setFindingToDelete(finding);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
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
                <TableCell colSpan={showActions ? 9 : 8} className="text-center py-8 text-gray-500">
                  No findings found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Currently showing {startIndex} to {endIndex} of {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <span>
              {startIndex} to {endIndex} of {pagination.total}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Finding</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete finding &quot;{findingToDelete?.findingId}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setFindingToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFinding}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog (for Closed findings) */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-[#1e3a5f]">View CAPA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Audit Plan */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Audit plan</Label>
              <Input value={findingToView?.auditPlan || ""} readOnly className="bg-gray-50" />
            </div>

            {/* Finding Title */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Finding title</Label>
              <Input value={findingToView?.finding || ""} readOnly className="bg-gray-50" />
            </div>

            {/* Severity */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Severity</Label>
              <RadioGroup value={findingToView?.severity || ""} className="flex gap-6" disabled>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Low" id="view-severity-low" disabled />
                  <Label htmlFor="view-severity-low" className="font-normal">Low</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Medium" id="view-severity-medium" disabled />
                  <Label htmlFor="view-severity-medium" className="font-normal">Medium</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="High" id="view-severity-high" disabled />
                  <Label htmlFor="view-severity-high" className="font-normal">High</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Criteria */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Criteria</Label>
              <Input value={findingToView?.criteria || ""} readOnly className="bg-gray-50" />
            </div>

            {/* Condition */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Condition</Label>
              <Input value={findingToView?.condition || ""} readOnly className="bg-gray-50" />
            </div>

            {/* Cause */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Cause</Label>
              <Input value={findingToView?.cause || ""} readOnly className="bg-gray-50" />
            </div>

            {/* Effect */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Effect</Label>
              <Input value={findingToView?.effect || ""} readOnly className="bg-gray-50" />
            </div>

            {/* Recommendation */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Recommendation</Label>
              <Input value={findingToView?.recommendation || ""} readOnly className="bg-gray-50" />
            </div>

            {/* Status */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Status</Label>
              <RadioGroup value={findingToView?.status || ""} className="flex gap-6" disabled>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Open" id="view-status-open" disabled />
                  <Label htmlFor="view-status-open" className="font-normal">Open</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Closed" id="view-status-closed" disabled />
                  <Label htmlFor="view-status-closed" className="font-normal">Closed</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Under Review" id="view-status-review" disabled />
                  <Label htmlFor="view-status-review" className="font-normal">Under Review</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Target Date */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Target date</Label>
              <Input
                value={findingToView?.targetDate ? formatDate(findingToView.targetDate) : ""}
                readOnly
                className="bg-gray-50"
              />
            </div>

            {/* Auditee Comment */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-[#1e3a5f] font-medium pt-2">Auditee Comment</Label>
              <Textarea
                value={findingToView?.auditeeComment || ""}
                readOnly
                className="bg-gray-50"
                rows={3}
              />
            </div>

            {/* AI Review Section (visible when approved for Auditee, always for Audit Team) */}
            {findingToView?.aiReviewStatus && (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-[#1e3a5f]">AI Review Result</h3>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <Label className="text-[#1e3a5f] font-medium">Status</Label>
                  <div className="flex items-center gap-2">
                    {findingToView.aiReviewStatus === "Satisfactory" ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-green-600 font-medium">Satisfactory</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="text-red-600 font-medium">Unsatisfactory</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-[140px_1fr] items-start gap-4 mt-3">
                  <Label className="text-[#1e3a5f] font-medium pt-2">Description</Label>
                  <Textarea
                    value={findingToView.aiReviewDescription || ""}
                    readOnly
                    className="bg-gray-50"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2e4a6f]"
              onClick={() => {
                setViewDialogOpen(false);
                setFindingToView(null);
              }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-[#1e3a5f]">Edit CAPA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Audit Plan */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Audit plan</Label>
              <Select
                value={editForm.engagementId}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, engagementId: value }))
                }
                disabled={isAuditeeOnly}
              >
                <SelectTrigger className={isAuditeeOnly ? "bg-gray-50" : ""}>
                  <SelectValue placeholder="Select audit plan" />
                </SelectTrigger>
                <SelectContent>
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
              <Label className="text-[#1e3a5f] font-medium">Finding title</Label>
              <Input
                value={editForm.finding}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, finding: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-gray-50" : ""}
              />
            </div>

            {/* Severity */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Severity</Label>
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
                  <Label htmlFor="severity-low" className="font-normal cursor-pointer">Low</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Medium" id="severity-medium" disabled={isAuditeeOnly} />
                  <Label htmlFor="severity-medium" className="font-normal cursor-pointer">Medium</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="High" id="severity-high" disabled={isAuditeeOnly} />
                  <Label htmlFor="severity-high" className="font-normal cursor-pointer">High</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Criteria */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Criteria</Label>
              <Input
                value={editForm.criteria}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, criteria: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-gray-50" : ""}
              />
            </div>

            {/* Condition */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Condition</Label>
              <Input
                value={editForm.condition}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, condition: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-gray-50" : ""}
              />
            </div>

            {/* Cause */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Cause</Label>
              <Input
                value={editForm.cause}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, cause: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-gray-50" : ""}
              />
            </div>

            {/* Effect */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Effect</Label>
              <Input
                value={editForm.effect}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, effect: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-gray-50" : ""}
              />
            </div>

            {/* Recommendation */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Recommendation</Label>
              <Input
                value={editForm.recommendation}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, recommendation: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-gray-50" : ""}
              />
            </div>

            {/* Status */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Status</Label>
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
                  <Label htmlFor="status-open" className="font-normal cursor-pointer">Open</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Closed" id="status-closed" disabled={isAuditeeOnly} />
                  <Label htmlFor="status-closed" className="font-normal cursor-pointer">Closed</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Under Review" id="status-review" disabled={isAuditeeOnly} />
                  <Label htmlFor="status-review" className="font-normal cursor-pointer">Under Review</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Target Date */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-[#1e3a5f] font-medium">Target date</Label>
              <Input
                type="date"
                value={editForm.targetDate}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, targetDate: e.target.value }))
                }
                disabled={isAuditeeOnly}
                className={isAuditeeOnly ? "bg-gray-50" : ""}
              />
            </div>

            {/* Auditee's comments - EDITABLE for auditee */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-[#1e3a5f] font-medium pt-2">Auditee<br/>Comment</Label>
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
                <Label className="text-[#1e3a5f] font-medium pt-2">Attachments</Label>
                <div className="space-y-2">
                  {existingAttachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="text-blue-600 text-sm flex-1">{att.fileName}</span>
                      <div className="flex items-center gap-1">
                        <a
                          href={att.filePath}
                          download={att.fileName}
                          className="text-gray-500 hover:text-blue-600 p-1"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <a
                          href={att.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-blue-600 p-1"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                        {/* Delete only for Audit Head, not Auditee */}
                        {!isAuditeeOnly && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteAttachment(att.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Upload - EDITABLE for auditee */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-[#1e3a5f] font-medium pt-2"></Label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
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
                <p className="text-gray-500">
                  Click here, or drop files here to upload.
                </p>
                {uploadedFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-center gap-2 text-sm text-green-600">
                        <FileText className="h-4 w-4" />
                        <span>{file.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Review Section for Audit Head (visible when there's an AI review pending approval) */}
          {isAuditHead && findingToEdit?.aiReviewStatus && !findingToEdit?.aiReviewApproved && (
            <div className="border-t pt-4 mt-4 bg-purple-50 -mx-6 px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-[#1e3a5f]">AI Review Result (Pending Approval)</h3>
              </div>
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-[#1e3a5f] font-medium">Status</Label>
                <div className="flex items-center gap-2">
                  {findingToEdit.aiReviewStatus === "Satisfactory" ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="text-green-600 font-medium">Satisfactory</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-red-600 font-medium">Unsatisfactory</span>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-[140px_1fr] items-start gap-4 mt-3">
                <Label className="text-[#1e3a5f] font-medium pt-2">Description</Label>
                <Textarea
                  value={findingToEdit.aiReviewDescription || ""}
                  readOnly
                  className="bg-white"
                  rows={3}
                />
              </div>
              <p className="text-sm text-purple-700 mt-3">
                Click &quot;Save&quot; to approve this AI review and close the finding.
              </p>
            </div>
          )}

          {/* Pending Audit Head Review message for Auditee (when AI review exists but not approved) */}
          {isAuditeeOnly && findingToEdit?.status === "Under Review" && !findingToEdit?.aiReviewApproved && (
            <div className="border-t pt-4 mt-4 bg-yellow-50 -mx-6 px-6 py-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-yellow-600" />
                <span className="text-yellow-700 font-medium">Pending Audit Head Review</span>
              </div>
              <p className="text-sm text-yellow-600 mt-2">
                Your documents have been submitted and are awaiting review by the Audit Head.
              </p>
            </div>
          )}

          {/* Footer with Save/Cancel buttons */}
          <div className="flex justify-end items-center pt-4 border-t gap-2">
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2e4a6f]"
              onClick={handleSaveEdit}
              disabled={saving || uploading || aiReviewing}
            >
              {saving || uploading || aiReviewing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploading ? "Uploading..." : aiReviewing ? "Analyzing..." : "Saving..."}
                </>
              ) : (
                "Save"
              )}
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2e4a6f]"
              onClick={() => {
                setEditDialogOpen(false);
                setFindingToEdit(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

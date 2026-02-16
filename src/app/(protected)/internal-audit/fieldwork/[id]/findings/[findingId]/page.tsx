"use client";

import { useState, useEffect, useRef } from "react";
import { formatLocalDate } from "@/lib/utils";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronRight,
  Home,
  Loader2,
  Save,
  Edit2,
  Upload,
  X,
  Trash2,
  Paperclip,
  Eye,
  Download,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { useLanguage } from "@/contexts/LanguageContext";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

interface Finding {
  id: string;
  findingId: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  departmentId: string | null;
  departmentName: string;
  responsiblePerson: string;
  responsiblePersonId: string;
  identifiedDate: string | null;
  targetDate: string | null;
  closedDate: string | null;
  // New fields
  criteria: string;
  condition: string;
  cause: string;
  effect: string;
  recommendation: string;
}

interface Attachment {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  uploadedAt: string;
}

export default function ViewFindingPage() {
  return (
    <Suspense fallback={<div className="p-3 sm:p-6 flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>}>
      <ViewFindingContent />
    </Suspense>
  );
}

function ViewFindingContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const engagementId = params.id as string;
  const findingId = params.findingId as string;
  const editMode = searchParams.get("edit") === "true";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(editMode);
  const [users, setUsers] = useState<User[]>([]);

  const [formData, setFormData] = useState<Finding | null>(null);

  // Attachment states
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [deletingAttachment, setDeletingAttachment] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      if (engagementId && findingId) {
        try {
          await fetchFinding();
          await fetchUsers();
          await fetchAttachments();
        } catch (error) {
          console.error('Error loading finding data:', error);
          setLoading(false);
        }
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId, findingId]);

  // Update edit mode when search params change
  useEffect(() => {
    setIsEditing(editMode);
  }, [editMode]);

  const fetchFinding = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings/${findingId}`);
      if (response.ok) {
        const data = await response.json();
        setFormData(data);
      } else {
        toast.error(t("Finding not found"));
        router.push(`/internal-audit/fieldwork/${engagementId}`);
      }
    } catch (error) {
      console.error("Failed to fetch finding:", error);
      toast.error(t("Failed to load finding"));
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch only auditees associated with the current audit head
      // Skip for auditees (they don't need to see this dropdown)
      const response = await fetch("/api/users/my-auditees");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.auditees || data || []);
      } else if (response.status === 403) {
        // Auditees don't have access to this endpoint, which is fine
        // They only view findings, not edit them
        setUsers([]);
      }
    } catch (error) {
      console.error("Failed to fetch auditees:", error);
      // Don't block page load if this fails
      setUsers([]);
    }
  };

  const fetchAttachments = async () => {
    try {
      const response = await fetch(`/api/internal-audit/findings/${findingId}/attachments`);
      if (response.ok) {
        const data = await response.json();
        setAttachments(data);
      }
    } catch (error) {
      console.error("Failed to fetch attachments:", error);
    }
  };

  const handleUploadAttachment = async () => {
    if (newAttachments.length === 0) return;

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      newAttachments.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(`/api/internal-audit/findings/${findingId}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast.success(t("Attachments uploaded successfully"));
        setNewAttachments([]);
        fetchAttachments();
      } else {
        toast.error(t("Failed to upload attachments"));
      }
    } catch (error) {
      console.error("Error uploading attachments:", error);
      toast.error(t("Failed to upload attachments"));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    setDeletingAttachment(attachmentId);
    try {
      const response = await fetch(`/api/internal-audit/findings/${findingId}/attachments?attachmentId=${attachmentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(t("Attachment deleted successfully"));
        fetchAttachments();
      } else {
        toast.error(t("Failed to delete attachment"));
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      toast.error(t("Failed to delete attachment"));
    } finally {
      setDeletingAttachment(null);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (formData) {
      setFormData({ ...formData, [field]: value });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return formatLocalDate(new Date(dateString));
  };

  const formatDisplayDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleSave = async () => {
    if (!formData) return;

    if (!formData.title || !formData.title.trim()) {
      toast.error(t("Finding title is required"));
      return;
    }

    if (!formData.responsiblePersonId || formData.responsiblePersonId === "none" || formData.responsiblePersonId.trim() === "") {
      toast.error(t("Responsible person is required"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings/${findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          severity: formData.severity,
          criteria: formData.criteria,
          condition: formData.condition,
          cause: formData.cause || null,
          effect: formData.effect,
          recommendation: formData.recommendation,
          responsiblePersonId: formData.responsiblePersonId && formData.responsiblePersonId !== "none" ? formData.responsiblePersonId : null,
          status: formData.status !== "none" ? formData.status : "Open",
          targetDate: formData.targetDate || null,
        }),
      });

      if (response.ok) {
        toast.success(t("Finding updated successfully"));
        setIsEditing(false);
        fetchFinding();
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

  if (loading || !formData) {
    return (
      <div className="p-3 sm:p-6">
        <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6">
          <Link href="/internal-audit/fieldwork" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/internal-audit/fieldwork" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Fieldwork")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Finding Details")}</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("Back")}
          </Button>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">{t("Audit Plan")}</span>
          <span className="text-slate-400">|</span>
          <span className="text-[#1e3a5f] font-semibold">{t("Finding Details")}</span>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6">
        <Link href="/internal-audit/fieldwork" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/internal-audit/fieldwork" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Fieldwork")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Finding Details")}</span>
      </nav>

      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/internal-audit/fieldwork/${engagementId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("Back")}
          </Button>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">{t("Audit Plan")}</span>
          <span className="text-slate-400">|</span>
          <span className="text-[#1e3a5f] font-semibold">{t("Finding Details")} - {formData.findingId}</span>
        </div>
        {!isEditing && (
          <Button
            variant="outline"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            {t("Edit")}
          </Button>
        )}
      </div>

      {/* Form */}
      <Card className="p-3 sm:p-6">
        <div className="space-y-4 sm:space-y-6">
          {/* Finding Title */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">{t("Finding Title")} <span className="text-red-500">*</span></Label>
            {isEditing ? (
              <Input
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="border-slate-300"
              />
            ) : (
              <div className="p-3 bg-slate-50 rounded-md border">
                {formData.title || "-"}
              </div>
            )}
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">{t("Severity")}</Label>
            {isEditing ? (
              <Select
                value={formData.severity}
                onValueChange={(value) => handleInputChange("severity", value)}
              >
                <SelectTrigger className="border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">{t("Low")}</SelectItem>
                  <SelectItem value="Medium">{t("Medium")}</SelectItem>
                  <SelectItem value="High">{t("High")}</SelectItem>
                  <SelectItem value="Critical">{t("Critical")}</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 bg-slate-50 rounded-md border">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  formData.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                  formData.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                  formData.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {t(formData.severity)}
                </span>
              </div>
            )}
          </div>

          {/* Criteria (What should be) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">{t("Criteria (What should be)")}</Label>
            {isEditing ? (
              <Textarea
                value={formData.criteria || ""}
                onChange={(e) => handleInputChange("criteria", e.target.value)}
                rows={4}
                className="border-slate-300 resize-y"
              />
            ) : (
              <div className="p-3 bg-slate-50 rounded-md border min-h-[100px]">
                {formData.criteria || "-"}
              </div>
            )}
          </div>

          {/* Condition (What is) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">{t("Condition (What is)")}</Label>
            {isEditing ? (
              <Textarea
                value={formData.condition || ""}
                onChange={(e) => handleInputChange("condition", e.target.value)}
                rows={4}
                className="border-slate-300 resize-y"
              />
            ) : (
              <div className="p-3 bg-slate-50 rounded-md border min-h-[100px]">
                {formData.condition || "-"}
              </div>
            )}
          </div>

          {/* Cause (Why it happened) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">{t("Cause (Why it happened)")}</Label>
            {isEditing ? (
              <Textarea
                value={formData.cause || ""}
                onChange={(e) => handleInputChange("cause", e.target.value)}
                rows={4}
                className="border-slate-300 resize-y"
              />
            ) : (
              <div className="p-3 bg-slate-50 rounded-md border min-h-[100px]">
                {formData.cause || "-"}
              </div>
            )}
          </div>

          {/* Effect (The consequence) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">{t("Effect (The consequence)")}</Label>
            {isEditing ? (
              <Textarea
                value={formData.effect || ""}
                onChange={(e) => handleInputChange("effect", e.target.value)}
                rows={4}
                className="border-slate-300 resize-y"
              />
            ) : (
              <div className="p-3 bg-slate-50 rounded-md border min-h-[100px]">
                {formData.effect || "-"}
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">{t("Recommendation")}</Label>
            {isEditing ? (
              <Textarea
                value={formData.recommendation || ""}
                onChange={(e) => handleInputChange("recommendation", e.target.value)}
                rows={4}
                className="border-slate-300 resize-y"
              />
            ) : (
              <div className="p-3 bg-slate-50 rounded-md border min-h-[100px]">
                {formData.recommendation || "-"}
              </div>
            )}
          </div>

          {/* Upload Attachment */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">{t("Upload Attachment")}</Label>
            <div className="space-y-3">
              {/* Upload Controls */}
              {isEditing && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={uploadingAttachment}
                  >
                    <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Choose Files")}
                  </Button>
                  {newAttachments.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleUploadAttachment}
                      disabled={uploadingAttachment}
                    >
                      {uploadingAttachment ? (
                        <>
                          <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                          {t("Uploading...")}
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                          {t("Upload")} ({newAttachments.length})
                        </>
                      )}
                    </Button>
                  )}
                  <input
                    type="file"
                    ref={attachmentInputRef}
                    onChange={(e) => {
                      if (e.target.files) {
                        setNewAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                        e.target.value = "";
                      }
                    }}
                    className="hidden"
                    multiple
                  />
                </div>
              )}

              {/* New Attachments to be uploaded */}
              {newAttachments.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">{t("Files to upload")}:</p>
                  {newAttachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-yellow-50 rounded border border-yellow-200 text-sm">
                      <span className="truncate flex-1">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setNewAttachments(prev => prev.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Existing Attachments */}
              {attachments.length > 0 ? (
                <div className="space-y-1">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-sm">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Paperclip className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{att.fileName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(`/api${att.filePath}`, "_blank")}
                          title={t("View")}
                        >
                          <Eye className="h-4 w-4 text-slate-600" />
                        </Button>
                        <a
                          href={`/api${att.filePath}`}
                          download={att.fileName}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-slate-100"
                          title={t("Download")}
                        >
                          <Download className="h-4 w-4 text-slate-600" />
                        </a>
                        {isEditing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDeleteAttachment(att.id)}
                            disabled={deletingAttachment === att.id}
                            title={t("Delete")}
                          >
                            {deletingAttachment === att.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-500" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border text-slate-500 text-sm">
                  {t("No attachments")}
                </div>
              )}
            </div>
          </div>

          {/* Corrective & Preventive Actions (CAPA) Section */}
          <div className="pt-4">
            <h2 className="text-lg font-semibold text-[#1e3a5f] mb-4">
              {t("Corrective & Preventive Actions (CAPA)")}
            </h2>

            {/* Responsible Person */}
            <div className="space-y-2 mb-4">
              <Label className="text-[#1e3a5f] font-medium">{t("Responsible Person")} <span className="text-red-500">*</span></Label>
              {isEditing ? (
                <Select
                  value={formData.responsiblePersonId || "none"}
                  onValueChange={(value) => handleInputChange("responsiblePersonId", value)}
                >
                  <SelectTrigger className="border-slate-300">
                    <SelectValue placeholder={t("Select person")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("Select person")}</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName || `${user.firstName} ${user.lastName}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border">
                  {formData.responsiblePerson || "-"}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2 mb-4">
              <Label className="text-[#1e3a5f] font-medium">{t("Status")}</Label>
              {isEditing ? (
                <Select
                  value={formData.status || "none"}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger className="border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("Select status")}</SelectItem>
                    <SelectItem value="Open">{t("Open")}</SelectItem>
                    <SelectItem value="Under Review">{t("Under Review")}</SelectItem>
                    <SelectItem value="Closed">{t("Closed")}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    formData.status === 'Closed' ? 'bg-green-100 text-green-800' :
                    formData.status === 'Under Review' ? 'bg-primary-50 text-primary-700' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {t(formData.status)}
                  </span>
                </div>
              )}
            </div>

            {/* Target Closure Date */}
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Target Closure Date")}</Label>
              {isEditing ? (
                <DatePicker
                  value={formData.targetDate || undefined}
                  onChange={(date) => handleInputChange("targetDate", date ? formatLocalDate(date) : "")}
                  placeholder={t("Select date")}
                />
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border">
                  {formatDisplayDate(formData.targetDate)}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  fetchFinding();
                }}
                className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-slate-50"
              >
                {t("Cancel")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("Saving...")}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {t("Save")}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

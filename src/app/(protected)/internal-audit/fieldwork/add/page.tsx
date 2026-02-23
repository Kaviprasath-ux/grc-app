"use client";

import { useState, useEffect, useRef } from "react";
import { formatLocalDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Home,
  FileText,
  X,
  Loader2,
  Upload,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

interface Engagement {
  id: string;
  auditId: string;
  engagementTitle: string;
  department: {
    id: string;
    name: string;
  } | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

export default function AddEvidenceRequestPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reference data
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    engagementId: "",
    title: "",
    description: "",
    sampleSize: "",
    dueDate: "",
    auditeeId: "",
    status: "Pending",
    priority: "Medium",
    requestType: "",
    controlReference: "",
    testingProcedure: "",
    expectedEvidence: "",
    auditorNotes: "",
  });
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // File uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Collapsible sections
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // Selected engagement details
  const [selectedEngagement, setSelectedEngagement] = useState<Engagement | null>(null);

  useEffect(() => {
    fetchReferenceData();
  }, []);

  useEffect(() => {
    if (formData.engagementId) {
      const engagement = engagements.find(e => e.id === formData.engagementId);
      setSelectedEngagement(engagement || null);
    } else {
      setSelectedEngagement(null);
    }
  }, [formData.engagementId, engagements]);

  const fetchReferenceData = async () => {
    try {
      const [engagementsRes, usersRes] = await Promise.all([
        fetch("/api/internal-audit/engagements"),
        fetch("/api/users"),
      ]);

      if (engagementsRes.ok) {
        const data = await engagementsRes.json();
        setEngagements(data);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || usersData || []);
      }
    } catch (error) {
      console.error("Failed to fetch reference data:", error);
      toast.error(t("Failed to load reference data"));
    } finally {
      setLoading(false);
    }
  };

  // File upload handlers
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    addFiles(files);
    e.target.value = "";
  };

  const addFiles = (files: File[]) => {
    for (const file of files) {
      const newFile: UploadedFile = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        file: file,
      };
      setUploadedFiles((prev) => [...prev, newFile]);
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.name || user.email;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const errors: { [key: string]: string } = {};

    if (!formData.engagementId) {
      errors.engagementId = t("Please select an Audit Engagement") || "Please select an Audit Engagement";
    }
    if (!formData.title.trim()) {
      errors.title = t("Evidence Title is required") || "Evidence Title is required";
    }
    if (!formData.dueDate) {
      errors.dueDate = t("Due Date is required") || "Due Date is required";
    }

    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      // Get auditee name if selected
      let auditeeName = "";
      if (formData.auditeeId) {
        const auditee = users.find(u => u.id === formData.auditeeId);
        if (auditee) {
          auditeeName = getUserDisplayName(auditee);
        }
      }

      const response = await fetch("/api/internal-audit/fieldwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          auditeeName,
        }),
      });

      if (response.ok) {
        toast.success(t("Evidence Request created successfully"));
        router.push("/internal-audit/fieldwork");
      } else {
        const error = await response.json();
        toast.error(error.error || t("Failed to create evidence request"));
      }
    } catch (error) {
      console.error("Failed to create evidence request:", error);
      toast.error(t("Failed to create evidence request"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-3 sm:p-6">
        <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap">
          <Link href="/internal-audit/fieldwork" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/internal-audit/fieldwork" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Fieldwork")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Add Fieldwork")}</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("Back")}
          </Button>
          <div className="text-sm text-muted-foreground">{t("Fieldwork")}</div>
          <h1 className="text-xl sm:text-2xl font-semibold text-blue-900">{t("New Evidence Request")}</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap">
        <Link href="/internal-audit/fieldwork" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/internal-audit/fieldwork" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Fieldwork")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Add Fieldwork")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("Back")}
        </Button>
        <div className="text-sm text-muted-foreground">{t("Fieldwork")}</div>
        <h1 className="text-xl sm:text-2xl font-semibold text-blue-900">{t("New Evidence Request")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 max-w-4xl">
        {/* Audit Engagement */}
        <div className="space-y-2">
          <Label className="text-blue-800">
            {t("Audit Engagement")} <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.engagementId}
            onValueChange={(value) => setFormData({ ...formData, engagementId: value })}
          >
            <SelectTrigger className={validationErrors.engagementId ? 'border-red-500' : ''}>
              <SelectValue placeholder={t("Select Audit Engagement")} />
            </SelectTrigger>
            <SelectContent>
              {engagements.map((engagement) => (
                <SelectItem key={engagement.id} value={engagement.id}>
                  {engagement.auditId} - {engagement.engagementTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationErrors.engagementId && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.engagementId}</p>
          )}
          {selectedEngagement && !validationErrors.engagementId && (
            <div className="text-sm text-gray-500 mt-1">
              {t("Department")}: {selectedEngagement.department?.name || t("N/A")}
            </div>
          )}
        </div>

        {/* Evidence Title */}
        <div className="space-y-2">
          <Label className="text-blue-800">
            {t("Evidence Title")} <span className="text-red-500">*</span>
          </Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder={t("Enter evidence title")}
            className={validationErrors.title ? 'border-red-500' : ''}
          />
          {validationErrors.title && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.title}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-blue-800">{t("Description")}</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={t("Describe the evidence required...")}
            rows={4}
          />
        </div>

        {/* Request Type */}
        <div className="space-y-2">
          <Label className="text-blue-800">{t("Request Type")}</Label>
          <Select
            value={formData.requestType}
            onValueChange={(value) => setFormData({ ...formData, requestType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Select Request Type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Document">{t("Document")}</SelectItem>
              <SelectItem value="Screenshot">{t("Screenshot")}</SelectItem>
              <SelectItem value="System Export">{t("System Export")}</SelectItem>
              <SelectItem value="Report">{t("Report")}</SelectItem>
              <SelectItem value="Log File">{t("Log File")}</SelectItem>
              <SelectItem value="Policy Document">{t("Policy Document")}</SelectItem>
              <SelectItem value="Procedure Document">{t("Procedure Document")}</SelectItem>
              <SelectItem value="Interview Notes">{t("Interview Notes")}</SelectItem>
              <SelectItem value="Other">{t("Other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sample Size */}
        <div className="space-y-2">
          <Label className="text-blue-800">{t("Sample Size")}</Label>
          <Input
            value={formData.sampleSize}
            onChange={(e) => setFormData({ ...formData, sampleSize: e.target.value })}
            placeholder={t("e.g., 25 samples, Full population, Random 10%")}
          />
        </div>

        {/* Control Reference */}
        <div className="space-y-2">
          <Label className="text-blue-800">{t("Control Reference")}</Label>
          <Input
            value={formData.controlReference}
            onChange={(e) => setFormData({ ...formData, controlReference: e.target.value })}
            placeholder={t("e.g., CTRL-001, SOX-102")}
          />
        </div>

        {/* Priority and Status Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2">
            <Label className="text-blue-800">{t("Priority")}</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Select Priority")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">{t("Low")}</SelectItem>
                <SelectItem value="Medium">{t("Medium")}</SelectItem>
                <SelectItem value="High">{t("High")}</SelectItem>
                <SelectItem value="Critical">{t("Critical")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-blue-800">{t("Status")}</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Select Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">{t("Pending")}</SelectItem>
                <SelectItem value="In Progress">{t("In Progress")}</SelectItem>
                <SelectItem value="Submitted">{t("Submitted")}</SelectItem>
                <SelectItem value="Reviewed">{t("Reviewed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Auditee Assignment */}
        <div className="space-y-2">
          <Label className="text-blue-800">{t("Assign to Auditee")}</Label>
          <Select
            value={formData.auditeeId}
            onValueChange={(value) => setFormData({ ...formData, auditeeId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Select Auditee")} />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {getUserDisplayName(user)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <Label className="text-blue-800">
            {t("Due Date")} <span className="text-red-500">*</span>
          </Label>
          <DatePicker
            value={formData.dueDate}
            onChange={(date) => setFormData({ ...formData, dueDate: date ? formatLocalDate(date) : "" })}
            placeholder={t("Select due date")}
            className={validationErrors.dueDate ? 'border-red-500' : ''}
          />
          {validationErrors.dueDate && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.dueDate}</p>
          )}
        </div>

        {/* Testing Procedure Details - Collapsible */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-blue-50 rounded-lg hover:bg-blue-100">
            <span className="text-blue-800 font-medium">{t("Testing Procedure Details")}</span>
            {detailsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border border-t-0 rounded-b-lg space-y-4">
            <div className="space-y-2">
              <Label className="text-blue-800">{t("Testing Procedure")}</Label>
              <Textarea
                value={formData.testingProcedure}
                onChange={(e) => setFormData({ ...formData, testingProcedure: e.target.value })}
                placeholder={t("Describe the testing procedure to be performed...")}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-blue-800">{t("Expected Evidence")}</Label>
              <Textarea
                value={formData.expectedEvidence}
                onChange={(e) => setFormData({ ...formData, expectedEvidence: e.target.value })}
                placeholder={t("Describe what evidence is expected from the auditee...")}
                rows={4}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Auditor Notes - Collapsible */}
        <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-blue-50 rounded-lg hover:bg-blue-100">
            <span className="text-blue-800 font-medium">{t("Auditor Notes")}</span>
            {notesOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border border-t-0 rounded-b-lg">
            <div className="space-y-2">
              <Label className="text-blue-800">{t("Internal Notes (Not visible to Auditee)")}</Label>
              <Textarea
                value={formData.auditorNotes}
                onChange={(e) => setFormData({ ...formData, auditorNotes: e.target.value })}
                placeholder={t("Add internal notes for the audit team...")}
                rows={4}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* File Upload */}
        <div className="space-y-2">
          <Label className="text-blue-800">{t("Attach Reference Documents")}</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer transition-colors ${
              isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">{t("Drag and drop files here, or click to browse")}</p>
            <p className="text-sm text-gray-400 mt-1">{t("Supported formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG")}</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={handleFileSelect}
            />
          </div>
          {uploadedFiles.length > 0 && (
            <div className="space-y-2 mt-3">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <span className="text-sm font-medium">{file.name}</span>
                      <span className="text-xs text-gray-400 ml-2">({formatFileSize(file.size)})</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-row ltr:justify-end rtl:justify-start gap-3 sm:gap-4 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/internal-audit/fieldwork")}
          >
            {t("Cancel")}
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("Saving...")}
              </>
            ) : (
              t("Create Evidence Request")
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

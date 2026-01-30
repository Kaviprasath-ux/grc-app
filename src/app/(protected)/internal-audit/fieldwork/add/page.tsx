"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  ChevronUp,
  FileText,
  X,
  Loader2,
  Upload,
} from "lucide-react";

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
      toast.error("Failed to load reference data");
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
    if (!formData.engagementId) {
      toast.error("Please select an Audit Engagement");
      return;
    }
    if (!formData.title.trim()) {
      toast.error("Evidence Title is required");
      return;
    }
    if (!formData.dueDate) {
      toast.error("Due Date is required");
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
        toast.success("Evidence Request created successfully");
        router.push("/internal-audit/fieldwork");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create evidence request");
      }
    } catch (error) {
      console.error("Failed to create evidence request:", error);
      toast.error("Failed to create evidence request");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm text-muted-foreground">Fieldwork</div>
          <h1 className="text-xl font-semibold text-blue-900">New Evidence Request</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm text-muted-foreground">Fieldwork</div>
        <h1 className="text-xl font-semibold text-blue-900">New Evidence Request</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* Audit Engagement */}
        <div className="space-y-2">
          <Label className="text-blue-800">
            Audit Engagement <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.engagementId}
            onValueChange={(value) => setFormData({ ...formData, engagementId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Audit Engagement" />
            </SelectTrigger>
            <SelectContent>
              {engagements.map((engagement) => (
                <SelectItem key={engagement.id} value={engagement.id}>
                  {engagement.auditId} - {engagement.engagementTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedEngagement && (
            <div className="text-sm text-gray-500 mt-1">
              Department: {selectedEngagement.department?.name || "N/A"}
            </div>
          )}
        </div>

        {/* Evidence Title */}
        <div className="space-y-2">
          <Label className="text-blue-800">
            Evidence Title <span className="text-red-500">*</span>
          </Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter evidence title"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-blue-800">Description</Label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the evidence required..."
            rows={4}
          />
        </div>

        {/* Request Type */}
        <div className="space-y-2">
          <Label className="text-blue-800">Request Type</Label>
          <Select
            value={formData.requestType}
            onValueChange={(value) => setFormData({ ...formData, requestType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Request Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Document">Document</SelectItem>
              <SelectItem value="Screenshot">Screenshot</SelectItem>
              <SelectItem value="System Export">System Export</SelectItem>
              <SelectItem value="Report">Report</SelectItem>
              <SelectItem value="Log File">Log File</SelectItem>
              <SelectItem value="Policy Document">Policy Document</SelectItem>
              <SelectItem value="Procedure Document">Procedure Document</SelectItem>
              <SelectItem value="Interview Notes">Interview Notes</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sample Size */}
        <div className="space-y-2">
          <Label className="text-blue-800">Sample Size</Label>
          <Input
            value={formData.sampleSize}
            onChange={(e) => setFormData({ ...formData, sampleSize: e.target.value })}
            placeholder="e.g., 25 samples, Full population, Random 10%"
          />
        </div>

        {/* Control Reference */}
        <div className="space-y-2">
          <Label className="text-blue-800">Control Reference</Label>
          <Input
            value={formData.controlReference}
            onChange={(e) => setFormData({ ...formData, controlReference: e.target.value })}
            placeholder="e.g., CTRL-001, SOX-102"
          />
        </div>

        {/* Priority and Status Row */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-blue-800">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-blue-800">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="Reviewed">Reviewed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Auditee Assignment */}
        <div className="space-y-2">
          <Label className="text-blue-800">Assign to Auditee</Label>
          <Select
            value={formData.auditeeId}
            onValueChange={(value) => setFormData({ ...formData, auditeeId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Auditee" />
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
            Due Date <span className="text-red-500">*</span>
          </Label>
          <Input
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />
        </div>

        {/* Testing Procedure Details - Collapsible */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-blue-50 rounded-lg hover:bg-blue-100">
            <span className="text-blue-800 font-medium">Testing Procedure Details</span>
            {detailsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border border-t-0 rounded-b-lg space-y-4">
            <div className="space-y-2">
              <Label className="text-blue-800">Testing Procedure</Label>
              <Textarea
                value={formData.testingProcedure}
                onChange={(e) => setFormData({ ...formData, testingProcedure: e.target.value })}
                placeholder="Describe the testing procedure to be performed..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-blue-800">Expected Evidence</Label>
              <Textarea
                value={formData.expectedEvidence}
                onChange={(e) => setFormData({ ...formData, expectedEvidence: e.target.value })}
                placeholder="Describe what evidence is expected from the auditee..."
                rows={4}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Auditor Notes - Collapsible */}
        <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-blue-50 rounded-lg hover:bg-blue-100">
            <span className="text-blue-800 font-medium">Auditor Notes</span>
            {notesOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border border-t-0 rounded-b-lg">
            <div className="space-y-2">
              <Label className="text-blue-800">Internal Notes (Not visible to Auditee)</Label>
              <Textarea
                value={formData.auditorNotes}
                onChange={(e) => setFormData({ ...formData, auditorNotes: e.target.value })}
                placeholder="Add internal notes for the audit team..."
                rows={4}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* File Upload */}
        <div className="space-y-2">
          <Label className="text-blue-800">Attach Reference Documents</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Drag and drop files here, or click to browse</p>
            <p className="text-sm text-gray-400 mt-1">Supported formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG</p>
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
        <div className="flex justify-end gap-4 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/internal-audit/fieldwork")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Create Evidence Request"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

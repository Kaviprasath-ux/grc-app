"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
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
  Loader2,
  Upload,
  X,
  FileText,
  Save,
} from "lucide-react";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

interface Engagement {
  id: string;
  auditId: string;
  engagementTitle: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

export default function AddFindingPage() {
  const router = useRouter();
  const params = useParams();
  const engagementId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    finding: "",
    description: "",
    severity: "Medium",
    status: "Open",
    departmentId: "none",
    responsiblePersonId: "none",
    identifiedDate: new Date().toISOString().split("T")[0],
    targetDate: "",
    rootCause: "",
    riskRating: "none",
    recommendation: "",
    managementResponse: "",
    agreedActionPlan: "",
  });

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (engagementId) {
        await fetchEngagement();
        await fetchDepartments();
        await fetchUsers();
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);

  const fetchEngagement = async () => {
    try {
      const response = await fetch(`/api/internal-audit/engagements/${engagementId}`);
      if (response.ok) {
        const data = await response.json();
        setEngagement(data);
      }
    } catch (error) {
      console.error("Failed to fetch engagement:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || data || []);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleSubmit = async () => {
    if (!formData.finding.trim()) {
      toast.error("Finding title is required");
      return;
    }

    setSaving(true);
    try {
      // Create finding
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.finding,
          description: formData.description,
          severity: formData.severity,
          status: formData.status,
          departmentId: formData.departmentId && formData.departmentId !== "none" ? formData.departmentId : null,
          responsiblePersonId: formData.responsiblePersonId && formData.responsiblePersonId !== "none" ? formData.responsiblePersonId : null,
          identifiedDate: formData.identifiedDate || null,
          targetDate: formData.targetDate || null,
          rootCause: formData.rootCause,
          riskRating: formData.riskRating && formData.riskRating !== "none" ? formData.riskRating : null,
          recommendation: formData.recommendation,
          managementResponse: formData.managementResponse,
          agreedActionPlan: formData.agreedActionPlan,
        }),
      });

      if (response.ok) {
        const finding = await response.json();

        // Upload files if any
        if (uploadedFiles.length > 0) {
          const fileFormData = new FormData();
          uploadedFiles.forEach((f) => {
            if (f.file) {
              fileFormData.append("files", f.file);
            }
          });
          fileFormData.append("findingId", finding.id);

          await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings/upload`, {
            method: "POST",
            body: fileFormData,
          });
        }

        toast.success("Finding added successfully");
        router.push(`/internal-audit/fieldwork/${engagementId}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to add finding");
      }
    } catch (error) {
      console.error("Error adding finding:", error);
      toast.error("Failed to add finding");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-gray-500">|</span>
          <span className="text-gray-500">Internal Audit</span>
          <span className="text-gray-500">|</span>
          <span className="text-[#1e3a5f] font-semibold">Add Finding</span>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/internal-audit/fieldwork/${engagementId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-gray-500">|</span>
          <span className="text-gray-500">Internal Audit</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-500">Field Work</span>
          <span className="text-gray-500">|</span>
          <span className="text-[#1e3a5f] font-semibold">Add Finding</span>
        </div>
      </div>

      {/* Page Title */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h1 className="text-xl font-semibold text-[#1e3a5f]">
          Add Finding - {engagement?.auditId} - {engagement?.engagementTitle}
        </h1>
      </div>

      {/* Form */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Row 1: Finding Title and Severity */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">
                Finding Title <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.finding}
                onChange={(e) => handleInputChange("finding", e.target.value)}
                placeholder="Enter finding title"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Severity</Label>
              <Select
                value={formData.severity}
                onValueChange={(value) => handleInputChange("severity", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Description */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter detailed description of the finding"
              rows={4}
            />
          </div>

          {/* Row 3: Department and Responsible Person */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Department</Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => handleInputChange("departmentId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Responsible Person</Label>
              <Select
                value={formData.responsiblePersonId}
                onValueChange={(value) => handleInputChange("responsiblePersonId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select responsible person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName || `${user.firstName} ${user.lastName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4: Identified Date and Target Date */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Identified Date</Label>
              <Input
                type="date"
                value={formData.identifiedDate}
                onChange={(e) => handleInputChange("identifiedDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Target Date</Label>
              <Input
                type="date"
                value={formData.targetDate}
                onChange={(e) => handleInputChange("targetDate", e.target.value)}
              />
            </div>
          </div>

          {/* Row 5: Status and Risk Rating */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Risk Rating</Label>
              <Select
                value={formData.riskRating}
                onValueChange={(value) => handleInputChange("riskRating", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select risk rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Extreme">Extreme</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 6: Root Cause */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Root Cause</Label>
            <Textarea
              value={formData.rootCause}
              onChange={(e) => handleInputChange("rootCause", e.target.value)}
              placeholder="Enter root cause analysis"
              rows={3}
            />
          </div>

          {/* Row 7: Recommendation */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Recommendation</Label>
            <Textarea
              value={formData.recommendation}
              onChange={(e) => handleInputChange("recommendation", e.target.value)}
              placeholder="Enter recommendations"
              rows={3}
            />
          </div>

          {/* Row 8: Management Response */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Management Response</Label>
            <Textarea
              value={formData.managementResponse}
              onChange={(e) => handleInputChange("managementResponse", e.target.value)}
              placeholder="Enter management response"
              rows={3}
            />
          </div>

          {/* Row 9: Agreed Action Plan */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Agreed Action Plan</Label>
            <Textarea
              value={formData.agreedActionPlan}
              onChange={(e) => handleInputChange("agreedActionPlan", e.target.value)}
              placeholder="Enter agreed action plan"
              rows={3}
            />
          </div>

          {/* Supporting Documents */}
          <div className="space-y-4">
            <Label className="text-[#1e3a5f] font-medium">Supporting Documents</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">Drag and drop files here, or click to browse</p>
              <p className="text-sm text-gray-400 mt-1">
                Supported formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG
              </p>
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
              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <div>
                        <span className="text-sm font-medium">{file.name}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.id);
                      }}
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
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => router.push(`/internal-audit/fieldwork/${engagementId}`)}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Finding
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

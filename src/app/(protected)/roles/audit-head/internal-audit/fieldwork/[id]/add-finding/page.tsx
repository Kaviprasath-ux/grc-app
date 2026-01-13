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
  X,
  FileText,
} from "lucide-react";

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
  const [users, setUsers] = useState<User[]>([]);

  // Form state matching VerifAI layout exactly
  const [formData, setFormData] = useState({
    findingTitle: "",
    severity: "none",
    criteria: "",
    condition: "",
    cause: "",
    effect: "",
    recommendation: "",
    responsiblePersonId: "none",
    status: "none",
    targetClosureDate: "",
  });

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (engagementId) {
        await fetchEngagement();
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
    if (!formData.findingTitle.trim()) {
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
          title: formData.findingTitle,
          severity: formData.severity !== "none" ? formData.severity : "Medium",
          criteria: formData.criteria,
          condition: formData.condition,
          cause: formData.cause || null,
          effect: formData.effect,
          recommendation: formData.recommendation,
          responsiblePersonId: formData.responsiblePersonId !== "none" ? formData.responsiblePersonId : null,
          status: formData.status !== "none" ? formData.status : "Open",
          targetDate: formData.targetClosureDate || null,
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
        router.push(`/roles/audit-head/internal-audit/fieldwork/${engagementId}`);
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
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">Audit Plan</span>
          <span className="text-gray-400">|</span>
          <span className="text-[#1e3a5f] font-semibold">Add New Findings</span>
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
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/roles/audit-head/internal-audit/fieldwork/${engagementId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <span className="text-gray-400">|</span>
        <span className="text-gray-500">Audit Plan</span>
        <span className="text-gray-400">|</span>
        <span className="text-[#1e3a5f] font-semibold">Add New Findings</span>
      </div>

      {/* Form */}
      <Card className="p-6">
        <div className="space-y-6">
          {/* Finding Title */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Finding Title</Label>
            <Input
              value={formData.findingTitle}
              onChange={(e) => handleInputChange("findingTitle", e.target.value)}
              placeholder=""
              className="border-gray-300"
            />
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Severity</Label>
            <Select
              value={formData.severity}
              onValueChange={(value) => handleInputChange("severity", value)}
            >
              <SelectTrigger className="border-gray-300">
                <SelectValue placeholder="" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select severity</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Criteria (What should be) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Criteria (What should be)</Label>
            <Textarea
              value={formData.criteria}
              onChange={(e) => handleInputChange("criteria", e.target.value)}
              placeholder=""
              rows={4}
              className="border-gray-300 resize-y"
            />
          </div>

          {/* Condition (What is) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Condition (What is)</Label>
            <Textarea
              value={formData.condition}
              onChange={(e) => handleInputChange("condition", e.target.value)}
              placeholder=""
              rows={4}
              className="border-gray-300 resize-y"
            />
          </div>

          {/* Cause (Why it happened) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Cause (Why it happened)</Label>
            <Textarea
              value={formData.cause}
              onChange={(e) => handleInputChange("cause", e.target.value)}
              placeholder=""
              rows={4}
              className="border-gray-300 resize-y"
            />
          </div>

          {/* Effect (The consequence) */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Effect (The consequence)</Label>
            <Textarea
              value={formData.effect}
              onChange={(e) => handleInputChange("effect", e.target.value)}
              placeholder=""
              rows={4}
              className="border-gray-300 resize-y"
            />
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Recommendation</Label>
            <Textarea
              value={formData.recommendation}
              onChange={(e) => handleInputChange("recommendation", e.target.value)}
              placeholder=""
              rows={4}
              className="border-gray-300 resize-y"
            />
          </div>

          {/* Upload Attachment */}
          <div className="space-y-2">
            <Label className="text-[#1e3a5f] font-medium">Upload Attachment</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
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
              <p className="text-gray-500">Drag and drop or select file.</p>
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
              <div className="space-y-2 mt-2">
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

          {/* Corrective & Preventive Actions (CAPA) Section */}
          <div className="pt-4">
            <h2 className="text-lg font-semibold text-[#1e3a5f] mb-4">
              Corrective & Preventive Actions (CAPA)
            </h2>

            {/* Responsible Person */}
            <div className="space-y-2 mb-4">
              <Label className="text-[#1e3a5f] font-medium">Responsible Person</Label>
              <Select
                value={formData.responsiblePersonId}
                onValueChange={(value) => handleInputChange("responsiblePersonId", value)}
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select person</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName || `${user.firstName} ${user.lastName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2 mb-4">
              <Label className="text-[#1e3a5f] font-medium">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange("status", value)}
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target Closure Date */}
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Target Closure Date</Label>
              <Input
                type="date"
                value={formData.targetClosureDate}
                onChange={(e) => handleInputChange("targetClosureDate", e.target.value)}
                placeholder="dd/mm/yyyy"
                className="border-gray-300"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6">
            <Button
              variant="outline"
              onClick={() => router.push(`/roles/audit-head/internal-audit/fieldwork/${engagementId}`)}
              className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
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
          </div>
        </div>
      </Card>
    </div>
  );
}

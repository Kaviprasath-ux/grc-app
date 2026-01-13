"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Eye,
  Upload,
  X,
  Loader2,
  Plus,
  MessageSquare,
  FileSpreadsheet,
} from "lucide-react";

interface Department {
  id: string;
  name: string;
}

interface Auditor {
  id: string;
  firstName: string;
  lastName: string;
}

interface Engagement {
  id: string;
  auditId: string;
  engagementTitle: string;
  department: Department | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  assignedAuditor: Auditor | null;
  assignedAuditors: string[];
}

interface Workpaper {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  uploadedAt: string;
  category: string;
}

interface AIWorkpaper {
  id: string;
  task: string;
  evidences: string;
  steps: string;
  questionChecklist: string;
  comments: string;
  executed: boolean;
}

interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: string;
  assignedTo: string;
  dueDate: string | null;
}

interface EvidenceRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  dueDate: string | null;
  auditee: string;
}

interface Finding {
  id: string;
  findingId: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  recommendation: string;
  departmentName?: string;
  responsiblePerson?: string;
  identifiedDate?: string | null;
  targetDate?: string | null;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
}

export default function FieldworkDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const engagementId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<Engagement | null>(null);

  // Collapsible section states
  const [engagementDetailsOpen, setEngagementDetailsOpen] = useState(true);
  const [workpapersOpen, setWorkpapersOpen] = useState(false);
  const [aiWorkpapersOpen, setAiWorkpapersOpen] = useState(false);
  const [taskListOpen, setTaskListOpen] = useState(false);
  const [evidenceRequestOpen, setEvidenceRequestOpen] = useState(false);
  const [otherDocsOpen, setOtherDocsOpen] = useState(false);
  const [findingsOpen, setFindingsOpen] = useState(false);

  // Data states
  const [workpapers, setWorkpapers] = useState<Workpaper[]>([]);
  const [aiWorkpapers, setAiWorkpapers] = useState<AIWorkpaper[]>([]);
  const [taskList, setTaskList] = useState<TaskItem[]>([]);
  const [evidenceRequests, setEvidenceRequests] = useState<EvidenceRequest[]>([]);
  const [otherDocuments, setOtherDocuments] = useState<Workpaper[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);

  // Upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("workpapers");
  const [uploading, setUploading] = useState(false);

  // Dialog states
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [addFindingDialogOpen, setAddFindingDialogOpen] = useState(false);
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [addEvidenceDialogOpen, setAddEvidenceDialogOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);

  // Form states for new items
  const [newFinding, setNewFinding] = useState({
    title: "",
    description: "",
    severity: "Medium",
    recommendation: "",
  });

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assignedTo: "",
    dueDate: "",
  });

  const [newEvidence, setNewEvidence] = useState({
    title: "",
    description: "",
    auditee: "",
    dueDate: "",
  });

  useEffect(() => {
    if (engagementId) {
      fetchEngagementDetails();
      fetchWorkpapers();
      fetchAIWorkpapers();
      fetchTaskList();
      fetchEvidenceRequests();
      fetchOtherDocuments();
      fetchFindings();
    }
  }, [engagementId]);

  const fetchEngagementDetails = async () => {
    try {
      const response = await fetch(`/api/internal-audit/engagements/${engagementId}`);
      if (response.ok) {
        const data = await response.json();
        setEngagement(data);
      }
    } catch (error) {
      console.error("Failed to fetch engagement:", error);
      toast.error("Failed to fetch engagement details");
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkpapers = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/workpapers`);
      if (response.ok) {
        const data = await response.json();
        setWorkpapers(data);
      }
    } catch (error) {
      console.error("Failed to fetch workpapers:", error);
    }
  };

  const fetchAIWorkpapers = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/ai-workpapers`);
      if (response.ok) {
        const data = await response.json();
        setAiWorkpapers(data);
      }
    } catch (error) {
      console.error("Failed to fetch AI workpapers:", error);
    }
  };

  const fetchTaskList = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/tasks`);
      if (response.ok) {
        const data = await response.json();
        setTaskList(data);
      }
    } catch (error) {
      console.error("Failed to fetch task list:", error);
    }
  };

  const fetchEvidenceRequests = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests`);
      if (response.ok) {
        const data = await response.json();
        setEvidenceRequests(data);
      }
    } catch (error) {
      console.error("Failed to fetch evidence requests:", error);
    }
  };

  const fetchOtherDocuments = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/other-documents`);
      if (response.ok) {
        const data = await response.json();
        setOtherDocuments(data);
      }
    } catch (error) {
      console.error("Failed to fetch other documents:", error);
    }
  };

  const fetchFindings = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings`);
      if (response.ok) {
        const data = await response.json();
        setFindings(data);
      }
    } catch (error) {
      console.error("Failed to fetch findings:", error);
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getAuditorName = () => {
    if (!engagement) return "-";
    if (engagement.assignedAuditor) {
      return `${engagement.assignedAuditor.firstName} ${engagement.assignedAuditor.lastName}`;
    }
    if (engagement.assignedAuditors && engagement.assignedAuditors.length > 0) {
      return engagement.assignedAuditors.join(", ");
    }
    return "-";
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

  const handleUploadFiles = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("Please select files to upload");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      uploadedFiles.forEach((f) => {
        if (f.file) {
          formData.append("files", f.file);
        }
      });
      formData.append("category", uploadCategory);

      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast.success("Files uploaded successfully");
        setUploadDialogOpen(false);
        setUploadedFiles([]);
        if (uploadCategory === "workpapers") {
          fetchWorkpapers();
        } else {
          fetchOtherDocuments();
        }
      } else {
        toast.error("Failed to upload files");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleExecuted = async (workpaperId: string, currentValue: boolean) => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/${workpaperId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ executed: !currentValue }),
      });

      if (response.ok) {
        setAiWorkpapers((prev) =>
          prev.map((wp) =>
            wp.id === workpaperId ? { ...wp, executed: !currentValue } : wp
          )
        );
      }
    } catch (error) {
      console.error("Failed to update executed status:", error);
    }
  };

  const handleAddFinding = async () => {
    if (!newFinding.title.trim()) {
      toast.error("Finding title is required");
      return;
    }

    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newFinding, status: "Open" }),
      });

      if (response.ok) {
        toast.success("Finding added successfully");
        setAddFindingDialogOpen(false);
        setNewFinding({ title: "", description: "", severity: "Medium", recommendation: "" });
        fetchFindings();
      } else {
        toast.error("Failed to add finding");
      }
    } catch (error) {
      toast.error("Failed to add finding");
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newTask, status: "Pending" }),
      });

      if (response.ok) {
        toast.success("Task added successfully");
        setAddTaskDialogOpen(false);
        setNewTask({ title: "", description: "", assignedTo: "", dueDate: "" });
        fetchTaskList();
      } else {
        toast.error("Failed to add task");
      }
    } catch (error) {
      toast.error("Failed to add task");
    }
  };

  const handleAddEvidence = async () => {
    if (!newEvidence.title.trim()) {
      toast.error("Evidence title is required");
      return;
    }

    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newEvidence, status: "Pending" }),
      });

      if (response.ok) {
        toast.success("Evidence request added successfully");
        setAddEvidenceDialogOpen(false);
        setNewEvidence({ title: "", description: "", auditee: "", dueDate: "" });
        fetchEvidenceRequests();
      } else {
        toast.error("Failed to add evidence request");
      }
    } catch (error) {
      toast.error("Failed to add evidence request");
    }
  };

  const handleMarkAsCompleted = async () => {
    if (!engagement) return;

    setMarkingComplete(true);
    try {
      const response = await fetch(`/api/internal-audit/engagements/${engagementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });

      if (response.ok) {
        toast.success("Engagement marked as completed");
        setEngagement({ ...engagement, status: "Completed" });
      } else {
        toast.error("Failed to mark engagement as completed");
      }
    } catch (error) {
      console.error("Error marking engagement as completed:", error);
      toast.error("Failed to mark engagement as completed");
    } finally {
      setMarkingComplete(false);
    }
  };

  const CollapsibleSection = ({
    title,
    isOpen,
    onToggle,
    children,
    headerAction,
  }: {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    headerAction?: React.ReactNode;
  }) => (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-blue-50">
          <CollapsibleTrigger className="flex-1 flex items-center justify-between hover:bg-blue-100 transition-colors -m-4 p-4 mr-0">
            <span className="text-[#1e3a5f] font-semibold">{title}</span>
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-[#1e3a5f]" />
              ) : (
                <ChevronDown className="h-5 w-5 text-[#1e3a5f]" />
              )}
            </div>
          </CollapsibleTrigger>
          {headerAction && (
            <div className="ml-2 z-10">
              {headerAction}
            </div>
          )}
        </div>
        <CollapsibleContent>
          <div className="p-4 border-t">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-gray-500">Internal Audit</span>
          <span className="text-[#1e3a5f] font-semibold">Field Work</span>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-gray-500">Internal Audit</span>
          <span className="text-[#1e3a5f] font-semibold">Field Work</span>
        </div>
        <div className="text-center py-8 text-gray-500">Engagement not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Breadcrumb Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/internal-audit/fieldwork")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <span className="text-gray-500">|</span>
        <span className="text-gray-500">Internal Audit</span>
        <span className="text-gray-500">|</span>
        <span className="text-[#1e3a5f] font-semibold">Field Work</span>
      </div>

      {/* Engagement Details Section */}
      <CollapsibleSection
        title={`Engagement Details : ${engagement.auditId} - ${engagement.engagementTitle}`}
        isOpen={engagementDetailsOpen}
        onToggle={() => setEngagementDetailsOpen(!engagementDetailsOpen)}
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setCommentsDialogOpen(true);
              }}
            >
              Comments
            </Button>
            {engagement.status !== "Completed" && (
              <Button
                size="sm"
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkAsCompleted();
                }}
                disabled={markingComplete}
              >
                {markingComplete ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Marking...
                  </>
                ) : (
                  "Mark as Completed"
                )}
              </Button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-6 p-4 bg-white rounded-lg border">
          <div>
            <Label className="text-[#1e3a5f] font-medium">Engagement ID</Label>
            <p className="mt-1">{engagement.auditId}</p>
          </div>
          <div>
            <Label className="text-[#1e3a5f] font-medium">Title</Label>
            <p className="mt-1">{engagement.engagementTitle}</p>
          </div>
          <div>
            <Label className="text-[#1e3a5f] font-medium">Auditor</Label>
            <p className="mt-1">{getAuditorName()}</p>
          </div>
          <div>
            <Label className="text-[#1e3a5f] font-medium">Timeline</Label>
            <p className="mt-1">
              {formatDate(engagement.startDate)} to {formatDate(engagement.endDate)}
            </p>
          </div>
          <div>
            <Label className="text-[#1e3a5f] font-medium">Status</Label>
            <p className="mt-1">{engagement.status}</p>
          </div>
          <div>
            <Label className="text-[#1e3a5f] font-medium">Department</Label>
            <p className="mt-1">{engagement.department?.name || "-"}</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Workpapers Section */}
      <CollapsibleSection
        title="Workpapers"
        isOpen={workpapersOpen}
        onToggle={() => setWorkpapersOpen(!workpapersOpen)}
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={() => {
                setUploadCategory("workpapers");
                setUploadDialogOpen(true);
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Workpaper
            </Button>
          </div>
          {workpapers.length > 0 ? (
            <div className="space-y-2">
              {workpapers.map((wp) => (
                <div
                  key={wp.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium text-[#1e3a5f]">{wp.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(wp.fileSize)} - Uploaded {formatDate(wp.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" title="View">
                      <Eye className="h-4 w-4 text-gray-600" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Download">
                      <Download className="h-4 w-4 text-gray-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No workpapers uploaded yet</div>
          )}
        </div>
      </CollapsibleSection>

      {/* AI-Generated Workpapers Section */}
      <CollapsibleSection
        title="AI-Generated Workpapers"
        isOpen={aiWorkpapersOpen}
        onToggle={() => setAiWorkpapersOpen(!aiWorkpapersOpen)}
      >
        {aiWorkpapers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[#1e3a5f]">Task</TableHead>
                <TableHead className="text-[#1e3a5f]">Evidences</TableHead>
                <TableHead className="text-[#1e3a5f]">Steps</TableHead>
                <TableHead className="text-[#1e3a5f]">Question Checklist</TableHead>
                <TableHead className="text-[#1e3a5f]">Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aiWorkpapers.map((wp) => (
                <TableRow key={wp.id}>
                  <TableCell>
                    <div className="space-y-2">
                      <p>{wp.task}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#1e3a5f] font-medium">Executed</span>
                        <Checkbox
                          checked={wp.executed}
                          onCheckedChange={() => handleToggleExecuted(wp.id, wp.executed)}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="text-sm whitespace-pre-wrap">{wp.evidences}</p>
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    <p className="text-sm whitespace-pre-wrap">{wp.steps}</p>
                  </TableCell>
                  <TableCell>{wp.questionChecklist || "-"}</TableCell>
                  <TableCell>{wp.comments || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-gray-500">No AI-generated workpapers available</div>
        )}
      </CollapsibleSection>

      {/* Audit Engagement Task List Section */}
      <CollapsibleSection
        title="Audit Engagement Task List"
        isOpen={taskListOpen}
        onToggle={() => setTaskListOpen(!taskListOpen)}
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={() => setAddTaskDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
          {taskList.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[#1e3a5f]">Title</TableHead>
                  <TableHead className="text-[#1e3a5f]">Description</TableHead>
                  <TableHead className="text-[#1e3a5f]">Assigned To</TableHead>
                  <TableHead className="text-[#1e3a5f]">Due Date</TableHead>
                  <TableHead className="text-[#1e3a5f]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskList.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{task.description}</TableCell>
                    <TableCell>{task.assignedTo || "-"}</TableCell>
                    <TableCell>{formatDate(task.dueDate)}</TableCell>
                    <TableCell>{task.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">No tasks found</div>
          )}
        </div>
      </CollapsibleSection>

      {/* Evidence Request Section */}
      <CollapsibleSection
        title="Evidence Request"
        isOpen={evidenceRequestOpen}
        onToggle={() => setEvidenceRequestOpen(!evidenceRequestOpen)}
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={() => setAddEvidenceDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Evidence Request
            </Button>
          </div>
          {evidenceRequests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[#1e3a5f]">Title</TableHead>
                  <TableHead className="text-[#1e3a5f]">Description</TableHead>
                  <TableHead className="text-[#1e3a5f]">Auditee</TableHead>
                  <TableHead className="text-[#1e3a5f]">Due Date</TableHead>
                  <TableHead className="text-[#1e3a5f]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidenceRequests.map((er) => (
                  <TableRow key={er.id}>
                    <TableCell className="font-medium">{er.title}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{er.description}</TableCell>
                    <TableCell>{er.auditee || "-"}</TableCell>
                    <TableCell>{formatDate(er.dueDate)}</TableCell>
                    <TableCell>{er.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">No evidence requests found</div>
          )}
        </div>
      </CollapsibleSection>

      {/* Other Documents Section */}
      <CollapsibleSection
        title="Other Documents"
        isOpen={otherDocsOpen}
        onToggle={() => setOtherDocsOpen(!otherDocsOpen)}
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={() => {
                setUploadCategory("other");
                setUploadDialogOpen(true);
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
          {otherDocuments.length > 0 ? (
            <div className="space-y-2">
              {otherDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-medium text-[#1e3a5f]">{doc.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(doc.fileSize)} - Uploaded {formatDate(doc.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" title="View">
                      <Eye className="h-4 w-4 text-gray-600" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Download">
                      <Download className="h-4 w-4 text-gray-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No other documents uploaded yet</div>
          )}
        </div>
      </CollapsibleSection>

      {/* Findings Section */}
      <CollapsibleSection
        title="Findings"
        isOpen={findingsOpen}
        onToggle={() => setFindingsOpen(!findingsOpen)}
      >
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddFindingDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Quick Add
            </Button>
            <Button
              size="sm"
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={() => router.push(`/internal-audit/fieldwork/${engagementId}/add-finding`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Finding (Full Form)
            </Button>
          </div>
          {findings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#1e3a5f] hover:bg-[#1e3a5f]">
                  <TableHead className="text-white">Finding ID</TableHead>
                  <TableHead className="text-white">Title</TableHead>
                  <TableHead className="text-white">Severity</TableHead>
                  <TableHead className="text-white">Responsible Person</TableHead>
                  <TableHead className="text-white">Target Date</TableHead>
                  <TableHead className="text-white">Status</TableHead>
                  <TableHead className="text-white">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {findings.map((finding) => (
                  <TableRow key={finding.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{finding.findingId || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{finding.title}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        finding.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                        finding.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                        finding.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {finding.severity}
                      </span>
                    </TableCell>
                    <TableCell>{finding.responsiblePerson || '-'}</TableCell>
                    <TableCell>{formatDate(finding.targetDate || null)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        finding.status === 'Closed' ? 'bg-green-100 text-green-800' :
                        finding.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        finding.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {finding.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/internal-audit/fieldwork/${engagementId}/findings/${finding.id}`)}
                      >
                        <Eye className="h-4 w-4 text-gray-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">No findings recorded yet</div>
          )}
        </div>
      </CollapsibleSection>

      {/* Comments Dialog */}
      <Dialog open={commentsDialogOpen} onOpenChange={setCommentsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Engagement Comments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Add a comment..." rows={4} />
            <div className="text-sm text-gray-500">No comments yet</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentsDialogOpen(false)}>
              Close
            </Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">Add Comment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Upload {uploadCategory === "workpapers" ? "Workpaper" : "Document"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleUploadFiles}
              disabled={uploading || uploadedFiles.length === 0}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Finding Dialog */}
      <Dialog open={addFindingDialogOpen} onOpenChange={setAddFindingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Finding</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={newFinding.title}
                onChange={(e) => setNewFinding({ ...newFinding, title: e.target.value })}
                placeholder="Enter finding title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newFinding.description}
                onChange={(e) => setNewFinding({ ...newFinding, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={newFinding.severity}
                onValueChange={(value) => setNewFinding({ ...newFinding, severity: value })}
              >
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Recommendation</Label>
              <Textarea
                value={newFinding.recommendation}
                onChange={(e) => setNewFinding({ ...newFinding, recommendation: e.target.value })}
                placeholder="Enter recommendation"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFindingDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={handleAddFinding}>
              Add Finding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={addTaskDialogOpen} onOpenChange={setAddTaskDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Enter task title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned To</Label>
              <Input
                value={newTask.assignedTo}
                onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                placeholder="Enter assignee name"
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={handleAddTask}>
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Evidence Request Dialog */}
      <Dialog open={addEvidenceDialogOpen} onOpenChange={setAddEvidenceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Evidence Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={newEvidence.title}
                onChange={(e) => setNewEvidence({ ...newEvidence, title: e.target.value })}
                placeholder="Enter evidence request title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newEvidence.description}
                onChange={(e) => setNewEvidence({ ...newEvidence, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Auditee</Label>
              <Input
                value={newEvidence.auditee}
                onChange={(e) => setNewEvidence({ ...newEvidence, auditee: e.target.value })}
                placeholder="Enter auditee name"
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={newEvidence.dueDate}
                onChange={(e) => setNewEvidence({ ...newEvidence, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEvidenceDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={handleAddEvidence}>
              Add Evidence Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

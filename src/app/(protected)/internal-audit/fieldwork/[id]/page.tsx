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
  Pencil,
  Trash2,
  Save,
} from "lucide-react";
import { useHasRole } from "@/hooks/usePermissions";

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
  title?: string;
  documentType?: string | null;
  description?: string | null;
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
  refNo: number;
  task: string;
  document: string | null;
  documentName: string | null;
  executed: boolean;
  comments: string;
}

interface EvidenceRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  dueDate: string | null;
  auditee: string;
  auditeeId?: string | null;
  numberOfSamples?: string | null;
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
  const isAuditHead = useHasRole("AuditHead");

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
  const [users, setUsers] = useState<{ id: string; fullName: string }[]>([]);

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
  const [addingTask, setAddingTask] = useState(false);
  const [savingTask, setSavingTask] = useState<string | null>(null);
  const [uploadingTaskDocument, setUploadingTaskDocument] = useState<string | null>(null);
  const [addEvidenceDialogOpen, setAddEvidenceDialogOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [deleteFindingDialogOpen, setDeleteFindingDialogOpen] = useState(false);
  const [findingToDelete, setFindingToDelete] = useState<Finding | null>(null);
  const [deletingFinding, setDeletingFinding] = useState(false);

  // Other Documents states
  const [newDocumentDialogOpen, setNewDocumentDialogOpen] = useState(false);
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Workpaper | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [newDocument, setNewDocument] = useState({
    title: "",
    documentType: "",
    description: "",
  });
  // View/Edit document states
  const [viewEditDocumentDialogOpen, setViewEditDocumentDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Workpaper | null>(null);
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [editDocument, setEditDocument] = useState({
    title: "",
    documentType: "",
    description: "",
  });
  const [savingDocument, setSavingDocument] = useState(false);

  // Evidence Request view/edit/delete states
  const [viewEditEvidenceDialogOpen, setViewEditEvidenceDialogOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRequest | null>(null);
  const [isEditingEvidence, setIsEditingEvidence] = useState(false);
  const [editEvidence, setEditEvidence] = useState({
    title: "",
    description: "",
    auditee: "",
    dueDate: "",
    status: "",
  });
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [deleteEvidenceDialogOpen, setDeleteEvidenceDialogOpen] = useState(false);
  const [evidenceToDelete, setEvidenceToDelete] = useState<EvidenceRequest | null>(null);
  const [deletingEvidence, setDeletingEvidence] = useState(false);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [evidenceForAttachment, setEvidenceForAttachment] = useState<EvidenceRequest | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // AI Review states
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [generatingAIReview, setGeneratingAIReview] = useState(false);
  const [aiReviewDialogOpen, setAiReviewDialogOpen] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<string>("");

  // Workpaper delete states
  const [deleteWorkpaperDialogOpen, setDeleteWorkpaperDialogOpen] = useState(false);
  const [workpaperToDelete, setWorkpaperToDelete] = useState<Workpaper | null>(null);
  const [deletingWorkpaper, setDeletingWorkpaper] = useState(false);

  // AI Workpaper edit/delete states
  const [editAIWorkpaperDialogOpen, setEditAIWorkpaperDialogOpen] = useState(false);
  const [deleteAIWorkpaperDialogOpen, setDeleteAIWorkpaperDialogOpen] = useState(false);
  const [selectedAIWorkpaper, setSelectedAIWorkpaper] = useState<AIWorkpaper | null>(null);
  const [editAIWorkpaper, setEditAIWorkpaper] = useState({
    task: "",
    evidences: "",
    steps: "",
    questionChecklist: "",
    comments: "",
  });
  const [savingAIWorkpaper, setSavingAIWorkpaper] = useState(false);
  const [deletingAIWorkpaper, setDeletingAIWorkpaper] = useState(false);

  // Generate AI Workpaper states
  const [generateAIDialogOpen, setGenerateAIDialogOpen] = useState(false);
  const [generatingWorkpapers, setGeneratingWorkpapers] = useState(false);
  const [generatedWorkpapers, setGeneratedWorkpapers] = useState<AIWorkpaper[]>([]);
  const [selectedGeneratedIds, setSelectedGeneratedIds] = useState<string[]>([]);
  const [addingGeneratedWorkpapers, setAddingGeneratedWorkpapers] = useState(false);

  // Form states for new items
  const [newFinding, setNewFinding] = useState({
    title: "",
    description: "",
    severity: "Medium",
    recommendation: "",
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
      fetchUsers();
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

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        const userList = Array.isArray(data) ? data : [];
        setUsers(userList.map((u: { id: string; fullName: string }) => ({
          id: u.id,
          fullName: u.fullName,
        })));
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
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

  const handleOpenEditAIWorkpaper = (wp: AIWorkpaper) => {
    setSelectedAIWorkpaper(wp);
    setEditAIWorkpaper({
      task: wp.task,
      evidences: wp.evidences,
      steps: wp.steps,
      questionChecklist: wp.questionChecklist,
      comments: wp.comments,
    });
    setEditAIWorkpaperDialogOpen(true);
  };

  const handleUpdateAIWorkpaper = async () => {
    if (!selectedAIWorkpaper) return;
    if (!editAIWorkpaper.task.trim()) {
      toast.error("Task is required");
      return;
    }

    setSavingAIWorkpaper(true);
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/${selectedAIWorkpaper.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editAIWorkpaper),
        }
      );

      if (response.ok) {
        setAiWorkpapers((prev) =>
          prev.map((wp) =>
            wp.id === selectedAIWorkpaper.id
              ? { ...wp, ...editAIWorkpaper }
              : wp
          )
        );
        toast.success("AI Workpaper updated successfully");
        setEditAIWorkpaperDialogOpen(false);
        setSelectedAIWorkpaper(null);
      } else {
        toast.error("Failed to update AI Workpaper");
      }
    } catch (error) {
      console.error("Error updating AI Workpaper:", error);
      toast.error("Failed to update AI Workpaper");
    } finally {
      setSavingAIWorkpaper(false);
    }
  };

  const handleDeleteAIWorkpaper = async () => {
    if (!selectedAIWorkpaper) return;

    setDeletingAIWorkpaper(true);
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/${selectedAIWorkpaper.id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setAiWorkpapers((prev) =>
          prev.filter((wp) => wp.id !== selectedAIWorkpaper.id)
        );
        toast.success("AI Workpaper deleted successfully");
        setDeleteAIWorkpaperDialogOpen(false);
        setSelectedAIWorkpaper(null);
      } else {
        toast.error("Failed to delete AI Workpaper");
      }
    } catch (error) {
      console.error("Error deleting AI Workpaper:", error);
      toast.error("Failed to delete AI Workpaper");
    } finally {
      setDeletingAIWorkpaper(false);
    }
  };

  const handleGenerateAIWorkpapers = async () => {
    setGeneratingWorkpapers(true);
    setGeneratedWorkpapers([]);
    setSelectedGeneratedIds([]);
    setGenerateAIDialogOpen(true);

    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/generate`,
        { method: "POST" }
      );

      if (response.ok) {
        const data = await response.json();
        setGeneratedWorkpapers(data.workpapers || []);
      } else {
        toast.error("Failed to generate AI workpapers");
      }
    } catch (error) {
      console.error("Error generating AI workpapers:", error);
      toast.error("Failed to generate AI workpapers");
    } finally {
      setGeneratingWorkpapers(false);
    }
  };

  const handleToggleGeneratedSelection = (id: string) => {
    setSelectedGeneratedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleAddSelectedWorkpapers = async () => {
    if (selectedGeneratedIds.length === 0) {
      toast.error("Please select at least one workpaper");
      return;
    }

    setAddingGeneratedWorkpapers(true);
    try {
      const selectedWorkpapers = generatedWorkpapers.filter((wp) =>
        selectedGeneratedIds.includes(wp.id)
      );

      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/add`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workpapers: selectedWorkpapers }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAiWorkpapers((prev) => [...prev, ...data.workpapers]);
        toast.success(`${selectedGeneratedIds.length} workpaper(s) added successfully`);
        setGenerateAIDialogOpen(false);
        setGeneratedWorkpapers([]);
        setSelectedGeneratedIds([]);
      } else {
        toast.error("Failed to add workpapers");
      }
    } catch (error) {
      console.error("Error adding workpapers:", error);
      toast.error("Failed to add workpapers");
    } finally {
      setAddingGeneratedWorkpapers(false);
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

  const handleDeleteFinding = async () => {
    if (!findingToDelete) return;

    setDeletingFinding(true);
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/findings/${findingToDelete.id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        toast.success("Finding deleted successfully");
        setDeleteFindingDialogOpen(false);
        setFindingToDelete(null);
        fetchFindings();
      } else {
        toast.error("Failed to delete finding");
      }
    } catch (error) {
      console.error("Error deleting finding:", error);
      toast.error("Failed to delete finding");
    } finally {
      setDeletingFinding(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!newDocument.title.trim()) {
      toast.error("Document title is required");
      return;
    }
    if (uploadedFiles.length === 0) {
      toast.error("Please select a file to upload");
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
      formData.append("category", "other");
      formData.append("title", newDocument.title);
      formData.append("documentType", newDocument.documentType);
      formData.append("description", newDocument.description);

      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast.success("Document uploaded successfully");
        setNewDocumentDialogOpen(false);
        setNewDocument({ title: "", documentType: "", description: "" });
        setUploadedFiles([]);
        fetchOtherDocuments();
      } else {
        toast.error("Failed to upload document");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;

    setDeletingDocument(true);
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/other-documents/${documentToDelete.id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        toast.success("Document deleted successfully");
        setDeleteDocumentDialogOpen(false);
        setDocumentToDelete(null);
        fetchOtherDocuments();
      } else {
        toast.error("Failed to delete document");
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    } finally {
      setDeletingDocument(false);
    }
  };

  const handleDeleteWorkpaper = async () => {
    if (!workpaperToDelete) return;

    setDeletingWorkpaper(true);
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/workpapers/${workpaperToDelete.id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        toast.success("Workpaper deleted successfully");
        setDeleteWorkpaperDialogOpen(false);
        setWorkpaperToDelete(null);
        fetchWorkpapers();
      } else {
        toast.error("Failed to delete workpaper");
      }
    } catch (error) {
      console.error("Error deleting workpaper:", error);
      toast.error("Failed to delete workpaper");
    } finally {
      setDeletingWorkpaper(false);
    }
  };

  const handleOpenViewDocument = (doc: Workpaper, editMode: boolean = false) => {
    setSelectedDocument(doc);
    setEditDocument({
      title: doc.title || "",
      documentType: doc.documentType || "",
      description: doc.description || "",
    });
    setIsEditingDocument(editMode);
    setViewEditDocumentDialogOpen(true);
  };

  const handleUpdateDocument = async () => {
    if (!selectedDocument) return;
    if (!editDocument.title.trim()) {
      toast.error("Document title is required");
      return;
    }

    setSavingDocument(true);
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/other-documents/${selectedDocument.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editDocument.title,
            documentType: editDocument.documentType,
            description: editDocument.description,
          }),
        }
      );

      if (response.ok) {
        toast.success("Document updated successfully");
        setViewEditDocumentDialogOpen(false);
        setSelectedDocument(null);
        setIsEditingDocument(false);
        fetchOtherDocuments();
      } else {
        toast.error("Failed to update document");
      }
    } catch (error) {
      console.error("Error updating document:", error);
      toast.error("Failed to update document");
    } finally {
      setSavingDocument(false);
    }
  };

  // Evidence Request handlers
  const handleOpenViewEvidence = (er: EvidenceRequest, editMode: boolean = false) => {
    setSelectedEvidence(er);
    setEditEvidence({
      title: er.title || "",
      description: er.description || "",
      auditee: er.auditee || "",
      dueDate: er.dueDate ? new Date(er.dueDate).toISOString().split("T")[0] : "",
      status: er.status || "Pending",
    });
    setIsEditingEvidence(editMode);
    setViewEditEvidenceDialogOpen(true);
  };

  const handleUpdateEvidence = async () => {
    if (!selectedEvidence) return;
    if (!editEvidence.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSavingEvidence(true);
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${selectedEvidence.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editEvidence.title,
            description: editEvidence.description,
            auditee: editEvidence.auditee,
            dueDate: editEvidence.dueDate || null,
            status: editEvidence.status,
          }),
        }
      );

      if (response.ok) {
        toast.success("Evidence request updated successfully");
        setViewEditEvidenceDialogOpen(false);
        setSelectedEvidence(null);
        setIsEditingEvidence(false);
        fetchEvidenceRequests();
      } else {
        toast.error("Failed to update evidence request");
      }
    } catch (error) {
      console.error("Error updating evidence request:", error);
      toast.error("Failed to update evidence request");
    } finally {
      setSavingEvidence(false);
    }
  };

  const handleDeleteEvidence = async () => {
    if (!evidenceToDelete) return;

    setDeletingEvidence(true);
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${evidenceToDelete.id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        toast.success("Evidence request deleted successfully");
        setDeleteEvidenceDialogOpen(false);
        setEvidenceToDelete(null);
        fetchEvidenceRequests();
      } else {
        toast.error("Failed to delete evidence request");
      }
    } catch (error) {
      console.error("Error deleting evidence request:", error);
      toast.error("Failed to delete evidence request");
    } finally {
      setDeletingEvidence(false);
    }
  };

  const handleOpenAttachmentDialog = (er: EvidenceRequest) => {
    setEvidenceForAttachment(er);
    setUploadedFiles([]);
    setAttachmentDialogOpen(true);
  };

  const handleUploadAttachment = async () => {
    if (!evidenceForAttachment) return;
    if (uploadedFiles.length === 0) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      uploadedFiles.forEach((f) => {
        if (f.file) {
          formData.append("files", f.file);
        }
      });

      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${evidenceForAttachment.id}/attachments`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.ok) {
        toast.success("Attachment uploaded successfully");
        setAttachmentDialogOpen(false);
        setEvidenceForAttachment(null);
        setUploadedFiles([]);
        fetchEvidenceRequests();
      } else {
        toast.error("Failed to upload attachment");
      }
    } catch (error) {
      console.error("Error uploading attachment:", error);
      toast.error("Failed to upload attachment");
    } finally {
      setUploadingAttachment(false);
    }
  };

  // AI Review handlers
  const handleSelectEvidence = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedEvidenceIds([...selectedEvidenceIds, id]);
    } else {
      setSelectedEvidenceIds(selectedEvidenceIds.filter((eid) => eid !== id));
    }
  };

  const handleSelectAllEvidence = (checked: boolean) => {
    if (checked) {
      setSelectedEvidenceIds(evidenceRequests.map((er) => er.id));
    } else {
      setSelectedEvidenceIds([]);
    }
  };

  const handleAIReview = async () => {
    if (selectedEvidenceIds.length === 0) {
      toast.error("Please select at least one evidence request");
      return;
    }

    setGeneratingAIReview(true);
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/ai-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evidenceRequestIds: selectedEvidenceIds }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAiReviewResult(data.review || data.result || "AI Review completed successfully.");
        setAiReviewDialogOpen(true);
        toast.success("AI Review generated successfully");
      } else {
        toast.error("Failed to generate AI review");
      }
    } catch (error) {
      console.error("Error generating AI review:", error);
      toast.error("Failed to generate AI review");
    } finally {
      setGeneratingAIReview(false);
    }
  };

  const handleAddTask = async () => {
    setAddingTask(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/tasks`, {
        method: "POST",
      });

      if (response.ok) {
        fetchTaskList();
      } else {
        toast.error("Failed to add task");
      }
    } catch (error) {
      toast.error("Failed to add task");
    } finally {
      setAddingTask(false);
    }
  };

  const handleUpdateTask = async (taskId: string, field: string, value: string | boolean) => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, [field]: value }),
      });

      if (response.ok) {
        setTaskList((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t))
        );
      } else {
        toast.error("Failed to update task");
      }
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleUploadTaskDocument = async (taskId: string, file: File) => {
    setUploadingTaskDocument(taskId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/tasks/${taskId}/document`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Update task with document info
        await handleUpdateTask(taskId, "document", data.document);
        setTaskList((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, document: data.document, documentName: data.documentName }
              : t
          )
        );
        toast.success("Document uploaded successfully");
      } else {
        toast.error("Failed to upload document");
      }
    } catch (error) {
      toast.error("Failed to upload document");
    } finally {
      setUploadingTaskDocument(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/tasks?taskId=${taskId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        fetchTaskList();
        toast.success("Task deleted successfully");
      } else {
        toast.error("Failed to delete task");
      }
    } catch (error) {
      toast.error("Failed to delete task");
    }
  };

  const handleSaveTask = async (task: TaskItem) => {
    setSavingTask(task.id);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          task: task.task,
          executed: task.executed,
          comments: task.comments,
        }),
      });

      if (response.ok) {
        toast.success("Task saved successfully");
      } else {
        toast.error("Failed to save task");
      }
    } catch (error) {
      toast.error("Failed to save task");
    } finally {
      setSavingTask(null);
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
          {isAuditHead && (
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
          )}
          {workpapers.length > 0 ? (
            <div className="space-y-2">
              {workpapers.map((wp) => (
                <div
                  key={wp.id}
                  className="flex items-center gap-4 p-3 bg-white rounded border"
                >
                  <FileSpreadsheet className="h-8 w-8 text-green-600 flex-shrink-0" />
                  <a
                    href={`/api${wp.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1e3a5f] hover:underline font-medium flex-grow"
                  >
                    {wp.fileName}
                  </a>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="View"
                      onClick={() => window.open(`/api${wp.filePath}`, "_blank")}
                    >
                      <Eye className="h-5 w-5 text-gray-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Download"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = `/api${wp.filePath}`;
                        link.download = wp.fileName;
                        link.click();
                      }}
                    >
                      <Download className="h-5 w-5 text-gray-600" />
                    </Button>
                    {isAuditHead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => {
                          setWorkpaperToDelete(wp);
                          setDeleteWorkpaperDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-5 w-5 text-red-500" />
                      </Button>
                    )}
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
        <div className="space-y-4">
          {isAuditHead && (
            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                onClick={handleGenerateAIWorkpapers}
                disabled={generatingWorkpapers}
              >
                {generatingWorkpapers ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Workpaper with AI
                  </>
                )}
              </Button>
            </div>
          )}
          {aiWorkpapers.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="text-[#1e3a5f] font-semibold w-[200px]">Task</TableHead>
                  <TableHead className="text-[#1e3a5f] font-semibold w-[180px]">Evidences</TableHead>
                  <TableHead className="text-[#1e3a5f] font-semibold w-[250px]">Steps</TableHead>
                  <TableHead className="text-[#1e3a5f] font-semibold w-[120px]">Question Checklist</TableHead>
                  <TableHead className="text-[#1e3a5f] font-semibold w-[100px]">Comments</TableHead>
                  {isAuditHead && (
                    <TableHead className="text-[#1e3a5f] font-semibold w-[100px]">Action</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiWorkpapers.map((wp) => (
                  <TableRow key={wp.id} className="border-b hover:bg-gray-50">
                    <TableCell className="align-top py-4">
                      <div className="space-y-3">
                        <p className="text-gray-800">{wp.task}</p>
                        <div>
                          <span className="text-[#1e3a5f] font-medium block mb-1">Executed</span>
                          <Checkbox
                            checked={wp.executed}
                            onCheckedChange={() => handleToggleExecuted(wp.id, wp.executed)}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{wp.evidences}</p>
                    </TableCell>
                    <TableCell className="align-top py-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{wp.steps}</p>
                    </TableCell>
                    <TableCell className="align-top py-4 text-center">
                      {wp.questionChecklist || "-"}
                    </TableCell>
                    <TableCell className="align-top py-4 text-center">
                      {wp.comments || "-"}
                    </TableCell>
                    {isAuditHead && (
                      <TableCell className="align-top py-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            onClick={() => handleOpenEditAIWorkpaper(wp)}
                          >
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => {
                              setSelectedAIWorkpaper(wp);
                              setDeleteAIWorkpaperDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No AI-generated workpapers available</div>
          )}
        </div>
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
              onClick={handleAddTask}
              disabled={addingTask}
            >
              {addingTask ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Task
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-[#1e3a5f] hover:bg-[#1e3a5f]">
                <TableHead className="text-white w-[80px]">Ref No</TableHead>
                <TableHead className="text-white">Task</TableHead>
                <TableHead className="text-white w-[200px]">Document</TableHead>
                <TableHead className="text-white w-[100px] text-center">Executed</TableHead>
                <TableHead className="text-white">Comments</TableHead>
                {isAuditHead && <TableHead className="text-white w-[100px]">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {taskList.length > 0 ? (
                taskList.map((task) => (
                  <TableRow key={task.id} className="hover:bg-gray-50">
                    <TableCell>
                      <Input
                        value={task.refNo}
                        readOnly
                        className="w-16 bg-gray-50 text-center"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={task.task}
                        onChange={(e) => handleUpdateTask(task.id, "task", e.target.value)}
                        onBlur={(e) => handleUpdateTask(task.id, "task", e.target.value)}
                        placeholder="Enter task description"
                        className="border-gray-300"
                      />
                    </TableCell>
                    <TableCell>
                      {task.document ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={`/api${task.document}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm truncate max-w-[120px]"
                            title={task.documentName || "Document"}
                          >
                            {task.documentName || "View"}
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg";
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) handleUploadTaskDocument(task.id, file);
                              };
                              input.click();
                            }}
                          >
                            <Upload className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          disabled={uploadingTaskDocument === task.id}
                          onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg";
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleUploadTaskDocument(task.id, file);
                            };
                            input.click();
                          }}
                        >
                          {uploadingTaskDocument === task.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Upload className="h-3 w-3 mr-1" />
                              Upload
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={task.executed}
                        onCheckedChange={(checked) =>
                          handleUpdateTask(task.id, "executed", checked === true)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={task.comments}
                        onChange={(e) => handleUpdateTask(task.id, "comments", e.target.value)}
                        onBlur={(e) => handleUpdateTask(task.id, "comments", e.target.value)}
                        placeholder="Enter comments"
                        className="border-gray-300"
                      />
                    </TableCell>
                    {isAuditHead && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSaveTask(task)}
                            disabled={savingTask === task.id}
                            title="Save task"
                          >
                            {savingTask === task.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                            ) : (
                              <Save className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTask(task.id)}
                            title="Delete task"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={isAuditHead ? 6 : 5} className="text-center py-8 text-gray-500">
                    No tasks found. Click "Add Task" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CollapsibleSection>

      {/* Evidence Request Section */}
      <CollapsibleSection
        title="Evidence Request"
        isOpen={evidenceRequestOpen}
        onToggle={() => setEvidenceRequestOpen(!evidenceRequestOpen)}
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              {isAuditHead && selectedEvidenceIds.length > 0 && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleAIReview}
                  disabled={generatingAIReview}
                >
                  {generatingAIReview ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      AI Review ({selectedEvidenceIds.length})
                    </>
                  )}
                </Button>
              )}
            </div>
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
                <TableRow className="bg-[#1e3a5f] hover:bg-[#1e3a5f]">
                  {isAuditHead && (
                    <TableHead className="text-white w-[50px]">
                      <Checkbox
                        checked={selectedEvidenceIds.length === evidenceRequests.length && evidenceRequests.length > 0}
                        onCheckedChange={(checked) => handleSelectAllEvidence(checked === true)}
                        className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[#1e3a5f]"
                      />
                    </TableHead>
                  )}
                  <TableHead className="text-white">Title</TableHead>
                  <TableHead className="text-white">Description</TableHead>
                  <TableHead className="text-white">Auditee</TableHead>
                  <TableHead className="text-white">Due Date</TableHead>
                  <TableHead className="text-white">Status</TableHead>
                  <TableHead className="text-white">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidenceRequests.map((er) => (
                  <TableRow key={er.id} className="hover:bg-gray-50">
                    {isAuditHead && (
                      <TableCell>
                        <Checkbox
                          checked={selectedEvidenceIds.includes(er.id)}
                          onCheckedChange={(checked) => handleSelectEvidence(er.id, checked === true)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{er.title}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{er.description}</TableCell>
                    <TableCell>{er.auditee || "-"}</TableCell>
                    <TableCell>{formatDate(er.dueDate)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        er.status === 'Reviewed' ? 'bg-green-100 text-green-800' :
                        er.status === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                        er.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {er.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View"
                          onClick={() => handleOpenViewEvidence(er, false)}
                        >
                          <Eye className="h-4 w-4 text-gray-600" />
                        </Button>
                        {isAuditHead && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Add Attachment"
                              onClick={() => handleOpenAttachmentDialog(er)}
                            >
                              <Upload className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              onClick={() => handleOpenViewEvidence(er, true)}
                            >
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete"
                              onClick={() => {
                                setEvidenceToDelete(er);
                                setDeleteEvidenceDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
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
                setUploadedFiles([]);
                setNewDocument({ title: "", documentType: "", description: "" });
                setNewDocumentDialogOpen(true);
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
          {otherDocuments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#1e3a5f] hover:bg-[#1e3a5f]">
                  <TableHead className="text-white">Title</TableHead>
                  <TableHead className="text-white">Document Type</TableHead>
                  <TableHead className="text-white">Description</TableHead>
                  <TableHead className="text-white">File</TableHead>
                  <TableHead className="text-white">Uploaded</TableHead>
                  <TableHead className="text-white">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherDocuments.map((doc) => (
                  <TableRow key={doc.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{doc.title || doc.fileName}</TableCell>
                    <TableCell>{doc.documentType || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{doc.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">{doc.fileName}</span>
                        <span className="text-xs text-gray-400">({formatFileSize(doc.fileSize)})</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(doc.uploadedAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View"
                          onClick={() => handleOpenViewDocument(doc, false)}
                        >
                          <Eye className="h-4 w-4 text-gray-600" />
                        </Button>
                        {isAuditHead && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit"
                              onClick={() => handleOpenViewDocument(doc, true)}
                            >
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete"
                              onClick={() => {
                                setDocumentToDelete(doc);
                                setDeleteDocumentDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            {!isAuditHead && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddFindingDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Quick Add
              </Button>
            )}
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/internal-audit/fieldwork/${engagementId}/findings/${finding.id}`)}
                          title="View"
                        >
                          <Eye className="h-4 w-4 text-gray-600" />
                        </Button>
                        {isAuditHead && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/internal-audit/fieldwork/${engagementId}/findings/${finding.id}?edit=true`)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setFindingToDelete(finding);
                                setDeleteFindingDialogOpen(true);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
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
              <Select
                value={newEvidence.auditee}
                onValueChange={(value) => setNewEvidence({ ...newEvidence, auditee: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select auditee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.fullName}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Delete Finding Confirmation Dialog */}
      <Dialog open={deleteFindingDialogOpen} onOpenChange={setDeleteFindingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Finding</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the finding "{findingToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteFindingDialogOpen(false);
                setFindingToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFinding}
              disabled={deletingFinding}
            >
              {deletingFinding ? (
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

      {/* New Document Upload Dialog */}
      <Dialog open={newDocumentDialogOpen} onOpenChange={setNewDocumentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Title</Label>
              <Input
                value={newDocument.title}
                onChange={(e) => setNewDocument({ ...newDocument, title: e.target.value })}
                placeholder="Enter document title"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Document Type</Label>
              <Select
                value={newDocument.documentType}
                onValueChange={(value) => setNewDocument({ ...newDocument, documentType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Policy">Policy</SelectItem>
                  <SelectItem value="Procedure">Procedure</SelectItem>
                  <SelectItem value="Report">Report</SelectItem>
                  <SelectItem value="Evidence">Evidence</SelectItem>
                  <SelectItem value="Memo">Memo</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Description</Label>
              <Textarea
                value={newDocument.description}
                onChange={(e) => setNewDocument({ ...newDocument, description: e.target.value })}
                placeholder="Enter description"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Attach File</Label>
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
                <p className="text-gray-600">Click here, or drop files here to upload.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                />
              </div>
              {uploadedFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-gray-400">({formatFileSize(file.size)})</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewDocumentDialogOpen(false);
                setUploadedFiles([]);
                setNewDocument({ title: "", documentType: "", description: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleUploadDocument}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation Dialog */}
      <Dialog open={deleteDocumentDialogOpen} onOpenChange={setDeleteDocumentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{documentToDelete?.title || documentToDelete?.fileName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDocumentDialogOpen(false);
                setDocumentToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDocument}
              disabled={deletingDocument}
            >
              {deletingDocument ? (
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

      {/* Delete Workpaper Confirmation Dialog */}
      <Dialog open={deleteWorkpaperDialogOpen} onOpenChange={setDeleteWorkpaperDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Workpaper</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{workpaperToDelete?.fileName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteWorkpaperDialogOpen(false);
                setWorkpaperToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteWorkpaper}
              disabled={deletingWorkpaper}
            >
              {deletingWorkpaper ? (
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

      {/* Edit AI Workpaper Dialog */}
      <Dialog open={editAIWorkpaperDialogOpen} onOpenChange={setEditAIWorkpaperDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit AI Workpaper</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Task *</Label>
              <Input
                value={editAIWorkpaper.task}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, task: e.target.value })}
                placeholder="Enter task description"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Evidences</Label>
              <Textarea
                value={editAIWorkpaper.evidences}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, evidences: e.target.value })}
                placeholder="Enter evidences (one per line)"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Steps</Label>
              <Textarea
                value={editAIWorkpaper.steps}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, steps: e.target.value })}
                placeholder="Enter steps (one per line)"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Question Checklist</Label>
              <Input
                value={editAIWorkpaper.questionChecklist}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, questionChecklist: e.target.value })}
                placeholder="Enter question checklist"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Comments</Label>
              <Textarea
                value={editAIWorkpaper.comments}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, comments: e.target.value })}
                placeholder="Enter comments"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditAIWorkpaperDialogOpen(false);
                setSelectedAIWorkpaper(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleUpdateAIWorkpaper}
              disabled={savingAIWorkpaper}
            >
              {savingAIWorkpaper ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AI Workpaper Confirmation Dialog */}
      <Dialog open={deleteAIWorkpaperDialogOpen} onOpenChange={setDeleteAIWorkpaperDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete AI Workpaper</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this AI workpaper? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteAIWorkpaperDialogOpen(false);
                setSelectedAIWorkpaper(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAIWorkpaper}
              disabled={deletingAIWorkpaper}
            >
              {deletingAIWorkpaper ? (
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

      {/* Generated Workpaper with AI Dialog */}
      <Dialog open={generateAIDialogOpen} onOpenChange={setGenerateAIDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">Generated Workpaper with AI</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {generatingWorkpapers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
                <span className="ml-3 text-gray-600">Generating workpapers...</span>
              </div>
            ) : generatedWorkpapers.length > 0 ? (
              <div className="space-y-6">
                {generatedWorkpapers.map((wp) => (
                  <div
                    key={wp.id}
                    className={`border rounded-lg p-4 ${
                      selectedGeneratedIds.includes(wp.id)
                        ? "border-[#1e3a5f] bg-blue-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedGeneratedIds.includes(wp.id)}
                        onCheckedChange={() => handleToggleGeneratedSelection(wp.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-4">
                        <h4 className="font-semibold text-gray-900">{wp.task}</h4>

                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">Steps</h5>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap pl-4">
                            {wp.steps}
                          </p>
                        </div>

                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">Evidences</h5>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap pl-4">
                            {wp.evidences}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No workpapers generated. Click generate to create AI workpapers.
              </div>
            )}
          </div>
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setGenerateAIDialogOpen(false);
                setGeneratedWorkpapers([]);
                setSelectedGeneratedIds([]);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleAddSelectedWorkpapers}
              disabled={addingGeneratedWorkpapers || selectedGeneratedIds.length === 0}
            >
              {addingGeneratedWorkpapers ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                `Add Selected (${selectedGeneratedIds.length})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Document Dialog */}
      <Dialog open={viewEditDocumentDialogOpen} onOpenChange={setViewEditDocumentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditingDocument ? "Edit Document" : "Document Details"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Title</Label>
              {isEditingDocument ? (
                <Input
                  value={editDocument.title}
                  onChange={(e) => setEditDocument({ ...editDocument, title: e.target.value })}
                  placeholder="Enter document title"
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {selectedDocument?.title || selectedDocument?.fileName || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Document Type</Label>
              {isEditingDocument ? (
                <Select
                  value={editDocument.documentType}
                  onValueChange={(value) => setEditDocument({ ...editDocument, documentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Policy">Policy</SelectItem>
                    <SelectItem value="Procedure">Procedure</SelectItem>
                    <SelectItem value="Report">Report</SelectItem>
                    <SelectItem value="Evidence">Evidence</SelectItem>
                    <SelectItem value="Memo">Memo</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {selectedDocument?.documentType || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Description</Label>
              {isEditingDocument ? (
                <Textarea
                  value={editDocument.description}
                  onChange={(e) => setEditDocument({ ...editDocument, description: e.target.value })}
                  placeholder="Enter description"
                  rows={4}
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border min-h-[100px]">
                  {selectedDocument?.description || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Attached File</Label>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md border">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">{selectedDocument?.fileName}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(selectedDocument?.fileSize || 0)}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedDocument?.filePath) {
                      const link = document.createElement("a");
                      link.href = `/api${selectedDocument.filePath}`;
                      link.download = selectedDocument.fileName;
                      link.click();
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setViewEditDocumentDialogOpen(false);
                setSelectedDocument(null);
                setIsEditingDocument(false);
              }}
            >
              {isEditingDocument ? "Cancel" : "Close"}
            </Button>
            {isEditingDocument && (
              <Button
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                onClick={handleUpdateDocument}
                disabled={savingDocument}
              >
                {savingDocument ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Evidence Request Dialog */}
      <Dialog open={viewEditEvidenceDialogOpen} onOpenChange={setViewEditEvidenceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditingEvidence ? "Edit Evidence Request" : "Evidence Request Details"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Title *</Label>
              {isEditingEvidence ? (
                <Input
                  value={editEvidence.title}
                  onChange={(e) => setEditEvidence({ ...editEvidence, title: e.target.value })}
                  placeholder="Enter title"
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {selectedEvidence?.title || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Description</Label>
              {isEditingEvidence ? (
                <Textarea
                  value={editEvidence.description}
                  onChange={(e) => setEditEvidence({ ...editEvidence, description: e.target.value })}
                  placeholder="Enter description"
                  rows={3}
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border min-h-[80px]">
                  {selectedEvidence?.description || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Auditee</Label>
              {isEditingEvidence ? (
                <Select
                  value={editEvidence.auditee}
                  onValueChange={(value) => setEditEvidence({ ...editEvidence, auditee: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select auditee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.fullName}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {selectedEvidence?.auditee || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Due Date</Label>
              {isEditingEvidence ? (
                <Input
                  type="date"
                  value={editEvidence.dueDate}
                  onChange={(e) => setEditEvidence({ ...editEvidence, dueDate: e.target.value })}
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {selectedEvidence?.dueDate ? formatDate(selectedEvidence.dueDate) : "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Status</Label>
              {isEditingEvidence ? (
                <Select
                  value={editEvidence.status}
                  onValueChange={(value) => setEditEvidence({ ...editEvidence, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="Reviewed">Reviewed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedEvidence?.status === 'Reviewed' ? 'bg-green-100 text-green-800' :
                    selectedEvidence?.status === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedEvidence?.status || "-"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setViewEditEvidenceDialogOpen(false);
                setSelectedEvidence(null);
                setIsEditingEvidence(false);
              }}
            >
              {isEditingEvidence ? "Cancel" : "Close"}
            </Button>
            {isEditingEvidence && (
              <Button
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                onClick={handleUpdateEvidence}
                disabled={savingEvidence}
              >
                {savingEvidence ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Evidence Request Confirmation Dialog */}
      <Dialog open={deleteEvidenceDialogOpen} onOpenChange={setDeleteEvidenceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Evidence Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{evidenceToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteEvidenceDialogOpen(false);
                setEvidenceToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEvidence}
              disabled={deletingEvidence}
            >
              {deletingEvidence ? (
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

      {/* AI Review Result Dialog */}
      <Dialog open={aiReviewDialogOpen} onOpenChange={setAiReviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              AI Review Results
            </DialogTitle>
            <DialogDescription>
              AI-generated review of {selectedEvidenceIds.length} evidence request(s)
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {aiReviewResult ? (
              <div className="prose prose-sm max-w-none">
                <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-sm">
                  {aiReviewResult}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No review generated yet
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAiReviewDialogOpen(false);
                setAiReviewResult("");
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Attachment Dialog */}
      <Dialog open={attachmentDialogOpen} onOpenChange={setAttachmentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Attachment</DialogTitle>
            <DialogDescription>
              Upload attachment for: {evidenceForAttachment?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">Attach File</Label>
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
                <p className="text-gray-600">Click here, or drop files here to upload.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                />
              </div>
              {uploadedFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-gray-400">({formatFileSize(file.size)})</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAttachmentDialogOpen(false);
                setEvidenceForAttachment(null);
                setUploadedFiles([]);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleUploadAttachment}
              disabled={uploadingAttachment}
            >
              {uploadingAttachment ? (
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
    </div>
  );
}

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
  Paperclip,
  Check,
  AlertCircle,
} from "lucide-react";
import { useHasRole } from "@/hooks/usePermissions";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DatePicker } from "@/components/ui/date-picker";

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

interface EvidenceAttachment {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  uploadedAt: string;
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
  aiReviewStatus?: string | null;
  aiReviewComment?: string | null;
  clarificationComment?: string | null;
  clarificationDocumentName?: string | null;
  clarificationByUserName?: string | null;
  clarificationSentAt?: string | null;
  attachments?: EvidenceAttachment[];
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
  const { data: session } = useSession();
  const { t } = useLanguage();
  const currentUserId = session?.user?.id;
  const isAuditHead = useHasRole("AuditHead");
  const isAuditManager = useHasRole("AuditManager");
  const isAuditor = useHasRole("Auditor");
  const isAuditee = useHasRole("Auditee");

  // Check if user is part of the audit team (not just an auditee)
  const isAuditTeam = isAuditHead || isAuditManager || isAuditor;
  // Check if user is ONLY an auditee (not also part of audit team)
  const isAuditeeOnly = isAuditee && !isAuditTeam;

  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<Engagement | null>(null);

  // Check if engagement is completed (read-only mode)
  const isCompleted = engagement?.status === "Completed";

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
  const [auditees, setAuditees] = useState<{ id: string; fullName: string; department?: { name: string } | null }[]>([]);

  // Upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement>(null);
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
    auditeeId: "",
    dueDate: "",
    status: "",
    numberOfSamples: "",
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

  // Need Clarification dialog states (Audit Head sends)
  const [clarificationDialogOpen, setClarificationDialogOpen] = useState(false);
  const [clarificationEvidence, setClarificationEvidence] = useState<EvidenceRequest | null>(null);
  const [clarificationDocument, setClarificationDocument] = useState<string>("");
  const [clarificationComment, setClarificationComment] = useState<string>("");
  const [sendingClarification, setSendingClarification] = useState(false);

  // Auditee view clarification popup states
  const [auditeeClariDialogOpen, setAuditeeClariDialogOpen] = useState(false);
  const [auditeeClariEvidence, setAuditeeClariEvidence] = useState<EvidenceRequest | null>(null);

  // Auditee Respond dialog states
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [respondComment, setRespondComment] = useState<string>("");
  const [respondFiles, setRespondFiles] = useState<File[]>([]);
  const [sendingResponse, setSendingResponse] = useState(false);

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
    auditeeId: "",
    dueDate: "",
    numberOfSamples: "",
  });

  useEffect(() => {
    if (engagementId) {
      fetchEngagementDetails();
      fetchEvidenceRequests();
      fetchFindings();

      // Only fetch audit team data if not an auditee-only user
      if (!isAuditeeOnly) {
        fetchWorkpapers();
        fetchAIWorkpapers();
        fetchTaskList();
        fetchOtherDocuments();
        fetchAuditees();
      }
    }
  }, [engagementId, isAuditeeOnly]);

  const fetchEngagementDetails = async () => {
    try {
      const response = await fetch(`/api/internal-audit/engagements/${engagementId}`);
      if (response.ok) {
        const data = await response.json();
        setEngagement(data);
      }
    } catch (error) {
      console.error("Failed to fetch engagement:", error);
      toast.error(t("Failed to fetch engagement details"));
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

  const fetchAuditees = async () => {
    try {
      const response = await fetch("/api/users/my-auditees");
      if (response.ok) {
        const data = await response.json();
        const auditeeList = data.auditees || [];
        setAuditees(auditeeList.map((u: { id: string; fullName: string; department?: { name: string } | null }) => ({
          id: u.id,
          fullName: u.fullName,
          department: u.department,
        })));
      }
    } catch (error) {
      console.error("Failed to fetch auditees:", error);
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

  // Filter evidence requests for auditees - they only see requests assigned to them
  const filteredEvidenceRequests = isAuditee && !isAuditHead
    ? evidenceRequests.filter(er => er.auditeeId === currentUserId)
    : evidenceRequests;

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
      toast.error(t("Please select files to upload"));
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
        toast.success(t("Files uploaded successfully"));
        setUploadDialogOpen(false);
        setUploadedFiles([]);
        if (uploadCategory === "workpapers") {
          fetchWorkpapers();
        } else {
          fetchOtherDocuments();
        }
      } else {
        toast.error(t("Failed to upload files"));
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(t("Failed to upload files"));
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
      toast.error(t("Task is required"));
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
        toast.success(t("AI Workpaper updated successfully"));
        setEditAIWorkpaperDialogOpen(false);
        setSelectedAIWorkpaper(null);
      } else {
        toast.error(t("Failed to update AI Workpaper"));
      }
    } catch (error) {
      console.error("Error updating AI Workpaper:", error);
      toast.error(t("Failed to update AI Workpaper"));
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
        toast.success(t("AI Workpaper deleted successfully"));
        setDeleteAIWorkpaperDialogOpen(false);
        setSelectedAIWorkpaper(null);
      } else {
        toast.error(t("Failed to delete AI Workpaper"));
      }
    } catch (error) {
      console.error("Error deleting AI Workpaper:", error);
      toast.error(t("Failed to delete AI Workpaper"));
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
        toast.error(t("Failed to generate AI workpapers"));
      }
    } catch (error) {
      console.error("Error generating AI workpapers:", error);
      toast.error(t("Failed to generate AI workpapers"));
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
      toast.error(t("Please select at least one workpaper"));
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
        toast.success(t("Workpapers added successfully"));
        setGenerateAIDialogOpen(false);
        setGeneratedWorkpapers([]);
        setSelectedGeneratedIds([]);
      } else {
        toast.error(t("Failed to add workpapers"));
      }
    } catch (error) {
      console.error("Error adding workpapers:", error);
      toast.error(t("Failed to add workpapers"));
    } finally {
      setAddingGeneratedWorkpapers(false);
    }
  };

  const handleAddFinding = async () => {
    if (!newFinding.title.trim()) {
      toast.error(t("Finding title is required"));
      return;
    }

    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newFinding, status: "Open" }),
      });

      if (response.ok) {
        toast.success(t("Finding added successfully"));
        setAddFindingDialogOpen(false);
        setNewFinding({ title: "", description: "", severity: "Medium", recommendation: "" });
        fetchFindings();
      } else {
        toast.error(t("Failed to add finding"));
      }
    } catch (error) {
      toast.error(t("Failed to add finding"));
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
        toast.success(t("Finding deleted successfully"));
        setDeleteFindingDialogOpen(false);
        setFindingToDelete(null);
        fetchFindings();
      } else {
        toast.error(t("Failed to delete finding"));
      }
    } catch (error) {
      console.error("Error deleting finding:", error);
      toast.error(t("Failed to delete finding"));
    } finally {
      setDeletingFinding(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!newDocument.title.trim()) {
      toast.error(t("Document title is required"));
      return;
    }
    if (uploadedFiles.length === 0) {
      toast.error(t("Please select a file to upload"));
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
        toast.success(t("Document uploaded successfully"));
        setNewDocumentDialogOpen(false);
        setNewDocument({ title: "", documentType: "", description: "" });
        setUploadedFiles([]);
        fetchOtherDocuments();
      } else {
        toast.error(t("Failed to upload document"));
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(t("Failed to upload document"));
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
        toast.success(t("Document deleted successfully"));
        setDeleteDocumentDialogOpen(false);
        setDocumentToDelete(null);
        fetchOtherDocuments();
      } else {
        toast.error(t("Failed to delete document"));
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error(t("Failed to delete document"));
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
        toast.success(t("Workpaper deleted successfully"));
        setDeleteWorkpaperDialogOpen(false);
        setWorkpaperToDelete(null);
        fetchWorkpapers();
      } else {
        toast.error(t("Failed to delete workpaper"));
      }
    } catch (error) {
      console.error("Error deleting workpaper:", error);
      toast.error(t("Failed to delete workpaper"));
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
      toast.error(t("Document title is required"));
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
        toast.success(t("Document updated successfully"));
        setViewEditDocumentDialogOpen(false);
        setSelectedDocument(null);
        setIsEditingDocument(false);
        fetchOtherDocuments();
      } else {
        toast.error(t("Failed to update document"));
      }
    } catch (error) {
      console.error("Error updating document:", error);
      toast.error(t("Failed to update document"));
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
      auditeeId: er.auditeeId || "",
      dueDate: er.dueDate ? new Date(er.dueDate).toISOString().split("T")[0] : "",
      status: er.status || "Pending",
      numberOfSamples: er.numberOfSamples || "",
    });
    setIsEditingEvidence(editMode);
    setViewEditEvidenceDialogOpen(true);
  };

  const handleUpdateEvidence = async () => {
    if (!selectedEvidence) return;
    if (!editEvidence.title.trim()) {
      toast.error(t("Title is required"));
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
            auditeeId: editEvidence.auditeeId || null,
            dueDate: editEvidence.dueDate || null,
            status: editEvidence.status,
            numberOfSamples: editEvidence.numberOfSamples || null,
          }),
        }
      );

      if (response.ok) {
        toast.success(t("Evidence request updated successfully"));
        setViewEditEvidenceDialogOpen(false);
        setSelectedEvidence(null);
        setIsEditingEvidence(false);
        fetchEvidenceRequests();
      } else {
        toast.error(t("Failed to update evidence request"));
      }
    } catch (error) {
      console.error("Error updating evidence request:", error);
      toast.error(t("Failed to update evidence request"));
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
        toast.success(t("Evidence request deleted successfully"));
        setDeleteEvidenceDialogOpen(false);
        setEvidenceToDelete(null);
        fetchEvidenceRequests();
      } else {
        toast.error(t("Failed to delete evidence request"));
      }
    } catch (error) {
      console.error("Error deleting evidence request:", error);
      toast.error(t("Failed to delete evidence request"));
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
      toast.error(t("Please select a file to upload"));
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
        toast.success(t("Attachment uploaded successfully"));
        setAttachmentDialogOpen(false);
        setEvidenceForAttachment(null);
        setUploadedFiles([]);
        fetchEvidenceRequests();
      } else {
        toast.error(t("Failed to upload attachment"));
      }
    } catch (error) {
      console.error("Error uploading attachment:", error);
      toast.error(t("Failed to upload attachment"));
    } finally {
      setUploadingAttachment(false);
    }
  };

  // Evidence Request Approval handlers
  const handleApproveEvidence = async (evidenceId: string) => {
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${evidenceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Reviewed",
            aiReviewStatus: "Satisfactory",
          }),
        }
      );

      if (response.ok) {
        toast.success(t("Evidence request approved"));
        fetchEvidenceRequests();
      } else {
        toast.error(t("Failed to approve evidence request"));
      }
    } catch (error) {
      console.error("Error approving evidence:", error);
      toast.error(t("Failed to approve evidence request"));
    }
  };

  // Open clarification dialog
  const handleOpenClarificationDialog = (evidence: EvidenceRequest) => {
    setClarificationEvidence(evidence);
    setClarificationDocument(evidence.attachments?.[0]?.fileName || "");
    setClarificationComment("");
    setClarificationDialogOpen(true);
  };

  // Send clarification request
  const handleSendClarification = async () => {
    if (!clarificationEvidence) return;

    setSendingClarification(true);
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${clarificationEvidence.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Pending",
            aiReviewStatus: "Needs Attention",
            clarificationComment: clarificationComment,
            clarificationDocumentName: clarificationDocument,
            clarificationByUserId: session?.user?.id,
            clarificationByUserName: session?.user?.name,
            clarificationSentAt: new Date().toISOString(),
          }),
        }
      );

      if (response.ok) {
        toast.success(t("The document has been returned for clarification"));
        setClarificationDialogOpen(false);
        setClarificationEvidence(null);
        setClarificationDocument("");
        setClarificationComment("");
        setViewEditEvidenceDialogOpen(false);
        setSelectedEvidence(null);
        fetchEvidenceRequests();
      } else {
        toast.error(t("Failed to request clarification"));
      }
    } catch (error) {
      console.error("Error requesting clarification:", error);
      toast.error(t("Failed to request clarification"));
    } finally {
      setSendingClarification(false);
    }
  };

  // Auditee Send Response handler
  const handleSendResponse = async () => {
    if (!auditeeClariEvidence) return;

    setSendingResponse(true);
    try {
      // Upload file if provided
      if (respondFiles.length > 0) {
        const formData = new FormData();
        respondFiles.forEach((file) => {
          formData.append("files", file);
        });

        await fetch(
          `/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${auditeeClariEvidence.id}/attachments`,
          {
            method: "POST",
            body: formData,
          }
        );
      }

      // Update status to Submitted and clear clarification
      await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${auditeeClariEvidence.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "Submitted",
            clarificationComment: null,
            clarificationDocumentName: null,
            clarificationByUserId: null,
            clarificationByUserName: null,
            clarificationSentAt: null,
          }),
        }
      );

      toast.success(t("Response submitted successfully"));
      setRespondDialogOpen(false);
      setAuditeeClariDialogOpen(false);
      setAuditeeClariEvidence(null);
      setRespondComment("");
      setRespondFiles([]);
      setViewEditEvidenceDialogOpen(false);
      setSelectedEvidence(null);
      fetchEvidenceRequests();
    } catch (error) {
      console.error("Error sending response:", error);
      toast.error(t("Failed to send response"));
    } finally {
      setSendingResponse(false);
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
      setSelectedEvidenceIds(filteredEvidenceRequests.map((er) => er.id));
    } else {
      setSelectedEvidenceIds([]);
    }
  };

  const handleAIReview = async () => {
    if (selectedEvidenceIds.length === 0) {
      toast.error(t("Please select at least one evidence request"));
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
        toast.success(t("AI Review generated successfully"));
      } else {
        toast.error(t("Failed to generate AI review"));
      }
    } catch (error) {
      console.error("Error generating AI review:", error);
      toast.error(t("Failed to generate AI review"));
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
        toast.error(t("Failed to add task"));
      }
    } catch (error) {
      toast.error(t("Failed to add task"));
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
        toast.error(t("Failed to update task"));
      }
    } catch (error) {
      toast.error(t("Failed to update task"));
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
        toast.success(t("Document uploaded successfully"));
      } else {
        toast.error(t("Failed to upload document"));
      }
    } catch (error) {
      toast.error(t("Failed to upload document"));
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
        toast.success(t("Task deleted successfully"));
      } else {
        toast.error(t("Failed to delete task"));
      }
    } catch (error) {
      toast.error(t("Failed to delete task"));
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
        toast.success(t("Task saved successfully"));
      } else {
        toast.error(t("Failed to save task"));
      }
    } catch (error) {
      toast.error(t("Failed to save task"));
    } finally {
      setSavingTask(null);
    }
  };

  const handleAddEvidence = async () => {
    if (!newEvidence.title.trim()) {
      toast.error(t("Evidence title is required"));
      return;
    }

    try {
      const payload = {
        title: newEvidence.title,
        description: newEvidence.description,
        auditee: newEvidence.auditee,
        auditeeId: newEvidence.auditeeId || null,
        dueDate: newEvidence.dueDate,
        numberOfSamples: newEvidence.numberOfSamples || null,
        status: "Pending",
      };

      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(t("Evidence request added successfully"));
        setAddEvidenceDialogOpen(false);
        setNewEvidence({ title: "", description: "", auditee: "", auditeeId: "", dueDate: "", numberOfSamples: "" });
        fetchEvidenceRequests();
      } else {
        toast.error(t("Failed to add evidence request"));
      }
    } catch (error) {
      toast.error(t("Failed to add evidence request"));
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
        toast.success(t("Engagement marked as completed"));
        setEngagement({ ...engagement, status: "Completed" });
      } else {
        toast.error(t("Failed to mark engagement as completed"));
      }
    } catch (error) {
      console.error("Error marking engagement as completed:", error);
      toast.error(t("Failed to mark engagement as completed"));
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
            {t("Back")}
          </Button>
          <span className="text-gray-500">{t("Internal Audit")}</span>
          <span className="text-[#1e3a5f] font-semibold">{t("Field Work")}</span>
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
            {t("Back")}
          </Button>
          <span className="text-gray-500">{t("Internal Audit")}</span>
          <span className="text-[#1e3a5f] font-semibold">{t("Field Work")}</span>
        </div>
        <div className="text-center py-8 text-gray-500">{t("Engagement not found")}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Completed Status Banner */}
      {isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <Check className="h-5 w-5 text-green-600" />
          <span className="text-green-800 font-medium">
            {t("This engagement has been completed and is now in read-only mode.")}
          </span>
        </div>
      )}

      {/* Breadcrumb Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/internal-audit/fieldwork")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("Back")}
        </Button>
        <span className="text-gray-500">|</span>
        <span className="text-gray-500">{t("Internal Audit")}</span>
        <span className="text-gray-500">|</span>
        <span className="text-[#1e3a5f] font-semibold">{t("Field Work")}</span>
      </div>

      {/* Engagement Details Section */}
      <CollapsibleSection
        title={`${t("Engagement Details")} : ${engagement.auditId} - ${engagement.engagementTitle}`}
        isOpen={engagementDetailsOpen}
        onToggle={() => setEngagementDetailsOpen(!engagementDetailsOpen)}
        headerAction={
          <div className="flex items-center gap-2">
            {/* Hide Comments button for auditees */}
            {!isAuditeeOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setCommentsDialogOpen(true);
              }}
            >
              {t("Comments")}
            </Button>
            )}
            {/* Hide Mark as Completed button for auditees */}
            {engagement.status !== "Completed" && !isAuditeeOnly && (
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
                    {t("Marking...")}
                  </>
                ) : (
                  t("Mark as Completed")
                )}
              </Button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-6 p-4 bg-white rounded-lg border">
          <div>
            <Label className="text-[#1e3a5f] font-medium">{t("Engagement ID")}</Label>
            <p className="mt-1">{engagement.auditId}</p>
          </div>
          <div>
            <Label className="text-[#1e3a5f] font-medium">{t("Title")}</Label>
            <p className="mt-1">{engagement.engagementTitle}</p>
          </div>
          <div>
            <Label className="text-[#1e3a5f] font-medium">{t("Auditor")}</Label>
            <p className="mt-1">{getAuditorName()}</p>
          </div>
          <div>
            <Label className="text-[#1e3a5f] font-medium">{t("Timeline")}</Label>
            <p className="mt-1">
              {formatDate(engagement.startDate)} {t("to")} {formatDate(engagement.endDate)}
            </p>
          </div>
          <div>
            <Label className="text-[#1e3a5f] font-medium">{t("Status")}</Label>
            <p className="mt-1">{engagement.status}</p>
          </div>
          <div>
            <Label className="text-[#1e3a5f] font-medium">{t("Department")}</Label>
            <p className="mt-1">{engagement.department?.name || "-"}</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Workpapers Section - Hidden for auditees */}
      {!isAuditeeOnly && (
      <CollapsibleSection
        title={t("Workpapers")}
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
                {t("Upload Workpaper")}
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
                      title={t("View")}
                      onClick={() => window.open(`/api${wp.filePath}`, "_blank")}
                    >
                      <Eye className="h-5 w-5 text-gray-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t("Download")}
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
                        title={t("Delete")}
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
            <div className="text-center py-8 text-gray-500">{t("No workpapers uploaded yet")}</div>
          )}
        </div>
      </CollapsibleSection>
      )}

      {/* AI-Generated Workpapers Section - Hidden for auditees */}
      {!isAuditeeOnly && (
      <CollapsibleSection
        title={t("AI-Generated Workpapers")}
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
                disabled={generatingWorkpapers || isCompleted}
              >
                {generatingWorkpapers ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("Generating...")}
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    {t("Generate Workpaper with AI")}
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
                  <TableHead className="text-[#1e3a5f] font-semibold w-[200px]">{t("Task")}</TableHead>
                  <TableHead className="text-[#1e3a5f] font-semibold w-[180px]">{t("Evidences")}</TableHead>
                  <TableHead className="text-[#1e3a5f] font-semibold w-[250px]">{t("Steps")}</TableHead>
                  <TableHead className="text-[#1e3a5f] font-semibold w-[120px]">{t("Question Checklist")}</TableHead>
                  <TableHead className="text-[#1e3a5f] font-semibold w-[100px]">{t("Comments")}</TableHead>
                  {isAuditHead && (
                    <TableHead className="text-[#1e3a5f] font-semibold w-[100px]">{t("Action")}</TableHead>
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
                          <span className="text-[#1e3a5f] font-medium block mb-1">{t("Executed")}</span>
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
                            title={t("Edit")}
                            onClick={() => handleOpenEditAIWorkpaper(wp)}
                          >
                            <Pencil className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("Delete")}
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
            <div className="text-center py-8 text-gray-500">{t("No AI-generated workpapers available")}</div>
          )}
        </div>
      </CollapsibleSection>
      )}

      {/* Audit Engagement Task List Section - Hidden for auditees */}
      {!isAuditeeOnly && (
      <CollapsibleSection
        title={t("Audit Engagement Task List")}
        isOpen={taskListOpen}
        onToggle={() => setTaskListOpen(!taskListOpen)}
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleAddTask}
              disabled={addingTask || isCompleted}
            >
              {addingTask ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {t("Add Task")}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-[#1e3a5f] hover:bg-[#1e3a5f]">
                <TableHead className="text-white w-[80px]">{t("Ref No")}</TableHead>
                <TableHead className="text-white">{t("Task")}</TableHead>
                <TableHead className="text-white w-[200px]">{t("Document")}</TableHead>
                <TableHead className="text-white w-[100px] text-center">{t("Executed")}</TableHead>
                <TableHead className="text-white">{t("Comments")}</TableHead>
                {isAuditHead && <TableHead className="text-white w-[100px]">{t("Action")}</TableHead>}
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
                        placeholder={t("Enter task description")}
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
                            title={task.documentName || t("Document")}
                          >
                            {task.documentName || t("View")}
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
                          disabled={uploadingTaskDocument === task.id || isCompleted}
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
                              {t("Upload")}
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
                        placeholder={t("Enter comments")}
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
                            disabled={savingTask === task.id || isCompleted}
                            title={t("Save task")}
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
                            title={t("Delete task")}
                            disabled={isCompleted}
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
                    {t("No tasks found. Click \"Add Task\" to create one.")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CollapsibleSection>
      )}

      {/* Evidence Request Section - Visible for auditees */}
      <CollapsibleSection
        title={t("Evidence Request")}
        isOpen={evidenceRequestOpen}
        onToggle={() => setEvidenceRequestOpen(!evidenceRequestOpen)}
      >
        <div className="space-y-4">
          {/* Header with buttons - only for audit team */}
          {!isAuditeeOnly && (
            <div className="flex justify-between items-center">
              <div>
                {isAuditHead && selectedEvidenceIds.length > 0 && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleAIReview}
                    disabled={generatingAIReview || isCompleted}
                  >
                    {generatingAIReview ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t("Generating...")}
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        {t("AI Review")} ({selectedEvidenceIds.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
              {isAuditHead && (
                <Button
                  size="sm"
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  onClick={() => setAddEvidenceDialogOpen(true)}
                  disabled={isCompleted}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("Add Evidence Request")}
                </Button>
              )}
            </div>
          )}

          {/* Card-based UI for Auditees (like VerifAI) */}
          {isAuditeeOnly ? (
            filteredEvidenceRequests.length > 0 ? (
              <div className="space-y-4">
                {filteredEvidenceRequests.map((er) => (
                  <div key={er.id} className="bg-[#f8fafc] rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <div className="pt-1">
                        <Checkbox
                          checked={selectedEvidenceIds.includes(er.id)}
                          onCheckedChange={(checked) => handleSelectEvidence(er.id, checked === true)}
                          className="border-[#1e3a5f] data-[state=checked]:bg-[#1e3a5f] data-[state=checked]:text-white"
                        />
                      </div>

                      {/* Left side - Title & Description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[#1e3a5f] font-semibold">
                            {t("Title")} : {er.title}
                          </span>
                          <span className="text-gray-400">|</span>
                          <span className="text-[#1e3a5f] font-semibold">
                            {t("Sample Size")} : {er.numberOfSamples || "-"}
                          </span>
                        </div>
                        <p className="text-gray-500 text-sm">
                          {t("Description")}: {er.description || "-"}
                        </p>
                        {/* Uploaded files info */}
                        {er.attachments && er.attachments.length > 0 && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                            <FileText className="h-4 w-4" />
                            <span>{er.attachments.length} {t("file(s) uploaded")}</span>
                          </div>
                        )}
                      </div>

                      {/* Middle - AI Review Section */}
                      <div className="flex-shrink-0 w-[280px]">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">{t("AI Review")}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          {er.aiReviewStatus === 'Satisfactory' ? (
                            <>
                              <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                              <span className="text-sm text-green-600 font-medium">{t("Satisfactory")}</span>
                            </>
                          ) : er.aiReviewStatus === 'Needs Attention' ? (
                            <>
                              <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                                <span className="text-white text-xs">✕</span>
                              </div>
                              <span className="text-sm text-red-600 font-medium">{t("Needs Attention")}</span>
                            </>
                          ) : (
                            <>
                              <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
                                <span className="text-white text-xs">⏳</span>
                              </div>
                              <span className="text-sm text-yellow-600 font-medium">
                                {er.status === 'Submitted' ? t('Awaiting Review') : t('Pending')}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-amber-600 line-clamp-2">
                          {!er.aiReviewStatus && er.status === 'Pending'
                            ? t('Waiting for document upload and review.')
                            : !er.aiReviewStatus && er.status === 'Submitted'
                            ? t('Document submitted. Awaiting AI review.')
                            : er.aiReviewStatus
                            ? t('AI review completed.')
                            : t('Awaiting review.')}
                        </p>
                      </div>

                      {/* Right side - Action Icons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("View Details")}
                          onClick={() => handleOpenViewEvidence(er, false)}
                          className="h-8 w-8"
                        >
                          <Eye className="h-5 w-5 text-[#1e3a5f]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("Add Attachment")}
                          onClick={() => handleOpenAttachmentDialog(er)}
                          className="h-8 w-8"
                        >
                          <Paperclip className="h-5 w-5 text-[#1e3a5f]" />
                        </Button>
                      </div>
                    </div>
                    {/* Submit Response Button - only show when status is Pending */}
                    {er.status === 'Pending' && (
                      <div className="flex justify-end mt-4">
                        <Button
                          className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                          onClick={() => {
                            setAuditeeClariEvidence(er);
                            setRespondDialogOpen(true);
                          }}
                        >
                          {t("Submit Response")}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">{t("No evidence requests found")}</div>
            )
          ) : (
            /* Table-based UI for Audit Team */
            filteredEvidenceRequests.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#1e3a5f] hover:bg-[#1e3a5f]">
                    {isAuditHead && (
                      <TableHead className="text-white w-[50px]">
                        <Checkbox
                          checked={selectedEvidenceIds.length === filteredEvidenceRequests.length && filteredEvidenceRequests.length > 0}
                          onCheckedChange={(checked) => handleSelectAllEvidence(checked === true)}
                          className="border-white data-[state=checked]:bg-white data-[state=checked]:text-[#1e3a5f]"
                        />
                      </TableHead>
                    )}
                    <TableHead className="text-white">{t("Title")}</TableHead>
                    <TableHead className="text-white">{t("Description")}</TableHead>
                    <TableHead className="text-white">{t("Auditee")}</TableHead>
                    <TableHead className="text-white">{t("Samples")}</TableHead>
                    <TableHead className="text-white">{t("Due Date")}</TableHead>
                    <TableHead className="text-white">{t("Status")}</TableHead>
                    <TableHead className="text-white">{t("AI Review")}</TableHead>
                    <TableHead className="text-white">{t("Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvidenceRequests.map((er) => (
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
                      <TableCell>{er.numberOfSamples || "-"}</TableCell>
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
                        {er.aiReviewStatus ? (
                          <div className="flex items-center gap-1">
                            {er.aiReviewStatus === 'Satisfactory' ? (
                              <>
                                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                  <span className="text-white text-xs">✓</span>
                                </div>
                                <span className="text-sm text-green-600 font-medium">{t("Satisfactory")}</span>
                              </>
                            ) : (
                              <>
                                <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                                  <span className="text-white text-xs">✕</span>
                                </div>
                                <span className="text-sm text-red-600 font-medium">{t("Needs Attention")}</span>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("View")}
                            onClick={() => handleOpenViewEvidence(er, false)}
                          >
                            <Eye className="h-4 w-4 text-gray-600" />
                          </Button>
                          {/* Auditees can upload attachments to their own evidence requests */}
                          {(isAuditHead || (isAuditee && er.auditeeId === currentUserId)) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("Add Attachment")}
                              onClick={() => handleOpenAttachmentDialog(er)}
                            >
                              <Upload className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {/* Only Audit Heads can edit and delete */}
                          {isAuditHead && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t("Edit")}
                                onClick={() => handleOpenViewEvidence(er, true)}
                              >
                                <Pencil className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t("Delete")}
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
              <div className="text-center py-8 text-gray-500">{t("No evidence requests found")}</div>
            )
          )}
        </div>
      </CollapsibleSection>

      {/* Other Documents Section - Hidden for auditees */}
      {!isAuditeeOnly && (
      <CollapsibleSection
        title={t("Other Documents")}
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
              {t("Upload Document")}
            </Button>
          </div>
          {otherDocuments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#1e3a5f] hover:bg-[#1e3a5f]">
                  <TableHead className="text-white">{t("Title")}</TableHead>
                  <TableHead className="text-white">{t("Document Type")}</TableHead>
                  <TableHead className="text-white">{t("Description")}</TableHead>
                  <TableHead className="text-white">{t("File")}</TableHead>
                  <TableHead className="text-white">{t("Uploaded")}</TableHead>
                  <TableHead className="text-white">{t("Action")}</TableHead>
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
                          title={t("View")}
                          onClick={() => handleOpenViewDocument(doc, false)}
                        >
                          <Eye className="h-4 w-4 text-gray-600" />
                        </Button>
                        {isAuditHead && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("Edit")}
                              onClick={() => handleOpenViewDocument(doc, true)}
                            >
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("Delete")}
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
            <div className="text-center py-8 text-gray-500">{t("No other documents uploaded yet")}</div>
          )}
        </div>
      </CollapsibleSection>
      )}

      {/* Findings Section - Visible for auditees */}
      <CollapsibleSection
        title={t("Findings")}
        isOpen={findingsOpen}
        onToggle={() => setFindingsOpen(!findingsOpen)}
      >
        <div className="space-y-4">
          {/* Hide Add Finding buttons for auditees - they can only view findings */}
          {!isAuditeeOnly && (
          <div className="flex justify-end gap-2">
            {!isAuditHead && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddFindingDialogOpen(true)}
                disabled={isCompleted}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("Quick Add")}
              </Button>
            )}
            <Button
              size="sm"
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={() => router.push(`/internal-audit/fieldwork/${engagementId}/add-finding`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("Add Finding (Full Form)")}
            </Button>
          </div>
          )}
          {findings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#1e3a5f] hover:bg-[#1e3a5f]">
                  <TableHead className="text-white">{t("Finding ID")}</TableHead>
                  <TableHead className="text-white">{t("Title")}</TableHead>
                  <TableHead className="text-white">{t("Severity")}</TableHead>
                  <TableHead className="text-white">{t("Responsible Person")}</TableHead>
                  <TableHead className="text-white">{t("Target Date")}</TableHead>
                  <TableHead className="text-white">{t("Status")}</TableHead>
                  <TableHead className="text-white">{t("Action")}</TableHead>
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
                          title={t("View")}
                        >
                          <Eye className="h-4 w-4 text-gray-600" />
                        </Button>
                        {isAuditHead && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/internal-audit/fieldwork/${engagementId}/findings/${finding.id}?edit=true`)}
                              title={t("Edit")}
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
                              title={t("Delete")}
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
            <div className="text-center py-8 text-gray-500">{t("No findings recorded yet")}</div>
          )}
        </div>
      </CollapsibleSection>

      {/* Comments Dialog */}
      <Dialog open={commentsDialogOpen} onOpenChange={setCommentsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Engagement Comments")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder={t("Add a comment...")} rows={4} />
            <div className="text-sm text-gray-500">{t("No comments yet")}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentsDialogOpen(false)}>
              {t("Close")}
            </Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]">{t("Add Comment")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("Upload")} {uploadCategory === "workpapers" ? t("Workpaper") : t("Document")}
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
              <p className="text-gray-600">{t("Drag and drop files here, or click to browse")}</p>
              <p className="text-sm text-gray-400 mt-1">
                {t("Supported formats")}: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG
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
              {t("Cancel")}
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleUploadFiles}
              disabled={uploading || uploadedFiles.length === 0 || isCompleted}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Uploading...")}
                </>
              ) : (
                t("Upload")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Finding Dialog */}
      <Dialog open={addFindingDialogOpen} onOpenChange={setAddFindingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Add Finding")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Title")} *</Label>
              <Input
                value={newFinding.title}
                onChange={(e) => setNewFinding({ ...newFinding, title: e.target.value })}
                placeholder={t("Enter finding title")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Description")}</Label>
              <Textarea
                value={newFinding.description}
                onChange={(e) => setNewFinding({ ...newFinding, description: e.target.value })}
                placeholder={t("Enter description")}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Severity")}</Label>
              <Select
                value={newFinding.severity}
                onValueChange={(value) => setNewFinding({ ...newFinding, severity: value })}
              >
                <SelectTrigger>
                  <SelectValue />
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
              <Label>{t("Recommendation")}</Label>
              <Textarea
                value={newFinding.recommendation}
                onChange={(e) => setNewFinding({ ...newFinding, recommendation: e.target.value })}
                placeholder={t("Enter recommendation")}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFindingDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={handleAddFinding}>
              {t("Add Finding")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Evidence Request Dialog */}
      <Dialog open={addEvidenceDialogOpen} onOpenChange={setAddEvidenceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Add Evidence Request")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Title")} *</Label>
              <Input
                value={newEvidence.title}
                onChange={(e) => setNewEvidence({ ...newEvidence, title: e.target.value })}
                placeholder={t("Enter evidence request title")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Description")}</Label>
              <Textarea
                value={newEvidence.description}
                onChange={(e) => setNewEvidence({ ...newEvidence, description: e.target.value })}
                placeholder={t("Enter description")}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Auditee")} *</Label>
              <Select
                value={newEvidence.auditeeId}
                onValueChange={(value) => {
                  const selectedAuditee = auditees.find(a => a.id === value);
                  setNewEvidence({
                    ...newEvidence,
                    auditeeId: value,
                    auditee: selectedAuditee?.fullName || ""
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select auditee")} />
                </SelectTrigger>
                <SelectContent>
                  {auditees.map((auditee) => (
                    <SelectItem key={auditee.id} value={auditee.id}>
                      {auditee.fullName} {auditee.department?.name ? `(${auditee.department.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("Number of Samples")}</Label>
              <Input
                type="number"
                min="1"
                value={newEvidence.numberOfSamples}
                onChange={(e) => setNewEvidence({ ...newEvidence, numberOfSamples: e.target.value })}
                placeholder={t("Enter number of samples required")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Due Date")}</Label>
              <DatePicker
                value={newEvidence.dueDate}
                onChange={(date) => setNewEvidence({ ...newEvidence, dueDate: date ? date.toISOString().split('T')[0] : "" })}
                placeholder={t("Select due date")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEvidenceDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f]" onClick={handleAddEvidence}>
              {t("Add Evidence Request")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Finding Confirmation Dialog */}
      <Dialog open={deleteFindingDialogOpen} onOpenChange={setDeleteFindingDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Delete Finding")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete the finding")} "{findingToDelete?.title}"? {t("This action cannot be undone.")}
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
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFinding}
              disabled={deletingFinding || isCompleted}
            >
              {deletingFinding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Document Upload Dialog */}
      <Dialog open={newDocumentDialogOpen} onOpenChange={setNewDocumentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("New Document")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Title")}</Label>
              <Input
                value={newDocument.title}
                onChange={(e) => setNewDocument({ ...newDocument, title: e.target.value })}
                placeholder={t("Enter document title")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Document Type")}</Label>
              <Select
                value={newDocument.documentType}
                onValueChange={(value) => setNewDocument({ ...newDocument, documentType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select document type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Minutes of Meeting">{t("Minutes of Meeting")}</SelectItem>
                  <SelectItem value="Approval Document">{t("Approval Document")}</SelectItem>
                  <SelectItem value="Email Communication">{t("Email Communication")}</SelectItem>
                  <SelectItem value="Contract">{t("Contract")}</SelectItem>
                  <SelectItem value="Invoice">{t("Invoice")}</SelectItem>
                  <SelectItem value="Policy Document">{t("Policy Document")}</SelectItem>
                  <SelectItem value="Other">{t("Other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Description")}</Label>
              <Textarea
                value={newDocument.description}
                onChange={(e) => setNewDocument({ ...newDocument, description: e.target.value })}
                placeholder={t("Enter description")}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Attach File")}</Label>
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
                <p className="text-gray-600">{t("Click here, or drop files here to upload.")}</p>
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
              {t("Cancel")}
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleUploadDocument}
              disabled={uploading || isCompleted}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Saving...")}
                </>
              ) : (
                t("Save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation Dialog */}
      <Dialog open={deleteDocumentDialogOpen} onOpenChange={setDeleteDocumentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Delete Document")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete")} "{documentToDelete?.title || documentToDelete?.fileName}"? {t("This action cannot be undone.")}
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
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDocument}
              disabled={deletingDocument || isCompleted}
            >
              {deletingDocument ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Workpaper Confirmation Dialog */}
      <Dialog open={deleteWorkpaperDialogOpen} onOpenChange={setDeleteWorkpaperDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Delete Workpaper")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete")} "{workpaperToDelete?.fileName}"? {t("This action cannot be undone.")}
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
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteWorkpaper}
              disabled={deletingWorkpaper || isCompleted}
            >
              {deletingWorkpaper ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit AI Workpaper Dialog */}
      <Dialog open={editAIWorkpaperDialogOpen} onOpenChange={setEditAIWorkpaperDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Edit AI Workpaper")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Task")} *</Label>
              <Input
                value={editAIWorkpaper.task}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, task: e.target.value })}
                placeholder={t("Enter task description")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Evidences")}</Label>
              <Textarea
                value={editAIWorkpaper.evidences}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, evidences: e.target.value })}
                placeholder={t("Enter evidences (one per line)")}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Steps")}</Label>
              <Textarea
                value={editAIWorkpaper.steps}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, steps: e.target.value })}
                placeholder={t("Enter steps (one per line)")}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Question Checklist")}</Label>
              <Input
                value={editAIWorkpaper.questionChecklist}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, questionChecklist: e.target.value })}
                placeholder={t("Enter question checklist")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Comments")}</Label>
              <Textarea
                value={editAIWorkpaper.comments}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, comments: e.target.value })}
                placeholder={t("Enter comments")}
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
              {t("Cancel")}
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleUpdateAIWorkpaper}
              disabled={savingAIWorkpaper || isCompleted}
            >
              {savingAIWorkpaper ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Saving...")}
                </>
              ) : (
                t("Save Changes")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AI Workpaper Confirmation Dialog */}
      <Dialog open={deleteAIWorkpaperDialogOpen} onOpenChange={setDeleteAIWorkpaperDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Delete AI Workpaper")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete this AI workpaper?")} {t("This action cannot be undone.")}
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
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAIWorkpaper}
              disabled={deletingAIWorkpaper || isCompleted}
            >
              {deletingAIWorkpaper ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated Workpaper with AI Dialog */}
      <Dialog open={generateAIDialogOpen} onOpenChange={setGenerateAIDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">{t("Generated Workpaper with AI")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {generatingWorkpapers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
                <span className="ml-3 text-gray-600">{t("Generating workpapers...")}</span>
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
                          <h5 className="font-medium text-gray-700 mb-2">{t("Steps")}</h5>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap pl-4">
                            {wp.steps}
                          </p>
                        </div>

                        <div>
                          <h5 className="font-medium text-gray-700 mb-2">{t("Evidences")}</h5>
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
                {t("No workpapers generated. Click generate to create AI workpapers.")}
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
              {t("Cancel")}
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleAddSelectedWorkpapers}
              disabled={addingGeneratedWorkpapers || selectedGeneratedIds.length === 0 || isCompleted}
            >
              {addingGeneratedWorkpapers ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Adding...")}
                </>
              ) : (
                `${t("Add Selected")} (${selectedGeneratedIds.length})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Document Dialog */}
      <Dialog open={viewEditDocumentDialogOpen} onOpenChange={setViewEditDocumentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditingDocument ? t("Edit Document") : t("Document Details")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Title")}</Label>
              {isEditingDocument ? (
                <Input
                  value={editDocument.title}
                  onChange={(e) => setEditDocument({ ...editDocument, title: e.target.value })}
                  placeholder={t("Enter document title")}
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {selectedDocument?.title || selectedDocument?.fileName || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Document Type")}</Label>
              {isEditingDocument ? (
                <Select
                  value={editDocument.documentType}
                  onValueChange={(value) => setEditDocument({ ...editDocument, documentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select document type")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Minutes of Meeting">{t("Minutes of Meeting")}</SelectItem>
                    <SelectItem value="Approval Document">{t("Approval Document")}</SelectItem>
                    <SelectItem value="Email Communication">{t("Email Communication")}</SelectItem>
                    <SelectItem value="Contract">{t("Contract")}</SelectItem>
                    <SelectItem value="Invoice">{t("Invoice")}</SelectItem>
                    <SelectItem value="Policy Document">{t("Policy Document")}</SelectItem>
                    <SelectItem value="Other">{t("Other")}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {selectedDocument?.documentType || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Description")}</Label>
              {isEditingDocument ? (
                <Textarea
                  value={editDocument.description}
                  onChange={(e) => setEditDocument({ ...editDocument, description: e.target.value })}
                  placeholder={t("Enter description")}
                  rows={4}
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border min-h-[100px]">
                  {selectedDocument?.description || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Attached File")}</Label>
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
                  {t("Download")}
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
              {isEditingDocument ? t("Cancel") : t("Close")}
            </Button>
            {isEditingDocument && (
              <Button
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                onClick={handleUpdateDocument}
                disabled={savingDocument || isCompleted}
              >
                {savingDocument ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("Saving...")}
                  </>
                ) : (
                  t("Save")
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
            <DialogTitle>{isEditingEvidence ? t("Edit Evidence Request") : t("View Evidence Request")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Request Title */}
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Request Title")} <span className="text-red-500">*</span></Label>
              {isEditingEvidence ? (
                <Input
                  value={editEvidence.title}
                  onChange={(e) => setEditEvidence({ ...editEvidence, title: e.target.value })}
                  placeholder={t("Enter title")}
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {selectedEvidence?.title || "-"}
                </div>
              )}
            </div>
            {/* Auditee */}
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Auditee")}</Label>
              {isEditingEvidence ? (
                <Select
                  value={editEvidence.auditeeId}
                  onValueChange={(value) => {
                    const selectedAuditee = auditees.find(a => a.id === value);
                    setEditEvidence({
                      ...editEvidence,
                      auditeeId: value,
                      auditee: selectedAuditee?.fullName || ""
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select auditee")}>
                      {editEvidence.auditee && (
                        <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-sm">
                          {editEvidence.auditee}
                          <X className="h-3 w-3 cursor-pointer" onClick={(e) => {
                            e.stopPropagation();
                            setEditEvidence({ ...editEvidence, auditeeId: "", auditee: "" });
                          }} />
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {auditees.map((auditee) => (
                      <SelectItem key={auditee.id} value={auditee.id}>
                        {auditee.fullName} {auditee.department?.name ? `(${auditee.department.name})` : ""}
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
            {/* Number of Samples */}
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Number of Samples")}</Label>
              {isEditingEvidence ? (
                <Input
                  type="number"
                  min="1"
                  value={editEvidence.numberOfSamples}
                  onChange={(e) => setEditEvidence({ ...editEvidence, numberOfSamples: e.target.value })}
                  placeholder={t("Enter number of samples")}
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border">
                  {selectedEvidence?.numberOfSamples || "-"}
                </div>
              )}
            </div>
            {/* Description */}
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Description")}</Label>
              {isEditingEvidence ? (
                <Textarea
                  value={editEvidence.description}
                  onChange={(e) => setEditEvidence({ ...editEvidence, description: e.target.value })}
                  placeholder={t("Enter description")}
                  rows={4}
                />
              ) : (
                <div className="p-3 bg-gray-50 rounded-md border min-h-[80px]">
                  {selectedEvidence?.description || "-"}
                </div>
              )}
            </div>
            {/* Attachments in Edit Mode */}
            {isEditingEvidence && selectedEvidence?.attachments && selectedEvidence.attachments.length > 0 && (
              <div className="space-y-2">
                {selectedEvidence.attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-3">
                      {att.fileType?.includes('image') ? (
                        <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                      ) : att.fileName?.endsWith('.docx') || att.fileName?.endsWith('.doc') ? (
                        <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                          <FileSpreadsheet className="h-5 w-5 text-blue-800" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                          <FileText className="h-5 w-5 text-gray-600" />
                        </div>
                      )}
                      <span className="text-sm text-blue-600">{att.fileName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api${att.filePath}`}
                        download
                        className="p-1 hover:bg-gray-100 rounded"
                        title={t("Download")}
                      >
                        <Download className="h-4 w-4 text-gray-600" />
                      </a>
                      <a
                        href={`/api${att.filePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-gray-100 rounded"
                        title={t("View")}
                      >
                        <Eye className="h-4 w-4 text-gray-600" />
                      </a>
                      <button
                        className="p-1 hover:bg-red-50 rounded"
                        title={t("Delete")}
                        onClick={() => {
                          // TODO: Implement delete attachment
                          toast.info(t("Delete attachment functionality coming soon"));
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* View mode fields */}
            {!isEditingEvidence && (
              <>
                <div className="space-y-2">
                  <Label className="text-[#1e3a5f] font-medium">{t("Due Date")}</Label>
                  <div className="p-3 bg-gray-50 rounded-md border">
                    {selectedEvidence?.dueDate ? formatDate(selectedEvidence.dueDate) : "-"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1e3a5f] font-medium">{t("Status")}</Label>
                  <div className="p-3 bg-gray-50 rounded-md border">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      selectedEvidence?.status === 'Reviewed' ? 'bg-green-100 text-green-800' :
                      selectedEvidence?.status === 'Submitted' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                    {selectedEvidence?.status || "-"}
                  </span>
                </div>
              </div>
              {/* AI Review Section */}
              {selectedEvidence?.aiReviewStatus && (
                <div className="space-y-2">
                  <Label className="text-[#1e3a5f] font-medium">{t("AI Review Result")}</Label>
                  <div className={`p-3 rounded-md border ${
                    selectedEvidence.aiReviewStatus === 'Satisfactory'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {selectedEvidence.aiReviewStatus === 'Satisfactory' ? (
                        <>
                          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                          <span className="font-medium text-green-700">{t("Satisfactory")}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                            <span className="text-white text-xs">✕</span>
                          </div>
                          <span className="font-medium text-red-700">{t("Needs Attention")}</span>
                        </>
                      )}
                    </div>
                    {selectedEvidence.aiReviewComment && (
                      <p className={`text-sm ${
                        selectedEvidence.aiReviewStatus === 'Satisfactory'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {selectedEvidence.aiReviewComment}
                      </p>
                    )}
                  </div>
                </div>
              )}
              </>
            )}
            {/* Attachments section - only show in view mode */}
            {!isEditingEvidence && selectedEvidence?.attachments && selectedEvidence.attachments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[#1e3a5f] font-medium">{t("Uploaded Attachments")}</Label>
                <div className="p-3 bg-gray-50 rounded-md border space-y-2">
                  {selectedEvidence.attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">{att.fileName}</span>
                        <span className="text-xs text-gray-400">({formatFileSize(att.fileSize)})</span>
                      </div>
                      <a
                        href={`/api${att.filePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        {t("Download")}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!isEditingEvidence && (!selectedEvidence?.attachments || selectedEvidence.attachments.length === 0) && (
              <div className="space-y-2">
                <Label className="text-[#1e3a5f] font-medium">{t("Uploaded Attachments")}</Label>
                <div className="p-3 bg-gray-50 rounded-md border text-gray-500 text-sm">
                  {t("No attachments uploaded yet")}
                </div>
              </div>
            )}
            {/* Comments button for auditee when there's a clarification request */}
            {!isEditingEvidence && isAuditeeOnly && selectedEvidence?.clarificationComment && (
              <div className="flex justify-end mt-4">
                <Button
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  onClick={() => {
                    setAuditeeClariEvidence(selectedEvidence);
                    setAuditeeClariDialogOpen(true);
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {t("Comments")}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setViewEditEvidenceDialogOpen(false);
                setSelectedEvidence(null);
                setIsEditingEvidence(false);
              }}
            >
              {isEditingEvidence ? t("Cancel") : t("Close")}
            </Button>
            <div className="flex gap-2">
              {/* Approve/Need Clarification buttons for Audit Head when evidence has attachments */}
              {!isEditingEvidence && isAuditHead && selectedEvidence?.attachments && selectedEvidence.attachments.length > 0 && selectedEvidence.status !== 'Reviewed' && (
                <>
                  <Button
                    variant="outline"
                    className="border-amber-500 text-amber-600 hover:bg-amber-50"
                    onClick={() => {
                      if (selectedEvidence) {
                        handleOpenClarificationDialog(selectedEvidence);
                      }
                    }}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    {t("Need Clarification")}
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      if (selectedEvidence) {
                        handleApproveEvidence(selectedEvidence.id);
                        setViewEditEvidenceDialogOpen(false);
                        setSelectedEvidence(null);
                      }
                    }}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {t("Approve")}
                  </Button>
                </>
              )}
              {isEditingEvidence && (
                <Button
                  className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                  onClick={handleUpdateEvidence}
                  disabled={savingEvidence || isCompleted}
                >
                  {savingEvidence ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("Saving...")}
                    </>
                  ) : (
                    t("Save")
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Need Clarification Dialog */}
      <Dialog open={clarificationDialogOpen} onOpenChange={setClarificationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">{t("Need Clarification")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">
                {t("Select the document that requires clarification")}
              </Label>
              <Select
                value={clarificationDocument}
                onValueChange={setClarificationDocument}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Select document")} />
                </SelectTrigger>
                <SelectContent>
                  {clarificationEvidence?.attachments?.map((att) => (
                    <SelectItem key={att.id} value={att.fileName}>
                      {att.fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Comment")}</Label>
              <Textarea
                value={clarificationComment}
                onChange={(e) => setClarificationComment(e.target.value)}
                placeholder={t("Enter your clarification request...")}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Previous Comments")}</Label>
              <div className="p-3 bg-gray-50 rounded-md border text-gray-500 text-sm text-center">
                {t("No items found")}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleSendClarification}
              disabled={sendingClarification || !clarificationDocument || isCompleted}
            >
              {sendingClarification ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Sending...")}
                </>
              ) : (
                t("Send")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auditee Clarification View Popup */}
      <Dialog open={auditeeClariDialogOpen} onOpenChange={setAuditeeClariDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">{t("Need Clarification")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700">{t("Document that requires clarification")}</p>
                <p className="text-sm text-gray-900">{auditeeClariEvidence?.clarificationDocumentName || "-"}</p>
              </div>
              <Button
                className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
                onClick={() => {
                  setRespondComment("");
                  setRespondFiles([]);
                  setRespondDialogOpen(true);
                }}
              >
                {t("Respond")}
              </Button>
            </div>
            <div className="border-t pt-3">
              <p className="text-sm text-gray-900">{auditeeClariEvidence?.clarificationComment || "-"}</p>
              <p className="text-sm text-gray-500 mt-1">
                ~ {auditeeClariEvidence?.clarificationByUserName || "Unknown"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {auditeeClariEvidence?.clarificationSentAt
                  ? new Date(auditeeClariEvidence.clarificationSentAt).toLocaleString()
                  : "-"}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auditee Respond Dialog */}
      <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1e3a5f]">{t("Respond")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Comment")}</Label>
              <Textarea
                value={respondComment}
                onChange={(e) => setRespondComment(e.target.value)}
                placeholder={t("Enter your response...")}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Attach File")}</Label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true;
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files) {
                      setRespondFiles(Array.from(files));
                    }
                  };
                  input.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const files = e.dataTransfer.files;
                  if (files) {
                    setRespondFiles(Array.from(files));
                  }
                }}
              >
                <p className="text-gray-500">{t("Drag and drop or select file.")}</p>
                {respondFiles.length > 0 && (
                  <div className="mt-2 text-sm text-green-600">
                    {respondFiles.map((f) => f.name).join(", ")}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleSendResponse}
              disabled={sendingResponse || isCompleted}
            >
              {sendingResponse ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Sending...")}
                </>
              ) : (
                t("Send Response")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Evidence Request Confirmation Dialog */}
      <Dialog open={deleteEvidenceDialogOpen} onOpenChange={setDeleteEvidenceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Delete Evidence Request")}</DialogTitle>
            <DialogDescription>
              {t("Are you sure you want to delete")} "{evidenceToDelete?.title}"? {t("This action cannot be undone.")}
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
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEvidence}
              disabled={deletingEvidence || isCompleted}
            >
              {deletingEvidence ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
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
              {t("AI Review Results")}
            </DialogTitle>
            <DialogDescription>
              {t("AI-generated review of")} {selectedEvidenceIds.length} {t("evidence request(s)")}
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
                {t("No review generated yet")}
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
              {t("Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Attachment Dialog */}
      <Dialog open={attachmentDialogOpen} onOpenChange={setAttachmentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Add Attachment")}</DialogTitle>
            <DialogDescription>
              {t("Upload attachment for")}: {evidenceForAttachment?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#1e3a5f] font-medium">{t("Attach File")}</Label>
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
                onClick={() => attachmentFileInputRef.current?.click()}
              >
                <p className="text-gray-600">{t("Click here, or drop files here to upload.")}</p>
                <input
                  ref={attachmentFileInputRef}
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
              {t("Cancel")}
            </Button>
            <Button
              className="bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              onClick={handleUploadAttachment}
              disabled={uploadingAttachment || isCompleted}
            >
              {uploadingAttachment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Uploading...")}
                </>
              ) : (
                t("Upload")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

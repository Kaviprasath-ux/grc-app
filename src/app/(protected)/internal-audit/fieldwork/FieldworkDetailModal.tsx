"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { toast } from "sonner";
import {
  FileText,
  Download,
  Eye,
  Upload,
  X,
  XCircle,
  Loader2,
  MessageSquare,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Paperclip,
  Check,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Save,
} from "lucide-react";
import { useHasRole, usePermissions } from "@/hooks/usePermissions";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { isValidName } from "@/lib/validations";
import { DatePicker } from "@/components/ui/date-picker";
import { formatLocalDate } from "@/lib/utils";

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

interface FieldworkDetailModalProps {
  open: boolean;
  onClose: () => void;
  engagementId: string | null;
  mode: "view" | "edit";
}

export function FieldworkDetailModal({ open, onClose, engagementId, mode }: FieldworkDetailModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const currentUserId = session?.user?.id;
  const isAuditHead = useHasRole("AuditHead");
  const isAuditManager = useHasRole("AuditManager");
  const isAuditor = useHasRole("Auditor");
  const isAuditee = useHasRole("Auditee");

  const isViewMode = mode === "view";
  const isAuditTeam = isAuditHead || isAuditManager || isAuditor;
  const isAuditeeOnly = isAuditee && !isAuditTeam;

  const getAIReviewStatusIcon = (status: string | null | undefined) => {
    const s = (status || "").toLowerCase();
    if (s === "irrelevant") return <span title="Irrelevant"><XCircle className="h-4 w-4 flex-shrink-0 text-red-500" /></span>;
    if (s === "relevant") return <span title="Relevant"><Check className="h-4 w-4 flex-shrink-0 text-emerald-500" /></span>;
    if (s === "partial" || s === "needs_attention" || s === "needs attention") return <span title="Needs Attention"><AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500" /></span>;
    if (s) return <span title={status || ""}><HelpCircle className="h-4 w-4 flex-shrink-0 text-slate-500" /></span>;
    return null;
  };

  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const isCompleted = engagement?.status === "Completed";
  const isReadOnly = isViewMode || isCompleted;

  // Tab navigation state
  const [activeTab, setActiveTab] = useState("overview");

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
  const [comments, setComments] = useState<Array<{ id: string; comment: string; createdAt: string; user: { fullName: string; designation?: string } }>>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [addFindingDialogOpen, setAddFindingDialogOpen] = useState(false);
  const [addFullFindingDialogOpen, setAddFullFindingDialogOpen] = useState(false);
  const [savingFullFinding, setSavingFullFinding] = useState(false);
  const [findingStep, setFindingStep] = useState(1); // Multi-step wizard state (1, 2, or 3)
  const [uploadingTaskDocument, setUploadingTaskDocument] = useState<string | null>(null);
  // Task dialog states
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [taskForm, setTaskForm] = useState({ task: "", comments: "", executed: false });
  const [savingTaskDialog, setSavingTaskDialog] = useState(false);
  const [addEvidenceDialogOpen, setAddEvidenceDialogOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [deleteFindingDialogOpen, setDeleteFindingDialogOpen] = useState(false);
  const [findingToDelete, setFindingToDelete] = useState<Finding | null>(null);
  const [deletingFinding, setDeletingFinding] = useState(false);

  // Finding Detail Modal states
  const [findingDetailDialogOpen, setFindingDetailDialogOpen] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [findingDetailMode, setFindingDetailMode] = useState<"view" | "edit">("view");
  const [selectedFindingData, setSelectedFindingData] = useState<any>(null);
  const [loadingFindingDetail, setLoadingFindingDetail] = useState(false);
  const [editFinding, setEditFinding] = useState({ findingTitle: "", severity: "", criteria: "", condition: "", cause: "", effect: "", recommendation: "", responsiblePersonId: "", status: "", targetClosureDate: "" });
  const [savingEditFinding, setSavingEditFinding] = useState(false);
  const [editFindingTitleError, setEditFindingTitleError] = useState("");

  // Other Documents states
  const [newDocumentDialogOpen, setNewDocumentDialogOpen] = useState(false);
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Workpaper | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [newDocument, setNewDocument] = useState({ title: "", documentType: "", description: "" });
  const [viewEditDocumentDialogOpen, setViewEditDocumentDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Workpaper | null>(null);
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [editDocument, setEditDocument] = useState({ title: "", documentType: "", description: "" });
  const [savingDocument, setSavingDocument] = useState(false);

  // Evidence Request view/edit/delete states
  const [viewEditEvidenceDialogOpen, setViewEditEvidenceDialogOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRequest | null>(null);
  const [isEditingEvidence, setIsEditingEvidence] = useState(false);
  const [editEvidence, setEditEvidence] = useState({ title: "", description: "", auditee: "", auditeeId: "", status: "", numberOfSamples: "" });
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [deleteEvidenceDialogOpen, setDeleteEvidenceDialogOpen] = useState(false);
  const [evidenceToDelete, setEvidenceToDelete] = useState<EvidenceRequest | null>(null);
  const [deletingEvidence, setDeletingEvidence] = useState(false);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [evidenceForAttachment, setEvidenceForAttachment] = useState<EvidenceRequest | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // AI Review states
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [aiReviewQuestion, setAiReviewQuestion] = useState<string>("");
  const [generatingAIReview, setGeneratingAIReview] = useState(false);
  const [aiReviewDialogOpen, setAiReviewDialogOpen] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<string>("");

  // Clarification states
  const [clarificationDialogOpen, setClarificationDialogOpen] = useState(false);
  const [clarificationEvidence, setClarificationEvidence] = useState<EvidenceRequest | null>(null);
  const [clarificationDocument, setClarificationDocument] = useState<string>("");
  const [clarificationComment, setClarificationComment] = useState<string>("");
  const [sendingClarification, setSendingClarification] = useState(false);

  // Auditee clarification states
  const [auditeeClariDialogOpen, setAuditeeClariDialogOpen] = useState(false);
  const [auditeeClariEvidence, setAuditeeClariEvidence] = useState<EvidenceRequest | null>(null);
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
  const [editAIWorkpaper, setEditAIWorkpaper] = useState({ task: "", evidences: "", steps: "", questionChecklist: "", comments: "" });
  const [savingAIWorkpaper, setSavingAIWorkpaper] = useState(false);
  const [deletingAIWorkpaper, setDeletingAIWorkpaper] = useState(false);

  // Generate AI Workpaper states
  const [generateAIDialogOpen, setGenerateAIDialogOpen] = useState(false);
  const [generatingWorkpapers, setGeneratingWorkpapers] = useState(false);
  const [generatedWorkpapers, setGeneratedWorkpapers] = useState<AIWorkpaper[]>([]);
  const [selectedGeneratedIds, setSelectedGeneratedIds] = useState<string[]>([]);
  const [addingGeneratedWorkpapers, setAddingGeneratedWorkpapers] = useState(false);
  const [editingGeneratedId, setEditingGeneratedId] = useState<string | null>(null);
  const [editingGeneratedData, setEditingGeneratedData] = useState({ task: "", steps: "", evidences: "", questionChecklist: "" });

  // Form states
  const [newFinding, setNewFinding] = useState({ title: "", description: "", severity: "Medium", recommendation: "" });
  const [fullFinding, setFullFinding] = useState({ findingTitle: "", severity: "", criteria: "", condition: "", cause: "", effect: "", recommendation: "", responsiblePersonId: "", status: "", targetClosureDate: "" });
  const [findingAttachments, setFindingAttachments] = useState<File[]>([]);
  const findingAttachmentInputRef = useRef<HTMLInputElement>(null);
  const [newEvidence, setNewEvidence] = useState({ title: "", description: "", auditee: "", auditeeId: "", numberOfSamples: "" });

  // Validation error states
  const [uploadFilesError, setUploadFilesError] = useState("");
  const [aiWorkpaperTaskError, setAiWorkpaperTaskError] = useState("");
  const [generatedWorkpapersError, setGeneratedWorkpapersError] = useState("");
  const [findingTitleError, setFindingTitleError] = useState("");
  const [fullFindingTitleError, setFullFindingTitleError] = useState("");
  const [newDocumentTitleError, setNewDocumentTitleError] = useState("");
  const [newDocumentFileError, setNewDocumentFileError] = useState("");
  const [editDocumentTitleError, setEditDocumentTitleError] = useState("");
  const [editEvidenceTitleError, setEditEvidenceTitleError] = useState("");
  const [attachmentFileError, setAttachmentFileError] = useState("");
  const [aiReviewSelectionError, setAiReviewSelectionError] = useState("");
  const [newEvidenceTitleError, setNewEvidenceTitleError] = useState("");

  useEffect(() => {
    if (open && engagementId) {
      setLoading(true);
      fetchEngagementDetails();
      fetchEvidenceRequests();
      fetchFindings();
      if (!isAuditeeOnly) {
        fetchWorkpapers();
        fetchAIWorkpapers();
        fetchTaskList();
        fetchOtherDocuments();
        fetchAuditees();
      }
    }
    if (!open) {
      setEngagement(null);
      setWorkpapers([]);
      setAiWorkpapers([]);
      setTaskList([]);
      setEvidenceRequests([]);
      setOtherDocuments([]);
      setFindings([]);
      setLoading(true);
      setActiveTab("overview"); // Reset to overview tab when opening
    }
  }, [open, engagementId]);

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
      if (response.ok) setWorkpapers(await response.json());
    } catch (error) { console.error("Failed to fetch workpapers:", error); }
  };

  const fetchAIWorkpapers = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/ai-workpapers`);
      if (response.ok) setAiWorkpapers(await response.json());
    } catch (error) { console.error("Failed to fetch AI workpapers:", error); }
  };

  const fetchTaskList = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/tasks`);
      if (response.ok) setTaskList(await response.json());
    } catch (error) { console.error("Failed to fetch task list:", error); }
  };

  const fetchEvidenceRequests = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests`);
      if (response.ok) setEvidenceRequests(await response.json());
    } catch (error) { console.error("Failed to fetch evidence requests:", error); }
  };

  const fetchOtherDocuments = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/other-documents`);
      if (response.ok) setOtherDocuments(await response.json());
    } catch (error) { console.error("Failed to fetch other documents:", error); }
  };

  const fetchFindings = async () => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings`);
      if (response.ok) setFindings(await response.json());
    } catch (error) { console.error("Failed to fetch findings:", error); }
  };

  const fetchFindingDetails = async (findingId: string, mode?: "view" | "edit") => {
    setLoadingFindingDetail(true);
    setSelectedFindingData(null);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings/${findingId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedFindingData(data);
        if (mode === "edit") {
          setEditFinding({
            findingTitle: data.title || "",
            severity: data.severity || "Medium",
            criteria: data.criteria || "",
            condition: data.condition || "",
            cause: data.cause || "",
            effect: data.effect || "",
            recommendation: data.recommendation || "",
            responsiblePersonId: data.responsiblePersonId || "",
            status: data.status || "Open",
            targetClosureDate: data.targetDate ? data.targetDate.split("T")[0] : "",
          });
          setEditFindingTitleError("");
        }
      } else {
        toast.error(t("Failed to fetch finding details"));
      }
    } catch (error) {
      console.error("Failed to fetch finding details:", error);
      toast.error(t("Failed to fetch finding details"));
    } finally {
      setLoadingFindingDetail(false);
    }
  };

  const fetchAuditees = async () => {
    try {
      const response = await fetch("/api/users/my-auditees");
      if (response.ok) {
        const data = await response.json();
        const auditeeList = data.auditees || [];
        setAuditees(auditeeList.map((u: { id: string; fullName: string; department?: { name: string } | null }) => ({ id: u.id, fullName: u.fullName, department: u.department })));
      }
    } catch (error) { console.error("Failed to fetch auditees:", error); }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredEvidenceRequests = isAuditee && !isAuditHead
    ? evidenceRequests.filter(er => er.auditeeId === currentUserId)
    : evidenceRequests;

  const getAuditorName = () => {
    if (!engagement) return "-";
    if (engagement.assignedAuditor) return `${engagement.assignedAuditor.firstName} ${engagement.assignedAuditor.lastName}`;
    if (engagement.assignedAuditors && engagement.assignedAuditors.length > 0) return engagement.assignedAuditors.join(", ");
    return "-";
  };

  // File upload handlers
  const handleFileDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); addFiles(Array.from(e.dataTransfer.files)); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files ? Array.from(e.target.files) : []; addFiles(files); e.target.value = ""; };
  const addFiles = (files: File[]) => {
    setUploadFilesError("");
    setNewDocumentFileError("");
    setAttachmentFileError("");
    for (const file of files) { setUploadedFiles((prev) => [...prev, { id: Date.now().toString() + Math.random().toString(36).substr(2, 9), name: file.name, size: file.size, type: file.type, file }]); }
  };
  const removeFile = (fileId: string) => { setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId)); };

  const handleUploadFiles = async () => {
    if (uploadedFiles.length === 0) { setUploadFilesError(t("Please select files to upload")); return; }
    setUploadFilesError("");
    setUploading(true);
    try {
      const formData = new FormData();
      uploadedFiles.forEach((f) => { if (f.file) formData.append("files", f.file); });
      formData.append("category", uploadCategory);
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/upload`, { method: "POST", body: formData });
      if (response.ok) {
        toast.success(t("Files uploaded successfully"));
        setUploadDialogOpen(false);
        setUploadedFiles([]);
        if (uploadCategory === "workpapers") fetchWorkpapers(); else fetchOtherDocuments();
      } else toast.error(t("Failed to upload files"));
    } catch (error) { console.error("Upload error:", error); toast.error(t("Failed to upload files")); } finally { setUploading(false); }
  };

  const handleToggleExecuted = async (workpaperId: string, currentValue: boolean) => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/${workpaperId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ executed: !currentValue }) });
      if (response.ok) setAiWorkpapers((prev) => prev.map((wp) => wp.id === workpaperId ? { ...wp, executed: !currentValue } : wp));
    } catch (error) { console.error("Failed to update executed status:", error); }
  };

  const handleOpenEditAIWorkpaper = (wp: AIWorkpaper) => {
    setSelectedAIWorkpaper(wp);
    const parseField = (field: string) => { try { const parsed = JSON.parse(field); return Array.isArray(parsed) ? parsed.join('\n') : field; } catch { return field; } };
    setEditAIWorkpaper({ task: wp.task, evidences: parseField(wp.evidences), steps: parseField(wp.steps), questionChecklist: parseField(wp.questionChecklist), comments: wp.comments });
    setEditAIWorkpaperDialogOpen(true);
  };

  const handleUpdateAIWorkpaper = async () => {
    if (!selectedAIWorkpaper) return;
    if (!editAIWorkpaper.task.trim()) { setAiWorkpaperTaskError(t("Task is required")); return; }
    setAiWorkpaperTaskError("");
    setSavingAIWorkpaper(true);
    try {
      const serializeField = (field: string) => { const lines = field.split('\n').map(line => line.trim()).filter(line => line.length > 0); return JSON.stringify(lines); };
      const dataToSave = { task: editAIWorkpaper.task, evidences: serializeField(editAIWorkpaper.evidences), steps: serializeField(editAIWorkpaper.steps), questionChecklist: serializeField(editAIWorkpaper.questionChecklist), comments: editAIWorkpaper.comments };
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/${selectedAIWorkpaper.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dataToSave) });
      if (response.ok) { setAiWorkpapers((prev) => prev.map((wp) => wp.id === selectedAIWorkpaper.id ? { ...wp, ...dataToSave } : wp)); toast.success(t("AI Workpaper updated successfully")); setEditAIWorkpaperDialogOpen(false); setSelectedAIWorkpaper(null); }
      else toast.error(t("Failed to update AI Workpaper"));
    } catch (error) { console.error("Error updating AI Workpaper:", error); toast.error(t("Failed to update AI Workpaper")); } finally { setSavingAIWorkpaper(false); }
  };

  const handleDeleteAIWorkpaper = async () => {
    if (!selectedAIWorkpaper) return;
    setDeletingAIWorkpaper(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/${selectedAIWorkpaper.id}`, { method: "DELETE" });
      if (response.ok) { setAiWorkpapers((prev) => prev.filter((wp) => wp.id !== selectedAIWorkpaper.id)); toast.success(t("AI Workpaper deleted successfully")); setDeleteAIWorkpaperDialogOpen(false); setSelectedAIWorkpaper(null); }
      else toast.error(t("Failed to delete AI Workpaper"));
    } catch (error) { console.error("Error deleting AI Workpaper:", error); toast.error(t("Failed to delete AI Workpaper")); } finally { setDeletingAIWorkpaper(false); }
  };

  const handleGenerateAIWorkpapers = async () => {
    setGeneratingWorkpapers(true); setGeneratedWorkpapers([]); setSelectedGeneratedIds([]);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/generate`, { method: "POST" });
      if (response.ok) { const data = await response.json(); setGeneratedWorkpapers(data.workpapers || []); }
      else toast.error(t("Failed to generate AI workpapers"));
    } catch (error) { console.error("Error generating AI workpapers:", error); toast.error(t("Failed to generate AI workpapers")); } finally { setGeneratingWorkpapers(false); }
  };

  const handleToggleGeneratedSelection = (id: string) => {
    setGeneratedWorkpapersError("");
    setSelectedGeneratedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const handleAddSelectedWorkpapers = async () => {
    if (selectedGeneratedIds.length === 0) { setGeneratedWorkpapersError(t("Please select at least one workpaper")); return; }
    setGeneratedWorkpapersError("");
    setAddingGeneratedWorkpapers(true);
    try {
      const selectedWorkpapers = generatedWorkpapers.filter((wp) => selectedGeneratedIds.includes(wp.id));
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/add`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workpapers: selectedWorkpapers }) });
      if (response.ok) { const data = await response.json(); setAiWorkpapers((prev) => [...prev, ...data.workpapers]); toast.success(t("Workpapers added successfully")); setGenerateAIDialogOpen(false); setGeneratedWorkpapers([]); setSelectedGeneratedIds([]); }
      else toast.error(t("Failed to add workpapers"));
    } catch (error) { console.error("Error adding workpapers:", error); toast.error(t("Failed to add workpapers")); } finally { setAddingGeneratedWorkpapers(false); }
  };

  const handleAddFinding = async () => {
    if (!newFinding.title.trim()) { setFindingTitleError(t("Finding title is required")); return; }
    if (!isValidName(newFinding.title.trim())) { setFindingTitleError(t("Only letters, numbers, spaces, and hyphens are allowed")); return; }
    setFindingTitleError("");
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newFinding, status: "Open" }) });
      if (response.ok) { toast.success(t("Finding added successfully")); setAddFindingDialogOpen(false); setNewFinding({ title: "", description: "", severity: "Medium", recommendation: "" }); fetchFindings(); }
      else toast.error(t("Failed to add finding"));
    } catch (error) { toast.error(t("Failed to add finding")); }
  };

  const handleAddFullFinding = async () => {
    if (!fullFinding.findingTitle.trim()) { setFullFindingTitleError(t("Finding title is required")); return; }
    if (!isValidName(fullFinding.findingTitle.trim())) { setFullFindingTitleError(t("Only letters, numbers, spaces, and hyphens are allowed")); return; }
    setFullFindingTitleError("");
    setSavingFullFinding(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: fullFinding.findingTitle, severity: fullFinding.severity || "Medium", criteria: fullFinding.criteria || null, condition: fullFinding.condition || null, cause: fullFinding.cause || null, effect: fullFinding.effect || null, recommendation: fullFinding.recommendation || null, responsiblePersonId: fullFinding.responsiblePersonId || null, status: fullFinding.status || "Open", targetDate: fullFinding.targetClosureDate || null }) });
      if (response.ok) {
        const newFindingData = await response.json();
        if (findingAttachments.length > 0) {
          const formData = new FormData();
          findingAttachments.forEach((file) => formData.append("files", file));
          await fetch(`/api/internal-audit/findings/${newFindingData.id}/attachments`, { method: "POST", body: formData });
        }
        toast.success(t("Finding added successfully")); setAddFullFindingDialogOpen(false); setFullFinding({ findingTitle: "", severity: "", criteria: "", condition: "", cause: "", effect: "", recommendation: "", responsiblePersonId: "", status: "", targetClosureDate: "" }); setFindingAttachments([]); fetchFindings();
      } else { const error = await response.json(); toast.error(error.error || t("Failed to add finding")); }
    } catch (error) { console.error("Error adding finding:", error); toast.error(t("Failed to add finding")); } finally { setSavingFullFinding(false); }
  };

  const handleDeleteFinding = async () => {
    if (!findingToDelete) return;
    setDeletingFinding(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings/${findingToDelete.id}`, { method: "DELETE" });
      if (response.ok) { toast.success(t("Finding deleted successfully")); setDeleteFindingDialogOpen(false); setFindingToDelete(null); fetchFindings(); }
      else toast.error(t("Failed to delete finding"));
    } catch (error) { console.error("Error deleting finding:", error); toast.error(t("Failed to delete finding")); } finally { setDeletingFinding(false); }
  };

  const handleSaveEditFinding = async () => {
    if (!selectedFindingId) return;
    if (!editFinding.findingTitle.trim()) { setEditFindingTitleError(t("Finding title is required")); return; }
    if (!isValidName(editFinding.findingTitle.trim())) { setEditFindingTitleError(t("Only letters, numbers, spaces, and hyphens are allowed")); return; }
    setEditFindingTitleError("");
    setSavingEditFinding(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings/${selectedFindingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editFinding.findingTitle,
          severity: editFinding.severity || "Medium",
          criteria: editFinding.criteria || null,
          condition: editFinding.condition || null,
          cause: editFinding.cause || null,
          effect: editFinding.effect || null,
          recommendation: editFinding.recommendation || null,
          responsiblePersonId: editFinding.responsiblePersonId || null,
          status: editFinding.status || "Open",
          targetDate: editFinding.targetClosureDate || null,
        }),
      });
      if (response.ok) {
        toast.success(t("Finding updated successfully"));
        setFindingDetailDialogOpen(false);
        setSelectedFindingId(null);
        setSelectedFindingData(null);
        fetchFindings();
      } else {
        const error = await response.json();
        toast.error(error.error || t("Failed to update finding"));
      }
    } catch (error) {
      console.error("Error updating finding:", error);
      toast.error(t("Failed to update finding"));
    } finally {
      setSavingEditFinding(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!newDocument.title.trim()) { setNewDocumentTitleError(t("Document title is required")); return; }
    if (uploadedFiles.length === 0) { setNewDocumentFileError(t("Please select a file to upload")); return; }
    setNewDocumentTitleError("");
    setNewDocumentFileError("");
    setUploading(true);
    try {
      const formData = new FormData();
      uploadedFiles.forEach((f) => { if (f.file) formData.append("files", f.file); });
      formData.append("category", "other"); formData.append("title", newDocument.title); formData.append("documentType", newDocument.documentType); formData.append("description", newDocument.description);
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/upload`, { method: "POST", body: formData });
      if (response.ok) { toast.success(t("Document uploaded successfully")); setNewDocumentDialogOpen(false); setNewDocument({ title: "", documentType: "", description: "" }); setUploadedFiles([]); fetchOtherDocuments(); }
      else toast.error(t("Failed to upload document"));
    } catch (error) { console.error("Upload error:", error); toast.error(t("Failed to upload document")); } finally { setUploading(false); }
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;
    setDeletingDocument(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/other-documents/${documentToDelete.id}`, { method: "DELETE" });
      if (response.ok) { toast.success(t("Document deleted successfully")); setDeleteDocumentDialogOpen(false); setDocumentToDelete(null); fetchOtherDocuments(); }
      else toast.error(t("Failed to delete document"));
    } catch (error) { console.error("Error deleting document:", error); toast.error(t("Failed to delete document")); } finally { setDeletingDocument(false); }
  };

  const handleDeleteWorkpaper = async () => {
    if (!workpaperToDelete) return;
    setDeletingWorkpaper(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/workpapers/${workpaperToDelete.id}`, { method: "DELETE" });
      if (response.ok) { toast.success(t("Workpaper deleted successfully")); setDeleteWorkpaperDialogOpen(false); setWorkpaperToDelete(null); fetchWorkpapers(); }
      else toast.error(t("Failed to delete workpaper"));
    } catch (error) { console.error("Error deleting workpaper:", error); toast.error(t("Failed to delete workpaper")); } finally { setDeletingWorkpaper(false); }
  };

  const handleOpenViewDocument = (doc: Workpaper, editMode: boolean = false) => {
    setSelectedDocument(doc); setEditDocument({ title: doc.title || "", documentType: doc.documentType || "", description: doc.description || "" }); setIsEditingDocument(editMode); setViewEditDocumentDialogOpen(true);
  };

  const handleUpdateDocument = async () => {
    if (!selectedDocument) return;
    if (!editDocument.title.trim()) { setEditDocumentTitleError(t("Document title is required")); return; }
    setEditDocumentTitleError("");
    setSavingDocument(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/other-documents/${selectedDocument.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editDocument.title, documentType: editDocument.documentType, description: editDocument.description }) });
      if (response.ok) { toast.success(t("Document updated successfully")); setViewEditDocumentDialogOpen(false); setSelectedDocument(null); setIsEditingDocument(false); fetchOtherDocuments(); }
      else toast.error(t("Failed to update document"));
    } catch (error) { console.error("Error updating document:", error); toast.error(t("Failed to update document")); } finally { setSavingDocument(false); }
  };

  const handleOpenViewEvidence = (er: EvidenceRequest, editMode: boolean = false) => {
    setSelectedEvidence(er); setEditEvidence({ title: er.title || "", description: er.description || "", auditee: er.auditee || "", auditeeId: er.auditeeId || "", status: er.status || "Pending", numberOfSamples: er.numberOfSamples || "" }); setIsEditingEvidence(editMode); setViewEditEvidenceDialogOpen(true);
  };

  const handleUpdateEvidence = async () => {
    if (!selectedEvidence) return;
    if (!editEvidence.title.trim()) { setEditEvidenceTitleError(t("Title is required")); return; }
    setEditEvidenceTitleError("");
    setSavingEvidence(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${selectedEvidence.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editEvidence.title, description: editEvidence.description, auditee: editEvidence.auditee, auditeeId: editEvidence.auditeeId || null, status: editEvidence.status, numberOfSamples: editEvidence.numberOfSamples || null }) });
      if (response.ok) { toast.success(t("Evidence request updated successfully")); setViewEditEvidenceDialogOpen(false); setSelectedEvidence(null); setIsEditingEvidence(false); fetchEvidenceRequests(); }
      else toast.error(t("Failed to update evidence request"));
    } catch (error) { console.error("Error updating evidence request:", error); toast.error(t("Failed to update evidence request")); } finally { setSavingEvidence(false); }
  };

  const handleDeleteEvidence = async () => {
    if (!evidenceToDelete) return;
    setDeletingEvidence(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${evidenceToDelete.id}`, { method: "DELETE" });
      if (response.ok) { toast.success(t("Evidence request deleted successfully")); setDeleteEvidenceDialogOpen(false); setEvidenceToDelete(null); fetchEvidenceRequests(); }
      else toast.error(t("Failed to delete evidence request"));
    } catch (error) { console.error("Error deleting evidence request:", error); toast.error(t("Failed to delete evidence request")); } finally { setDeletingEvidence(false); }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const response = await fetch(`/api/internal-audit/engagements/${engagementId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error);
      toast.error(t("Failed to fetch comments"));
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error(t("Please enter a comment"));
      return;
    }

    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/internal-audit/engagements/${engagementId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: newComment }),
      });

      if (response.ok) {
        toast.success(t("Comment added successfully"));
        setNewComment("");
        fetchComments(); // Refresh comments list
      } else {
        toast.error(t("Failed to add comment"));
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error(t("Failed to add comment"));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleOpenAttachmentDialog = (er: EvidenceRequest) => { setEvidenceForAttachment(er); setUploadedFiles([]); setAttachmentDialogOpen(true); };

  const handleUploadAttachment = async () => {
    if (!evidenceForAttachment) return;
    if (uploadedFiles.length === 0) { setAttachmentFileError(t("Please select a file to upload")); return; }
    setAttachmentFileError("");
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      uploadedFiles.forEach((f) => { if (f.file) formData.append("files", f.file); });
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${evidenceForAttachment.id}/attachments`, { method: "POST", body: formData });
      if (response.ok) { toast.success(t("Attachment uploaded successfully")); setAttachmentDialogOpen(false); setEvidenceForAttachment(null); setUploadedFiles([]); fetchEvidenceRequests(); }
      else toast.error(t("Failed to upload attachment"));
    } catch (error) { console.error("Error uploading attachment:", error); toast.error(t("Failed to upload attachment")); } finally { setUploadingAttachment(false); }
  };

  const handleApproveEvidence = async (evidenceId: string) => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${evidenceId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Reviewed", aiReviewStatus: "Satisfactory" }) });
      if (response.ok) { toast.success(t("Evidence request approved")); fetchEvidenceRequests(); }
      else toast.error(t("Failed to approve evidence request"));
    } catch (error) { console.error("Error approving evidence:", error); toast.error(t("Failed to approve evidence request")); }
  };

  const handleOpenClarificationDialog = (evidence: EvidenceRequest) => {
    setClarificationEvidence(evidence); setClarificationDocument(evidence.attachments?.[0]?.fileName || ""); setClarificationComment(""); setClarificationDialogOpen(true);
  };

  const handleSendClarification = async () => {
    if (!clarificationEvidence) return;
    setSendingClarification(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${clarificationEvidence.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Pending", aiReviewStatus: "Needs Attention", clarificationComment, clarificationDocumentName: clarificationDocument, clarificationByUserId: session?.user?.id, clarificationByUserName: session?.user?.name, clarificationSentAt: new Date().toISOString() }) });
      if (response.ok) { toast.success(t("The document has been returned for clarification")); setClarificationDialogOpen(false); setClarificationEvidence(null); setClarificationDocument(""); setClarificationComment(""); setViewEditEvidenceDialogOpen(false); setSelectedEvidence(null); fetchEvidenceRequests(); }
      else toast.error(t("Failed to request clarification"));
    } catch (error) { console.error("Error requesting clarification:", error); toast.error(t("Failed to request clarification")); } finally { setSendingClarification(false); }
  };

  const handleSendResponse = async () => {
    const pendingRequests = filteredEvidenceRequests.filter((er) => er.status === 'Pending');
    if (pendingRequests.length === 0) return;
    setSendingResponse(true);
    try {
      if (respondFiles.length > 0) {
        const formData = new FormData();
        respondFiles.forEach((file) => formData.append("files", file));
        await Promise.all(pendingRequests.map((er) => fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${er.id}/attachments`, { method: "POST", body: formData })));
      }
      await Promise.all(pendingRequests.map((er) => fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${er.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Submitted", clarificationComment: null, clarificationDocumentName: null, clarificationByUserId: null, clarificationByUserName: null, clarificationSentAt: null }) })));
      toast.success(t("Response submitted successfully")); setRespondDialogOpen(false); setAuditeeClariDialogOpen(false); setAuditeeClariEvidence(null); setRespondComment(""); setRespondFiles([]); setViewEditEvidenceDialogOpen(false); setSelectedEvidence(null); fetchEvidenceRequests();
    } catch (error) { console.error("Error sending response:", error); toast.error(t("Failed to send response")); } finally { setSendingResponse(false); }
  };

  const handleSelectEvidence = (id: string, checked: boolean) => {
    setAiReviewSelectionError("");
    if (checked) setSelectedEvidenceIds([...selectedEvidenceIds, id]); else setSelectedEvidenceIds(selectedEvidenceIds.filter((eid) => eid !== id));
  };
  const handleSelectAllEvidence = (checked: boolean) => {
    setAiReviewSelectionError("");
    if (checked) setSelectedEvidenceIds(filteredEvidenceRequests.map((er) => er.id)); else setSelectedEvidenceIds([]);
  };

  const handleAIReview = async () => {
    if (selectedEvidenceIds.length === 0) { setAiReviewSelectionError(t("Please select at least one evidence request")); return; }
    setAiReviewSelectionError("");
    setGeneratingAIReview(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/ai-review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evidenceRequestIds: selectedEvidenceIds }) });
      if (response.ok) { const data = await response.json(); setAiReviewResult(data.review || data.answer || data.result || "AI Review completed successfully."); setAiReviewDialogOpen(true); await fetchEvidenceRequests(); toast.success(t("AI Review generated successfully")); }
      else toast.error(t("Failed to generate AI review"));
    } catch (error) { console.error("Error generating AI review:", error); toast.error(t("Failed to generate AI review")); } finally { setGeneratingAIReview(false); }
  };

  const openAddTaskDialog = () => {
    setEditingTask(null);
    setTaskForm({ task: "", comments: "", executed: false });
    setTaskDialogOpen(true);
  };

  const openEditTaskDialog = (task: TaskItem) => {
    setEditingTask(task);
    setTaskForm({ task: task.task, comments: task.comments, executed: task.executed });
    setTaskDialogOpen(true);
  };

  const handleSaveTaskDialog = async () => {
    if (!taskForm.task.trim()) return;
    setSavingTaskDialog(true);
    try {
      if (editingTask) {
        // Update existing task
        const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/tasks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: editingTask.id, task: taskForm.task, executed: taskForm.executed, comments: taskForm.comments }),
        });
        if (response.ok) {
          setTaskList((prev) => prev.map((t) => t.id === editingTask.id ? { ...t, task: taskForm.task, executed: taskForm.executed, comments: taskForm.comments } : t));
          toast.success(t("Task saved successfully"));
        } else toast.error(t("Failed to save task"));
      } else {
        // Create new task then update with form data
        const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/tasks`, { method: "POST" });
        if (response.ok) {
          const newTask = await response.json();
          const taskId = newTask.id || newTask?.data?.id;
          if (taskId && (taskForm.task || taskForm.comments || taskForm.executed)) {
            await fetch(`/api/internal-audit/fieldwork/${engagementId}/tasks`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskId, task: taskForm.task, executed: taskForm.executed, comments: taskForm.comments }),
            });
          }
          fetchTaskList();
          toast.success(t("Task added successfully"));
        } else toast.error(t("Failed to add task"));
      }
      setTaskDialogOpen(false);
      setEditingTask(null);
    } catch (error) {
      toast.error(t("Failed to save task"));
    } finally {
      setSavingTaskDialog(false);
    }
  };

  const handleUploadTaskDocument = async (taskId: string, file: File) => {
    setUploadingTaskDocument(taskId);
    try {
      const formData = new FormData(); formData.append("file", file);
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/tasks/${taskId}/document`, { method: "POST", body: formData });
      if (response.ok) {
        const data = await response.json();
        setTaskList((prev) => prev.map((t) => t.id === taskId ? { ...t, document: data.document, documentName: data.documentName } : t));
        toast.success(t("Document uploaded successfully"));
      } else toast.error(t("Failed to upload document"));
    } catch (error) { toast.error(t("Failed to upload document")); } finally { setUploadingTaskDocument(null); }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/tasks?taskId=${taskId}`, { method: "DELETE" });
      if (response.ok) { fetchTaskList(); toast.success(t("Task deleted successfully")); } else toast.error(t("Failed to delete task"));
    } catch (error) { toast.error(t("Failed to delete task")); }
  };

  const handleAddEvidence = async () => {
    if (!newEvidence.title.trim()) { setNewEvidenceTitleError(t("Evidence title is required")); return; }
    setNewEvidenceTitleError("");
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newEvidence.title, description: newEvidence.description, auditee: newEvidence.auditee, auditeeId: newEvidence.auditeeId || null, numberOfSamples: newEvidence.numberOfSamples || null, status: "Pending" }) });
      if (response.ok) { toast.success(t("Evidence request added successfully")); setAddEvidenceDialogOpen(false); setNewEvidence({ title: "", description: "", auditee: "", auditeeId: "", numberOfSamples: "" }); fetchEvidenceRequests(); }
      else toast.error(t("Failed to add evidence request"));
    } catch (error) { toast.error(t("Failed to add evidence request")); }
  };

  const handleMarkAsCompleted = async () => {
    if (!engagement) return;
    setMarkingComplete(true);
    try {
      const response = await fetch(`/api/internal-audit/engagements/${engagementId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Completed" }) });
      if (response.ok) { toast.success(t("Engagement marked as completed")); setEngagement({ ...engagement, status: "Completed" }); }
      else toast.error(t("Failed to mark engagement as completed"));
    } catch (error) { console.error("Error marking engagement as completed:", error); toast.error(t("Failed to mark engagement as completed")); } finally { setMarkingComplete(false); }
  };

  const renderJsonList = (field: string) => {
    try {
      const items = JSON.parse(field);
      return Array.isArray(items) && items.length > 0 ? items.map((item: string, i: number) => <div key={i}>• {item}</div>) : field || "-";
    } catch { return field || "-"; }
  };

  return (
    <>
      {/* Main Detail Dialog */}
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <DialogContent className="sm:max-w-[95vw] md:max-w-[850px] lg:max-w-[800px] p-0 gap-0 h-[95vh] flex flex-col">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0 pr-14">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {engagement ? `${engagement.engagementTitle} (${engagement.auditId})` : t("Fieldwork Details")}
                {engagement && engagement.status === "Completed" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700 ltr:ml-3 rtl:mr-3">
                    {t("Completed")}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Body */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : !engagement ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 mx-6">{t("Engagement not found")}</div>
            ) : (
              <>
                {/* Tabs Interface */}
                <Tabs defaultValue="overview" onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full justify-start border-b border-slate-200 bg-white px-6 rounded-none h-auto p-0">
                    <TabsTrigger
                      value="overview"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 px-6 py-3.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      {t("Overview")}
                    </TabsTrigger>
                    {!isAuditeeOnly && (
                      <>
                        <TabsTrigger
                          value="workpapers"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 px-6 py-3.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          {t("Workpapers")}
                        </TabsTrigger>
                        <TabsTrigger
                          value="tasks"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 px-6 py-3.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          {t("Tasks")}
                        </TabsTrigger>
                      </>
                    )}
                    <TabsTrigger
                      value="evidence"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 px-6 py-3.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      {t("Evidence")}
                    </TabsTrigger>
                    {!isAuditeeOnly && (
                      <TabsTrigger
                        value="documents"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 px-6 py-3.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        {t("Documents")}
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="findings"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 px-6 py-3.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      {t("Findings")}
                    </TabsTrigger>
                  </TabsList>

                  {/* Tab Content Container */}
                  <div className="min-h-[500px]">
                    {/* Tab 1: Overview - Engagement Details */}
                    <TabsContent value="overview" className="mt-0 px-6 pt-6 space-y-6">
                      <div className="mb-6">
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">{t("Engagement Details")}</h2>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-primary-700">{engagement.auditId}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600">{engagement.engagementTitle}</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="grid grid-cols-2 gap-0">
                          <div className="px-5 py-4 border-b border-slate-100 border-r border-slate-100">
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Engagement ID")}</Label>
                            <p className="text-sm font-medium text-slate-800 mt-1">{engagement.auditId}</p>
                          </div>
                          <div className="px-5 py-4 border-b border-slate-100">
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Title")}</Label>
                            <p className="text-sm font-medium text-slate-800 mt-1">{engagement.engagementTitle}</p>
                          </div>
                          <div className="px-5 py-4 border-b border-slate-100 border-r border-slate-100">
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Auditor")}</Label>
                            <p className="text-sm font-medium text-slate-800 mt-1">{getAuditorName()}</p>
                          </div>
                          <div className="px-5 py-4 border-b border-slate-100">
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Timeline")}</Label>
                            <p className="text-sm font-medium text-slate-800 mt-1">{formatDate(engagement.startDate)} {t("to")} {formatDate(engagement.endDate)}</p>
                          </div>
                          <div className="px-5 py-4 border-r border-slate-100">
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</Label>
                            <div className="mt-1">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                engagement.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                engagement.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-slate-100 text-slate-800'
                              }`}>
                                {engagement.status}
                              </span>
                            </div>
                          </div>
                          <div className="px-5 py-4">
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Department")}</Label>
                            <p className="text-sm font-medium text-slate-800 mt-1">{engagement.department?.name || "-"}</p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Tab 2: Workpapers (combines regular + AI workpapers) - Hidden for auditees */}
                    {!isAuditeeOnly && (
                      <TabsContent value="workpapers" className="mt-0 px-6 pt-6 space-y-8">
                        {/* Regular Workpapers */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-800">{t("Workpapers")}</h3>
                            {isAuditHead && !isReadOnly && (
                              <Button size="sm" onClick={() => { setUploadCategory("workpapers"); setUploadedFiles([]); setUploadDialogOpen(true); }}>
                                {t("Upload Workpaper")}
                              </Button>
                            )}
                          </div>
                          {workpapers.length > 0 ? (
                            <div className="space-y-4">
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("File Name")}</TableHead>
                                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5 w-[120px]">{t("Action")}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {workpapers.map((wp) => (
                                      <TableRow key={wp.id} className="border-b border-slate-100 last:border-0">
                                        <TableCell className="py-3 ps-5">
                                          <div className="flex items-center gap-3">
                                            <FileSpreadsheet className="h-4 w-4 text-green-600 flex-shrink-0" />
                                            <a href={`/api${wp.filePath}`} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-700 hover:underline font-medium">{wp.fileName}</a>
                                          </div>
                                        </TableCell>
                                        <TableCell className="py-3 pe-5">
                                          <div className="flex items-center gap-0.5">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" title={t("View")} onClick={() => window.open(`/api${wp.filePath}`, "_blank")}><Eye className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" title={t("Download")} onClick={() => { const link = document.createElement("a"); link.href = `/api${wp.filePath}`; link.download = wp.fileName; link.click(); }}><Download className="h-4 w-4" /></Button>
                                            {isAuditHead && (
                                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" title={t("Delete")} onClick={() => { setWorkpaperToDelete(wp); setDeleteWorkpaperDialogOpen(true); }} disabled={isReadOnly}><Trash2 className="h-4 w-4" /></Button>
                                            )}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              {/* Inline upload zone below table */}
                              {isAuditHead && !isReadOnly && (
                                <div
                                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all group ${isDragOver ? "border-primary-500 bg-primary-50" : "border-slate-200 hover:border-primary-400 hover:bg-primary-50/30"}`}
                                  onClick={() => { setUploadCategory("workpapers"); setUploadedFiles([]); setUploadDialogOpen(true); }}
                                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                                  onDrop={(e) => {
                                    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
                                    const files = Array.from(e.dataTransfer.files);
                                    if (files.length > 0) {
                                      setUploadCategory("workpapers");
                                      setUploadedFiles([]);
                                      const mapped = files.map((f) => ({ id: Date.now().toString() + Math.random().toString(36).substr(2, 9), name: f.name, size: f.size, type: f.type, file: f }));
                                      setUploadedFiles(mapped);
                                      setUploadDialogOpen(true);
                                    }
                                  }}
                                >
                                  <div className="flex items-center justify-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-primary-100 flex items-center justify-center transition-colors">
                                      <Upload className="h-4 w-4 text-slate-400 group-hover:text-primary-500 transition-colors" />
                                    </div>
                                    <div className="text-start">
                                      <p className="text-sm font-medium text-slate-600 group-hover:text-primary-700 transition-colors">{t("Drop files here or click to upload")}</p>
                                      <p className="text-xs text-slate-400">{t("Supported formats")}: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${isAuditHead && !isReadOnly ? (isDragOver ? "border-primary-500 bg-primary-50 cursor-pointer" : "cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 border-slate-300") : "border-slate-200"}`}
                              onClick={() => { if (isAuditHead && !isReadOnly) { setUploadCategory("workpapers"); setUploadedFiles([]); setUploadDialogOpen(true); } }}
                              onDragOver={(e) => { if (isAuditHead && !isReadOnly) { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); } }}
                              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                              onDrop={(e) => {
                                if (!isAuditHead || isReadOnly) return;
                                e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
                                const files = Array.from(e.dataTransfer.files);
                                if (files.length > 0) {
                                  setUploadCategory("workpapers");
                                  setUploadedFiles([]);
                                  const mapped = files.map((f) => ({ id: Date.now().toString() + Math.random().toString(36).substr(2, 9), name: f.name, size: f.size, type: f.type, file: f }));
                                  setUploadedFiles(mapped);
                                  setUploadDialogOpen(true);
                                }
                              }}
                            >
                              <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mx-auto mb-3">
                                <Upload className="h-6 w-6 text-primary-400" />
                              </div>
                              <p className="text-sm font-medium text-slate-600 mb-1">{t("No workpapers uploaded yet")}</p>
                              <p className="text-xs text-slate-400 mb-4">{t("Supported formats")}: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG</p>
                              {isAuditHead && !isReadOnly && (
                                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setUploadCategory("workpapers"); setUploadedFiles([]); setUploadDialogOpen(true); }}>
                                  <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                  {t("Browse Files")}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* AI-Generated Workpapers */}
                        <div className="space-y-4 pt-6 border-t border-slate-200">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-800">{t("AI-Generated Workpapers")}</h3>
                            {isAuditHead && (
                              <Button size="sm" onClick={() => { setGeneratedWorkpapers([]); setSelectedGeneratedIds([]); setGeneratedWorkpapersError(""); setGenerateAIDialogOpen(true); }} disabled={isReadOnly}>
                                {t("Generate Workpaper with AI")}
                              </Button>
                            )}
                          </div>
                          {aiWorkpapers.length > 0 ? (
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5 w-[200px]">{t("Task")}</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-[180px]">{t("Evidences")}</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-[250px]">{t("Steps")}</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-[120px]">{t("Question Checklist")}</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-[100px]">{t("Comments")}</TableHead>
                                    {isAuditHead && <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5 w-[100px]">{t("Action")}</TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {aiWorkpapers.map((wp) => (
                                    <TableRow key={wp.id} className="border-b hover:bg-slate-50">
                                      <TableCell className="align-top py-4">
                                        <div className="space-y-3">
                                          <p className="text-slate-800">{wp.task}</p>
                                          <div><span className="text-slate-700 font-medium block mb-1">{t("Executed")}</span><Checkbox checked={wp.executed} onCheckedChange={() => handleToggleExecuted(wp.id, wp.executed)} /></div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="align-top py-4"><div className="text-sm text-slate-700 space-y-1">{renderJsonList(wp.evidences)}</div></TableCell>
                                      <TableCell className="align-top py-4"><div className="text-sm text-slate-700 space-y-1">{renderJsonList(wp.steps)}</div></TableCell>
                                      <TableCell className="align-top py-4"><div className="text-sm text-slate-700 space-y-1">{renderJsonList(wp.questionChecklist)}</div></TableCell>
                                      <TableCell className="align-top py-4 text-center">{wp.comments || "-"}</TableCell>
                                      {isAuditHead && (
                                        <TableCell className="align-top py-4 pe-5">
                                          <div className="flex items-center gap-0.5">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" title={t("Edit")} onClick={() => handleOpenEditAIWorkpaper(wp)} disabled={isReadOnly}><Pencil className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" title={t("Delete")} onClick={() => { setSelectedAIWorkpaper(wp); setDeleteAIWorkpaperDialogOpen(true); }} disabled={isReadOnly}><Trash2 className="h-4 w-4" /></Button>
                                          </div>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                                <FileText className="h-6 w-6 text-primary-400" />
                              </div>
                              <p className="text-sm font-medium text-slate-600 mb-1">{t("No AI-generated workpapers available")}</p>
                              <p className="text-xs text-slate-400">{t("Generate workpapers with AI to get started")}</p>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    )}

                    {/* Tab 3: Tasks - Hidden for auditees */}
                    {!isAuditeeOnly && (
                      <TabsContent value="tasks" className="mt-0 px-6 pt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-slate-800">{t("Audit Engagement Task List")}</h3>
                          {!isReadOnly && (
                            <Button size="sm" onClick={openAddTaskDialog}>
                              {t("Add Task")}
                            </Button>
                          )}
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5 w-[60px]">#</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Task Description")}</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-[100px] text-center">{t("Status")}</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-[160px]">{t("Document")}</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Comments")}</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5 w-[120px]">{t("Actions")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {taskList.length > 0 ? taskList.map((task, idx) => (
                                <TableRow key={task.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                                  <TableCell className="py-3 ps-5 text-sm text-slate-500 font-medium">{task.refNo || idx + 1}</TableCell>
                                  <TableCell className="py-3 text-sm text-slate-700 max-w-[250px]">
                                    <span className="line-clamp-2">{task.task || <span className="text-slate-400 italic">{t("No description")}</span>}</span>
                                  </TableCell>
                                  <TableCell className="py-3 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                      task.executed
                                        ? "bg-green-100 text-green-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}>
                                      {task.executed ? t("Done") : t("Pending")}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-3">
                                    {task.document ? (
                                      <a href={`/api${task.document}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-sm truncate max-w-[120px] inline-block" title={task.documentName || t("Document")}>
                                        <span className="flex items-center gap-1">
                                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                          <span className="truncate">{task.documentName || t("View")}</span>
                                        </span>
                                      </a>
                                    ) : (
                                      <span className="text-xs text-slate-400">{t("No document")}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-3 text-sm text-slate-600 max-w-[200px]">
                                    <span className="line-clamp-1">{task.comments || "-"}</span>
                                  </TableCell>
                                  <TableCell className="py-3 pe-5">
                                    <div className="flex items-center gap-0.5">
                                      {!isReadOnly && (
                                        <>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openEditTaskDialog(task)} title={t("Edit")}>
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost" size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-slate-600"
                                            disabled={uploadingTaskDocument === task.id}
                                            title={t("Upload Document")}
                                            onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"; input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) handleUploadTaskDocument(task.id, file); }; input.click(); }}
                                          >
                                            {uploadingTaskDocument === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                          </Button>
                                        </>
                                      )}
                                      {isReadOnly && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => openEditTaskDialog(task)} title={t("View")}>
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      )}
                                      {isAuditHead && !isReadOnly && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => handleDeleteTask(task.id)} title={t("Delete")}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )) : (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={6} className="py-16 text-center">
                                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                                      <FileText className="h-6 w-6 text-primary-400" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-600 mb-1">{t("No tasks yet")}</p>
                                    <p className="text-xs text-slate-400">{t("Click \"Add Task\" to create one")}</p>
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    )}

                    {/* Tab 4: Evidence Requests - Visible for all */}
                    <TabsContent value="evidence" className="mt-0 px-6 pt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-800">{t("Evidence Request")}</h3>
                          {!isAuditeeOnly && isAuditHead && selectedEvidenceIds.length > 0 && (
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 ltr:ml-3 rtl:mr-3" onClick={handleAIReview} disabled={generatingAIReview || isReadOnly}>
                              {generatingAIReview ? t("Generating...") : `${t("AI Review")} (${selectedEvidenceIds.length})`}
                            </Button>
                          )}
                          {!isAuditeeOnly && isAuditHead && selectedEvidenceIds.length === 0 && (
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 ltr:ml-3 rtl:mr-3" onClick={handleAIReview} disabled={generatingAIReview || isReadOnly}>
                              {generatingAIReview ? t("Generating...") : t("AI Review")}
                            </Button>
                          )}
                        </div>
                        {!isAuditeeOnly && isAuditHead && (
                          <Button size="sm" onClick={() => setAddEvidenceDialogOpen(true)} disabled={isReadOnly}>
                            {t("Add Evidence Request")}
                          </Button>
                        )}
                      </div>
                      {aiReviewSelectionError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm text-red-600">{aiReviewSelectionError}</p>
                        </div>
                      )}
                      {isAuditeeOnly ? (
                        filteredEvidenceRequests.length > 0 ? (
                          <div className="space-y-4">
                            {filteredEvidenceRequests.map((er) => (
                              <div key={er.id} className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                                <div className="flex items-start gap-4">
                                  <div className="pt-1"><Checkbox checked={selectedEvidenceIds.includes(er.id)} onCheckedChange={(checked) => handleSelectEvidence(er.id, checked === true)} className="border-primary-600 data-[state=checked]:bg-primary-600 data-[state=checked]:text-white" /></div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1"><span className="text-slate-700 font-semibold">{t("Title")} : {er.title}</span><span className="text-slate-400">|</span><span className="text-slate-700 font-semibold">{t("Sample Size")} : {er.numberOfSamples || "-"}</span></div>
                                    <p className="text-slate-500 text-sm">{t("Description")}: {er.description || "-"}</p>
                                    {er.attachments && er.attachments.length > 0 && (<div className="mt-2 flex items-center gap-2 text-sm text-green-600"><FileText className="h-4 w-4" /><span>{er.attachments.length} {t("file(s) uploaded")}</span></div>)}
                                  </div>
                                  <div className="flex-shrink-0 w-[280px]">
                                    <div className="flex items-center gap-2 mb-1"><MessageSquare className="h-4 w-4 text-slate-500" /><span className="text-sm font-medium text-slate-700">{t("AI Review")}</span></div>
                                    {(er.aiReviewStatus || er.aiReviewComment) ? (
                                      <div className="flex items-start gap-2"><div className="flex-shrink-0 mt-0.5">{getAIReviewStatusIcon(er.aiReviewStatus)}</div><div className="min-w-0 flex-1">{er.aiReviewStatus && <span className="text-xs font-medium text-slate-600 block mb-0.5 capitalize">{er.aiReviewStatus}</span>}{er.aiReviewComment && <p className="text-xs text-slate-600 line-clamp-3">{er.aiReviewComment}</p>}</div></div>
                                    ) : (<><div className="flex items-center gap-1 mb-1"><div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center"><span className="text-white text-xs">⏳</span></div><span className="text-sm text-yellow-600 font-medium">{er.status === 'Submitted' ? t('Awaiting Review') : t('Pending')}</span></div><p className="text-xs text-amber-600 line-clamp-2">{er.status === 'Pending' ? t('Waiting for document upload and review.') : er.status === 'Submitted' ? t('Document submitted. Awaiting AI review.') : t('Awaiting review.')}</p></>)}
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button variant="ghost" size="icon" title={t("View Details")} onClick={() => handleOpenViewEvidence(er, false)} className="h-8 w-8"><Eye className="h-5 w-5 text-slate-700" /></Button>
                                    <Button variant="ghost" size="icon" title={t("Add Attachment")} onClick={() => handleOpenAttachmentDialog(er)} className="h-8 w-8"><Paperclip className="h-5 w-5 text-slate-700" /></Button>
                                  </div>
                                </div>
                                {er.status === 'Pending' && (
                                  <div className="flex justify-end mt-4">
                                    <Button className="bg-primary-600 hover:bg-primary-700 text-white" onClick={() => { setAuditeeClariEvidence(er); setRespondDialogOpen(true); }}>{t("Submit Response")}</Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                              <FileText className="h-6 w-6 text-primary-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-600 mb-1">{t("No evidence requests found")}</p>
                            <p className="text-xs text-slate-400">{t("Add evidence requests to get started")}</p>
                          </div>
                        )
                      ) : (
                        filteredEvidenceRequests.length > 0 ? (
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                                  {isAuditHead && <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5 w-[50px]"><Checkbox checked={selectedEvidenceIds.length === filteredEvidenceRequests.length && filteredEvidenceRequests.length > 0} onCheckedChange={(checked) => handleSelectAllEvidence(checked === true)} /></TableHead>}
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Title")}</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Description")}</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Auditee")}</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Samples")}</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("AI Review")}</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5">{t("Action")}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredEvidenceRequests.map((er) => (
                                  <TableRow key={er.id} className="hover:bg-slate-50">
                                    {isAuditHead && <TableCell><Checkbox checked={selectedEvidenceIds.includes(er.id)} onCheckedChange={(checked) => handleSelectEvidence(er.id, checked === true)} /></TableCell>}
                                    <TableCell className="font-medium">{er.title}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">{er.description}</TableCell>
                                    <TableCell>{er.auditee || "-"}</TableCell>
                                    <TableCell>{er.numberOfSamples || "-"}</TableCell>
                                    <TableCell><span className={`px-2 py-1 rounded text-xs font-medium ${er.status === 'Reviewed' ? 'bg-emerald-100 text-emerald-800' : er.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : er.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-800'}`}>{er.status}</span></TableCell>
                                    <TableCell>
                                      {(er.aiReviewStatus || er.aiReviewComment) ? (
                                        <div className="flex items-start gap-2 max-w-[280px]"><div className="flex-shrink-0 mt-0.5">{getAIReviewStatusIcon(er.aiReviewStatus)}</div><div className="min-w-0 flex-1">{er.aiReviewStatus && <span className="text-xs font-medium text-slate-600 block mb-0.5 capitalize">{er.aiReviewStatus}</span>}{er.aiReviewComment && <p className="text-xs text-slate-600 line-clamp-3">{er.aiReviewComment}</p>}</div></div>
                                      ) : <span className="text-sm text-slate-400">-</span>}
                                    </TableCell>
                                    <TableCell className="pe-5">
                                      <div className="flex items-center gap-0.5">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" title={t("View")} onClick={() => handleOpenViewEvidence(er, false)}><Eye className="h-4 w-4" /></Button>
                                        {(isAuditHead || (isAuditee && er.auditeeId === currentUserId)) && <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" title={t("Add Attachment")} onClick={() => handleOpenAttachmentDialog(er)}><Upload className="h-4 w-4" /></Button>}
                                        {isAuditHead && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" title={t("Edit")} onClick={() => handleOpenViewEvidence(er, true)} disabled={isReadOnly}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" title={t("Delete")} onClick={() => { setEvidenceToDelete(er); setDeleteEvidenceDialogOpen(true); }} disabled={isReadOnly}><Trash2 className="h-4 w-4" /></Button></>)}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                              <FileText className="h-6 w-6 text-primary-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-600 mb-1">{t("No evidence requests found")}</p>
                            <p className="text-xs text-slate-400">{t("Add evidence requests to get started")}</p>
                          </div>
                        )
                      )}
                    </TabsContent>

                    {/* Tab 5: Other Documents - Hidden for auditees */}
                    {!isAuditeeOnly && (
                      <TabsContent value="documents" className="mt-0 px-6 pt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-slate-800">{t("Other Documents")}</h3>
                          <Button size="sm" onClick={() => { setUploadedFiles([]); setNewDocument({ title: "", documentType: "", description: "" }); setNewDocumentDialogOpen(true); }} disabled={isReadOnly}>
                            {t("Upload Document")}
                          </Button>
                        </div>
                        {otherDocuments.length > 0 ? (
                          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Title")}</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ">{t("Document Type")}</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Description")}</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("File")}</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Uploaded")}</TableHead>
                                  <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5">{t("Action")}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {otherDocuments.map((doc) => (
                                  <TableRow key={doc.id} className="border-b border-slate-100 last:border-0">
                                    <TableCell className="py-3 ps-5 font-medium text-sm text-slate-800">{doc.title || doc.fileName}</TableCell>
                                    <TableCell className="py-3 text-sm text-slate-700">{doc.documentType || "-"}</TableCell>
                                    <TableCell className="py-3 max-w-[200px] truncate text-sm text-slate-700">{doc.description || "-"}</TableCell>
                                    <TableCell className="py-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary-600" /><span className="text-sm text-slate-700">{doc.fileName}</span><span className="text-xs text-slate-400">({formatFileSize(doc.fileSize)})</span></div></TableCell>
                                    <TableCell className="py-3 text-sm text-slate-700">{formatDate(doc.uploadedAt)}</TableCell>
                                    <TableCell className="py-3 pe-5">
                                      <div className="flex items-center gap-0.5">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" title={t("View")} onClick={() => handleOpenViewDocument(doc, false)}><Eye className="h-4 w-4" /></Button>
                                        {isAuditHead && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" title={t("Edit")} onClick={() => handleOpenViewDocument(doc, true)} disabled={isReadOnly}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" title={t("Delete")} onClick={() => { setDocumentToDelete(doc); setDeleteDocumentDialogOpen(true); }} disabled={isReadOnly}><Trash2 className="h-4 w-4" /></Button></>)}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                              <FileText className="h-6 w-6 text-primary-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-600 mb-1">{t("No other documents uploaded yet")}</p>
                            <p className="text-xs text-slate-400">{t("Upload documents to get started")}</p>
                          </div>
                        )}
                      </TabsContent>
                    )}

                    {/* Tab 6: Findings - Visible for all */}
                    <TabsContent value="findings" className="mt-0 px-6 pt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-800">{t("Findings")}</h3>
                        {!isAuditeeOnly && (
                          <Button size="sm" onClick={() => setAddFullFindingDialogOpen(true)} disabled={isReadOnly}>{t("Add Finding")}</Button>
                        )}
                      </div>
                      {findings.length > 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Finding ID")}</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Title")}</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Severity")}</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Responsible Person")}</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Target Date")}</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5">{t("Action")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {findings.map((finding) => (
                                <TableRow key={finding.id} className="border-b border-slate-100 last:border-0">
                                  <TableCell className="py-3 ps-5 font-medium text-sm text-slate-800">{finding.findingId || '-'}</TableCell>
                                  <TableCell className="py-3 max-w-[200px] truncate text-sm text-slate-700">{finding.title}</TableCell>
                                  <TableCell className="py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${finding.severity === 'Critical' ? 'bg-red-100 text-red-800' : finding.severity === 'High' ? 'bg-orange-100 text-orange-800' : finding.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-emerald-100 text-emerald-800'}`}>{finding.severity}</span></TableCell>
                                  <TableCell className="py-3 text-sm text-slate-700">{finding.responsiblePerson || '-'}</TableCell>
                                  <TableCell className="py-3 text-sm text-slate-700">{formatDate(finding.targetDate || null)}</TableCell>
                                  <TableCell className="py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${finding.status === 'Closed' ? 'bg-emerald-100 text-emerald-800' : finding.status === 'Under Review' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>{finding.status}</span></TableCell>
                                  <TableCell className="py-3 pe-5">
                                    <div className="flex items-center gap-0.5">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => { setSelectedFindingId(finding.id); setFindingDetailMode("view"); fetchFindingDetails(finding.id); setFindingDetailDialogOpen(true); }} title={t("View")}><Eye className="h-4 w-4" /></Button>
                                      {isAuditHead && (<><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => { setSelectedFindingId(finding.id); setFindingDetailMode("edit"); fetchFindingDetails(finding.id, "edit"); setFindingDetailDialogOpen(true); }} title={t("Edit")} disabled={isReadOnly}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-semantic-error" onClick={() => { setFindingToDelete(finding); setDeleteFindingDialogOpen(true); }} title={t("Delete")} disabled={isReadOnly}><Trash2 className="h-4 w-4" /></Button></>)}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                            <FileText className="h-6 w-6 text-primary-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600 mb-1">{t("No findings recorded yet")}</p>
                          <p className="text-xs text-slate-400">{t("Add findings to document audit observations")}</p>
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              </>
            )}
          </div>

          {/* Fixed Footer with Action Buttons */}
          {!loading && engagement && (
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex items-center justify-end gap-3">
              {!isAuditeeOnly && (
                <Button variant="outline" onClick={() => setCommentsDialogOpen(true)}>
                  {t("Comments")}
                </Button>
              )}
              {engagement.status !== "Completed" && !isAuditeeOnly && (
                <Button className="bg-primary-600 hover:bg-primary-700 text-white" onClick={handleMarkAsCompleted} disabled={markingComplete || isReadOnly}>
                  {markingComplete ? t("Marking...") : t("Mark as Completed")}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={commentsDialogOpen} onOpenChange={(open) => {
        setCommentsDialogOpen(open);
        if (open) {
          fetchComments();
        }
      }}>
        <DialogContent className="sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Engagement Comments")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label>{t("Add a comment")}</Label>
              <Textarea
                placeholder={t("Type your comment here...")}
                rows={4}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={submittingComment}
              />
            </div>
            {loadingComments ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm font-medium text-slate-700">{t("Comments")}</div>
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-slate-900">{comment.user.fullName}</div>
                        {comment.user.designation && (
                          <div className="text-xs text-slate-500">{comment.user.designation}</div>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(comment.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{comment.comment}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-6 w-6 text-primary-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">{t("No comments yet")}</p>
                <p className="text-xs text-slate-400">{t("Be the first to add a comment")}</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => setCommentsDialogOpen(false)}>{t("Close")}</Button>
            <Button onClick={handleAddComment} disabled={!newComment.trim() || submittingComment}>
              {submittingComment ? t("Adding...") : t("Add Comment")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Upload")} {uploadCategory === "workpapers" ? t("Workpaper") : t("Document")}</DialogTitle></DialogHeader></div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${uploadFilesError ? "border-red-500" : isDragOver ? "border-primary-500 bg-primary-50" : "border-slate-300 hover:border-slate-400"}`} onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleFileDrop} onClick={() => fileInputRef.current?.click()}>
              <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-3">
                <Upload className="h-6 w-6 text-primary-500" />
              </div>
              <p className="text-sm font-medium text-slate-700">{t("Drag and drop files here, or click to browse")}</p>
              <p className="text-xs text-slate-400 mt-1">{t("Supported formats")}: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG</p>
              <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={handleFileSelect} />
            </div>
            {uploadFilesError && <p className="text-sm text-red-500 mt-1">{uploadFilesError}</p>}
            {uploadedFiles.length > 0 && (<div className="space-y-2">{uploadedFiles.map((file) => (<div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-primary-500" /><div><span className="text-sm font-medium text-slate-700">{file.name}</span><span className="text-xs text-slate-400 ltr:ml-2 rtl:mr-2">({formatFileSize(file.size)})</span></div></div><Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeFile(file.id)}><X className="h-4 w-4" /></Button></div>))}</div>)}
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleUploadFiles} disabled={uploading || uploadedFiles.length === 0 || isReadOnly}>{uploading ? t("Uploading...") : t("Upload")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Finding Dialog */}
      <Dialog open={addFindingDialogOpen} onOpenChange={setAddFindingDialogOpen}>
        <DialogContent className="sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Finding")}</DialogTitle></DialogHeader></div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Title")} <span className="text-red-500">*</span></Label>
              <div>
                <Input value={newFinding.title} onChange={(e) => { setNewFinding({ ...newFinding, title: e.target.value }); setFindingTitleError(""); }} placeholder={t("Enter finding title")} className={findingTitleError ? "border-red-500" : ""} />
                {findingTitleError && <p className="text-sm text-red-500 mt-1">{findingTitleError}</p>}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4"><Label className="text-end text-slate-500 pt-2">{t("Description")}</Label><Textarea value={newFinding.description} onChange={(e) => setNewFinding({ ...newFinding, description: e.target.value })} placeholder={t("Enter description")} rows={3} /></div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-4"><Label className="text-end text-slate-500">{t("Severity")}</Label><Select value={newFinding.severity} onValueChange={(value) => setNewFinding({ ...newFinding, severity: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Low">{t("Low")}</SelectItem><SelectItem value="Medium">{t("Medium")}</SelectItem><SelectItem value="High">{t("High")}</SelectItem><SelectItem value="Critical">{t("Critical")}</SelectItem></SelectContent></Select></div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4"><Label className="text-end text-slate-500 pt-2">{t("Recommendation")}</Label><Textarea value={newFinding.recommendation} onChange={(e) => setNewFinding({ ...newFinding, recommendation: e.target.value })} placeholder={t("Enter recommendation")} rows={3} /></div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0"><Button variant="outline" onClick={() => setAddFindingDialogOpen(false)}>{t("Cancel")}</Button><Button onClick={handleAddFinding} disabled={isReadOnly}>{t("Add Finding")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Add Full Finding Dialog */}
      <Dialog open={addFullFindingDialogOpen} onOpenChange={setAddFullFindingDialogOpen}>
        <DialogContent className="sm:max-w-[700px] flex flex-col p-0 gap-0 h-[95vh]" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Finding")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="px-6 py-6 space-y-8 overflow-y-auto flex-1">
            {/* Basic Information Section */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Basic Information")}</h3>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Finding Title")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={fullFinding.findingTitle}
                    onChange={(e) => { setFullFinding({ ...fullFinding, findingTitle: e.target.value }); setFullFindingTitleError(""); }}
                    placeholder={t("Enter a descriptive title for this finding")}
                    className={`w-full bg-white focus:border-primary-500 focus:ring-primary-200 ${fullFindingTitleError ? "border-red-500" : "border-slate-300"}`}
                  />
                  {fullFindingTitleError && <p className="text-sm text-red-500 mt-1">{fullFindingTitleError}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">{t("Severity")}</Label>
                  <Select value={fullFinding.severity} onValueChange={(value) => setFullFinding({ ...fullFinding, severity: value })}>
                    <SelectTrigger className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200">
                      <SelectValue placeholder={t("Select severity level")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {t("Low")}
                        </span>
                      </SelectItem>
                      <SelectItem value="Medium">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                          {t("Medium")}
                        </span>
                      </SelectItem>
                      <SelectItem value="High">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                          {t("High")}
                        </span>
                      </SelectItem>
                      <SelectItem value="Critical">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          {t("Critical")}
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 4Cs Analysis Section */}
            <div className="space-y-5 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Finding Analysis (4Cs)")}</h3>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Criteria (What should be)")}
                  </Label>
                  <Textarea
                    value={fullFinding.criteria}
                    onChange={(e) => setFullFinding({ ...fullFinding, criteria: e.target.value })}
                    placeholder={t("Describe the standard, policy, or expected condition")}
                    rows={3}
                    className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Condition (What is)")}
                  </Label>
                  <Textarea
                    value={fullFinding.condition}
                    onChange={(e) => setFullFinding({ ...fullFinding, condition: e.target.value })}
                    placeholder={t("Describe the actual situation observed")}
                    rows={3}
                    className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Cause (Why it happened)")}
                  </Label>
                  <Textarea
                    value={fullFinding.cause}
                    onChange={(e) => setFullFinding({ ...fullFinding, cause: e.target.value })}
                    placeholder={t("Identify the root cause of the finding")}
                    rows={3}
                    className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Effect (The consequence)")}
                  </Label>
                  <Textarea
                    value={fullFinding.effect}
                    onChange={(e) => setFullFinding({ ...fullFinding, effect: e.target.value })}
                    placeholder={t("Describe the impact or potential consequences")}
                    rows={3}
                    className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">{t("Recommendation")}</Label>
                  <Textarea
                    value={fullFinding.recommendation}
                    onChange={(e) => setFullFinding({ ...fullFinding, recommendation: e.target.value })}
                    placeholder={t("Provide recommendations to address the finding")}
                    rows={3}
                    className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Attachments Section */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Attachments")}</h3>

              <div className="space-y-3">
                <div
                  className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors border-slate-300 hover:border-slate-400"
                  onClick={() => findingAttachmentInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files) {
                      setFindingAttachments((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
                    }
                  }}
                >
                  <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-2">
                    <Upload className="h-5 w-5 text-primary-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">{t("Drag and drop files here, or click to browse")}</p>
                  <p className="text-xs text-slate-400 mt-1">{t("Supported formats")}: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG</p>
                </div>
                <input
                  type="file"
                  ref={findingAttachmentInputRef}
                  onChange={(e) => {
                    if (e.target.files) {
                      setFindingAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
                      e.target.value = "";
                    }
                  }}
                  className="hidden"
                  multiple
                />

                {findingAttachments.length > 0 && (
                  <div className="space-y-2">
                    {findingAttachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-primary-600" />
                          </div>
                          <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                          onClick={() => setFindingAttachments((prev) => prev.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* CAPA Section */}
            <div className="space-y-5 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                {t("Corrective & Preventive Actions (CAPA)")}
              </h3>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">{t("Responsible Person")}</Label>
                  <Select
                    value={fullFinding.responsiblePersonId}
                    onValueChange={(value) => setFullFinding({ ...fullFinding, responsiblePersonId: value })}
                  >
                    <SelectTrigger className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200">
                      <SelectValue placeholder={t("Select responsible person")} />
                    </SelectTrigger>
                    <SelectContent>
                      {auditees.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                          {user.department?.name && (
                            <span className="text-slate-500 text-xs ml-2">({user.department.name})</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                  <Select value={fullFinding.status} onValueChange={(value) => setFullFinding({ ...fullFinding, status: value })}>
                    <SelectTrigger className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200">
                      <SelectValue placeholder={t("Select status")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Open">{t("Open")}</SelectItem>
                      <SelectItem value="Under Review">{t("Under Review")}</SelectItem>
                      <SelectItem value="Closed">{t("Closed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">{t("Target Closure Date")}</Label>
                  <DatePicker
                    value={fullFinding.targetClosureDate}
                    onChange={(date) =>
                      setFullFinding({ ...fullFinding, targetClosureDate: date ? formatLocalDate(date) : "" })
                    }
                    placeholder={t("Select target closure date")}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => setAddFullFindingDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleAddFullFinding}
              disabled={savingFullFinding || isReadOnly}
            >
              {savingFullFinding ? t("Saving...") : t("Save Finding")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Evidence Request Dialog */}
      <Dialog open={addEvidenceDialogOpen} onOpenChange={setAddEvidenceDialogOpen}>
        <DialogContent className="sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Evidence Request")}</DialogTitle></DialogHeader></div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Title")} <span className="text-red-500">*</span></Label>
              <div>
                <Input value={newEvidence.title} onChange={(e) => { setNewEvidence({ ...newEvidence, title: e.target.value }); setNewEvidenceTitleError(""); }} placeholder={t("Enter evidence request title")} className={newEvidenceTitleError ? "border-red-500" : ""} />
                {newEvidenceTitleError && <p className="text-sm text-red-500 mt-1">{newEvidenceTitleError}</p>}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4"><Label className="text-end text-slate-500 pt-2">{t("Description")}</Label><Textarea value={newEvidence.description} onChange={(e) => setNewEvidence({ ...newEvidence, description: e.target.value })} placeholder={t("Enter description")} rows={3} /></div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-4"><Label className="text-end text-slate-500">{t("Auditee")} <span className="text-red-500">*</span></Label><Select value={newEvidence.auditeeId} onValueChange={(value) => { const sa = auditees.find(a => a.id === value); setNewEvidence({ ...newEvidence, auditeeId: value, auditee: sa?.fullName || "" }); }}><SelectTrigger><SelectValue placeholder={t("Select auditee")} /></SelectTrigger><SelectContent>{auditees.map((auditee) => (<SelectItem key={auditee.id} value={auditee.id}>{auditee.fullName} {auditee.department?.name ? `(${auditee.department.name})` : ""}</SelectItem>))}</SelectContent></Select></div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-4"><Label className="text-end text-slate-500">{t("Number of Samples")}</Label><Input type="number" min="1" value={newEvidence.numberOfSamples} onChange={(e) => setNewEvidence({ ...newEvidence, numberOfSamples: e.target.value })} placeholder={t("Enter number of samples required")} /></div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0"><Button variant="outline" onClick={() => { setAddEvidenceDialogOpen(false); setNewEvidenceTitleError(""); }}>{t("Cancel")}</Button><Button onClick={handleAddEvidence} disabled={isReadOnly}>{t("Add Evidence Request")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Delete Finding Confirmation */}
      <Dialog open={deleteFindingDialogOpen} onOpenChange={setDeleteFindingDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Finding")}</DialogTitle><DialogDescription className="text-slate-600">{t("Are you sure you want to delete the finding")} &quot;{findingToDelete?.title}&quot;? {t("This action cannot be undone.")}</DialogDescription></DialogHeader></div>
          <div className="px-6 py-4 flex justify-end gap-3"><Button variant="outline" onClick={() => { setDeleteFindingDialogOpen(false); setFindingToDelete(null); }}>{t("Cancel")}</Button><Button variant="destructive" onClick={handleDeleteFinding} disabled={deletingFinding || isReadOnly}>{deletingFinding ? t("Deleting...") : t("Delete")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* New Document Upload Dialog */}
      <Dialog open={newDocumentDialogOpen} onOpenChange={setNewDocumentDialogOpen}>
        <DialogContent className="sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("New Document")}</DialogTitle></DialogHeader></div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Title")} <span className="text-red-500">*</span></Label>
              <Input value={newDocument.title} onChange={(e) => { setNewDocument({ ...newDocument, title: e.target.value }); setNewDocumentTitleError(""); }} placeholder={t("Enter document title")} className={`mt-1.5 w-full ${newDocumentTitleError ? "border-red-500" : ""}`} />
              {newDocumentTitleError && <p className="text-sm text-red-500 mt-1">{newDocumentTitleError}</p>}
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Document Type")}</Label>
              <Select value={newDocument.documentType} onValueChange={(value) => setNewDocument({ ...newDocument, documentType: value })}>
                <SelectTrigger className="mt-1.5 w-full bg-white"><SelectValue placeholder={t("Select document type")} /></SelectTrigger>
                <SelectContent><SelectItem value="Minutes of Meeting">{t("Minutes of Meeting")}</SelectItem><SelectItem value="Approval Document">{t("Approval Document")}</SelectItem><SelectItem value="Email Communication">{t("Email Communication")}</SelectItem><SelectItem value="Contract">{t("Contract")}</SelectItem><SelectItem value="Invoice">{t("Invoice")}</SelectItem><SelectItem value="Policy Document">{t("Policy Document")}</SelectItem><SelectItem value="Other">{t("Other")}</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Textarea value={newDocument.description} onChange={(e) => setNewDocument({ ...newDocument, description: e.target.value })} placeholder={t("Enter description")} rows={3} className="mt-1.5 w-full" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Attach File")}</Label>
              <div className={`mt-1.5 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${newDocumentFileError ? "border-red-500" : isDragOver ? "border-primary-500 bg-primary-50" : "border-slate-200 hover:border-slate-300"}`} onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleFileDrop} onClick={() => fileInputRef.current?.click()}>
                <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-2">
                  <Upload className="h-5 w-5 text-primary-500" />
                </div>
                <p className="text-sm text-slate-600">{t("Drag and drop files here, or click to browse")}</p>
                <p className="text-xs text-slate-400 mt-1">{t("Supported formats")}: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG</p>
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={handleFileSelect} />
              </div>
              {newDocumentFileError && <p className="text-sm text-red-500 mt-1">{newDocumentFileError}</p>}
              {uploadedFiles.length > 0 && (<div className="space-y-2 mt-2">{uploadedFiles.map((file) => (<div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-primary-500" /><div><span className="text-sm font-medium text-slate-700">{file.name}</span><span className="text-xs text-slate-400 ltr:ml-2 rtl:mr-2">({formatFileSize(file.size)})</span></div></div><Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}><X className="h-4 w-4" /></Button></div>))}</div>)}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0"><Button variant="outline" onClick={() => { setNewDocumentDialogOpen(false); setUploadedFiles([]); setNewDocument({ title: "", documentType: "", description: "" }); setNewDocumentTitleError(""); setNewDocumentFileError(""); }}>{t("Cancel")}</Button><Button onClick={handleUploadDocument} disabled={uploading || isReadOnly}>{uploading ? t("Saving...") : t("Save")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation */}
      <Dialog open={deleteDocumentDialogOpen} onOpenChange={setDeleteDocumentDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Document")}</DialogTitle><DialogDescription className="text-slate-600">{t("Are you sure you want to delete")} &quot;{documentToDelete?.title || documentToDelete?.fileName}&quot;? {t("This action cannot be undone.")}</DialogDescription></DialogHeader></div>
          <div className="px-6 py-4 flex justify-end gap-3"><Button variant="outline" onClick={() => { setDeleteDocumentDialogOpen(false); setDocumentToDelete(null); }}>{t("Cancel")}</Button><Button variant="destructive" onClick={handleDeleteDocument} disabled={deletingDocument || isReadOnly}>{deletingDocument ? t("Deleting...") : t("Delete")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Delete Workpaper Confirmation */}
      <Dialog open={deleteWorkpaperDialogOpen} onOpenChange={setDeleteWorkpaperDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Workpaper")}</DialogTitle><DialogDescription className="text-slate-600">{t("Are you sure you want to delete")} &quot;{workpaperToDelete?.fileName}&quot;? {t("This action cannot be undone.")}</DialogDescription></DialogHeader></div>
          <div className="px-6 py-4 flex justify-end gap-3"><Button variant="outline" onClick={() => { setDeleteWorkpaperDialogOpen(false); setWorkpaperToDelete(null); }}>{t("Cancel")}</Button><Button variant="destructive" onClick={handleDeleteWorkpaper} disabled={deletingWorkpaper || isReadOnly}>{deletingWorkpaper ? t("Deleting...") : t("Delete")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Edit AI Workpaper Dialog */}
      <Dialog open={editAIWorkpaperDialogOpen} onOpenChange={setEditAIWorkpaperDialogOpen}>
        <DialogContent className="sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit AI Workpaper")}</DialogTitle></DialogHeader></div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Task")} <span className="text-red-500">*</span></Label>
              <div>
                <Input value={editAIWorkpaper.task} onChange={(e) => { setEditAIWorkpaper({ ...editAIWorkpaper, task: e.target.value }); setAiWorkpaperTaskError(""); }} placeholder={t("Enter task description")} className={aiWorkpaperTaskError ? "border-red-500" : ""} />
                {aiWorkpaperTaskError && <p className="text-sm text-red-500 mt-1">{aiWorkpaperTaskError}</p>}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4"><Label className="text-end text-slate-500 pt-2">{t("Evidences")}</Label><Textarea value={editAIWorkpaper.evidences} onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, evidences: e.target.value })} placeholder={t("Enter evidences (one per line)")} rows={4} /></div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4"><Label className="text-end text-slate-500 pt-2">{t("Steps")}</Label><Textarea value={editAIWorkpaper.steps} onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, steps: e.target.value })} placeholder={t("Enter steps (one per line)")} rows={4} /></div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-4"><Label className="text-end text-slate-500">{t("Question Checklist")}</Label><Input value={editAIWorkpaper.questionChecklist} onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, questionChecklist: e.target.value })} placeholder={t("Enter question checklist")} /></div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4"><Label className="text-end text-slate-500 pt-2">{t("Comments")}</Label><Textarea value={editAIWorkpaper.comments} onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, comments: e.target.value })} placeholder={t("Enter comments")} rows={2} /></div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0"><Button variant="outline" onClick={() => { setEditAIWorkpaperDialogOpen(false); setSelectedAIWorkpaper(null); }}>{t("Cancel")}</Button><Button onClick={handleUpdateAIWorkpaper} disabled={savingAIWorkpaper || isReadOnly}>{savingAIWorkpaper ? t("Saving...") : t("Save Changes")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Delete AI Workpaper Confirmation */}
      <Dialog open={deleteAIWorkpaperDialogOpen} onOpenChange={setDeleteAIWorkpaperDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete AI Workpaper")}</DialogTitle><DialogDescription className="text-slate-600">{t("Are you sure you want to delete this AI workpaper?")} {t("This action cannot be undone.")}</DialogDescription></DialogHeader></div>
          <div className="px-6 py-4 flex justify-end gap-3"><Button variant="outline" onClick={() => { setDeleteAIWorkpaperDialogOpen(false); setSelectedAIWorkpaper(null); }}>{t("Cancel")}</Button><Button variant="destructive" onClick={handleDeleteAIWorkpaper} disabled={deletingAIWorkpaper || isReadOnly}>{deletingAIWorkpaper ? t("Deleting...") : t("Delete")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Generated Workpaper with AI Dialog */}
      <Dialog open={generateAIDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) { setEditingGeneratedId(null); } setGenerateAIDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-[750px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary-500" />
                {t("Generate Workpapers with AI")}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 overflow-y-auto flex-1">
            {generatingWorkpapers ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative mb-4">
                  <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
                  <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
                <p className="text-sm font-medium text-slate-600">{t("Generating workpapers...")}</p>
                <p className="text-xs text-slate-400 mt-1">{t("This may take a moment")}</p>
              </div>
            ) : generatedWorkpapers.length > 0 ? (
              <div className="space-y-4">
                {/* Select All / Deselect All */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <p className="text-sm text-slate-500">{generatedWorkpapers.length} {t("workpapers generated")}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-primary-600 hover:text-primary-700"
                    onClick={() => {
                      if (selectedGeneratedIds.length === generatedWorkpapers.length) {
                        setSelectedGeneratedIds([]);
                      } else {
                        setSelectedGeneratedIds(generatedWorkpapers.map((wp) => wp.id));
                      }
                    }}
                  >
                    {selectedGeneratedIds.length === generatedWorkpapers.length ? t("Deselect All") : t("Select All")}
                  </Button>
                </div>

                {generatedWorkpapers.map((wp) => (
                  <div key={wp.id} className={`border rounded-xl overflow-hidden transition-all ${selectedGeneratedIds.includes(wp.id) ? "border-primary-500 bg-primary-50/50 shadow-sm" : "border-slate-200 hover:border-slate-300"}`}>
                    {editingGeneratedId === wp.id ? (
                      /* Inline Edit Mode */
                      <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Edit Workpaper")}</h4>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={() => setEditingGeneratedId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">{t("Task")}</Label>
                            <Input
                              value={editingGeneratedData.task}
                              onChange={(e) => setEditingGeneratedData({ ...editingGeneratedData, task: e.target.value })}
                              placeholder={t("Enter task description")}
                              className="bg-white"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">{t("Steps")}</Label>
                            <Textarea
                              value={editingGeneratedData.steps}
                              onChange={(e) => setEditingGeneratedData({ ...editingGeneratedData, steps: e.target.value })}
                              placeholder={t("Enter steps (one per line)")}
                              rows={3}
                              className="bg-white resize-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">{t("Evidences")}</Label>
                            <Textarea
                              value={editingGeneratedData.evidences}
                              onChange={(e) => setEditingGeneratedData({ ...editingGeneratedData, evidences: e.target.value })}
                              placeholder={t("Enter evidences (one per line)")}
                              rows={3}
                              className="bg-white resize-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500">{t("Question Checklist")}</Label>
                            <Textarea
                              value={editingGeneratedData.questionChecklist}
                              onChange={(e) => setEditingGeneratedData({ ...editingGeneratedData, questionChecklist: e.target.value })}
                              placeholder={t("Enter question checklist (one per line)")}
                              rows={2}
                              className="bg-white resize-none"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingGeneratedId(null)}>{t("Cancel")}</Button>
                          <Button size="sm" onClick={() => {
                            const serializeField = (field: string) => { const lines = field.split('\n').map(line => line.trim()).filter(line => line.length > 0); return JSON.stringify(lines); };
                            setGeneratedWorkpapers((prev) => prev.map((item) => item.id === wp.id ? { ...item, task: editingGeneratedData.task, steps: serializeField(editingGeneratedData.steps), evidences: serializeField(editingGeneratedData.evidences), questionChecklist: serializeField(editingGeneratedData.questionChecklist) } : item));
                            setEditingGeneratedId(null);
                          }}>{t("Save")}</Button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedGeneratedIds.includes(wp.id)}
                            onCheckedChange={() => handleToggleGeneratedSelection(wp.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <h4 className="font-semibold text-slate-900 text-sm">{wp.task}</h4>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-400 hover:text-primary-600"
                                  title={t("Edit")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const parseField = (field: string) => { try { const parsed = JSON.parse(field); return Array.isArray(parsed) ? parsed.join('\n') : field; } catch { return field; } };
                                    setEditingGeneratedData({ task: wp.task, steps: parseField(wp.steps), evidences: parseField(wp.evidences), questionChecklist: parseField(wp.questionChecklist) });
                                    setEditingGeneratedId(wp.id);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-400 hover:text-semantic-error"
                                  title={t("Delete")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGeneratedWorkpapers((prev) => prev.filter((item) => item.id !== wp.id));
                                    setSelectedGeneratedIds((prev) => prev.filter((id) => id !== wp.id));
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h5 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">{t("Steps")}</h5>
                                <div className="text-sm text-slate-600 space-y-1">{renderJsonList(wp.steps)}</div>
                              </div>
                              <div>
                                <h5 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">{t("Evidences")}</h5>
                                <div className="text-sm text-slate-600 space-y-1">{renderJsonList(wp.evidences)}</div>
                              </div>
                            </div>
                            {wp.questionChecklist && (() => { try { const items = JSON.parse(wp.questionChecklist); return Array.isArray(items) && items.length > 0; } catch { return wp.questionChecklist.trim().length > 0; } })() && (
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <h5 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">{t("Question Checklist")}</h5>
                                <div className="text-sm text-slate-600 space-y-1">{renderJsonList(wp.questionChecklist)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-7 w-7 text-primary-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">{t("No workpapers generated yet")}</p>
                <p className="text-xs text-slate-400 mb-5 max-w-[280px] mx-auto">{t("Click Generate to create AI workpapers based on the engagement")}</p>
                <Button size="sm" onClick={handleGenerateAIWorkpapers} disabled={generatingWorkpapers || isReadOnly}>
                  <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Generate")}
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <div className="flex-1">
              {generatedWorkpapersError && <p className="text-sm text-red-500 flex items-center">{generatedWorkpapersError}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => { setGenerateAIDialogOpen(false); setGeneratedWorkpapers([]); setSelectedGeneratedIds([]); setGeneratedWorkpapersError(""); setEditingGeneratedId(null); }}>{t("Cancel")}</Button>
              {generatedWorkpapers.length > 0 && (
                <Button onClick={handleAddSelectedWorkpapers} disabled={addingGeneratedWorkpapers || selectedGeneratedIds.length === 0 || isReadOnly}>
                  {addingGeneratedWorkpapers ? t("Adding...") : `${t("Add Selected")} (${selectedGeneratedIds.length})`}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View/Edit Document Dialog */}
      <Dialog open={viewEditDocumentDialogOpen} onOpenChange={setViewEditDocumentDialogOpen}>
        <DialogContent className="sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{isEditingDocument ? t("Edit Document") : t("Document Details")}</DialogTitle></DialogHeader></div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Title")}</Label>
              {isEditingDocument ? (
                <div>
                  <Input value={editDocument.title} onChange={(e) => { setEditDocument({ ...editDocument, title: e.target.value }); setEditDocumentTitleError(""); }} placeholder={t("Enter document title")} className={editDocumentTitleError ? "border-red-500" : ""} />
                  {editDocumentTitleError && <p className="text-sm text-red-500 mt-1">{editDocumentTitleError}</p>}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border">{selectedDocument?.title || selectedDocument?.fileName || "-"}</div>
              )}
            </div>
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Document Type")}</Label>{isEditingDocument ? <Select value={editDocument.documentType} onValueChange={(value) => setEditDocument({ ...editDocument, documentType: value })}><SelectTrigger><SelectValue placeholder={t("Select document type")} /></SelectTrigger><SelectContent><SelectItem value="Minutes of Meeting">{t("Minutes of Meeting")}</SelectItem><SelectItem value="Approval Document">{t("Approval Document")}</SelectItem><SelectItem value="Email Communication">{t("Email Communication")}</SelectItem><SelectItem value="Contract">{t("Contract")}</SelectItem><SelectItem value="Invoice">{t("Invoice")}</SelectItem><SelectItem value="Policy Document">{t("Policy Document")}</SelectItem><SelectItem value="Other">{t("Other")}</SelectItem></SelectContent></Select> : <div className="p-3 bg-slate-50 rounded-md border">{selectedDocument?.documentType || "-"}</div>}</div>
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Description")}</Label>{isEditingDocument ? <Textarea value={editDocument.description} onChange={(e) => setEditDocument({ ...editDocument, description: e.target.value })} placeholder={t("Enter description")} rows={4} /> : <div className="p-3 bg-slate-50 rounded-md border min-h-[100px]">{selectedDocument?.description || "-"}</div>}</div>
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Attached File")}</Label><div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary-600" /><div><p className="text-sm font-medium">{selectedDocument?.fileName}</p><p className="text-xs text-slate-500">{formatFileSize(selectedDocument?.fileSize || 0)}</p></div></div><Button variant="outline" size="sm" onClick={() => { if (selectedDocument?.filePath) { const link = document.createElement("a"); link.href = `/api${selectedDocument.filePath}`; link.download = selectedDocument.fileName; link.click(); } }}>{t("Download")}</Button></div></div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0"><Button variant="outline" onClick={() => { setViewEditDocumentDialogOpen(false); setSelectedDocument(null); setIsEditingDocument(false); setEditDocumentTitleError(""); }}>{isEditingDocument ? t("Cancel") : t("Close")}</Button>{isEditingDocument && <Button onClick={handleUpdateDocument} disabled={savingDocument || isReadOnly}>{savingDocument ? t("Saving...") : t("Save")}</Button>}</div>
        </DialogContent>
      </Dialog>

      {/* View/Edit Evidence Request Dialog */}
      <Dialog open={viewEditEvidenceDialogOpen} onOpenChange={setViewEditEvidenceDialogOpen}>
        <DialogContent className="sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{isEditingEvidence ? t("Edit Evidence Request") : t("View Evidence Request")}</DialogTitle></DialogHeader></div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Request Title")} <span className="text-red-500">*</span></Label>
              {isEditingEvidence ? (
                <div>
                  <Input value={editEvidence.title} onChange={(e) => { setEditEvidence({ ...editEvidence, title: e.target.value }); setEditEvidenceTitleError(""); }} placeholder={t("Enter title")} className={editEvidenceTitleError ? "border-red-500" : ""} />
                  {editEvidenceTitleError && <p className="text-sm text-red-500 mt-1">{editEvidenceTitleError}</p>}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border">{selectedEvidence?.title || "-"}</div>
              )}
            </div>
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Auditee")}</Label>{isEditingEvidence ? <Select value={editEvidence.auditeeId} onValueChange={(value) => { const sa = auditees.find(a => a.id === value); setEditEvidence({ ...editEvidence, auditeeId: value, auditee: sa?.fullName || "" }); }}><SelectTrigger><SelectValue placeholder={t("Select auditee")}>{editEvidence.auditee && <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-sm">{editEvidence.auditee}<X className="h-3 w-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditEvidence({ ...editEvidence, auditeeId: "", auditee: "" }); }} /></span>}</SelectValue></SelectTrigger><SelectContent>{auditees.map((auditee) => (<SelectItem key={auditee.id} value={auditee.id}>{auditee.fullName} {auditee.department?.name ? `(${auditee.department.name})` : ""}</SelectItem>))}</SelectContent></Select> : <div className="p-3 bg-slate-50 rounded-md border">{selectedEvidence?.auditee || "-"}</div>}</div>
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Number of Samples")}</Label>{isEditingEvidence ? <Input type="number" min="1" value={editEvidence.numberOfSamples} onChange={(e) => setEditEvidence({ ...editEvidence, numberOfSamples: e.target.value })} placeholder={t("Enter number of samples")} /> : <div className="p-3 bg-slate-50 rounded-md border">{selectedEvidence?.numberOfSamples || "-"}</div>}</div>
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Description")}</Label>{isEditingEvidence ? <Textarea value={editEvidence.description} onChange={(e) => setEditEvidence({ ...editEvidence, description: e.target.value })} placeholder={t("Enter description")} rows={4} /> : <div className="p-3 bg-slate-50 rounded-md border min-h-[80px]">{selectedEvidence?.description || "-"}</div>}</div>
            {isEditingEvidence && selectedEvidence?.attachments && selectedEvidence.attachments.length > 0 && (
              <div className="space-y-2">{selectedEvidence.attachments.map((att) => (<div key={att.id} className="flex items-center justify-between py-2 border-b"><div className="flex items-center gap-3">{att.fileType?.includes('image') ? <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center"><FileText className="h-5 w-5 text-primary-600" /></div> : att.fileName?.endsWith('.docx') || att.fileName?.endsWith('.doc') ? <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center"><FileSpreadsheet className="h-5 w-5 text-blue-800" /></div> : <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center"><FileText className="h-5 w-5 text-slate-600" /></div>}<span className="text-sm text-primary-600">{att.fileName}</span></div><div className="flex items-center gap-2"><a href={`/api${att.filePath}`} download className="p-1 hover:bg-slate-100 rounded" title={t("Download")}><Download className="h-4 w-4 text-slate-600" /></a><a href={`/api${att.filePath}`} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-slate-100 rounded" title={t("View")}><Eye className="h-4 w-4 text-slate-600" /></a><button className="p-1 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed" title={t("Delete")} onClick={() => toast.info(t("Delete attachment functionality coming soon"))} disabled={isReadOnly}><Trash2 className="h-4 w-4 text-red-500" /></button></div></div>))}</div>
            )}
            {!isEditingEvidence && (
              <>
                <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Status")}</Label><div className="p-3 bg-slate-50 rounded-md border"><span className={`px-2 py-1 rounded text-xs font-medium ${selectedEvidence?.status === 'Reviewed' ? 'bg-emerald-100 text-emerald-800' : selectedEvidence?.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>{selectedEvidence?.status || "-"}</span></div></div>
                {selectedEvidence?.aiReviewStatus && (
                  <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("AI Review Result")}</Label><div className={`p-3 rounded-md border ${selectedEvidence.aiReviewStatus === 'Satisfactory' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}><div className="flex items-center gap-2 mb-2">{selectedEvidence.aiReviewStatus === 'Satisfactory' ? (<><div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"><span className="text-white text-xs">✓</span></div><span className="font-medium text-green-700">{t("Satisfactory")}</span></>) : (<><div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"><span className="text-white text-xs">✕</span></div><span className="font-medium text-red-700">{t("Needs Attention")}</span></>)}</div>{selectedEvidence.aiReviewComment && <p className={`text-sm ${selectedEvidence.aiReviewStatus === 'Satisfactory' ? 'text-green-600' : 'text-red-600'}`}>{selectedEvidence.aiReviewComment}</p>}</div></div>
                )}
              </>
            )}
            {!isEditingEvidence && selectedEvidence?.attachments && selectedEvidence.attachments.length > 0 && (
              <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Uploaded Attachments")}</Label><div className="p-3 bg-slate-50 rounded-md border space-y-2">{selectedEvidence.attachments.map((att) => (<div key={att.id} className="flex items-center justify-between"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary-600" /><span className="text-sm">{att.fileName}</span><span className="text-xs text-slate-400">({formatFileSize(att.fileSize)})</span></div><a href={`/api${att.filePath}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-sm flex items-center gap-1"><Download className="h-3 w-3" />{t("Download")}</a></div>))}</div></div>
            )}
            {!isEditingEvidence && (!selectedEvidence?.attachments || selectedEvidence.attachments.length === 0) && (
              <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Uploaded Attachments")}</Label><div className="p-3 bg-slate-50 rounded-md border text-slate-500 text-sm">{t("No attachments uploaded yet")}</div></div>
            )}
            {!isEditingEvidence && isAuditeeOnly && selectedEvidence?.clarificationComment && (
              <div className="flex justify-end mt-4"><Button size="sm" onClick={() => { setAuditeeClariEvidence(selectedEvidence); setAuditeeClariDialogOpen(true); }}>{t("Comments")}</Button></div>
            )}
          </div>
          <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => { setViewEditEvidenceDialogOpen(false); setSelectedEvidence(null); setIsEditingEvidence(false); setEditEvidenceTitleError(""); }}>{isEditingEvidence ? t("Cancel") : t("Close")}</Button>
            <div className="flex gap-3">
              {!isEditingEvidence && isAuditHead && selectedEvidence?.attachments && selectedEvidence.attachments.length > 0 && selectedEvidence.status !== 'Reviewed' && (
                <><Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50" onClick={() => { if (selectedEvidence) handleOpenClarificationDialog(selectedEvidence); }}>{t("Need Clarification")}</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { if (selectedEvidence) { handleApproveEvidence(selectedEvidence.id); setViewEditEvidenceDialogOpen(false); setSelectedEvidence(null); } }}>{t("Approve")}</Button></>
              )}
              {isEditingEvidence && <Button onClick={handleUpdateEvidence} disabled={savingEvidence || isReadOnly}>{savingEvidence ? t("Saving...") : t("Save")}</Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Need Clarification Dialog */}
      <Dialog open={clarificationDialogOpen} onOpenChange={setClarificationDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Need Clarification")}</DialogTitle></DialogHeader></div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Select the document that requires clarification")}</Label><Select value={clarificationDocument} onValueChange={setClarificationDocument}><SelectTrigger><SelectValue placeholder={t("Select document")} /></SelectTrigger><SelectContent>{clarificationEvidence?.attachments?.map((att) => (<SelectItem key={att.id} value={att.fileName}>{att.fileName}</SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Comment")}</Label><Textarea value={clarificationComment} onChange={(e) => setClarificationComment(e.target.value)} placeholder={t("Enter your clarification request...")} rows={5} /></div>
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Previous Comments")}</Label><div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-slate-500 text-sm text-center">{t("No items found")}</div></div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0"><Button variant="outline" onClick={() => setClarificationDialogOpen(false)}>{t("Cancel")}</Button><Button onClick={handleSendClarification} disabled={sendingClarification || !clarificationDocument || isReadOnly}>{sendingClarification ? t("Sending...") : t("Send")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Auditee Clarification View Popup */}
      <Dialog open={auditeeClariDialogOpen} onOpenChange={setAuditeeClariDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Need Clarification")}</DialogTitle></DialogHeader></div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-start justify-between"><div className="space-y-1"><p className="text-sm font-medium text-slate-700">{t("Document that requires clarification")}</p><p className="text-sm text-slate-900">{auditeeClariEvidence?.clarificationDocumentName || "-"}</p></div><Button size="sm" onClick={() => { setRespondComment(""); setRespondFiles([]); setRespondDialogOpen(true); }}>{t("Respond")}</Button></div>
            <div className="border-t border-slate-100 pt-3"><p className="text-sm text-slate-900">{auditeeClariEvidence?.clarificationComment || "-"}</p><p className="text-sm text-slate-500 mt-1">~ {auditeeClariEvidence?.clarificationByUserName || "Unknown"}</p><p className="text-xs text-slate-400 mt-1">{auditeeClariEvidence?.clarificationSentAt ? new Date(auditeeClariEvidence.clarificationSentAt).toLocaleString() : "-"}</p></div>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex justify-end gap-2 flex-shrink-0"><Button variant="outline" size="sm" onClick={() => setAuditeeClariDialogOpen(false)}>{t("Close")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Auditee Respond Dialog */}
      <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Respond")}</DialogTitle></DialogHeader></div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Comment")}</Label><Textarea value={respondComment} onChange={(e) => setRespondComment(e.target.value)} placeholder={t("Enter your response...")} rows={5} /></div>
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Attach File")}</Label><div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-slate-400 transition-colors" onClick={() => { const input = document.createElement("input"); input.type = "file"; input.multiple = true; input.onchange = (e) => { const files = (e.target as HTMLInputElement).files; if (files) setRespondFiles(Array.from(files)); }; input.click(); }} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const files = e.dataTransfer.files; if (files) setRespondFiles(Array.from(files)); }}><p className="text-slate-500">{t("Drag and drop or select file.")}</p>{respondFiles.length > 0 && <div className="mt-2 text-sm text-emerald-600">{respondFiles.map((f) => f.name).join(", ")}</div>}</div></div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0"><Button variant="outline" onClick={() => setRespondDialogOpen(false)}>{t("Cancel")}</Button><Button onClick={handleSendResponse} disabled={sendingResponse || isReadOnly}>{sendingResponse ? t("Sending...") : t("Send Response")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Delete Evidence Request Confirmation */}
      <Dialog open={deleteEvidenceDialogOpen} onOpenChange={setDeleteEvidenceDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Evidence Request")}</DialogTitle><DialogDescription className="text-slate-600">{t("Are you sure you want to delete")} &quot;{evidenceToDelete?.title}&quot;? {t("This action cannot be undone.")}</DialogDescription></DialogHeader></div>
          <div className="px-6 py-4 flex justify-end gap-3"><Button variant="outline" onClick={() => { setDeleteEvidenceDialogOpen(false); setEvidenceToDelete(null); }}>{t("Cancel")}</Button><Button variant="destructive" onClick={handleDeleteEvidence} disabled={deletingEvidence || isReadOnly}>{deletingEvidence ? t("Deleting...") : t("Delete")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* AI Review Result Dialog */}
      <Dialog open={aiReviewDialogOpen} onOpenChange={setAiReviewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("AI Review Results")}</DialogTitle><DialogDescription className="text-slate-600">{t("AI-generated review of")} {selectedEvidenceIds.length} {t("evidence request(s)")}</DialogDescription></DialogHeader></div>
          <div className="px-6 py-5 overflow-y-auto flex-1">{aiReviewResult ? <div className="prose prose-sm max-w-none"><div className="bg-slate-50 rounded-lg p-4 whitespace-pre-wrap text-sm">{aiReviewResult}</div></div> : <div className="text-center py-8 text-slate-500">{t("No review generated yet")}</div>}</div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0"><Button variant="outline" onClick={() => { setAiReviewDialogOpen(false); setAiReviewResult(""); }}>{t("Close")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Add Attachment Dialog */}
      <Dialog open={attachmentDialogOpen} onOpenChange={setAttachmentDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0"><DialogHeader><DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Attachment")}</DialogTitle><DialogDescription className="text-slate-600">{t("Upload attachment for")}: {evidenceForAttachment?.title}</DialogDescription></DialogHeader></div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2"><Label className="text-slate-700 font-medium">{t("Attach File")}</Label>
              <div className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${attachmentFileError ? "border-red-500" : isDragOver ? "border-primary-500 bg-primary-50" : "border-slate-300 hover:border-slate-400"}`} onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleFileDrop} onClick={() => attachmentFileInputRef.current?.click()}>
                <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-3">
                  <Upload className="h-6 w-6 text-primary-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">{t("Drag and drop files here, or click to browse")}</p>
                <p className="text-xs text-slate-400 mt-1">{t("Supported formats")}: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG</p>
                <input ref={attachmentFileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={handleFileSelect} />
              </div>
              {attachmentFileError && <p className="text-sm text-red-500 mt-1">{attachmentFileError}</p>}
              {uploadedFiles.length > 0 && (<div className="space-y-2 mt-2">{uploadedFiles.map((file) => (<div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-primary-500" /><div><span className="text-sm font-medium text-slate-700">{file.name}</span><span className="text-xs text-slate-400 ltr:ml-2 rtl:mr-2">({formatFileSize(file.size)})</span></div></div><Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeFile(file.id)}><X className="h-4 w-4" /></Button></div>))}</div>)}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0"><Button variant="outline" onClick={() => { setAttachmentDialogOpen(false); setEvidenceForAttachment(null); setUploadedFiles([]); setAttachmentFileError(""); }}>{t("Cancel")}</Button><Button onClick={handleUploadAttachment} disabled={uploadingAttachment || isReadOnly}>{uploadingAttachment ? t("Uploading...") : t("Upload")}</Button></div>
        </DialogContent>
      </Dialog>

      {/* Finding Detail Modal */}
      <Dialog open={findingDetailDialogOpen} onOpenChange={(open) => { if (!open) { setFindingDetailDialogOpen(false); setSelectedFindingId(null); setSelectedFindingData(null); } }}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {findingDetailMode === "edit" ? t("Edit Finding") : t("View Finding")} {selectedFindingData ? `- ${selectedFindingData.findingId}` : ""}
              </DialogTitle>
            </DialogHeader>
          </div>

          {loadingFindingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : selectedFindingData && findingDetailMode === "edit" ? (
            <>
              {/* Edit Form - Scrollable Content */}
              <div className="px-6 py-6 space-y-8 overflow-y-auto flex-1">
                {/* Basic Information Section */}
                <div className="space-y-5">
                  <div className="flex items-center gap-2 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary-600"></div>
                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">{t("Basic Information")}</h3>
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">{t("Finding Title")} <span className="text-red-500">*</span></Label>
                      <Input value={editFinding.findingTitle} onChange={(e) => { setEditFinding({ ...editFinding, findingTitle: e.target.value }); setEditFindingTitleError(""); }} placeholder={t("Enter a descriptive title for this finding")} className={`w-full bg-white focus:border-primary-500 focus:ring-primary-200 ${editFindingTitleError ? "border-red-500" : "border-slate-300"}`} />
                      {editFindingTitleError && <p className="text-sm text-red-500 mt-1">{editFindingTitleError}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">{t("Severity")}</Label>
                      <Select value={editFinding.severity} onValueChange={(value) => setEditFinding({ ...editFinding, severity: value })}>
                        <SelectTrigger className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200"><SelectValue placeholder={t("Select severity level")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>{t("Low")}</span></SelectItem>
                          <SelectItem value="Medium"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500"></span>{t("Medium")}</span></SelectItem>
                          <SelectItem value="High"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span>{t("High")}</span></SelectItem>
                          <SelectItem value="Critical"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span>{t("Critical")}</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* 4Cs Analysis Section */}
                <div className="space-y-5 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary-600"></div>
                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">{t("Finding Analysis (4Cs)")}</h3>
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-2"><span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">1</span>{t("Criteria (What should be)")}</Label>
                      <Textarea value={editFinding.criteria} onChange={(e) => setEditFinding({ ...editFinding, criteria: e.target.value })} placeholder={t("Describe the standard, policy, or expected condition")} rows={3} className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200 resize-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-2"><span className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">2</span>{t("Condition (What is)")}</Label>
                      <Textarea value={editFinding.condition} onChange={(e) => setEditFinding({ ...editFinding, condition: e.target.value })} placeholder={t("Describe the actual situation observed")} rows={3} className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200 resize-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-2"><span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">3</span>{t("Cause (Why it happened)")}</Label>
                      <Textarea value={editFinding.cause} onChange={(e) => setEditFinding({ ...editFinding, cause: e.target.value })} placeholder={t("Identify the root cause of the finding")} rows={3} className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200 resize-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-2"><span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">4</span>{t("Effect (The consequence)")}</Label>
                      <Textarea value={editFinding.effect} onChange={(e) => setEditFinding({ ...editFinding, effect: e.target.value })} placeholder={t("Describe the impact or potential consequences")} rows={3} className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200 resize-none" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">{t("Recommendation")}</Label>
                      <Textarea value={editFinding.recommendation} onChange={(e) => setEditFinding({ ...editFinding, recommendation: e.target.value })} placeholder={t("Provide recommendations to address the finding")} rows={3} className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200 resize-none" />
                    </div>
                  </div>
                </div>

                {/* CAPA Section */}
                <div className="space-y-5 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 pb-2">
                    <div className="h-1 w-1 rounded-full bg-primary-600"></div>
                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">{t("Corrective & Preventive Actions (CAPA)")}</h3>
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">{t("Responsible Person")}</Label>
                      <Select value={editFinding.responsiblePersonId} onValueChange={(value) => setEditFinding({ ...editFinding, responsiblePersonId: value })}>
                        <SelectTrigger className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200"><SelectValue placeholder={t("Select responsible person")} /></SelectTrigger>
                        <SelectContent>
                          {auditees.map((user) => (
                            <SelectItem key={user.id} value={user.id}>{user.fullName}{user.department?.name && (<span className="text-slate-500 text-xs ml-2">({user.department.name})</span>)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                      <Select value={editFinding.status} onValueChange={(value) => setEditFinding({ ...editFinding, status: value })}>
                        <SelectTrigger className="w-full bg-white border-slate-300 focus:border-primary-500 focus:ring-primary-200"><SelectValue placeholder={t("Select status")} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">{t("Open")}</SelectItem>
                          <SelectItem value="Under Review">{t("Under Review")}</SelectItem>
                          <SelectItem value="Closed">{t("Closed")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">{t("Target Closure Date")}</Label>
                      <DatePicker value={editFinding.targetClosureDate} onChange={(date) => setEditFinding({ ...editFinding, targetClosureDate: date ? formatLocalDate(date) : "" })} placeholder={t("Select target closure date")} className="w-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 rounded-b-lg flex justify-end gap-3 flex-shrink-0">
                <Button variant="outline" onClick={() => { setFindingDetailDialogOpen(false); setSelectedFindingId(null); setSelectedFindingData(null); }} className="px-5">{t("Cancel")}</Button>
                <Button onClick={handleSaveEditFinding} disabled={savingEditFinding} className="bg-primary-600 hover:bg-primary-700 px-5">
                  {savingEditFinding ? (<><Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />{t("Saving...")}</>) : (<><Check className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{t("Save Finding")}</>)}
                </Button>
              </div>
            </>
          ) : selectedFindingData ? (
            <>
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                {/* Finding Details */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Finding Title")}</Label>
                    <p className="text-sm text-slate-900 p-3 bg-slate-50 rounded-md border">{selectedFindingData.title || "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Severity")}</Label>
                    <div className="p-3 bg-slate-50 rounded-md border">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        selectedFindingData.severity === "Critical" ? "bg-red-100 text-red-800" :
                        selectedFindingData.severity === "High" ? "bg-orange-100 text-orange-800" :
                        selectedFindingData.severity === "Medium" ? "bg-yellow-100 text-yellow-800" :
                        "bg-emerald-100 text-emerald-800"
                      }`}>
                        {selectedFindingData.severity}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Criteria (What should be)")}</Label>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap p-3 bg-slate-50 rounded-md border min-h-[40px]">{selectedFindingData.criteria || "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Condition (What is)")}</Label>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap p-3 bg-slate-50 rounded-md border min-h-[40px]">{selectedFindingData.condition || "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Cause (Why it happened)")}</Label>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap p-3 bg-slate-50 rounded-md border min-h-[40px]">{selectedFindingData.cause || "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Effect (The consequence)")}</Label>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap p-3 bg-slate-50 rounded-md border min-h-[40px]">{selectedFindingData.effect || "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Recommendation")}</Label>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap p-3 bg-slate-50 rounded-md border min-h-[40px]">{selectedFindingData.recommendation || "-"}</p>
                  </div>
                </div>

                {/* CAPA Details */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Corrective & Preventive Actions (CAPA)")}</h3>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Responsible Person")}</Label>
                    <p className="text-sm text-slate-900 p-3 bg-slate-50 rounded-md border">{selectedFindingData.responsiblePerson || "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                    <div className="p-3 bg-slate-50 rounded-md border">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        selectedFindingData.status === "Closed" ? "bg-emerald-100 text-emerald-800" :
                        selectedFindingData.status === "Under Review" ? "bg-blue-100 text-blue-800" :
                        "bg-slate-100 text-slate-800"
                      }`}>
                        {selectedFindingData.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-slate-700">{t("Target Closure Date")}</Label>
                    <p className="text-sm text-slate-900 p-3 bg-slate-50 rounded-md border">{formatDate(selectedFindingData.targetDate)}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
                <Button variant="outline" onClick={() => { setFindingDetailDialogOpen(false); setSelectedFindingId(null); setSelectedFindingData(null); }}>
                  {t("Close")}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">
                {editingTask ? (isReadOnly ? t("View Task") : t("Edit Task")) : t("Add Task")}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Task Description")} *</Label>
              <Textarea
                value={taskForm.task}
                onChange={(e) => setTaskForm({ ...taskForm, task: e.target.value })}
                placeholder={t("Enter task description")}
                className="mt-1.5 min-h-[80px]"
                readOnly={isReadOnly}
              />
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="task-executed"
                checked={taskForm.executed}
                onCheckedChange={(checked) => setTaskForm({ ...taskForm, executed: checked === true })}
                disabled={isReadOnly}
              />
              <Label htmlFor="task-executed" className="text-sm font-medium text-slate-700 cursor-pointer">
                {t("Mark as Executed")}
              </Label>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Comments")}</Label>
              <Textarea
                value={taskForm.comments}
                onChange={(e) => setTaskForm({ ...taskForm, comments: e.target.value })}
                placeholder={t("Enter comments")}
                className="mt-1.5 min-h-[60px]"
                readOnly={isReadOnly}
              />
            </div>

            {editingTask && editingTask.document && (
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Attached Document")}</Label>
                <div className="mt-1.5 flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                  <a href={`/api${editingTask.document}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline truncate">
                    {editingTask.documentName || t("View Document")}
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              {isReadOnly ? t("Close") : t("Cancel")}
            </Button>
            {!isReadOnly && (
              <Button onClick={handleSaveTaskDialog} disabled={savingTaskDialog || !taskForm.task.trim()}>
                {savingTaskDialog ? <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" /> : null}
                {editingTask ? t("Save Changes") : t("Add Task")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

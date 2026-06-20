"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { formatLocalDate } from "@/lib/utils";
import { useRouter, useParams, useSearchParams } from "next/navigation";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FileText,
  Download,
  Eye,
  Upload,
  X,
  XCircle,
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
  Home,
  HelpCircle,
} from "lucide-react";
import { useHasRole, usePermissions } from "@/hooks/usePermissions";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, useTranslatedRecord, triggerTranslation } from "@/hooks/useTranslatedData";
import { isValidName, isValidNameWithNumbers } from "@/lib/validations";
import { DatePicker } from "@/components/ui/date-picker";
import { confirm } from "@/components/ui/confirm";
import Link from "next/link";

interface Department {
  id: string;
  name: string;
}

interface Auditor {
  id: string;
  fullName: string;
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

export default function FieldworkDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const engagementId = params.id as string;
  const { data: session } = useSession();
  const { t, locale } = useLanguage();
  const currentUserId = session?.user?.id;
  const isAuditHead = useHasRole("AuditHead");
  const isAuditor = useHasRole("Auditor");
  const isAuditee = useHasRole("Auditee");
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');

  // Check URL mode parameter (view = read-only, edit = editable)
  const urlMode = searchParams.get("mode");
  const isViewMode = urlMode === "view";

  // Check if user is part of the audit team (not just an auditee)
  const isAuditTeam = isAuditHead || isAuditor;
  // Check if user is ONLY an auditee (not also part of audit team)
  const isAuditeeOnly = isAuditee && !isAuditTeam;

  // AI Review status icon: irrelevant=red X, relevant=green check, others=warning/info
  const getAIReviewStatusIcon = (status: string | null | undefined) => {
    const s = (status || "").toLowerCase();
    if (s === "irrelevant") {
      return <span title={t("Irrelevant")}><XCircle className="h-4 w-4 flex-shrink-0 text-red-500" /></span>;
    }
    if (s === "relevant") {
      return <span title={t("Relevant")}><Check className="h-4 w-4 flex-shrink-0 text-emerald-500" /></span>;
    }
    if (s === "partial" || s === "needs_attention" || s === "needs attention") {
      return <span title={t("Needs Attention")}><AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500" /></span>;
    }
    if (s) {
      return <span title={status || ""}><HelpCircle className="h-4 w-4 flex-shrink-0 text-slate-500" /></span>;
    }
    return null;
  };

  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<Engagement | null>(null);

  // Check if engagement is completed (read-only mode)
  const isCompleted = engagement?.status === "Completed";

  // Page is read-only if in view mode OR engagement is completed
  const isReadOnly = isViewMode || isCompleted;

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
  const [comments, setComments] = useState<Array<{ id: string; comment: string; createdAt: string; user: { fullName: string; designation?: string } }>>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [addFindingDialogOpen, setAddFindingDialogOpen] = useState(false);
  const [addFullFindingDialogOpen, setAddFullFindingDialogOpen] = useState(false);
  const [savingFullFinding, setSavingFullFinding] = useState(false);
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
  const [documentValidationErrors, setDocumentValidationErrors] = useState<{ [key: string]: string }>({});

  // Evidence Request view/edit/delete states
  const [viewEditEvidenceDialogOpen, setViewEditEvidenceDialogOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRequest | null>(null);
  const [isEditingEvidence, setIsEditingEvidence] = useState(false);
  const [editEvidence, setEditEvidence] = useState({
    title: "",
    description: "",
    auditee: "",
    auditeeId: "",
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
  const [deleteAttachmentId, setDeleteAttachmentId] = useState<string | null>(null);
  const [deletingAttachment, setDeletingAttachment] = useState(false);

  // View Finding Dialog states
  const [viewFindingDialogOpen, setViewFindingDialogOpen] = useState(false);
  const [selectedFindingForView, setSelectedFindingForView] = useState<any>(null);
  const [loadingFindingDetails, setLoadingFindingDetails] = useState(false);

  // AI Review states
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [aiReviewQuestion, setAiReviewQuestion] = useState<string>("");
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

  // Full finding form state (for full form dialog)
  const [fullFinding, setFullFinding] = useState({
    findingTitle: "",
    severity: "",
    criteria: "",
    condition: "",
    cause: "",
    effect: "",
    recommendation: "",
    responsiblePersonId: "",
    status: "",
    targetClosureDate: "",
  });
  const [findingAttachments, setFindingAttachments] = useState<File[]>([]);
  const findingAttachmentInputRef = useRef<HTMLInputElement>(null);

  const [newEvidence, setNewEvidence] = useState({
    title: "",
    description: "",
    auditee: "",
    auditeeId: "",
    numberOfSamples: "",
  });

  // Dynamic translation hooks
  const { data: translatedEngagement } = useTranslatedRecord(engagement, { modelName: 'AuditEngagement' });
  const displayEngagement = translatedEngagement || engagement;
  const { data: translatedFindings } = useTranslatedData(findings, { modelName: 'InternalAuditFinding' });
  const { data: translatedEvidenceRequests } = useTranslatedData(evidenceRequests, { modelName: 'FieldworkEvidenceRequest' });
  const { data: translatedAuditees } = useTranslatedData(auditees, { modelName: 'User' });

  // Extract assigned auditor and department from engagement for translation
  const assignedAuditorArray = useMemo(() => {
    if (engagement?.assignedAuditor) return [engagement.assignedAuditor];
    return [];
  }, [engagement]);
  const { data: translatedAssignedAuditors } = useTranslatedData(assignedAuditorArray, { modelName: 'User' });

  const departmentArray = useMemo(() => {
    if (engagement?.department) return [engagement.department];
    return [];
  }, [engagement]);
  const { data: translatedDepartments } = useTranslatedData(departmentArray, { modelName: 'Department' });

  // Translation for single finding detail view
  const { data: translatedFindingForView } = useTranslatedRecord(selectedFindingForView, { modelName: 'InternalAuditFinding' });
  const displayFindingForView = translatedFindingForView || selectedFindingForView;

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
      }
    }
  }, [engagementId, isAuditeeOnly]);

  // Fetch auditees after engagement is loaded (to use department filter)
  useEffect(() => {
    if (engagement && !isAuditeeOnly) {
      fetchAuditees();
    }
  }, [engagement?.id, isAuditeeOnly]);

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

  const fetchFindingDetails = async (findingId: string) => {
    setLoadingFindingDetails(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings/${findingId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedFindingForView(data);
      } else {
        toast.error(t("Failed to fetch finding details"));
      }
    } catch (error) {
      console.error("Failed to fetch finding details:", error);
      toast.error(t("Failed to fetch finding details"));
    } finally {
      setLoadingFindingDetails(false);
    }
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

  const fetchAuditees = async () => {
    try {
      const deptId = engagement?.department?.id;
      const url = deptId ? `/api/users/my-auditees?departmentId=${deptId}` : "/api/users/my-auditees";
      const response = await fetch(url);
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

  const dateLocaleMap: Record<string, string> = { en: "en-GB", ar: "ar-SA", lv: "lv-LV" };
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString(dateLocaleMap[locale] || "en-GB", {
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
    ? translatedEvidenceRequests.filter(er => er.auditeeId === currentUserId)
    : translatedEvidenceRequests;

  const getAuditorName = () => {
    if (!engagement) return "-";
    if (engagement.assignedAuditor) {
      const translated = translatedAssignedAuditors.find(u => u.id === engagement.assignedAuditor?.id);
      if (translated?.fullName) return translated.fullName;
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
    // Parse JSON arrays and convert to newline-separated text for editing
    const parseField = (field: string) => {
      try {
        const parsed = JSON.parse(field);
        return Array.isArray(parsed) ? parsed.join('\n') : field;
      } catch {
        return field;
      }
    };
    setEditAIWorkpaper({
      task: wp.task,
      evidences: parseField(wp.evidences),
      steps: parseField(wp.steps),
      questionChecklist: parseField(wp.questionChecklist),
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
      // Convert newline-separated text back to JSON arrays
      const serializeField = (field: string) => {
        const lines = field.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        return JSON.stringify(lines);
      };
      const dataToSave = {
        task: editAIWorkpaper.task,
        evidences: serializeField(editAIWorkpaper.evidences),
        steps: serializeField(editAIWorkpaper.steps),
        questionChecklist: serializeField(editAIWorkpaper.questionChecklist),
        comments: editAIWorkpaper.comments,
      };
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/${selectedAIWorkpaper.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataToSave),
        }
      );

      if (response.ok) {
        setAiWorkpapers((prev) =>
          prev.map((wp) =>
            wp.id === selectedAIWorkpaper.id
              ? { ...wp, ...dataToSave }
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
    if (!isValidName(newFinding.title.trim())) {
      toast.error(t("Only letters, spaces, and hyphens are allowed"));
      return;
    }

    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newFinding, status: "Open" }),
      });

      if (response.ok) {
        const savedFinding = await response.json();
        triggerTranslation('InternalAuditFinding', savedFinding.id, {
          title: newFinding.title,
          description: newFinding.description,
          recommendation: newFinding.recommendation,
        });
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

  // Handle adding a full finding (with all fields)
  const handleAddFullFinding = async () => {
    if (!fullFinding.findingTitle.trim()) {
      toast.error(t("Finding title is required"));
      return;
    }
    if (!isValidName(fullFinding.findingTitle.trim())) {
      toast.error(t("Only letters, spaces, and hyphens are allowed"));
      return;
    }

    if (!fullFinding.responsiblePersonId || fullFinding.responsiblePersonId.trim() === "") {
      toast.error(t("Responsible person is required"));
      return;
    }

    setSavingFullFinding(true);
    try {
      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fullFinding.findingTitle,
          severity: fullFinding.severity || "Medium",
          criteria: fullFinding.criteria || null,
          condition: fullFinding.condition || null,
          cause: fullFinding.cause || null,
          effect: fullFinding.effect || null,
          recommendation: fullFinding.recommendation || null,
          responsiblePersonId: fullFinding.responsiblePersonId || null,
          status: fullFinding.status || "Open",
          targetDate: fullFinding.targetClosureDate || null,
        }),
      });

      if (response.ok) {
        const newFinding = await response.json();
        triggerTranslation('InternalAuditFinding', newFinding.id, {
          title: fullFinding.findingTitle,
          description: fullFinding.condition,
          recommendation: fullFinding.recommendation,
          criteria: fullFinding.criteria,
          condition: fullFinding.condition,
          cause: fullFinding.cause,
          effect: fullFinding.effect,
        });

        // Upload attachments if any
        if (findingAttachments.length > 0) {
          const formData = new FormData();
          findingAttachments.forEach((file) => {
            formData.append("files", file);
          });

          await fetch(`/api/internal-audit/findings/${newFinding.id}/attachments`, {
            method: "POST",
            body: formData,
          });
        }

        toast.success(t("Finding added successfully"));
        setAddFullFindingDialogOpen(false);
        setFullFinding({
          findingTitle: "",
          severity: "",
          criteria: "",
          condition: "",
          cause: "",
          effect: "",
          recommendation: "",
          responsiblePersonId: "",
          status: "",
          targetClosureDate: "",
        });
        setFindingAttachments([]);
        fetchFindings();
      } else {
        const error = await response.json();
        toast.error(error.error || t("Failed to add finding"));
      }
    } catch (error) {
      console.error("Error adding finding:", error);
      toast.error(t("Failed to add finding"));
    } finally {
      setSavingFullFinding(false);
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
    const errors: { [key: string]: string } = {};

    if (!newDocument.title.trim()) {
      errors.newDocumentTitle = t("Document title is required") || "Document title is required";
    }
    if (uploadedFiles.length === 0) {
      errors.uploadedFiles = t("Please select a file to upload") || "Please select a file to upload";
    }

    setDocumentValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
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
    setDocumentValidationErrors({});
    setViewEditDocumentDialogOpen(true);
  };

  const handleUpdateDocument = async () => {
    if (!selectedDocument) return;

    const errors: { [key: string]: string } = {};
    if (!editDocument.title.trim()) {
      errors.editDocumentTitle = t("Document title is required") || "Document title is required";
    }

    setDocumentValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
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
            status: editEvidence.status,
            numberOfSamples: editEvidence.numberOfSamples || null,
          }),
        }
      );

      if (response.ok) {
        if (selectedEvidence) {
          triggerTranslation('FieldworkEvidenceRequest', selectedEvidence.id, { title: editEvidence.title, description: editEvidence.description });
        }
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

  // Auditee Send Response handler - submits all pending evidence requests
  const handleSendResponse = async () => {
    const pendingRequests = filteredEvidenceRequests.filter((er) => er.status === 'Pending');
    if (pendingRequests.length === 0) return;

    setSendingResponse(true);
    try {
      // Upload files to all pending requests if provided
      if (respondFiles.length > 0) {
        const formData = new FormData();
        respondFiles.forEach((file) => {
          formData.append("files", file);
        });

        await Promise.all(
          pendingRequests.map((er) =>
            fetch(
              `/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${er.id}/attachments`,
              {
                method: "POST",
                body: formData,
              }
            )
          )
        );
      }

      // Update status to Submitted for all pending requests
      await Promise.all(
        pendingRequests.map((er) =>
          fetch(
            `/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${er.id}`,
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
          )
        )
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

    // Check if any selected evidence request is missing attachments
    const missingAttachments = evidenceRequests
      .filter((er) => selectedEvidenceIds.includes(er.id))
      .filter((er) => !er.attachments || er.attachments.length === 0);

    if (missingAttachments.length > 0) {
      const titles = missingAttachments.map((er) => `"${er.title}"`).join(", ");
      toast.error(t("Attachment not present. Please add attachments for") + ": " + titles);
      return;
    }

    setGeneratingAIReview(true);
    try {
      const response = await fetch(
        `/api/internal-audit/fieldwork/${engagementId}/ai-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evidenceRequestIds: selectedEvidenceIds, target_language: locale }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAiReviewResult(data.review || data.answer || data.result || "AI Review completed successfully.");
        setAiReviewDialogOpen(true);
        await fetchEvidenceRequests();
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
    if (field === "task" && typeof value === "string" && value && !isValidNameWithNumbers(value)) {
      toast.error(t("Special characters are not allowed"));
      return;
    }
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
    if (!(await confirm({ title: t("Delete Task?"), description: t("This action cannot be undone.") }))) return;
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
    if (task.task && !isValidNameWithNumbers(task.task)) {
      toast.error(t("Special characters are not allowed"));
      return;
    }
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

    if (evidenceRequests.some((er) => er.title.trim().toLowerCase() === newEvidence.title.trim().toLowerCase())) {
      toast.error(t("Evidence request with this title already exists"));
      return;
    }

    if (!newEvidence.auditeeId || !newEvidence.auditeeId.trim()) {
      toast.error(t("Auditee is required"));
      return;
    }

    try {
      const payload = {
        title: newEvidence.title,
        description: newEvidence.description,
        auditee: newEvidence.auditee,
        auditeeId: newEvidence.auditeeId || null,
        numberOfSamples: newEvidence.numberOfSamples || null,
        status: "Pending",
      };

      const response = await fetch(`/api/internal-audit/fieldwork/${engagementId}/evidence-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const savedEvidence = await response.json();
        triggerTranslation('FieldworkEvidenceRequest', savedEvidence.id, { title: newEvidence.title, description: newEvidence.description });
        toast.success(t("Evidence request added successfully"));
        setAddEvidenceDialogOpen(false);
        setNewEvidence({ title: "", description: "", auditee: "", auditeeId: "", numberOfSamples: "" });
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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
          <CollapsibleTrigger className="flex-1 flex items-center justify-between rounded -mx-2 -my-1 px-2 py-1">
            <span className="text-slate-800 font-semibold text-sm">{title}</span>
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </div>
          </CollapsibleTrigger>
          {headerAction && (
            <div className="ltr:ml-2 rtl:mr-2 z-10">
              {headerAction}
            </div>
          )}
        </div>
        <CollapsibleContent>
          <div className="p-4">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </div>
          {canViewDashboard && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
              <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
                {t("Dashboard")}
              </Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/internal-audit/fieldwork" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Fieldwork")}
          </Link>
        </nav>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </div>
          {canViewDashboard && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
              <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
                {t("Dashboard")}
              </Link>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/internal-audit/fieldwork" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Fieldwork")}
          </Link>
        </nav>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Fieldwork")}</h1>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          {t("Engagement not found")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        {canViewDashboard && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/internal-audit/fieldwork" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Fieldwork")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{engagement.auditId}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{displayEngagement?.engagementTitle || engagement.engagementTitle}</h1>
          <p className="text-sm text-slate-500">{engagement.auditId}</p>
        </div>
        {isCompleted && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-700">
            <Check className="h-4 w-4" />
            <span>{t("Completed")}</span>
          </div>
        )}
      </div>

      {/* Engagement Details Section */}
      <CollapsibleSection
        title={`${t("Engagement Details")} : ${engagement.auditId} - ${displayEngagement?.engagementTitle || engagement.engagementTitle}`}
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
                className="bg-primary-600 hover:bg-primary-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkAsCompleted();
                }}
                disabled={markingComplete || isReadOnly}
              >
                {markingComplete ? (
                  <>
                    <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 p-3 sm:p-4 bg-white rounded-lg border">
          <div>
            <Label className="text-slate-700 font-medium">{t("Engagement ID")}</Label>
            <p className="mt-1">{engagement.auditId}</p>
          </div>
          <div>
            <Label className="text-slate-700 font-medium">{t("Title")}</Label>
            <p className="mt-1">{displayEngagement?.engagementTitle || engagement.engagementTitle}</p>
          </div>
          <div>
            <Label className="text-slate-700 font-medium">{t("Auditor")}</Label>
            <p className="mt-1">{getAuditorName()}</p>
          </div>
          <div>
            <Label className="text-slate-700 font-medium">{t("Timeline")}</Label>
            <p className="mt-1">
              {formatDate(engagement.startDate)} {t("to")} {formatDate(engagement.endDate)}
            </p>
          </div>
          <div>
            <Label className="text-slate-700 font-medium">{t("Status")}</Label>
            <p className="mt-1">{engagement.status}</p>
          </div>
          <div>
            <Label className="text-slate-700 font-medium">{t("Department")}</Label>
            <p className="mt-1">{translatedDepartments[0]?.name || engagement.department?.name || "-"}</p>
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
          {isAuditTeam && (
            <div className="flex ltr:justify-end rtl:justify-start">
              <Button
                size="sm"
                onClick={() => {
                  setUploadCategory("workpapers");
                  setUploadDialogOpen(true);
                }}
                disabled={isReadOnly}
              >
                <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
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
                    className="text-slate-700 hover:underline font-medium flex-grow"
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
                      <Eye className="h-5 w-5 text-slate-600" />
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
                      <Download className="h-5 w-5 text-slate-600" />
                    </Button>
                    {isAuditTeam && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t("Delete")}
                        onClick={() => {
                          setWorkpaperToDelete(wp);
                          setDeleteWorkpaperDialogOpen(true);
                        }}
                        disabled={isReadOnly}
                      >
                        <Trash2 className="h-5 w-5 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">{t("No workpapers uploaded yet")}</div>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {t("Audit Program Overview")}: {aiWorkpapers.length}{" "}
              {aiWorkpapers.length === 1 ? t("procedure") : t("procedures")}
            </p>
            <div className="flex items-center gap-2">
              {aiWorkpapers.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      `/api/internal-audit/fieldwork/${engagementId}/ai-workpapers/download`,
                      "_blank"
                    )
                  }
                >
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Download Audit Program")}
                </Button>
              )}
              {isAuditTeam && (
                <Button
                  size="sm"
                  onClick={handleGenerateAIWorkpapers}
                  disabled={generatingWorkpapers || isReadOnly}
                >
                  {generatingWorkpapers ? (
                    <>
                      <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                      {t("Generating...")}
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                      {t("Generate Workpaper with AI")}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          {aiWorkpapers.length > 0 ? (
            <div className="bg-white border rounded-lg overflow-x-auto">
              <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="bg-slate-50 border-b">
                  <TableHead className="text-slate-700 font-semibold w-[200px]">{t("Task")}</TableHead>
                  <TableHead className="text-slate-700 font-semibold w-[180px]">{t("Evidences")}</TableHead>
                  <TableHead className="text-slate-700 font-semibold w-[250px]">{t("Steps")}</TableHead>
                  <TableHead className="text-slate-700 font-semibold w-[120px]">{t("Question Checklist")}</TableHead>
                  <TableHead className="text-slate-700 font-semibold w-[100px]">{t("Comments")}</TableHead>
                  {isAuditTeam && (
                    <TableHead className="text-slate-700 font-semibold w-[100px]">{t("Action")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiWorkpapers.map((wp) => (
                  <TableRow key={wp.id} className="border-b hover:bg-slate-50">
                    <TableCell className="align-top py-4">
                      <div className="space-y-3">
                        <p className="text-slate-800">{wp.task}</p>
                        <div>
                          <span className="text-slate-700 font-medium block mb-1">{t("Executed")}</span>
                          <Checkbox
                            checked={wp.executed}
                            onCheckedChange={() => handleToggleExecuted(wp.id, wp.executed)}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-4">
                      <div className="text-sm text-slate-700 space-y-1">
                        {(() => {
                          try {
                            const items = JSON.parse(wp.evidences);
                            return Array.isArray(items) && items.length > 0
                              ? items.map((item, i) => <div key={i}>• {item}</div>)
                              : wp.evidences || "-";
                          } catch {
                            return wp.evidences || "-";
                          }
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-4">
                      <div className="text-sm text-slate-700 space-y-1">
                        {(() => {
                          try {
                            const items = JSON.parse(wp.steps);
                            return Array.isArray(items) && items.length > 0
                              ? items.map((item, i) => <div key={i}>• {item}</div>)
                              : wp.steps || "-";
                          } catch {
                            return wp.steps || "-";
                          }
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-4">
                      <div className="text-sm text-slate-700 space-y-1">
                        {(() => {
                          try {
                            const items = JSON.parse(wp.questionChecklist);
                            return Array.isArray(items) && items.length > 0
                              ? items.map((item, i) => <div key={i}>• {item}</div>)
                              : wp.questionChecklist || "-";
                          } catch {
                            return wp.questionChecklist || "-";
                          }
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="align-top py-4 text-center">
                      {wp.comments || "-"}
                    </TableCell>
                    {isAuditTeam && (
                      <TableCell className="align-top py-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("Edit")}
                            onClick={() => handleOpenEditAIWorkpaper(wp)}
                            disabled={isReadOnly}
                          >
                            <Pencil className="h-4 w-4 text-primary-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t("Delete")}
                            onClick={() => {
                              setSelectedAIWorkpaper(wp);
                              setDeleteAIWorkpaperDialogOpen(true);
                            }}
                            disabled={isReadOnly}
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
            <div className="text-center py-8 text-slate-500">{t("No AI-generated workpapers available")}</div>
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
          <div className="flex ltr:justify-end rtl:justify-start">
            <Button
              size="sm"
              onClick={handleAddTask}
              disabled={addingTask || isReadOnly}
            >
              {addingTask ? (
                <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              )}
              {t("Add Task")}
            </Button>
          </div>
          <div className="bg-white border rounded-lg overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-b border-slate-100 bg-slate-50/50">
                  <TableHead className="text-xs font-semibold text-slate-600 w-[80px]">{t("Ref No")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">{t("Task")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 w-[200px]">{t("Document")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 w-[100px] text-center">{t("Executed")}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">{t("Comments")}</TableHead>
                  {isAuditTeam && <TableHead className="text-xs font-semibold text-slate-600 w-[100px]">{t("Action")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskList.length > 0 ? (
                  taskList.map((task) => (
                    <TableRow key={task.id} className="hover:bg-slate-50">
                      <TableCell>
                        <Input
                          value={task.refNo}
                          readOnly
                          className="w-16 bg-slate-50 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={task.task}
                          onChange={(e) => handleUpdateTask(task.id, "task", e.target.value)}
                          onBlur={(e) => handleUpdateTask(task.id, "task", e.target.value)}
                          placeholder={t("Enter task description")}
                          className="border-slate-300"
                        />
                      </TableCell>
                      <TableCell>
                        {task.document ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={`/api${task.document}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:underline text-sm truncate max-w-[120px]"
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
                            disabled={uploadingTaskDocument === task.id || isReadOnly}
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
                          className="border-slate-300"
                        />
                      </TableCell>
                      {isAuditTeam && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSaveTask(task)}
                              disabled={savingTask === task.id || isReadOnly}
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
                              disabled={isReadOnly}
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
                    <TableCell colSpan={isAuditTeam ? 6 : 5} className="text-center py-8 text-slate-500">
                      {t("No tasks found. Click \"Add Task\" to create one.")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
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
                {isAuditTeam && selectedEvidenceIds.length > 0 && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleAIReview}
                    disabled={generatingAIReview || isReadOnly}
                  >
                    {generatingAIReview ? (
                      <>
                        <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                        {t("Generating...")}
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                        {t("AI Review")} ({selectedEvidenceIds.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
              {isAuditTeam && (
                <Button
                  size="sm"
                  onClick={() => setAddEvidenceDialogOpen(true)}
                  disabled={isReadOnly}
                >
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
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
                  <div key={er.id} className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <div className="pt-1">
                        <Checkbox
                          checked={selectedEvidenceIds.includes(er.id)}
                          onCheckedChange={(checked) => handleSelectEvidence(er.id, checked === true)}
                          className="border-primary-600 data-[state=checked]:bg-primary-600 data-[state=checked]:text-white"
                        />
                      </div>

                      {/* Left side - Title & Description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-slate-700 font-semibold">
                            {t("Title")} : {er.title}
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-700 font-semibold">
                            {t("Sample Size")} : {er.numberOfSamples || "-"}
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm">
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
                          <MessageSquare className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700">{t("AI Review")}</span>
                        </div>
                        {(er.aiReviewStatus || er.aiReviewComment) ? (
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 mt-0.5">
                              {getAIReviewStatusIcon(er.aiReviewStatus)}
                            </div>
                            <div className="min-w-0 flex-1">
                              {er.aiReviewStatus && (
                                <span className="text-xs font-medium text-slate-600 block mb-0.5 capitalize">
                                  {er.aiReviewStatus}
                                </span>
                              )}
                              {er.aiReviewComment && (
                                <p className="text-xs text-slate-600 line-clamp-3">{er.aiReviewComment}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 mb-1">
                              <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
                                <span className="text-white text-xs">⏳</span>
                              </div>
                              <span className="text-sm text-yellow-600 font-medium">
                                {er.status === 'Submitted' ? t('Awaiting Review') : t('Pending')}
                              </span>
                            </div>
                            <p className="text-xs text-amber-600 line-clamp-2">
                              {er.status === 'Pending'
                                ? t('Waiting for document upload and review.')
                                : er.status === 'Submitted'
                                ? t('Document submitted. Awaiting AI review.')
                                : t('Awaiting review.')}
                            </p>
                          </>
                        )}
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
                          <Eye className="h-5 w-5 text-slate-700" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t("Add Attachment")}
                          onClick={() => handleOpenAttachmentDialog(er)}
                          className="h-8 w-8"
                        >
                          <Paperclip className="h-5 w-5 text-slate-700" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Single Submit Response Button for all pending requests */}
                {filteredEvidenceRequests.some((er) => er.status === 'Pending') && (
                  <div className="flex ltr:justify-end rtl:justify-start mt-4">
                    <Button
                      className="bg-primary-600 hover:bg-primary-700 text-white"
                      onClick={() => {
                        setRespondDialogOpen(true);
                      }}
                    >
                      {t("Submit Response")}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">{t("No evidence requests found")}</div>
            )
          ) : (
            /* Table-based UI for Audit Team */
            filteredEvidenceRequests.length > 0 ? (
              <div className="bg-white border rounded-lg overflow-hidden">
                <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 bg-slate-50/50">
                    {isAuditTeam && (
                      <TableHead className="text-xs font-semibold text-slate-600 w-[50px]">
                        <Checkbox
                          checked={selectedEvidenceIds.length === filteredEvidenceRequests.length && filteredEvidenceRequests.length > 0}
                          onCheckedChange={(checked) => handleSelectAllEvidence(checked === true)}
                          className="border-white data-[state=checked]:bg-white data-[state=checked]:text-slate-700"
                        />
                      </TableHead>
                    )}
                    <TableHead className="text-xs font-semibold text-slate-600">{t("Title")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">{t("Description")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">{t("Auditee")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">{t("Samples")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">{t("AI Review")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">{t("Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvidenceRequests.map((er) => (
                    <TableRow key={er.id} className="hover:bg-slate-50">
                      {isAuditTeam && (
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
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          er.status === 'Reviewed' ? 'bg-emerald-100 text-emerald-800' :
                          er.status === 'Submitted' ? 'bg-primary-50 text-primary-700' :
                          er.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {er.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(er.aiReviewStatus || er.aiReviewComment) ? (
                          <div className="flex items-start gap-2 max-w-[280px]">
                            <div className="flex-shrink-0 mt-0.5">
                              {getAIReviewStatusIcon(er.aiReviewStatus)}
                            </div>
                            <div className="min-w-0 flex-1">
                              {er.aiReviewStatus && (
                                <span className="text-xs font-medium text-slate-600 block mb-0.5 capitalize">
                                  {er.aiReviewStatus}
                                </span>
                              )}
                              {er.aiReviewComment && (
                                <p className="text-xs text-slate-600 line-clamp-3">{er.aiReviewComment}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
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
                            <Eye className="h-4 w-4 text-slate-600" />
                          </Button>
                          {/* Auditees can upload attachments to their own evidence requests */}
                          {(isAuditTeam || (isAuditee && er.auditeeId === currentUserId)) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t("Add Attachment")}
                              onClick={() => handleOpenAttachmentDialog(er)}
                            >
                              <Upload className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {/* Audit team (AuditHead + Auditor) can edit and delete */}
                          {isAuditTeam && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t("Edit")}
                                onClick={() => handleOpenViewEvidence(er, true)}
                                disabled={isReadOnly}
                              >
                                <Pencil className="h-4 w-4 text-primary-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t("Delete")}
                                onClick={() => {
                                  setEvidenceToDelete(er);
                                  setDeleteEvidenceDialogOpen(true);
                                }}
                                disabled={isReadOnly}
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
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">{t("No evidence requests found")}</div>
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
          <div className="flex ltr:justify-end rtl:justify-start">
            <Button
              size="sm"
              onClick={() => {
                setUploadedFiles([]);
                setNewDocument({ title: "", documentType: "", description: "" });
                setDocumentValidationErrors({});
                setNewDocumentDialogOpen(true);
              }}
              disabled={isReadOnly}
            >
              <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Upload Document")}
            </Button>
          </div>
          {otherDocuments.length > 0 ? (
            <div className="bg-white border rounded-lg overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="border-b border-slate-100 bg-slate-50/50">
                    <TableHead className="text-xs font-semibold text-slate-600">{t("Title")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">{t("Document Type")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">{t("Description")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">{t("File")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">{t("Uploaded")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600">{t("Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherDocuments.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{doc.title || doc.fileName}</TableCell>
                      <TableCell>{doc.documentType || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{doc.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary-600" />
                          <span className="text-sm">{doc.fileName}</span>
                          <span className="text-xs text-slate-400">({formatFileSize(doc.fileSize)})</span>
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
                            <Eye className="h-4 w-4 text-slate-600" />
                          </Button>
                          {isAuditTeam && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t("Edit")}
                                onClick={() => handleOpenViewDocument(doc, true)}
                                disabled={isReadOnly}
                              >
                                <Pencil className="h-4 w-4 text-primary-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t("Delete")}
                                onClick={() => {
                                  setDocumentToDelete(doc);
                                  setDeleteDocumentDialogOpen(true);
                                }}
                                disabled={isReadOnly}
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
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">{t("No other documents uploaded yet")}</div>
          )}
        </div>
      </CollapsibleSection>
      )}


      {/* Comments Dialog */}
      <Dialog open={commentsDialogOpen} onOpenChange={(open) => {
        setCommentsDialogOpen(open);
        if (open) {
          fetchComments();
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Engagement Comments")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            {/* Add Comment Textarea */}
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

            {/* Comments List */}
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
              <div className="text-center py-8 text-slate-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <div className="text-sm">{t("No comments yet")}</div>
              </div>
            )}
          </div>
          {/* Fixed Footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setCommentsDialogOpen(false)}>
              {t("Close")}
            </Button>
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!newComment.trim() || submittingComment}
            >
              {submittingComment ? t("Adding...") : t("Add Comment")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Upload")} {uploadCategory === "workpapers" ? t("Workpaper") : t("Document")}
              </DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragOver ? "border-primary-500 bg-primary-50" : "border-slate-300 hover:border-slate-400"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-600">{t("Drag and drop files here, or click to browse")}</p>
              <p className="text-sm text-slate-400 mt-1">
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
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary-500" />
                      <div>
                        <span className="text-sm font-medium">{file.name}</span>
                        <span className="text-xs text-slate-400 ml-2">
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
          {/* Fixed Footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setUploadDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleUploadFiles}
              disabled={uploading || uploadedFiles.length === 0 || isReadOnly}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Uploading...")}
                </>
              ) : (
                t("Upload")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Finding Dialog */}
      <Dialog open={addFindingDialogOpen} onOpenChange={setAddFindingDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Finding")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Title")} <span className="text-red-500">*</span></Label>
              <Input
                value={newFinding.title}
                onChange={(e) => setNewFinding({ ...newFinding, title: e.target.value })}
                placeholder={t("Enter finding title")}
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Description")}</Label>
              <Textarea
                value={newFinding.description}
                onChange={(e) => setNewFinding({ ...newFinding, description: e.target.value })}
                placeholder={t("Enter description")}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Severity")}</Label>
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
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Recommendation")}</Label>
              <Textarea
                value={newFinding.recommendation}
                onChange={(e) => setNewFinding({ ...newFinding, recommendation: e.target.value })}
                placeholder={t("Enter recommendation")}
                rows={3}
              />
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setAddFindingDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button size="sm" onClick={handleAddFinding} disabled={isReadOnly}>
              {t("Add Finding")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Full Finding Dialog */}
      <Dialog open={addFullFindingDialogOpen} onOpenChange={setAddFullFindingDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Finding")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            {/* Finding Title */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Finding Title")} <span className="text-red-500">*</span></Label>
              <Input
                value={fullFinding.findingTitle}
                onChange={(e) => setFullFinding({ ...fullFinding, findingTitle: e.target.value })}
                placeholder={t("Enter finding title")}
                className="bg-white"
              />
            </div>

            {/* Severity */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Severity")}</Label>
              <Select
                value={fullFinding.severity}
                onValueChange={(value) => setFullFinding({ ...fullFinding, severity: value })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={t("Select severity")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">{t("Low")}</SelectItem>
                  <SelectItem value="Medium">{t("Medium")}</SelectItem>
                  <SelectItem value="High">{t("High")}</SelectItem>
                  <SelectItem value="Critical">{t("Critical")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Criteria */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Criteria (What should be)")}</Label>
              <Textarea
                value={fullFinding.criteria}
                onChange={(e) => setFullFinding({ ...fullFinding, criteria: e.target.value })}
                placeholder={t("Enter criteria")}
                rows={3}
                className="bg-white"
              />
            </div>

            {/* Condition */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Condition (What is)")}</Label>
              <Textarea
                value={fullFinding.condition}
                onChange={(e) => setFullFinding({ ...fullFinding, condition: e.target.value })}
                placeholder={t("Enter condition")}
                rows={3}
                className="bg-white"
              />
            </div>

            {/* Cause */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Cause (Why it happened)")}</Label>
              <Textarea
                value={fullFinding.cause}
                onChange={(e) => setFullFinding({ ...fullFinding, cause: e.target.value })}
                placeholder={t("Enter cause")}
                rows={3}
                className="bg-white"
              />
            </div>

            {/* Effect */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Effect (The consequence)")}</Label>
              <Textarea
                value={fullFinding.effect}
                onChange={(e) => setFullFinding({ ...fullFinding, effect: e.target.value })}
                placeholder={t("Enter effect")}
                rows={3}
                className="bg-white"
              />
            </div>

            {/* Recommendation */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Recommendation")}</Label>
              <Textarea
                value={fullFinding.recommendation}
                onChange={(e) => setFullFinding({ ...fullFinding, recommendation: e.target.value })}
                placeholder={t("Enter recommendation")}
                rows={3}
                className="bg-white"
              />
            </div>

            {/* Upload Attachment */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Upload Attachment")}</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => findingAttachmentInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Choose Files")}
                  </Button>
                  <input
                    type="file"
                    ref={findingAttachmentInputRef}
                    onChange={(e) => {
                      if (e.target.files) {
                        setFindingAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                        e.target.value = "";
                      }
                    }}
                    className="hidden"
                    multiple
                  />
                </div>
                {findingAttachments.length > 0 && (
                  <div className="space-y-1">
                    {findingAttachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-sm">
                        <span className="truncate flex-1">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setFindingAttachments(prev => prev.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* CAPA Section Header */}
            <div className="pt-2 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">{t("Corrective & Preventive Actions (CAPA)")}</h3>
            </div>

            {/* Responsible Person */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Responsible Person")} <span className="text-red-500">*</span></Label>
              <Select
                value={fullFinding.responsiblePersonId}
                onValueChange={(value) => setFullFinding({ ...fullFinding, responsiblePersonId: value })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={t("Select person")} />
                </SelectTrigger>
                <SelectContent>
                  {translatedAuditees.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Status")}</Label>
              <Select
                value={fullFinding.status}
                onValueChange={(value) => setFullFinding({ ...fullFinding, status: value })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={t("Select status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">{t("Open")}</SelectItem>
                  <SelectItem value="Under Review">{t("Under Review")}</SelectItem>
                  <SelectItem value="Closed">{t("Closed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target Closure Date */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Target Closure Date")}</Label>
              <DatePicker
                value={fullFinding.targetClosureDate}
                onChange={(date) => setFullFinding({ ...fullFinding, targetClosureDate: date ? formatLocalDate(date) : "" })}
                placeholder={t("Select date")}
              />
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setAddFullFindingDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button size="sm" onClick={handleAddFullFinding} disabled={savingFullFinding || isReadOnly}>
              {savingFullFinding ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Saving...")}
                </>
              ) : (
                t("Save")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Evidence Request Dialog */}
      <Dialog open={addEvidenceDialogOpen} onOpenChange={setAddEvidenceDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Evidence Request")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Title")} <span className="text-red-500">*</span></Label>
              <Input
                value={newEvidence.title}
                onChange={(e) => setNewEvidence({ ...newEvidence, title: e.target.value })}
                placeholder={t("Enter evidence request title")}
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Description")}</Label>
              <Textarea
                value={newEvidence.description}
                onChange={(e) => setNewEvidence({ ...newEvidence, description: e.target.value })}
                placeholder={t("Enter description")}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Auditee")} <span className="text-red-500">*</span></Label>
              <Select
                value={newEvidence.auditeeId}
                onValueChange={(value) => {
                  const selectedAuditee = translatedAuditees.find(a => a.id === value);
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
                  {translatedAuditees.map((auditee) => (
                    <SelectItem key={auditee.id} value={auditee.id}>
                      {auditee.fullName} {auditee.department?.name ? `(${auditee.department.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Number of Samples")}</Label>
              <Input
                type="number"
                min="1"
                value={newEvidence.numberOfSamples}
                onChange={(e) => setNewEvidence({ ...newEvidence, numberOfSamples: e.target.value })}
                placeholder={t("Enter number of samples required")}
              />
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setAddEvidenceDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button size="sm" onClick={handleAddEvidence} disabled={isReadOnly}>
              {t("Add Evidence Request")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Finding Confirmation Dialog */}
      <Dialog open={deleteFindingDialogOpen} onOpenChange={setDeleteFindingDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Finding")}</DialogTitle>
              <DialogDescription className="text-slate-600">
                {t("Are you sure you want to delete the finding")} &quot;{findingToDelete?.title}&quot;? {t("This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 flex ltr:justify-end rtl:justify-start gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteFindingDialogOpen(false);
                setFindingToDelete(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteFinding}
              disabled={deletingFinding || isReadOnly}
            >
              {deletingFinding ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Document Upload Dialog */}
      <Dialog open={newDocumentDialogOpen} onOpenChange={setNewDocumentDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Document")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Title")}</Label>
              <div className="space-y-1">
                <Input
                  value={newDocument.title}
                  onChange={(e) => setNewDocument({ ...newDocument, title: e.target.value })}
                  placeholder={t("Enter document title")}
                  className={documentValidationErrors.newDocumentTitle ? 'border-red-500' : ''}
                />
                {documentValidationErrors.newDocumentTitle && (
                  <p className="text-sm text-red-600">{documentValidationErrors.newDocumentTitle}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Document Type")}</Label>
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
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Description")}</Label>
              <Textarea
                value={newDocument.description}
                onChange={(e) => setNewDocument({ ...newDocument, description: e.target.value })}
                placeholder={t("Enter description")}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Attach File")}</Label>
              <div>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragOver ? "border-primary-500 bg-primary-50" : "border-slate-300 hover:border-slate-400"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <p className="text-slate-600">{t("Click here, or drop files here to upload.")}</p>
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
                        className="flex items-center justify-between p-2 bg-slate-50 rounded border"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary-500" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-slate-400">({formatFileSize(file.size)})</span>
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
          </div>
          {/* Fixed Footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewDocumentDialogOpen(false);
                setUploadedFiles([]);
                setNewDocument({ title: "", documentType: "", description: "" });
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleUploadDocument}
              disabled={uploading || isReadOnly}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Saving...")}
                </>
              ) : (
                t("Save")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation Dialog */}
      <Dialog open={deleteDocumentDialogOpen} onOpenChange={setDeleteDocumentDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Document")}</DialogTitle>
              <DialogDescription className="text-slate-600">
                {t("Are you sure you want to delete")} &quot;{documentToDelete?.title || documentToDelete?.fileName}&quot;? {t("This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 flex ltr:justify-end rtl:justify-start gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteDocumentDialogOpen(false);
                setDocumentToDelete(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteDocument}
              disabled={deletingDocument || isReadOnly}
            >
              {deletingDocument ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Workpaper Confirmation Dialog */}
      <Dialog open={deleteWorkpaperDialogOpen} onOpenChange={setDeleteWorkpaperDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Workpaper")}</DialogTitle>
              <DialogDescription className="text-slate-600">
                {t("Are you sure you want to delete")} &quot;{workpaperToDelete?.fileName}&quot;? {t("This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 flex ltr:justify-end rtl:justify-start gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteWorkpaperDialogOpen(false);
                setWorkpaperToDelete(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteWorkpaper}
              disabled={deletingWorkpaper || isReadOnly}
            >
              {deletingWorkpaper ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit AI Workpaper Dialog */}
      <Dialog open={editAIWorkpaperDialogOpen} onOpenChange={setEditAIWorkpaperDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit AI Workpaper")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Task")} <span className="text-red-500">*</span></Label>
              <Input
                value={editAIWorkpaper.task}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, task: e.target.value })}
                placeholder={t("Enter task description")}
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Evidences")}</Label>
              <Textarea
                value={editAIWorkpaper.evidences}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, evidences: e.target.value })}
                placeholder={t("Enter evidences (one per line)")}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Steps")}</Label>
              <Textarea
                value={editAIWorkpaper.steps}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, steps: e.target.value })}
                placeholder={t("Enter steps (one per line)")}
                rows={4}
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <Label className="text-end text-slate-500">{t("Question Checklist")}</Label>
              <Input
                value={editAIWorkpaper.questionChecklist}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, questionChecklist: e.target.value })}
                placeholder={t("Enter question checklist")}
              />
            </div>
            <div className="grid grid-cols-[140px_1fr] items-start gap-4">
              <Label className="text-end text-slate-500 pt-2">{t("Comments")}</Label>
              <Textarea
                value={editAIWorkpaper.comments}
                onChange={(e) => setEditAIWorkpaper({ ...editAIWorkpaper, comments: e.target.value })}
                placeholder={t("Enter comments")}
                rows={2}
              />
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditAIWorkpaperDialogOpen(false);
                setSelectedAIWorkpaper(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleUpdateAIWorkpaper}
              disabled={savingAIWorkpaper || isReadOnly}
            >
              {savingAIWorkpaper ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Saving...")}
                </>
              ) : (
                t("Save Changes")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete AI Workpaper Confirmation Dialog */}
      <Dialog open={deleteAIWorkpaperDialogOpen} onOpenChange={setDeleteAIWorkpaperDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete AI Workpaper")}</DialogTitle>
              <DialogDescription className="text-slate-600">
                {t("Are you sure you want to delete this AI workpaper?")} {t("This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 flex ltr:justify-end rtl:justify-start gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteAIWorkpaperDialogOpen(false);
                setSelectedAIWorkpaper(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAIWorkpaper}
              disabled={deletingAIWorkpaper || isReadOnly}
            >
              {deletingAIWorkpaper ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generated Workpaper with AI Dialog */}
      <Dialog open={generateAIDialogOpen} onOpenChange={setGenerateAIDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[800px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Generated Workpaper with AI")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 overflow-y-auto flex-1">
            {generatingWorkpapers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
                <span className="ltr:ml-3 rtl:mr-3 text-slate-600">{t("Generating workpapers...")}</span>
              </div>
            ) : generatedWorkpapers.length > 0 ? (
              <div className="space-y-4 sm:space-y-6">
                {generatedWorkpapers.map((wp) => (
                  <div
                    key={wp.id}
                    className={`border rounded-lg p-4 ${
                      selectedGeneratedIds.includes(wp.id)
                        ? "border-primary-600 bg-primary-50"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedGeneratedIds.includes(wp.id)}
                        onCheckedChange={() => handleToggleGeneratedSelection(wp.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-4">
                        <h4 className="font-semibold text-slate-900">{wp.task}</h4>

                        <div>
                          <h5 className="font-medium text-slate-700 mb-2">{t("Steps")}</h5>
                          <div className="text-sm text-slate-600 ltr:pl-4 rtl:pr-4 space-y-1">
                            {(() => {
                              try {
                                const items = JSON.parse(wp.steps);
                                return Array.isArray(items) && items.length > 0
                                  ? items.map((item, i) => <div key={i}>• {item}</div>)
                                  : wp.steps || "-";
                              } catch {
                                return wp.steps || "-";
                              }
                            })()}
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-slate-700 mb-2">{t("Evidences")}</h5>
                          <div className="text-sm text-slate-600 ltr:pl-4 rtl:pr-4 space-y-1">
                            {(() => {
                              try {
                                const items = JSON.parse(wp.evidences);
                                return Array.isArray(items) && items.length > 0
                                  ? items.map((item, i) => <div key={i}>• {item}</div>)
                                  : wp.evidences || "-";
                              } catch {
                                return wp.evidences || "-";
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                {t("No workpapers generated. Click generate to create AI workpapers.")}
              </div>
            )}
          </div>
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setGenerateAIDialogOpen(false);
                setGeneratedWorkpapers([]);
                setSelectedGeneratedIds([]);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleAddSelectedWorkpapers}
              disabled={addingGeneratedWorkpapers || selectedGeneratedIds.length === 0 || isReadOnly}
            >
              {addingGeneratedWorkpapers ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Adding...")}
                </>
              ) : (
                `${t("Add Selected")} (${selectedGeneratedIds.length})`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View/Edit Document Dialog */}
      <Dialog open={viewEditDocumentDialogOpen} onOpenChange={setViewEditDocumentDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{isEditingDocument ? t("Edit Document") : t("Document Details")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Title")}</Label>
              {isEditingDocument ? (
                <>
                  <Input
                    value={editDocument.title}
                    onChange={(e) => setEditDocument({ ...editDocument, title: e.target.value })}
                    placeholder={t("Enter document title")}
                    className={documentValidationErrors.editDocumentTitle ? 'border-red-500' : ''}
                  />
                  {documentValidationErrors.editDocumentTitle && (
                    <p className="text-sm text-red-600">{documentValidationErrors.editDocumentTitle}</p>
                  )}
                </>
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border">
                  {selectedDocument?.title || selectedDocument?.fileName || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Document Type")}</Label>
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
                <div className="p-3 bg-slate-50 rounded-md border">
                  {selectedDocument?.documentType || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Description")}</Label>
              {isEditingDocument ? (
                <Textarea
                  value={editDocument.description}
                  onChange={(e) => setEditDocument({ ...editDocument, description: e.target.value })}
                  placeholder={t("Enter description")}
                  rows={4}
                />
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border min-h-[100px]">
                  {selectedDocument?.description || "-"}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Attached File")}</Label>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md border">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary-600" />
                  <div>
                    <p className="text-sm font-medium">{selectedDocument?.fileName}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(selectedDocument?.fileSize || 0)}</p>
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
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Download")}
                </Button>
              </div>
            </div>
          </div>
          {/* Fixed Footer */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
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
                size="sm"
                onClick={handleUpdateDocument}
                disabled={savingDocument || isReadOnly}
              >
                {savingDocument ? (
                  <>
                    <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                    {t("Saving...")}
                  </>
                ) : (
                  t("Save")
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View/Edit Evidence Request Dialog */}
      <Dialog open={viewEditEvidenceDialogOpen} onOpenChange={setViewEditEvidenceDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] flex flex-col p-0 gap-0 max-h-[90vh]">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{isEditingEvidence ? t("Edit Evidence Request") : t("View Evidence Request")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            {/* Request Title */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Request Title")} <span className="text-red-500">*</span></Label>
              {isEditingEvidence ? (
                <Input
                  value={editEvidence.title}
                  onChange={(e) => setEditEvidence({ ...editEvidence, title: e.target.value })}
                  placeholder={t("Enter title")}
                />
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border">
                  {selectedEvidence?.title || "-"}
                </div>
              )}
            </div>
            {/* Auditee */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Auditee")}</Label>
              {isEditingEvidence ? (
                <Select
                  value={editEvidence.auditeeId}
                  onValueChange={(value) => {
                    const selectedAuditee = translatedAuditees.find(a => a.id === value);
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
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-sm">
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
                    {translatedAuditees.map((auditee) => (
                      <SelectItem key={auditee.id} value={auditee.id}>
                        {auditee.fullName} {auditee.department?.name ? `(${auditee.department.name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border">
                  {selectedEvidence?.auditee || "-"}
                </div>
              )}
            </div>
            {/* Number of Samples */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Number of Samples")}</Label>
              {isEditingEvidence ? (
                <Input
                  type="number"
                  min="1"
                  value={editEvidence.numberOfSamples}
                  onChange={(e) => setEditEvidence({ ...editEvidence, numberOfSamples: e.target.value })}
                  placeholder={t("Enter number of samples")}
                />
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border">
                  {selectedEvidence?.numberOfSamples || "-"}
                </div>
              )}
            </div>
            {/* Description */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Description")}</Label>
              {isEditingEvidence ? (
                <Textarea
                  value={editEvidence.description}
                  onChange={(e) => setEditEvidence({ ...editEvidence, description: e.target.value })}
                  placeholder={t("Enter description")}
                  rows={4}
                />
              ) : (
                <div className="p-3 bg-slate-50 rounded-md border min-h-[80px]">
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
                        <div className="w-10 h-10 bg-primary-50 rounded flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary-600" />
                        </div>
                      ) : att.fileName?.endsWith('.docx') || att.fileName?.endsWith('.doc') ? (
                        <div className="w-10 h-10 bg-primary-50 rounded flex items-center justify-center">
                          <FileSpreadsheet className="h-5 w-5 text-primary-700" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center">
                          <FileText className="h-5 w-5 text-slate-600" />
                        </div>
                      )}
                      <span className="text-sm text-primary-600">{att.fileName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api${att.filePath}`}
                        download
                        className="p-1 hover:bg-slate-100 rounded"
                        title={t("Download")}
                      >
                        <Download className="h-4 w-4 text-slate-600" />
                      </a>
                      <a
                        href={`/api${att.filePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-slate-100 rounded"
                        title={t("View")}
                      >
                        <Eye className="h-4 w-4 text-slate-600" />
                      </a>
                      <button
                        className="p-1 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t("Delete")}
                        onClick={() => setDeleteAttachmentId(att.id)}
                        disabled={isReadOnly}
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
                  <Label className="text-slate-700 font-medium">{t("Status")}</Label>
                  <div className="p-3 bg-slate-50 rounded-md border">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      selectedEvidence?.status === 'Reviewed' ? 'bg-emerald-100 text-emerald-800' :
                      selectedEvidence?.status === 'Submitted' ? 'bg-primary-50 text-primary-700' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                    {selectedEvidence?.status || "-"}
                  </span>
                </div>
              </div>
              {/* AI Review Section */}
              {selectedEvidence?.aiReviewStatus && (
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">{t("AI Review Result")}</Label>
                  <div className={`p-3 rounded-md border ${
                    selectedEvidence.aiReviewStatus === 'Satisfactory'
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {selectedEvidence.aiReviewStatus === 'Satisfactory' ? (
                        <>
                          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
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
                <Label className="text-slate-700 font-medium">{t("Uploaded Attachments")}</Label>
                <div className="p-3 bg-slate-50 rounded-md border space-y-2">
                  {selectedEvidence.attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary-600" />
                        <span className="text-sm">{att.fileName}</span>
                        <span className="text-xs text-slate-400">({formatFileSize(att.fileSize)})</span>
                      </div>
                      <a
                        href={`/api${att.filePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline text-sm flex items-center gap-1"
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
                <Label className="text-slate-700 font-medium">{t("Uploaded Attachments")}</Label>
                <div className="p-3 bg-slate-50 rounded-md border text-slate-500 text-sm">
                  {t("No attachments uploaded yet")}
                </div>
              </div>
            )}
            {/* Comments button for auditee when there's a clarification request */}
            {!isEditingEvidence && isAuditeeOnly && selectedEvidence?.clarificationComment && (
              <div className="flex ltr:justify-end rtl:justify-start mt-4">
                <Button
                  size="sm"
                  onClick={() => {
                    setAuditeeClariEvidence(selectedEvidence);
                    setAuditeeClariDialogOpen(true);
                  }}
                >
                  <MessageSquare className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Comments")}
                </Button>
              </div>
            )}
          </div>
          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-between items-center px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
              {/* Approve/Need Clarification buttons for Audit Team when evidence has attachments */}
              {!isEditingEvidence && isAuditTeam && selectedEvidence?.attachments && selectedEvidence.attachments.length > 0 && selectedEvidence.status !== 'Reviewed' && (
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
                    <AlertCircle className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Need Clarification")}
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      if (selectedEvidence) {
                        handleApproveEvidence(selectedEvidence.id);
                        setViewEditEvidenceDialogOpen(false);
                        setSelectedEvidence(null);
                      }
                    }}
                  >
                    <Check className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Approve")}
                  </Button>
                </>
              )}
              {isEditingEvidence && (
                <Button
                  size="sm"
                  onClick={handleUpdateEvidence}
                  disabled={savingEvidence || isReadOnly}
                >
                  {savingEvidence ? (
                    <>
                      <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                      {t("Saving...")}
                    </>
                  ) : (
                    t("Save")
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Attachment Confirmation */}
      <AlertDialog open={!!deleteAttachmentId} onOpenChange={(open) => { if (!open) setDeleteAttachmentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Attachment")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this attachment?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAttachment}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deletingAttachment}
              onClick={async (e) => {
                e.preventDefault();
                setDeletingAttachment(true);
                try {
                  const res = await fetch(
                    `/api/internal-audit/fieldwork/${engagementId}/evidence-requests/${selectedEvidence?.id}/attachments/${deleteAttachmentId}`,
                    { method: 'DELETE' }
                  );
                  if (!res.ok) throw new Error('Failed to delete');
                  setSelectedEvidence((prev: EvidenceRequest | null) => prev ? {
                    ...prev,
                    attachments: prev.attachments?.filter((a: { id: string }) => a.id !== deleteAttachmentId) || [],
                  } : null);
                  toast.success(t("Attachment deleted successfully"));
                } catch {
                  toast.error(t("Failed to delete attachment"));
                } finally {
                  setDeletingAttachment(false);
                  setDeleteAttachmentId(null);
                }
              }}
            >
              {deletingAttachment ? t("Deleting...") : t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Need Clarification Dialog */}
      <Dialog open={clarificationDialogOpen} onOpenChange={setClarificationDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[450px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Need Clarification")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">
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
              <Label className="text-slate-700 font-medium">{t("Comment")}</Label>
              <Textarea
                value={clarificationComment}
                onChange={(e) => setClarificationComment(e.target.value)}
                placeholder={t("Enter your clarification request...")}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Previous Comments")}</Label>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-slate-500 text-sm text-center">
                {t("No items found")}
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClarificationDialogOpen(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSendClarification}
              disabled={sendingClarification || !clarificationDocument || isReadOnly}
            >
              {sendingClarification ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Sending...")}
                </>
              ) : (
                t("Send")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auditee Clarification View Popup */}
      <Dialog open={auditeeClariDialogOpen} onOpenChange={setAuditeeClariDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[450px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Need Clarification")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">{t("Document that requires clarification")}</p>
                <p className="text-sm text-slate-900">{auditeeClariEvidence?.clarificationDocumentName || "-"}</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setRespondComment("");
                  setRespondFiles([]);
                  setRespondDialogOpen(true);
                }}
              >
                {t("Respond")}
              </Button>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <p className="text-sm text-slate-900">{auditeeClariEvidence?.clarificationComment || "-"}</p>
              <p className="text-sm text-slate-500 mt-1">
                ~ {auditeeClariEvidence?.clarificationByUserName || "Unknown"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {auditeeClariEvidence?.clarificationSentAt
                  ? new Date(auditeeClariEvidence.clarificationSentAt).toLocaleString()
                  : "-"}
              </p>
            </div>
          </div>
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAuditeeClariDialogOpen(false)}
            >
              {t("Close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auditee Respond Dialog */}
      <Dialog open={respondDialogOpen} onOpenChange={setRespondDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[450px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Respond")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Comment")}</Label>
              <Textarea
                value={respondComment}
                onChange={(e) => setRespondComment(e.target.value)}
                placeholder={t("Enter your response...")}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Attach File")}</Label>
              <div
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-slate-400 transition-colors"
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
                <p className="text-slate-500">{t("Drag and drop or select file.")}</p>
                {respondFiles.length > 0 && (
                  <div className="mt-2 text-sm text-emerald-600">
                    {respondFiles.map((f) => f.name).join(", ")}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRespondDialogOpen(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSendResponse}
              disabled={sendingResponse || isReadOnly}
            >
              {sendingResponse ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Sending...")}
                </>
              ) : (
                t("Send Response")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Evidence Request Confirmation Dialog */}
      <Dialog open={deleteEvidenceDialogOpen} onOpenChange={setDeleteEvidenceDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Evidence Request")}</DialogTitle>
              <DialogDescription className="text-slate-600">
                {t("Are you sure you want to delete")} &quot;{evidenceToDelete?.title}&quot;? {t("This action cannot be undone.")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-4 sm:px-6 py-4 flex ltr:justify-end rtl:justify-start gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteEvidenceDialogOpen(false);
                setEvidenceToDelete(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteEvidence}
              disabled={deletingEvidence || isReadOnly}
            >
              {deletingEvidence ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Review Result Dialog */}
      <Dialog open={aiReviewDialogOpen} onOpenChange={setAiReviewDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <MessageSquare className="h-5 w-5 text-green-600" />
                {t("AI Review Results")}
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                {t("AI-generated review of")} {selectedEvidenceIds.length} {t("evidence request(s)")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 overflow-y-auto flex-1">
            {aiReviewResult ? (
              <div className="prose prose-sm max-w-none">
                <div className="bg-slate-50 rounded-lg p-4 whitespace-pre-wrap text-sm">
                  {aiReviewResult}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                {t("No review generated yet")}
              </div>
            )}
          </div>
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAiReviewDialogOpen(false);
                setAiReviewResult("");
              }}
            >
              {t("Close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Attachment Dialog */}
      <Dialog open={attachmentDialogOpen} onOpenChange={setAttachmentDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Attachment")}</DialogTitle>
              <DialogDescription className="text-slate-600">
                {t("Upload attachment for")}: {evidenceForAttachment?.title}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">{t("Attach File")}</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragOver ? "border-primary-500 bg-primary-50" : "border-slate-300 hover:border-slate-400"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => attachmentFileInputRef.current?.click()}
              >
                <p className="text-slate-600">{t("Click here, or drop files here to upload.")}</p>
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
                      className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary-500" />
                        <span className="text-sm text-slate-700">{file.name}</span>
                        <span className="text-xs text-slate-400">({formatFileSize(file.size)})</span>
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
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex ltr:justify-end rtl:justify-start gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAttachmentDialogOpen(false);
                setEvidenceForAttachment(null);
                setUploadedFiles([]);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleUploadAttachment}
              disabled={uploadingAttachment || isReadOnly}
            >
              {uploadingAttachment ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Uploading...")}
                </>
              ) : (
                t("Upload")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Finding Dialog */}
      <Dialog open={viewFindingDialogOpen} onOpenChange={(open) => {
        setViewFindingDialogOpen(open);
        if (!open) setSelectedFindingForView(null);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("View Finding")} - {selectedFindingForView?.findingId || ''}</DialogTitle>
          </DialogHeader>

          {loadingFindingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : selectedFindingForView ? (
            <div className="space-y-4 sm:space-y-6">
              {/* Audit Plan */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Audit Plan")}</Label>
                <p className="mt-1 text-sm text-slate-900">{displayEngagement?.engagementTitle || selectedFindingForView.engagement?.engagementTitle || '-'}</p>
              </div>

              {/* Finding Details */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-900">{t("Finding Details")}</h3>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Finding Title")}</Label>
                  <p className="mt-1 text-sm text-slate-900">{displayFindingForView?.title || selectedFindingForView.title || '-'}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Severity")}</Label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      selectedFindingForView.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                      selectedFindingForView.severity === 'High' ? 'bg-orange-100 text-orange-800' :
                      selectedFindingForView.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedFindingForView.severity}
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Criteria (What should be)")}</Label>
                  <p className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{displayFindingForView?.criteria || selectedFindingForView.criteria || '-'}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Condition (What is)")}</Label>
                  <p className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{displayFindingForView?.condition || selectedFindingForView.condition || '-'}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Cause (Why it happened)")}</Label>
                  <p className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{displayFindingForView?.cause || selectedFindingForView.cause || '-'}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Effect (The consequence)")}</Label>
                  <p className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{displayFindingForView?.effect || selectedFindingForView.effect || '-'}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Recommendation")}</Label>
                  <p className="mt-1 text-sm text-slate-900 whitespace-pre-wrap">{displayFindingForView?.recommendation || selectedFindingForView.recommendation || '-'}</p>
                </div>

                {selectedFindingForView.attachments && selectedFindingForView.attachments.length > 0 ? (
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Attachments")}</Label>
                    <div className="mt-2 space-y-2">
                      {selectedFindingForView.attachments.map((attachment: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-600" />
                            <span className="text-sm text-slate-900">{attachment.fileName}</span>
                          </div>
                          <a
                            href={attachment.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:underline"
                          >
                            {t("View")}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* CAPA Details */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-base font-semibold text-slate-900">{t("Corrective & Preventive Actions (CAPA)")}</h3>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Responsible Person")}</Label>
                  <p className="mt-1 text-sm text-slate-900">{selectedFindingForView.responsiblePerson || '-'}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                  <p className="mt-1 text-sm text-slate-900">{selectedFindingForView.status || '-'}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Target Closure Date")}</Label>
                  <p className="mt-1 text-sm text-slate-900">{formatDate(selectedFindingForView.targetDate)}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex ltr:justify-end rtl:justify-start gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewFindingDialogOpen(false);
                    setSelectedFindingForView(null);
                  }}
                >
                  {t("Close")}
                </Button>
                {(isAuditHead || isAuditor) && (
                  <Button
                    onClick={() => {
                      setViewFindingDialogOpen(false);
                      router.push(`/internal-audit/fieldwork/${engagementId}/findings/${selectedFindingForView.id}?edit=true`);
                    }}
                    disabled={isReadOnly}
                  >
                    <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Edit Finding")}
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { isValidName } from "@/lib/validations";
import { Button } from "@/components/ui/button";
// Card components replaced with plain divs for design consistency
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { useGovernanceAIReview } from "@/hooks/useGovernanceAIReview";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Edit,
  FileText,
  Shield,
  AlertTriangle,
  Sparkles,
  Link2,
  Plus,
  Trash2,
  Check,
  Upload,
  Download,
  Calendar,
  Layers,
  Home,
  ChevronRight,
  Search,
  File,
  FileType,
  X,
  Eye,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { useTranslatedData, useTranslatedRecord, triggerTranslation } from "@/hooks/useTranslatedData";
import { toast } from "sonner";

interface Policy {
  id: string;
  code: string;
  name: string;
  description: string | null;
  documentType: string;
  status: string;
  version: string | null;
  owner: string | null;
  recurrence: string | null;
  effectiveDate: string | null;
  reviewDate: string | null;
  nextReviewDate: string | null;
  aiReviewStatus: string | null;
  aiReviewScore: number | null;
  aiReviewJustification: string | null;
  frameworkId: string | null;
  departmentId: string | null;
  assigneeId: string | null;
  approverId: string | null;
  updatedAt: string;
  framework?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  assignee?: { id: string; fullName: string } | null;
  approver?: { id: string; fullName: string } | null;
  requirements?: Array<{
    requirement: {
      id: string;
      code: string;
      name: string;
      framework?: { id: string; name: string } | null;
    };
  }>;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    filePath: string;
    uploadedAt: string;
  }>;
  policyExceptions?: Array<{
    exception: {
      id: string;
      exceptionCode: string;
      name: string;
      status: string;
      category: string;
    };
  }>;
  vaultDocumentLinks?: Array<{
    id: string;
    documentId: string;
    policyId: string;
    document: {
      id: string;
      documentCode: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      filePath: string;
      status: string;
      uploadedAt: string;
    };
  }>;
}

interface Framework {
  id: string;
  name: string;
  code: string;
}

interface Department {
  id: string;
  name: string;
}

interface UserRole {
  role: {
    name: string;
  };
}

interface User {
  id: string;
  fullName: string;
  departmentId?: string;
  designation?: string;
  department?: { id: string; name: string };
  userRoles?: UserRole[];
}

interface Requirement {
  id: string;
  code: string;
  name: string;
  framework?: { id: string; name: string } | null;
}

interface VaultDocument {
  id: string;
  documentId: string;
  name: string;
  type: string;
  status: string;
  uploadedAt: string;
  filePath: string;
  linkedGovernanceIds: string[];
}

// AI Review Control Result interface
interface AIReviewControlResult {
  control_code: string;
  status: string;
  answer: string;
  score?: number | null;
  question?: string;
  status_code?: number;
  uuid?: string;
}

// AI Review Evidence Result interface
interface AIReviewEvidenceResult {
  control_code: string;
  status: string;
  answer: string;
  score?: number | null;
  question?: string;
  status_code?: number;
  uuid?: string;
}

// AI Review Response interface
interface AIReviewResponse {
  success?: boolean;
  compliance_score?: number;
  compliance_summary?: string;
  total_controls?: number;
  compliant_controls?: number;
  gaps?: Array<{
    control_code: string;
    status?: string;
    answer?: string;
    issue?: string;
    score?: number | null;
  }>;
  recommendations?: Array<{
    control_code: string;
    recommendation: string;
  }>;
  raw_response?: {
    controls_response: AIReviewControlResult[];
    evidence_response?: AIReviewEvidenceResult[];
    policy_compliant_data?: {
      total_controls: number;
      total_compliant_controls: number;
      compliant_percent: number;
    };
  };
}

const statusColors: Record<string, string> = {
  "Not Uploaded": "bg-slate-100 text-slate-600",
  Draft: "bg-warning-light text-warning-dark",
  "Under Review": "bg-info-light text-info-dark",
  Approved: "bg-success-light text-success-dark",
  Published: "bg-purple-100 text-purple-800",
  "Needs Review": "bg-error-light text-error-dark",
  Archived: "bg-slate-100 text-slate-600",
};

const aiStatusColors: Record<string, string> = {
  Pending: "bg-slate-100 text-slate-600",
  "In Progress": "bg-info-light text-info-dark",
  Completed: "bg-success-light text-success-dark",
  Failed: "bg-error-light text-error-dark",
};

const typeLabels: Record<string, string> = {
  Policy: "Policy",
  Standard: "Standard",
  Procedure: "Procedure",
};

const RECURRENCE_OPTIONS = ["Weekly", "Monthly", "Quarterly", "Yearly"];

// Status workflow steps - 3 visual steps with status mapping
// Step 1 (Upload): Active when status is Draft, Approved, or Published
// Step 2 (Draft): Active when status is Approved or Published
// Step 3 (Publish): Active when status is Published
const STATUS_WORKFLOW = [
  { key: "Upload", label: "Upload", icon: Upload },
  { key: "Draft", label: "Draft", icon: FileText },
  { key: "Publish", label: "Publish", icon: Check },
];

// Helper to determine which steps are active/completed based on status
const getStepStates = (status: string) => {
  switch (status) {
    case "Not Uploaded":
      return { upload: false, draft: false, publish: false };
    case "Draft":
      return { upload: true, draft: false, publish: false };
    case "Approved":
      return { upload: true, draft: true, publish: false };
    case "Published":
      return { upload: true, draft: true, publish: true };
    default:
      return { upload: false, draft: false, publish: false };
  }
};

export default function GovernanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const currentUserId = session?.user?.id as string | undefined;
  const { canEdit, canApprove, canDelete, isLoading: permissionsLoading } = usePermissions('qpost-compliance.governance');
  const isCustomerAdmin = useHasRole('CustomerAdministrator');
  const { t } = useLanguage();

  // Context from framework navigation
  const fromFramework = searchParams.get("from") === "framework";
  const frameworkId = searchParams.get("frameworkId");
  const frameworkName = searchParams.get("frameworkName") ? decodeURIComponent(searchParams.get("frameworkName")!) : null;

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("requirements");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [linkRequirementDialogOpen, setLinkRequirementDialogOpen] = useState(false);
  const [linkExceptionDialogOpen, setLinkExceptionDialogOpen] = useState(false);
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [approverDialogOpen, setApproverDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false);
  const [storedSignature, setStoredSignature] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // AI Generate Policy state
  const [generatePolicyDialogOpen, setGeneratePolicyDialogOpen] = useState(false);
  const [generatingPolicy, setGeneratingPolicy] = useState(false);
  const [templates, setTemplates] = useState<Array<{
    id: string;
    name: string;
    fileName: string;
    fileType: string | null;
    fileSize: number | null;
    createdAt: string;
    uploadedBy?: { fullName: string } | null;
  }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [newTemplateFile, setNewTemplateFile] = useState<File | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");

  // AI Review Details Modal state (hidden for QPost — kept for future use)
  const [aiReviewDetailsOpen, setAiReviewDetailsOpen] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<AIReviewResponse | null>(null);

  // Manual Review state
  interface ManualReview {
    id: string;
    status: string;
    score: number | null;
    comments: string | null;
    findings: string | null;
    recommendation: string | null;
    reviewDate: string;
    reviewer: { id: string; userName: string; fullName: string };
  }
  const [manualReviews, setManualReviews] = useState<ManualReview[]>([]);
  const [manualReviewDialogOpen, setManualReviewDialogOpen] = useState(false);
  const [manualReviewForm, setManualReviewForm] = useState({
    status: "Reviewed",
    score: "",
    comments: "",
    findings: "",
    recommendation: "",
  });
  const [savingManualReview, setSavingManualReview] = useState(false);
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null);
  const [deletingReview, setDeletingReview] = useState(false);

  // AI Review Hook - orchestrates ingest → review flow
  const {
    phase: aiReviewPhase,
    progress: _aiReviewProgress,
    error: _aiReviewError,
    startAIReview: _startAIReview,
    reset: _resetAIReview,
  } = useGovernanceAIReview({
    policyId: id as string,
    onIngestStart: () => {
      console.log('[Governance] Document ingest started');
    },
    onIngestComplete: (documentId) => {
      console.log('[Governance] Document ingested:', documentId);
      toast.success(t('Document processed successfully'));
    },
    onReviewStart: () => {
      console.log('[Governance] AI review started');
      setPolicy(prev => prev ? { ...prev, aiReviewStatus: 'In Progress' } : prev);
    },
    onReviewComplete: (result) => {
      console.log('[Governance] AI review completed:', result);
      setAiReviewResult(result as AIReviewResponse);
      fetchPolicy();
      toast.success(t('AI Review completed'));
    },
    onError: (error) => {
      console.error('[Governance] AI review error:', error);
      toast.error(error);
      fetchPolicy();
    },
  });

  // Vault document linking state
  const [linkFromVaultDialogOpen, setLinkFromVaultDialogOpen] = useState(false);
  const [vaultDocuments, setVaultDocuments] = useState<VaultDocument[]>([]);
  const [vaultSearchQuery, setVaultSearchQuery] = useState("");
  const [selectedVaultDocIds, setSelectedVaultDocIds] = useState<string[]>([]);
  const [linkingVaultDocs, setLinkingVaultDocs] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    documentType: "",
    status: "",
    version: "",
    owner: "",
    recurrence: "",
    effectiveDate: "",
    reviewDate: "",
    nextReviewDate: "",
    frameworkId: "",
    departmentId: "",
  });

  // Inline edit states
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [selectedApproverId, setSelectedApproverId] = useState("");
  const [selectedRecurrence, setSelectedRecurrence] = useState("");
  const [selectedReviewDate, setSelectedReviewDate] = useState("");

  // Reference data
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [availableRequirements, setAvailableRequirements] = useState<Requirement[]>([]);
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>([]);
  const [requirementSearchQuery, setRequirementSearchQuery] = useState("");
  const [availableExceptions, setAvailableExceptions] = useState<Array<{
    id: string;
    exceptionCode: string;
    name: string;
    status: string;
    category: string;
  }>>([]);
  const [selectedExceptionId, setSelectedExceptionId] = useState("");

  // Dynamic translation hooks
  const { data: translatedPolicy } = useTranslatedRecord(policy, { modelName: 'QPostPolicy' });
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedUsers } = useTranslatedData(users, { modelName: 'User' });
  const { data: translatedFrameworks } = useTranslatedData(frameworks, { modelName: 'QPostFramework' });
  const { data: translatedRequirements } = useTranslatedData(availableRequirements, { modelName: 'QPostRequirement' });
  const { data: translatedExceptions } = useTranslatedData(availableExceptions, { modelName: 'QPostException' });

  // Lookup maps for translated nested data
  const departmentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    translatedDepartments.forEach(d => map.set(d.id, d.name));
    return map;
  }, [translatedDepartments]);

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    translatedUsers.forEach(u => map.set(u.id, u.fullName));
    return map;
  }, [translatedUsers]);

  const frameworkNameMap = useMemo(() => {
    const map = new Map<string, string>();
    translatedFrameworks.forEach(f => map.set(f.id, f.name));
    return map;
  }, [translatedFrameworks]);

  const requirementNameMap = useMemo(() => {
    const map = new Map<string, string>();
    translatedRequirements.forEach(r => map.set(r.id, r.name));
    return map;
  }, [translatedRequirements]);

  const fetchPolicy = useCallback(async () => {
    try {
      const response = await fetch(`/api/qpost-compliance/policies/${id}`);
      if (response.ok) {
        const data = await response.json();
        setPolicy(data);
        setEditForm({
          name: data.name || "",
          description: data.description || "",
          documentType: data.documentType || "",
          status: data.status || "",
          version: data.version || "",
          owner: data.owner || "",
          recurrence: data.recurrence || "",
          effectiveDate: data.effectiveDate?.split("T")[0] || "",
          reviewDate: data.reviewDate?.split("T")[0] || "",
          nextReviewDate: data.nextReviewDate?.split("T")[0] || "",
          frameworkId: data.frameworkId || "",
          departmentId: data.departmentId || "",
        });
        setSelectedDepartmentId(data.departmentId || "");
        setSelectedAssigneeId(data.assigneeId || "");
        setSelectedApproverId(data.approverId || "");
        setSelectedRecurrence(data.recurrence || "");
        setSelectedReviewDate(data.reviewDate?.split("T")[0] || "");

        // Load stored AI review data if available
        const storedReview = data.policyAIReviews?.[0];
        if (storedReview && storedReview.status === "completed" && !aiReviewResult) {
          try {
            const controlsResponse = storedReview.matchedControls ? JSON.parse(storedReview.matchedControls) : [];
            const gaps = storedReview.gaps ? JSON.parse(storedReview.gaps) : [];
            const recommendations = storedReview.recommendations ? JSON.parse(storedReview.recommendations) : [];
            setAiReviewResult({
              compliance_score: storedReview.riskScore || undefined,
              compliance_summary: storedReview.complianceSummary || undefined,
              total_controls: controlsResponse.length,
              compliant_controls: controlsResponse.filter((c: { status?: string }) => c.status?.toLowerCase() === "compliant").length,
              gaps,
              recommendations,
              raw_response: {
                controls_response: controlsResponse,
                policy_compliant_data: {
                  total_controls: controlsResponse.length,
                  total_compliant_controls: controlsResponse.filter((c: { status?: string }) => c.status?.toLowerCase() === "compliant").length,
                  compliant_percent: storedReview.riskScore || 0,
                },
              },
            } as AIReviewResponse);
          } catch (e) {
            console.error("Error parsing stored AI review data:", e);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching policy:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [frameworksRes, departmentsRes, usersRes, requirementsRes, exceptionsRes] = await Promise.all([
        fetch("/api/qpost-compliance/frameworks"),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/qpost-compliance/requirements?limit=1000"),
        fetch("/api/qpost-compliance/exceptions"),
      ]);

      if (frameworksRes.ok) {
        const data = await frameworksRes.json();
        setFrameworks(Array.isArray(data) ? data : data.data || []);
      }
      if (departmentsRes.ok) {
        setDepartments(await departmentsRes.json());
      }
      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }
      if (requirementsRes.ok) {
        const data = await requirementsRes.json();
        setAvailableRequirements(Array.isArray(data) ? data : data.data || []);
      }
      if (exceptionsRes.ok) {
        const data = await exceptionsRes.json();
        setAvailableExceptions(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  const fetchVaultDocuments = useCallback(async () => {
    try {
      const response = await fetch("/api/qpost-compliance/governance-vault");
      if (response.ok) {
        const data = await response.json();
        setVaultDocuments(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching vault documents:", error);
    }
  }, []);

  const fetchManualReviews = useCallback(async () => {
    try {
      const response = await fetch(`/api/qpost-compliance/policies/${id}/manual-reviews`);
      if (response.ok) {
        const data = await response.json();
        setManualReviews(data);
      }
    } catch (error) {
      console.error("Error fetching manual reviews:", error);
    }
  }, [id]);

  useEffect(() => {
    fetchPolicy();
    fetchReferenceData();
    fetchVaultDocuments();
    fetchManualReviews();
  }, [fetchPolicy, fetchReferenceData, fetchVaultDocuments, fetchManualReviews]);

  // Filtered user lists for role-based assignment restrictions
  // Assignees: Only DepartmentContributor and DepartmentReviewer from the selected department
  const filteredAssigneeUsers = translatedUsers.filter((u) => {
    // Must be in the same department as the governance document
    if (selectedDepartmentId && u.departmentId !== selectedDepartmentId) return false;
    // Must have DepartmentContributor or DepartmentReviewer role
    return u.userRoles?.some((ur) =>
      ["DepartmentContributor", "DepartmentReviewer"].includes(ur.role?.name)
    );
  });

  // Approvers: Only DepartmentReviewer from the selected department
  const filteredApproverUsers = translatedUsers.filter((u) => {
    // Must be in the same department as the governance document
    if (selectedDepartmentId && u.departmentId !== selectedDepartmentId) return false;
    // Must have DepartmentReviewer role only
    return u.userRoles?.some((ur) => ur.role?.name === "DepartmentReviewer");
  });

  // Load stored signature from localStorage when policy is loaded and Published
  useEffect(() => {
    if (policy?.id && policy.status === "Published") {
      const signature = localStorage.getItem(`policy-signature-${policy.id}`);
      setStoredSignature(signature);
    } else {
      setStoredSignature(null);
    }
  }, [policy?.id, policy?.status]);

  const handleSave = async () => {
    if (!editForm.name || !editForm.name.trim()) return;
    if (!isValidName(editForm.name.trim())) {
      alert(t("Only letters, spaces, and hyphens are allowed"));
      return;
    }
    try {
      const response = await fetch(`/api/qpost-compliance/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          effectiveDate: editForm.effectiveDate || null,
          reviewDate: editForm.reviewDate || null,
          nextReviewDate: editForm.nextReviewDate || null,
          frameworkId: editForm.frameworkId || null,
          departmentId: editForm.departmentId || null,
        }),
      });

      if (response.ok) {
        triggerTranslation('Policy', id, { name: editForm.name });
        setEditDialogOpen(false);
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error updating policy:", error);
    }
  };

  const handleInlineUpdate = async (field: string, value: string) => {
    try {
      const response = await fetch(`/api/qpost-compliance/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value || null }),
      });

      if (response.ok) {
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error updating field:", error);
    }
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/qpost-compliance/policies/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        fetchPolicy();
      } else {
        const error = await response.json();
        console.error("Approve failed:", error);
      }
    } catch (error) {
      console.error("Error approving policy:", error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/qpost-compliance/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleLinkRequirement = async () => {
    if (selectedRequirementIds.length === 0) return;

    try {
      // Link requirements one by one via the new API
      for (const requirementId of selectedRequirementIds) {
        await fetch(`/api/qpost-compliance/requirements/${requirementId}/policies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policyId: id }),
        });
      }

      setLinkRequirementDialogOpen(false);
      setSelectedRequirementIds([]);
      setRequirementSearchQuery("");
      fetchPolicy();
    } catch (error) {
      console.error("Error linking requirement:", error);
    }
  };

  // Filter requirements for the link dialog
  const getFilteredRequirementsForLinking = () => {
    return translatedRequirements
      .filter((r) => !linkedRequirements.find((lr) => lr.requirement.id === r.id))
      .filter((r) => {
        // Search filter
        if (requirementSearchQuery.trim()) {
          const query = requirementSearchQuery.toLowerCase();
          const matchesCode = r.code?.toLowerCase().includes(query);
          const matchesName = r.name?.toLowerCase().includes(query);
          if (!matchesCode && !matchesName) return false;
        }
        return true;
      });
  };

  const handleUnlinkRequirement = async (requirementId: string) => {
    try {
      const response = await fetch(`/api/qpost-compliance/requirements/${requirementId}/policies?policyId=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error unlinking requirement:", error);
    }
  };

  const handleLinkException = async () => {
    if (!selectedExceptionId) return;

    try {
      const response = await fetch(`/api/qpost-compliance/policies/${id}/exceptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exceptionId: selectedExceptionId }),
      });

      if (response.ok) {
        setLinkExceptionDialogOpen(false);
        setSelectedExceptionId("");
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error linking exception:", error);
    }
  };

  const handleUnlinkException = async (exceptionId: string) => {
    try {
      const response = await fetch(`/api/qpost-compliance/policies/${id}/exceptions/${exceptionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error unlinking exception:", error);
    }
  };

  // Trigger AI Review using the new hook (handles ingest → review flow) — hidden for QPost
  const handleTriggerAIReview = () => {
    _startAIReview();
  };

  const handleClearAIReview = async () => {
    try {
      // Call the cleanup route which deletes from RunPod and resets DB
      const response = await fetch(`/api/ai/governance/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId: id }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("[Clear AI Review] Cleanup completed:", data);
        setAiReviewResult(null);
        fetchPolicy();
        toast.success(t("AI review cleared successfully"));
      } else {
        const error = await response.json();
        toast.error(error.error || t("Failed to clear AI review"));
      }
    } catch (error) {
      console.error("Error clearing AI review:", error);
      toast.error(t("Failed to clear AI review"));
    }
  };

  // Manual Review handlers
  const handleAddManualReview = async () => {
    setSavingManualReview(true);
    try {
      const response = await fetch(`/api/qpost-compliance/policies/${id}/manual-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualReviewForm),
      });
      if (response.ok) {
        toast.success(t("Review added successfully"));
        setManualReviewDialogOpen(false);
        setManualReviewForm({ status: "Reviewed", score: "", comments: "", findings: "", recommendation: "" });
        fetchManualReviews();
      } else {
        const err = await response.json();
        toast.error(err.error || t("Failed to add review"));
      }
    } catch {
      toast.error(t("Failed to add review"));
    } finally {
      setSavingManualReview(false);
    }
  };

  const handleDeleteManualReview = async () => {
    if (!deleteReviewId) return;
    setDeletingReview(true);
    try {
      const response = await fetch(`/api/qpost-compliance/policies/${id}/manual-reviews?reviewId=${deleteReviewId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success(t("Review deleted"));
        setDeleteReviewId(null);
        fetchManualReviews();
      } else {
        toast.error(t("Failed to delete review"));
      }
    } catch {
      toast.error(t("Failed to delete review"));
    } finally {
      setDeletingReview(false);
    }
  };

  // Fetch governance templates
  const fetchTemplates = async () => {
    try {
      const response = await fetch(`/api/governance-templates?governanceType=${policy?.documentType || "Policy"}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
        // Auto-select first template if available
        if (data.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  // Upload new template
  const handleUploadTemplate = async () => {
    if (!newTemplateFile) {
      toast.error("Please select a .docx file");
      return;
    }

    setUploadingTemplate(true);
    try {
      const formData = new FormData();
      formData.append("file", newTemplateFile);
      formData.append("name", newTemplateName || newTemplateFile.name.replace(/\.[^/.]+$/, ""));
      formData.append("governanceType", policy?.documentType || "Policy");

      const response = await fetch("/api/governance-templates", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const newTemplate = await response.json();
        toast.success("Template uploaded successfully!");
        setTemplates(prev => [newTemplate, ...prev]);
        setSelectedTemplateId(newTemplate.id);
        setNewTemplateFile(null);
        setNewTemplateName("");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to upload template");
      }
    } catch (error) {
      console.error("Error uploading template:", error);
      toast.error("An error occurred while uploading the template");
    } finally {
      setUploadingTemplate(false);
    }
  };

  const handleGeneratePolicy = async () => {
    // Validate linked requirements
    if (!policy?.requirements || policy.requirements.length === 0) {
      toast.error("Please link requirements to this policy first");
      return;
    }

    // Validate template selection
    if (!selectedTemplateId) {
      toast.error("Please select a template");
      return;
    }

    setGeneratingPolicy(true);
    toast.info("Generating policy document using AI...", { duration: 30000 });

    try {
      console.log("[Generate Policy] Starting generation for policy:", id);
      console.log("[Generate Policy] Policy Name:", policy?.name);
      console.log("[Generate Policy] Linked Requirements:", policy.requirements.length);
      console.log("[Generate Policy] Template ID:", selectedTemplateId);

      const response = await fetch("/api/ai/governance/generate-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyId: id, templateId: selectedTemplateId }),
      });

      const result = await response.json();
      console.log("[Generate Policy] Response status:", response.status);
      console.log("[Generate Policy] Response result:", JSON.stringify(result, null, 2));

      if (response.ok && result.success) {
        toast.success(`Policy generated successfully! Used ${result.controlsUsed} requirements.`);
        console.log("[Generate Policy] Download URL:", result.downloadUrl);
        console.log("[Generate Policy] Controls Used:", result.controlsUsed);
        console.log("[Generate Policy] Frameworks Used:", result.frameworksUsed);
        // Close dialog and refresh policy to show new attachment
        setGeneratePolicyDialogOpen(false);
        setSelectedTemplateId("");
        fetchPolicy();
      } else {
        const errorMessage = result.error || result.message || "Failed to generate policy";
        console.error("[Generate Policy] Error:", errorMessage);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("[Generate Policy] Exception:", error);
      toast.error("An error occurred while generating the policy");
    } finally {
      setGeneratingPolicy(false);
    }
  };

  const handleSaveAssignee = async () => {
    await handleInlineUpdate("assigneeId", selectedAssigneeId);
    setAssigneeDialogOpen(false);
  };

  const handleSaveApprover = async () => {
    await handleInlineUpdate("approverId", selectedApproverId);
    setApproverDialogOpen(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleUploadAttachment = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      // Step 1: Upload to Information Security Vault
      const formData = new FormData();
      formData.append("file", uploadFile);

      const vaultResponse = await fetch("/api/qpost-compliance/governance-vault", {
        method: "POST",
        body: formData,
      });

      if (!vaultResponse.ok) {
        const error = await vaultResponse.json();
        console.error("Vault upload failed:", error);
        toast.error(t("Failed to upload document"));
        return;
      }

      const vaultDoc = await vaultResponse.json();

      // Step 2: Auto-link vault document to this policy
      await fetch(`/api/qpost-compliance/governance-vault/${vaultDoc.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ governanceIds: [id] }),
      });

      // Step 3: Auto-transition to Draft status
      if (policy?.status === "Not Uploaded") {
        const updateData: Record<string, string | null> = { status: "Draft" };
        if (!policy.approverId && policy.assigneeId) {
          updateData.approverId = policy.assigneeId;
        }
        await fetch(`/api/qpost-compliance/policies/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });
      }

      setUploadDialogOpen(false);
      setUploadFile(null);
      fetchPolicy();
      fetchVaultDocuments();
      toast.success(t("Document uploaded successfully"));
    } catch (error) {
      console.error("Error uploading attachment:", error);
      toast.error(t("Failed to upload document"));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      // Find the attachment to get its fileName for vault matching
      const att = attachments.find((a) => a.id === attachmentId);

      const response = await fetch(`/api/qpost-compliance/policies/${id}/attachments?attachmentId=${attachmentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Also delete matching vault document if one exists with the same fileName
        let deletedVaultDocId: string | null = null;
        if (att) {
          const matchingVaultLink = linkedVaultDocuments.find(
            (link) => link.document.fileName === att.fileName
          );
          if (matchingVaultLink) {
            deletedVaultDocId = matchingVaultLink.document.id;
            await fetch(`/api/qpost-compliance/governance-vault/${matchingVaultLink.document.id}`, {
              method: "DELETE",
            });
          }
        }

        // Check if no documents remain after this deletion → revert to "Not Uploaded"
        const remainingAttachments = attachments.filter((a) => a.id !== attachmentId).length;
        const remainingVaultDocs = linkedVaultDocuments.filter(
          (link) => link.document.id !== deletedVaultDocId
        ).length;

        if (remainingAttachments === 0 && remainingVaultDocs === 0 && policy?.status === "Draft") {
          await fetch(`/api/qpost-compliance/policies/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Not Uploaded" }),
          });
        }

        fetchPolicy();
        fetchVaultDocuments();
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setUploadFile(files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  // Link from vault handlers
  const handleVaultDocSelect = (docId: string) => {
    setSelectedVaultDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const handleLinkVaultDocuments = async () => {
    if (selectedVaultDocIds.length === 0) return;

    setLinkingVaultDocs(true);
    try {
      // For each selected vault document, update its linked governance
      for (const docId of selectedVaultDocIds) {
        const vaultDoc = vaultDocuments.find((d) => d.id === docId);
        if (vaultDoc) {
          // Add current policy to the linked governance IDs
          const newLinkedIds = [...new Set([...vaultDoc.linkedGovernanceIds, id])];
          await fetch(`/api/qpost-compliance/governance-vault/${docId}/link`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ governanceIds: newLinkedIds }),
          });
        }
      }

      // Auto-transition to Draft status when document is linked
      if (policy?.status === "Not Uploaded") {
        await fetch(`/api/qpost-compliance/policies/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Draft" }),
        });
      }

      setLinkFromVaultDialogOpen(false);
      setSelectedVaultDocIds([]);
      setVaultSearchQuery("");
      fetchVaultDocuments(); // Refresh vault documents
      fetchPolicy(); // Refresh policy
    } catch (error) {
      console.error("Error linking vault documents:", error);
    } finally {
      setLinkingVaultDocs(false);
    }
  };

  // Filter vault documents by search query
  const filteredVaultDocuments = vaultDocuments.filter((doc) =>
    doc.name.toLowerCase().includes(vaultSearchQuery.toLowerCase()) ||
    doc.documentId.toLowerCase().includes(vaultSearchQuery.toLowerCase())
  );

  // Unlink vault document from policy
  const handleUnlinkVaultDocument = async (vaultDocId: string) => {
    try {
      // Delete vault document entirely (also removes from Information Security Vault)
      const response = await fetch(`/api/qpost-compliance/governance-vault/${vaultDocId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Check if no documents remain after this deletion
        const remainingAttachments = attachments.length;
        const remainingVaultDocs = linkedVaultDocuments.filter(
          (link) => link.document.id !== vaultDocId
        ).length;

        if (remainingAttachments === 0 && remainingVaultDocs === 0 && policy?.status === "Draft") {
          await fetch(`/api/qpost-compliance/policies/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Not Uploaded" }),
          });
        }

        fetchVaultDocuments();
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error deleting vault document:", error);
    }
  };

  // Get file type icon
  const getFileTypeIcon = (fileType: string) => {
    const type = fileType?.toLowerCase();
    if (type === "doc" || type === "docx") {
      return (
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">W</span>
        </div>
      );
    }
    if (type === "xls" || type === "xlsx") {
      return (
        <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">X</span>
        </div>
      );
    }
    if (type === "pdf") {
      return (
        <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">P</span>
        </div>
      );
    }
    return (
      <div className="w-8 h-8 bg-slate-400 rounded flex items-center justify-center">
        <File className="h-4 w-4 text-white" />
      </div>
    );
  };

  const handlePublish = async () => {
    try {
      // Save signature to localStorage before publishing
      const canvas = canvasRef.current;
      if (canvas && hasSignature) {
        const signatureDataUrl = canvas.toDataURL("image/png");
        localStorage.setItem(`policy-signature-${id}`, signatureDataUrl);
        // Also store the publish timestamp
        localStorage.setItem(`policy-publishedAt-${id}`, new Date().toISOString());
      }

      const response = await fetch(`/api/qpost-compliance/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Published" }),
      });

      if (response.ok) {
        setPublishDialogOpen(false);
        setSignatureDialogOpen(false);
        clearSignature();
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error publishing policy:", error);
    }
  };

  const handleUnpublish = async () => {
    try {
      const response = await fetch(`/api/qpost-compliance/policies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      });

      if (response.ok) {
        // Clear stored signature and publishedAt from localStorage
        localStorage.removeItem(`policy-signature-${id}`);
        localStorage.removeItem(`policy-publishedAt-${id}`);
        setStoredSignature(null);
        setUnpublishDialogOpen(false);
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error unpublishing policy:", error);
    }
  };

  // Signature canvas functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    setHasSignature(true);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };

  const openSignatureDialog = () => {
    setSignatureDialogOpen(true);
    setHasSignature(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
            <FileText className="h-6 w-6 text-primary-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">{t("Governance document not found")}</p>
        </div>
      </div>
    );
  }

  const linkedRequirements = policy.requirements || [];
  const linkedExceptions = policy.policyExceptions || [];
  const attachments = policy.attachments || [];
  const linkedVaultDocuments = policy.vaultDocumentLinks || [];

  // Derive linked frameworks from requirements -> requirement -> framework
  const linkedFrameworksFromRequirements = linkedRequirements
    .filter((pr) => pr.requirement.framework)
    .map((pr) => pr.requirement.framework!)
    .filter((fw, index, self) =>
      self.findIndex((f) => f.id === fw.id) === index
    ); // Remove duplicates

  // Get step states based on current status
  const stepStates = getStepStates(policy.status);

  // Approve button visibility: CustomerAdmin OR assigned Approver can approve when status is Draft
  const canShowApproveButton =
    policy.status === "Draft" &&
    (isCustomerAdmin || (currentUserId && policy.approverId === currentUserId));

  // Publish button visibility: Only when status is Approved
  // And only if user is Assignee OR CustomerAdmin
  const canShowPublishButton =
    policy.status === "Approved" &&
    currentUserId &&
    (currentUserId === policy.assigneeId || isCustomerAdmin);

  const tabs = [
    {
      id: "requirements",
      label: t("Linked Controls"),
      icon: Shield,
      count: linkedRequirements.length,
    },
    {
      id: "exceptions",
      label: t("Linked Exception"),
      icon: AlertTriangle,
      count: linkedExceptions.length,
    },
    {
      id: "documents",
      label: t("Linked Documents"),
      icon: FileText,
      count: attachments.length + linkedVaultDocuments.length,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href={fromFramework ? "/roles/customer-administrator/compliance" : ""} className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        {fromFramework && frameworkId ? (
          <>
            <Link href="/roles/customer-administrator/qpost-compliance/framework" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Integrated Frameworks")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
            <Link href={`/roles/customer-administrator/qpost-compliance/framework/${frameworkId}/policies`} className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Governance")}
            </Link>
          </>
        ) : (
          <Link href={`/qpost-compliance/governance?tab=${policy.documentType || "Policy"}`} className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Governance")}
          </Link>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{policy.code}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{translatedPolicy?.name || policy.name}</h1>
          <Badge className={statusColors[policy.status] || "bg-slate-100 text-slate-600"}>
            {t(policy.status)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Approve Button - CustomerAdmin or assigned Approver can see when status is Draft */}
          {canShowApproveButton && (
            <Button variant="outline" onClick={handleApprove}>
              <Check className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Approve")}
            </Button>
          )}

          {/* Publish Button - Only when Approved, visible to Assignee or CustomerAdmin */}
          {canShowPublishButton && (
            <Button onClick={openSignatureDialog}>
              <Check className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Publish")}
            </Button>
          )}

          {/* AI Review Buttons - Hidden for QPost (kept for future use) */}
          {/* <PermissionGate resource="qpost-compliance.governance" action="edit">
            {aiReviewPhase !== 'idle' && aiReviewPhase !== 'complete' && aiReviewPhase !== 'error' ? (
              <Button variant="outline" disabled>
                <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                {aiReviewPhase === 'checking' && t("Checking status...")}
                {aiReviewPhase === 'ingesting' && t("Uploading document...")}
                {aiReviewPhase === 'polling' && t("Processing document...")}
                {aiReviewPhase === 'reviewing' && t("Analyzing...")}
              </Button>
            ) : policy.aiReviewStatus === "Completed" || policy.aiReviewStatus === "Published" ? (
              <Button variant="outline" onClick={handleClearAIReview}>
                <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Clear AI Results")}
              </Button>
            ) : aiReviewPhase === 'error' ? (
              <Button variant="outline" onClick={handleTriggerAIReview}>
                <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Retry AI Review")}
              </Button>
            ) : (
              <Button variant="outline" onClick={handleTriggerAIReview}>
                <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Start AI Review")}
              </Button>
            )}
          </PermissionGate> */}

          {/* Edit Button - Only show if user can edit */}
          <PermissionGate resource="qpost-compliance.governance" action="edit">
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Edit className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Edit")}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-[900px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
              <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0">
                <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit")} {t(typeLabels[policy.documentType])}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Name")}</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Description")}</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm({ ...editForm, description: e.target.value })
                      }
                      rows={3}
                      className="focus-visible:ring-2 focus-visible:ring-primary-500/20 focus-visible:ring-offset-0 focus-visible:border-primary-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Type")}</Label>
                    <Select
                      value={editForm.documentType}
                      onValueChange={(value) =>
                        setEditForm({ ...editForm, documentType: value })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Policy">{t("Policy")}</SelectItem>
                        <SelectItem value="Standard">{t("Standard")}</SelectItem>
                        <SelectItem value="Procedure">{t("Procedure")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value) =>
                        setEditForm({ ...editForm, status: value })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not Uploaded">{t("Not Uploaded")}</SelectItem>
                        <SelectItem value="Draft">{t("Draft")}</SelectItem>
                        <SelectItem value="Under Review">{t("Under Review")}</SelectItem>
                        <SelectItem value="Approved">{t("Approved")}</SelectItem>
                        <SelectItem value="Published">{t("Published")}</SelectItem>
                        <SelectItem value="Needs Review">{t("Needs Review")}</SelectItem>
                        <SelectItem value="Archived">{t("Archived")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Version")}</Label>
                    <Input
                      value={editForm.version}
                      onChange={(e) =>
                        setEditForm({ ...editForm, version: e.target.value })
                      }
                      placeholder={t("e.g., 1.0")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Recurrence")}</Label>
                    <Select
                      value={editForm.recurrence}
                      onValueChange={(value) =>
                        setEditForm({ ...editForm, recurrence: value })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select recurrence")} />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRENCE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Framework")}</Label>
                    <Select
                      value={editForm.frameworkId}
                      onValueChange={(value) =>
                        setEditForm({ ...editForm, frameworkId: value })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select framework")} />
                      </SelectTrigger>
                      <SelectContent>
                        {translatedFrameworks.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Department")}</Label>
                    <Select
                      value={editForm.departmentId}
                      onValueChange={(value) =>
                        setEditForm({ ...editForm, departmentId: value })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("Select department")} />
                      </SelectTrigger>
                      <SelectContent>
                        {translatedDepartments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Effective Date")}</Label>
                    <DatePicker
                      value={editForm.effectiveDate || undefined}
                      onChange={(date) =>
                        setEditForm({ ...editForm, effectiveDate: date ? format(date, "yyyy-MM-dd") : "" })
                      }
                      placeholder={t("Select date")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Review Date")}</Label>
                    <DatePicker
                      value={editForm.reviewDate || undefined}
                      onChange={(date) =>
                        setEditForm({ ...editForm, reviewDate: date ? format(date, "yyyy-MM-dd") : "" })
                      }
                      placeholder={t("Select date")}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-row items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  className="w-full sm:w-auto"
                >
                  {t("Cancel")}
                </Button>
                <Button onClick={handleSave} className="w-full sm:w-auto">{t("Save Changes")}</Button>
              </div>
            </DialogContent>
          </Dialog>
          </PermissionGate>
        </div>
      </div>
      <p className="text-slate-500">{policy.code}</p>


      {/* Status Workflow Steps */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 py-4 px-3 sm:px-6 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
        {STATUS_WORKFLOW.map((step, index) => {
          const isStepActive =
            (step.key === "Upload" && stepStates.upload) ||
            (step.key === "Draft" && stepStates.draft) ||
            (step.key === "Publish" && stepStates.publish);

          const isLineActive =
            (index === 0 && stepStates.upload) ||
            (index === 1 && stepStates.draft);

          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-center shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors ${
                    isStepActive ? "bg-primary-600 text-white" : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {isStepActive ? <Check className="h-5 w-5 sm:h-6 sm:w-6" /> : <Icon className="h-4 w-4 sm:h-5 sm:w-5" />}
                </div>
                <span className={`text-xs sm:text-sm ${isStepActive ? "text-slate-800" : "text-slate-400"}`}>{t(step.label)}</span>
              </div>
              {index < STATUS_WORKFLOW.length - 1 && (
                <div className={`w-12 sm:w-24 h-0.5 ltr:ml-2 rtl:mr-2 sm:ltr:ml-4 sm:rtl:mr-4 ${isLineActive ? "bg-primary-600" : "bg-slate-300"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Linked Frameworks Indicator */}
      {(() => {
        // Use frameworks derived from requirements, fallback to direct framework field
        const linkedFrameworks: Array<{ id: string; name: string }> =
          linkedFrameworksFromRequirements.length > 0
            ? linkedFrameworksFromRequirements
            : policy.framework
            ? [policy.framework]
            : [];
        const frameworkCount = linkedFrameworks.length;

        return (
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg cursor-pointer hover:bg-primary-100 transition-colors">
                  <Layers className="h-4 w-4 text-primary-600" />
                  <span className="text-sm font-medium text-primary-700">
                    {t("Linked Frameworks")}: {frameworkCount}
                  </span>
                </div>
              </TooltipTrigger>
              {frameworkCount > 0 && (
                <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-white p-2">
                  <div className="space-y-1">
                    <p className="font-medium text-xs text-slate-300">{t("Linked Frameworks")}:</p>
                    {linkedFrameworks.map((fw) => (
                      <p key={fw.id} className="text-sm">{frameworkNameMap.get(fw.id) || fw.name}</p>
                    ))}
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        );
      })()}

      {/* Policy Details - Inline Editable (with permission check) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-3 sm:px-5 py-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">{t("Policy Details")}</h3>
        </div>
        <div className="p-3 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Department - Inline Dropdown (editable only with permission) */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Department")}</Label>
              {canEdit ? (
                <Select
                  value={selectedDepartmentId}
                  onValueChange={(value) => {
                    setSelectedDepartmentId(value);
                    handleInlineUpdate("departmentId", value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent>
                    {translatedDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-slate-700">{(policy.department?.id ? departmentNameMap.get(policy.department.id) : null) || policy.department?.name || "-"}</p>
              )}
            </div>

            {/* Assigned To - With Edit Button (only with edit permission) */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Assigned To")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">{(policy.assignee?.id ? userNameMap.get(policy.assignee.id) : null) || policy.assignee?.fullName || "-"}</span>
                <PermissionGate resource="qpost-compliance.governance" action="edit">
                  <Dialog open={assigneeDialogOpen} onOpenChange={setAssigneeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="p-0 gap-0 overflow-hidden">
                      <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100">
                        <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Assignee")}</DialogTitle>
                      </DialogHeader>
                      <div className="px-4 sm:px-6 py-4 sm:py-5">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Select Assignee")}</Label>
                          <p className="text-xs text-slate-400 mb-2">
                            {t("Only Department Contributors and Department Reviewers from the assigned department are shown.")}
                          </p>
                          <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t("Select assignee")} />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredAssigneeUsers.length > 0 ? (
                                filteredAssigneeUsers.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                                ))
                              ) : (
                                <div className="py-2 px-2 text-sm text-slate-500 text-center">
                                  {t("No eligible users found in this department")}
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
                        <Button variant="outline" onClick={() => setAssigneeDialogOpen(false)}>
                          {t("Cancel")}
                        </Button>
                        <Button onClick={handleSaveAssignee} disabled={!selectedAssigneeId}>{t("Save")}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </PermissionGate>
              </div>
            </div>

            {/* Approvers - With Add Button (only with edit permission) */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Approvers")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">{(policy.approver?.id ? userNameMap.get(policy.approver.id) : null) || policy.approver?.fullName || "-"}</span>
                <PermissionGate resource="qpost-compliance.governance" action="edit">
                  <Dialog open={approverDialogOpen} onOpenChange={setApproverDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="p-0 gap-0 overflow-hidden">
                      <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100">
                        <DialogTitle className="text-base font-semibold text-slate-800">{t("Add Approver")}</DialogTitle>
                      </DialogHeader>
                      <div className="px-4 sm:px-6 py-4 sm:py-5">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Select Approver")}</Label>
                          <p className="text-xs text-slate-400 mb-2">
                            {t("Only Department Reviewers from the assigned department are shown.")}
                          </p>
                          <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t("Select approver")} />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredApproverUsers.length > 0 ? (
                                filteredApproverUsers.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                                ))
                              ) : (
                                <div className="py-2 px-2 text-sm text-slate-500 text-center">
                                  {t("No Department Reviewers found in this department")}
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
                        <Button variant="outline" onClick={() => setApproverDialogOpen(false)}>
                          {t("Cancel")}
                        </Button>
                        <Button onClick={handleSaveApprover} disabled={!selectedApproverId}>{t("Save")}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </PermissionGate>
              </div>
            </div>

            {/* Recurrence - Inline Dropdown (editable only with permission) */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Recurrence")}</Label>
              {canEdit ? (
                <Select
                  value={selectedRecurrence}
                  onValueChange={(value) => {
                    setSelectedRecurrence(value);
                    handleInlineUpdate("recurrence", value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("Select recurrence")} />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-slate-700">{policy.recurrence ? t(policy.recurrence) : "-"}</p>
              )}
            </div>

            {/* Review Date - Inline Date Picker (editable only with permission) */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Review Date")}</Label>
              <div className="flex items-center gap-2">
                {canEdit ? (
                  <Input
                    type="date"
                    value={selectedReviewDate}
                    onChange={(e) => {
                      setSelectedReviewDate(e.target.value);
                      handleInlineUpdate("reviewDate", e.target.value);
                    }}
                    className="w-full"
                  />
                ) : (
                  <p className="text-sm text-slate-700">{policy.reviewDate ? new Date(policy.reviewDate).toLocaleDateString() : "-"}</p>
                )}
              </div>
            </div>

            {/* Version - Read-only */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Version")}</Label>
              <p className="text-sm text-slate-700">{policy.version || "-"}</p>
            </div>
          </div>

          {policy.description && (
            <div className="mt-6 space-y-2">
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Description")}</Label>
              <p className="text-sm text-slate-700">{policy.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Review Section — Hidden for QPost (kept for future re-enable) */}
      {/* BEGIN HIDDEN AI REVIEW SECTION
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-slate-100">
          <Sparkles className="h-5 w-5 text-primary-600" />
          <h3 className="text-base font-semibold text-slate-800">{t("AI Review")}</h3>
        </div>
        ...AI Review content...
      </div>
      END HIDDEN AI REVIEW SECTION */}

      {/* Manual Review Section - Only show when governance has attachments */}
      {(attachments.length > 0 || linkedVaultDocuments.length > 0) && (<>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary-600" />
            <h3 className="text-base font-semibold text-slate-800">{t("Manual Review")}</h3>
            <Badge variant="outline" className="ml-2">{manualReviews.length}</Badge>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setManualReviewDialogOpen(true)}>
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {t("Add Review")}
            </Button>
          )}
        </div>
        <div className="p-3 sm:p-5">
          {manualReviews.length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Eye className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t("No reviews yet")}</p>
              <p className="text-xs text-slate-400">{t("Add a manual review to record your assessment of this document")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {manualReviews.map((review) => (
                <div key={review.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-semibold">
                        {review.reviewer.fullName?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{review.reviewer.fullName}</p>
                        <p className="text-xs text-slate-500">{new Date(review.reviewDate).toLocaleDateString()} {new Date(review.reviewDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={
                        review.status === "Approved" ? "bg-success-light text-success-dark" :
                        review.status === "Rejected" ? "bg-error-light text-error-dark" :
                        review.status === "Needs Revision" ? "bg-warning-light text-warning-dark" :
                        "bg-info-light text-info-dark"
                      }>
                        {t(review.status)}
                      </Badge>
                      {review.score !== null && (
                        <span className={`text-lg font-bold ${
                          review.score >= 80 ? "text-green-600" :
                          review.score >= 60 ? "text-yellow-600" :
                          "text-red-600"
                        }`}>
                          {review.score}%
                        </span>
                      )}
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteReviewId(review.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {review.comments && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{t("Comments")}</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{review.comments}</p>
                    </div>
                  )}
                  {review.findings && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{t("Findings")}</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{review.findings}</p>
                    </div>
                  )}
                  {review.recommendation && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{t("Recommendation")}</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{review.recommendation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Manual Review Dialog */}
      <Dialog open={manualReviewDialogOpen} onOpenChange={setManualReviewDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Add Manual Review")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Review Status")}</Label>
                <Select value={manualReviewForm.status} onValueChange={(v) => setManualReviewForm(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Reviewed">{t("Reviewed")}</SelectItem>
                    <SelectItem value="Approved">{t("Approved")}</SelectItem>
                    <SelectItem value="Rejected">{t("Rejected")}</SelectItem>
                    <SelectItem value="Needs Revision">{t("Needs Revision")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("Score")} (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder={t("Optional")}
                  value={manualReviewForm.score}
                  onChange={(e) => setManualReviewForm(prev => ({ ...prev, score: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("Comments")}</Label>
              <Textarea
                rows={3}
                placeholder={t("Add your review comments...")}
                value={manualReviewForm.comments}
                onChange={(e) => setManualReviewForm(prev => ({ ...prev, comments: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Findings")}</Label>
              <Textarea
                rows={3}
                placeholder={t("Document any findings...")}
                value={manualReviewForm.findings}
                onChange={(e) => setManualReviewForm(prev => ({ ...prev, findings: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Recommendation")}</Label>
              <Textarea
                rows={2}
                placeholder={t("Add recommendations...")}
                value={manualReviewForm.recommendation}
                onChange={(e) => setManualReviewForm(prev => ({ ...prev, recommendation: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setManualReviewDialogOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleAddManualReview} disabled={savingManualReview}>
              {savingManualReview && <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />}
              {t("Submit Review")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Review Confirmation */}
      <AlertDialog open={!!deleteReviewId} onOpenChange={(open) => !open && setDeleteReviewId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Review")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this review? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteManualReview} disabled={deletingReview}>
              {deletingReview && <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />}
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>)}

      {/* Published Section - Only show when status is Published */}
      {policy.status === "Published" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-5 py-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              {t("Published")}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {/* Download Published Document Button */}
              {(attachments.length > 0 || linkedVaultDocuments.length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (attachments.length > 0) {
                      window.open(`/api/qpost-compliance/policies/${id}/attachments/${attachments[0].id}/download`, "_blank");
                    } else if (linkedVaultDocuments.length > 0) {
                      window.open(`/api/qpost-compliance/governance-vault/${linkedVaultDocuments[0].document.id}/download`, "_blank");
                    }
                  }}
                >
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Download")}
                </Button>
              )}
              {/* Unpublish Button */}
              <PermissionGate resource="qpost-compliance.governance" action="edit">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUnpublishDialogOpen(true)}
                  className="text-orange-600 hover:text-orange-700"
                >
                  {t("Unpublish")}
                </Button>
              </PermissionGate>
            </div>
          </div>
          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Left Column - Published Info */}
              <div className="space-y-4">
                {/* Published On */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Published On")}</Label>
                  <p className="text-sm text-slate-700">
                    {(() => {
                      // Try to get stored publishedAt from localStorage, fallback to updatedAt
                      const storedPublishedAt = localStorage.getItem(`policy-publishedAt-${policy.id}`);
                      const publishDate = storedPublishedAt
                        ? new Date(storedPublishedAt)
                        : new Date(policy.updatedAt);
                      return publishDate.toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    })()}
                  </p>
                </div>

                {/* Published Document */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Published Document")}</Label>
                  {attachments.length > 0 ? (
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-slate-700">{attachments[0].fileName}</span>
                    </div>
                  ) : linkedVaultDocuments.length > 0 ? (
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                      {getFileTypeIcon(linkedVaultDocuments[0].document.fileType)}
                      <span className="text-sm font-medium text-slate-700">{linkedVaultDocuments[0].document.fileName}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">{t("No document attached")}</p>
                  )}
                </div>

                {/* Approver Details */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Approved By")}</Label>
                  {policy.approver ? (
                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <p className="text-sm font-medium text-slate-700">{(policy.approver.id ? userNameMap.get(policy.approver.id) : null) || policy.approver.fullName}</p>
                      {(() => {
                        // Find the approver in users array to get full details
                        const approverUser = translatedUsers.find(u => u.id === policy.approverId);
                        return (
                          <>
                            {approverUser?.department && (
                              <p className="text-sm text-slate-400">
                                {t("Department")}: {(approverUser.department.id ? departmentNameMap.get(approverUser.department.id) : null) || approverUser.department.name}
                              </p>
                            )}
                            {approverUser?.designation && (
                              <p className="text-sm text-slate-400">
                                {t("Designation")}: {approverUser.designation}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">-</p>
                  )}
                </div>
              </div>

              {/* Right Column - Signature */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Signature")}</Label>
                <div className="mt-1 border rounded-lg p-4 bg-white min-h-[150px] flex items-center justify-center">
                  {storedSignature ? (
                    <img
                      src={storedSignature}
                      alt={t("Signature")}
                      className="max-w-full max-h-[140px] object-contain"
                    />
                  ) : (
                    <p className="text-slate-400 text-sm">{t("Signature not available")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unpublish Confirmation Dialog */}
      <AlertDialog open={unpublishDialogOpen} onOpenChange={setUnpublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Unpublish")} {t(typeLabels[policy.documentType] || "Document")}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t("This will revert the status from Published to Approved. The document will need to be published again after any changes.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpublish} className="bg-orange-600 hover:bg-orange-700">
              {t("Unpublish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attachments Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-3 sm:px-5 py-3 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">{t("Attachments")}</h3>
        </div>
        <div className="p-3 sm:p-5">
          {isCustomerAdmin ? (
            /* Customer Admin: 3 Card Options */
            <div className="space-y-6">
              {/* 3 Option Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Option 1: Upload Existing File */}
                {(() => {
                  const hasDocument = attachments.length > 0 || linkedVaultDocuments.length > 0;
                  return (
                    <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
                      if (hasDocument) return; // Don't open if already has document
                      setUploadDialogOpen(open);
                      if (!open) {
                        setUploadFile(null);
                        setIsDragOver(false);
                      }
                    }}>
                      <DialogTrigger asChild disabled={hasDocument}>
                        <div
                          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                            hasDocument
                              ? "border-slate-100 bg-slate-50 cursor-not-allowed opacity-50"
                              : "border-slate-200 cursor-pointer hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                            hasDocument ? "bg-slate-100" : "bg-primary-50"
                          }`}>
                            <Upload className={`h-6 w-6 ${hasDocument ? "text-slate-400" : "text-primary-500"}`} />
                          </div>
                          <h3 className={`font-medium ${hasDocument ? "text-slate-400" : "text-slate-800"}`}>
                            {t("Upload Existing File")}
                          </h3>
                          <p className={`text-sm mt-1 ${hasDocument ? "text-slate-300" : "text-slate-500"}`}>
                            {hasDocument
                              ? t("Delete existing file to upload new")
                              : t("Upload document from your device")}
                          </p>
                        </div>
                      </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100">
                      <DialogTitle className="text-base font-semibold text-slate-800">{t("Upload Existing File")}</DialogTitle>
                    </DialogHeader>
                    <div className="px-4 sm:px-6 py-5 space-y-4">
                      {/* Drag and Drop Area */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                          isDragOver
                            ? "border-primary-400 bg-primary-50"
                            : "border-slate-300 hover:border-slate-400"
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileSelect}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                        />
                        <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Upload className="h-8 w-8 text-primary-500" />
                        </div>
                        <p className="text-slate-600 mb-2">
                          {t("Drag and drop your file here, or")}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleBrowseClick}
                        >
                          {t("Browse Files")}
                        </Button>
                        <p className="text-xs text-slate-400 mt-3">
                          {t("Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT")}
                        </p>
                      </div>

                      {/* Selected File Preview */}
                      {uploadFile && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          {getFileTypeIcon(uploadFile.name.split(".").pop() || "")}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{uploadFile.name}</p>
                            <p className="text-xs text-slate-400">
                              {(uploadFile.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUploadFile(null)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setUploadDialogOpen(false);
                          setUploadFile(null);
                        }}
                        disabled={uploading}
                      >
                        {t("Cancel")}
                      </Button>
                      <Button
                        onClick={handleUploadAttachment}
                        disabled={!uploadFile || uploading}
                      >
                        {uploading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ltr:mr-2 rtl:ml-2" />
                            {t("Uploading...")}
                          </>
                        ) : (
                          t("Upload")
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                  );
                })()}

                {/* Option 2: Generate Policy Using AI — HIDDEN for QPost (kept for future use) */}
                {false && (() => {
                  const hasDocument = attachments.length > 0 || linkedVaultDocuments.length > 0;
                  const hasLinkedRequirements = (policy?.requirements?.length ?? 0) > 0;
                  const isDisabled = hasDocument || !hasLinkedRequirements;
                  return (
                    <Dialog open={generatePolicyDialogOpen} onOpenChange={(open) => {
                      if (isDisabled) return;
                      setGeneratePolicyDialogOpen(open);
                      if (open) {
                        fetchTemplates();
                      }
                    }}>
                      <DialogTrigger asChild disabled={isDisabled}>
                        <div
                          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                            isDisabled
                              ? "border-slate-100 bg-slate-50 cursor-not-allowed opacity-50"
                              : "border-slate-200 cursor-pointer hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                            isDisabled ? "bg-slate-100" : "bg-purple-100"
                          }`}>
                            <Sparkles className={`h-6 w-6 ${isDisabled ? "text-slate-400" : "text-purple-600"}`} />
                          </div>
                          <h3 className={`font-medium ${isDisabled ? "text-slate-400" : "text-slate-800"}`}>
                            {t("Generate Policy Using AI")}
                          </h3>
                          <p className={`text-sm mt-1 ${isDisabled ? "text-slate-300" : "text-slate-500"}`}>
                            {hasDocument
                              ? t("Delete existing file to use AI")
                              : !hasLinkedRequirements
                              ? t("Link controls first to generate")
                              : t("Create document with AI assistance")}
                          </p>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                        <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0">
                          <DialogTitle className="text-base font-semibold text-slate-800">{t("Generate Policy Using AI")}</DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Policy Name")}</Label>
                              <Input value={translatedPolicy?.name || policy?.name || ""} disabled className="bg-slate-50" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Document Type")}</Label>
                              <Input value={t(typeLabels[policy?.documentType] || "Policy")} disabled className="bg-slate-50" />
                            </div>
                          </div>

                          {/* Template Selection */}
                          <div>
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                              {t("Select Template")} <span className="text-red-500">*</span>
                              <span className="text-xs text-slate-400 normal-case tracking-normal">(.docx only)</span>
                            </Label>
                            <div className="mt-2 space-y-3">
                              {templates.length > 0 ? (
                                <div className="border rounded-lg max-h-40 overflow-y-auto">
                                  {templates.map((template) => (
                                    <div
                                      key={template.id}
                                      className={`p-3 cursor-pointer border-b last:border-b-0 hover:bg-slate-50 ${
                                        selectedTemplateId === template.id ? "bg-primary-50 border-primary-200" : ""
                                      }`}
                                      onClick={() => setSelectedTemplateId(template.id)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            checked={selectedTemplateId === template.id}
                                            onChange={() => setSelectedTemplateId(template.id)}
                                            className="text-primary-600"
                                          />
                                          <FileText className="h-4 w-4 text-primary-500" />
                                          <span className="font-medium text-sm text-slate-800">{template.name}</span>
                                        </div>
                                        <span className="text-xs text-slate-500">
                                          {template.fileSize ? `${(template.fileSize / 1024).toFixed(1)} KB` : ""}
                                        </span>
                                      </div>
                                      {template.uploadedBy && (
                                        <p className="text-xs text-slate-400 ltr:ml-6 rtl:mr-6 mt-1">
                                          {t("Uploaded by")}: {template.uploadedBy.fullName}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="border-2 border-dashed rounded-lg p-4 text-center text-slate-500">
                                  <FileText className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                                  <p className="text-sm">{t("No templates available")}</p>
                                  <p className="text-xs text-slate-400">{t("Upload a .docx template below")}</p>
                                </div>
                              )}

                              {/* Upload New Template */}
                              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                                <Label className="text-sm font-medium text-slate-700">{t("Or upload a new template")}</Label>
                                <div className="mt-2 flex gap-2">
                                  <Input
                                    type="file"
                                    accept=".docx"
                                    onChange={(e) => setNewTemplateFile(e.target.files?.[0] || null)}
                                    className="flex-1"
                                  />
                                </div>
                                {newTemplateFile && (
                                  <div className="mt-2 flex gap-2 items-end">
                                    <div className="flex-1">
                                      <Label className="text-xs">{t("Template Name")}</Label>
                                      <Input
                                        value={newTemplateName}
                                        onChange={(e) => setNewTemplateName(e.target.value)}
                                        placeholder={newTemplateFile.name.replace(/\.[^/.]+$/, "")}
                                        className="mt-1"
                                      />
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={handleUploadTemplate}
                                      disabled={uploadingTemplate}
                                    >
                                      {uploadingTemplate ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                      ) : (
                                        <Upload className="h-4 w-4" />
                                      )}
                                      <span className="ltr:ml-1 rtl:mr-1">{t("Upload")}</span>
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Linked Requirements */}
                          <div>
                            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Linked Controls")} ({policy?.requirements?.length || 0})</Label>
                            <div className="mt-2 border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
                              {policy?.requirements && policy.requirements.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                  {policy.requirements.map((pr) => (
                                    <div key={pr.requirement.id} className="p-2 hover:bg-slate-50">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs font-mono">
                                          {pr.requirement.code}
                                        </Badge>
                                        <span className="text-sm">{requirementNameMap.get(pr.requirement.id) || pr.requirement.name}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-4 text-center text-slate-500">
                                  {t("No controls linked to this policy")}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                            <p className="text-sm text-primary-800">
                              <strong>{t("Note")}:</strong> {t("The AI will use the selected template and linked controls to generate a comprehensive policy document.")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
                          <Button variant="outline" onClick={() => {
                            setGeneratePolicyDialogOpen(false);
                            setSelectedTemplateId("");
                            setNewTemplateFile(null);
                            setNewTemplateName("");
                          }}>
                            {t("Cancel")}
                          </Button>
                          <Button
                            onClick={handleGeneratePolicy}
                            disabled={generatingPolicy || !hasLinkedRequirements || !selectedTemplateId}
                          >
                            {generatingPolicy ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ltr:mr-2 rtl:ml-2" />
                                {t("Generating...")}
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {t("Generate Policy")}
                              </>
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  );
                })()}

                {/* Option 3: Link from Vault */}
                {(() => {
                  const hasDocument = attachments.length > 0 || linkedVaultDocuments.length > 0;
                  return (
                    <Dialog open={linkFromVaultDialogOpen} onOpenChange={(open) => {
                      if (hasDocument) return; // Don't open if already has document
                      setLinkFromVaultDialogOpen(open);
                      if (!open) {
                        setSelectedVaultDocIds([]);
                        setVaultSearchQuery("");
                      }
                    }}>
                      <DialogTrigger asChild disabled={hasDocument}>
                        <div
                          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                            hasDocument
                              ? "border-slate-100 bg-slate-50 cursor-not-allowed opacity-50"
                              : "border-slate-200 cursor-pointer hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                            hasDocument ? "bg-slate-100" : "bg-green-100"
                          }`}>
                            <Link2 className={`h-6 w-6 ${hasDocument ? "text-slate-400" : "text-green-600"}`} />
                          </div>
                          <h3 className={`font-medium ${hasDocument ? "text-slate-400" : "text-slate-800"}`}>
                            {t("Link from Document Management")}
                          </h3>
                          <p className={`text-sm mt-1 ${hasDocument ? "text-slate-300" : "text-slate-500"}`}>
                            {hasDocument
                              ? t("Delete existing file to link")
                              : t("Link existing vault documents")}
                          </p>
                        </div>
                      </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0">
                      <DialogTitle className="text-base font-semibold text-slate-800">{t("Link from Document Management")}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder={t("Search documents...")}
                          value={vaultSearchQuery}
                          onChange={(e) => setVaultSearchQuery(e.target.value)}
                          className="ltr:pl-10 rtl:pr-10"
                        />
                      </div>

                      {/* Document List */}
                      <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                        {filteredVaultDocuments.length === 0 ? (
                          <div className="py-10 text-center">
                            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                              <FileText className="h-6 w-6 text-primary-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-600 mb-1">{t("No documents found in vault")}</p>
                            <p className="text-xs text-slate-400">{t("Upload documents to the vault first")}</p>
                          </div>
                        ) : (
                          <div className="divide-y">
                            {filteredVaultDocuments.map((doc) => {
                              const isSelected = selectedVaultDocIds.includes(doc.id);
                              const isAlreadyLinked = doc.linkedGovernanceIds.includes(id);

                              return (
                                <div
                                  key={doc.id}
                                  className={`flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer ${
                                    isSelected ? "bg-primary-50" : ""
                                  } ${isAlreadyLinked ? "opacity-50" : ""}`}
                                  onClick={() => !isAlreadyLinked && handleVaultDocSelect(doc.id)}
                                >
                                  {/* Checkbox */}
                                  <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                                    isSelected
                                      ? "bg-primary border-primary"
                                      : "border-slate-300"
                                  } ${isAlreadyLinked ? "bg-slate-200 border-slate-200" : ""}`}>
                                    {(isSelected || isAlreadyLinked) && (
                                      <Check className="h-3 w-3 text-white" />
                                    )}
                                  </div>

                                  {/* File Icon */}
                                  {getFileTypeIcon(doc.type)}

                                  {/* Document Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800 truncate">{doc.name}</p>
                                    <p className="text-xs text-slate-500">
                                      {doc.documentId} • {doc.type.toUpperCase()} • {new Date(doc.uploadedAt).toLocaleDateString()}
                                    </p>
                                  </div>

                                  {/* Already Linked Badge */}
                                  {isAlreadyLinked && (
                                    <Badge variant="secondary" className="text-xs">
                                      {t("Already Linked")}
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Selected Count */}
                      {selectedVaultDocIds.length > 0 && (
                        <p className="text-sm text-slate-600">
                          {selectedVaultDocIds.length} {t("document(s) selected")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setLinkFromVaultDialogOpen(false);
                          setSelectedVaultDocIds([]);
                          setVaultSearchQuery("");
                        }}
                        disabled={linkingVaultDocs}
                      >
                        {t("Cancel")}
                      </Button>
                      <Button
                        onClick={handleLinkVaultDocuments}
                        disabled={selectedVaultDocIds.length === 0 || linkingVaultDocs}
                      >
                        {linkingVaultDocs ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ltr:mr-2 rtl:ml-2" />
                            {t("Linking...")}
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                            {t("Link Artifact")}
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                    </Dialog>
                  );
                })()}
              </div>

              {/* Uploaded Attachments */}
              {attachments.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">{t("Uploaded Files")}</h4>
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg"
                      >
                        {/* File Icon */}
                        {getFileTypeIcon(att.fileType)}

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-primary truncate">{att.fileName}</p>
                          <p className="text-xs text-slate-500">
                            By bts, {new Date(att.uploadedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "2-digit",
                              year: "numeric",
                            })}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`/api/qpost-compliance/policies/${id}/attachments/${att.id}/download`, "_blank")}
                            title={t("Download")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteAttachment(att.id)}
                            title={t("Delete")}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Vault Documents */}
              {linkedVaultDocuments.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">{t("Linked from Vault")}</h4>
                  <div className="space-y-2">
                    {linkedVaultDocuments.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg"
                      >
                        {/* File Icon */}
                        {getFileTypeIcon(link.document.fileType)}

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-primary truncate">{link.document.fileName}</p>
                          <p className="text-xs text-slate-500">
                            By bts, {new Date(link.document.uploadedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "2-digit",
                              year: "numeric",
                            })}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`/api/qpost-compliance/governance-vault/${link.document.id}/download`, "_blank")}
                            title={t("Download")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnlinkVaultDocument(link.document.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* GRC Admin / Other roles: Original simple view */
            <>
              <PermissionGate resource="qpost-compliance.governance" action="edit">
                <div className="mb-4">
                  <Button size="sm">
                    <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Upload")}
                  </Button>
                </div>
              </PermissionGate>
              {attachments.length === 0 && linkedVaultDocuments.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-6 w-6 text-primary-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">{t("No attachments uploaded")}</p>
                  <p className="text-xs text-slate-400">{t("Upload or link documents to get started")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Uploaded Attachments */}
                  {attachments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">{t("Uploaded Files")}</h4>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("File Name")}</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Type")}</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Uploaded")}</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5">{t("Actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attachments.map((att) => (
                            <TableRow key={att.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                              <TableCell className="py-3 ps-5 text-sm font-medium text-slate-800">{att.fileName}</TableCell>
                              <TableCell className="py-3 text-sm text-slate-700">{att.fileType}</TableCell>
                              <TableCell className="py-3 text-sm text-slate-700">{new Date(att.uploadedAt).toLocaleDateString()}</TableCell>
                              <TableCell className="py-3 pe-5">
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                                    onClick={() => window.open(`/api/qpost-compliance/policies/${id}/attachments/${att.id}/download`, "_blank")}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                  <PermissionGate resource="qpost-compliance.governance" action="delete">
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </PermissionGate>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Linked Vault Documents */}
                  {linkedVaultDocuments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">{t("Linked from Vault")}</h4>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("File Name")}</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Type")}</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Uploaded")}</TableHead>
                            <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5">{t("Actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {linkedVaultDocuments.map((link) => (
                            <TableRow key={link.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                              <TableCell className="py-3 ps-5 text-sm font-medium text-slate-800">{link.document.fileName}</TableCell>
                              <TableCell className="py-3 text-sm text-slate-700">{link.document.fileType}</TableCell>
                              <TableCell className="py-3 text-sm text-slate-700">{new Date(link.document.uploadedAt).toLocaleDateString()}</TableCell>
                              <TableCell className="py-3 pe-5">
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                                    onClick={() => window.open(`/api/qpost-compliance/governance-vault/${link.document.id}/download`, "_blank")}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Signature Publish Dialog */}
      <Dialog open={signatureDialogOpen} onOpenChange={(open) => {
        setSignatureDialogOpen(open);
        if (!open) clearSignature();
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t(typeLabels[policy.documentType] || "Policy")} {t("signature Publish")}</DialogTitle>
          </DialogHeader>
          <div className="px-4 sm:px-6 py-5 space-y-4">
            <p className="text-sm text-slate-500">
              {t("Please sign below to publish this")} {t(typeLabels[policy.documentType] || "document").toLowerCase()}.
            </p>
            <div className="border border-slate-200 rounded-lg p-2 bg-white">
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className="w-full border border-dashed border-slate-300 rounded cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            <div className="flex justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSignature}
                disabled={!hasSignature}
              >
                {t("Clear Signature")}
              </Button>
              <span className="text-xs text-slate-400">
                {t("Draw your signature above")}
              </span>
            </div>
          </div>
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setSignatureDialogOpen(false);
              clearSignature();
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handlePublish} disabled={!hasSignature}>
              {t("Publish")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <div className="flex flex-wrap border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap ${
              activeTab === tab.id
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== null && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ltr:ml-1 rtl:mr-1">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "requirements" && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-5 py-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Linked Controls")}</h3>
            <PermissionGate resource="qpost-compliance.governance" action="edit">
              <Dialog open={linkRequirementDialogOpen} onOpenChange={(open) => {
                setLinkRequirementDialogOpen(open);
                if (!open) {
                  setSelectedRequirementIds([]);
                  setRequirementSearchQuery("");
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Link Control")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                  <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0">
                    <DialogTitle className="text-base font-semibold text-slate-800">{t("Link Control")}</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
                    {/* Search input */}
                    <div className="relative">
                      <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder={t("Search by code or name")}
                        value={requirementSearchQuery}
                        onChange={(e) => setRequirementSearchQuery(e.target.value)}
                        className="ltr:pl-9 rtl:pr-9 ltr:pr-9 rtl:pl-9 bg-slate-50 border-slate-200 rounded-lg"
                      />
                      {requirementSearchQuery && (
                        <button
                          onClick={() => setRequirementSearchQuery("")}
                          className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Requirement cards list */}
                    <div className="border border-slate-200 rounded-lg max-h-[350px] overflow-y-auto">
                      {getFilteredRequirementsForLinking().map((req) => (
                        <div
                          key={req.id}
                          className={`flex items-start gap-3 p-3.5 border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-slate-50/60 transition-colors ${
                            selectedRequirementIds.includes(req.id) ? "bg-primary-50/50" : ""
                          }`}
                          onClick={() => {
                            setSelectedRequirementIds((prev) =>
                              prev.includes(req.id)
                                ? prev.filter((rid) => rid !== req.id)
                                : [...prev, req.id]
                            );
                          }}
                        >
                          <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                            <Checkbox
                              checked={selectedRequirementIds.includes(req.id)}
                              onCheckedChange={() => {
                                setSelectedRequirementIds((prev) =>
                                  prev.includes(req.id)
                                    ? prev.filter((rid) => rid !== req.id)
                                    : [...prev, req.id]
                                );
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-slate-800">
                                {req.code} : {req.name}
                              </span>
                              {req.framework && (
                                <Badge className="bg-slate-100 text-slate-600 text-xs shrink-0">
                                  {req.framework.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {getFilteredRequirementsForLinking().length === 0 && (
                        <div className="py-10 text-center">
                          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                            <Search className="h-6 w-6 text-primary-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600 mb-1">
                            {requirementSearchQuery.trim()
                              ? t("No controls found matching your filters")
                              : t("No available controls to link")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
                    <Button
                      onClick={handleLinkRequirement}
                      disabled={selectedRequirementIds.length === 0}
                    >
                      {t("Link Control")}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </PermissionGate>
          </div>
          <div className="p-3 sm:p-5">
            {linkedRequirements.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                  <Link2 className="h-6 w-6 text-primary-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">{t("No controls linked to this")} {t(typeLabels[policy.documentType] || "policy").toLowerCase()}</p>
                <p className="text-xs text-slate-400">{t("Link controls to track compliance")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Code")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Framework")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedRequirements.map((pr) => (
                    <TableRow
                      key={pr.requirement.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      <TableCell className="py-3 ps-5 text-sm font-medium text-slate-800">{pr.requirement.code}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700">{requirementNameMap.get(pr.requirement.id) || pr.requirement.name}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700">{pr.requirement.framework?.name || "-"}</TableCell>
                      <TableCell className="py-3 pe-5">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                            onClick={() => router.push(`/qpost-compliance/requirements/${pr.requirement.id}`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <PermissionGate resource="qpost-compliance.governance" action="edit">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlinkRequirement(pr.requirement.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "exceptions" && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-5 py-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Linked Exception")}</h3>
            {isCustomerAdmin && (
              <Dialog open={linkExceptionDialogOpen} onOpenChange={setLinkExceptionDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Link Exception")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0 overflow-hidden">
                  <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100">
                    <DialogTitle className="text-base font-semibold text-slate-800">{t("Link Exception")}</DialogTitle>
                  </DialogHeader>
                  <div className="px-4 sm:px-6 py-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Select Exception")}</Label>
                      <Select value={selectedExceptionId} onValueChange={setSelectedExceptionId}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("Select an exception")} />
                        </SelectTrigger>
                        <SelectContent>
                          {translatedExceptions
                            .filter((e) => !linkedExceptions.find((le) => le.exception.id === e.id))
                            .map((exception) => (
                              <SelectItem key={exception.id} value={exception.id}>
                                {exception.exceptionCode} - {exception.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
                    <Button variant="outline" onClick={() => setLinkExceptionDialogOpen(false)}>
                      {t("Cancel")}
                    </Button>
                    <Button onClick={handleLinkException} disabled={!selectedExceptionId}>
                      {t("Link")}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="p-3 sm:p-5">
            {linkedExceptions.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="h-6 w-6 text-primary-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">{t("No exceptions linked to this")} {t(typeLabels[policy.documentType] || "policy").toLowerCase()}</p>
                <p className="text-xs text-slate-400">{t("Link exceptions to track deviations")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Exception Code")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Category")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                    {isCustomerAdmin && <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5">{t("Actions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedExceptions.map((pe) => (
                    <TableRow
                      key={pe.exception.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      <TableCell className="py-3 ps-5 text-sm font-medium text-slate-800">{pe.exception.exceptionCode}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700">{pe.exception.name}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700">{pe.exception.category}</TableCell>
                      <TableCell className="py-3">
                        <Badge className={statusColors[pe.exception.status] || "bg-slate-100 text-slate-600"}>
                          {t(pe.exception.status)}
                        </Badge>
                      </TableCell>
                      {isCustomerAdmin && (
                        <TableCell className="py-3 pe-5">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                              onClick={() => router.push(`/qpost-compliance/exceptions/${pe.exception.id}`)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlinkException(pe.exception.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">{t("Linked Documents")}</h3>
          </div>
          <div className="p-5">
            {attachments.length === 0 && linkedVaultDocuments.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                  <FileText className="h-6 w-6 text-primary-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 mb-1">{t("No documents linked to this")} {t(typeLabels[policy.documentType] || "policy").toLowerCase()}</p>
                <p className="text-xs text-slate-400">{t("Documents linked to this policy will appear here")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Uploaded Attachments */}
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg"
                  >
                    {getFileTypeIcon(att.fileType)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary truncate">{att.fileName}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(att.uploadedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(`/api/qpost-compliance/policies/${id}/attachments/${att.id}/download`, "_blank")}
                        title={t("Download")}
                      >
                        <Download className="h-4 w-4 text-primary" />
                      </Button>
                      <PermissionGate resource="qpost-compliance.governance" action="edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="text-slate-600 hover:text-red-600"
                        >
                          {t("Unlink")}
                        </Button>
                      </PermissionGate>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        {t("Active")}
                      </Badge>
                    </div>
                  </div>
                ))}

                {/* Vault Linked Documents */}
                {linkedVaultDocuments.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg"
                  >
                    {getFileTypeIcon(link.document.fileType)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary truncate">{link.document.fileName}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(link.document.uploadedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(`/api/qpost-compliance/governance-vault/${link.document.id}/download`, "_blank")}
                        title={t("Download")}
                      >
                        <Download className="h-4 w-4 text-primary" />
                      </Button>
                      <PermissionGate resource="qpost-compliance.governance" action="edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkVaultDocument(link.document.id)}
                          className="text-slate-600 hover:text-red-600"
                        >
                          {t("Unlink")}
                        </Button>
                      </PermissionGate>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        {link.document.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

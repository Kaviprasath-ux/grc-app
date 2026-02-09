"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ChevronLeft,
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
  policyControls?: Array<{
    control: {
      id: string;
      controlCode: string;
      name: string;
      status: string;
      domain?: { name: string } | null;
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
  linkedDocuments?: Array<{
    id: string;
    name: string;
    type: string;
    code: string;
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

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description?: string;
  status: string;
  entities?: string;
  functionalGrouping?: string;
  domain?: { id: string; name: string } | null;
  framework?: { id: string; name: string } | null;
}

interface ControlDomain {
  id: string;
  name: string;
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
  "Not Uploaded": "bg-gray-100 text-gray-800",
  Draft: "bg-yellow-100 text-yellow-800",
  "Under Review": "bg-blue-100 text-blue-800",
  Approved: "bg-green-100 text-green-800",
  Published: "bg-purple-100 text-purple-800",
  "Needs Review": "bg-orange-100 text-orange-800",
  Archived: "bg-gray-100 text-gray-800",
};

const aiStatusColors: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-green-100 text-green-800",
  Failed: "bg-red-100 text-red-800",
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
  const id = params.id as string;
  const { data: session } = useSession();
  const currentUserId = session?.user?.id as string | undefined;
  const { canEdit, canApprove, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.governance');
  const isCustomerAdmin = useHasRole('CustomerAdministrator');
  const { t } = useLanguage();

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("controls");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [linkControlDialogOpen, setLinkControlDialogOpen] = useState(false);
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

  // AI Review Details Modal state
  const [aiReviewDetailsOpen, setAiReviewDetailsOpen] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<AIReviewResponse | null>(null);

  // AI Review Hook - orchestrates ingest → review flow
  const {
    phase: aiReviewPhase,
    progress: aiReviewProgress,
    error: aiReviewError,
    startAIReview,
    reset: resetAIReview,
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
  const [availableControls, setAvailableControls] = useState<Control[]>([]);
  const [controlDomains, setControlDomains] = useState<ControlDomain[]>([]);
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [controlSearchQuery, setControlSearchQuery] = useState("");
  const [controlDomainFilter, setControlDomainFilter] = useState("all");
  const [controlFunctionalGroupingFilter, setControlFunctionalGroupingFilter] = useState("all");
  const [controlFrameworkFilter, setControlFrameworkFilter] = useState("all");
  const [availableExceptions, setAvailableExceptions] = useState<Array<{
    id: string;
    exceptionCode: string;
    name: string;
    status: string;
    category: string;
  }>>([]);
  const [selectedExceptionId, setSelectedExceptionId] = useState("");

  const fetchPolicy = useCallback(async () => {
    try {
      const response = await fetch(`/api/policies/${id}`);
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
      }
    } catch (error) {
      console.error("Error fetching policy:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [frameworksRes, departmentsRes, usersRes, controlsRes, exceptionsRes, controlDomainsRes] = await Promise.all([
        fetch("/api/frameworks"),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/controls?limit=1000"),
        fetch("/api/exceptions"),
        fetch("/api/control-domains"),
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
      if (controlsRes.ok) {
        const data = await controlsRes.json();
        setAvailableControls(Array.isArray(data) ? data : data.data || []);
      }
      if (exceptionsRes.ok) {
        const data = await exceptionsRes.json();
        setAvailableExceptions(Array.isArray(data) ? data : data.data || []);
      }
      if (controlDomainsRes.ok) {
        const data = await controlDomainsRes.json();
        setControlDomains(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  const fetchVaultDocuments = useCallback(async () => {
    try {
      const response = await fetch("/api/governance-vault");
      if (response.ok) {
        const data = await response.json();
        setVaultDocuments(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching vault documents:", error);
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
    fetchReferenceData();
    fetchVaultDocuments();
  }, [fetchPolicy, fetchReferenceData, fetchVaultDocuments]);

  // Filtered user lists for role-based assignment restrictions
  // Assignees: Only DepartmentContributor and DepartmentReviewer from the selected department
  const filteredAssigneeUsers = users.filter((u) => {
    // Must be in the same department as the governance document
    if (selectedDepartmentId && u.departmentId !== selectedDepartmentId) return false;
    // Must have DepartmentContributor or DepartmentReviewer role
    return u.userRoles?.some((ur) =>
      ["DepartmentContributor", "DepartmentReviewer"].includes(ur.role?.name)
    );
  });

  // Approvers: Only DepartmentReviewer from the selected department
  const filteredApproverUsers = users.filter((u) => {
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
    try {
      const response = await fetch(`/api/policies/${id}`, {
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
        setEditDialogOpen(false);
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error updating policy:", error);
    }
  };

  const handleInlineUpdate = async (field: string, value: string) => {
    try {
      const response = await fetch(`/api/policies/${id}`, {
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
      const response = await fetch(`/api/policies/${id}/approve`, {
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
      const response = await fetch(`/api/policies/${id}`, {
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

  const handleLinkControl = async () => {
    if (selectedControlIds.length === 0) return;

    try {
      // Link controls one by one (API supports single control linking)
      for (const controlId of selectedControlIds) {
        await fetch(`/api/policies/${id}/controls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ controlId }),
        });
      }

      setLinkControlDialogOpen(false);
      setSelectedControlIds([]);
      setControlSearchQuery("");
      setControlDomainFilter("all");
      setControlFunctionalGroupingFilter("all");
      setControlFrameworkFilter("all");
      fetchPolicy();
    } catch (error) {
      console.error("Error linking control:", error);
    }
  };

  // Functional grouping options for filter
  const functionalGroupings = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];

  // Filter controls for the link dialog
  const getFilteredControlsForLinking = () => {
    return availableControls
      .filter((c) => !linkedControls.find((lc) => lc.control.id === c.id))
      .filter((c) => {
        // Search filter
        if (controlSearchQuery.trim()) {
          const query = controlSearchQuery.toLowerCase();
          const matchesCode = c.controlCode?.toLowerCase().includes(query);
          const matchesName = c.name?.toLowerCase().includes(query);
          if (!matchesCode && !matchesName) return false;
        }
        // Domain filter
        if (controlDomainFilter !== "all" && c.domain?.id !== controlDomainFilter) {
          return false;
        }
        // Functional grouping filter
        if (controlFunctionalGroupingFilter !== "all" && c.functionalGrouping !== controlFunctionalGroupingFilter) {
          return false;
        }
        // Framework filter
        if (controlFrameworkFilter !== "all" && c.framework?.id !== controlFrameworkFilter) {
          return false;
        }
        return true;
      });
  };

  const handleUnlinkControl = async (controlId: string) => {
    try {
      const response = await fetch(`/api/policies/${id}/controls/${controlId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error unlinking control:", error);
    }
  };

  const handleLinkException = async () => {
    if (!selectedExceptionId) return;

    try {
      const response = await fetch(`/api/policies/${id}/exceptions`, {
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
      const response = await fetch(`/api/policies/${id}/exceptions/${exceptionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error unlinking exception:", error);
    }
  };

  // Trigger AI Review using the new hook (handles ingest → review flow)
  const handleTriggerAIReview = () => {
    startAIReview();
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
    // Validate linked controls
    if (!policy?.policyControls || policy.policyControls.length === 0) {
      toast.error("Please link controls to this policy first");
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
      console.log("[Generate Policy] Linked Controls:", policy.policyControls.length);
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
        toast.success(`Policy generated successfully! Used ${result.controlsUsed} controls.`);
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
      const formData = new FormData();
      formData.append("file", uploadFile);

      const response = await fetch(`/api/policies/${id}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setUploadDialogOpen(false);
        setUploadFile(null);

        // Auto-transition to Draft status when first attachment is uploaded
        // Also set approver = assignee if not already set
        if (policy?.status === "Not Uploaded") {
          const updateData: Record<string, string | null> = { status: "Draft" };

          // Auto-set approver to assignee if approver is not set
          if (!policy.approverId && policy.assigneeId) {
            updateData.approverId = policy.assigneeId;
          }

          await fetch(`/api/policies/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updateData),
          });
        }

        fetchPolicy(); // Refresh policy data including attachments
      } else {
        const error = await response.json();
        console.error("Upload failed:", error);
      }
    } catch (error) {
      console.error("Error uploading attachment:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/policies/${id}/attachments?attachmentId=${attachmentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchPolicy(); // Refresh policy data
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
          await fetch(`/api/governance-vault/${docId}/link`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ governanceIds: newLinkedIds }),
          });
        }
      }

      // Auto-transition to Draft status when document is linked
      if (policy?.status === "Not Uploaded") {
        await fetch(`/api/policies/${id}`, {
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
      // First, fetch the current vault document to get its linked policies
      const response = await fetch(`/api/governance-vault/${vaultDocId}`);
      if (response.ok) {
        const vaultDoc = await response.json();
        // Remove current policy from linked governance IDs
        const currentLinkedIds = vaultDoc.linkedGovernanceIds || [];
        const newLinkedIds = currentLinkedIds.filter((gid: string) => gid !== id);

        await fetch(`/api/governance-vault/${vaultDocId}/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ governanceIds: newLinkedIds }),
        });

        fetchVaultDocuments();
        fetchPolicy();
      }
    } catch (error) {
      console.error("Error unlinking vault document:", error);
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
      <div className="w-8 h-8 bg-gray-400 rounded flex items-center justify-center">
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

      const response = await fetch(`/api/policies/${id}`, {
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
      const response = await fetch(`/api/policies/${id}`, {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          {t("Governance document not found")}
        </div>
      </div>
    );
  }

  const linkedControls = policy.policyControls || [];
  const linkedExceptions = policy.policyExceptions || [];
  const attachments = policy.attachments || [];
  const linkedDocuments = policy.linkedDocuments || [];
  const linkedVaultDocuments = policy.vaultDocumentLinks || [];

  // Derive linked frameworks from policyControls -> control -> framework
  const linkedFrameworksFromControls = linkedControls
    .filter((pc) => pc.control.framework)
    .map((pc) => pc.control.framework!)
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
      id: "controls",
      label: t("Linked Control"),
      icon: Shield,
      count: linkedControls.length,
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
      count: linkedDocuments.length + linkedVaultDocuments.length,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Back Button and Breadcrumb */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("Back")}
        </Button>
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <Link href="/compliance/governance" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Governance")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{policy.code}</span>
        </nav>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">
          {/* Approve Button - CustomerAdmin or assigned Approver can see when status is Draft */}
          {canShowApproveButton && (
            <Button variant="outline" onClick={handleApprove}>
              <Check className="h-4 w-4 mr-2" />
              {t("Approve")}
            </Button>
          )}

          {/* Publish Button - Only when Approved, visible to Assignee or CustomerAdmin */}
          {canShowPublishButton && (
            <Button onClick={openSignatureDialog}>
              <Check className="h-4 w-4 mr-2" />
              {t("Publish")}
            </Button>
          )}

          {/* AI Review Buttons - Requires edit permission */}
          <PermissionGate resource="compliance.governance" action="edit">
            {/* AI Review in progress via hook */}
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
          </PermissionGate>

          {/* Edit Button - Only show if user can edit */}
          <PermissionGate resource="compliance.governance" action="edit">
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Edit className="h-4 w-4 mr-2" />
                  {t("Edit")}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("Edit")} {t(typeLabels[policy.documentType])}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2">
                  <Label>{t("Name")}</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label>{t("Description")}</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div>
                  <Label>{t("Type")}</Label>
                  <Select
                    value={editForm.documentType}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, documentType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Policy">{t("Policy")}</SelectItem>
                      <SelectItem value="Standard">{t("Standard")}</SelectItem>
                      <SelectItem value="Procedure">{t("Procedure")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Status")}</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, status: value })
                    }
                  >
                    <SelectTrigger>
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
                <div>
                  <Label>{t("Version")}</Label>
                  <Input
                    value={editForm.version}
                    onChange={(e) =>
                      setEditForm({ ...editForm, version: e.target.value })
                    }
                    placeholder={t("e.g., 1.0")}
                  />
                </div>
                <div>
                  <Label>{t("Recurrence")}</Label>
                  <Select
                    value={editForm.recurrence}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, recurrence: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select recurrence")} />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Framework")}</Label>
                  <Select
                    value={editForm.frameworkId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, frameworkId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select framework")} />
                    </SelectTrigger>
                    <SelectContent>
                      {frameworks.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Department")}</Label>
                  <Select
                    value={editForm.departmentId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, departmentId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("Select department")} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Effective Date")}</Label>
                  <Input
                    type="date"
                    value={editForm.effectiveDate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, effectiveDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("Review Date")}</Label>
                  <Input
                    type="date"
                    value={editForm.reviewDate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, reviewDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  {t("Cancel")}
                </Button>
                <Button onClick={handleSave}>{t("Save Changes")}</Button>
              </div>
            </DialogContent>
          </Dialog>
          </PermissionGate>
        </div>
      </div>

      {/* Policy Name and Status */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{policy.name}</h1>
          <Badge className={statusColors[policy.status] || "bg-gray-100"}>
            {policy.status}
          </Badge>
        </div>
        <p className="text-slate-400">{policy.code}</p>
      </div>


      {/* Status Workflow Steps - Visual display of current state */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {STATUS_WORKFLOW.map((step, index) => {
              // Determine step state based on status
              const isStepActive =
                (step.key === "Upload" && stepStates.upload) ||
                (step.key === "Draft" && stepStates.draft) ||
                (step.key === "Publish" && stepStates.publish);

              // Determine if connecting line should be green
              const isLineGreen =
                (index === 0 && stepStates.upload) ||
                (index === 1 && stepStates.draft);

              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-colors ${
                      isStepActive
                        ? "bg-green-100 text-green-800"
                        : "bg-muted text-slate-400"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{t(step.label)}</span>
                  </div>
                  {index < STATUS_WORKFLOW.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 ${
                      isLineGreen ? "bg-green-500" : "bg-muted"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Linked Frameworks Indicator */}
      {(() => {
        // Use frameworks derived from policyControls, fallback to direct framework field
        const linkedFrameworks: Array<{ id: string; name: string }> =
          linkedFrameworksFromControls.length > 0
            ? linkedFrameworksFromControls
            : policy.framework
            ? [policy.framework]
            : [];
        const frameworkCount = linkedFrameworks.length;

        return (
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                  <Layers className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    {t("Linked Frameworks")}: {frameworkCount}
                  </span>
                </div>
              </TooltipTrigger>
              {frameworkCount > 0 && (
                <TooltipContent side="bottom" className="max-w-xs bg-slate-800 text-white p-2">
                  <div className="space-y-1">
                    <p className="font-medium text-xs text-slate-300">{t("Linked Frameworks")}:</p>
                    {linkedFrameworks.map((fw) => (
                      <p key={fw.id} className="text-sm">{fw.name}</p>
                    ))}
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        );
      })()}

      {/* Policy Details - Inline Editable (with permission check) */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Policy Details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {/* Department - Inline Dropdown (editable only with permission) */}
            <div>
              <Label className="text-slate-400 text-sm">{t("Department")}</Label>
              {canEdit ? (
                <Select
                  value={selectedDepartmentId}
                  onValueChange={(value) => {
                    setSelectedDepartmentId(value);
                    handleInlineUpdate("departmentId", value);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium mt-1">{policy.department?.name || "-"}</p>
              )}
            </div>

            {/* Assigned To - With Edit Button (only with edit permission) */}
            <div>
              <Label className="text-slate-400 text-sm">{t("Assigned To")}</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-medium">{policy.assignee?.fullName || "-"}</span>
                <PermissionGate resource="compliance.governance" action="edit">
                  <Dialog open={assigneeDialogOpen} onOpenChange={setAssigneeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("Edit Assignee")}</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <Label>{t("Select Assignee")}</Label>
                        <p className="text-xs text-slate-500 mt-1 mb-2">
                          {t("Only Department Contributors and Department Reviewers from the assigned department are shown.")}
                        </p>
                        <Select value={selectedAssigneeId} onValueChange={setSelectedAssigneeId}>
                          <SelectTrigger className="mt-2">
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
                      <div className="flex justify-end gap-2">
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
            <div>
              <Label className="text-slate-400 text-sm">{t("Approvers")}</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-medium">{policy.approver?.fullName || "-"}</span>
                <PermissionGate resource="compliance.governance" action="edit">
                  <Dialog open={approverDialogOpen} onOpenChange={setApproverDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("Add Approver")}</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <Label>{t("Select Approver")}</Label>
                        <p className="text-xs text-slate-500 mt-1 mb-2">
                          {t("Only Department Reviewers from the assigned department are shown.")}
                        </p>
                        <Select value={selectedApproverId} onValueChange={setSelectedApproverId}>
                          <SelectTrigger className="mt-2">
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
                      <div className="flex justify-end gap-2">
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
            <div>
              <Label className="text-slate-400 text-sm">{t("Recurrence")}</Label>
              {canEdit ? (
                <Select
                  value={selectedRecurrence}
                  onValueChange={(value) => {
                    setSelectedRecurrence(value);
                    handleInlineUpdate("recurrence", value);
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("Select recurrence")} />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium mt-1">{policy.recurrence || "-"}</p>
              )}
            </div>

            {/* Review Date - Inline Date Picker (editable only with permission) */}
            <div>
              <Label className="text-slate-400 text-sm">{t("Review Date")}</Label>
              <div className="flex items-center gap-2 mt-1">
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
                  <p className="font-medium">{policy.reviewDate ? new Date(policy.reviewDate).toLocaleDateString() : "-"}</p>
                )}
              </div>
            </div>

            {/* Version - Read-only */}
            <div>
              <Label className="text-slate-400 text-sm">{t("Version")}</Label>
              <p className="font-medium mt-1">{policy.version || "-"}</p>
            </div>
          </div>

          {policy.description && (
            <div className="mt-6">
              <Label className="text-slate-400 text-sm">{t("Description")}</Label>
              <p className="mt-1">{policy.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Review Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t("AI Review")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!policy.aiReviewStatus || policy.aiReviewStatus === "Pending" ? (
            <div className="text-center py-4 text-slate-400">
              <p>{t("AI Review has not been performed yet")}</p>
            </div>
          ) : policy.aiReviewStatus === "In Progress" ? (
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <p>{t("AI Review in progress...")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              <div>
                <Label className="text-slate-400 text-sm">{t("Status")}</Label>
                <div className="mt-1">
                  <Badge className={aiStatusColors[policy.aiReviewStatus] || "bg-gray-100"}>
                    {policy.aiReviewStatus}
                  </Badge>
                </div>
              </div>
              {policy.aiReviewScore !== null && (
                <div>
                  <Label className="text-slate-400 text-sm">{t("Score")}</Label>
                  <div className="mt-1">
                    <span className={`text-2xl font-bold ${
                      policy.aiReviewScore >= 80
                        ? "text-green-600"
                        : policy.aiReviewScore >= 60
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}>
                      {policy.aiReviewScore}%
                    </span>
                  </div>
                </div>
              )}
              {policy.aiReviewJustification && (
                <div className="col-span-3">
                  <Label className="text-slate-400 text-sm">{t("Justification")}</Label>
                  <p className="mt-1 p-3 bg-muted rounded-lg">{policy.aiReviewJustification}</p>
                </div>
              )}
              {/* View More Button */}
              {aiReviewResult && aiReviewResult.raw_response?.controls_response && (
                <div className="col-span-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setAiReviewDetailsOpen(true)}
                  >
                    <Eye className="h-4 w-4 ltr:mr-2 rtl:ml-2 text-blue-500" />
                    {t("View More")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Review Details Modal */}
      <Dialog open={aiReviewDetailsOpen} onOpenChange={setAiReviewDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {t("AI Review Details")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {aiReviewResult?.raw_response?.controls_response?.map((control, index) => (
              <div
                key={index}
                className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700"
              >
                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {t("Control Code")}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        {control.control_code}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {t("Question")}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        {control.question || "-"}
                      </p>
                    </div>
                  </div>
                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {t("Status")}
                      </p>
                      <Badge
                        className={
                          control.status?.toLowerCase() === "compliant"
                            ? "bg-green-100 text-green-800"
                            : control.status?.toLowerCase() === "non-compliant"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        {control.status ? control.status.charAt(0).toUpperCase() + control.status.slice(1) : "-"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {t("Answer")}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        {control.answer || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(!aiReviewResult?.raw_response?.controls_response ||
              aiReviewResult.raw_response.controls_response.length === 0) && (
              <div className="text-center py-8 text-slate-400">
                <p>{t("No detailed review data available")}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Published Section - Only show when status is Published */}
      {policy.status === "Published" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              {t("Published")}
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Download Published Document Button */}
              {(attachments.length > 0 || linkedVaultDocuments.length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (attachments.length > 0) {
                      window.open(attachments[0].filePath, "_blank");
                    } else if (linkedVaultDocuments.length > 0) {
                      window.open(`/api/governance-vault/${linkedVaultDocuments[0].document.id}/download`, "_blank");
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t("Download")}
                </Button>
              )}
              {/* Unpublish Button */}
              <PermissionGate resource="compliance.governance" action="edit">
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
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Published Info */}
              <div className="space-y-4">
                {/* Published On */}
                <div>
                  <Label className="text-slate-400 text-sm">{t("Published On")}</Label>
                  <p className="font-medium mt-1">
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
                <div>
                  <Label className="text-slate-400 text-sm">{t("Published Document")}</Label>
                  {attachments.length > 0 ? (
                    <div className="flex items-center gap-2 mt-1 p-2 bg-muted rounded-lg">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">{attachments[0].fileName}</span>
                    </div>
                  ) : linkedVaultDocuments.length > 0 ? (
                    <div className="flex items-center gap-2 mt-1 p-2 bg-muted rounded-lg">
                      {getFileTypeIcon(linkedVaultDocuments[0].document.fileType)}
                      <span className="font-medium">{linkedVaultDocuments[0].document.fileName}</span>
                    </div>
                  ) : (
                    <p className="text-slate-400 mt-1">{t("No document attached")}</p>
                  )}
                </div>

                {/* Approver Details */}
                <div>
                  <Label className="text-slate-400 text-sm">{t("Approved By")}</Label>
                  {policy.approver ? (
                    <div className="mt-1 p-3 bg-muted rounded-lg space-y-1">
                      <p className="font-medium">{policy.approver.fullName}</p>
                      {(() => {
                        // Find the approver in users array to get full details
                        const approverUser = users.find(u => u.id === policy.approverId);
                        return (
                          <>
                            {approverUser?.department && (
                              <p className="text-sm text-slate-400">
                                {t("Department")}: {approverUser.department.name}
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
                    <p className="text-slate-400 mt-1">-</p>
                  )}
                </div>
              </div>

              {/* Right Column - Signature */}
              <div>
                <Label className="text-slate-400 text-sm">{t("Signature")}</Label>
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
          </CardContent>
        </Card>
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
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpublish} className="bg-orange-600 hover:bg-orange-700">
              {t("Unpublish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attachments Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("Attachments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isCustomerAdmin ? (
            /* Customer Admin: 3 Card Options */
            <div className="space-y-6">
              {/* 3 Option Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                              ? "border-gray-100 bg-gray-50 cursor-not-allowed opacity-50"
                              : "border-gray-200 cursor-pointer hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                            hasDocument ? "bg-gray-100" : "bg-blue-100"
                          }`}>
                            <Upload className={`h-6 w-6 ${hasDocument ? "text-gray-400" : "text-blue-600"}`} />
                          </div>
                          <h3 className={`font-medium ${hasDocument ? "text-gray-400" : "text-gray-900"}`}>
                            {t("Upload Existing File")}
                          </h3>
                          <p className={`text-sm mt-1 ${hasDocument ? "text-gray-300" : "text-gray-500"}`}>
                            {hasDocument
                              ? t("Delete existing file to upload new")
                              : t("Upload document from your device")}
                          </p>
                        </div>
                      </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t("Upload Existing File")}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      {/* Drag and Drop Area */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                          isDragOver
                            ? "border-primary bg-primary/10"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileSelect}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                        />
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Upload className="h-8 w-8 text-blue-600" />
                        </div>
                        <p className="text-gray-600 mb-2">
                          {t("Drag and drop your file here, or")}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleBrowseClick}
                        >
                          {t("Browse Files")}
                        </Button>
                        <p className="text-xs text-gray-400 mt-3">
                          {t("Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT")}
                        </p>
                      </div>

                      {/* Selected File Preview */}
                      {uploadFile && (
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                          {getFileTypeIcon(uploadFile.name.split(".").pop() || "")}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{uploadFile.name}</p>
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
                    <div className="flex justify-end gap-2">
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
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
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

                {/* Option 2: Generate Policy Using AI */}
                {(() => {
                  const hasDocument = attachments.length > 0 || linkedVaultDocuments.length > 0;
                  const hasLinkedControls = policy?.policyControls && policy.policyControls.length > 0;
                  const isDisabled = hasDocument || !hasLinkedControls;
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
                              ? "border-gray-100 bg-gray-50 cursor-not-allowed opacity-50"
                              : "border-gray-200 cursor-pointer hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                            isDisabled ? "bg-gray-100" : "bg-purple-100"
                          }`}>
                            <Sparkles className={`h-6 w-6 ${isDisabled ? "text-gray-400" : "text-purple-600"}`} />
                          </div>
                          <h3 className={`font-medium ${isDisabled ? "text-gray-400" : "text-gray-900"}`}>
                            {t("Generate Policy Using AI")}
                          </h3>
                          <p className={`text-sm mt-1 ${isDisabled ? "text-gray-300" : "text-gray-500"}`}>
                            {hasDocument
                              ? t("Delete existing file to use AI")
                              : !hasLinkedControls
                              ? t("Link controls first to generate")
                              : t("Create document with AI assistance")}
                          </p>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{t("Generate Policy Using AI")}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>{t("Policy Name")}</Label>
                              <Input value={policy?.name || ""} disabled className="bg-gray-50 mt-1" />
                            </div>
                            <div>
                              <Label>{t("Document Type")}</Label>
                              <Input value={policy?.documentType || "Policy"} disabled className="bg-gray-50 mt-1" />
                            </div>
                          </div>

                          {/* Template Selection */}
                          <div>
                            <Label className="flex items-center gap-2">
                              {t("Select Template")} <span className="text-red-500">*</span>
                              <span className="text-xs text-gray-500">(.docx only)</span>
                            </Label>
                            <div className="mt-2 space-y-3">
                              {templates.length > 0 ? (
                                <div className="border rounded-lg max-h-40 overflow-y-auto">
                                  {templates.map((template) => (
                                    <div
                                      key={template.id}
                                      className={`p-3 cursor-pointer border-b last:border-b-0 hover:bg-gray-50 ${
                                        selectedTemplateId === template.id ? "bg-purple-50 border-purple-200" : ""
                                      }`}
                                      onClick={() => setSelectedTemplateId(template.id)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="radio"
                                            checked={selectedTemplateId === template.id}
                                            onChange={() => setSelectedTemplateId(template.id)}
                                            className="text-purple-600"
                                          />
                                          <FileText className="h-4 w-4 text-blue-600" />
                                          <span className="font-medium text-sm">{template.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                          {template.fileSize ? `${(template.fileSize / 1024).toFixed(1)} KB` : ""}
                                        </span>
                                      </div>
                                      {template.uploadedBy && (
                                        <p className="text-xs text-gray-500 ml-6 mt-1">
                                          {t("Uploaded by")}: {template.uploadedBy.fullName}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="border-2 border-dashed rounded-lg p-4 text-center text-gray-500">
                                  <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                  <p className="text-sm">{t("No templates available")}</p>
                                  <p className="text-xs">{t("Upload a .docx template below")}</p>
                                </div>
                              )}

                              {/* Upload New Template */}
                              <div className="border rounded-lg p-3 bg-gray-50">
                                <Label className="text-sm font-medium">{t("Or upload a new template")}</Label>
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
                                      <span className="ml-1">{t("Upload")}</span>
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Linked Controls */}
                          <div>
                            <Label>{t("Linked Controls")} ({policy?.policyControls?.length || 0})</Label>
                            <div className="mt-2 border rounded-lg max-h-32 overflow-y-auto">
                              {policy?.policyControls && policy.policyControls.length > 0 ? (
                                <div className="divide-y">
                                  {policy.policyControls.map((pc) => (
                                    <div key={pc.control.id} className="p-2 hover:bg-gray-50">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs font-mono">
                                          {pc.control.controlCode}
                                        </Badge>
                                        <span className="text-sm">{pc.control.name}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-4 text-center text-gray-500">
                                  {t("No controls linked to this policy")}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-800">
                              <strong>{t("Note")}:</strong> {t("The AI will use the selected template and linked controls to generate a comprehensive policy document.")}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
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
                            disabled={generatingPolicy || !hasLinkedControls || !selectedTemplateId}
                          >
                            {generatingPolicy ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                {t("Generating...")}
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
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
                              ? "border-gray-100 bg-gray-50 cursor-not-allowed opacity-50"
                              : "border-gray-200 cursor-pointer hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                            hasDocument ? "bg-gray-100" : "bg-green-100"
                          }`}>
                            <Link2 className={`h-6 w-6 ${hasDocument ? "text-gray-400" : "text-green-600"}`} />
                          </div>
                          <h3 className={`font-medium ${hasDocument ? "text-gray-400" : "text-gray-900"}`}>
                            {t("Link from Vault")}
                          </h3>
                          <p className={`text-sm mt-1 ${hasDocument ? "text-gray-300" : "text-gray-500"}`}>
                            {hasDocument
                              ? t("Delete existing file to link")
                              : t("Link existing vault documents")}
                          </p>
                        </div>
                      </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>{t("Link from Vault")}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder={t("Search documents...")}
                          value={vaultSearchQuery}
                          onChange={(e) => setVaultSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>

                      {/* Document List */}
                      <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                        {filteredVaultDocuments.length === 0 ? (
                          <div className="text-center py-8 text-gray-400">
                            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>{t("No documents found in vault")}</p>
                          </div>
                        ) : (
                          <div className="divide-y">
                            {filteredVaultDocuments.map((doc) => {
                              const isSelected = selectedVaultDocIds.includes(doc.id);
                              const isAlreadyLinked = doc.linkedGovernanceIds.includes(id);

                              return (
                                <div
                                  key={doc.id}
                                  className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer ${
                                    isSelected ? "bg-blue-50" : ""
                                  } ${isAlreadyLinked ? "opacity-50" : ""}`}
                                  onClick={() => !isAlreadyLinked && handleVaultDocSelect(doc.id)}
                                >
                                  {/* Checkbox */}
                                  <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
                                    isSelected
                                      ? "bg-primary border-primary"
                                      : "border-gray-300"
                                  } ${isAlreadyLinked ? "bg-gray-200 border-gray-200" : ""}`}>
                                    {(isSelected || isAlreadyLinked) && (
                                      <Check className="h-3 w-3 text-white" />
                                    )}
                                  </div>

                                  {/* File Icon */}
                                  {getFileTypeIcon(doc.type)}

                                  {/* Document Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                                    <p className="text-xs text-gray-500">
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
                        <p className="text-sm text-gray-600">
                          {selectedVaultDocIds.length} {t("document(s) selected")}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
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
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                            {t("Linking...")}
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-2" />
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
                  <h4 className="font-medium text-gray-900 mb-3">{t("Uploaded Files")}</h4>
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
                            onClick={() => window.open(att.filePath, "_blank")}
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
                  <h4 className="font-medium text-gray-900 mb-3">{t("Linked from Vault")}</h4>
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
                            onClick={() => window.open(`/api/governance-vault/${link.document.id}/download`, "_blank")}
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
              <PermissionGate resource="compliance.governance" action="edit">
                <div className="mb-4">
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    {t("Upload")}
                  </Button>
                </div>
              </PermissionGate>
              {attachments.length === 0 && linkedVaultDocuments.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{t("No attachments uploaded")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Uploaded Attachments */}
                  {attachments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">{t("Uploaded Files")}</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("File Name")}</TableHead>
                            <TableHead>{t("Type")}</TableHead>
                            <TableHead>{t("Uploaded")}</TableHead>
                            <TableHead className="w-[100px]">{t("Actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attachments.map((att) => (
                            <TableRow key={att.id}>
                              <TableCell className="font-medium">{att.fileName}</TableCell>
                              <TableCell>{att.fileType}</TableCell>
                              <TableCell>{new Date(att.uploadedAt).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => window.open(att.filePath, "_blank")}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <PermissionGate resource="compliance.governance" action="delete">
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4 text-red-500" />
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
                      <h4 className="font-medium text-gray-900 mb-3">{t("Linked from Vault")}</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("File Name")}</TableHead>
                            <TableHead>{t("Type")}</TableHead>
                            <TableHead>{t("Uploaded")}</TableHead>
                            <TableHead className="w-[100px]">{t("Actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {linkedVaultDocuments.map((link) => (
                            <TableRow key={link.id}>
                              <TableCell className="font-medium">{link.document.fileName}</TableCell>
                              <TableCell>{link.document.fileType}</TableCell>
                              <TableCell>{new Date(link.document.uploadedAt).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => window.open(`/api/governance-vault/${link.document.id}/download`, "_blank")}
                                  >
                                    <Download className="h-4 w-4" />
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
        </CardContent>
      </Card>

      {/* Signature Publish Dialog */}
      <Dialog open={signatureDialogOpen} onOpenChange={(open) => {
        setSignatureDialogOpen(open);
        if (!open) clearSignature();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t(typeLabels[policy.documentType] || "Policy")} {t("signature Publish")}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-400">
              {t("Please sign below to publish this")} {(policy.documentType || "document").toLowerCase()}.
            </p>
            <div className="border rounded-lg p-2 bg-white">
              <canvas
                ref={canvasRef}
                width={400}
                height={150}
                className="w-full border border-dashed border-gray-300 rounded cursor-crosshair"
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
          <div className="flex justify-end gap-2">
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
      <div className="border-b">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== null && (
                <Badge variant="secondary" className="ml-1">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "controls" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("Linked Control")}</CardTitle>
            <PermissionGate resource="compliance.governance" action="edit">
              <Dialog open={linkControlDialogOpen} onOpenChange={(open) => {
                setLinkControlDialogOpen(open);
                if (!open) {
                  setSelectedControlIds([]);
                  setControlSearchQuery("");
                  setControlDomainFilter("all");
                  setControlFunctionalGroupingFilter("all");
                  setControlFrameworkFilter("all");
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("Link Control")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
                  <DialogHeader className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
                    <DialogTitle className="text-lg font-semibold text-primary-700">{t("Link Control")}</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {/* Filters */}
                    <div className="grid grid-cols-3 gap-3">
                      <Select value={controlDomainFilter} onValueChange={setControlDomainFilter}>
                        <SelectTrigger className="bg-white border-2 border-primary-200 rounded-full">
                          <SelectValue placeholder={t("Domain")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("All Domains")}</SelectItem>
                          {controlDomains.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={controlFunctionalGroupingFilter} onValueChange={setControlFunctionalGroupingFilter}>
                        <SelectTrigger className="bg-white border-2 border-primary-200 rounded-full">
                          <SelectValue placeholder={t("Functional Grouping")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("All Groupings")}</SelectItem>
                          {functionalGroupings.map((g) => (
                            <SelectItem key={g} value={g}>{t(g)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={controlFrameworkFilter} onValueChange={setControlFrameworkFilter}>
                        <SelectTrigger className="bg-white border-2 border-primary-200 rounded-full">
                          <SelectValue placeholder={t("Framework")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("All Frameworks")}</SelectItem>
                          {frameworks.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Search input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder={t("Search By Control Code , Name")}
                        value={controlSearchQuery}
                        onChange={(e) => setControlSearchQuery(e.target.value)}
                        className="pl-10 pr-10 bg-white border-2 border-primary-200 rounded-full"
                      />
                      {controlSearchQuery && (
                        <button
                          onClick={() => setControlSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Control cards list */}
                    <div className="border-2 border-primary-200 rounded-xl max-h-[350px] overflow-y-auto">
                      {getFilteredControlsForLinking().map((control) => (
                        <div
                          key={control.id}
                          className={`flex items-start gap-3 p-4 border-b-2 border-primary-100 last:border-b-0 cursor-pointer hover:bg-primary-50 transition-colors ${
                            selectedControlIds.includes(control.id) ? "bg-primary-50" : ""
                          }`}
                          onClick={() => {
                            setSelectedControlIds((prev) =>
                              prev.includes(control.id)
                                ? prev.filter((id) => id !== control.id)
                                : [...prev, control.id]
                            );
                          }}
                        >
                          <div onClick={(e) => e.stopPropagation()} className="pt-1">
                            <Checkbox
                              checked={selectedControlIds.includes(control.id)}
                              onCheckedChange={() => {
                                setSelectedControlIds((prev) =>
                                  prev.includes(control.id)
                                    ? prev.filter((id) => id !== control.id)
                                    : [...prev, control.id]
                                );
                              }}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-primary-700">
                                {control.controlCode} : {control.name}
                              </span>
                              <Badge className="bg-primary-600 text-white rounded-full px-3">
                                {control.entities || "Organization Wide"}
                              </Badge>
                            </div>
                            {control.description && (
                              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{control.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {getFilteredControlsForLinking().length === 0 && (
                        <div className="p-8 text-center text-slate-400">
                          {controlSearchQuery.trim() || controlDomainFilter !== "all" || controlFunctionalGroupingFilter !== "all" || controlFrameworkFilter !== "all"
                            ? t("No controls found matching your filters")
                            : t("No available controls to link")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white flex-shrink-0">
                    <Button
                      onClick={handleLinkControl}
                      disabled={selectedControlIds.length === 0}
                      className="rounded-lg"
                    >
                      {t("Link Control")}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </PermissionGate>
          </CardHeader>
          <CardContent>
            {linkedControls.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Link2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t("No controls linked to this")} {(policy.documentType || "policy").toLowerCase()}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Control ID")}</TableHead>
                    <TableHead>{t("Name")}</TableHead>
                    <TableHead>{t("Domain")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    <TableHead className="w-[80px]">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedControls.map((pc) => (
                    <TableRow
                      key={pc.control.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => router.push(`/compliance/control/${pc.control.id}`)}
                    >
                      <TableCell className="font-medium">{pc.control.controlCode}</TableCell>
                      <TableCell>{pc.control.name}</TableCell>
                      <TableCell>{pc.control.domain?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[pc.control.status] || "bg-gray-100"}>
                          {pc.control.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <PermissionGate resource="compliance.governance" action="edit">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlinkControl(pc.control.id);
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            {t("Unlink")}
                          </Button>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "exceptions" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("Linked Exception")}</CardTitle>
            {isCustomerAdmin && (
              <Dialog open={linkExceptionDialogOpen} onOpenChange={setLinkExceptionDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("Link Exception")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("Link Exception")}</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <Label>{t("Select Exception")}</Label>
                    <Select value={selectedExceptionId} onValueChange={setSelectedExceptionId}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder={t("Select an exception")} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableExceptions
                          .filter((e) => !linkedExceptions.find((le) => le.exception.id === e.id))
                          .map((exception) => (
                            <SelectItem key={exception.id} value={exception.id}>
                              {exception.exceptionCode} - {exception.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
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
          </CardHeader>
          <CardContent>
            {linkedExceptions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t("No exceptions linked to this")} {(policy.documentType || "policy").toLowerCase()}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Exception Code")}</TableHead>
                    <TableHead>{t("Name")}</TableHead>
                    <TableHead>{t("Category")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    {isCustomerAdmin && <TableHead className="w-[80px]">{t("Actions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedExceptions.map((pe) => (
                    <TableRow
                      key={pe.exception.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => router.push(`/compliance/exceptions/${pe.exception.id}`)}
                    >
                      <TableCell className="font-medium">{pe.exception.exceptionCode}</TableCell>
                      <TableCell>{pe.exception.name}</TableCell>
                      <TableCell>{pe.exception.category}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[pe.exception.status] || "bg-gray-100"}>
                          {pe.exception.status}
                        </Badge>
                      </TableCell>
                      {isCustomerAdmin && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlinkException(pe.exception.id);
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            {t("Unlink")}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "documents" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("Linked Documents")}</CardTitle>
          </CardHeader>
          <CardContent>
            {linkedDocuments.length === 0 && linkedVaultDocuments.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>{t("No documents linked to this")} {(policy.documentType || "policy").toLowerCase()}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Vault Documents */}
                {linkedVaultDocuments.length > 0 && (
                  <div className="space-y-2">
                    {linkedVaultDocuments.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg"
                      >
                        {/* File Icon */}
                        {getFileTypeIcon(link.document.fileType)}

                        {/* Document Info */}
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
                          {/* Download Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`/api/governance-vault/${link.document.id}/download`, "_blank")}
                            title={t("Download")}
                          >
                            <Download className="h-4 w-4 text-primary" />
                          </Button>

                          {/* Unlink Button */}
                          <PermissionGate resource="compliance.governance" action="edit">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnlinkVaultDocument(link.document.id)}
                              className="text-slate-600"
                            >
                              {t("Unlink")}
                            </Button>
                          </PermissionGate>

                          {/* Status Badge */}
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            {link.document.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Regular Linked Documents (if any) */}
                {linkedDocuments.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Code")}</TableHead>
                        <TableHead>{t("Name")}</TableHead>
                        <TableHead>{t("Type")}</TableHead>
                        <TableHead className="w-[80px]">{t("Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedDocuments.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">{doc.code}</TableCell>
                          <TableCell>{doc.name}</TableCell>
                          <TableCell>{doc.type}</TableCell>
                          <TableCell>
                            <PermissionGate resource="compliance.governance" action="edit">
                              <Button variant="ghost" size="sm" className="text-red-500">
                                {t("Unlink")}
                              </Button>
                            </PermissionGate>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

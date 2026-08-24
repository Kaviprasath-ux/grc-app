"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Unauthorized } from "@/components/ui/unauthorized";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Plus,
  FileSpreadsheet,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  Home,
  Upload,
  FileText,
  Eye,
  Download,
  Sparkles,
  File,
  Image,
  FileType,
  X,
  CloudOff,
  FileEdit,
  BadgeCheck,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { isValidName } from "@/lib/validations";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";

import { FileInput } from "@/components/shared/file-input";
interface Evidence {
  id: string;
  evidenceCode: string;
  name: string;
  description: string | null;
  domain: string | null;
  recurrence: string | null;
  status: string;
  departmentId: string | null;
  assigneeId: string | null;
  issueIdentifiedBy: string | null;
  department?: { id: string; name: string } | null;
  assignee?: { id: string; fullName: string } | null;
}

interface Artifact {
  id: string;
  artifactCode: string;
  fileName: string;
  fileType: string | null;
  filePath: string;
  uploadedAt: string;
  uploadedBy?: { id: string; fullName: string } | null;
  linkedEvidences?: Array<{
    evidenceId: string;
    evidence: { id: string; evidenceCode: string; name: string };
  }>;
}

interface Requirement {
  id: string;
  code: string;
  name: string;
  description: string | null;
  framework?: { id: string; name: string } | null;
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
  departmentId: string | null;
  customerCode?: string;
  userRoles?: UserRole[];
}

interface CurrentUser {
  id: string;
  customerCode?: string;
}

interface Framework {
  id: string;
  name: string;
}


interface StatusCount {
  status: string;
  count: number;
  total?: number;
}

const statusColors: Record<string, string> = {
  "Not Uploaded": "bg-slate-100 text-slate-600",
  Draft: "bg-warning-light text-warning-dark",
  Validated: "bg-info-light text-info-dark",
  Published: "bg-success-light text-success-dark",
  "Need Attention": "bg-error-light text-error-dark",
};

const recurrenceOptions = ["Yearly", "Half-yearly", "Quarterly", "Monthly"];

export default function EvidencePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { t, isRTL } = useLanguage();
  const { canView, canCreate, canDelete, isLoading: permissionsLoading } = usePermissions('qpost-compliance.evidence');
  const isCustomerAdmin = useHasRole("CustomerAdministrator");
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const searchTermRef = useRef(searchTerm);
  searchTermRef.current = searchTerm;
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Tabs state
  const [activeTab, setActiveTab] = useState("evidence-request");

  // Import dialog states
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Artifacts state
  const artifactFileInputRef = useRef<HTMLInputElement>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactDragging, setArtifactDragging] = useState(false);
  const [artifactUploading, setArtifactUploading] = useState(false);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);

  // Link Evidence Dialog state
  const [linkEvidenceDialogOpen, setLinkEvidenceDialogOpen] = useState(false);
  const [selectedArtifactForLink, setSelectedArtifactForLink] = useState<Artifact | null>(null);
  const [selectedEvidenceIdsForLink, setSelectedEvidenceIdsForLink] = useState<string[]>([]);
  const [linkEvidenceSearchTerm, setLinkEvidenceSearchTerm] = useState("");

  // Delete dialogs
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);

  // Filters
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [controlFilter, setControlFilter] = useState<string>(searchParams.get("controlId") || "all");

  // Status counts (original - not affected by status filter)
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([
    { status: "Not Uploaded", count: 0 },
    { status: "Draft", count: 0 },
    { status: "Validated", count: 0 },
    { status: "Published", count: 0, total: 0 },
    { status: "Need Attention", count: 0 },
  ]);

  // Selected status filter for tile cards
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Fetch status counts separately (without status filter)
  const fetchStatusCounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (frameworkFilter && frameworkFilter !== "all") params.append("frameworkId", frameworkFilter);
      if (departmentFilter && departmentFilter !== "all") params.append("departmentId", departmentFilter);
      if (controlFilter && controlFilter !== "all") params.append("requirementId", controlFilter);
      if (searchTermRef.current) params.append("search", searchTermRef.current);
      // Don't include status filter - we want total counts
      params.append("limit", "1000"); // Get all to count

      const response = await fetch(`/api/qpost-compliance/evidences?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const allEvidences = data.data || [];
        const counts: Record<string, number> = {
          "Not Uploaded": 0,
          "Draft": 0,
          "Validated": 0,
          "Published": 0,
          "Need Attention": 0,
        };
        allEvidences.forEach((e: Evidence) => {
          if (counts[e.status] !== undefined) {
            counts[e.status]++;
          }
        });
        const totalCount = allEvidences.length;
        setStatusCounts([
          { status: "Not Uploaded", count: counts["Not Uploaded"] },
          { status: "Draft", count: counts["Draft"] },
          { status: "Validated", count: counts["Validated"] },
          { status: "Published", count: counts["Published"], total: totalCount },
          { status: "Need Attention", count: counts["Need Attention"] },
        ]);
      }
    } catch (error) {
      console.error("Error fetching status counts:", error);
    }
  }, [frameworkFilter, departmentFilter, controlFilter]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 10;

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);

  // Dynamic translations for user-entered data
  const { data: translatedEvidences } = useTranslatedData(evidences, { modelName: 'QPostEvidence' });
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedFrameworks } = useTranslatedData(frameworks, { modelName: 'QPostFramework' });
  const { data: translatedRequirements } = useTranslatedData(requirements, { modelName: 'QPostRequirement' });
  const { data: translatedUsers } = useTranslatedData(users, { modelName: 'User' });

  // Create form
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
    approverId: "",
  });

  // Step 2 - Requirement selection
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>([]);
  const [evidenceErrors, setEvidenceErrors] = useState<Record<string, string>>({});
  const [requirementFilters, setRequirementFilters] = useState({
    frameworkId: "",
    search: "",
  });

  const fetchEvidences = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (frameworkFilter && frameworkFilter !== "all") params.append("frameworkId", frameworkFilter);
      if (departmentFilter && departmentFilter !== "all") params.append("departmentId", departmentFilter);
      if (controlFilter && controlFilter !== "all") params.append("requirementId", controlFilter);
      if (searchTermRef.current) params.append("search", searchTermRef.current);
      if (selectedStatus) params.append("status", selectedStatus);
      params.append("page", currentPage.toString());
      params.append("limit", itemsPerPage.toString());

      const response = await fetch(`/api/qpost-compliance/evidences?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEvidences(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching evidences:", error);
    } finally {
      setLoading(false);
    }
  }, [frameworkFilter, departmentFilter, controlFilter, selectedStatus, currentPage]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [deptRes, usersRes, fwRes, reqRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/qpost-compliance/frameworks"),
        fetch("/api/qpost-compliance/requirements?limit=500"),
      ]);

      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.data || data || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        const userData = data.data || data || [];
        setUsers(userData);

        // Find current user to get customerCode for customer scoping
        if (session?.user?.id) {
          const currentUserData = userData.find((u: User) => u.id === session.user.id);
          if (currentUserData) {
            setCurrentUser({
              id: currentUserData.id,
              customerCode: currentUserData.customerCode,
            });
          }
        }
      }
      if (fwRes.ok) {
        const data = await fwRes.json();
        setFrameworks(data.data || data || []);
      }
      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequirements(data.data || data || []);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  useEffect(() => {
    fetchEvidences();
  }, [fetchEvidences]);

  // Fetch status counts separately (only when non-status filters change)
  useEffect(() => {
    fetchStatusCounts();
  }, [fetchStatusCounts]);

  // The /api/users and /api/departments endpoints already apply tenant filtering,
  // so data is already scoped to the user's customerAccountId.
  const getCustomerScopedUsers = () => translatedUsers;

  const getCustomerScopedDepartments = () => translatedDepartments;

  // Filter users for Assignee dropdown: DepartmentContributors and DepartmentReviewers from the selected department
  const filteredUsers = (() => {
    if (!createForm.departmentId) return [];

    return translatedUsers.filter((u) => {
      if (u.departmentId !== createForm.departmentId) return false;
      return u.userRoles?.some((ur) =>
        ["DepartmentContributor", "DepartmentReviewer"].includes(ur.role?.name)
      );
    });
  })();

  // Filtered requirements for step 2
  const filteredRequirements = translatedRequirements.filter((r) => {
    if (requirementFilters.frameworkId && r.framework?.id !== requirementFilters.frameworkId) return false;
    if (requirementFilters.search) {
      const search = requirementFilters.search.toLowerCase();
      if (!r.code.toLowerCase().includes(search) && !r.name.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const handleSearch = () => {
    setCurrentPage(1);
    fetchEvidences();
    fetchStatusCounts();
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/qpost-compliance/evidences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          recurrence: createForm.recurrence,
          departmentId: createForm.departmentId || null,
          assigneeId: createForm.assigneeId || null,
          approverId: createForm.approverId || null,
          requirementIds: selectedRequirementIds,
          status: "Not Uploaded",
        }),
      });

      if (response.ok) {
        const savedEvidence = await response.json();
        if (savedEvidence?.id) {
          triggerTranslation('Evidence', savedEvidence.id, { name: createForm.name, description: createForm.description });
        }
        setCreateDialogOpen(false);
        resetCreateForm();
        fetchEvidences();
        fetchStatusCounts();
      } else {
        toast.error(t("Failed to create evidence"));
      }
    } catch (error) {
      console.error("Error creating evidence:", error);
      toast.error(t("Failed to create evidence"));
    } finally {
      setIsSaving(false);
    }
  };

  const resetCreateForm = () => {
    setCreateStep(1);
    setCreateForm({
      name: "",
      description: "",
      recurrence: "",
      departmentId: "",
      assigneeId: "",
      approverId: "",
    });
    setSelectedRequirementIds([]);
    setRequirementFilters({
      frameworkId: "",
      search: "",
    });
    setEvidenceErrors({});
  };

  const handleDeleteAll = async () => {
    try {
      const response = await fetch("/api/qpost-compliance/evidences/delete-all", {
        method: "DELETE",
      });
      if (response.ok) {
        fetchEvidences();
      }
    } catch (error) {
      console.error("Error deleting all evidences:", error);
    } finally {
      setIsDeleteAllDialogOpen(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setImportFile(files[0]);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Evidence Code", "Name", "Description", "Domain", "Recurrence", "Status", "Department", "Assignee"],
      ...translatedEvidences.map((e) => [
        e.evidenceCode,
        e.name,
        e.description || "",
        e.domain || "",
        e.recurrence || "",
        e.status,
        e.department?.name || "",
        e.assignee?.fullName || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evidences.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch("/api/qpost-compliance/evidences/import", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setIsImportDialogOpen(false);
        setImportFile(null);
        fetchEvidences();
      }
    } catch (error) {
      console.error("Error importing evidences:", error);
    } finally {
      setImporting(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
    }
  };

  // Artifact handling
  const handleArtifactDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setArtifactDragging(true);
  };

  const handleArtifactDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setArtifactDragging(false);
  };

  const handleArtifactDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setArtifactDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleArtifactUpload(files);
    }
  };

  const handleArtifactFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleArtifactUpload(files);
    }
  };

  const handleArtifactUpload = async (files: FileList) => {
    setArtifactUploading(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (const file of Array.from(files)) {
        try {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch("/api/qpost-compliance/artifacts", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            successCount++;
          } else {
            failCount++;
            const errorData = await response.json().catch(() => ({}));
            console.error("Artifact upload failed:", errorData.error || response.statusText);
          }
        } catch (error) {
          failCount++;
          console.error("Error uploading artifact:", error);
        }
      }

      // Refresh artifacts list
      await fetchArtifacts();

      // Show feedback
      if (successCount > 0 && failCount === 0) {
        toast.success(t(successCount === 1 ? "Artifact uploaded successfully!" : "Artifacts uploaded successfully!"));
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`${successCount} ${t("uploaded")}, ${failCount} ${t("failed")}`);
      } else {
        toast.error(t("Failed to upload artifact"));
      }
    } finally {
      setArtifactUploading(false);
      // Reset file input so the same file can be re-uploaded
      if (artifactFileInputRef.current) {
        artifactFileInputRef.current.value = "";
      }
    }
  };

  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return 'image';
    if (['xlsx', 'xls', 'csv'].includes(ext)) return 'spreadsheet';
    if (['doc', 'docx'].includes(ext)) return 'document';
    return 'file';
  };

  const getFileIcon = (type: string) => {
    const ext = type.toLowerCase();
    if (ext === 'pdf') return <FileText className="h-5 w-5 text-red-500" />;
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return <Image className="h-5 w-5 text-blue-500" />;
    if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (['doc', 'docx'].includes(ext)) return <FileType className="h-5 w-5 text-blue-600" />;
    return <File className="h-5 w-5 text-slate-500" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDeleteArtifact = async (id: string) => {
    try {
      const response = await fetch(`/api/qpost-compliance/artifacts/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await fetchArtifacts();
      }
    } catch (error) {
      console.error("Error deleting artifact:", error);
    }
  };

  // Fetch artifacts from API
  const fetchArtifacts = useCallback(async () => {
    try {
      const response = await fetch("/api/qpost-compliance/artifacts");
      if (response.ok) {
        const data = await response.json();
        setArtifacts(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching artifacts:", error);
    }
  }, []);

  // Fetch artifacts when switching to artifacts tab
  useEffect(() => {
    if (activeTab === "artifacts" && isCustomerAdmin) {
      fetchArtifacts();
    }
  }, [activeTab, isCustomerAdmin, fetchArtifacts]);

  // Link Evidence Dialog handlers
  const openLinkEvidenceDialog = (artifact: Artifact) => {
    setSelectedArtifactForLink(artifact);
    // Extract evidence IDs from linkedEvidences array
    const linkedIds = artifact.linkedEvidences?.map((le) => le.evidenceId) || [];
    setSelectedEvidenceIdsForLink(linkedIds);
    setLinkEvidenceSearchTerm("");
    setLinkEvidenceDialogOpen(true);
  };

  const toggleEvidenceForLink = (evidenceId: string) => {
    setSelectedEvidenceIdsForLink((prev) =>
      prev.includes(evidenceId)
        ? prev.filter((id) => id !== evidenceId)
        : [...prev, evidenceId]
    );
  };

  const handleLinkEvidences = async () => {
    if (!selectedArtifactForLink) return;

    try {
      // Call API to link evidences
      const response = await fetch(`/api/qpost-compliance/artifacts/${selectedArtifactForLink.id}/link-evidences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceIds: selectedEvidenceIdsForLink }),
      });

      if (response.ok) {
        // Refresh artifacts to get updated linked evidences
        await fetchArtifacts();
      }
    } catch (error) {
      console.error("Error linking evidences:", error);
    }

    // Close the dialog
    setLinkEvidenceDialogOpen(false);
    setSelectedArtifactForLink(null);
    setSelectedEvidenceIdsForLink([]);
  };

  // AI Review Artifacts - processes all artifacts in one step
  // Smart detection: automatically skips already-ingested artifacts (no duplicates)
  const handleAIReviewArtifacts = async () => {
    console.log("[AI Review] Button clicked");
    console.log("[AI Review] Total artifacts:", artifacts.length);

    // Count total artifact-evidence pairs to process
    let totalPairs = 0;
    const artifactsWithLinks = artifacts.filter((artifact) => {
      const linkCount = artifact.linkedEvidences?.length || 0;
      totalPairs += linkCount;
      return linkCount > 0;
    });

    console.log("[AI Review] Artifacts with links:", artifactsWithLinks.length);
    console.log("[AI Review] Total pairs to process:", totalPairs);

    if (totalPairs === 0) {
      toast.error(t("No artifacts linked to evidences. Please link artifacts first."));
      return;
    }

    setAiReviewLoading(true);
    toast.info(
      t("Starting AI Review for") +
      ` ${artifactsWithLinks.length} ` +
      t("artifacts") +
      `...`
    );

    try {
      // Call the all-in-one endpoint (backend handles duplicate prevention)
      const response = await fetch("/api/ai/artifact/review-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactIds: artifactsWithLinks.map((a) => a.id),
        }),
      });

      const data = await response.json();
      console.log("[AI Review] Response:", data);

      if (response.ok && data.success) {
        toast.success(t("AI Review completed successfully"));
      } else {
        console.error("[AI Review] Failed:", data.error);
        toast.error(data.error || t("Failed to perform AI Review"));
      }
    } catch (error) {
      console.error("[AI Review] Error:", error);
      toast.error(t("Failed to perform AI Review"));
    } finally {
      setAiReviewLoading(false);
      // Refresh artifacts list to show updated status
      fetchArtifacts();
    }
  };

  // Filter evidences for link dialog
  const filteredEvidencesForLink = translatedEvidences.filter((e) => {
    if (!linkEvidenceSearchTerm) return true;
    const search = linkEvidenceSearchTerm.toLowerCase();
    return (
      e.evidenceCode.toLowerCase().includes(search) ||
      e.name.toLowerCase().includes(search)
    );
  });

  const toggleRequirementSelection = (requirementId: string) => {
    setSelectedRequirementIds((prev) =>
      prev.includes(requirementId)
        ? prev.filter((id) => id !== requirementId)
        : [...prev, requirementId]
    );
  };

  const canProceedStep1 = createForm.name && createForm.recurrence && createForm.departmentId && createForm.assigneeId;

  // Pagination helpers
  const startItem = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  // Show loading state while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="space-y-6" style={isRTL ? { direction: 'rtl' } : undefined}>
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </Link>
          <ChevronRight className={`h-3.5 w-3.5 text-slate-300 ${isRTL ? "rotate-180" : ""}`} />
          <span className="text-primary-700 font-medium">{t("Evidence")}</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-800">{t("Evidence")}</h1>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Evidence.")} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6" style={isRTL ? { direction: 'rtl' } : undefined}>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500 ">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Evidence")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Evidence")}</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir={isRTL ? "rtl" : "ltr"}>
        <TabsList>
          <TabsTrigger value="evidence-request">
            {t("Evidence Request List")}
          </TabsTrigger>
          <TabsTrigger value="artifacts">
            {t("Artifacts")}
          </TabsTrigger>
        </TabsList>

        {/* Evidence Request List Tab */}
        <TabsContent value="evidence-request" className="mt-6 space-y-6">
          {/* Status Tile Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {statusCounts.map((statusItem) => {
              const statusIcons: Record<string, React.ReactNode> = {
                "Not Uploaded": <CloudOff className="h-5 w-5" />,
                "Draft": <FileEdit className="h-5 w-5" />,
                "Validated": <BadgeCheck className="h-5 w-5" />,
                "Published": <CheckCircle2 className="h-5 w-5" />,
                "Need Attention": <AlertTriangle className="h-5 w-5" />,
              };
              const icon = statusIcons[statusItem.status] || statusIcons["Not Uploaded"];

              return (
                <div
                  key={statusItem.status}
                  className={`bg-white rounded-xl p-4 cursor-pointer transition-all ${
                    selectedStatus === statusItem.status
                      ? "border-2 border-primary-500"
                      : "border border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => {
                    if (selectedStatus === statusItem.status) {
                      setSelectedStatus(null);
                    } else {
                      setSelectedStatus(statusItem.status);
                    }
                    setCurrentPage(1);
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-primary-50 text-primary-500">
                      {icon}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-slate-800 mb-1">
                    {statusItem.status === "Published" && statusItem.total
                      ? `${statusItem.count}/${statusItem.total}`
                      : statusItem.count}
                  </div>
                  <div className="text-sm font-medium text-slate-500">
                    {t(statusItem.status)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons - Above Card */}
          <div className="grid grid-cols-2 sm:flex sm:items-center ltr:sm:justify-end rtl:sm:justify-start gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Export")}
            </Button>
            {/* Import button hidden - functionality preserved for future use
            <PermissionGate resource="qpost-compliance.evidence" action="create">
              <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Import")}
              </Button>
            </PermissionGate>
            */}
            <PermissionGate resource="qpost-compliance.evidence" action="delete">
              <Button variant="outline" size="sm" className="col-span-2 sm:col-span-1 text-semantic-error hover:text-semantic-error hover:bg-red-50" onClick={() => setIsDeleteAllDialogOpen(true)}>
                <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Delete All")}
              </Button>
            </PermissionGate>
            {isCustomerAdmin ? (
              <Button size="sm" className="col-span-2 sm:col-span-1" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("New Evidence")}
              </Button>
            ) : (
              <PermissionGate resource="qpost-compliance.evidence" action="create">
                <Button size="sm" className="col-span-2 sm:col-span-1" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("New Evidence")}
                </Button>
              </PermissionGate>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-center h-64">
                <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t("Search by name, domain or assignee...")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="w-full sm:w-[300px] ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                  />
                </div>
                <div className="ltr:ml-auto rtl:mr-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                      <SelectValue placeholder={t("Department")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Departments")}</SelectItem>
                      {translatedDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
                    <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                      <SelectValue placeholder={t("Framework")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Frameworks")}</SelectItem>
                      {translatedFrameworks.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlFilter} onValueChange={setControlFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-slate-50 border-slate-200">
                      <SelectValue placeholder={t("Control")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Controls")}</SelectItem>
                      {translatedRequirements.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.code} - {r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Evidence Code")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Evidence Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Domain")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Issue Identified by AI")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Assignee")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Department")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {translatedEvidences.map((evidence) => (
                    <TableRow
                      key={evidence.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">{evidence.evidenceCode}</TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-600">{evidence.name}</TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-600">{evidence.domain || "-"}</TableCell>
                      <TableCell className="py-3.5">
                        <Badge className={statusColors[evidence.status] || "bg-slate-100 text-slate-600"}>
                          {t(evidence.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-600">{evidence.issueIdentifiedBy || "-"}</TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-600">{(evidence.assigneeId ? translatedUsers.find(u => u.id === evidence.assigneeId)?.fullName : null) || evidence.assignee?.fullName || "-"}</TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-600">{(evidence.department?.id ? translatedDepartments.find(d => d.id === evidence.department?.id)?.name : null) || evidence.department?.name || "-"}</TableCell>
                      <TableCell className="py-3.5 pe-5">
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                            onClick={() => router.push(`/qpost-compliance/evidence/${evidence.id}`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {evidences.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-0">
                        <div className="py-16 text-center">
                          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                            <FileText className="h-6 w-6 text-primary-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600 mb-1">{t("No evidence records found")}</p>
                          <p className="text-xs text-slate-400">{t("Create a new evidence record to get started")}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-500">
                  {total > 0
                    ? t("Showing {start} to {end} of {total}").replace("{start}", String(startItem)).replace("{end}", String(endItem)).replace("{total}", String(total))
                    : t("No evidence")}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-600"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-600"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Artifacts Tab */}
        <TabsContent value="artifacts" className="mt-6 space-y-6">
          {/* Add Artifact Header and AI Review Button */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">{t("Add Artifact")}</h3>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => handleAIReviewArtifacts()}
              disabled={aiReviewLoading || artifacts.length === 0}
            >
              {aiReviewLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  {t("Reviewing...")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  {t("AI Review Artifacts")}
                </>
              )}
            </Button>
          </div>

          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              artifactUploading
                ? "border-primary-400 bg-primary-50/50 pointer-events-none opacity-70"
                : artifactDragging
                  ? "border-primary-500 bg-primary-50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
            onDragOver={handleArtifactDragOver}
            onDragLeave={handleArtifactDragLeave}
            onDrop={handleArtifactDrop}
          >
            <FileInput
              ref={artifactFileInputRef}
              multiple
              className="hidden"
              onChange={handleArtifactFileChange}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv"
            />
            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
              {artifactUploading ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
              ) : (
                <Upload className="h-6 w-6 text-primary-400" />
              )}
            </div>
            {artifactUploading ? (
              <p className="text-slate-600 mb-2">{t("Uploading...")}</p>
            ) : (
              <p className="text-slate-600 mb-2">
                {t("Drag and drop files here, or")}{" "}
                <button
                  onClick={() => artifactFileInputRef.current?.click()}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  {t("click to upload")}
                </button>
              </p>
            )}
            <p className="text-sm text-slate-400">
              {t("Supported formats: PDF, PNG, JPG, XLSX, DOC, DOCX")}
            </p>
          </div>

          {/* Artifacts List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-semibold text-slate-800">{t("Uploaded Artifacts")}</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {artifacts.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                    <File className="h-6 w-6 text-primary-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">{t("No artifacts uploaded yet")}</p>
                  <p className="text-xs text-slate-400">{t("Upload files above to get started")}</p>
                </div>
              ) : (
                artifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {getFileIcon(artifact.fileType || "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {artifact.artifactCode} : {artifact.fileName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {t("By")} {artifact.uploadedBy?.fullName || "Unknown"}, {new Date(artifact.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                        onClick={() => openLinkEvidenceDialog(artifact)}
                        title={t("Link to Evidence")}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                        onClick={() => window.open(`/api/qpost-compliance/artifacts/${artifact.id}/download`, "_blank")}
                        title={t("View")}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = `/api/qpost-compliance/artifacts/${artifact.id}/download`;
                          link.download = artifact.fileName;
                          link.click();
                        }}
                        title={t("Download")}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                        onClick={() => handleDeleteArtifact(artifact.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Evidence Dialog - 3 Step Wizard */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateForm();
        setCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()} style={isRTL ? { direction: 'rtl' } : undefined}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("New Evidence")} - {t("Step")} {createStep} {t("of")} 3</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 pb-5">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === createStep
                      ? "bg-primary-500 text-white"
                      : step < createStep
                      ? "bg-primary-500 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}>
                    {step < createStep ? <Check className="h-4 w-4" /> : step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${step < createStep ? "bg-primary-500" : "bg-slate-200"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Basic Information */}
            {createStep === 1 && (
              <div className="space-y-4">

                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Evidence Control")} *</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, name: e.target.value });
                      if (evidenceErrors.name) setEvidenceErrors((prev) => { const { name, ...rest } = prev; return rest; });
                    }}
                    placeholder={t("Enter evidence control")}
                    className={`mt-1.5 w-full ${evidenceErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                  />
                  {evidenceErrors.name && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{evidenceErrors.name}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Recurrence")} *</Label>
                    <Select value={createForm.recurrence} onValueChange={(v) => {
                      setCreateForm({ ...createForm, recurrence: v });
                      if (evidenceErrors.recurrence) setEvidenceErrors((prev) => { const { recurrence, ...rest } = prev; return rest; });
                    }}>
                      <SelectTrigger className={`mt-1.5 w-full bg-white ${evidenceErrors.recurrence ? "border-red-500 focus:ring-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select recurrence")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                        {recurrenceOptions.map((r) => (
                          <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {evidenceErrors.recurrence && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{evidenceErrors.recurrence}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Department")} *</Label>
                    <Select value={createForm.departmentId} onValueChange={(v) => {
                      setCreateForm({ ...createForm, departmentId: v, assigneeId: "" });
                      if (evidenceErrors.departmentId) setEvidenceErrors((prev) => { const { departmentId, ...rest } = prev; return rest; });
                    }}>
                      <SelectTrigger className={`mt-1.5 w-full bg-white ${evidenceErrors.departmentId ? "border-red-500 focus:ring-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select department")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                        {getCustomerScopedDepartments().map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {evidenceErrors.departmentId && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{evidenceErrors.departmentId}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Assignee")} *</Label>
                  <Select
                    value={createForm.assigneeId}
                    onValueChange={(v) => {
                      setCreateForm({ ...createForm, assigneeId: v });
                      if (evidenceErrors.assigneeId) setEvidenceErrors((prev) => { const { assigneeId, ...rest } = prev; return rest; });
                    }}
                    disabled={!createForm.departmentId}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${evidenceErrors.assigneeId ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={
                        !createForm.departmentId
                          ? t("Select department first")
                          : t("Select assignee")
                      } />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))
                      ) : (
                        <div className="py-2 px-2 text-sm text-slate-500 text-center">
                          {t("No department reviewers found")}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {evidenceErrors.assigneeId && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{evidenceErrors.assigneeId}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Approver")}</Label>
                  <Select
                    value={createForm.approverId}
                    onValueChange={(v) => setCreateForm({ ...createForm, approverId: v })}
                    disabled={!createForm.departmentId}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={
                        !createForm.departmentId
                          ? t("Select department first")
                          : t("Select approver")
                      } />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {translatedUsers
                        .filter((u) => u.id !== createForm.assigneeId)
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Description")}</Label>
                  <Textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder={t("Enter description")}
                    rows={3}
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Link Requirements */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold text-slate-800">{t("Select Controls to Link")}</Label>
                  <Badge variant="secondary">{selectedRequirementIds.length} {t("selected")}</Badge>
                </div>

                {/* Requirement Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder={t("Search controls...")}
                      value={requirementFilters.search}
                      onChange={(e) => setRequirementFilters({ ...requirementFilters, search: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <Select value={requirementFilters.frameworkId || "all"} onValueChange={(v) => setRequirementFilters({ ...requirementFilters, frameworkId: v === "all" ? "" : v })}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white">
                      <SelectValue placeholder={t("Framework")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Frameworks")}</SelectItem>
                      {translatedFrameworks.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Requirements Table */}
                <div className="bg-white rounded-xl border border-slate-200 max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-[50px] py-3 ps-4"></TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Code")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Control Name")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Framework")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequirements.map((req) => (
                        <TableRow key={req.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <TableCell className="py-3 ps-4">
                            <Checkbox
                              checked={selectedRequirementIds.includes(req.id)}
                              onCheckedChange={() => toggleRequirementSelection(req.id)}
                            />
                          </TableCell>
                          <TableCell className="py-3 text-sm font-medium text-slate-800">{req.code}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-600">{req.name}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-600">{req.framework?.name || "-"}</TableCell>
                        </TableRow>
                      ))}
                      {filteredRequirements.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                            {t("No controls found")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {createStep === 3 && (
              <div className="space-y-6">
                <div className="text-lg font-medium text-slate-800">{t("Review Information")}</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <Label className="text-xs text-slate-500">{t("Evidence Name")}</Label>
                    <p className="font-medium text-slate-900">{createForm.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">{t("Recurrence")}</Label>
                    <p className="font-medium text-slate-900">{createForm.recurrence ? t(createForm.recurrence) : "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">{t("Department")}</Label>
                    <p className="font-medium text-slate-900">
                      {getCustomerScopedDepartments().find((d) => d.id === createForm.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">{t("Assignee")}</Label>
                    <p className="font-medium text-slate-900">
                      {getCustomerScopedUsers().find((u) => u.id === createForm.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">{t("Approver")}</Label>
                    <p className="font-medium text-slate-900">
                      {getCustomerScopedUsers().find((u) => u.id === createForm.approverId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">{t("Linked Controls")}</Label>
                    <p className="font-medium text-slate-900">{selectedRequirementIds.length} {t("controls")}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">{t("Description")}</Label>
                    <p className="font-medium text-slate-900">{createForm.description || "-"}</p>
                  </div>
                </div>

                {selectedRequirementIds.length > 0 && (
                  <div>
                    <Label className="text-slate-500 text-sm mb-2 block">{t("Selected Controls")}:</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedRequirementIds.map((id) => {
                        const req = translatedRequirements.find((r) => r.id === id);
                        return req ? (
                          <Badge key={id} variant="outline">
                            {req.code}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 flex flex-row items-center ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" disabled={isSaving} onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else {
                resetCreateForm();
                setCreateDialogOpen(false);
              }
            }}>
              {createStep === 1 ? t("Cancel") : t("Previous")}
            </Button>
            <Button
              disabled={isSaving}
              onClick={() => {
                if (createStep === 1) {
                  const errors: Record<string, string> = {};
                  if (!createForm.name) {
                    errors.name = t("Please enter the evidence name");
                  } else if (!isValidName(createForm.name.trim())) {
                    errors.name = t("Only letters, spaces, and hyphens are allowed");
                  }
                  if (!createForm.recurrence) errors.recurrence = t("Please select the recurrence");
                  if (!createForm.departmentId) errors.departmentId = t("Please select the Department");
                  if (!createForm.assigneeId) errors.assigneeId = t("Please select the assignee");
                  if (Object.keys(errors).length > 0) { setEvidenceErrors(errors); return; }
                  setEvidenceErrors({});
                }
                if (createStep < 3) setCreateStep(createStep + 1);
                else handleCreate();
              }}
            >
              {createStep === 3 ? (isSaving ? t("Saving...") : t("Create Evidence")) : t("Next")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent style={isRTL ? { direction: 'rtl' } : undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete All Evidence")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete all evidence records? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
              {t("Delete All")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 overflow-hidden" style={isRTL ? { direction: 'rtl' } : undefined}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                {t("Import Evidence")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <p className="text-sm text-slate-500 mb-4">
              {t("Upload a CSV or Excel file to import evidence records.")}
            </p>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? "border-primary bg-primary-50" : "border-slate-200 hover:border-slate-300"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("import-file")?.click()}
            >
              {importFile ? (
                <div className="space-y-3">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-green-600" />
                  <p className="font-medium text-slate-800">{importFile.name}</p>
                  <Button variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    setImportFile(null);
                  }}>
                    {t("Remove")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto">
                    <FileSpreadsheet className="h-6 w-6 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">
                      {t("Drag and drop a file here, or click to browse")}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {t("Supported formats: CSV, XLSX, XLS")}
                    </p>
                  </div>
                  <FileInput
                    ref={importFileInputRef}
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    id="import-file"
                    onChange={handleImportFileChange}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setImportFile(null);
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleImportSubmit} disabled={!importFile || importing}>
              {importing ? t("Importing...") : t("Import")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Evidence Dialog */}
      <Dialog open={linkEvidenceDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setSelectedArtifactForLink(null);
          setSelectedEvidenceIdsForLink([]);
          setLinkEvidenceSearchTerm("");
        }
        setLinkEvidenceDialogOpen(open);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] p-0 gap-0 overflow-hidden max-h-[80vh] flex flex-col" style={isRTL ? { direction: 'rtl' } : undefined}>
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">
                {t("Select Evidence")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("Search by Evidence Code, Name")}
                value={linkEvidenceSearchTerm}
                onChange={(e) => setLinkEvidenceSearchTerm(e.target.value)}
                className="ltr:pl-9 rtl:pr-9 bg-slate-50 border-slate-200"
              />
            </div>

            {/* Evidence List */}
            <div className="space-y-2">
              {filteredEvidencesForLink.map((evidence) => {
                const isSelected = selectedEvidenceIdsForLink.includes(evidence.id);
                return (
                  <div
                    key={evidence.id}
                    onClick={() => toggleEvidenceForLink(evidence.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary-300 bg-primary-50/50"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-primary-500 border-primary-500" : "border-slate-300"
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {evidence.evidenceCode} : {evidence.name}
                    </span>
                  </div>
                );
              })}
              {filteredEvidencesForLink.length === 0 && (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-6 w-6 text-primary-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">{t("No evidences found")}</p>
                  <p className="text-xs text-slate-400">{t("Try adjusting your search")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => setLinkEvidenceDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleLinkEvidences}>
              {t("Link Evidences")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

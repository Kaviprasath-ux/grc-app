"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  DialogFooter,
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
  ChevronsLeft,
  ChevronsRight,
  Check,
  User,
  FileText,
  CheckCircle,
  Upload,
  AlertTriangle,
  Link2,
  Eye,
  Download,
  Search,
  X,
  FileIcon,
} from "lucide-react";
import { toast } from "sonner";

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
  department?: { id: string; name: string } | null;
  assignee?: { id: string; fullName: string } | null;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
  entities: string;
  domain?: { id: string; name: string } | null;
  framework?: { id: string; name: string } | null;
  functionalGrouping: string | null;
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

interface ControlDomain {
  id: string;
  name: string;
}

interface Artifact {
  id: string;
  artifactCode: string;
  fileName: string;
  fileType: string;
  filePath: string;
  uploadedAt: string;
  uploadedBy?: { id: string; fullName: string } | null;
  linkedEvidences?: { evidenceId: string; evidence: { id: string; evidenceCode: string; name: string } }[];
}

const statusColors: Record<string, string> = {
  "Not Uploaded": "bg-slate-100 text-slate-600",
  Draft: "bg-warning-light text-warning-dark",
  Validated: "bg-info-light text-info-dark",
  Published: "bg-success-light text-success-dark",
  "Need Attention": "bg-error-light text-error-dark",
};

const recurrenceOptions = ["Yearly", "Half-yearly", "Quarterly", "Monthly"];

// Status counts interface
interface StatusCounts {
  notUploaded: number;
  draft: number;
  validated: number;
  published: number;
  needAttention: number;
  total: number;
}

export default function EvidencePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { canView, canCreate, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.evidence');
  const isCustomerAdmin = useHasRole("CustomerAdministrator");
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);

  // Tab and status filter states
  const [activeTab, setActiveTab] = useState<"list" | "artifacts">("list");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    notUploaded: 0,
    draft: 0,
    validated: 0,
    published: 0,
    needAttention: 0,
    total: 0,
  });

  // Artifacts tab states
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactFile, setArtifactFile] = useState<File | null>(null);
  const [uploadingArtifact, setUploadingArtifact] = useState(false);
  const [isArtifactDragging, setIsArtifactDragging] = useState(false);
  const artifactFileInputRef = useRef<HTMLInputElement>(null);

  // Link evidence dialog states
  const [linkEvidenceDialogOpen, setLinkEvidenceDialogOpen] = useState(false);
  const [selectedArtifactForLink, setSelectedArtifactForLink] = useState<Artifact | null>(null);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [evidenceSearchTerm, setEvidenceSearchTerm] = useState("");
  const [linkingEvidence, setLinkingEvidence] = useState(false);

  // Import dialog states
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Delete dialogs
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);

  // Filters
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 20;

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [controlDomains, setControlDomains] = useState<ControlDomain[]>([]);

  // Create form
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
  });

  // Step 2 - Control selection
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [controlFilters, setControlFilters] = useState({
    domainId: "",
    frameworkId: "",
    functionalGrouping: "",
    search: "",
  });

  const fetchEvidences = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (frameworkFilter && frameworkFilter !== "all") params.append("frameworkId", frameworkFilter);
      if (departmentFilter && departmentFilter !== "all") params.append("departmentId", departmentFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm);
      params.append("page", currentPage.toString());
      params.append("limit", itemsPerPage.toString());

      const response = await fetch(`/api/evidences?${params.toString()}`);
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
  }, [frameworkFilter, departmentFilter, statusFilter, searchTerm, currentPage]);

  // Fetch status counts for dashboard
  const fetchStatusCounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (frameworkFilter && frameworkFilter !== "all") params.append("frameworkId", frameworkFilter);

      const response = await fetch(`/api/evidences/status-counts?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setStatusCounts({
          notUploaded: data.notUploaded || 0,
          draft: data.draft || 0,
          validated: data.validated || 0,
          published: data.published || 0,
          needAttention: data.needAttention || 0,
          total: data.total || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching status counts:", error);
    }
  }, [frameworkFilter]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [deptRes, usersRes, fwRes, controlsRes, domainsRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/frameworks"),
        fetch("/api/controls?limit=500"),
        fetch("/api/control-domains"),
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
      if (controlsRes.ok) {
        const data = await controlsRes.json();
        setControls(data.data || data || []);
      }
      if (domainsRes.ok) {
        const data = await domainsRes.json();
        setControlDomains(data.data || data || []);
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

  useEffect(() => {
    fetchStatusCounts();
  }, [fetchStatusCounts]);

  // Fetch artifacts
  const fetchArtifacts = useCallback(async () => {
    try {
      setArtifactsLoading(true);
      const response = await fetch("/api/artifacts");
      if (response.ok) {
        const data = await response.json();
        setArtifacts(data.data || data || []);
      }
    } catch (error) {
      console.error("Error fetching artifacts:", error);
    } finally {
      setArtifactsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "artifacts") {
      fetchArtifacts();
    }
  }, [activeTab, fetchArtifacts]);

  // Handle status card click - filter and switch to list view
  const handleStatusCardClick = (status: string | null) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // Artifact file handling
  const handleArtifactDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsArtifactDragging(true);
  };

  const handleArtifactDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsArtifactDragging(false);
  };

  const handleArtifactDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsArtifactDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleArtifactUpload(files[0]);
    }
  };

  const handleArtifactFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleArtifactUpload(file);
    }
  };

  const handleArtifactUpload = async (file: File) => {
    setUploadingArtifact(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/artifacts", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast.success("Artifact uploaded successfully");
        fetchArtifacts();
      } else {
        toast.error("Failed to upload artifact");
      }
    } catch (error) {
      console.error("Error uploading artifact:", error);
      toast.error("Failed to upload artifact");
    } finally {
      setUploadingArtifact(false);
      setArtifactFile(null);
      if (artifactFileInputRef.current) {
        artifactFileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteArtifact = async (artifactId: string) => {
    try {
      const response = await fetch(`/api/artifacts/${artifactId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Artifact deleted successfully");
        fetchArtifacts();
      } else {
        toast.error("Failed to delete artifact");
      }
    } catch (error) {
      console.error("Error deleting artifact:", error);
      toast.error("Failed to delete artifact");
    }
  };

  // Link evidence to artifact
  const openLinkEvidenceDialog = (artifact: Artifact) => {
    setSelectedArtifactForLink(artifact);
    // Pre-select already linked evidences
    const linkedIds = artifact.linkedEvidences?.map(le => le.evidenceId) || [];
    setSelectedEvidenceIds(linkedIds);
    setEvidenceSearchTerm("");
    setLinkEvidenceDialogOpen(true);
  };

  const handleLinkEvidences = async () => {
    if (!selectedArtifactForLink) return;

    setLinkingEvidence(true);
    try {
      const response = await fetch(`/api/artifacts/${selectedArtifactForLink.id}/link-evidences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceIds: selectedEvidenceIds }),
      });

      if (response.ok) {
        toast.success("Evidences linked successfully");
        setLinkEvidenceDialogOpen(false);
        fetchArtifacts();
      } else {
        toast.error("Failed to link evidences");
      }
    } catch (error) {
      console.error("Error linking evidences:", error);
      toast.error("Failed to link evidences");
    } finally {
      setLinkingEvidence(false);
    }
  };

  const toggleEvidenceSelection = (evidenceId: string) => {
    setSelectedEvidenceIds((prev) =>
      prev.includes(evidenceId)
        ? prev.filter((id) => id !== evidenceId)
        : [...prev, evidenceId]
    );
  };

  // Filter evidences for link dialog
  const filteredEvidencesForLink = evidences.filter((e) => {
    if (!evidenceSearchTerm) return true;
    const search = evidenceSearchTerm.toLowerCase();
    return (
      e.evidenceCode.toLowerCase().includes(search) ||
      e.name.toLowerCase().includes(search)
    );
  });

  // Get file icon based on type
  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (type.includes("doc") || type.includes("word")) {
      return (
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <span className="text-blue-600 text-xs font-bold">W</span>
        </div>
      );
    }
    if (type.includes("pdf")) {
      return (
        <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
          <span className="text-red-600 text-xs font-bold">PDF</span>
        </div>
      );
    }
    if (type.includes("xls") || type.includes("sheet")) {
      return (
        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
          <span className="text-green-600 text-xs font-bold">XLS</span>
        </div>
      );
    }
    return (
      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
        <FileIcon className="h-6 w-6 text-gray-500" />
      </div>
    );
  };

  // The /api/users and /api/departments endpoints already apply tenant filtering,
  // so data is already scoped to the user's customerAccountId.
  const getCustomerScopedUsers = () => users;

  const getCustomerScopedDepartments = () => departments;

  // Filter users for Assignee dropdown: only DepartmentReviewers and DepartmentContributors from the selected department
  const filteredUsers = (() => {
    if (!createForm.departmentId) return [];

    return users.filter((u) => {
      if (u.departmentId !== createForm.departmentId) return false;
      return u.userRoles?.some((ur) =>
        ["DepartmentReviewer", "DepartmentContributor"].includes(ur.role?.name)
      );
    });
  })();

  // Filtered controls for step 2
  const filteredControls = controls.filter((c) => {
    if (controlFilters.domainId && c.domain?.id !== controlFilters.domainId) return false;
    if (controlFilters.frameworkId && c.framework?.id !== controlFilters.frameworkId) return false;
    if (controlFilters.functionalGrouping && c.functionalGrouping !== controlFilters.functionalGrouping) return false;
    if (controlFilters.search) {
      const search = controlFilters.search.toLowerCase();
      if (!c.controlCode.toLowerCase().includes(search) && !c.name.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const handleSearch = () => {
    setCurrentPage(1);
    fetchEvidences();
  };

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/evidences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          recurrence: createForm.recurrence,
          departmentId: createForm.departmentId || null,
          assigneeId: createForm.assigneeId || null,
          controlIds: selectedControlIds,
          status: "Not Uploaded",
        }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        resetCreateForm();
        fetchEvidences();
      }
    } catch (error) {
      console.error("Error creating evidence:", error);
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
    });
    setSelectedControlIds([]);
    setControlFilters({
      domainId: "",
      frameworkId: "",
      functionalGrouping: "",
      search: "",
    });
  };

  const handleDeleteAll = async () => {
    try {
      const response = await fetch("/api/evidences/delete-all", {
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

      const response = await fetch("/api/evidences/import", {
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

  const toggleControlSelection = (controlId: string) => {
    setSelectedControlIds((prev) =>
      prev.includes(controlId)
        ? prev.filter((id) => id !== controlId)
        : [...prev, controlId]
    );
  };

  const canProceedStep1 = createForm.name && createForm.recurrence && createForm.departmentId && createForm.assigneeId;

  // Pagination helpers
  const startItem = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  // Show loading state while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description="You don't have permission to access Evidence." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary-600">Evidence</h1>
        <Button variant="outline" className="bg-primary-600 text-white hover:bg-primary-700 border-primary-600">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab("list");
            setStatusFilter(null);
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
            activeTab === "list"
              ? "bg-primary-600 text-white"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Evidence Request List
        </button>
        <button
          onClick={() => setActiveTab("artifacts")}
          className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-lg ${
            activeTab === "artifacts"
              ? "bg-primary-600 text-white"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Artifacts
        </button>
      </div>

      {/* Evidence Request List View */}
      {activeTab === "list" && (
        <>
          {/* Framework Filter and Action Buttons */}
          <div className="flex justify-end items-center gap-3">
            <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
              <SelectTrigger className="w-[220px] bg-white border-primary-600 text-primary-600">
                <SelectValue placeholder="Integrated Framework" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                <SelectItem value="all">Integrated Framework</SelectItem>
                {frameworks.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="bg-primary-600 text-white hover:bg-primary-700 border-primary-600">
              <Upload className="h-4 w-4 mr-2" />
              Export
            </Button>
            <PermissionGate resource="compliance.evidence" action="create">
              <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)} className="bg-primary-600 text-white hover:bg-primary-700 border-primary-600">
                <Download className="h-4 w-4 mr-2" />
                Import
              </Button>
            </PermissionGate>
            {isCustomerAdmin ? (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="bg-primary-600 text-white hover:bg-primary-700">
                <Plus className="h-4 w-4 mr-2" />
                New Evidence
              </Button>
            ) : (
              <PermissionGate resource="compliance.evidence" action="create">
                <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="bg-primary-600 text-white hover:bg-primary-700">
                  <Plus className="h-4 w-4 mr-2" />
                  New Evidence
                </Button>
              </PermissionGate>
            )}
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-5 gap-4">
            {/* Not Uploaded Card */}
            <div
              onClick={() => handleStatusCardClick("Not Uploaded")}
              className={`relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-transform hover:scale-105 ${statusFilter === "Not Uploaded" ? "ring-4 ring-white" : ""}`}
              style={{
                background: "linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 50%, #1a2f4a 100%)",
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                <div className="w-full h-full rounded-full border-[3px] border-dashed border-white" />
              </div>
              <div className="flex flex-col items-center text-white">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center mb-4">
                  <User className="h-8 w-8 text-white/80" />
                </div>
                <span className="text-4xl font-bold mb-2">{statusCounts.notUploaded}</span>
                <span className="text-sm text-white/80">Not Uploaded</span>
              </div>
            </div>

            {/* Draft Card */}
            <div
              onClick={() => handleStatusCardClick("Draft")}
              className={`relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-transform hover:scale-105 ${statusFilter === "Draft" ? "ring-4 ring-white" : ""}`}
              style={{
                background: "linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 50%, #1a2f4a 100%)",
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                <div className="w-full h-full rounded-full border-[3px] border-dashed border-white" />
              </div>
              <div className="flex flex-col items-center text-white">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-white/80" />
                </div>
                <span className="text-4xl font-bold mb-2">{statusCounts.draft}</span>
                <span className="text-sm text-white/80">Draft</span>
              </div>
            </div>

            {/* Validated Card */}
            <div
              onClick={() => handleStatusCardClick("Validated")}
              className={`relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-transform hover:scale-105 ${statusFilter === "Validated" ? "ring-4 ring-white" : ""}`}
              style={{
                background: "linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 50%, #1a2f4a 100%)",
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                <div className="w-full h-full rounded-full border-[3px] border-dashed border-white" />
              </div>
              <div className="flex flex-col items-center text-white">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center mb-4">
                  <User className="h-8 w-8 text-white/80" />
                </div>
                <span className="text-4xl font-bold mb-2">{statusCounts.validated}</span>
                <span className="text-sm text-white/80">Validated</span>
              </div>
            </div>

            {/* Published Card */}
            <div
              onClick={() => handleStatusCardClick("Published")}
              className={`relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-transform hover:scale-105 ${statusFilter === "Published" ? "ring-4 ring-white" : ""}`}
              style={{
                background: "linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 50%, #1a2f4a 100%)",
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                <div className="w-full h-full rounded-full border-[3px] border-dashed border-white" />
              </div>
              <div className="flex flex-col items-center text-white">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center mb-4">
                  <Upload className="h-8 w-8 text-white/80" />
                </div>
                <span className="text-4xl font-bold mb-2">
                  {statusCounts.published}/{statusCounts.total}
                </span>
                <span className="text-sm text-white/80">Published</span>
              </div>
            </div>

            {/* Need Attention Card */}
            <div
              onClick={() => handleStatusCardClick("Need Attention")}
              className={`relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-transform hover:scale-105 ${statusFilter === "Need Attention" ? "ring-4 ring-white" : ""}`}
              style={{
                background: "linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 50%, #1a2f4a 100%)",
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                <div className="w-full h-full rounded-full border-[3px] border-dashed border-white" />
              </div>
              <div className="flex flex-col items-center text-white">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-white/80" />
                </div>
                <span className="text-4xl font-bold mb-2">{statusCounts.needAttention}</span>
                <span className="text-sm text-white/80">Need Attention</span>
              </div>
            </div>
          </div>

          {/* Search and Department Filter Row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by Name, Domain and Assignee"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-white"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[200px] bg-white border-primary-600 text-primary-600">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                <SelectItem value="all">Department</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter Badge */}
          {statusFilter && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Filtered by:</span>
              <Badge variant="secondary" className="flex items-center gap-1">
                {statusFilter}
                <button
                  onClick={() => setStatusFilter(null)}
                  className="ml-1 hover:text-red-500"
                >
                  ×
                </button>
              </Badge>
            </div>
          )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary-600 hover:bg-primary-600">
                <TableHead className="text-xs font-semibold text-white py-4 pl-4">Evidence Name</TableHead>
                <TableHead className="text-xs font-semibold text-white py-4">Domain</TableHead>
                <TableHead className="text-xs font-semibold text-white py-4">Status</TableHead>
                <TableHead className="text-xs font-semibold text-white py-4">Full Name</TableHead>
                <TableHead className="text-xs font-semibold text-white py-4">Department Name</TableHead>
                <TableHead className="text-xs font-semibold text-white py-4">IsIssueIdentifiedByAI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidences.map((evidence) => (
                <TableRow
                  key={evidence.id}
                  className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50"
                  onDoubleClick={() => router.push(`/compliance/evidence/${evidence.id}`)}
                >
                  <TableCell className="py-4 pl-4 text-sm text-slate-700">{evidence.name}</TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">{evidence.domain || "-"}</TableCell>
                  <TableCell className="py-4">
                    <Badge className={statusColors[evidence.status] || "bg-gray-100 text-gray-800"}>
                      {evidence.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">{evidence.assignee?.fullName || "-"}</TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">{evidence.department?.name || "-"}</TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">NO</TableCell>
                </TableRow>
              ))}
              {evidences.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No evidence records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              {total > 0 ? `${startItem} to ${endItem} of ${total}` : "No evidence"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="h-8 w-8"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="h-8 w-8"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Artifacts Tab */}
      {activeTab === "artifacts" && (
        <div className="space-y-6">
          {/* Add Artifact Section */}
          <div>
            <h3 className="text-primary-600 font-medium mb-3">Add Artifact</h3>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isArtifactDragging ? "border-primary-500 bg-primary-50" : "border-slate-300 hover:border-slate-400"
              }`}
              onDragOver={handleArtifactDragOver}
              onDragLeave={handleArtifactDragLeave}
              onDrop={handleArtifactDrop}
              onClick={() => artifactFileInputRef.current?.click()}
            >
              {uploadingArtifact ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
                  <span className="text-slate-600">Uploading...</span>
                </div>
              ) : (
                <p className="text-slate-600">Drag and drop or select file.</p>
              )}
              <input
                ref={artifactFileInputRef}
                type="file"
                className="hidden"
                onChange={handleArtifactFileChange}
              />
            </div>
          </div>

          {/* AI Review Button */}
          <div>
            <Button className="bg-primary-600 text-white hover:bg-primary-700">
              AI Review Artifacts
            </Button>
          </div>

          {/* Artifacts List */}
          {artifactsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="relative h-8 w-8">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300"
                >
                  <div className="flex items-center gap-4">
                    {getFileIcon(artifact.fileType)}
                    <div>
                      <p className="text-primary-600 font-medium">
                        {artifact.artifactCode} : {artifact.fileName}
                      </p>
                      <p className="text-sm text-slate-500">
                        By <span className="text-primary-600">{artifact.uploadedBy?.fullName || "Unknown"}</span>,{" "}
                        {new Date(artifact.uploadedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-primary-600"
                      onClick={() => openLinkEvidenceDialog(artifact)}
                      title="Link to Evidence"
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-primary-600"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-primary-600"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteArtifact(artifact.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {artifacts.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No artifacts uploaded yet
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Evidence Dialog - 3 Step Wizard */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateForm();
        setCreateDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">New Evidence - Step {createStep} of 3</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-5">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 pb-5">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === createStep
                      ? "bg-primary text-primary-foreground"
                      : step < createStep
                      ? "bg-green-500 text-white"
                      : "bg-muted text-slate-400"
                  }`}>
                    {step < createStep ? <Check className="h-4 w-4" /> : step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${step < createStep ? "bg-green-500" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Basic Information */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Evidence Requirement *</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Enter evidence requirement"
                    className="mt-1.5 w-full"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Recurrence *</Label>
                  <Select value={createForm.recurrence} onValueChange={(v) => setCreateForm({ ...createForm, recurrence: v })}>
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select recurrence" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {recurrenceOptions.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Department *</Label>
                  <Select value={createForm.departmentId} onValueChange={(v) => setCreateForm({ ...createForm, departmentId: v, assigneeId: "" })}>
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {getCustomerScopedDepartments().map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Assignee *</Label>
                  <Select
                    value={createForm.assigneeId}
                    onValueChange={(v) => setCreateForm({ ...createForm, assigneeId: v })}
                    disabled={!createForm.departmentId}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={
                        !createForm.departmentId
                          ? "Select department first"
                          : "Select assignee"
                      } />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))
                      ) : (
                        <div className="py-2 px-2 text-sm text-slate-500 text-center">
                          No department reviewers found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Description</Label>
                  <Textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="Enter description"
                    rows={3}
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Link Controls */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold text-slate-800">Select Controls to Link</Label>
                  <Badge variant="secondary">{selectedControlIds.length} selected</Badge>
                </div>

                {/* Control Filters */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search controls..."
                      value={controlFilters.search}
                      onChange={(e) => setControlFilters({ ...controlFilters, search: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <Select value={controlFilters.domainId || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, domainId: v === "all" ? "" : v })}>
                    <SelectTrigger className="w-[180px] bg-white">
                      <SelectValue placeholder="Domain" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">All Domains</SelectItem>
                      {controlDomains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlFilters.functionalGrouping || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, functionalGrouping: v === "all" ? "" : v })}>
                    <SelectTrigger className="w-[180px] bg-white">
                      <SelectValue placeholder="Functional Grouping" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">All Groupings</SelectItem>
                      <SelectItem value="Govern">Govern</SelectItem>
                      <SelectItem value="Identify">Identify</SelectItem>
                      <SelectItem value="Protect">Protect</SelectItem>
                      <SelectItem value="Detect">Detect</SelectItem>
                      <SelectItem value="Respond">Respond</SelectItem>
                      <SelectItem value="Recover">Recover</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Controls Table */}
                <div className="bg-white rounded-xl border border-slate-200 max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50/50">
                        <TableHead className="w-[50px] py-4 pl-4"></TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-4">Control Code</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-4">Control Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-4">Domain</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredControls.map((control) => (
                        <TableRow key={control.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => toggleControlSelection(control.id)}>
                          <TableCell className="py-4 pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedControlIds.includes(control.id)}
                              onCheckedChange={() => toggleControlSelection(control.id)}
                            />
                          </TableCell>
                          <TableCell className="py-4 text-sm font-medium text-slate-900">{control.controlCode}</TableCell>
                          <TableCell className="py-4 text-sm text-slate-700">{control.name}</TableCell>
                          <TableCell className="py-4 text-sm text-slate-700">{control.domain?.name || "-"}</TableCell>
                        </TableRow>
                      ))}
                      {filteredControls.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                            No controls found
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
                <div className="text-lg font-medium text-slate-800">Review Information</div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <Label className="text-slate-500 text-sm">Evidence Name</Label>
                    <p className="font-medium text-slate-900">{createForm.name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Recurrence</Label>
                    <p className="font-medium text-slate-900">{createForm.recurrence}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Department</Label>
                    <p className="font-medium text-slate-900">
                      {getCustomerScopedDepartments().find((d) => d.id === createForm.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Assignee</Label>
                    <p className="font-medium text-slate-900">
                      {getCustomerScopedUsers().find((u) => u.id === createForm.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Linked Controls</Label>
                    <p className="font-medium text-slate-900">{selectedControlIds.length} controls</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Description</Label>
                    <p className="font-medium text-slate-900">{createForm.description || "-"}</p>
                  </div>
                </div>

                {selectedControlIds.length > 0 && (
                  <div>
                    <Label className="text-slate-500 text-sm mb-2 block">Selected Controls:</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedControlIds.map((id) => {
                        const control = controls.find((c) => c.id === id);
                        return control ? (
                          <Badge key={id} variant="outline">
                            {control.controlCode}
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
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else {
                resetCreateForm();
                setCreateDialogOpen(false);
              }
            }}>
              {createStep === 1 ? "Cancel" : "Previous"}
            </Button>
            <Button
              onClick={() => {
                if (createStep < 3) setCreateStep(createStep + 1);
                else handleCreate();
              }}
              disabled={createStep === 1 && !canProceedStep1}
            >
              {createStep === 3 ? "Create Evidence" : "Next"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Evidence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all evidence records? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                Import Evidence
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <p className="text-sm text-slate-500 mb-4">
              Upload a CSV or Excel file to import evidence records.
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
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-300" />
                  <div>
                    <p className="text-sm text-slate-600">
                      Drag and drop a file here, or click to browse
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Supported formats: CSV, XLSX, XLS
                    </p>
                  </div>
                  <input
                    ref={importFileInputRef}
                    type="file"
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
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setImportFile(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleImportSubmit} disabled={!importFile || importing}>
              {importing ? "Importing..." : "Import"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Evidence Dialog */}
      <Dialog open={linkEvidenceDialogOpen} onOpenChange={setLinkEvidenceDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 max-h-[80vh] flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-primary-600">Select Evidence</DialogTitle>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by Evidence Code , Name"
                value={evidenceSearchTerm}
                onChange={(e) => setEvidenceSearchTerm(e.target.value)}
                className="pl-10 border-primary-600 text-primary-600 placeholder:text-primary-400"
              />
            </div>

            {/* Evidence List */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {filteredEvidencesForLink.map((evidence) => {
                const isSelected = selectedEvidenceIds.includes(evidence.id);
                const isLinked = selectedArtifactForLink?.linkedEvidences?.some(
                  (le) => le.evidenceId === evidence.id
                );

                return (
                  <div
                    key={evidence.id}
                    onClick={() => toggleEvidenceSelection(evidence.id)}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary-600 bg-primary-50"
                        : "border-primary-200 hover:border-primary-400"
                    }`}
                  >
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleEvidenceSelection(evidence.id)}
                        className="border-primary-400"
                      />
                    </div>
                    <span className="text-primary-600 font-medium flex-1">
                      {evidence.evidenceCode} : {evidence.name}
                    </span>
                    {isLinked && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                );
              })}
              {filteredEvidencesForLink.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No evidence found
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
            <Button
              onClick={handleLinkEvidences}
              disabled={linkingEvidence || selectedEvidenceIds.length === 0}
              className="bg-primary-600 text-white hover:bg-primary-700"
            >
              {linkingEvidence ? "Linking..." : "Link Evidences"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

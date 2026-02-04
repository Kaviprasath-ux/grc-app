"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
  ChevronsLeft,
  ChevronsRight,
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
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { canView, canCreate, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.evidence');
  const isCustomerAdmin = useHasRole("CustomerAdministrator");
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);

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

  // Status counts
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([
    { status: "Not Uploaded", count: 0 },
    { status: "Draft", count: 0 },
    { status: "Validated", count: 0 },
    { status: "Published", count: 0, total: 0 },
    { status: "Need Attention", count: 0 },
  ]);

  // Selected status filter for tile cards
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

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
      if (searchTerm) params.append("search", searchTerm);
      if (selectedStatus) params.append("status", selectedStatus);
      params.append("page", currentPage.toString());
      params.append("limit", itemsPerPage.toString());

      const response = await fetch(`/api/evidences?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEvidences(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);

        // Calculate status counts from the data
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
        setStatusCounts([
          { status: "Not Uploaded", count: counts["Not Uploaded"] },
          { status: "Draft", count: counts["Draft"] },
          { status: "Validated", count: counts["Validated"] },
          { status: "Published", count: counts["Published"], total: data.pagination?.total || 0 },
          { status: "Need Attention", count: counts["Need Attention"] },
        ]);
      }
    } catch (error) {
      console.error("Error fetching evidences:", error);
    } finally {
      setLoading(false);
    }
  }, [frameworkFilter, departmentFilter, searchTerm, selectedStatus, currentPage]);

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
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/artifacts", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          // Refresh artifacts list after upload
          await fetchArtifacts();
        }
      } catch (error) {
        console.error("Error uploading artifact:", error);
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
      const response = await fetch(`/api/artifacts/${id}`, {
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
      const response = await fetch("/api/artifacts");
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
      const response = await fetch(`/api/artifacts/${selectedArtifactForLink.id}/link-evidences`, {
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

  // Filter evidences for link dialog
  const filteredEvidencesForLink = evidences.filter((e) => {
    if (!linkEvidenceSearchTerm) return true;
    const search = linkEvidenceSearchTerm.toLowerCase();
    return (
      e.evidenceCode.toLowerCase().includes(search) ||
      e.name.toLowerCase().includes(search)
    );
  });

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
    return <Unauthorized description={t("You don't have permission to access Evidence.")} />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Evidence")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Evidence")}</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
          <div className="grid grid-cols-5 gap-4">
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
                  className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-all ${
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
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
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

          {/* Search, Filter, and Action Buttons Row */}
          <div className="flex items-center gap-3">
            <Input
              placeholder={t("Search by name, domain or assignee...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="max-w-md bg-white"
            />
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue placeholder={t("Department")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                <SelectItem value="all">{t("All Departments")}</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue placeholder={t("Integrated Framework")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                <SelectItem value="all">{t("Integrated Framework")}</SelectItem>
                {frameworks.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <PermissionGate resource="compliance.evidence" action="create">
              <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Import")}
              </Button>
            </PermissionGate>
            <PermissionGate resource="compliance.evidence" action="delete">
              <Button variant="outline" size="sm" className="text-semantic-error hover:text-semantic-error hover:bg-red-50" onClick={() => setIsDeleteAllDialogOpen(true)}>
                <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Delete All")}
              </Button>
            </PermissionGate>
            {isCustomerAdmin ? (
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("New Evidence")}
              </Button>
            ) : (
              <PermissionGate resource="compliance.evidence" action="create">
                <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("New Evidence")}
                </Button>
              </PermissionGate>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="relative h-8 w-8">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 bg-slate-50/50">
                    <TableHead className="text-xs font-semibold text-slate-600 py-4 pl-4">{t("Evidence Code")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Evidence Name")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Domain")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Issue Identified By")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Assignee")}</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Department Name")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evidences.map((evidence) => (
                    <TableRow
                      key={evidence.id}
                      className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50"
                      onDoubleClick={() => router.push(`/compliance/evidence/${evidence.id}`)}
                    >
                      <TableCell className="py-4 pl-4 text-sm font-medium text-slate-900">{evidence.evidenceCode}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-700">{evidence.name}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-700">{evidence.domain || "-"}</TableCell>
                      <TableCell className="py-4">
                        <Badge className={statusColors[evidence.status] || "bg-gray-100 text-gray-800"}>
                          {evidence.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-700">{evidence.issueIdentifiedBy || "-"}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-700">{evidence.assignee?.fullName || "-"}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-700">{evidence.department?.name || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {evidences.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        {t("No evidence records found")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-sm text-slate-500">
                  {total > 0 ? `${startItem} ${t("to")} ${endItem} ${t("of")} ${total}` : t("No evidence")}
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
        </TabsContent>

        {/* Artifacts Tab */}
        <TabsContent value="artifacts" className="mt-6 space-y-6">
          {/* Add Artifact Header and AI Review Button */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">{t("Add Artifact")}</h3>
            <Button variant="outline" size="sm" className="gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              {t("AI Review Artifacts")}
            </Button>
          </div>

          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              artifactDragging
                ? "border-primary-500 bg-primary-50"
                : "border-slate-300 hover:border-slate-400 bg-slate-50"
            }`}
            onDragOver={handleArtifactDragOver}
            onDragLeave={handleArtifactDragLeave}
            onDrop={handleArtifactDrop}
          >
            <input
              ref={artifactFileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleArtifactFileChange}
            />
            <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <p className="text-slate-600 mb-2">
              {t("Drag and drop files here, or")}{" "}
              <button
                onClick={() => artifactFileInputRef.current?.click()}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                {t("click to upload")}
              </button>
            </p>
            <p className="text-sm text-slate-400">
              {t("Supported formats: PDF, PNG, JPG, XLSX, DOC, DOCX")}
            </p>
          </div>

          {/* Artifacts List */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{t("Uploaded Artifacts")}</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {artifacts.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  {t("No artifacts uploaded yet")}
                </div>
              ) : (
                artifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {getFileIcon(artifact.fileType || "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary truncate">
                        {artifact.artifactCode} : {artifact.fileName}
                      </p>
                      <p className="text-sm text-slate-500">
                        {t("By")} {artifact.uploadedBy?.fullName || "Unknown"}, {new Date(artifact.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-primary"
                        onClick={() => openLinkEvidenceDialog(artifact)}
                        title={t("Link to Evidence")}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                        onClick={() => handleDeleteArtifact(artifact.id)}
                      >
                        <X className="h-4 w-4" />
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
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Evidence")} - {t("Step")} {createStep} {t("of")} 3</DialogTitle>
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
                  <Label className="text-sm font-medium text-slate-700">{t("Evidence Requirement")} *</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder={t("Enter evidence requirement")}
                    className="mt-1.5 w-full"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Recurrence")} *</Label>
                  <Select value={createForm.recurrence} onValueChange={(v) => setCreateForm({ ...createForm, recurrence: v })}>
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select recurrence")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {recurrenceOptions.map((r) => (
                        <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Department")} *</Label>
                  <Select value={createForm.departmentId} onValueChange={(v) => setCreateForm({ ...createForm, departmentId: v, assigneeId: "" })}>
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select department")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {getCustomerScopedDepartments().map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Assignee")} *</Label>
                  <Select
                    value={createForm.assigneeId}
                    onValueChange={(v) => setCreateForm({ ...createForm, assigneeId: v })}
                    disabled={!createForm.departmentId}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
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
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
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

            {/* Step 2: Link Controls */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold text-slate-800">{t("Select Controls to Link")}</Label>
                  <Badge variant="secondary">{selectedControlIds.length} {t("selected")}</Badge>
                </div>

                {/* Control Filters */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder={t("Search controls...")}
                      value={controlFilters.search}
                      onChange={(e) => setControlFilters({ ...controlFilters, search: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <Select value={controlFilters.domainId || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, domainId: v === "all" ? "" : v })}>
                    <SelectTrigger className="w-[180px] bg-white">
                      <SelectValue placeholder={t("Domain")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Domains")}</SelectItem>
                      {controlDomains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlFilters.functionalGrouping || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, functionalGrouping: v === "all" ? "" : v })}>
                    <SelectTrigger className="w-[180px] bg-white">
                      <SelectValue placeholder={t("Functional Grouping")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Groupings")}</SelectItem>
                      <SelectItem value="Govern">{t("Govern")}</SelectItem>
                      <SelectItem value="Identify">{t("Identify")}</SelectItem>
                      <SelectItem value="Protect">{t("Protect")}</SelectItem>
                      <SelectItem value="Detect">{t("Detect")}</SelectItem>
                      <SelectItem value="Respond">{t("Respond")}</SelectItem>
                      <SelectItem value="Recover">{t("Recover")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Controls Table */}
                <div className="bg-white rounded-xl border border-slate-200 max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50/50">
                        <TableHead className="w-[50px] py-4 pl-4"></TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Control Code")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Control Name")}</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Domain")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredControls.map((control) => (
                        <TableRow key={control.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <TableCell className="py-4 pl-4">
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

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Evidence Name")}</Label>
                    <p className="font-medium text-slate-900">{createForm.name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Recurrence")}</Label>
                    <p className="font-medium text-slate-900">{createForm.recurrence}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Department")}</Label>
                    <p className="font-medium text-slate-900">
                      {getCustomerScopedDepartments().find((d) => d.id === createForm.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Assignee")}</Label>
                    <p className="font-medium text-slate-900">
                      {getCustomerScopedUsers().find((u) => u.id === createForm.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Linked Controls")}</Label>
                    <p className="font-medium text-slate-900">{selectedControlIds.length} {t("controls")}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Description")}</Label>
                    <p className="font-medium text-slate-900">{createForm.description || "-"}</p>
                  </div>
                </div>

                {selectedControlIds.length > 0 && (
                  <div>
                    <Label className="text-slate-500 text-sm mb-2 block">{t("Selected Controls")}:</Label>
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
              {createStep === 1 ? t("Cancel") : t("Previous")}
            </Button>
            <Button
              onClick={() => {
                if (createStep < 3) setCreateStep(createStep + 1);
                else handleCreate();
              }}
              disabled={createStep === 1 && !canProceedStep1}
            >
              {createStep === 3 ? t("Create Evidence") : t("Next")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete All Evidence")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete all evidence records? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
              {t("Delete All")}
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
                {t("Import Evidence")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
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
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-300" />
                  <div>
                    <p className="text-sm text-slate-600">
                      {t("Drag and drop a file here, or click to browse")}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {t("Supported formats: CSV, XLSX, XLS")}
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
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <DialogTitle className="text-lg font-semibold text-primary">
              {t("Select Evidence")}
            </DialogTitle>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("Search by Evidence Code , Name")}
                value={linkEvidenceSearchTerm}
                onChange={(e) => setLinkEvidenceSearchTerm(e.target.value)}
                className="pl-10 border-primary"
              />
            </div>

            {/* Evidence List */}
            <div className="space-y-3">
              {filteredEvidencesForLink.map((evidence) => {
                const isSelected = selectedEvidenceIdsForLink.includes(evidence.id);
                return (
                  <div
                    key={evidence.id}
                    onClick={() => toggleEvidenceForLink(evidence.id)}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-primary/30 hover:border-primary/50"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-primary border-primary" : "border-slate-300"
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-sm text-primary font-medium">
                      {evidence.evidenceCode} : {evidence.name}
                    </span>
                  </div>
                );
              })}
              {filteredEvidencesForLink.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  {t("No evidences found")}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end flex-shrink-0">
            <Button onClick={handleLinkEvidences}>
              {t("Link Evidences")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

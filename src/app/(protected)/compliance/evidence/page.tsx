"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Unauthorized } from "@/components/ui/unauthorized";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Search,
  Plus,
  Upload,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  Download,
  Link2,
  FileText,
} from "lucide-react";

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

interface ArtifactDocument {
  id: string;
  documentCode: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  status: string;
  uploadedAt: string;
  uploadedBy: string | null;
  source: "artifact" | "attachment";
  linkedEvidences: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    linkedAt: string;
  }>;
}

const statusColors: Record<string, string> = {
  "Not Uploaded": "bg-gray-100 text-gray-800",
  Draft: "bg-yellow-100 text-yellow-800",
  Validated: "bg-blue-100 text-blue-800",
  Published: "bg-green-100 text-green-800",
  "Need Attention": "bg-red-100 text-red-800",
};

const recurrenceOptions = ["Yearly", "Half-yearly", "Quarterly", "Monthly"];

export default function EvidencePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { canView, canCreate, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.evidence');
  const isCustomerAdmin = useHasRole("CustomerAdministrator");
  const isGRCAdmin = useHasRole("GRCAdministrator");
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);

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

  // Tab state (for Customer Admin only)
  const [activeTab, setActiveTab] = useState<string>("Evidence Request List");

  // Artifact states (Customer Admin only)
  const [artifacts, setArtifacts] = useState<ArtifactDocument[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactFile, setArtifactFile] = useState<File | null>(null);
  const [artifactUploading, setArtifactUploading] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [artifactToLink, setArtifactToLink] = useState<ArtifactDocument | null>(null);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [isDeleteArtifactDialogOpen, setIsDeleteArtifactDialogOpen] = useState(false);
  const [artifactToDelete, setArtifactToDelete] = useState<ArtifactDocument | null>(null);
  const [allEvidenceRecords, setAllEvidenceRecords] = useState<Evidence[]>([]);
  const [linkDialogLoading, setLinkDialogLoading] = useState(false);

  const fetchEvidences = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (frameworkFilter && frameworkFilter !== "all") params.append("frameworkId", frameworkFilter);
      if (departmentFilter && departmentFilter !== "all") params.append("departmentId", departmentFilter);
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
  }, [frameworkFilter, departmentFilter, searchTerm, currentPage]);

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

  // Fetch artifacts when Customer Admin views the Artifacts tab
  useEffect(() => {
    if (activeTab === "Artifacts" && !isGRCAdmin) {
      fetchArtifacts();
    }
  }, [activeTab, isGRCAdmin]);

  // Artifact functions (Customer Admin only)
  const fetchArtifacts = async () => {
    try {
      setArtifactsLoading(true);
      const response = await fetch("/api/evidence-artifacts");
      if (response.ok) {
        const data = await response.json();
        setArtifacts(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching artifacts:", error);
    } finally {
      setArtifactsLoading(false);
    }
  };

  const handleArtifactUpload = async () => {
    if (!artifactFile) return;
    try {
      setArtifactUploading(true);
      const formData = new FormData();
      formData.append("file", artifactFile);

      const response = await fetch("/api/evidence-artifacts", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setArtifactFile(null);
        fetchArtifacts();
      }
    } catch (error) {
      console.error("Error uploading artifact:", error);
    } finally {
      setArtifactUploading(false);
    }
  };

  const handleOpenLinkDialog = async (artifact: ArtifactDocument) => {
    setArtifactToLink(artifact);
    setSelectedEvidenceIds(artifact.linkedEvidences.map((e) => e.id));
    setIsLinkDialogOpen(true);
    setLinkDialogLoading(true);

    try {
      // Fetch all evidence records
      const response = await fetch("/api/evidences?limit=500");
      if (response.ok) {
        const data = await response.json();
        setAllEvidenceRecords(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching evidence records:", error);
    } finally {
      setLinkDialogLoading(false);
    }
  };

  const handleSaveArtifactLinks = async () => {
    if (!artifactToLink) return;
    try {
      const response = await fetch(`/api/evidence-artifacts/${artifactToLink.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceIds: selectedEvidenceIds }),
      });

      if (response.ok) {
        setIsLinkDialogOpen(false);
        setArtifactToLink(null);
        setSelectedEvidenceIds([]);
        fetchArtifacts();
      }
    } catch (error) {
      console.error("Error updating artifact links:", error);
    }
  };

  const handleDeleteArtifact = async () => {
    if (!artifactToDelete) return;
    try {
      const response = await fetch(`/api/evidence-artifacts/${artifactToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setIsDeleteArtifactDialogOpen(false);
        setArtifactToDelete(null);
        fetchArtifacts();
      }
    } catch (error) {
      console.error("Error deleting artifact:", error);
    }
  };

  const handleDownloadArtifact = (artifact: ArtifactDocument) => {
    const link = document.createElement("a");
    link.href = artifact.filePath;
    link.download = artifact.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description="You don't have permission to access Evidence." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Evidence</h1>
        <div className="flex gap-2">
          {/* Show New Evidence button for Customer Admin or users with create permission */}
          {isCustomerAdmin ? (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Evidence
            </Button>
          ) : (
            <PermissionGate resource="compliance.evidence" action="create">
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Evidence
              </Button>
            </PermissionGate>
          )}
          <PermissionGate resource="compliance.evidence" action="create">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </PermissionGate>
          <PermissionGate resource="compliance.evidence" action="delete">
            <Button variant="outline" onClick={() => setIsDeleteAllDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Tabs for Customer Admin, no tabs for GRC Admin */}
      {isGRCAdmin ? (
        // GRC Admin: Show evidence list without tabs
        <>
          {/* Search and Filter Row */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Input
                placeholder="Search by Name, Domain and Assignee"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={handleSearch}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Integrated Framework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Integrated Framework</SelectItem>
                {frameworks.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table for GRC Admin */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evidence Code</TableHead>
                      <TableHead>Evidence Name</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Department Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evidences.map((evidence) => (
                      <TableRow
                        key={evidence.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onDoubleClick={() => router.push(`/compliance/evidence/${evidence.id}`)}
                      >
                        <TableCell className="font-medium">{evidence.evidenceCode}</TableCell>
                        <TableCell>{evidence.name}</TableCell>
                        <TableCell>{evidence.domain || ""}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[evidence.status] || "bg-gray-100 text-gray-800"}>
                            {evidence.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{evidence.assignee?.fullName || ""}</TableCell>
                        <TableCell>{evidence.department?.name || ""}</TableCell>
                      </TableRow>
                    ))}
                    {evidences.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No evidence records found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination for GRC Admin */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  Currently showing {startItem} to {endItem} of {total}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </>
      ) : (
        // Customer Admin and other customer roles: Show tabs
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="Evidence Request List">Evidence Request List</TabsTrigger>
            <TabsTrigger value="Artifacts">Artifacts</TabsTrigger>
          </TabsList>

          {/* Evidence Request List Tab */}
          <TabsContent value="Evidence Request List" className="mt-4 space-y-4">
            {/* Search and Filter Row */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Input
                  placeholder="Search by Name, Domain and Assignee"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={handleSearch}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Integrated Framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Integrated Framework</SelectItem>
                  {frameworks.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Evidence Code</TableHead>
                        <TableHead>Evidence Name</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Department Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evidences.map((evidence) => (
                        <TableRow
                          key={evidence.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onDoubleClick={() => router.push(`/compliance/evidence/${evidence.id}`)}
                        >
                          <TableCell className="font-medium">{evidence.evidenceCode}</TableCell>
                          <TableCell>{evidence.name}</TableCell>
                          <TableCell>{evidence.domain || ""}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[evidence.status] || "bg-gray-100 text-gray-800"}>
                              {evidence.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{evidence.assignee?.fullName || ""}</TableCell>
                          <TableCell>{evidence.department?.name || ""}</TableCell>
                        </TableRow>
                      ))}
                      {evidences.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No evidence records found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-4">
                    Currently showing {startItem} to {endItem} of {total}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Artifacts Tab */}
          <TabsContent value="Artifacts" className="mt-4">
            <div className="space-y-6">
              {/* File Upload Section */}
              <div className="border rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">Upload Artifact</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setArtifactFile(file);
                      }}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                    />
                  </div>
                  <Button
                    onClick={handleArtifactUpload}
                    disabled={!artifactFile || artifactUploading}
                  >
                    {artifactUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
                {artifactFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Selected: {artifactFile.name}
                  </p>
                )}
              </div>

              {/* Artifacts Listing */}
              {artifactsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document ID</TableHead>
                        <TableHead>Document Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Linked To</TableHead>
                        <TableHead>Date Uploaded</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {artifacts.map((artifact) => (
                        <TableRow key={`${artifact.source}-${artifact.id}`}>
                          <TableCell className="font-medium">{artifact.documentCode}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {artifact.fileName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {artifact.fileType?.toUpperCase() || "FILE"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={artifact.status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                              {artifact.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {artifact.linkedEvidences.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {artifact.linkedEvidences.slice(0, 2).map((e) => (
                                  <Badge key={e.id} variant="secondary" className="text-xs">
                                    {e.code}
                                  </Badge>
                                ))}
                                {artifact.linkedEvidences.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{artifact.linkedEvidences.length - 2}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Not linked</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(artifact.uploadedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {artifact.source === "artifact" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Link / Delink Evidence"
                                  onClick={() => handleOpenLinkDialog(artifact)}
                                >
                                  <Link2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled
                                  title={`Already linked to ${artifact.linkedEvidences[0]?.code || 'evidence'}`}
                                >
                                  <Link2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Download"
                                onClick={() => handleDownloadArtifact(artifact)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {artifact.source === "artifact" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Delete"
                                  onClick={() => {
                                    setArtifactToDelete(artifact);
                                    setIsDeleteArtifactDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {artifacts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No artifacts in the vault. Upload your first artifact above.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Create Evidence Dialog - 3 Step Wizard */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateForm();
        setCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              New Evidence - Step {createStep} of 3
            </DialogTitle>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === createStep
                    ? "bg-primary text-primary-foreground"
                    : step < createStep
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {step < createStep ? <Check className="h-4 w-4" /> : step}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 mx-2 ${step < createStep ? "bg-green-500" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="py-4">
            {/* Step 1: Basic Information */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Evidence Requirement *</Label>
                  <Input
                    id="name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Enter evidence requirement"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="recurrence">Recurrence *</Label>
                    <Select value={createForm.recurrence} onValueChange={(v) => setCreateForm({ ...createForm, recurrence: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select recurrence" />
                      </SelectTrigger>
                      <SelectContent>
                        {recurrenceOptions.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="departmentId">Department *</Label>
                    <Select value={createForm.departmentId} onValueChange={(v) => setCreateForm({ ...createForm, departmentId: v, assigneeId: "" })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {getCustomerScopedDepartments().map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="assigneeId">Assignee *</Label>
                  <Select
                    value={createForm.assigneeId}
                    onValueChange={(v) => setCreateForm({ ...createForm, assigneeId: v })}
                    disabled={!createForm.departmentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !createForm.departmentId
                          ? "Select department first"
                          : "Select assignee"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))
                      ) : (
                        <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                          No department reviewers found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="Enter description"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Link Controls */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-medium">Select Controls to Link</Label>
                  <Badge variant="secondary">{selectedControlIds.length} selected</Badge>
                </div>

                {/* Control Filters */}
                <div className="grid grid-cols-3 gap-4">
                  <Select value={controlFilters.domainId || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, domainId: v === "all" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Domain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Domains</SelectItem>
                      {controlDomains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlFilters.frameworkId || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, frameworkId: v === "all" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Framework" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Frameworks</SelectItem>
                      {frameworks.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlFilters.functionalGrouping || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, functionalGrouping: v === "all" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Functional Grouping" />
                    </SelectTrigger>
                    <SelectContent>
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

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search controls..."
                    value={controlFilters.search}
                    onChange={(e) => setControlFilters({ ...controlFilters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>

                {/* Controls Table */}
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Control Code</TableHead>
                        <TableHead>Control Name</TableHead>
                        <TableHead>Domain</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredControls.map((control) => (
                        <TableRow key={control.id} className="cursor-pointer" onClick={() => toggleControlSelection(control.id)}>
                          <TableCell>
                            <Checkbox
                              checked={selectedControlIds.includes(control.id)}
                              onCheckedChange={() => toggleControlSelection(control.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{control.controlCode}</TableCell>
                          <TableCell>{control.name}</TableCell>
                          <TableCell>{control.domain?.name || "-"}</TableCell>
                        </TableRow>
                      ))}
                      {filteredControls.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                <div className="text-lg font-medium">Review Information</div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <Label className="text-muted-foreground text-sm">Evidence Name</Label>
                    <p className="font-medium">{createForm.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Recurrence</Label>
                    <p className="font-medium">{createForm.recurrence}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Department</Label>
                    <p className="font-medium">
                      {getCustomerScopedDepartments().find((d) => d.id === createForm.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Assignee</Label>
                    <p className="font-medium">
                      {getCustomerScopedUsers().find((u) => u.id === createForm.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Linked Controls</Label>
                    <p className="font-medium">{selectedControlIds.length} controls</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Description</Label>
                    <p className="font-medium">{createForm.description || "-"}</p>
                  </div>
                </div>

                {selectedControlIds.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-sm mb-2 block">Selected Controls:</Label>
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

          <DialogFooter>
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
          </DialogFooter>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Evidence</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {importFile ? (
                <div className="space-y-2">
                  <p className="font-medium">{importFile.name}</p>
                  <Button variant="outline" size="sm" onClick={() => setImportFile(null)}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Drag and drop a file here, or click to browse
                  </p>
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    id="import-file"
                    onChange={handleImportFileChange}
                  />
                  <Button variant="outline" onClick={() => document.getElementById("import-file")?.click()}>
                    Browse Files
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setImportFile(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleImportSubmit} disabled={!importFile || importing}>
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link / Delink Artifact to Evidence Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsLinkDialogOpen(false);
          setArtifactToLink(null);
          setSelectedEvidenceIds([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Link / Delink Evidence</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {artifactToLink && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Artifact:</p>
                <p className="font-medium">{artifactToLink.fileName}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mb-4">
              Check to link, uncheck to delink. Changes are applied on save.
            </p>
            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              {linkDialogLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allEvidenceRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No evidence records found. Please create evidence first.
                        </TableCell>
                      </TableRow>
                    ) : (
                      allEvidenceRecords.map((evidence) => (
                        <TableRow
                          key={evidence.id}
                          className="cursor-pointer"
                          onClick={() => {
                            setSelectedEvidenceIds((prev) =>
                              prev.includes(evidence.id)
                                ? prev.filter((id) => id !== evidence.id)
                                : [...prev, evidence.id]
                            );
                          }}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedEvidenceIds.includes(evidence.id)}
                              onCheckedChange={(checked) => {
                                setSelectedEvidenceIds((prev) =>
                                  checked
                                    ? [...prev, evidence.id]
                                    : prev.filter((id) => id !== evidence.id)
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{evidence.evidenceCode}</TableCell>
                          <TableCell>{evidence.name}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[evidence.status] || "bg-gray-100 text-gray-800"}>
                              {evidence.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
            {selectedEvidenceIds.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {selectedEvidenceIds.length} evidence record(s) selected
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsLinkDialogOpen(false);
              setArtifactToLink(null);
              setSelectedEvidenceIds([]);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveArtifactLinks}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Artifact Dialog */}
      <AlertDialog open={isDeleteArtifactDialogOpen} onOpenChange={setIsDeleteArtifactDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Artifact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this artifact?
              <br /><br />
              <strong>&quot;{artifactToDelete?.fileName}&quot;</strong>
              <br /><br />
              This will permanently remove the artifact and all linked evidence associations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setArtifactToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteArtifact} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

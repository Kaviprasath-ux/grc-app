"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  FileText,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  Link2,
  Eye,
  Trash2,
  LayoutDashboard,
  ClipboardList,
  FolderOpen,
  Menu,
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

interface User {
  id: string;
  fullName: string;
  departmentId: string | null;
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
  name: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string | null;
  uploadedBy: string | null;
  createdAt: string;
  aiReviewStatus: string | null;
  aiReviewScore: number | null;
  aiReviewNotes: string | null;
  uploader?: { fullName: string } | null;
  _count?: { linkedEvidences: number };
}

const statusColors: Record<string, string> = {
  "Not Uploaded": "bg-gray-500 text-white",
  Draft: "bg-yellow-500 text-white",
  Validated: "bg-blue-500 text-white",
  Published: "bg-green-600 text-white",
  "Need Attention": "bg-red-600 text-white",
};

const recurrenceOptions = ["Yearly", "Half-yearly", "Quarterly", "Monthly"];

export default function EvidencePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("Dashboard");
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [allEvidences, setAllEvidences] = useState<Evidence[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);

  // Artifact upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Import dialog states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [artifactPagination, setArtifactPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Link to Evidence dialog states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedArtifactForLink, setSelectedArtifactForLink] = useState<Artifact | null>(null);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [linkSearchTerm, setLinkSearchTerm] = useState("");
  const [linking, setLinking] = useState(false);

  // View artifact dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedArtifactForView, setSelectedArtifactForView] = useState<Artifact | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    frameworkId: "",
    departmentId: "",
    status: "",
  });

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    evidenceCode: true,
    name: true,
    domain: true,
    status: true,
    assignee: true,
    department: true,
    recurrence: true,
  });

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [controlDomains, setControlDomains] = useState<ControlDomain[]>([]);

  // Status counts
  const [statusCounts, setStatusCounts] = useState({
    total: 0,
    notUploaded: 0,
    draft: 0,
    validated: 0,
    published: 0,
    needAttention: 0,
  });

  // Dashboard stats
  const [departmentStats, setDepartmentStats] = useState<Record<string, number>>({});
  const [recurrenceStats, setRecurrenceStats] = useState<Record<string, number>>({});

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

  const fetchAllEvidencesForStats = async () => {
    try {
      const response = await fetch("/api/evidences?limit=10000");
      if (response.ok) {
        const data = await response.json();
        const evidencesData = data.data || [];
        setAllEvidences(evidencesData);
        calculateDashboardStats(evidencesData);
      }
    } catch (error) {
      console.error("Error fetching all evidences:", error);
    }
  };

  const calculateDashboardStats = (evidencesData: Evidence[]) => {
    // Status counts
    const counts = {
      total: evidencesData.length,
      notUploaded: evidencesData.filter((e) => e.status === "Not Uploaded").length,
      draft: evidencesData.filter((e) => e.status === "Draft").length,
      validated: evidencesData.filter((e) => e.status === "Validated").length,
      published: evidencesData.filter((e) => e.status === "Published").length,
      needAttention: evidencesData.filter((e) => e.status === "Need Attention").length,
    };
    setStatusCounts(counts);

    // Department stats
    const deptStats: Record<string, number> = {};
    evidencesData.forEach((e) => {
      const deptName = e.department?.name || "Unassigned";
      deptStats[deptName] = (deptStats[deptName] || 0) + 1;
    });
    setDepartmentStats(deptStats);

    // Recurrence stats
    const recStats: Record<string, number> = {};
    evidencesData.forEach((e) => {
      const rec = e.recurrence || "Not Set";
      recStats[rec] = (recStats[rec] || 0) + 1;
    });
    setRecurrenceStats(recStats);
  };

  const fetchEvidences = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.frameworkId) params.append("frameworkId", filters.frameworkId);
      if (filters.departmentId) params.append("departmentId", filters.departmentId);
      if (filters.status && filters.status !== "all") params.append("status", filters.status);
      if (searchTerm) params.append("search", searchTerm);
      params.append("page", pagination.page.toString());
      params.append("limit", pagination.limit.toString());

      const response = await fetch(`/api/evidences?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEvidences(data.data || []);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error("Error fetching evidences:", error);
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm, pagination.page, pagination.limit]);

  const fetchArtifacts = useCallback(async (page = 1, append = false) => {
    try {
      const response = await fetch(`/api/artifacts?page=${page}&limit=${artifactPagination.limit}`);
      if (response.ok) {
        const data = await response.json();
        if (append) {
          setArtifacts(prev => [...prev, ...(data.data || [])]);
        } else {
          setArtifacts(data.data || []);
        }
        setArtifactPagination(prev => ({
          ...prev,
          page,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error("Error fetching artifacts:", error);
    }
  }, [artifactPagination.limit]);

  // Artifact upload handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);

      // First upload the file
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file");
      }

      const uploadData = await uploadRes.json();

      // Then create the artifact record
      const artifactRes = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          fileName: uploadData.file.fileName,
          fileType: uploadData.file.fileType,
          fileSize: uploadData.file.fileSize,
          filePath: uploadData.file.filePath,
          uploadedBy: "Current User", // TODO: Get from session
        }),
      });

      if (artifactRes.ok) {
        // Refresh artifacts list
        fetchArtifacts(1, false);
      }
    } catch (error) {
      console.error("Error uploading artifact:", error);
      alert("Failed to upload artifact. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteArtifact = async (artifactId: string) => {
    if (!confirm("Are you sure you want to delete this artifact?")) {
      return;
    }

    try {
      const response = await fetch(`/api/artifacts/${artifactId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Remove from local state
        setArtifacts(prev => prev.filter(a => a.id !== artifactId));
      } else {
        alert("Failed to delete artifact");
      }
    } catch (error) {
      console.error("Error deleting artifact:", error);
      alert("Failed to delete artifact");
    }
  };

  const handleDownload = (artifact: Artifact) => {
    if (artifact.filePath) {
      const link = document.createElement("a");
      link.href = artifact.filePath;
      link.download = artifact.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const loadMoreArtifacts = () => {
    const nextPage = artifactPagination.page + 1;
    fetchArtifacts(nextPage, true);
  };

  // Link to Evidence handlers
  const openLinkDialog = (artifact: Artifact) => {
    setSelectedArtifactForLink(artifact);
    setSelectedEvidenceIds([]);
    setLinkSearchTerm("");
    setLinkDialogOpen(true);
  };

  const toggleEvidenceSelection = (evidenceId: string) => {
    setSelectedEvidenceIds(prev =>
      prev.includes(evidenceId)
        ? prev.filter(id => id !== evidenceId)
        : [...prev, evidenceId]
    );
  };

  const handleLinkToEvidence = async () => {
    if (!selectedArtifactForLink || selectedEvidenceIds.length === 0) return;

    setLinking(true);
    try {
      // Link artifact to each selected evidence
      for (const evidenceId of selectedEvidenceIds) {
        await fetch(`/api/evidences/${evidenceId}/artifacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifactId: selectedArtifactForLink.id }),
        });
      }

      setLinkDialogOpen(false);
      setSelectedArtifactForLink(null);
      setSelectedEvidenceIds([]);
      alert(`Artifact linked to ${selectedEvidenceIds.length} evidence(s) successfully!`);
    } catch (error) {
      console.error("Error linking artifact:", error);
      alert("Failed to link artifact to evidence");
    } finally {
      setLinking(false);
    }
  };

  // Filtered evidences for link dialog
  const filteredEvidencesForLink = allEvidences.filter(e => {
    if (!linkSearchTerm) return true;
    const search = linkSearchTerm.toLowerCase();
    return (
      e.evidenceCode.toLowerCase().includes(search) ||
      e.name.toLowerCase().includes(search) ||
      e.department?.name?.toLowerCase().includes(search)
    );
  });

  // View artifact handlers
  const openViewDialog = (artifact: Artifact) => {
    setSelectedArtifactForView(artifact);
    setViewDialogOpen(true);
  };

  const getFilePreviewUrl = (artifact: Artifact) => {
    if (!artifact.filePath) return null;
    return artifact.filePath;
  };

  const isPreviewable = (fileType: string | null) => {
    if (!fileType) return false;
    const previewableTypes = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt"];
    return previewableTypes.includes(fileType.toLowerCase());
  };

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
        setUsers(data.data || data || []);
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
  }, []);

  useEffect(() => {
    fetchReferenceData();
    fetchAllEvidencesForStats();
    fetchArtifacts(1, false);
  }, []);

  useEffect(() => {
    if (activeTab === "Evidence Request") {
      fetchEvidences();
    }
  }, [activeTab, fetchEvidences]);

  // Filtered users by department
  const filteredUsers = createForm.departmentId
    ? users.filter((u) => u.departmentId === createForm.departmentId)
    : users;

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
        fetchAllEvidencesForStats();
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

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.frameworkId) params.append("frameworkId", filters.frameworkId);
      if (filters.departmentId) params.append("departmentId", filters.departmentId);

      const response = await fetch(`/api/evidences/export?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `evidence-export-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error exporting evidences:", error);
    }
  };

  const handleImport = () => {
    setIsImportDialogOpen(true);
    setImportFile(null);
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
        const result = await response.json();
        alert(`Successfully imported ${result.imported} evidence(s)${result.skipped > 0 ? `. Skipped ${result.skipped} row(s).` : ""}`);
        setIsImportDialogOpen(false);
        setImportFile(null);
        fetchEvidences();
        fetchAllEvidencesForStats();
      } else {
        const error = await response.json();
        alert(`Import failed: ${error.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error importing evidences:", error);
      alert("Failed to import evidences");
    } finally {
      setImporting(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Evidence Code",
      "Evidence Name",
      "Description",
      "Domain",
      "Status",
      "Department",
      "Assignee",
      "Recurrence",
      "Review Date",
      "Framework",
      "Linked Controls",
      "KPI Required"
    ];
    const csvContent = headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "evidence-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 });
    fetchEvidences();
  };

  const toggleControlSelection = (controlId: string) => {
    setSelectedControlIds((prev) =>
      prev.includes(controlId)
        ? prev.filter((id) => id !== controlId)
        : [...prev, controlId]
    );
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPagination({ ...pagination, page: 1 });
    setFilters({ ...filters, status: "" });
  };

  const handleStatusFilter = (status: string) => {
    setFilters({ ...filters, status: status === "all" ? "" : status });
    if (activeTab === "Dashboard") {
      setActiveTab("Evidence Request");
    }
  };

  const canProceedStep1 = createForm.name && createForm.recurrence && createForm.departmentId && createForm.assigneeId;

  if (loading && evidences.length === 0 && activeTab === "Evidence Request") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Evidence</h1>
        </div>
        <div className="flex gap-2">
          {activeTab === "Evidence Request" && (
            <>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                onClick={handleImport}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </>
          )}
          {activeTab === "Evidence Request" && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Evidence
            </Button>
          )}
        </div>
      </div>

      {/* Tabs with Framework Filter */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="Dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="Evidence Request">
              <ClipboardList className="h-4 w-4 mr-2" />
              Evidence Request
            </TabsTrigger>
            <TabsTrigger value="Artifacts">
              <FolderOpen className="h-4 w-4 mr-2" />
              Artifacts
            </TabsTrigger>
          </TabsList>

          {/* Integrated Framework Filter - Hidden on Artifacts tab */}
          {activeTab !== "Artifacts" && (
            <Select
              value={filters.frameworkId || "all"}
              onValueChange={(value) => setFilters({ ...filters, frameworkId: value === "all" ? "" : value })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Integrated Framework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Frameworks</SelectItem>
                {frameworks.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Status Cards - Hidden on Artifacts tab */}
        {activeTab !== "Artifacts" && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6">
          <Card className="cursor-pointer hover:shadow-md" onClick={() => handleStatusFilter("all")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{statusCounts.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-gray-500" onClick={() => handleStatusFilter("Not Uploaded")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-600">{statusCounts.notUploaded}</div>
              <div className="text-sm text-muted-foreground">Not Uploaded</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-yellow-500" onClick={() => handleStatusFilter("Draft")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{statusCounts.draft}</div>
              <div className="text-sm text-muted-foreground">Draft</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-blue-500" onClick={() => handleStatusFilter("Validated")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{statusCounts.validated}</div>
              <div className="text-sm text-muted-foreground">Validated</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-green-500" onClick={() => handleStatusFilter("Published")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{statusCounts.published}</div>
              <div className="text-sm text-muted-foreground">Published</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-red-500" onClick={() => handleStatusFilter("Need Attention")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{statusCounts.needAttention}</div>
              <div className="text-sm text-muted-foreground">Need Attention</div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Dashboard Tab Content */}
        <TabsContent value="Dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Distribution Card */}
            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <span>Not Uploaded</span>
                    </div>
                    <span className="font-bold">{statusCounts.notUploaded}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span>Draft</span>
                    </div>
                    <span className="font-bold">{statusCounts.draft}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>Validated</span>
                    </div>
                    <span className="font-bold">{statusCounts.validated}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>Published</span>
                    </div>
                    <span className="font-bold">{statusCounts.published}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>Need Attention</span>
                    </div>
                    <span className="font-bold">{statusCounts.needAttention}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* By Department Card */}
            <Card>
              <CardHeader>
                <CardTitle>By Department</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(departmentStats)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([dept, count], index) => {
                      const maxCount = Math.max(...Object.values(departmentStats));
                      const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
                      return (
                        <div key={dept} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="truncate max-w-[200px]">{dept}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                          <div className="h-4 bg-gray-100 rounded">
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: colors[index % colors.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {Object.keys(departmentStats).length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No department data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* By Recurrence Card */}
            <Card>
              <CardHeader>
                <CardTitle>By Recurrence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(recurrenceStats)
                    .sort((a, b) => b[1] - a[1])
                    .map(([rec, count], index) => {
                      const maxCount = Math.max(...Object.values(recurrenceStats));
                      const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
                      return (
                        <div key={rec} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{rec}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                          <div className="h-4 bg-gray-100 rounded">
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: colors[index % colors.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {Object.keys(recurrenceStats).length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No recurrence data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => handleTabChange("Evidence Request")}
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-blue-600" />
                      <span>View All Evidence Requests</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => handleTabChange("Artifacts")}
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-green-600" />
                      <span>Manage Artifacts</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="h-5 w-5 text-purple-600" />
                      <span>Create New Evidence</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Evidence Request Tab Content */}
        <TabsContent value="Evidence Request" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4 items-center mb-4">
                <div className="flex-1 flex gap-2">
                  <Input
                    placeholder="Search by Name, Domain and Assignee"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="max-w-sm"
                  />
                  <Button variant="outline" size="icon" onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Select
                  value={filters.departmentId || "all"}
                  onValueChange={(value) => setFilters({ ...filters, departmentId: value === "all" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.status || "all"}
                  onValueChange={(value) => setFilters({ ...filters, status: value === "all" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Not Uploaded">Not Uploaded</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Validated">Validated</SelectItem>
                    <SelectItem value="Published">Published</SelectItem>
                    <SelectItem value="Need Attention">Need Attention</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg">Evidence List</CardTitle>
              {/* Column Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.evidenceCode}
                    onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, evidenceCode: checked })}
                  >
                    Evidence Code
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.name}
                    onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, name: checked })}
                  >
                    Evidence Name
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.domain}
                    onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, domain: checked })}
                  >
                    Domain
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.status}
                    onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, status: checked })}
                  >
                    Status
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.assignee}
                    onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, assignee: checked })}
                  >
                    Assignee
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.department}
                    onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, department: checked })}
                  >
                    Department
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.recurrence}
                    onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, recurrence: checked })}
                  >
                    Recurrence
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {visibleColumns.evidenceCode && <TableHead>Evidence Code</TableHead>}
                        {visibleColumns.name && <TableHead>Evidence Name</TableHead>}
                        {visibleColumns.domain && <TableHead>Domain</TableHead>}
                        {visibleColumns.status && <TableHead>Status</TableHead>}
                        {visibleColumns.assignee && <TableHead>Assignee</TableHead>}
                        {visibleColumns.department && <TableHead>Department</TableHead>}
                        {visibleColumns.recurrence && <TableHead>Recurrence</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evidences.map((evidence) => (
                        <TableRow
                          key={evidence.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/compliance/evidence/${evidence.id}`)}
                        >
                          {visibleColumns.evidenceCode && <TableCell className="font-medium">{evidence.evidenceCode}</TableCell>}
                          {visibleColumns.name && <TableCell>{evidence.name}</TableCell>}
                          {visibleColumns.domain && <TableCell>{evidence.domain || "-"}</TableCell>}
                          {visibleColumns.status && (
                            <TableCell>
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[evidence.status] || "bg-gray-500 text-white"}`}>
                                {evidence.status}
                              </span>
                            </TableCell>
                          )}
                          {visibleColumns.assignee && <TableCell>{evidence.assignee?.fullName || "-"}</TableCell>}
                          {visibleColumns.department && <TableCell>{evidence.department?.name || "-"}</TableCell>}
                          {visibleColumns.recurrence && <TableCell>{evidence.recurrence || "-"}</TableCell>}
                        </TableRow>
                      ))}
                      {evidences.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No evidence records found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {evidences.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === 1}
                        onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Artifacts Tab Content */}
        <TabsContent value="Artifacts" className="space-y-4 mt-6">
          {/* Add Artifact Section */}
          <div>
            <h5 className="text-lg font-semibold mb-4">Add Artifact</h5>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                isDragOver ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                  <p className="text-gray-500">Uploading...</p>
                </div>
              ) : (
                <>
                  <p className="text-gray-500">Drag and drop or select file.</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                  />
                </>
              )}
            </div>
          </div>

          {/* AI Review Button */}
          <Button className="bg-primary hover:bg-primary/90">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Review Artifacts
          </Button>

          {/* Uploaded Artifacts List */}
          <div className="space-y-2">
            {artifacts.map((artifact) => {
              const getFileIcon = (fileType: string | null) => {
                const type = fileType?.toLowerCase();
                if (type === "pdf") {
                  return (
                    <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center">
                      <span className="text-red-600 font-bold text-xs">PDF</span>
                    </div>
                  );
                }
                if (type === "docx" || type === "doc") {
                  return (
                    <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-xs">W</span>
                    </div>
                  );
                }
                if (type === "xlsx" || type === "xls" || type === "csv") {
                  return (
                    <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center">
                      <span className="text-green-600 font-bold text-xs">XLS</span>
                    </div>
                  );
                }
                if (type === "png" || type === "jpg" || type === "jpeg") {
                  return (
                    <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center">
                      <span className="text-purple-600 font-bold text-xs">IMG</span>
                    </div>
                  );
                }
                return (
                  <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                    <FileText className="h-5 w-5 text-gray-500" />
                  </div>
                );
              };

              const formatDate = (dateString: string) => {
                return new Date(dateString).toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                });
              };

              return (
                <div
                  key={artifact.id}
                  className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    {getFileIcon(artifact.fileType)}
                    <div>
                      <p className="font-medium text-primary">
                        {artifact.artifactCode} : {artifact.fileName}
                      </p>
                      <p className="text-sm text-gray-500">
                        By {artifact.uploader?.fullName || artifact.uploadedBy || "Unknown"}, {formatDate(artifact.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Link to Evidence"
                      className="text-gray-500 hover:text-primary"
                      onClick={() => openLinkDialog(artifact)}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="View"
                      className="text-gray-500 hover:text-primary"
                      onClick={() => openViewDialog(artifact)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Download"
                      className="text-gray-500 hover:text-primary"
                      onClick={() => handleDownload(artifact)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteArtifact(artifact.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {artifacts.length === 0 && (
              <div className="text-center py-12 bg-white border rounded-lg">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 text-lg">No artifacts uploaded</p>
                <p className="text-gray-400 text-sm mt-1">Upload your first artifact using the form above</p>
              </div>
            )}

            {/* Load More Button */}
            {artifactPagination.page < artifactPagination.totalPages && (
              <div className="text-center pt-4">
                <Button
                  variant="ghost"
                  className="text-primary"
                  onClick={loadMoreArtifacts}
                >
                  <ChevronRight className="h-4 w-4 mr-1" />
                  Load more...
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Evidence Dialog - 3 Step Wizard */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateForm();
        setCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="assigneeId">Assignee *</Label>
                  <Select value={createForm.assigneeId} onValueChange={(v) => setCreateForm({ ...createForm, assigneeId: v })} disabled={!createForm.departmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder={createForm.departmentId ? "Select assignee" : "Select department first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))}
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
                      {departments.find((d) => d.id === createForm.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Assignee</Label>
                    <p className="font-medium">
                      {users.find((u) => u.id === createForm.assigneeId)?.fullName || "-"}
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

      {/* Link to Evidence Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Link Artifact to Evidence
            </DialogTitle>
          </DialogHeader>

          {selectedArtifactForLink && (
            <div className="bg-muted p-3 rounded-lg mb-4">
              <p className="text-sm text-muted-foreground">Selected Artifact:</p>
              <p className="font-medium">{selectedArtifactForLink.artifactCode} : {selectedArtifactForLink.fileName}</p>
            </div>
          )}

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search evidences by code, name, or department..."
                value={linkSearchTerm}
                onChange={(e) => setLinkSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Select Evidence(s) to Link</Label>
              <Badge variant="secondary">{selectedEvidenceIds.length} selected</Badge>
            </div>

            <div className="border rounded-lg flex-1 overflow-y-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Evidence Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvidencesForLink.map((evidence) => (
                    <TableRow
                      key={evidence.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleEvidenceSelection(evidence.id)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedEvidenceIds.includes(evidence.id)}
                          onCheckedChange={() => toggleEvidenceSelection(evidence.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{evidence.evidenceCode}</TableCell>
                      <TableCell>{evidence.name}</TableCell>
                      <TableCell>{evidence.department?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[evidence.status] || "bg-gray-100"}>
                          {evidence.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEvidencesForLink.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No evidences found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLinkToEvidence}
              disabled={selectedEvidenceIds.length === 0 || linking}
            >
              {linking ? "Linking..." : `Link to ${selectedEvidenceIds.length} Evidence(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Artifact Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              View Artifact
            </DialogTitle>
          </DialogHeader>

          {selectedArtifactForView && (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Artifact Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-muted-foreground text-sm">Artifact Code</Label>
                  <p className="font-medium">{selectedArtifactForView.artifactCode}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">File Name</Label>
                  <p className="font-medium">{selectedArtifactForView.fileName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">File Type</Label>
                  <p className="font-medium">{selectedArtifactForView.fileType?.toUpperCase() || "Unknown"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Uploaded By</Label>
                  <p className="font-medium">
                    {selectedArtifactForView.uploader?.fullName || selectedArtifactForView.uploadedBy || "Unknown"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Upload Date</Label>
                  <p className="font-medium">
                    {new Date(selectedArtifactForView.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">File Size</Label>
                  <p className="font-medium">
                    {selectedArtifactForView.fileSize
                      ? selectedArtifactForView.fileSize < 1024
                        ? `${selectedArtifactForView.fileSize} B`
                        : selectedArtifactForView.fileSize < 1024 * 1024
                        ? `${(selectedArtifactForView.fileSize / 1024).toFixed(1)} KB`
                        : `${(selectedArtifactForView.fileSize / (1024 * 1024)).toFixed(1)} MB`
                      : "-"}
                  </p>
                </div>
              </div>

              {/* File Preview */}
              <div className="flex-1 border rounded-lg overflow-hidden min-h-[300px]">
                {isPreviewable(selectedArtifactForView.fileType) ? (
                  selectedArtifactForView.fileType?.toLowerCase() === "pdf" ? (
                    <iframe
                      src={getFilePreviewUrl(selectedArtifactForView) || ""}
                      className="w-full h-full min-h-[400px]"
                      title="PDF Preview"
                    />
                  ) : ["png", "jpg", "jpeg", "gif", "webp"].includes(
                      selectedArtifactForView.fileType?.toLowerCase() || ""
                    ) ? (
                    <div className="flex items-center justify-center p-4 h-full bg-gray-50">
                      <img
                        src={getFilePreviewUrl(selectedArtifactForView) || ""}
                        alt={selectedArtifactForView.fileName}
                        className="max-w-full max-h-[400px] object-contain"
                      />
                    </div>
                  ) : (
                    <iframe
                      src={getFilePreviewUrl(selectedArtifactForView) || ""}
                      className="w-full h-full min-h-[400px]"
                      title="File Preview"
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <FileText className="h-16 w-16 text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg mb-2">Preview not available</p>
                    <p className="text-gray-400 text-sm mb-4">
                      This file type ({selectedArtifactForView.fileType?.toUpperCase() || "Unknown"}) cannot be previewed in the browser.
                    </p>
                    <Button onClick={() => handleDownload(selectedArtifactForView)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download File
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            {selectedArtifactForView && (
              <>
                <Button variant="outline" onClick={() => openLinkDialog(selectedArtifactForView)}>
                  <Link2 className="h-4 w-4 mr-2" />
                  Link to Evidence
                </Button>
                <Button onClick={() => handleDownload(selectedArtifactForView)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Evidence Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
        setIsImportDialogOpen(open);
        if (!open) {
          setImportFile(null);
          if (importFileInputRef.current) {
            importFileInputRef.current.value = "";
          }
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Evidences</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file to import evidences. You can download a template to see the required format.
            </p>

            <div>
              <Label>File *</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  readOnly
                  value={importFile?.name || ""}
                  placeholder="Choose a file..."
                  className="flex-1 bg-muted/50"
                />
                <Button
                  variant="outline"
                  onClick={() => importFileInputRef.current?.click()}
                >
                  Browse...
                </Button>
                <input
                  ref={importFileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImportFileChange}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: CSV, XLSX, XLS
              </p>
            </div>

          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setIsImportDialogOpen(false);
                setImportFile(null);
                if (importFileInputRef.current) {
                  importFileInputRef.current.value = "";
                }
              }}>
                Cancel
              </Button>
              <Button onClick={handleImportSubmit} disabled={!importFile || importing}>
                {importing ? "Importing..." : "Import"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

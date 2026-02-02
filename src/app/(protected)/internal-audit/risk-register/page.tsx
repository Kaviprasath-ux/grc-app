"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, ArrowUpDown, Eye, Search, Download, Upload, X, FileText, Sparkles, Loader2, Calendar, Target, AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Home } from "lucide-react";
import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
}

interface AuditCategory {
  id: string;
  name: string;
}

interface AuditType {
  id: string;
  name: string;
}

interface Probability {
  id: string;
  label: string;
  value: number;
}

interface Impact {
  id: string;
  label: string;
  value: number;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

interface RecommendedAudit {
  id: string;
  auditName: string;
  department: string;
  riskLevel: string;
  justification: string;
  suggestedScope: string;
  relatedRisks: string[];
  priority: 'High' | 'Medium' | 'Low';
  estimatedDuration: string;
}

interface AIRecommendationsResponse {
  recommendations: RecommendedAudit[];
  summary: {
    totalRisks: number;
    extremeRisks: number;
    highRisks: number;
    departmentsAnalyzed: number;
    recommendationsGenerated: number;
  };
  generatedAt: string;
}

interface AuditCategory {
  id: string;
  name: string;
}

interface InternalAuditRisk {
  id: string;
  riskId: string;
  riskName: string;
  riskDescription: string | null;
  departmentId: string | null;
  department: Department | null;
  categoryId: string | null;
  category: AuditCategory | null;
  creationDate: string;
  inherentScore: number | null;
  residualScore: number | null;
  riskLevel: string | null;
  status: string;
}

export default function RiskRegisterPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [risks, setRisks] = useState<InternalAuditRisk[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Check if user has read-only role (DepartmentReviewer or DepartmentContributor)
  // These roles should see the page in read-only mode per UAT requirements
  const isReadOnlyRole = session?.user?.roles?.some(
    (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
  ) ?? false;

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InternalAuditRisk | null>(null);

  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  // AI Recommendations dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendationsResponse | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Add/Edit Risk Modal states
  const [isAddRiskOpen, setIsAddRiskOpen] = useState(false);
  const [isEditRiskOpen, setIsEditRiskOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<InternalAuditRisk | null>(null);
  const [saving, setSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Reference data for form
  const [categories, setCategories] = useState<AuditCategory[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
  const [probabilities, setProbabilities] = useState<Probability[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);

  // File upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Form data
  const initialFormData = {
    riskId: "",
    riskName: "",
    riskDescription: "",
    departmentId: "",
    sectionProcess: "",
    subProcess: "",
    activity: "",
    categoryId: "",
    auditTypeId: "",
    inherentLikelihood: "",
    inherentImpact: "",
    controlDescription: "",
    controlEffectiveness: "",
    residualLikelihood: "",
    residualImpact: "",
    creationDate: new Date().toISOString().split("T")[0],
    auditComment: "",
    status: "Open",
  };
  const [formData, setFormData] = useState(initialFormData);

  // Generate year options (current year + 5 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  // Pagination calculations
  const totalItems = risks.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedRisks = risks.slice(startIndex, endIndex);
  const startItem = startIndex + 1;
  const endItem = endIndex;

  useEffect(() => {
    fetchDepartments();
    fetchRisks();
    fetchReferenceData();
  }, []);

  useEffect(() => {
    fetchRisks();
    setCurrentPage(1);
  }, [yearFilter, departmentFilter, searchFilter]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [catRes, typeRes, probRes, impactRes] = await Promise.all([
        fetch("/api/internal-audit/categories"),
        fetch("/api/internal-audit/audit-types"),
        fetch("/api/internal-audit/probability"),
        fetch("/api/internal-audit/impact"),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (typeRes.ok) setAuditTypes(await typeRes.json());
      if (probRes.ok) setProbabilities(await probRes.json());
      if (impactRes.ok) setImpacts(await impactRes.json());
    } catch (error) {
      console.error("Failed to fetch reference data:", error);
    }
  };

  const fetchRisks = async () => {
    try {
      const params = new URLSearchParams();
      if (yearFilter && yearFilter !== "all") params.append("year", yearFilter);
      if (departmentFilter && departmentFilter !== "all") params.append("departmentId", departmentFilter);
      if (searchFilter) params.append("search", searchFilter);

      const response = await fetch(`/api/internal-audit/risks?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRisks(data);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (item: InternalAuditRisk) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/internal-audit/risks/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchRisks();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/internal-audit/risks/export");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `risk-register-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Failed to export:", error);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/internal-audit/risks/import", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        fetchRisks();
        setImportDialogOpen(false);
        setSelectedFile(null);
      }
    } catch (error) {
      console.error("Failed to import:", error);
    } finally {
      setImporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    event.target.value = "";
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch("/api/internal-audit/risks/template");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "risk-import-template.csv";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Failed to download template:", error);
    }
  };

  const fetchAIRecommendations = async () => {
    setLoadingAI(true);
    setAiDialogOpen(true);
    try {
      const response = await fetch("/api/internal-audit/risks/ai-recommended-audits");
      if (response.ok) {
        const data = await response.json();
        setAiRecommendations(data);
      }
    } catch (error) {
      console.error("Failed to fetch AI recommendations:", error);
    } finally {
      setLoadingAI(false);
    }
  };

  // Add Risk Modal handlers
  const openAddRiskModal = () => {
    setFormData(initialFormData);
    setUploadedFiles([]);
    setIsAddRiskOpen(true);
  };

  const closeAddRiskModal = () => {
    setIsAddRiskOpen(false);
    setFormData(initialFormData);
    setUploadedFiles([]);
  };

  // Edit Risk Modal handlers
  const openEditRiskModal = async (risk: InternalAuditRisk) => {
    setEditingRisk(risk);
    setFormLoading(true);
    setIsEditRiskOpen(true);

    try {
      const response = await fetch(`/api/internal-audit/risks/${risk.id}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          riskId: data.riskId || "",
          riskName: data.riskName || "",
          riskDescription: data.riskDescription || "",
          departmentId: data.departmentId || "",
          sectionProcess: data.sectionProcess || "",
          subProcess: data.subProcess || "",
          activity: data.activity || "",
          categoryId: data.categoryId || "",
          auditTypeId: data.auditTypeId || "",
          inherentLikelihood: data.inherentLikelihood?.toString() || "",
          inherentImpact: data.inherentImpact?.toString() || "",
          controlDescription: data.controlDescription || "",
          controlEffectiveness: data.controlEffectiveness || "",
          residualLikelihood: data.residualLikelihood?.toString() || "",
          residualImpact: data.residualImpact?.toString() || "",
          creationDate: data.creationDate ? data.creationDate.split("T")[0] : "",
          auditComment: data.auditComment || "",
          status: data.status || "Open",
        });
      }
    } catch (error) {
      console.error("Failed to fetch risk details:", error);
      toast({
        title: "Error",
        description: "Failed to load risk details.",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const closeEditRiskModal = () => {
    setIsEditRiskOpen(false);
    setEditingRisk(null);
    setFormData(initialFormData);
  };

  // Calculate scores
  const calculateInherentScore = () => {
    const likelihood = formData.inherentLikelihood ? parseInt(formData.inherentLikelihood) : 0;
    const impact = formData.inherentImpact ? parseInt(formData.inherentImpact) : 0;
    return likelihood * impact;
  };

  const calculateResidualScore = () => {
    const likelihood = formData.residualLikelihood ? parseInt(formData.residualLikelihood) : 0;
    const impact = formData.residualImpact ? parseInt(formData.residualImpact) : 0;
    return likelihood * impact;
  };

  // File upload handlers
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
      await handleFiles(Array.from(files));
    }
  };

  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFiles(Array.from(files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    try {
      for (const file of files) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formDataUpload,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          setUploadedFiles((prev) => [
            ...prev,
            {
              id: uploadData.file?.id || Date.now().toString(),
              name: file.name,
              size: file.size,
              type: file.type,
            },
          ]);
        }
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Submit Add Risk form
  const handleAddRiskSubmit = async () => {
    if (!formData.riskName.trim()) {
      toast({
        title: "Error",
        description: "Risk name is required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const inherentScore = calculateInherentScore();
      const residualScore = calculateResidualScore();

      const response = await fetch("/api/internal-audit/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          riskId: formData.riskId || null,
          inherentLikelihood: formData.inherentLikelihood ? parseInt(formData.inherentLikelihood) : null,
          inherentImpact: formData.inherentImpact ? parseInt(formData.inherentImpact) : null,
          inherentScore: inherentScore || null,
          residualLikelihood: formData.residualLikelihood ? parseInt(formData.residualLikelihood) : null,
          residualImpact: formData.residualImpact ? parseInt(formData.residualImpact) : null,
          residualScore: residualScore || null,
          departmentId: formData.departmentId || null,
          categoryId: formData.categoryId || null,
          auditTypeId: formData.auditTypeId || null,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Risk created successfully.",
        });
        closeAddRiskModal();
        fetchRisks();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create risk.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to create risk:", error);
      toast({
        title: "Error",
        description: "Failed to create risk.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Submit Edit Risk form
  const handleEditRiskSubmit = async () => {
    if (!editingRisk || !formData.riskName.trim()) {
      toast({
        title: "Error",
        description: "Risk name is required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const inherentScore = calculateInherentScore();
      const residualScore = calculateResidualScore();

      const response = await fetch(`/api/internal-audit/risks/${editingRisk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          inherentLikelihood: formData.inherentLikelihood ? parseInt(formData.inherentLikelihood) : null,
          inherentImpact: formData.inherentImpact ? parseInt(formData.inherentImpact) : null,
          inherentScore: inherentScore || null,
          residualLikelihood: formData.residualLikelihood ? parseInt(formData.residualLikelihood) : null,
          residualImpact: formData.residualImpact ? parseInt(formData.residualImpact) : null,
          residualScore: residualScore || null,
          departmentId: formData.departmentId || null,
          categoryId: formData.categoryId || null,
          auditTypeId: formData.auditTypeId || null,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Risk updated successfully.",
        });
        closeEditRiskModal();
        fetchRisks();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update risk.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update risk:", error);
      toast({
        title: "Error",
        description: "Failed to update risk.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      High: "bg-risk-critical-bg text-risk-critical",
      Medium: "bg-risk-medium-bg text-risk-medium",
      Low: "bg-risk-low-bg text-risk-low",
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[priority] || "bg-slate-100 text-slate-600"}`}>
        {priority}
      </span>
    );
  };

  const getRiskLevelBadge = (level: string | null) => {
    if (!level) return <span className="text-slate-400">-</span>;

    const styles: Record<string, string> = {
      Extreme: "bg-risk-critical-bg text-risk-critical",
      High: "bg-risk-high-bg text-risk-high",
      Medium: "bg-risk-medium-bg text-risk-medium",
      Low: "bg-risk-low-bg text-risk-low",
      Minimal: "bg-risk-minimal-bg text-risk-minimal",
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[level] || "bg-slate-100 text-slate-600"}`}>
        {level}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Open: "bg-info-light text-info",
      "Under Review": "bg-warning-light text-warning",
      Closed: "bg-success-light text-success",
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-slate-100 text-slate-600"}`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">Risk Register</h1>
        </div>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">Loading risks...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/internal-audit/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>Internal Audit</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">Risk Register</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Risk Register</h1>
      </div>

      {/* Search, Filters and Actions - same row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search risks..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-10 w-[250px] bg-white border-slate-200"
              disabled={isReadOnlyRole}
            />
          </div>
          <Select value={yearFilter} onValueChange={setYearFilter} disabled={isReadOnlyRole}>
            <SelectTrigger className="w-[150px] bg-white border-slate-200" disabled={isReadOnlyRole}>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="all">All Years</SelectItem>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={isReadOnlyRole}>
            <SelectTrigger className="w-[180px] bg-white border-slate-200" disabled={isReadOnlyRole}>
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAIRecommendations}
            className="bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI Audits
          </Button>
          {!isReadOnlyRole && (
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {!isReadOnlyRole && (
            <Button size="sm" onClick={openAddRiskModal}>
              <Plus className="h-4 w-4 mr-2" />
              Add Risk
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4">Risk ID</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Risk Description</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Department</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Creation Date</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Category</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Inherent Score</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Residual Score</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Risk Level</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Status</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[100px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRisks.map((risk) => (
              <TableRow key={risk.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <TableCell className="py-3 text-sm font-medium text-slate-800 pl-4">{risk.riskId}</TableCell>
                <TableCell className="py-3 text-sm text-slate-600 max-w-[200px] truncate">{risk.riskDescription || risk.riskName}</TableCell>
                <TableCell className="py-3 text-sm text-slate-600">{risk.department?.name || "-"}</TableCell>
                <TableCell className="py-3 text-sm text-slate-600">{formatDate(risk.creationDate)}</TableCell>
                <TableCell className="py-3 text-sm text-slate-600">{risk.category?.name || "-"}</TableCell>
                <TableCell className="py-3 text-sm text-slate-600">{risk.inherentScore ?? "-"}</TableCell>
                <TableCell className="py-3 text-sm text-slate-600">{risk.residualScore ?? "-"}</TableCell>
                <TableCell className="py-3">{getRiskLevelBadge(risk.riskLevel)}</TableCell>
                <TableCell className="py-3">{getStatusBadge(risk.status)}</TableCell>
                <TableCell className="py-3 pr-4">
                  {!isReadOnlyRole && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => router.push(`/internal-audit/risk-register/${risk.id}`)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openEditRiskModal(risk)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(risk)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {paginatedRisks.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                  {isReadOnlyRole ? "No risks found." : "No risks found. Click \"Add Risk\" to create your first risk."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-sm text-slate-500">
            {startItem} to {endItem} of {totalItems}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600 px-2">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[400px] p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              Are you sure you want to delete this risk? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-end gap-2 px-6 py-4">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Import Risks</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Upload File</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={selectedFile?.name || ""}
                  placeholder="Select a file..."
                  className="flex-1 bg-white"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("import-file-input")?.click()}
                >
                  Browse
                </Button>
                <input
                  id="import-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              <p className="text-xs text-slate-500">Supported formats: CSV, XLSX, XLS</p>
            </div>

            {/* Download Template */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <span className="text-xs text-slate-500">Download the template file to see the required format</span>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setSelectedFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!selectedFile || importing}
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Recommended Audits Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Recommended Audits
            </DialogTitle>
          </DialogHeader>

          {loadingAI ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-4" />
              <p className="text-muted-foreground">Analyzing risks and generating recommendations...</p>
            </div>
          ) : aiRecommendations ? (
            <div className="space-y-6 py-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-info-light rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-info">{aiRecommendations.summary.totalRisks}</p>
                  <p className="text-xs text-info">Total Risks</p>
                </div>
                <div className="bg-risk-critical-bg rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-risk-critical">{aiRecommendations.summary.extremeRisks}</p>
                  <p className="text-xs text-risk-critical">Extreme Risks</p>
                </div>
                <div className="bg-risk-high-bg rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-risk-high">{aiRecommendations.summary.highRisks}</p>
                  <p className="text-xs text-risk-high">High Risks</p>
                </div>
                <div className="bg-primary-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-primary-600">{aiRecommendations.summary.recommendationsGenerated}</p>
                  <p className="text-xs text-primary-600">Recommendations</p>
                </div>
              </div>

              {/* Recommendations List */}
              {aiRecommendations.recommendations.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-slate-700">Recommended Audits</h3>
                  {aiRecommendations.recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-medium px-2 py-1 rounded">
                            {rec.id}
                          </div>
                          <h4 className="font-semibold text-slate-800">{rec.auditName}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(rec.priority)}
                          {getRiskLevelBadge(rec.riskLevel)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Target className="h-4 w-4" />
                          <span>Department: <strong>{rec.department}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="h-4 w-4" />
                          <span>Duration: <strong>{rec.estimatedDuration}</strong></span>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded p-3 mb-3">
                        <p className="text-sm text-slate-700">
                          <strong className="text-slate-800">Justification:</strong> {rec.justification}
                        </p>
                      </div>

                      <div className="text-sm">
                        <p className="text-slate-600 mb-2">
                          <strong>Suggested Scope:</strong> {rec.suggestedScope}
                        </p>
                        {rec.relatedRisks.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <AlertTriangle className="h-4 w-4 text-warning" />
                            <span className="text-slate-500">Related Risks:</span>
                            {rec.relatedRisks.map((riskIdItem) => (
                              <span key={riskIdItem} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                {riskIdItem}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => {
                            router.push(`/internal-audit/audit-plan?suggested=${encodeURIComponent(rec.auditName)}&department=${encodeURIComponent(rec.department)}`);
                            setAiDialogOpen(false);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create Audit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>No audit recommendations at this time.</p>
                  <p className="text-sm mt-2">Add more risks to the register to generate AI recommendations.</p>
                </div>
              )}

              <div className="text-xs text-slate-400 text-right">
                Generated at: {new Date(aiRecommendations.generatedAt).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p>Failed to load recommendations. Please try again.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Risk Modal */}
      <Dialog open={isAddRiskOpen} onOpenChange={setIsAddRiskOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Add Risk</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Risk ID</Label>
                    <Input
                      value={formData.riskId}
                      onChange={(e) => setFormData({ ...formData, riskId: e.target.value })}
                      placeholder="Enter risk ID (e.g., RISK-001)"
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Risk Name <span className="text-error">*</span></Label>
                    <Input
                      value={formData.riskName}
                      onChange={(e) => setFormData({ ...formData, riskName: e.target.value })}
                      placeholder="Enter risk name"
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Department</Label>
                    <Select
                      value={formData.departmentId}
                      onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Category</Label>
                    <Select
                      value={formData.categoryId}
                      onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Audit Type</Label>
                    <Select
                      value={formData.auditTypeId}
                      onValueChange={(value) => setFormData({ ...formData, auditTypeId: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select audit type" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {auditTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Section/Process</Label>
                    <Input
                      value={formData.sectionProcess}
                      onChange={(e) => setFormData({ ...formData, sectionProcess: e.target.value })}
                      placeholder="Enter section/process"
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Sub Process</Label>
                    <Input
                      value={formData.subProcess}
                      onChange={(e) => setFormData({ ...formData, subProcess: e.target.value })}
                      placeholder="Enter sub process"
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Activity</Label>
                    <Input
                      value={formData.activity}
                      onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                      placeholder="Enter activity"
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Risk Description</Label>
                  <Textarea
                    value={formData.riskDescription}
                    onChange={(e) => setFormData({ ...formData, riskDescription: e.target.value })}
                    placeholder="Enter risk description"
                    className="mt-1.5 w-full bg-white"
                    rows={3}
                  />
                </div>
              </div>

              {/* Inherent Risk Assessment */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">Inherent Risk Assessment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Likelihood</Label>
                    <Select
                      value={formData.inherentLikelihood}
                      onValueChange={(value) => setFormData({ ...formData, inherentLikelihood: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select likelihood" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {probabilities.map((prob) => (
                          <SelectItem key={prob.id} value={prob.value.toString()}>
                            {prob.label} ({prob.value})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Impact</Label>
                    <Select
                      value={formData.inherentImpact}
                      onValueChange={(value) => setFormData({ ...formData, inherentImpact: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select impact" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {impacts.map((imp) => (
                          <SelectItem key={imp.id} value={imp.value.toString()}>
                            {imp.label} ({imp.value})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Control Information */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">Control Information</h3>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Control Description</Label>
                  <Textarea
                    value={formData.controlDescription}
                    onChange={(e) => setFormData({ ...formData, controlDescription: e.target.value })}
                    placeholder="Enter control description"
                    className="mt-1.5 w-full bg-white"
                    rows={3}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Control Effectiveness</Label>
                  <Select
                    value={formData.controlEffectiveness}
                    onValueChange={(value) => setFormData({ ...formData, controlEffectiveness: value })}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select effectiveness" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="Effective">Effective</SelectItem>
                      <SelectItem value="Partially Effective">Partially Effective</SelectItem>
                      <SelectItem value="Ineffective">Ineffective</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Residual Risk Assessment */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">Residual Risk Assessment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Likelihood</Label>
                    <Select
                      value={formData.residualLikelihood}
                      onValueChange={(value) => setFormData({ ...formData, residualLikelihood: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select likelihood" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {probabilities.map((prob) => (
                          <SelectItem key={prob.id} value={prob.value.toString()}>
                            {prob.label} ({prob.value})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Impact</Label>
                    <Select
                      value={formData.residualImpact}
                      onValueChange={(value) => setFormData({ ...formData, residualImpact: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select impact" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {impacts.map((imp) => (
                          <SelectItem key={imp.id} value={imp.value.toString()}>
                            {imp.label} ({imp.value})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Creation Date</Label>
                    <div className="mt-1.5">
                      <DatePicker
                        value={formData.creationDate}
                        onChange={(date) => setFormData({ ...formData, creationDate: date ? format(date, "yyyy-MM-dd") : "" })}
                        placeholder="Select creation date"
                        className="w-full bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="Under Review">Under Review</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-slate-700">Audit Comment</Label>
                    <Textarea
                      value={formData.auditComment}
                      onChange={(e) => setFormData({ ...formData, auditComment: e.target.value })}
                      placeholder="Enter audit comment"
                      className="mt-1.5 w-full bg-white"
                      rows={2}
                    />
                  </div>
                </div>

                {/* File Upload Section */}
                <div className="mt-4">
                  <Label className="text-sm font-medium text-slate-700">Attachments</Label>
                  <div
                    className={`mt-1.5 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                      isDragOver ? "border-primary bg-primary-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                        <p className="text-slate-500 text-sm">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Upload className="h-8 w-8 text-slate-400 mb-2" />
                        <p className="text-slate-600 text-sm font-medium">Drag and drop files here</p>
                        <p className="text-slate-400 text-xs mt-1">or click to browse</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                      onChange={handleAttachmentSelect}
                      multiple
                    />
                  </div>

                  {/* Uploaded Files List */}
                  {uploadedFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {uploadedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-slate-500" />
                            <div>
                              <p className="text-sm font-medium text-slate-700">{file.name}</p>
                              <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(file.id);
                            }}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-semantic-error"
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
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={closeAddRiskModal}>
              Cancel
            </Button>
            <Button onClick={handleAddRiskSubmit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Risk Modal */}
      <Dialog open={isEditRiskOpen} onOpenChange={setIsEditRiskOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                Edit Risk {editingRisk?.riskId ? `- ${editingRisk.riskId}` : ""}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {formLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Loading risk details...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Risk ID</Label>
                      <Input
                        value={formData.riskId}
                        onChange={(e) => setFormData({ ...formData, riskId: e.target.value })}
                        placeholder="Enter risk ID"
                        className="mt-1.5 w-full bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Risk Name <span className="text-error">*</span></Label>
                      <Input
                        value={formData.riskName}
                        onChange={(e) => setFormData({ ...formData, riskName: e.target.value })}
                        placeholder="Enter risk name"
                        className="mt-1.5 w-full bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Department</Label>
                      <Select
                        value={formData.departmentId}
                        onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Category</Label>
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Audit Type</Label>
                      <Select
                        value={formData.auditTypeId}
                        onValueChange={(value) => setFormData({ ...formData, auditTypeId: value })}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder="Select audit type" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {auditTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Section/Process</Label>
                      <Input
                        value={formData.sectionProcess}
                        onChange={(e) => setFormData({ ...formData, sectionProcess: e.target.value })}
                        placeholder="Enter section/process"
                        className="mt-1.5 w-full bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Sub Process</Label>
                      <Input
                        value={formData.subProcess}
                        onChange={(e) => setFormData({ ...formData, subProcess: e.target.value })}
                        placeholder="Enter sub process"
                        className="mt-1.5 w-full bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Activity</Label>
                      <Input
                        value={formData.activity}
                        onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                        placeholder="Enter activity"
                        className="mt-1.5 w-full bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Risk Description</Label>
                    <Textarea
                      value={formData.riskDescription}
                      onChange={(e) => setFormData({ ...formData, riskDescription: e.target.value })}
                      placeholder="Enter risk description"
                      className="mt-1.5 w-full bg-white"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Inherent Risk Assessment */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">Inherent Risk Assessment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Likelihood</Label>
                      <Select
                        value={formData.inherentLikelihood}
                        onValueChange={(value) => setFormData({ ...formData, inherentLikelihood: value })}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder="Select likelihood" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {probabilities.map((prob) => (
                            <SelectItem key={prob.id} value={prob.value.toString()}>
                              {prob.label} ({prob.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Impact</Label>
                      <Select
                        value={formData.inherentImpact}
                        onValueChange={(value) => setFormData({ ...formData, inherentImpact: value })}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder="Select impact" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {impacts.map((imp) => (
                            <SelectItem key={imp.id} value={imp.value.toString()}>
                              {imp.label} ({imp.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Control Information */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">Control Information</h3>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Control Description</Label>
                    <Textarea
                      value={formData.controlDescription}
                      onChange={(e) => setFormData({ ...formData, controlDescription: e.target.value })}
                      placeholder="Enter control description"
                      className="mt-1.5 w-full bg-white"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Control Effectiveness</Label>
                    <Select
                      value={formData.controlEffectiveness}
                      onValueChange={(value) => setFormData({ ...formData, controlEffectiveness: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder="Select effectiveness" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="Effective">Effective</SelectItem>
                        <SelectItem value="Partially Effective">Partially Effective</SelectItem>
                        <SelectItem value="Ineffective">Ineffective</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Residual Risk Assessment */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">Residual Risk Assessment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Likelihood</Label>
                      <Select
                        value={formData.residualLikelihood}
                        onValueChange={(value) => setFormData({ ...formData, residualLikelihood: value })}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder="Select likelihood" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {probabilities.map((prob) => (
                            <SelectItem key={prob.id} value={prob.value.toString()}>
                              {prob.label} ({prob.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Impact</Label>
                      <Select
                        value={formData.residualImpact}
                        onValueChange={(value) => setFormData({ ...formData, residualImpact: value })}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder="Select impact" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {impacts.map((imp) => (
                            <SelectItem key={imp.id} value={imp.value.toString()}>
                              {imp.label} ({imp.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">Additional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Creation Date</Label>
                      <div className="mt-1.5">
                        <DatePicker
                          value={formData.creationDate}
                          onChange={(date) => setFormData({ ...formData, creationDate: date ? format(date, "yyyy-MM-dd") : "" })}
                          placeholder="Select creation date"
                          className="w-full bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="Under Review">Under Review</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-slate-700">Audit Comment</Label>
                      <Textarea
                        value={formData.auditComment}
                        onChange={(e) => setFormData({ ...formData, auditComment: e.target.value })}
                        placeholder="Enter audit comment"
                        className="mt-1.5 w-full bg-white"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={closeEditRiskModal}>
              Cancel
            </Button>
            <Button onClick={handleEditRiskSubmit} disabled={saving || formLoading}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

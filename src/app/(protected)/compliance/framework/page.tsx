"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Pencil,
  Trash2,
  Sparkles,
  Plus,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Search,
  Home,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useHasRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface Framework {
  id: string;
  code?: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  country?: string;
  industry?: string;
  isCustom: boolean;
  compliancePercentage: number;
  policyPercentage: number;
  evidencePercentage: number;
}

interface NewFramework {
  code: string;
  name: string;
  description: string;
  type: string;
  country: string;
  industry: string;
}

interface ImportError {
  row: number;
  column: string;
  message: string;
}

const ITEMS_PER_PAGE = 15;

// Template columns for framework requirements
const TEMPLATE_COLUMNS = [
  "Requirement Code",
  "Requirement Name",
  "Description",
  "Category",
  "Control Mapping",
];

export default function FrameworkOverviewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const isGRCReviewer = useHasRole("GRCReviewer");
  const isDepartmentReviewer = useHasRole("DepartmentReviewer");
  const isReviewerRole = isGRCReviewer || isDepartmentReviewer;
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortField, setSortField] = useState<string>("code");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states - Step 1 (Basic Info)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAICreate, setIsAICreate] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingFramework, setEditingFramework] = useState<Framework | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [frameworkToDelete, setFrameworkToDelete] = useState<Framework | null>(null);

  // Dialog states - Step 2 (Excel Import)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [newlyCreatedFrameworkId, setNewlyCreatedFrameworkId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isDraggingImport, setIsDraggingImport] = useState(false);

  // File upload state for AI version
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // AI Create flow state (RunPod job + client-side polling)
  const [isAISubmitting, setIsAISubmitting] = useState(false);
  const [aiJobStatus, setAiJobStatus] = useState<string | null>(null);
  const aiPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [formData, setFormData] = useState<NewFramework>({
    code: "",
    name: "",
    description: "",
    type: "",
    country: "",
    industry: "",
  });

  useEffect(() => {
    fetchFrameworks();
  }, []);

  const fetchFrameworks = async () => {
    try {
      const response = await fetch("/api/frameworks");
      if (response.ok) {
        const data = await response.json();
        setFrameworks(data);
      }
    } catch (error) {
      console.error("Error fetching frameworks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and sort frameworks
  const filteredFrameworks = frameworks.filter(
    (f) =>
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedFrameworks = [...filteredFrameworks].sort((a, b) => {
    const aValue = (a[sortField as keyof Framework] || "") as string;
    const bValue = (b[sortField as keyof Framework] || "") as string;

    if (sortDirection === "asc") {
      return aValue.localeCompare(bValue);
    }
    return bValue.localeCompare(aValue);
  });

  // Pagination
  const totalPages = Math.ceil(sortedFrameworks.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, sortedFrameworks.length);
  const currentFrameworks = sortedFrameworks.slice(startIndex, endIndex);

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      type: "",
      country: "",
      industry: "",
    });
    setUploadedFile(null);
    setIsEditMode(false);
    setEditingFramework(null);
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportErrors([]);
    setImportSuccess(null);
    setIsImporting(false);
  };

  const openCreateDialog = (isAI: boolean) => {
    resetForm();
    setAiJobStatus(null);
    setIsAISubmitting(false);
    if (aiPollIntervalRef.current) {
      clearInterval(aiPollIntervalRef.current);
      aiPollIntervalRef.current = null;
    }
    setIsAICreate(isAI);
    setIsCreateDialogOpen(true);
  };

  useEffect(() => {
    return () => {
      if (aiPollIntervalRef.current) clearInterval(aiPollIntervalRef.current);
    };
  }, []);

  const openEditDialog = (framework: Framework) => {
    setFormData({
      code: framework.code || "",
      name: framework.name,
      description: framework.description || "",
      type: framework.type || "",
      country: framework.country || "",
      industry: framework.industry || "",
    });
    setEditingFramework(framework);
    setIsEditMode(true);
    setIsAICreate(false);
    setIsCreateDialogOpen(true);
  };

  const handleCreateOrUpdate = async () => {
    try {
      if (isEditMode && editingFramework) {
        // Update existing framework
        const response = await fetch(`/api/frameworks/${editingFramework.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
          }),
        });

        if (response.ok) {
          setIsCreateDialogOpen(false);
          resetForm();
          fetchFrameworks();
          toast({
            title: t("Success"),
            description: t("Framework updated successfully"),
          });
        }
      } else if (isAICreate) {
        // AI Create: call RunPod APIs with polling
        if (isAISubmitting) return;
        setIsAISubmitting(true);
        setAiJobStatus("submitting");

        const fd = new FormData();
        fd.append("framework_name", formData.name.trim());
        if (formData.description) fd.append("description", formData.description);
        if (formData.type) fd.append("type", formData.type);
        if (formData.country) fd.append("country", formData.country);
        if (formData.industry) fd.append("industry", formData.industry);
        if (formData.code) fd.append("code", formData.code);
        if (uploadedFile) fd.append("attachment", uploadedFile);

        const createRes = await fetch("/api/ai/generate-framework", {
          method: "POST",
          body: fd,
        });

        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error || "Failed to start AI framework generation");
        }

        const { job_id } = await createRes.json();
        if (!job_id) throw new Error("No job ID returned");

        setAiJobStatus("queued");

        const poll = async () => {
          try {
            const statusRes = await fetch(`/api/ai/framework-status/${job_id}`);
            if (!statusRes.ok) return;
            const statusData = await statusRes.json();
            const status = (statusData.status || "").toLowerCase();
            setAiJobStatus(status);

            const isTerminalFailure = status === "failed" || status === "error";
            if (status === "completed" || isTerminalFailure) {
              if (aiPollIntervalRef.current) {
                clearInterval(aiPollIntervalRef.current);
                aiPollIntervalRef.current = null;
              }
            }

            if (status === "completed") {
              const resultRes = await fetch(`/api/ai/framework-result/${job_id}`);
              if (!resultRes.ok) throw new Error("Failed to fetch result");
              const result = await resultRes.json();
              const frameworkId = result.frameworkId;

              setIsCreateDialogOpen(false);
              resetForm();
              setAiJobStatus(null);
              setIsAISubmitting(false);
              fetchFrameworks();
              toast({
                title: t("Success"),
                description: t("Framework created successfully"),
              });
              if (frameworkId) {
                router.push(`/compliance/framework/${frameworkId}`);
              }
            } else if (isTerminalFailure) {
              setIsAISubmitting(false);
              setAiJobStatus(null);
              const errorMsg =
                statusData.error ||
                statusData.message ||
                statusData.error_message ||
                statusData.detail ||
                t("AI framework generation failed");
              toast({
                title: t("Error"),
                description: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg),
                variant: "destructive",
              });
            }
          } catch (e) {
            if (aiPollIntervalRef.current) {
              clearInterval(aiPollIntervalRef.current);
              aiPollIntervalRef.current = null;
            }
            setIsAISubmitting(false);
            setAiJobStatus(null);
            toast({
              title: t("Error"),
              description: e instanceof Error ? e.message : t("Polling failed"),
              variant: "destructive",
            });
          }
        };

        poll();
        aiPollIntervalRef.current = setInterval(poll, 5000);
      } else {
        // Manual Create new framework
        const response = await fetch("/api/frameworks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            isCustom: true,
            status: "Subscribed",
          }),
        });

        if (response.ok) {
          const newFramework = await response.json();
          setIsCreateDialogOpen(false);
          resetForm();
          fetchFrameworks();

          setNewlyCreatedFrameworkId(newFramework.id);
          resetImportState();
          setIsImportDialogOpen(true);
        } else {
          const error = await response.json();
          toast({
            title: t("Error"),
            description: error.error || t("Failed to create framework"),
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error saving framework:", error);
      setIsAISubmitting(false);
      setAiJobStatus(null);
      toast({
        title: t("Error"),
        description: error instanceof Error ? error.message : t("Failed to save framework"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!frameworkToDelete) return;

    try {
      const response = await fetch(`/api/frameworks/${frameworkToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setIsDeleteDialogOpen(false);
        setFrameworkToDelete(null);
        fetchFrameworks();
        toast({
          title: t("Success"),
          description: t("Framework deleted successfully"),
        });
      }
    } catch (error) {
      console.error("Error deleting framework:", error);
      toast({
        title: t("Error"),
        description: t("Failed to delete framework"),
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (framework: Framework) => {
    setFrameworkToDelete(framework);
    setIsDeleteDialogOpen(true);
  };

  // File upload handlers for AI version
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setUploadedFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedFile(files[0]);
    }
  };

  // Import dialog file handlers
  const handleImportDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImport(true);
  }, []);

  const handleImportDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImport(false);
  }, []);

  const handleImportDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImport(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        setImportFile(file);
        setImportErrors([]);
        setImportSuccess(null);
      } else {
        toast({
          title: t("Invalid File"),
          description: t("Please upload an Excel file (.xlsx)"),
          variant: "destructive",
        });
      }
    }
  }, [toast, t]);

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        setImportFile(file);
        setImportErrors([]);
        setImportSuccess(null);
      } else {
        toast({
          title: t("Invalid File"),
          description: t("Please upload an Excel file (.xlsx)"),
          variant: "destructive",
        });
      }
    }
  };

  // Download sample template
  const handleDownloadTemplate = async () => {
    try {
      // Dynamically import xlsx for client-side template generation
      const XLSX = await import("xlsx");

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheetData = [TEMPLATE_COLUMNS];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths
      const colWidths = TEMPLATE_COLUMNS.map((col) => ({ wch: Math.max(col.length + 5, 20) }));
      worksheet["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, "Requirements");

      // Generate and download
      XLSX.writeFile(workbook, "framework_requirements_template.xlsx");

      toast({
        title: t("Template Downloaded"),
        description: t("Sample template has been downloaded successfully"),
      });
    } catch (error) {
      console.error("Error generating template:", error);
      toast({
        title: t("Error"),
        description: t("Failed to download template"),
        variant: "destructive",
      });
    }
  };

  // Import Excel file
  const handleImport = async () => {
    if (!importFile || !newlyCreatedFrameworkId) return;

    setIsImporting(true);
    setImportErrors([]);
    setImportSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch(`/api/frameworks/${newlyCreatedFrameworkId}/import`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        fetchFrameworks();
        toast({
          title: t("Import Successful"),
          description: result.message,
        });
        // Auto-close the dialog after successful import
        handleCloseImportDialog();
      } else {
        if (result.details) {
          setImportErrors(result.details);
        }
        toast({
          title: t("Import Failed"),
          description: result.error || t("Failed to import requirements"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error importing file:", error);
      toast({
        title: t("Error"),
        description: t("Failed to import requirements"),
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseImportDialog = () => {
    setIsImportDialogOpen(false);
    resetImportState();
    setNewlyCreatedFrameworkId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading frameworks...")}</p>
        </div>
      </div>
    );
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
        <span className="text-primary-700 font-medium">{t("Frameworks")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Frameworks")}</h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t("Search frameworks...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-slate-200"
          />
        </div>
        {!isReviewerRole && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => openCreateDialog(true)}
              variant="outline"
              size="sm"
              className="bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {t("New Framework (AI)")}
            </Button>
            <Button
              onClick={() => openCreateDialog(false)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("New Framework")}
            </Button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="w-[120px] py-3">
                <button
                  onClick={() => handleSort("code")}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  {t("Code")}
                  <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </TableHead>
              <TableHead className="py-3">
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  {t("Framework Name")}
                  <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </TableHead>
              <TableHead className="w-[40%] py-3">
                <button
                  onClick={() => handleSort("description")}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  {t("Description")}
                  <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </TableHead>
              {!isReviewerRole && (
                <TableHead className="w-[100px] text-xs font-semibold text-slate-600 py-3">{t("Actions")}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentFrameworks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isReviewerRole ? 3 : 4} className="h-24 text-center text-slate-500">
                  {t("No frameworks found.")}
                </TableCell>
              </TableRow>
            ) : (
              currentFrameworks.map((framework) => (
                <TableRow
                  key={framework.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                  onDoubleClick={() => router.push(`/compliance/framework/${framework.id}`)}
                >
                  <TableCell className="py-3 text-sm font-medium text-slate-800">{framework.code || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{framework.name}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600 truncate max-w-[400px]">
                    {framework.description || "-"}
                  </TableCell>
                  {!isReviewerRole && (
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(framework);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteDialog(framework);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            {sortedFrameworks.length > 0
              ? t("Showing {start} to {end} of {total}").replace("{start}", String(startIndex + 1)).replace("{end}", String(endIndex)).replace("{total}", String(sortedFrameworks.length))
              : t("No frameworks")}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Step 1: Create/Edit Framework Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {isEditMode ? t("Edit Framework") : t("Create Framework")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-5">
              <p className="text-sm text-slate-500">
                {t("Please provide the following details to create a new compliance framework.")}
              </p>

              {isEditMode && (
                <p className="text-sm text-primary-600 bg-primary-50 p-3 rounded-lg border border-primary-100">
                  {t("Note: Custom framework will be automatically added in grey color to differentiate between Subscribed Frameworks.")}
                </p>
              )}

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Code")}</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder={t("Enter code")}
                  className="mt-1.5 bg-white"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Framework Name")} <span className="text-error">*</span>
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("Enter framework name")}
                  className="mt-1.5 bg-white"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t("Enter description")}
                  rows={3}
                  className="mt-1.5 bg-white"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Framework Type")}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger className="w-full mt-1.5 bg-white">
                    <SelectValue placeholder={t("Select type")} />
                  </SelectTrigger>
                  <SelectContent className="bg-white" position="popper" sideOffset={4}>
                    <SelectItem value="Framework">{t("Framework")}</SelectItem>
                    <SelectItem value="Standard">{t("Standard")}</SelectItem>
                    <SelectItem value="Regulation">{t("Regulation")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Country")}</Label>
                  <Input
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder={t("Enter country")}
                    className="mt-1.5 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Industry")}</Label>
                  <Input
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    placeholder={t("Enter industry")}
                    className="mt-1.5 bg-white"
                  />
                </div>
              </div>

              {/* File Upload - Only for AI version */}
              {isAICreate && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Upload Support Document")}</Label>
                  <div
                    className={`mt-1.5 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? "border-primary-500 bg-primary-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.xlsx,.xls"
                    />
                    {uploadedFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-success-dark" />
                        <span className="text-sm font-medium text-success-dark">
                          {uploadedFile.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedFile(null);
                          }}
                          className="text-slate-400 hover:text-semantic-error"
                        >
                          {t("Remove")}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Upload className="h-8 w-8" />
                        <span className="text-sm">{t("Click here, or drop files here to upload.")}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isAISubmitting}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleCreateOrUpdate}
              disabled={!formData.name || isAISubmitting}
            >
              {isAISubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {aiJobStatus === "submitting"
                    ? t("Submitting...")
                    : aiJobStatus === "queued" || aiJobStatus === "processing"
                      ? t("Generating... (AI)")
                      : t("Processing...")}
                </>
              ) : isEditMode ? (
                t("Save")
              ) : (
                t("Create")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: Import Requirements Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <FileSpreadsheet className="h-5 w-5 text-success-dark" />
                {t("Import Framework Requirements")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-5">
              <p className="text-sm text-slate-500">
                {t("Upload an Excel file (.xlsx) containing your framework requirements. You can download the sample template to see the required format.")}
              </p>

              {/* Download Template Button */}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t("Download Sample Template")}
                </Button>
                <span className="text-sm text-slate-500">
                  {t("Use this template to ensure correct column headers")}
                </span>
              </div>

              {/* File Upload Area */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Upload Document")}</Label>
                <div
                  className={`mt-1.5 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDraggingImport
                      ? "border-success-dark bg-success-light"
                      : importFile
                      ? "border-success-dark bg-success-light"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  onDragOver={handleImportDragOver}
                  onDragLeave={handleImportDragLeave}
                  onDrop={handleImportDrop}
                  onClick={() => document.getElementById("import-file-upload")?.click()}
                >
                  <input
                    id="import-file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleImportFileSelect}
                    accept=".xlsx,.xls"
                  />
                  {importFile ? (
                    <div className="flex flex-col items-center gap-3">
                      <FileSpreadsheet className="h-12 w-12 text-success-dark" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-success-dark">
                          {importFile.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImportFile(null);
                            setImportErrors([]);
                            setImportSuccess(null);
                          }}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-semantic-error"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <span className="text-xs text-slate-500">
                        {(importFile.size / 1024).toFixed(2)} KB
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Upload className="h-12 w-12" />
                      <div>
                        <span className="text-sm font-medium">
                          {t("Click to upload or drag and drop")}
                        </span>
                        <p className="text-xs mt-1">{t("Excel files only (.xlsx)")}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Success Message */}
              {importSuccess && (
                <div className="flex items-start gap-2 p-3 bg-success-light border border-success-dark/20 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-success-dark mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-success-dark">{importSuccess}</p>
                    {importErrors.length > 0 && (
                      <p className="text-xs text-success-dark/80 mt-1">
                        {t("Some warnings occurred during import. See details below.")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Error Messages */}
              {importErrors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-error">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {importSuccess ? t("Warnings") : t("Validation Errors")}
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-error/20 rounded-lg bg-error-light">
                    {importErrors.map((error, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 text-sm text-error border-b border-error/10 last:border-b-0"
                      >
                        {error.row > 0 && <span className="font-medium">{t("Row")} {error.row}: </span>}
                        {error.column && <span className="font-medium">{error.column} - </span>}
                        {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Required Columns Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-700 mb-2">{t("Required Column Headers:")}</p>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_COLUMNS.map((col) => (
                    <span
                      key={col}
                      className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-600"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={handleCloseImportDialog}>
              {importSuccess ? t("Close") : t("Skip")}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile || isImporting}
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  {t("Importing...")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t("Import")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Framework")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this framework? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

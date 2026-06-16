"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Search, Download, Upload, X, FileText, Sparkles, Loader2, Calendar, Target, AlertTriangle, ChevronRight, Home } from "lucide-react";
import { Pagination as PaginationUI } from "@/components/ui/pagination";
import Link from "next/link";
import { usePermissions } from "@/hooks/usePermissions";
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
import { isValidName } from "@/lib/validations";
import { useTranslatedData, useTranslatedRecord, triggerTranslation } from "@/hooks/useTranslatedData";

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
  engagementId?: string | null; // Link to audit engagement/plan
}

const RISK_LEVEL_MAP: Record<string, string> = {
  Extreme: "critical",
  High: "high",
  Medium: "medium",
  Low: "low",
};

interface AuditTask {
  task_name: string;
  audit_steps: string[];
  audit_checklist_questions: string[];
  evidence_to_collect: string[];
}

interface AuditPlanItem {
  audit_code: string;
  audit_title: string;
  audit_objective: string;
  audit_scope: string;
  associated_risks: string[];
  audit_tasks: AuditTask[];
}

interface FieldworkAuditPlanResponse {
  department_name: string;
  audit_plan: AuditPlanItem[];
}

interface AuditSubCategory {
  id: string;
  name: string;
  categoryId: string;
}

interface IAProcess {
  id: string;
  processCode: string | null;
  name: string;
}

interface RiskControl {
  description: string;
  effectiveness: string;
}

interface InternalAuditRiskDetail {
  id: string;
  riskId: string;
  riskName: string;
  riskDescription: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  sectionProcess: string | null;
  subProcess: string | null;
  activity: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  auditTypeId: string | null;
  auditType: { id: string; name: string } | null;
  subCategoryId: string | null;
  subCategory: { id: string; name: string } | null;
  riskDrivers: string | null;
  riskConsequences: string | null;
  relatedLawRegulation: string | null;
  controlsData: string | null;
  processLinks: Array<{ id: string; process: { id: string; name: string; processCode: string | null } }>;
  inherentLikelihood: number | null;
  inherentImpact: number | null;
  inherentScore: number | null;
  controlDescription: string | null;
  controlEffectiveness: string | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualScore: number | null;
  riskLevel: string | null;
  creationDate: string;
  auditComment: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function RiskRegisterPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const { t, locale } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
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

  // AI Recommendations dialog (legacy)
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendationsResponse | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // AI Audit Selection dialog (new - frontend filtered)
  const [aiAuditSelectionOpen, setAiAuditSelectionOpen] = useState(false);

  // Fieldwork Audit Plan (from Generate Audit Plan per department)
  const [generatingFieldworkDeptId, setGeneratingFieldworkDeptId] = useState<string | null>(null);
  const [fieldworkPlanResult, setFieldworkPlanResult] = useState<FieldworkAuditPlanResponse | null>(null);
  const [fieldworkPlanDialogOpen, setFieldworkPlanDialogOpen] = useState(false);
  const [addingToPlanning, setAddingToPlanning] = useState<number | null>(null);
  const [currentDepartmentId, setCurrentDepartmentId] = useState<string | null>(null);

  // Check if user is Audit Head
  const isAuditHead = session?.user?.roles?.some(
    (role) => role === "AuditHead"
  ) ?? false;

  // Add/Edit Risk Modal states
  const [isAddRiskOpen, setIsAddRiskOpen] = useState(false);
  const [isEditRiskOpen, setIsEditRiskOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<InternalAuditRisk | null>(null);
  const [saving, setSaving] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // View Risk Modal states
  const [isViewRiskOpen, setIsViewRiskOpen] = useState(false);
  const [viewingRisk, setViewingRisk] = useState<InternalAuditRiskDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Scoring config for calculation method
  const [scoringConfig, setScoringConfig] = useState<{ probabilityImpactCalcType: string; riskRatingCalcType: string } | null>(null);

  // Reference data for form
  const [categories, setCategories] = useState<AuditCategory[]>([]);
  const [subCategories, setSubCategories] = useState<AuditSubCategory[]>([]);
  const [iaProcesses, setIAProcesses] = useState<IAProcess[]>([]);
  const [selectedProcessIds, setSelectedProcessIds] = useState<string[]>([]);
  const [controls, setControls] = useState<RiskControl[]>([{ description: '', effectiveness: '' }]);
  const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
  const [probabilities, setProbabilities] = useState<Probability[]>([]);
  const [impacts, setImpacts] = useState<Impact[]>([]);

  // Translated reference data for dropdowns
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedCategories } = useTranslatedData(categories, { modelName: 'AuditCategory' });
  const { data: translatedAuditTypes } = useTranslatedData(auditTypes, { modelName: 'AuditType' });
  const { data: translatedProbabilities } = useTranslatedData(probabilities, { modelName: 'AuditProbability' });
  const { data: translatedImpacts } = useTranslatedData(impacts, { modelName: 'AuditImpact' });

  // Lookup helpers for translated names in table/view
  const tDept = (id: string | null) => translatedDepartments.find(d => d.id === id)?.name;
  const tCat = (id: string | null) => translatedCategories.find(c => c.id === id)?.name;

  // Raw risk data for translation in edit modal
  const [rawEditRisk, setRawEditRisk] = useState<{ id: string; riskName: string; riskDescription: string | null } | null>(null);
  const editTranslationApplied = useRef(false);
  const { data: translatedEditRisk } = useTranslatedRecord(rawEditRisk, { modelName: 'InternalAuditRisk' });

  // Translated data for view modal
  const { data: translatedViewRisk } = useTranslatedRecord(viewingRisk, { modelName: 'InternalAuditRisk' });

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
    subCategoryId: "",
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
    riskDrivers: "",
    riskConsequences: "",
    relatedLawRegulation: "",
  };
  const [formData, setFormData] = useState(initialFormData);

  // Field errors state for inline validation
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Generate year options (current year + 5 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  // Dynamic translation for risk list
  const { data: translatedRisks } = useTranslatedData(risks, { modelName: 'InternalAuditRisk' });

  // Pagination calculations
  const totalItems = translatedRisks.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedRisks = translatedRisks.slice(startIndex, endIndex);
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

  // Update edit form fields when translated data arrives
  useEffect(() => {
    if (translatedEditRisk && !editTranslationApplied.current) {
      editTranslationApplied.current = true;
      setFormData(prev => ({
        ...prev,
        riskName: translatedEditRisk.riskName || prev.riskName,
        riskDescription: (translatedEditRisk.riskDescription as string) || prev.riskDescription,
      }));
    }
  }, [translatedEditRisk]);

  // Fetch next Risk ID when Add Risk modal opens
  useEffect(() => {
    if (isAddRiskOpen) {
      fetchNextRiskId();
    }
  }, [isAddRiskOpen]);

  const fetchNextRiskId = async () => {
    try {
      const response = await fetch("/api/internal-audit/risks/next-id");
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({ ...prev, riskId: data.nextRiskId }));
      }
    } catch (error) {
      console.error("Failed to fetch next risk ID:", error);
    }
  };

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
      const [catRes, typeRes, probRes, impactRes, configRes, subCatRes, procRes] = await Promise.all([
        fetch("/api/internal-audit/categories"),
        fetch("/api/internal-audit/audit-types"),
        fetch("/api/internal-audit/probability"),
        fetch("/api/internal-audit/impact"),
        fetch("/api/internal-audit/scoring-config"),
        fetch("/api/internal-audit/sub-categories"),
        fetch("/api/internal-audit/ia-processes"),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (typeRes.ok) setAuditTypes(await typeRes.json());
      if (probRes.ok) setProbabilities(await probRes.json());
      if (impactRes.ok) setImpacts(await impactRes.json());
      if (configRes.ok) setScoringConfig(await configRes.json());
      if (subCatRes.ok) setSubCategories(await subCatRes.json());
      if (procRes.ok) setIAProcesses(await procRes.json());
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
    setSelectedProcessIds([]);
    setControls([{ description: '', effectiveness: '' }]);
    setIsAddRiskOpen(true);
  };

  const closeAddRiskModal = () => {
    setIsAddRiskOpen(false);
    setFormData(initialFormData);
    setUploadedFiles([]);
    setSelectedProcessIds([]);
    setControls([{ description: '', effectiveness: '' }]);
    setFieldErrors({});
  };

  // Edit Risk Modal handlers
  const openEditRiskModal = async (risk: InternalAuditRisk) => {
    setEditingRisk(risk);
    setFormLoading(true);
    setIsEditRiskOpen(true);
    editTranslationApplied.current = false;

    try {
      const response = await fetch(`/api/internal-audit/risks/${risk.id}`);
      if (response.ok) {
        const data = await response.json();
        setRawEditRisk({ id: data.id, riskName: data.riskName, riskDescription: data.riskDescription });
        setFormData({
          riskId: data.riskId || "",
          riskName: data.riskName || "",
          riskDescription: data.riskDescription || "",
          departmentId: data.departmentId || "",
          sectionProcess: data.sectionProcess || "",
          subProcess: data.subProcess || "",
          activity: data.activity || "",
          categoryId: data.categoryId || "",
          subCategoryId: data.subCategoryId || "",
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
          riskDrivers: data.riskDrivers || "",
          riskConsequences: data.riskConsequences || "",
          relatedLawRegulation: data.relatedLawRegulation || "",
        });
        setSelectedProcessIds(data.processLinks?.map((pl: { process: { id: string } }) => pl.process.id) || []);
        try {
          const ctrl = data.controlsData ? JSON.parse(data.controlsData) : [];
          setControls(ctrl.length > 0 ? ctrl : [{ description: '', effectiveness: '' }]);
        } catch {
          setControls([{ description: '', effectiveness: '' }]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch risk details:", error);
      toast({
        title: t("Error"),
        description: t("Failed to load risk details."),
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const closeEditRiskModal = () => {
    setIsEditRiskOpen(false);
    setEditingRisk(null);
    setRawEditRisk(null);
    setFormData(initialFormData);
    setSelectedProcessIds([]);
    setControls([{ description: '', effectiveness: '' }]);
    setFieldErrors({});
  };

  // View Risk Modal handler
  const openViewRiskModal = async (risk: InternalAuditRisk) => {
    setViewLoading(true);
    setIsViewRiskOpen(true);

    try {
      const response = await fetch(`/api/internal-audit/risks/${risk.id}`);
      if (response.ok) {
        const data = await response.json();
        setViewingRisk(data);
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to load risk details."),
          variant: "destructive",
        });
        setIsViewRiskOpen(false);
      }
    } catch (error) {
      console.error("Failed to fetch risk details:", error);
      toast({
        title: t("Error"),
        description: t("Failed to load risk details."),
        variant: "destructive",
      });
      setIsViewRiskOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  const closeViewRiskModal = () => {
    setIsViewRiskOpen(false);
    setViewingRisk(null);
  };

  // Calculate scores based on scoring config
  const applyCalcMethod = (a: number, b: number, method: string) => {
    if (method === "Addition of all") return a + b;
    if (method === "High of all") return Math.max(a, b);
    return a * b; // Product of all (default)
  };

  const calculateInherentScore = () => {
    const likelihood = formData.inherentLikelihood ? parseInt(formData.inherentLikelihood) : 0;
    const impact = formData.inherentImpact ? parseInt(formData.inherentImpact) : 0;
    return applyCalcMethod(likelihood, impact, scoringConfig?.probabilityImpactCalcType || "Product of all");
  };

  const calculateResidualScore = () => {
    const likelihood = formData.residualLikelihood ? parseInt(formData.residualLikelihood) : 0;
    const impact = formData.residualImpact ? parseInt(formData.residualImpact) : 0;
    return applyCalcMethod(likelihood, impact, scoringConfig?.probabilityImpactCalcType || "Product of all");
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
    // Clear previous errors
    const errors: { [key: string]: string } = {};

    // Validation: Risk Name
    if (!formData.riskName.trim()) {
      errors.riskName = t("Risk name is required");
    } else if (!isValidName(formData.riskName.trim())) {
      errors.riskName = t("Only letters, spaces, and hyphens are allowed");
    }

    // Validation: Risk Description
    if (!formData.riskDescription.trim()) {
      errors.riskDescription = t("Risk description is required");
    }

    // Validation: Inherent Likelihood
    if (!formData.inherentLikelihood) {
      errors.inherentLikelihood = t("Inherent likelihood is required");
    }

    // Validation: Inherent Impact
    if (!formData.inherentImpact) {
      errors.inherentImpact = t("Inherent impact is required");
    }

    // Validation: Residual Likelihood
    if (!formData.residualLikelihood) {
      errors.residualLikelihood = t("Residual likelihood is required");
    }

    // Validation: Residual Impact
    if (!formData.residualImpact) {
      errors.residualImpact = t("Residual impact is required");
    }

    // Validation: Category
    if (!formData.categoryId) {
      errors.categoryId = t("Risk category is required");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});
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
          subCategoryId: formData.subCategoryId || null,
          auditTypeId: formData.auditTypeId || null,
          riskDrivers: formData.riskDrivers || null,
          riskConsequences: formData.riskConsequences || null,
          relatedLawRegulation: formData.relatedLawRegulation || null,
          controlsData: JSON.stringify(controls.filter(c => c.description.trim())),
          processIds: selectedProcessIds,
        }),
      });

      if (response.ok) {
        const savedRisk = await response.json();
        triggerTranslation('InternalAuditRisk', savedRisk.id, { riskName: savedRisk.riskName, riskDescription: savedRisk.riskDescription });
        toast({
          title: t("Success"),
          description: t("Risk created successfully."),
        });
        closeAddRiskModal();
        fetchRisks();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to create risk."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to create risk:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create risk."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Submit Edit Risk form
  const handleEditRiskSubmit = async () => {
    if (!editingRisk) {
      return;
    }

    // Clear previous errors
    const errors: { [key: string]: string } = {};

    // Validation: Risk Name
    if (!formData.riskName.trim()) {
      errors.riskName = t("Risk name is required");
    } else if (!isValidName(formData.riskName.trim())) {
      errors.riskName = t("Only letters, spaces, and hyphens are allowed");
    }

    // Validation: Risk Description
    if (!formData.riskDescription.trim()) {
      errors.riskDescription = t("Risk description is required");
    }

    // Validation: Inherent Likelihood
    if (!formData.inherentLikelihood) {
      errors.inherentLikelihood = t("Inherent likelihood is required");
    }

    // Validation: Inherent Impact
    if (!formData.inherentImpact) {
      errors.inherentImpact = t("Inherent impact is required");
    }

    // Validation: Residual Likelihood
    if (!formData.residualLikelihood) {
      errors.residualLikelihood = t("Residual likelihood is required");
    }

    // Validation: Residual Impact
    if (!formData.residualImpact) {
      errors.residualImpact = t("Residual impact is required");
    }

    // Validation: Category
    if (!formData.categoryId) {
      errors.categoryId = t("Risk category is required");
    }

    // If there are validation errors, set them and stop
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Clear errors if validation passes
    setFieldErrors({});
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
          subCategoryId: formData.subCategoryId || null,
          auditTypeId: formData.auditTypeId || null,
          riskDrivers: formData.riskDrivers || null,
          riskConsequences: formData.riskConsequences || null,
          relatedLawRegulation: formData.relatedLawRegulation || null,
          controlsData: JSON.stringify(controls.filter(c => c.description.trim())),
          processIds: selectedProcessIds,
        }),
      });

      if (response.ok) {
        const savedRisk = await response.json();
        triggerTranslation('InternalAuditRisk', savedRisk.id, { riskName: savedRisk.riskName, riskDescription: savedRisk.riskDescription });
        toast({
          title: t("Success"),
          description: t("Risk updated successfully."),
        });
        closeEditRiskModal();
        fetchRisks();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.error || t("Failed to update risk."),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update risk:", error);
      toast({
        title: t("Error"),
        description: t("Failed to update risk."),
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
        {t(priority)}
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
        {t(level)}
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
        {t(status)}
      </span>
    );
  };

  // Computed sub-categories filtered by selected category
  const filteredSubCategories = subCategories.filter(sc => sc.categoryId === formData.categoryId);

  // Process multi-select toggle
  const toggleProcess = (id: string) => {
    setSelectedProcessIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Control management functions
  const addControl = () => setControls(prev => [...prev, { description: '', effectiveness: '' }]);
  const removeControl = (i: number) => setControls(prev => prev.filter((_, idx) => idx !== i));
  const updateControl = (i: number, field: 'description' | 'effectiveness', val: string) =>
    setControls(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));

  const dateLocaleMap: Record<string, string> = { en: "en-US", ar: "ar-SA", lv: "lv-LV" };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(dateLocaleMap[locale] || "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // AI Audit Selection - Filter risks for popup
  // Rules: High/Medium risk level, no audit plan (engagementId null), active status (Open)
  const getEligibleRisksForAIAudit = () => {
    return risks.filter((risk) => {
      // Must be High or Medium risk level
      const isHighOrMedium = risk.riskLevel === "High" || risk.riskLevel === "Medium";
      // Must not have an associated audit plan
      const hasNoAuditPlan = !risk.engagementId;
      // Must be active (Open status)
      const isActive = risk.status === "Open";

      return isHighOrMedium && hasNoAuditPlan && isActive;
    });
  };

  // Group eligible risks by department
  const getEligibleRisksGroupedByDepartment = () => {
    const eligibleRisks = getEligibleRisksForAIAudit();
    const grouped: Record<string, { department: Department; risks: InternalAuditRisk[] }> = {};

    eligibleRisks.forEach((risk) => {
      const deptKey = risk.departmentId || "unassigned";
      const deptName = risk.department?.name || t("Unassigned");

      if (!grouped[deptKey]) {
        grouped[deptKey] = {
          department: risk.department || { id: "unassigned", name: t("Unassigned") },
          risks: [],
        };
      }
      grouped[deptKey].risks.push(risk);
    });

    // Sort departments alphabetically, but put t("Unassigned") at the end
    return Object.values(grouped).sort((a, b) => {
      if (a.department.name === t("Unassigned")) return 1;
      if (b.department.name === t("Unassigned")) return -1;
      return a.department.name.localeCompare(b.department.name);
    });
  };

  // Open AI Audit Selection popup
  const openAIAuditSelection = () => {
    setAiAuditSelectionOpen(true);
  };

  // Generate fieldwork audit plan for a department (calls fieldwork-audit-plan API)
  const handleGenerateFieldworkPlan = async (group: { department: Department; risks: InternalAuditRisk[] }) => {
    const deptId = group.department.id;
    setGeneratingFieldworkDeptId(deptId);
    try {
      const risksPayload = group.risks.length
        ? group.risks.map((r) => ({
            associated_risk: (r.riskDescription || r.riskName || "").trim() || r.riskId,
            risks_level: RISK_LEVEL_MAP[r.riskLevel ?? ""] || "medium",
          }))
        : [{ associated_risk: `General audit focus for ${group.department.name}`, risks_level: "medium" as const }];

      const payload = { department_name: group.department.name, risks: risksPayload };
      const res = await fetch("/api/internal-audit/fieldwork-audit-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: t("Error"), description: data?.error || t("Failed to generate audit plan"), variant: "destructive" });
        return;
      }
      setFieldworkPlanResult(data as FieldworkAuditPlanResponse);
      setCurrentDepartmentId(deptId); // Store department ID for adding to planning
      setFieldworkPlanDialogOpen(true);
      toast({ title: t("Success"), description: t("Audit plan generated") });
    } catch (e) {
      console.error("Generate fieldwork audit plan error:", e);
      toast({ title: t("Error"), description: t("Failed to generate audit plan"), variant: "destructive" });
    } finally {
      setGeneratingFieldworkDeptId(null);
    }
  };

  // Add audit plan to Audit Planning module
  const handleAddToAuditPlan = async (plan: AuditPlanItem, planIndex: number) => {
    if (!currentDepartmentId) {
      toast({ title: t("Error"), description: t("Department information missing"), variant: "destructive" });
      return;
    }

    setAddingToPlanning(planIndex);
    try {
      const res = await fetch("/api/internal-audit/audit-planning/from-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_code: plan.audit_code,
          audit_title: plan.audit_title,
          audit_objective: plan.audit_objective,
          audit_scope: plan.audit_scope,
          associated_risks: plan.associated_risks,
          audit_tasks: plan.audit_tasks,
          department_name: fieldworkPlanResult?.department_name,
          departmentId: currentDepartmentId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle duplicate (409 Conflict) with warning message
        if (res.status === 409) {
          toast({
            title: t("Warning"),
            description: data?.error || t("This audit plan has already been added to Audit Planning."),
            variant: "default"
          });
        } else {
          toast({ title: t("Error"), description: data?.error || t("Failed to add to audit plan"), variant: "destructive" });
        }
        return;
      }

      toast({ title: t("Success"), description: t("Successfully added to Audit Planning!") });

      // Optionally navigate to audit planning
      // router.push("/internal-audit/audit-planning");
    } catch (e) {
      console.error("Add to audit plan error:", e);
      toast({ title: t("Error"), description: t("Failed to add to audit plan"), variant: "destructive" });
    } finally {
      setAddingToPlanning(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Risk Register")}</h1>
        </div>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading risks...")}</p>
          </div>
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
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          </>
        )}
        <span className="text-primary-700 font-medium">{t("Risk Register")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Risk Register")}</h1>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openAIAuditSelection}
            className="col-span-2 sm:col-span-1 bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200"
          >
            <Sparkles className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("AI Audit")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Export")}
          </Button>
          {!isReadOnlyRole && (
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Import")}
            </Button>
          )}
          {!isReadOnlyRole && (
            <Button size="sm" className="col-span-2 sm:col-span-1" onClick={openAddRiskModal}>
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Add Risk")}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search risks...")}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full h-9 ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
              disabled={isReadOnlyRole}
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto sm:ltr:ml-auto sm:rtl:mr-auto">
            <Select value={yearFilter} onValueChange={setYearFilter} disabled={isReadOnlyRole}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200" disabled={isReadOnlyRole}>
                <SelectValue placeholder={t("Year")} />
              </SelectTrigger>
              <SelectContent className="bg-white" position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Years")}</SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={isReadOnlyRole}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200" disabled={isReadOnlyRole}>
                <SelectValue placeholder={t("Department")} />
              </SelectTrigger>
              <SelectContent className="bg-white" position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Departments")}</SelectItem>
                {translatedDepartments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap ltr:pl-5 rtl:pr-5 min-w-[100px]">{t("Risk ID")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[200px]">{t("Risk Description")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[130px]">{t("Department")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[120px]">{t("Creation Date")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[110px]">{t("Category")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[110px]">{t("Inherent Score")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[110px]">{t("Residual Score")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[100px]">{t("Risk Level")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[90px]">{t("Status")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap ltr:pr-5 rtl:pl-5 min-w-[90px]">{t("Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRisks.map((risk) => (
                <TableRow key={risk.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5 whitespace-nowrap">{risk.riskId}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 max-w-[250px] truncate">{risk.riskDescription || risk.riskName}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{tDept(risk.departmentId) || risk.department?.name || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{formatDate(risk.creationDate)}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{tCat(risk.categoryId) || risk.category?.name || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{risk.inherentScore ?? "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{risk.residualScore ?? "-"}</TableCell>
                  <TableCell className="py-3 whitespace-nowrap">{getRiskLevelBadge(risk.riskLevel)}</TableCell>
                  <TableCell className="py-3 whitespace-nowrap">{getStatusBadge(risk.status)}</TableCell>
                  <TableCell className="py-3 ltr:pr-5 rtl:pl-5 whitespace-nowrap">
                    {!isReadOnlyRole && (
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={() => openEditRiskModal(risk)}
                          title={t("Edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                          onClick={() => openDeleteDialog(risk)}
                          title={t("Delete")}
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
                  <TableCell colSpan={10} className="h-24 text-center text-sm text-slate-500">
                    {isReadOnlyRole ? t("No risks found.") : t("No risks found. Click \"Add Risk\" to create your first risk.")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <PaginationUI
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete this risk? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Import Risks")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            {/* File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t("Upload File")}</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={selectedFile?.name || ""}
                  placeholder={t("Select a file...")}
                  className="flex-1 bg-white"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("import-file-input")?.click()}
                >
                  {t("Browse")}
                </Button>
                <input
                  id="import-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              <p className="text-xs text-slate-500">{t("Supported formats: CSV, XLSX, XLS")}</p>
            </div>

            {/* Download Template */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Download Template")}
              </Button>
              <span className="text-xs text-slate-500">{t("Download the template file to see the required format")}</span>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setSelectedFile(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!selectedFile || importing}
            >
              {importing ? t("Importing...") : t("Import")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Recommended Audits Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[900px] max-h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Sparkles className="h-5 w-5 text-purple-500" />
                {t("AI Recommended Audits")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loadingAI ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-4" />
                <p className="text-sm text-slate-500">{t("Analyzing risks and generating recommendations...")}</p>
              </div>
            ) : aiRecommendations ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-info-light rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-info">{aiRecommendations.summary.totalRisks}</p>
                    <p className="text-xs text-info">{t("Total Risks")}</p>
                  </div>
                  <div className="bg-risk-critical-bg rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-risk-critical">{aiRecommendations.summary.extremeRisks}</p>
                    <p className="text-xs text-risk-critical">{t("Extreme Risks")}</p>
                  </div>
                  <div className="bg-risk-high-bg rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-risk-high">{aiRecommendations.summary.highRisks}</p>
                    <p className="text-xs text-risk-high">{t("High Risks")}</p>
                  </div>
                  <div className="bg-primary-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-primary-600">{aiRecommendations.summary.recommendationsGenerated}</p>
                    <p className="text-xs text-primary-600">{t("Recommendations")}</p>
                  </div>
                </div>

                {/* Recommendations List */}
                {aiRecommendations.recommendations.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-700">{t("Recommended Audits")}</h3>
                    {aiRecommendations.recommendations.map((rec) => (
                      <div
                        key={rec.id}
                        className="border border-slate-200 rounded-lg p-4 bg-white"
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
                            <span>{t("Department")}: <strong>{rec.department}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Calendar className="h-4 w-4" />
                            <span>{t("Duration")}: <strong>{rec.estimatedDuration}</strong></span>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded p-3 mb-3">
                          <p className="text-sm text-slate-700">
                            <strong className="text-slate-800">{t("Justification")}:</strong> {rec.justification}
                          </p>
                        </div>

                        <div className="text-sm">
                          <p className="text-slate-600 mb-2">
                            <strong>{t("Suggested Scope")}:</strong> {rec.suggestedScope}
                          </p>
                          {rec.relatedRisks.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <AlertTriangle className="h-4 w-4 text-warning" />
                              <span className="text-slate-500">{t("Related Risks")}:</span>
                              {rec.relatedRisks.map((riskIdItem) => (
                                <span key={riskIdItem} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                  {riskIdItem}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex ltr:justify-end rtl:justify-start">
                          <Button
                            size="sm"
                            onClick={() => {
                              router.push(`/internal-audit/audit-plan?suggested=${encodeURIComponent(rec.auditName)}&department=${encodeURIComponent(rec.department)}`);
                              setAiDialogOpen(false);
                            }}
                          >
                            <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                            {t("Create Audit")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p>{t("No audit recommendations at this time.")}</p>
                    <p className="text-sm mt-2">{t("Add more risks to the register to generate AI recommendations.")}</p>
                  </div>
                )}

                <div className="text-xs text-slate-400 ltr:text-right rtl:text-left">
                  {t("Generated at")}: {new Date(aiRecommendations.generatedAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>{t("Failed to load recommendations. Please try again.")}</p>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setAiDialogOpen(false)}>
              {t("Close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Audit Selection Dialog - Frontend filtered risks grouped by department */}
      <Dialog open={aiAuditSelectionOpen} onOpenChange={setAiAuditSelectionOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[800px] max-h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Sparkles className="h-5 w-5 text-purple-500" />
                {t("AI Audit")} – {t("Risk Selection")}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-500 mt-2">
              {t("Review eligible risks grouped by department. Only High and Medium risks without audit plans are shown.")}
            </p>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {(() => {
              const groupedRisks = getEligibleRisksGroupedByDepartment();

              if (groupedRisks.length === 0) {
                return (
                  <div className="text-center py-12">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-600 font-medium">{t("No Eligible Risks Found")}</p>
                    <p className="text-sm text-slate-500 mt-2">
                      {t("All risks either have Low risk level, are already linked to audit plans, or are not active.")}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-800">{getEligibleRisksForAIAudit().length}</span> {t("eligible risks")} {t("across")} <span className="font-semibold text-slate-800">{groupedRisks.length}</span> {t("departments")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-risk-high-bg text-risk-high">
                        {t("High")}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-risk-medium-bg text-risk-medium">
                        {t("Medium")}
                      </span>
                    </div>
                  </div>

                  {/* Department Groups */}
                  {groupedRisks.map((group) => (
                    <div key={group.department.id} className="border border-slate-200 rounded-lg overflow-hidden">
                      {/* Department Header */}
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary-600" />
                          <h3 className="font-semibold text-slate-800">{group.department.name}</h3>
                          <span className="text-xs text-slate-500">({group.risks.length} {t("risks")})</span>
                        </div>
                        {/* Generate Audit Plan button - calls fieldwork-audit-plan API */}
                        {isAuditHead && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-primary-50 hover:bg-primary-100 text-primary-700 border-primary-200"
                            onClick={() => handleGenerateFieldworkPlan(group)}
                            disabled={!!generatingFieldworkDeptId}
                          >
                            {generatingFieldworkDeptId === group.department.id ? (
                              <>
                                <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                                {t("Generating...")}
                              </>
                            ) : (
                              <>
                                <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {t("Generate Audit Plan")}
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Risk List */}
                      <div className="divide-y divide-slate-100">
                        {group.risks.map((risk) => (
                          <div key={risk.id} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-mono text-slate-400">{risk.riskId}</span>
                                  <span className="font-medium text-slate-800">{risk.riskName}</span>
                                </div>
                                {risk.riskDescription && (
                                  <p className="text-sm text-slate-500 line-clamp-2">{risk.riskDescription}</p>
                                )}
                                {risk.category && (
                                  <p className="text-xs text-slate-400 mt-1">
                                    {t("Category")}: {risk.category.name}
                                  </p>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                {getRiskLevelBadge(risk.riskLevel)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex ltr:justify-end rtl:justify-start">
            <Button
              variant="outline"
              onClick={() => setAiAuditSelectionOpen(false)}
            >
              {t("Cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fieldwork Audit Plan Result Dialog */}
      <Dialog open={fieldworkPlanDialogOpen} onOpenChange={setFieldworkPlanDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Generated Audit Plan")}</DialogTitle>
              {fieldworkPlanResult?.department_name && (
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  {t("Department")}: {fieldworkPlanResult.department_name}
                </DialogDescription>
              )}
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-4">
              {fieldworkPlanResult?.audit_plan?.length ? (
                fieldworkPlanResult.audit_plan.map((plan, idx) => (
                  <Card key={idx}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-base">
                            {plan.audit_code} – {plan.audit_title}
                          </CardTitle>
                          {plan.audit_objective && (
                            <CardDescription className="mt-1">{t("Objective")}: {plan.audit_objective}</CardDescription>
                          )}
                          {plan.audit_scope && (
                            <p className="text-sm text-slate-500 mt-1">{t("Scope")}: {plan.audit_scope}</p>
                          )}
                          {plan.associated_risks?.length > 0 && (
                            <p className="text-xs text-slate-400 mt-1">
                              {t("Associated risks")}: {plan.associated_risks.join("; ")}
                            </p>
                          )}
                        </div>
                        <Button
                          className="bg-primary-600 hover:bg-primary-700 shrink-0"
                          onClick={() => handleAddToAuditPlan(plan, idx)}
                          disabled={addingToPlanning !== null}
                        >
                          {addingToPlanning === idx ? (
                            <>
                              <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                              {t("Adding...")}
                            </>
                          ) : (
                            t("Add to Audit Plan")
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {plan.audit_tasks?.map((task, ti) => (
                        <div key={ti} className="rounded border border-slate-200 p-3 text-sm">
                          <p className="font-medium text-slate-800">{task.task_name}</p>
                          {task.audit_steps?.length > 0 && (
                            <ul className="list-disc list-inside mt-1 text-slate-500">
                              {task.audit_steps.slice(0, 3).map((s, si) => (
                                <li key={si}>{s}</li>
                              ))}
                              {task.audit_steps.length > 3 && (
                                <li>…{t("and")} {task.audit_steps.length - 3} {t("more")}</li>
                              )}
                            </ul>
                          )}
                          {task.evidence_to_collect?.length > 0 && (
                            <p className="mt-1 text-xs text-slate-400">{t("Evidence")}: {task.evidence_to_collect.slice(0, 2).join(", ")}</p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-slate-500">{t("No audit plans in response.")}</p>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setFieldworkPlanDialogOpen(false)}>
              {t("Close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Risk Modal */}
      <Dialog open={isAddRiskOpen} onOpenChange={setIsAddRiskOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Add Risk")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Basic Information")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Risk ID")} <span className="text-slate-400 font-normal text-xs">({t("Auto-generated")})</span></Label>
                    <Input
                      value={formData.riskId}
                      placeholder={t("Auto-generated if left empty")}
                      className="mt-1.5 w-full bg-slate-50"
                      disabled
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Risk Name")} <span className="text-error">*</span></Label>
                    <Input
                      value={formData.riskName}
                      onChange={(e) => {
                        setFormData({ ...formData, riskName: e.target.value });
                        if (fieldErrors.riskName) {
                          setFieldErrors({ ...fieldErrors, riskName: "" });
                        }
                      }}
                      placeholder={t("Enter risk name")}
                      className={`mt-1.5 w-full bg-white ${fieldErrors.riskName ? "border-red-500" : ""}`}
                    />
                    {fieldErrors.riskName && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.riskName}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                    <Select
                      value={formData.departmentId}
                      onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder={t("Select department")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white" position="popper" sideOffset={4}>
                        {translatedDepartments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Category")} <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.categoryId}
                      onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                    >
                      <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.categoryId ? "border-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select category")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white" position="popper" sideOffset={4}>
                        {translatedCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.categoryId && <p className="text-red-500 text-xs mt-1">{fieldErrors.categoryId}</p>}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Risk Sub-Category")}</Label>
                    <Select
                      value={formData.subCategoryId}
                      onValueChange={(value) => setFormData({ ...formData, subCategoryId: value })}
                      disabled={!formData.categoryId}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder={formData.categoryId ? t("Select sub-category") : t("Select category first")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white" position="popper" sideOffset={4}>
                        {filteredSubCategories.map((sc) => (
                          <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Audit Type")}</Label>
                    <Select
                      value={formData.auditTypeId}
                      onValueChange={(value) => setFormData({ ...formData, auditTypeId: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder={t("Select audit type")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white" position="popper" sideOffset={4}>
                        {translatedAuditTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Section/Process")}</Label>
                    <Input
                      value={formData.sectionProcess}
                      onChange={(e) => setFormData({ ...formData, sectionProcess: e.target.value })}
                      placeholder={t("Enter section/process")}
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Sub Process")}</Label>
                    <Input
                      value={formData.subProcess}
                      onChange={(e) => setFormData({ ...formData, subProcess: e.target.value })}
                      placeholder={t("Enter sub process")}
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Activity")}</Label>
                    <Input
                      value={formData.activity}
                      onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                      placeholder={t("Enter activity")}
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Risk Description")} <span className="text-red-500">*</span></Label>
                  <Textarea
                    value={formData.riskDescription}
                    onChange={(e) => {
                      setFormData({ ...formData, riskDescription: e.target.value });
                      if (fieldErrors.riskDescription) {
                        setFieldErrors({ ...fieldErrors, riskDescription: "" });
                      }
                    }}
                    placeholder={t("Enter risk description")}
                    className={`mt-1.5 w-full bg-white ${fieldErrors.riskDescription ? "border-red-500" : ""}`}
                    rows={3}
                  />
                  {fieldErrors.riskDescription && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.riskDescription}</p>
                  )}
                </div>
              </div>

              {/* Inherent Risk Assessment */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Inherent Risk Assessment")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Likelihood")} <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.inherentLikelihood}
                      onValueChange={(value) => {
                        setFormData({ ...formData, inherentLikelihood: value });
                        if (fieldErrors.inherentLikelihood) {
                          setFieldErrors({ ...fieldErrors, inherentLikelihood: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.inherentLikelihood ? "border-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select likelihood")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white" position="popper" sideOffset={4}>
                        {translatedProbabilities.map((prob) => (
                          <SelectItem key={prob.id} value={prob.value.toString()}>
                            {prob.label} ({prob.value})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.inherentLikelihood && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.inherentLikelihood}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Impact")} <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.inherentImpact}
                      onValueChange={(value) => {
                        setFormData({ ...formData, inherentImpact: value });
                        if (fieldErrors.inherentImpact) {
                          setFieldErrors({ ...fieldErrors, inherentImpact: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.inherentImpact ? "border-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select impact")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white" position="popper" sideOffset={4}>
                        {translatedImpacts.map((imp) => (
                          <SelectItem key={imp.id} value={imp.value.toString()}>
                            {imp.label} ({imp.value})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.inherentImpact && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.inherentImpact}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Risk Drivers & Consequences */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Risk Drivers & Consequences")}</h3>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Risk Driver(s) / Cause(s)")}</Label>
                  <Textarea
                    value={formData.riskDrivers}
                    onChange={(e) => setFormData({ ...formData, riskDrivers: e.target.value })}
                    placeholder={t("Describe the root causes or drivers of this risk")}
                    className="mt-1.5 w-full bg-white"
                    rows={2}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Risk Consequence(s)")}</Label>
                  <Textarea
                    value={formData.riskConsequences}
                    onChange={(e) => setFormData({ ...formData, riskConsequences: e.target.value })}
                    placeholder={t("Describe the potential consequences of this risk")}
                    className="mt-1.5 w-full bg-white"
                    rows={2}
                  />
                </div>
              </div>

              {/* Linked Processes */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Linked Processes")}</h3>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Processes")}</Label>
                  <div className="mt-1.5 border rounded-md bg-white max-h-40 overflow-y-auto p-2 space-y-1">
                    {iaProcesses.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2 text-center">{t("No processes available")}</p>
                    ) : iaProcesses.map(proc => {
                      const isSelected = selectedProcessIds.includes(proc.id);
                      return (
                        <div
                          key={proc.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${isSelected ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50'}`}
                          onClick={() => toggleProcess(proc.id)}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-300'}`}>
                            {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <span>{proc.name}</span>
                          {proc.processCode && <span className="text-xs text-slate-400">({proc.processCode})</span>}
                        </div>
                      );
                    })}
                  </div>
                  {selectedProcessIds.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">{selectedProcessIds.length} {t("process(es) selected")}</p>
                  )}
                </div>
              </div>

              {/* Control Information — multi */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-semibold text-slate-800">{t("Control Information")}</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addControl} className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" /> {t("Add Control")}
                  </Button>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                  {controls.map((ctrl, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-3 relative">
                      {controls.length > 1 && (
                        <button type="button" onClick={() => removeControl(i)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <div>
                        <Label className="text-sm font-medium text-slate-700">{t("Control Description")}{controls.length > 1 ? ` #${i + 1}` : ''}</Label>
                        <Textarea
                          value={ctrl.description}
                          onChange={(e) => updateControl(i, 'description', e.target.value)}
                          placeholder={t("Enter control description")}
                          className="mt-1.5 w-full bg-white"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-slate-700">{t("Control Effectiveness")}</Label>
                        <Select value={ctrl.effectiveness} onValueChange={(v) => updateControl(i, 'effectiveness', v)}>
                          <SelectTrigger className="mt-1.5 w-full bg-white">
                            <SelectValue placeholder={t("Select effectiveness")} />
                          </SelectTrigger>
                          <SelectContent className="bg-white" position="popper" sideOffset={4}>
                            <SelectItem value="Effective">{t("Effective")}</SelectItem>
                            <SelectItem value="Partially Effective">{t("Partially Effective")}</SelectItem>
                            <SelectItem value="Ineffective">{t("Ineffective")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Residual Risk Assessment */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Residual Risk Assessment")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Likelihood")} <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.residualLikelihood}
                      onValueChange={(value) => {
                        setFormData({ ...formData, residualLikelihood: value });
                        if (fieldErrors.residualLikelihood) {
                          setFieldErrors({ ...fieldErrors, residualLikelihood: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.residualLikelihood ? "border-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select likelihood")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white" position="popper" sideOffset={4}>
                        {translatedProbabilities.map((prob) => (
                          <SelectItem key={prob.id} value={prob.value.toString()}>
                            {prob.label} ({prob.value})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.residualLikelihood && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.residualLikelihood}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Impact")} <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.residualImpact}
                      onValueChange={(value) => {
                        setFormData({ ...formData, residualImpact: value });
                        if (fieldErrors.residualImpact) {
                          setFieldErrors({ ...fieldErrors, residualImpact: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.residualImpact ? "border-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select impact")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white" position="popper" sideOffset={4}>
                        {translatedImpacts.map((imp) => (
                          <SelectItem key={imp.id} value={imp.value.toString()}>
                            {imp.label} ({imp.value})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldErrors.residualImpact && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.residualImpact}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Related Law / Regulation / Policy Reference */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Related Law / Regulation / Policy Reference")}</h3>
                <div>
                  <Textarea
                    value={formData.relatedLawRegulation}
                    onChange={(e) => setFormData({ ...formData, relatedLawRegulation: e.target.value })}
                    placeholder={t("Enter related laws, regulations, or policy references")}
                    className="w-full bg-white"
                    rows={2}
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Additional Information")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Creation Date")}</Label>
                    <div className="mt-1.5">
                      <DatePicker
                        value={formData.creationDate}
                        onChange={(date) => setFormData({ ...formData, creationDate: date ? format(date, "yyyy-MM-dd") : "" })}
                        placeholder={t("Select creation date")}
                        className="w-full bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder={t("Select status")} />
                      </SelectTrigger>
                      <SelectContent className="bg-white" position="popper" sideOffset={4}>
                        <SelectItem value="Open">{t("Open")}</SelectItem>
                        <SelectItem value="Under Review">{t("Under Review")}</SelectItem>
                        <SelectItem value="Closed">{t("Closed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-sm font-medium text-slate-700">{t("Audit Comment")}</Label>
                    <Textarea
                      value={formData.auditComment}
                      onChange={(e) => setFormData({ ...formData, auditComment: e.target.value })}
                      placeholder={t("Enter audit comment")}
                      className="mt-1.5 w-full bg-white"
                      rows={2}
                    />
                  </div>
                </div>

                {/* File Upload Section */}
                <div className="mt-4">
                  <Label className="text-sm font-medium text-slate-700">{t("Attachments")}</Label>
                  <div
                    className={`mt-1.5 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                      isDragOver ? "border-primary bg-primary-50" : "border-slate-200"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                        <p className="text-slate-500 text-sm">{t("Uploading...")}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Upload className="h-8 w-8 text-slate-400 mb-2" />
                        <p className="text-slate-600 text-sm font-medium">{t("Drag and drop files here")}</p>
                        <p className="text-slate-400 text-xs mt-1">{t("or click to browse")}</p>
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
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={closeAddRiskModal}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddRiskSubmit} disabled={saving}>
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Risk Modal */}
      <Dialog open={isEditRiskOpen} onOpenChange={setIsEditRiskOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Edit Risk")} {editingRisk?.riskId ? `- ${editingRisk.riskId}` : ""}
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
                  <p className="text-sm text-slate-500 font-medium">{t("Loading risk details...")}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Basic Information")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Risk ID")}</Label>
                      <Input
                        value={formData.riskId}
                        className="mt-1.5 w-full bg-slate-50"
                        disabled
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Risk Name")} <span className="text-error">*</span></Label>
                      <Input
                        value={formData.riskName}
                        onChange={(e) => {
                          setFormData({ ...formData, riskName: e.target.value });
                          if (fieldErrors.riskName) {
                            setFieldErrors({ ...fieldErrors, riskName: "" });
                          }
                        }}
                        placeholder={t("Enter risk name")}
                        className={`mt-1.5 w-full bg-white ${fieldErrors.riskName ? "border-red-500" : ""}`}
                      />
                      {fieldErrors.riskName && (
                        <p className="text-red-500 text-xs mt-1">{fieldErrors.riskName}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                      <Select
                        value={formData.departmentId}
                        onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder={t("Select department")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white" position="popper" sideOffset={4}>
                          {translatedDepartments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Category")} <span className="text-red-500">*</span></Label>
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                      >
                        <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.categoryId ? "border-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select category")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white" position="popper" sideOffset={4}>
                          {translatedCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErrors.categoryId && <p className="text-red-500 text-xs mt-1">{fieldErrors.categoryId}</p>}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Risk Sub-Category")}</Label>
                      <Select
                        value={formData.subCategoryId}
                        onValueChange={(value) => setFormData({ ...formData, subCategoryId: value })}
                        disabled={!formData.categoryId}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder={formData.categoryId ? t("Select sub-category") : t("Select category first")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white" position="popper" sideOffset={4}>
                          {filteredSubCategories.map((sc) => (
                            <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Audit Type")}</Label>
                      <Select
                        value={formData.auditTypeId}
                        onValueChange={(value) => setFormData({ ...formData, auditTypeId: value })}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder={t("Select audit type")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white" position="popper" sideOffset={4}>
                          {translatedAuditTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Section/Process")}</Label>
                      <Input
                        value={formData.sectionProcess}
                        onChange={(e) => setFormData({ ...formData, sectionProcess: e.target.value })}
                        placeholder={t("Enter section/process")}
                        className="mt-1.5 w-full bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Sub Process")}</Label>
                      <Input
                        value={formData.subProcess}
                        onChange={(e) => setFormData({ ...formData, subProcess: e.target.value })}
                        placeholder={t("Enter sub process")}
                        className="mt-1.5 w-full bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Activity")}</Label>
                      <Input
                        value={formData.activity}
                        onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                        placeholder={t("Enter activity")}
                        className="mt-1.5 w-full bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Risk Description")} <span className="text-red-500">*</span></Label>
                    <Textarea
                      value={formData.riskDescription}
                      onChange={(e) => {
                        setFormData({ ...formData, riskDescription: e.target.value });
                        if (fieldErrors.riskDescription) {
                          setFieldErrors({ ...fieldErrors, riskDescription: "" });
                        }
                      }}
                      placeholder={t("Enter risk description")}
                      className={`mt-1.5 w-full bg-white ${fieldErrors.riskDescription ? "border-red-500" : ""}`}
                      rows={3}
                    />
                    {fieldErrors.riskDescription && (
                      <p className="text-red-500 text-xs mt-1">{fieldErrors.riskDescription}</p>
                    )}
                  </div>
                </div>

                {/* Inherent Risk Assessment */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Inherent Risk Assessment")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Likelihood")} <span className="text-red-500">*</span></Label>
                      <Select
                        value={formData.inherentLikelihood}
                        onValueChange={(value) => {
                          setFormData({ ...formData, inherentLikelihood: value });
                          if (fieldErrors.inherentLikelihood) {
                            setFieldErrors({ ...fieldErrors, inherentLikelihood: "" });
                          }
                        }}
                      >
                        <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.inherentLikelihood ? "border-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select likelihood")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white" position="popper" sideOffset={4}>
                          {translatedProbabilities.map((prob) => (
                            <SelectItem key={prob.id} value={prob.value.toString()}>
                              {prob.label} ({prob.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErrors.inherentLikelihood && (
                        <p className="text-red-500 text-xs mt-1">{fieldErrors.inherentLikelihood}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Impact")} <span className="text-red-500">*</span></Label>
                      <Select
                        value={formData.inherentImpact}
                        onValueChange={(value) => {
                          setFormData({ ...formData, inherentImpact: value });
                          if (fieldErrors.inherentImpact) {
                            setFieldErrors({ ...fieldErrors, inherentImpact: "" });
                          }
                        }}
                      >
                        <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.inherentImpact ? "border-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select impact")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white" position="popper" sideOffset={4}>
                          {translatedImpacts.map((imp) => (
                            <SelectItem key={imp.id} value={imp.value.toString()}>
                              {imp.label} ({imp.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErrors.inherentImpact && (
                        <p className="text-red-500 text-xs mt-1">{fieldErrors.inherentImpact}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Risk Drivers & Consequences */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Risk Drivers & Consequences")}</h3>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Risk Driver(s) / Cause(s)")}</Label>
                    <Textarea
                      value={formData.riskDrivers}
                      onChange={(e) => setFormData({ ...formData, riskDrivers: e.target.value })}
                      placeholder={t("Describe the root causes or drivers of this risk")}
                      className="mt-1.5 w-full bg-white"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Risk Consequence(s)")}</Label>
                    <Textarea
                      value={formData.riskConsequences}
                      onChange={(e) => setFormData({ ...formData, riskConsequences: e.target.value })}
                      placeholder={t("Describe the potential consequences of this risk")}
                      className="mt-1.5 w-full bg-white"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Linked Processes */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Linked Processes")}</h3>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Processes")}</Label>
                    <div className="mt-1.5 border rounded-md bg-white max-h-40 overflow-y-auto p-2 space-y-1">
                      {iaProcesses.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2 text-center">{t("No processes available")}</p>
                      ) : iaProcesses.map(proc => {
                        const isSelected = selectedProcessIds.includes(proc.id);
                        return (
                          <div
                            key={proc.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${isSelected ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50'}`}
                            onClick={() => toggleProcess(proc.id)}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-300'}`}>
                              {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span>{proc.name}</span>
                            {proc.processCode && <span className="text-xs text-slate-400">({proc.processCode})</span>}
                          </div>
                        );
                      })}
                    </div>
                    {selectedProcessIds.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">{selectedProcessIds.length} {t("process(es) selected")}</p>
                    )}
                  </div>
                </div>

                {/* Control Information — multi */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-semibold text-slate-800">{t("Control Information")}</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addControl} className="h-7 text-xs gap-1">
                      <Plus className="h-3 w-3" /> {t("Add Control")}
                    </Button>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                    {controls.map((ctrl, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-3 relative">
                        {controls.length > 1 && (
                          <button type="button" onClick={() => removeControl(i)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <div>
                          <Label className="text-sm font-medium text-slate-700">{t("Control Description")}{controls.length > 1 ? ` #${i + 1}` : ''}</Label>
                          <Textarea
                            value={ctrl.description}
                            onChange={(e) => updateControl(i, 'description', e.target.value)}
                            placeholder={t("Enter control description")}
                            className="mt-1.5 w-full bg-white"
                            rows={2}
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-slate-700">{t("Control Effectiveness")}</Label>
                          <Select value={ctrl.effectiveness} onValueChange={(v) => updateControl(i, 'effectiveness', v)}>
                            <SelectTrigger className="mt-1.5 w-full bg-white">
                              <SelectValue placeholder={t("Select effectiveness")} />
                            </SelectTrigger>
                            <SelectContent className="bg-white" position="popper" sideOffset={4}>
                              <SelectItem value="Effective">{t("Effective")}</SelectItem>
                              <SelectItem value="Partially Effective">{t("Partially Effective")}</SelectItem>
                              <SelectItem value="Ineffective">{t("Ineffective")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Residual Risk Assessment */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Residual Risk Assessment")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Likelihood")} <span className="text-red-500">*</span></Label>
                      <Select
                        value={formData.residualLikelihood}
                        onValueChange={(value) => {
                          setFormData({ ...formData, residualLikelihood: value });
                          if (fieldErrors.residualLikelihood) {
                            setFieldErrors({ ...fieldErrors, residualLikelihood: "" });
                          }
                        }}
                      >
                        <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.residualLikelihood ? "border-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select likelihood")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white" position="popper" sideOffset={4}>
                          {translatedProbabilities.map((prob) => (
                            <SelectItem key={prob.id} value={prob.value.toString()}>
                              {prob.label} ({prob.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErrors.residualLikelihood && (
                        <p className="text-red-500 text-xs mt-1">{fieldErrors.residualLikelihood}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Impact")} <span className="text-red-500">*</span></Label>
                      <Select
                        value={formData.residualImpact}
                        onValueChange={(value) => {
                          setFormData({ ...formData, residualImpact: value });
                          if (fieldErrors.residualImpact) {
                            setFieldErrors({ ...fieldErrors, residualImpact: "" });
                          }
                        }}
                      >
                        <SelectTrigger className={`mt-1.5 w-full bg-white ${fieldErrors.residualImpact ? "border-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select impact")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white" position="popper" sideOffset={4}>
                          {translatedImpacts.map((imp) => (
                            <SelectItem key={imp.id} value={imp.value.toString()}>
                              {imp.label} ({imp.value})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldErrors.residualImpact && (
                        <p className="text-red-500 text-xs mt-1">{fieldErrors.residualImpact}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Related Law / Regulation / Policy Reference */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Related Law / Regulation / Policy Reference")}</h3>
                  <div>
                    <Textarea
                      value={formData.relatedLawRegulation}
                      onChange={(e) => setFormData({ ...formData, relatedLawRegulation: e.target.value })}
                      placeholder={t("Enter related laws, regulations, or policy references")}
                      className="w-full bg-white"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Additional Information */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Additional Information")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Creation Date")}</Label>
                      <div className="mt-1.5">
                        <DatePicker
                          value={formData.creationDate}
                          onChange={(date) => setFormData({ ...formData, creationDate: date ? format(date, "yyyy-MM-dd") : "" })}
                          placeholder={t("Select creation date")}
                          className="w-full bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder={t("Select status")} />
                        </SelectTrigger>
                        <SelectContent className="bg-white" position="popper" sideOffset={4}>
                          <SelectItem value="Open">{t("Open")}</SelectItem>
                          <SelectItem value="Under Review">{t("Under Review")}</SelectItem>
                          <SelectItem value="Closed">{t("Closed")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-slate-700">{t("Audit Comment")}</Label>
                      <Textarea
                        value={formData.auditComment}
                        onChange={(e) => setFormData({ ...formData, auditComment: e.target.value })}
                        placeholder={t("Enter audit comment")}
                        className="mt-1.5 w-full bg-white"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* File Upload Section */}
                <div className="mt-4">
                  <Label className="text-sm font-medium text-slate-700">{t("Attachments")}</Label>
                  <div
                    className={`mt-1.5 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                      isDragOver ? "border-primary bg-primary-50" : "border-slate-200"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                        <p className="text-slate-500 text-sm">{t("Uploading...")}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Upload className="h-8 w-8 text-slate-400 mb-2" />
                        <p className="text-slate-600 text-sm font-medium">{t("Drag and drop files here")}</p>
                        <p className="text-slate-400 text-xs mt-1">{t("or click to browse")}</p>
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
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={closeEditRiskModal}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleEditRiskSubmit} disabled={saving || formLoading}>
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Risk Modal */}
      <Dialog open={isViewRiskOpen} onOpenChange={setIsViewRiskOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Risk Details")} {viewingRisk?.riskId ? `- ${viewingRisk.riskId}` : ""}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {viewLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">{t("Loading risk details...")}</p>
                </div>
              </div>
            ) : viewingRisk ? (
              <div className="px-6 py-6 space-y-6">
                {/* Basic Information */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">{t("Basic Information")}</h3>
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                    <div className="grid grid-cols-3 gap-x-8 gap-y-5">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Risk ID")}</label>
                        <p className="text-sm font-semibold text-slate-900">{viewingRisk.riskId || "-"}</p>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Risk Name")}</label>
                        <p className="text-sm font-semibold text-slate-900">{(translatedViewRisk as InternalAuditRiskDetail | null)?.riskName || viewingRisk.riskName}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Department")}</label>
                        <p className="text-sm text-slate-700">{tDept(viewingRisk.departmentId) || viewingRisk.department?.name || "-"}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Category")}</label>
                        <p className="text-sm text-slate-700">{tCat(viewingRisk.categoryId) || viewingRisk.category?.name || "-"}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Risk Sub-Category")}</label>
                        <p className="text-sm text-slate-700">{viewingRisk.subCategory?.name || "-"}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Audit Type")}</label>
                        <p className="text-sm text-slate-700">{translatedAuditTypes.find(at => at.id === viewingRisk.auditTypeId)?.name || viewingRisk.auditType?.name || "-"}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Section/Process")}</label>
                        <p className="text-sm text-slate-700">{viewingRisk.sectionProcess || "-"}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Sub Process")}</label>
                        <p className="text-sm text-slate-700">{viewingRisk.subProcess || "-"}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Activity")}</label>
                        <p className="text-sm text-slate-700">{viewingRisk.activity || "-"}</p>
                      </div>
                    </div>
                    {viewingRisk.riskDescription && (
                      <div className="mt-5 pt-5 border-t border-slate-200">
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Risk Description")}</label>
                        <p className="text-sm text-slate-700 leading-relaxed">{(translatedViewRisk as InternalAuditRiskDetail | null)?.riskDescription || viewingRisk.riskDescription}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Risk Assessment Grid */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">{t("Risk Assessment")}</h3>
                  <div className="grid grid-cols-2 gap-5">
                    {/* Inherent Risk */}
                    <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                      <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-4">{t("Inherent Risk")}</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <label className="block text-xs text-amber-600 mb-1">{t("Likelihood")}</label>
                          <p className="text-2xl font-bold text-amber-900">{viewingRisk.inherentLikelihood ?? "-"}</p>
                        </div>
                        <div className="text-center">
                          <label className="block text-xs text-amber-600 mb-1">{t("Impact")}</label>
                          <p className="text-2xl font-bold text-amber-900">{viewingRisk.inherentImpact ?? "-"}</p>
                        </div>
                        <div className="text-center">
                          <label className="block text-xs text-amber-600 mb-1">{t("Score")}</label>
                          <p className="text-2xl font-bold text-amber-900">{viewingRisk.inherentScore ?? "-"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Residual Risk */}
                    <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
                      <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-4">{t("Residual Risk")}</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <label className="block text-xs text-emerald-600 mb-1">{t("Likelihood")}</label>
                          <p className="text-2xl font-bold text-emerald-900">{viewingRisk.residualLikelihood ?? "-"}</p>
                        </div>
                        <div className="text-center">
                          <label className="block text-xs text-emerald-600 mb-1">{t("Impact")}</label>
                          <p className="text-2xl font-bold text-emerald-900">{viewingRisk.residualImpact ?? "-"}</p>
                        </div>
                        <div className="text-center">
                          <label className="block text-xs text-emerald-600 mb-1">{t("Score")}</label>
                          <p className="text-2xl font-bold text-emerald-900">{viewingRisk.residualScore ?? "-"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Risk Level Badge */}
                  <div className="mt-4 flex items-center justify-between bg-slate-50 rounded-lg px-5 py-3 border border-slate-100">
                    <span className="text-sm font-medium text-slate-600">{t("Current Risk Level")}</span>
                    <div>{getRiskLevelBadge(viewingRisk.riskLevel)}</div>
                  </div>
                </section>

                {/* Risk Drivers & Consequences */}
                {(viewingRisk.riskDrivers || viewingRisk.riskConsequences) && (
                  <section>
                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">{t("Risk Drivers & Consequences")}</h3>
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 grid grid-cols-2 gap-6">
                      {viewingRisk.riskDrivers && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Risk Driver(s) / Cause(s)")}</label>
                          <p className="text-sm text-slate-700 leading-relaxed">{viewingRisk.riskDrivers}</p>
                        </div>
                      )}
                      {viewingRisk.riskConsequences && (
                        <div>
                          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Risk Consequence(s)")}</label>
                          <p className="text-sm text-slate-700 leading-relaxed">{viewingRisk.riskConsequences}</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Linked Processes */}
                {viewingRisk.processLinks && viewingRisk.processLinks.length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">{t("Linked Processes")}</h3>
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                      <div className="flex flex-wrap gap-2">
                        {viewingRisk.processLinks.map((pl: { process: { id: string; name: string; processCode?: string | null } }) => (
                          <span key={pl.process.id} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                            {pl.process.name}
                            {pl.process.processCode && <span className="text-blue-400">({pl.process.processCode})</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* Control Information */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">{t("Control Information")}</h3>
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-4">
                    {(() => {
                      let parsedControls: { description: string; effectiveness: string }[] = [];
                      try { parsedControls = viewingRisk.controlsData ? JSON.parse(viewingRisk.controlsData) : []; } catch { /* */ }
                      if (parsedControls.length > 0) {
                        return parsedControls.map((ctrl, i) => (
                          <div key={i} className={parsedControls.length > 1 ? "pb-4 border-b border-slate-200 last:border-0 last:pb-0" : ""}>
                            {parsedControls.length > 1 && <p className="text-xs font-semibold text-slate-500 mb-2">{t("Control")} #{i + 1}</p>}
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Control Description")}</label>
                                <p className="text-sm text-slate-700 leading-relaxed">{ctrl.description || "-"}</p>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Control Effectiveness")}</label>
                                <p className="text-sm text-slate-700">{ctrl.effectiveness ? t(ctrl.effectiveness) : "-"}</p>
                              </div>
                            </div>
                          </div>
                        ));
                      }
                      return (
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Control Description")}</label>
                            <p className="text-sm text-slate-700 leading-relaxed">{viewingRisk.controlDescription || "-"}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Control Effectiveness")}</label>
                            <p className="text-sm text-slate-700">{viewingRisk.controlEffectiveness ? t(viewingRisk.controlEffectiveness) : "-"}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </section>

                {/* Related Law / Regulation / Policy Reference */}
                {viewingRisk.relatedLawRegulation && (
                  <section>
                    <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">{t("Related Law / Regulation / Policy Reference")}</h3>
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                      <p className="text-sm text-slate-700 leading-relaxed">{viewingRisk.relatedLawRegulation}</p>
                    </div>
                  </section>
                )}

                {/* Status & Comments */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">{t("Status & Comments")}</h3>
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{t("Status")}</label>
                        {getStatusBadge(viewingRisk.status)}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Creation Date")}</label>
                        <p className="text-sm text-slate-700">{formatDate(viewingRisk.creationDate)}</p>
                      </div>
                    </div>
                    {viewingRisk.auditComment && (
                      <div className="mt-5 pt-5 border-t border-slate-200">
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Audit Comment")}</label>
                        <p className="text-sm text-slate-700 leading-relaxed">{viewingRisk.auditComment}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Metadata Footer */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                  <span>{t("Created")}: {formatDate(viewingRisk.createdAt)}</span>
                  <span>{t("Last Updated")}: {formatDate(viewingRisk.updatedAt)}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-500">
                <p>{t("Failed to load risk details.")}</p>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={closeViewRiskModal}>
              {t("Close")}
            </Button>
            {!isReadOnlyRole && viewingRisk && (
              <Button onClick={() => {
                closeViewRiskModal();
                const risk = risks.find(r => r.id === viewingRisk.id);
                if (risk) openEditRiskModal(risk);
              }}>
                <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Edit")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

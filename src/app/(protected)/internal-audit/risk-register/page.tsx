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
import { Plus, Pencil, Trash2, Search, Download, Upload, X, FileText, Sparkles, Loader2, Calendar, Target, AlertTriangle, ChevronRight, Home, Eye, ClipboardCheck, RotateCcw } from "lucide-react";
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

interface ScoringRange {
  id: string;
  label: string;
  lowValue: number;
  highValue: number | null;
  calculationType: string;
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
  auditTypeId?: string | null;
  auditType?: { id: string; name: string } | null;
  riskDrivers?: string | null;
  controlsData?: string | null;
  creationDate: string;
  inherentScore: number | null;
  residualScore: number | null;
  riskLevel: string | null;
  status: string;
  engagementId?: string | null;
  assessmentStatus: string;
  strategicImpact: number | null;
  financialImpact: number | null;
  complianceRisk: number | null;
  operationalRisk: number | null;
  itDataRisk: number | null;
  controlEffectivenessScore: number | null;
  assessmentLikelihood: number | null;
  assessmentResidualScore: number | null;
}

interface AssessmentRow {
  strategicImpact: string;
  financialImpact: string;
  complianceRisk: string;
  operationalRisk: string;
  itDataRisk: string;
  assessmentLikelihood: string;
  controlEffectivenessScore: string;
}

const CE_LABELS: Record<string, string> = {
  "1": "Very Ineffective",
  "2": "Ineffective",
  "3": "Moderately Effective",
  "4": "Effective",
  "5": "Highly Effective",
};

const BLANK_ASSESSMENT_ROW: AssessmentRow = {
  strategicImpact: "",
  financialImpact: "",
  complianceRisk: "",
  operationalRisk: "",
  itDataRisk: "",
  assessmentLikelihood: "",
  controlEffectivenessScore: "",
};

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
  assessmentResidualScore: number | null;
  riskLevel: string | null;
  assessmentStatus: string | null;
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
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  // Assessment Wizard states
  const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
  const [selectedAssessmentRisk, setSelectedAssessmentRisk] = useState<InternalAuditRisk | null>(null);
  const [assessmentStep, setAssessmentStep] = useState(1);
  const [singleAssessmentRow, setSingleAssessmentRow] = useState<AssessmentRow>(BLANK_ASSESSMENT_ROW);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [inProgressRisks, setInProgressRisks] = useState<Set<string>>(new Set());
  const [assessmentStepError, setAssessmentStepError] = useState<string>("");

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
  const [scoringRanges, setScoringRanges] = useState<ScoringRange[]>([]);

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
  const filteredRisks = statusFilter === "all"
    ? translatedRisks
    : translatedRisks.filter((r) => (r.assessmentStatus ?? "Not Assessed") === statusFilter);
  const totalItems = filteredRisks.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedRisks = filteredRisks.slice(startIndex, endIndex);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inProgress = new Set<string>();
    risks.forEach((r) => { if (localStorage.getItem(`ia-assess-${r.id}`)) inProgress.add(r.id); });
    setInProgressRisks(inProgress);
  }, [risks]);

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
      const [catRes, typeRes, probRes, impactRes, configRes, subCatRes, procRes, rangesRes] = await Promise.all([
        fetch("/api/internal-audit/categories"),
        fetch("/api/internal-audit/audit-types"),
        fetch("/api/internal-audit/probability"),
        fetch("/api/internal-audit/impact"),
        fetch("/api/internal-audit/scoring-config"),
        fetch("/api/internal-audit/sub-categories"),
        fetch("/api/internal-audit/ia-processes"),
        fetch("/api/internal-audit/scoring-ranges"),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (typeRes.ok) setAuditTypes(await typeRes.json());
      if (probRes.ok) setProbabilities(await probRes.json());
      if (impactRes.ok) setImpacts(await impactRes.json());
      if (configRes.ok) setScoringConfig(await configRes.json());
      if (subCatRes.ok) setSubCategories(await subCatRes.json());
      if (procRes.ok) setIAProcesses(await procRes.json());
      if (rangesRes.ok) setScoringRanges(await rangesRes.json());
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

  // ── Assessment Wizard helpers ────────────────────────────────────────────────
  const calcAssessmentMeanImpact = (row: AssessmentRow): number => {
    const vals = [
      parseFloat(row.strategicImpact), parseFloat(row.financialImpact),
      parseFloat(row.complianceRisk), parseFloat(row.operationalRisk), parseFloat(row.itDataRisk),
    ];
    return vals.reduce((acc, v) => acc + (isNaN(v) ? 0 : v), 0) / 5;
  };

  const calcAssessmentScore = (row: AssessmentRow): number => {
    const meanP = parseFloat(row.assessmentLikelihood) || 0;
    const meanI = calcAssessmentMeanImpact(row);
    const ce = parseFloat(row.controlEffectivenessScore) || 0;
    if (!meanP || !meanI || !ce) return 0;
    return meanP * meanI * ((6 - ce) / 5);
  };

  const calcSettingsMeanProbability = (): number => {
    if (probabilities.length === 0) return 0;
    return probabilities.reduce((acc, p) => acc + p.value, 0) / probabilities.length;
  };

  const calcSettingsMeanImpact = (): number => {
    if (impacts.length === 0) return 0;
    return impacts.reduce((acc, i) => acc + i.value, 0) / impacts.length;
  };

  const calcScoreFromSettings = (row: AssessmentRow): number => {
    const meanP = calcSettingsMeanProbability();
    const meanI = calcSettingsMeanImpact();
    const ce = parseFloat(row.controlEffectivenessScore) || 0;
    if (!meanP || !meanI || !ce) return 0;
    return meanP * meanI * ((6 - ce) / 5);
  };

  const deriveAssessmentRating = (score: number): { label: string; color: string } => {
    if (score <= 0) return { label: "-", color: "" };
    if (score >= 15) return { label: "Critical", color: "bg-risk-critical-bg text-risk-critical" };
    if (score >= 10) return { label: "High", color: "bg-risk-high-bg text-risk-high" };
    if (score >= 5) return { label: "Medium", color: "bg-risk-medium-bg text-risk-medium" };
    return { label: "Low", color: "bg-risk-low-bg text-risk-low" };
  };

  const saveAssessmentProgress = (step: number, row: AssessmentRow, riskId: string) => {
    if (typeof window !== "undefined")
      localStorage.setItem(`ia-assess-${riskId}`, JSON.stringify({ step, row }));
  };

  const updateSingleAssessmentField = (field: keyof AssessmentRow, value: string) => {
    setAssessmentStepError("");
    setSingleAssessmentRow((prev) => {
      const updated = { ...prev, [field]: value };
      if (selectedAssessmentRisk) saveAssessmentProgress(assessmentStep, updated, selectedAssessmentRisk.id);
      return updated;
    });
  };

  const getMaxControlEffectiveness = (risk: InternalAuditRisk): string => {
    try {
      const controls: { description: string; effectiveness: string }[] = risk.controlsData
        ? JSON.parse(risk.controlsData)
        : [];
      const nums = controls.map((c) => parseInt(c.effectiveness)).filter((n) => !isNaN(n) && n > 0);
      if (nums.length > 0) return Math.max(...nums).toString();
    } catch { /* */ }
    return risk.controlEffectivenessScore?.toString() ?? "";
  };

  const openAssessmentWizard = (risk: InternalAuditRisk) => {
    const autoCE = getMaxControlEffectiveness(risk);
    const isReAssess = risk.assessmentStatus === "Assessed";

    if (isReAssess) {
      // Re-assessment: always start fresh — clear any in-progress localStorage state
      if (typeof window !== "undefined") localStorage.removeItem(`ia-assess-${risk.id}`);
      setSingleAssessmentRow({ ...BLANK_ASSESSMENT_ROW, controlEffectivenessScore: autoCE });
      setAssessmentStep(1);
    } else {
      // First-time assess: resume from localStorage if an in-progress session exists
      const saved = typeof window !== "undefined" ? localStorage.getItem(`ia-assess-${risk.id}`) : null;
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSingleAssessmentRow(parsed.row ?? { ...BLANK_ASSESSMENT_ROW, controlEffectivenessScore: autoCE });
          setAssessmentStep(parsed.step ?? 1);
        } catch {
          setSingleAssessmentRow({ ...BLANK_ASSESSMENT_ROW, controlEffectivenessScore: autoCE });
          setAssessmentStep(1);
        }
      } else {
        setSingleAssessmentRow({ ...BLANK_ASSESSMENT_ROW, controlEffectivenessScore: autoCE });
        setAssessmentStep(1);
      }
    }
    setSelectedAssessmentRisk(risk);
    setAssessmentDialogOpen(true);
  };

  const handleSaveAssessment = async () => {
    if (!selectedAssessmentRisk) return;
    setSavingAssessment(true);
    const row = singleAssessmentRow;
    const preCalcScore = calcScoreFromSettings(row);
    try {
      const res = await fetch(`/api/internal-audit/risks/${selectedAssessmentRisk.id}/assess`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategicImpact: row.strategicImpact ? parseInt(row.strategicImpact) : null,
          financialImpact: row.financialImpact ? parseInt(row.financialImpact) : null,
          complianceRisk: row.complianceRisk ? parseInt(row.complianceRisk) : null,
          operationalRisk: row.operationalRisk ? parseInt(row.operationalRisk) : null,
          itDataRisk: row.itDataRisk ? parseInt(row.itDataRisk) : null,
          assessmentLikelihood: row.assessmentLikelihood ? parseInt(row.assessmentLikelihood) : null,
          controlEffectivenessScore: row.controlEffectivenessScore ? parseInt(row.controlEffectivenessScore) : null,
          assessmentResidualScore: preCalcScore > 0 ? Math.round(preCalcScore * 100) / 100 : null,
        }),
      });
      if (res.ok) {
        if (typeof window !== "undefined") localStorage.removeItem(`ia-assess-${selectedAssessmentRisk.id}`);
        toast({ title: t("Success"), description: t("Risk assessed successfully") });
        fetchRisks();
        setAssessmentDialogOpen(false);
        setSelectedAssessmentRisk(null);
        setSingleAssessmentRow(BLANK_ASSESSMENT_ROW);
      } else {
        toast({ title: t("Error"), description: t("Failed to save assessment"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to save assessment"), variant: "destructive" });
    }
    setSavingAssessment(false);
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
      // router.push("/internal-audit/audit-engagement");
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
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Status")} />
              </SelectTrigger>
              <SelectContent className="bg-white" position="popper" sideOffset={4}>
                <SelectItem value="all">{t("All Status")}</SelectItem>
                <SelectItem value="Assessed">{t("Assessed")}</SelectItem>
                <SelectItem value="Not Assessed">{t("Not Assessed")}</SelectItem>
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
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap min-w-[110px]">{t("Status")}</TableHead>
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
                  <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">
                    {risk.assessmentStatus === "Assessed" && risk.assessmentResidualScore != null
                      ? risk.assessmentResidualScore.toFixed(2)
                      : "-"}
                  </TableCell>
                  <TableCell className="py-3 whitespace-nowrap">{getRiskLevelBadge(risk.riskLevel)}</TableCell>
                  <TableCell className="py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${risk.assessmentStatus === "Assessed" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {t(risk.assessmentStatus ?? "Not Assessed")}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 ltr:pr-5 rtl:pl-5 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-primary-600"
                        onClick={() => openViewRiskModal(risk)}
                        title={t("View")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {(() => {
                        const isAssessed = risk.assessmentStatus === "Assessed";
                        const hasProgress = inProgressRisks.has(risk.id);
                        return (
                          <Button
                            size="sm"
                            variant={isAssessed ? "outline" : "default"}
                            className={`h-7 px-2.5 text-xs font-medium ${isAssessed ? "border-slate-200 text-slate-600 hover:bg-slate-50" : "bg-[#7c3f2f] hover:bg-[#6a3528] text-white"}`}
                            onClick={() => openAssessmentWizard(risk)}
                          >
                            {isAssessed ? (
                              <><RotateCcw className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{t("Re-assess")}</>
                            ) : hasProgress ? (
                              <><ClipboardCheck className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{t("Resume")}</>
                            ) : (
                              <><ClipboardCheck className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{t("Initiate Assessment")}</>
                            )}
                          </Button>
                        );
                      })()}
                      {!isReadOnlyRole && (
                        <>
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
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedRisks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-sm text-slate-500">
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
                    <Label className="text-sm font-medium text-slate-700">{t("Sub-Category")}</Label>
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
                        {[1,2,3,4,5].map(v => (
                          <SelectItem key={v} value={v.toString()}>{v}</SelectItem>
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
                        {[1,2,3,4,5].map(v => (
                          <SelectItem key={v} value={v.toString()}>{v}</SelectItem>
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
                            <SelectItem value="1">{t("1 – Very Ineffective")}</SelectItem>
                            <SelectItem value="2">{t("2 – Ineffective")}</SelectItem>
                            <SelectItem value="3">{t("3 – Moderately Effective")}</SelectItem>
                            <SelectItem value="4">{t("4 – Effective")}</SelectItem>
                            <SelectItem value="5">{t("5 – Highly Effective")}</SelectItem>
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
                        {[1,2,3,4,5].map(v => (
                          <SelectItem key={v} value={v.toString()}>{v}</SelectItem>
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
                        {[1,2,3,4,5].map(v => (
                          <SelectItem key={v} value={v.toString()}>{v}</SelectItem>
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
                      <Label className="text-sm font-medium text-slate-700">{t("Sub-Category")}</Label>
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

                {/* Inherent Risk Assessment — read-only in Edit */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Inherent Risk Assessment")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-500">{t("Likelihood")}</Label>
                      <div className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700">
                        {translatedProbabilities.find(p => p.value.toString() === formData.inherentLikelihood)
                          ? `${translatedProbabilities.find(p => p.value.toString() === formData.inherentLikelihood)!.label} (${formData.inherentLikelihood})`
                          : formData.inherentLikelihood || "–"}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-500">{t("Impact")}</Label>
                      <div className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700">
                        {translatedImpacts.find(i => i.value.toString() === formData.inherentImpact)
                          ? `${translatedImpacts.find(i => i.value.toString() === formData.inherentImpact)!.label} (${formData.inherentImpact})`
                          : formData.inherentImpact || "–"}
                      </div>
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

                {/* Control Information — editable in Edit */}
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
                              <SelectItem value="1">{t("1 – Very Ineffective")}</SelectItem>
                              <SelectItem value="2">{t("2 – Ineffective")}</SelectItem>
                              <SelectItem value="3">{t("3 – Moderately Effective")}</SelectItem>
                              <SelectItem value="4">{t("4 – Effective")}</SelectItem>
                              <SelectItem value="5">{t("5 – Highly Effective")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Residual Risk Assessment — read-only in Edit */}
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">{t("Residual Risk Assessment")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-500">{t("Likelihood")}</Label>
                      <div className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700">
                        {translatedProbabilities.find(p => p.value.toString() === formData.residualLikelihood)
                          ? `${translatedProbabilities.find(p => p.value.toString() === formData.residualLikelihood)!.label} (${formData.residualLikelihood})`
                          : formData.residualLikelihood || "–"}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-500">{t("Impact")}</Label>
                      <div className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700">
                        {translatedImpacts.find(i => i.value.toString() === formData.residualImpact)
                          ? `${translatedImpacts.find(i => i.value.toString() === formData.residualImpact)!.label} (${formData.residualImpact})`
                          : formData.residualImpact || "–"}
                      </div>
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
                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">{t("Sub-Category")}</label>
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

                  {/* Heat Map — only shown once the risk assessment is completed */}
                  {(() => {
                    if (viewingRisk.assessmentStatus !== "Assessed") {
                      return (
                        <div className="mt-5 bg-slate-50 rounded-xl p-6 border border-dashed border-slate-200 text-center">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("Risk Heat Map")}</h4>
                          <p className="text-sm text-slate-400">{t("Complete the risk assessment to view the heat map.")}</p>
                        </div>
                      );
                    }

                    const probValues = probabilities.length > 0
                      ? [...probabilities].sort((a, b) => a.value - b.value)
                      : [1,2,3,4,5].map(v => ({ id: String(v), label: String(v), value: v }));
                    const impactValues = impacts.length > 0
                      ? [...impacts].sort((a, b) => a.value - b.value)
                      : [1,2,3,4,5].map(v => ({ id: String(v), label: String(v), value: v }));
                    const impactRows = [...impactValues].reverse();

                    const getCellColor = (pVal: number, iVal: number) => {
                      const score = applyCalcMethod(pVal, iVal, scoringConfig?.probabilityImpactCalcType || "Product of all");
                      if (scoringRanges.length > 0) {
                        const sorted = [...scoringRanges].sort((a, b) => b.lowValue - a.lowValue);
                        const match = sorted.find(r => score >= r.lowValue && (r.highValue === null || score <= r.highValue));
                        if (match) {
                          const lbl = match.label.toLowerCase();
                          if (lbl === "extreme") return "bg-red-800";
                          if (lbl === "high") return "bg-red-500";
                          if (lbl === "medium") return "bg-orange-400";
                          return "bg-green-500";
                        }
                      }
                      if (score >= 15) return "bg-red-800";
                      if (score >= 8) return "bg-red-500";
                      return "bg-green-500";
                    };

                    const uniqueLabels = Array.from(
                      new Map(
                        [...scoringRanges]
                          .sort((a, b) => b.lowValue - a.lowValue)
                          .map(r => [r.label.toLowerCase(), r.label])
                      ).values()
                    );

                    const calcScore = (p: number, i: number) =>
                      applyCalcMethod(p, i, scoringConfig?.probabilityImpactCalcType || "Product of all");

                    const rL = viewingRisk.residualLikelihood;
                    const rI = viewingRisk.residualImpact;

                    return (
                      <div className="mt-5 bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">{t("Risk Heat Map")}</h4>
                        <div className="flex gap-6 items-start">
                          <div className="flex gap-2 items-center">
                            <span className="text-xs text-slate-400 [writing-mode:vertical-rl] rotate-180 tracking-wider">{t("Impact")}</span>
                            <div>
                              {impactRows.map((imp) => (
                                <div key={imp.id} className="flex items-center gap-1 mb-1">
                                  <span className="w-5 text-right text-xs text-slate-400">{imp.value}</span>
                                  {probValues.map((prob) => {
                                    const isInherent = viewingRisk.inherentLikelihood === prob.value && viewingRisk.inherentImpact === imp.value;
                                    const isResidual = rL != null && rI != null && rL === prob.value && rI === imp.value;
                                    const hasBoth = isInherent && isResidual;
                                    return (
                                      <div
                                        key={prob.id}
                                        className={`w-9 h-9 rounded flex flex-col items-center justify-center gap-0 ${getCellColor(prob.value, imp.value)}`}
                                        title={`P:${prob.value} I:${imp.value}`}
                                      >
                                        {hasBoth ? (
                                          // Both markers on same cell — stack them small
                                          <>
                                            <div className="flex items-center gap-0.5">
                                              <div className="w-1.5 h-1.5 rounded-full bg-slate-900 ring-1 ring-white" />
                                              <div className="w-1.5 h-1.5 rounded-full bg-white ring-1 ring-slate-900" />
                                            </div>
                                            <span className="text-[9px] font-bold text-white leading-none mt-0.5 drop-shadow">
                                              {calcScore(prob.value, imp.value)}
                                            </span>
                                          </>
                                        ) : isInherent ? (
                                          <>
                                            <div className="w-2 h-2 rounded-full bg-slate-900 ring-1 ring-white mb-0.5" />
                                            <span className="text-[10px] font-bold text-slate-900 leading-none">
                                              {calcScore(prob.value, imp.value)}
                                            </span>
                                          </>
                                        ) : isResidual ? (
                                          <>
                                            <div className="w-2 h-2 rounded-full bg-white ring-1 ring-slate-900 mb-0.5" />
                                            <span className="text-[10px] font-bold text-white leading-none drop-shadow-sm">
                                              {viewingRisk.assessmentResidualScore ?? viewingRisk.residualScore ?? calcScore(prob.value, imp.value)}
                                            </span>
                                          </>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                              <div className="flex items-center gap-1 mt-1">
                                <span className="w-5" />
                                {probValues.map((prob) => (
                                  <span key={prob.id} className="w-9 text-center text-xs text-slate-400">{prob.value}</span>
                                ))}
                              </div>
                              <div className="text-center text-xs text-slate-400 mt-1 tracking-wider">{t("Probability")}</div>
                            </div>
                          </div>
                          {/* Legend */}
                          <div className="flex flex-col gap-2 text-xs text-slate-600 min-w-[90px]">
                            <p className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] mb-1">{t("Zone")}</p>
                            {uniqueLabels.length > 0 ? uniqueLabels.map((lbl) => {
                              const l = lbl.toLowerCase();
                              const color = l === "extreme" ? "bg-red-800" : l === "high" ? "bg-red-500" : l === "medium" ? "bg-orange-400" : "bg-green-500";
                              return <div key={lbl} className="flex items-center gap-2"><div className={`w-3 h-3 rounded flex-shrink-0 ${color}`} />{lbl}</div>;
                            }) : (
                              <>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500 flex-shrink-0" />{t("High")}</div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-orange-400 flex-shrink-0" />{t("Medium")}</div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-500 flex-shrink-0" />{t("Low")}</div>
                              </>
                            )}
                            <div className="mt-3 flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-slate-900 ring-2 ring-white flex-shrink-0" />
                              {t("Inherent")}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-white ring-2 ring-slate-900 flex-shrink-0" />
                              {t("Residual")}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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

      {/* ── Assessment Wizard Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={assessmentDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAssessmentDialogOpen(false);
            setSelectedAssessmentRisk(null);
            setSingleAssessmentRow(BLANK_ASSESSMENT_ROW);
            setAssessmentStep(1);
            setAssessmentStepError("");
          }
        }}
      >
        <DialogContent
          className="max-w-[780px] w-full p-0 gap-0 overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {selectedAssessmentRisk && (() => {
            const row = singleAssessmentRow;
            const meanImpact = calcAssessmentMeanImpact(row);
            const score = calcAssessmentScore(row);
            const rating = deriveAssessmentRating(score);
            const settingsMeanProbability = calcSettingsMeanProbability();
            const settingsMeanImpact = calcSettingsMeanImpact();
            const settingsScore = calcScoreFromSettings(row);
            const settingsRating = deriveAssessmentRating(settingsScore);
            const TOTAL_STEPS = 5;
            const STEPS = [t("Risk Context"), t("Likelihood"), t("Impact"), t("Risk Rating"), t("Summary")];
            const impactFields: { field: keyof AssessmentRow; label: string }[] = [
              { field: "strategicImpact", label: t("Strategic Impact") },
              { field: "financialImpact", label: t("Financial Impact") },
              { field: "complianceRisk", label: t("Compliance Risk") },
              { field: "operationalRisk", label: t("Operational Risk") },
              { field: "itDataRisk", label: t("IT / Data Risk") },
            ];
            return (
              <div className="flex flex-col" style={{ maxHeight: "90vh" }}>
                {/* Header */}
                <div className="px-8 pt-7 pb-5 flex-shrink-0">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-slate-800">{t("Risk Assessment")}</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedAssessmentRisk.riskId} – {selectedAssessmentRisk.riskName}
                  </p>
                  {/* Step Progress */}
                  <div className="flex items-start justify-between mt-6 mb-1">
                    {STEPS.map((label, idx) => {
                      const step = idx + 1;
                      const isActive = step === assessmentStep;
                      const isDone = step < assessmentStep;
                      return (
                        <div key={step} className="flex items-center flex-1">
                          <div className="flex flex-col items-center gap-1 flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${isActive ? "bg-[#7c3f2f] border-[#7c3f2f] text-white shadow-md" : isDone ? "bg-[#ead5c8] border-[#c4896e] text-[#7c3f2f]" : "bg-white border-[#e8d5cc] text-[#c4896e]"}`}>
                              {step}
                            </div>
                            <span className={`text-[10px] font-medium text-center leading-tight whitespace-nowrap ${isActive ? "text-[#7c3f2f] font-semibold" : "text-slate-400"}`}>
                              {label}
                            </span>
                          </div>
                          {idx < STEPS.length - 1 && (
                            <div className={`flex-1 h-px mx-2 mb-5 ${isDone ? "bg-[#c4896e]" : "bg-[#e8d5cc]"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-100 flex-shrink-0" />

                {/* Step Content */}
                <div className="flex-1 overflow-y-auto px-8 py-6 min-h-[320px]">
                  {/* Step 1: Risk Context */}
                  {assessmentStep === 1 && (
                    <div>
                      <div className="flex items-baseline gap-3 mb-5 pb-4 border-b border-slate-100">
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 text-xs font-mono font-semibold text-slate-600">{selectedAssessmentRisk.riskId}</span>
                        <span className="text-xl font-bold text-slate-800">{selectedAssessmentRisk.riskName}</span>
                      </div>
                      <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-3">{t("RISK CONTEXT")}</p>
                      <div className="divide-y divide-slate-100">
                        <div className="flex items-center py-3 gap-4">
                          <span className="w-28 text-sm text-slate-400 flex-shrink-0">{t("Category")}</span>
                          <span className="flex-1 text-sm font-bold text-slate-800">{tCat(selectedAssessmentRisk.categoryId) || selectedAssessmentRisk.category?.name || "–"}</span>
                          <span className="w-16 text-sm text-[#c4896e] flex-shrink-0 text-right">{t("Type")}</span>
                          <span className="w-28 text-sm font-bold text-slate-800 text-right">{selectedAssessmentRisk.auditType?.name || "–"}</span>
                        </div>
                        <div className="flex items-center py-3 gap-4">
                          <span className="w-28 text-sm text-slate-400 flex-shrink-0">{t("Owner")}</span>
                          <span className="flex-1 text-sm font-bold text-slate-800">–</span>
                          <span className="w-24 text-sm text-[#c4896e] flex-shrink-0 text-right">{t("Department")}</span>
                          <span className="w-28 text-sm font-bold text-slate-800 text-right">{tDept(selectedAssessmentRisk.departmentId) || selectedAssessmentRisk.department?.name || "–"}</span>
                        </div>
                        <div className="flex items-center py-3 gap-4">
                          <span className="w-28 text-sm text-slate-400 flex-shrink-0">{t("Risk Sources")}</span>
                          <span className="flex-1 text-sm font-bold text-slate-800 text-right">{selectedAssessmentRisk.riskDrivers || selectedAssessmentRisk.riskDescription || "–"}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Likelihood */}
                  {assessmentStep === 2 && (
                    <div>
                      <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-3">{t("LIKELIHOOD")}</p>
                      <p className="text-sm text-slate-500 mb-5">{t("Select the probability that this risk will occur based on historical data and current controls.")}</p>
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((v) => {
                          const selected = row.assessmentLikelihood === v.toString();
                          return (
                            <label key={v} className={`flex items-center gap-4 px-5 py-4 rounded-xl border-2 cursor-pointer transition-all ${selected ? "border-[#c4896e] bg-[#fdf6f2]" : "border-slate-200 bg-white hover:border-[#e8d5cc]"}`}>
                              <input type="radio" name="ia-rr-likelihood" value={v.toString()} checked={selected} onChange={(e) => updateSingleAssessmentField("assessmentLikelihood", e.target.value)} className="accent-[#7c3f2f] w-4 h-4" />
                              <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${selected ? "bg-[#7c3f2f] text-white" : "bg-slate-100 text-slate-600"}`}>{v}</span>
                              <span className={`text-sm font-semibold ${selected ? "text-[#7c3f2f]" : "text-slate-700"}`}>{v}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Step 3: Impact */}
                  {assessmentStep === 3 && (
                    <div>
                      <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-3">{t("IMPACT")}</p>
                      <p className="text-sm text-slate-500 mb-5">{t("Rate the impact across each dimension if this risk were to materialise.")}</p>
                      <div className="space-y-5">
                        {impactFields.map(({ field, label }) => (
                          <div key={field}>
                            <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
                            <div className="flex gap-2 flex-wrap">
                              {[1, 2, 3, 4, 5].map((v) => (
                                <button key={v} type="button" onClick={() => updateSingleAssessmentField(field, v.toString())}
                                  className={`px-5 py-2.5 rounded-full text-sm font-semibold border-2 transition-all ${row[field] === v.toString() ? "bg-[#7c3f2f] border-[#7c3f2f] text-white shadow-sm" : "bg-white border-slate-200 text-slate-700 hover:border-[#c4896e]"}`}>
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Step 4: Risk Rating */}
                  {assessmentStep === 4 && (
                    <div>
                      <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-4">{t("RISK RATING")}</p>
                      <div className="mb-6">
                        <label className="text-sm font-semibold text-slate-700 block mb-1">{t("Control Effectiveness")}</label>
                        <p className="text-xs text-slate-400 mb-3">1 = {t("Very Ineffective")} · 2 = {t("Ineffective")} · 3 = {t("Moderately Effective")} · 4 = {t("Effective")} · 5 = {t("Highly Effective")}</p>
                        {row.controlEffectivenessScore ? (
                          <div className="flex items-center gap-3 px-5 py-4 rounded-xl border-2 border-[#c4896e] bg-[#fdf6f2]">
                            <span className="w-10 h-10 rounded-full bg-[#7c3f2f] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {row.controlEffectivenessScore}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-[#7c3f2f]">{t(CE_LABELS[row.controlEffectivenessScore] ?? "")}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{t("Auto-populated from risk controls (highest value)")}</p>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-amber-600 mb-2">{t("No control effectiveness set on this risk. Please select manually.")}</p>
                            <div className="flex gap-2">
                              {["1", "2", "3", "4", "5"].map((v) => (
                                <button key={v} type="button" onClick={() => updateSingleAssessmentField("controlEffectivenessScore", v)}
                                  className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${row.controlEffectivenessScore === v ? "bg-[#7c3f2f] border-[#7c3f2f] text-white" : "border-slate-200 text-slate-600 hover:border-[#c4896e] hover:bg-[#fdf6f2]"}`}>
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                        <div className="flex justify-between text-sm"><span className="text-slate-500">{t("Mean Probability")}</span><span className="font-semibold text-slate-800">{settingsMeanProbability > 0 ? settingsMeanProbability.toFixed(2) : "–"}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500">{t("Mean Impact")}</span><span className="font-semibold text-slate-800">{settingsMeanImpact > 0 ? settingsMeanImpact.toFixed(2) : "–"}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500">{t("Control Effectiveness")}</span><span className="font-semibold text-slate-800">{row.controlEffectivenessScore ? `${row.controlEffectivenessScore} – ${t(CE_LABELS[row.controlEffectivenessScore] ?? "")}` : "–"}</span></div>
                        <div className="border-t border-slate-200 pt-3 flex justify-between"><span className="text-sm font-semibold text-slate-700">{t("Calculated Risk Score")}</span><span className="text-lg font-bold text-slate-900">{settingsScore > 0 ? settingsScore.toFixed(2) : "–"}</span></div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-slate-700">{t("Risk Rating")}</span>
                          {settingsRating.label !== "-" ? <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${settingsRating.color}`}>{t(settingsRating.label)}</span> : <span className="text-slate-400 text-sm">–</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Summary */}
                  {assessmentStep === 5 && (
                    <div>
                      <p className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase mb-4">{t("SUMMARY")}</p>
                      <div className="bg-slate-50 rounded-2xl p-5 space-y-3 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">{t("Likelihood")}</span><span className="font-semibold text-slate-800">{row.assessmentLikelihood || "–"}</span></div>
                        {impactFields.map(({ field, label }) => (
                          <div key={field} className="flex justify-between"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-800">{row[field] || "–"}</span></div>
                        ))}
                        <div className="flex justify-between"><span className="text-slate-500">{t("Mean Impact")}</span><span className="font-semibold text-slate-800">{meanImpact > 0 ? meanImpact.toFixed(2) : "–"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">{t("Control Effectiveness")}</span><span className="font-semibold text-slate-800">{row.controlEffectivenessScore ? `${row.controlEffectivenessScore} – ${t(CE_LABELS[row.controlEffectivenessScore] ?? "")}` : "–"}</span></div>
                        <div className="border-t border-slate-200 pt-3 flex justify-between"><span className="font-semibold text-slate-700">{t("Risk Score")}</span><span className="text-lg font-bold text-slate-900">{score > 0 ? score.toFixed(2) : "–"}</span></div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-slate-700">{t("Risk Rating")}</span>
                          {rating.label !== "-" ? <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${rating.color}`}>{t(rating.label)}</span> : <span className="text-slate-400">–</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 bg-[#faf8f6] px-8 py-5 flex-shrink-0">
                  {assessmentStepError && (
                    <p className="text-xs text-red-600 mb-3 font-medium">{assessmentStepError}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#c4896e] font-semibold">{t("Step")} {assessmentStep} {t("of")} {TOTAL_STEPS}</span>
                    <div className="flex gap-3">
                      <Button variant="outline" className="border-slate-200 text-slate-600 px-6"
                        onClick={() => {
                          setAssessmentStepError("");
                          if (assessmentStep > 1) {
                            const prevStep = assessmentStep - 1;
                            setAssessmentStep(prevStep);
                            saveAssessmentProgress(prevStep, singleAssessmentRow, selectedAssessmentRisk.id);
                          } else {
                            setAssessmentDialogOpen(false);
                          }
                        }}>
                        {assessmentStep > 1 ? t("Back") : t("Cancel")}
                      </Button>
                      {assessmentStep < TOTAL_STEPS ? (
                        <Button className="bg-[#7c3f2f] hover:bg-[#6a3528] text-white px-6"
                          onClick={() => {
                            // Per-step validation
                            if (assessmentStep === 2 && !row.assessmentLikelihood) {
                              setAssessmentStepError(t("Please select a likelihood value before proceeding."));
                              return;
                            }
                            if (assessmentStep === 3) {
                              const missing = impactFields.filter(({ field }) => !row[field]);
                              if (missing.length > 0) {
                                setAssessmentStepError(t("Please rate all impact dimensions before proceeding."));
                                return;
                              }
                            }
                            if (assessmentStep === 4 && !row.controlEffectivenessScore) {
                              setAssessmentStepError(t("Please select a control effectiveness score before proceeding."));
                              return;
                            }
                            setAssessmentStepError("");
                            const nextStep = assessmentStep + 1;
                            setAssessmentStep(nextStep);
                            saveAssessmentProgress(nextStep, singleAssessmentRow, selectedAssessmentRisk.id);
                          }}>
                          {t("Next")} <ChevronRight className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button className="bg-[#7c3f2f] hover:bg-[#6a3528] text-white px-6" onClick={handleSaveAssessment} disabled={savingAssessment}>
                          {savingAssessment ? <><Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />{t("Saving...")}</> : t("Save Assessment")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

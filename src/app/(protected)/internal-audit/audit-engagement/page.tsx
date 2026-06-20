"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { formatLocalDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Home,
  ChevronRight,
  X,
  Upload,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { isValidName } from "@/lib/validations";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
import { MultiSelect } from "@/components/ui/multi-select";
import { Building2 } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

interface Risk {
  id: string;
  riskId: string;
  riskName: string;
  riskLevel: string | null;
}

interface User {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AuditType {
  id: string;
  name: string;
}

interface AuditCategory {
  id: string;
  name: string;
}

interface ScoringRange {
  id: string;
  label: string;
}

// A planned audit from an operational plan that is not yet linked to an engagement.
interface PlannedAudit {
  id: string;
  title: string;
  auditType: string | null;
  plannedQuarter: string | null;
  riskLevel: string | null;
  departmentId: string | null;
  departmentName: string | null;
  planCode: string | null;
  year: number | null;
}

interface Engagement {
  id: string;
  auditId: string;
  engagementTitle: string;
  department: Department | null;
  auditType: string | null;
  auditTypeId: string | null;
  assignedAuditorId: string | null;
  assignedAuditor: { id: string; fullName: string; firstName: string; lastName: string } | null;
  auditeeId: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  assignedAuditors: string[];
}

interface AuditTask {
  id: string;
  task: string;
  done: boolean;
  plannedHours: string;
  actualHours: string;
  auditorId: string;
  comments: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

interface Process {
  id: string;
  name: string;
}

interface EngagementFormData {
  engagementTitle: string;
  engagementObjective: string;
  engagementScope: string;
  auditRating: string;
  auditType: string;
  auditCategoryId: string;
  processId: string;
  startDate: string;
  targetDate: string;
  initialObservation: string;
  relatedPolicies: string;
}

// Per-department configuration for multi-department mode
interface DeptConfig {
  auditorIds: string[];
  auditeeIds: string[];
  linkedRiskIds: string[];
}

// Per-department fetched data
interface DeptData {
  auditors: User[];
  auditees: User[];
  risks: Risk[];
  loading: boolean;
}

const defaultTasks: AuditTask[] = [
  { id: "1", task: "Audit Preparation & Update", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
  { id: "2", task: "Documentation Review", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
  { id: "3", task: "Sample Selection", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
  { id: "4", task: "Result of Previous Audit", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
  { id: "5", task: "Related Policies", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
  { id: "6", task: "Related Procedures", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
];

const emptyFormData: EngagementFormData = {
  engagementTitle: "",
  engagementObjective: "",
  engagementScope: "",
  auditRating: "",
  auditType: "",
  auditCategoryId: "",
  processId: "",
  startDate: "",
  targetDate: "",
  initialObservation: "",
  relatedPolicies: "",
};

export default function AuditPlanningPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [plannedAudits, setPlannedAudits] = useState<PlannedAudit[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchFilter, setSearchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Engagement | null>(null);

  // Report generation dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportFilterType, setReportFilterType] = useState("");
  const [reportYear, setReportYear] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");

  // Report preview modal
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportStats, setReportStats] = useState({ riskCount: 0, findingCount: 0, auditHeadName: '' });
  const [loadingStats, setLoadingStats] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Add/Edit Engagement dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEngagementId, setEditingEngagementId] = useState<string | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [historicalRisks, setHistoricalRisks] = useState<Risk[]>([]);
  const [auditors, setAuditors] = useState<User[]>([]);
  const [auditees, setAuditees] = useState<User[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
  const [auditCategories, setAuditCategories] = useState<AuditCategory[]>([]);
  const [auditRatings, setAuditRatings] = useState<ScoringRange[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [saving, setSaving] = useState(false);
  const [engagementForm, setEngagementForm] = useState<EngagementFormData>(emptyFormData);
  const [tasks, setTasks] = useState<AuditTask[]>([...defaultTasks]);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // Multi-department state for add/edit dialog
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [deptConfigs, setDeptConfigs] = useState<Record<string, DeptConfig>>({});
  const [deptData, setDeptData] = useState<Record<string, DeptData>>({});
  // Track original department during edit so we know which are newly added
  const [originalDeptId, setOriginalDeptId] = useState<string | null>(null);
  const [editingAuditId, setEditingAuditId] = useState<string>("");

  // Task dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<Omit<AuditTask, "id">>({
    task: "", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "",
  });

  // File uploads
  const attachFileRef = useRef<HTMLInputElement>(null);
  const workpaperRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [workpaperFiles, setWorkpaperFiles] = useState<UploadedFile[]>([]);
  const [isDragOverAttach, setIsDragOverAttach] = useState(false);
  const [isDragOverWorkpaper, setIsDragOverWorkpaper] = useState(false);

  const isAuditHead = session?.user?.roles?.includes("AuditHead");

  // Dynamic translation for engagements list
  const { data: translatedEngagements } = useTranslatedData(engagements, { modelName: 'AuditEngagement' });

  // Translated reference data for dropdowns
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedAuditTypes } = useTranslatedData(auditTypes, { modelName: 'AuditType' });
  const { data: translatedAuditCategories } = useTranslatedData(auditCategories, { modelName: 'AuditCategory' });
  const { data: translatedProcesses } = useTranslatedData(processes, { modelName: 'Process' });
  const { data: translatedAuditRatings } = useTranslatedData(auditRatings, { modelName: 'AuditScoringRange' });
  const { data: translatedRisks } = useTranslatedData(risks, { modelName: 'InternalAuditRisk' });
  const { data: translatedHistoricalRisks } = useTranslatedData(historicalRisks, { modelName: 'InternalAuditRisk' });
  const { data: translatedAuditors } = useTranslatedData(auditors, { modelName: 'User' });
  const { data: translatedAuditees } = useTranslatedData(auditees, { modelName: 'User' });

  // Planned audits (operational-plan items without an engagement), filtered to
  // match the active filters. Planned items are implicitly status "Planned".
  const filteredPlannedAudits = plannedAudits.filter((p) => {
    if (yearFilter !== "all" && String(p.year ?? "") !== yearFilter) return false;
    if (departmentFilter !== "all" && p.departmentId !== departmentFilter) return false;
    if (statusFilter !== "all" && statusFilter !== "Pending Approval") return false;
    if (searchFilter && !(p.title || "").toLowerCase().includes(searchFilter.toLowerCase()))
      return false;
    return true;
  });

  useEffect(() => {
    fetchDepartments();
    fetchEngagements();
    fetchPlannedAudits();
    fetchAvailableYears();
    fetchAuditorsAndAuditees();
  }, []);

  useEffect(() => {
    fetchEngagements();
    fetchPlannedAudits();
  }, [departmentFilter, statusFilter, yearFilter, searchFilter]);

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

  const fetchAvailableYears = async () => {
    try {
      const response = await fetch("/api/internal-audit/engagements/years");
      if (response.ok) {
        const data = await response.json();
        setAvailableYears(data);
      }
    } catch (error) {
      console.error("Failed to fetch available years:", error);
    }
  };

  const fetchEngagements = async () => {
    try {
      const params = new URLSearchParams();
      if (departmentFilter && departmentFilter !== "all") params.append("departmentId", departmentFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (yearFilter && yearFilter !== "all") params.append("year", yearFilter);
      if (searchFilter) params.append("search", searchFilter);

      const response = await fetch(`/api/internal-audit/engagements?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEngagements(data);
      }
    } catch (error) {
      console.error("Failed to fetch engagements:", error);
    } finally {
      setLoading(false);
    }
  };

  // All operational-plan audits not yet converted to engagements (any year/quarter).
  const fetchPlannedAudits = async () => {
    try {
      const response = await fetch(`/api/internal-audit/audit-planning/planned-audits`);
      if (response.ok) {
        const data = await response.json();
        setPlannedAudits(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch planned audits:", error);
    }
  };

  const fetchRisksForDepartment = async (departmentId: string) => {
    try {
      const response = await fetch(`/api/internal-audit/risks?departmentId=${departmentId}&status=Open`);
      if (response.ok) {
        const data = await response.json();
        setRisks(data);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    }
  };

  const fetchHistoricalRisks = async (departmentId: string) => {
    try {
      const lastYear = new Date().getFullYear() - 1;
      const response = await fetch(`/api/internal-audit/risks?departmentId=${departmentId}&year=${lastYear}`);
      if (response.ok) {
        const data = await response.json();
        setHistoricalRisks(data);
      }
    } catch (error) {
      console.error("Failed to fetch historical risks:", error);
    }
  };

  const fetchAuditorsAndAuditees = async () => {
    try {
      const [auditeesRes, auditorsRes, auditTypesRes, scoringRangesRes, processesRes, categoriesRes] = await Promise.all([
        fetch("/api/internal-audit/users?role=Auditee"),
        fetch("/api/internal-audit/users?role=auditors"),
        fetch("/api/internal-audit/audit-types"),
        fetch("/api/internal-audit/scoring-ranges"),
        fetch("/api/processes"),
        fetch("/api/internal-audit/categories"),
      ]);

      if (auditeesRes.ok) {
        const auditeesData = await auditeesRes.json();
        setAuditees(auditeesData.users || auditeesData || []);
      }
      if (auditorsRes.ok) {
        const auditorsData = await auditorsRes.json();
        setAuditors(auditorsData.users || auditorsData || []);
      }
      if (auditTypesRes.ok) {
        const auditTypesData = await auditTypesRes.json();
        setAuditTypes(auditTypesData || []);
      }
      if (scoringRangesRes.ok) {
        const scoringRangesData = await scoringRangesRes.json();
        // Deduplicate by label but keep real IDs for translation lookup
        const uniqueMap = new Map<string, ScoringRange>();
        for (const r of scoringRangesData) {
          if (!uniqueMap.has(r.label)) uniqueMap.set(r.label, r);
        }
        setAuditRatings(Array.from(uniqueMap.values()));
      }
      if (processesRes.ok) {
        const processesData = await processesRes.json();
        setProcesses(processesData || []);
      }
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setAuditCategories(categoriesData || []);
      }
    } catch (error) {
      console.error("Failed to fetch auditors/auditees:", error);
    }
  };

  const resetFormState = () => {
    setEngagementForm(emptyFormData);
    setTasks([...defaultTasks]);
    setRisks([]);
    setHistoricalRisks([]);
    setAttachedFiles([]);
    setWorkpaperFiles([]);
    setValidationErrors({});
    setSelectedDeptIds([]);
    setDeptConfigs({});
    setDeptData({});
    setOriginalDeptId(null);
    setEditingAuditId("");
  };

  // Multi-department handlers
  const fetchDeptUsers = async (deptId: string) => {
    setDeptData(prev => ({
      ...prev,
      [deptId]: { auditors: [], auditees: [], risks: [], loading: true }
    }));
    try {
      const [auditorsRes, auditeesRes, risksRes] = await Promise.all([
        fetch(`/api/internal-audit/users?role=auditors&departmentId=${deptId}`),
        fetch(`/api/internal-audit/users?role=Auditee&departmentId=${deptId}`),
        fetch(`/api/internal-audit/risks?departmentId=${deptId}&status=Open`),
      ]);
      const auditors = auditorsRes.ok ? await auditorsRes.json() : [];
      const auditees = auditeesRes.ok ? await auditeesRes.json() : [];
      const risks = risksRes.ok ? await risksRes.json() : [];
      setDeptData(prev => ({
        ...prev,
        [deptId]: {
          auditors: Array.isArray(auditors) ? auditors : (auditors.users || []),
          auditees: Array.isArray(auditees) ? auditees : (auditees.users || []),
          risks: Array.isArray(risks) ? risks : [],
          loading: false,
        }
      }));
    } catch {
      setDeptData(prev => ({
        ...prev,
        [deptId]: { auditors: [], auditees: [], risks: [], loading: false }
      }));
    }
  };

  const handleDeptSelectionChange = (newIds: string[]) => {
    setSelectedDeptIds(newIds);
    setDeptConfigs(prev => {
      const updated = { ...prev };
      for (const id of newIds) {
        if (!updated[id]) updated[id] = { auditorIds: [], auditeeIds: [], linkedRiskIds: [] };
      }
      return updated;
    });
    for (const id of newIds) {
      if (!deptData[id]) fetchDeptUsers(id);
    }
  };

  const removeDept = (deptId: string) => {
    setSelectedDeptIds(prev => prev.filter(id => id !== deptId));
    setDeptConfigs(prev => { const u = { ...prev }; delete u[deptId]; return u; });
  };

  const updateDeptConfig = (deptId: string, field: keyof DeptConfig, value: string[]) => {
    setDeptConfigs(prev => ({ ...prev, [deptId]: { ...prev[deptId], [field]: value } }));
  };

  const getDeptName = (deptId: string) => {
    return translatedDepartments.find(d => d.id === deptId)?.name || departments.find(d => d.id === deptId)?.name || deptId;
  };

  const openAddDialog = async () => {
    resetFormState();
    setAddDialogOpen(true);
    setDialogLoading(true);
    await fetchAuditorsAndAuditees();
    setDialogLoading(false);
  };

  const openEditDialog = async (engagement: Engagement) => {
    resetFormState();
    setEditingEngagementId(engagement.id);
    setEditDialogOpen(true);
    setDialogLoading(true);

    try {
      await fetchAuditorsAndAuditees();

      const response = await fetch(`/api/internal-audit/engagements/${engagement.id}`);
      if (response.ok) {
        const data = await response.json();
        const te = engagement as unknown as Record<string, unknown>;
        setEngagementForm({
          engagementTitle: (te.engagementTitle as string) || data.engagementTitle || "",
          engagementObjective: (te.engagementObjective as string) || data.engagementObjective || "",
          engagementScope: (te.engagementScope as string) || data.engagementScope || "",
          auditRating: data.auditRating || "",
          auditType: data.auditType || "",
          auditCategoryId: data.auditCategoryId || "",
          processId: data.processId || "",
          startDate: (data.plannedStartDate || data.startDate) ? (data.plannedStartDate || data.startDate).split("T")[0] : "",
          targetDate: (data.plannedEndDate || data.endDate) ? (data.plannedEndDate || data.endDate).split("T")[0] : "",
          initialObservation: (te.initialObservation as string) || data.initialObservation || "",
          relatedPolicies: (te.relatedPolicies as string) || data.relatedPolicies || "",
        });

        // Set department for edit mode and track original
        setOriginalDeptId(data.departmentId || null);
        setEditingAuditId(data.auditId || "");
        if (data.departmentId) {
          setSelectedDeptIds([data.departmentId]);
          setDeptConfigs({
            [data.departmentId]: {
              auditorIds: data.assignedAuditorId ? [data.assignedAuditorId] : [],
              auditeeIds: data.auditeeId ? [data.auditeeId] : [],
              linkedRiskIds: data.linkedRiskIds || [],
            }
          });
          await fetchDeptUsers(data.departmentId);
          await fetchHistoricalRisks(data.departmentId);
        }
      } else {
        toast.error(t("Failed to load engagement"));
        setEditDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to fetch engagement:", error);
      toast.error(t("Failed to load engagement"));
      setEditDialogOpen(false);
    } finally {
      setDialogLoading(false);
    }
  };

  // Legacy handler kept for reference - now handled by handleDeptSelectionChange
  const handleEngagementDepartmentChange = async (departmentId: string) => {
    handleDeptSelectionChange(departmentId ? [departmentId] : []);
  };

  // File upload handlers
  const handleFileDrop = async (e: React.DragEvent, type: "attach" | "workpaper") => {
    e.preventDefault();
    if (type === "attach") setIsDragOverAttach(false);
    else setIsDragOverWorkpaper(false);

    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files, type);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "attach" | "workpaper") => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    await uploadFiles(files, type);
    e.target.value = "";
  };

  const uploadFiles = async (files: File[], type: "attach" | "workpaper") => {
    for (const file of files) {
      const newFile: UploadedFile = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
      };

      if (type === "attach") {
        setAttachedFiles((prev) => [...prev, newFile]);
      } else {
        setWorkpaperFiles((prev) => [...prev, newFile]);
      }
    }
  };

  const removeFile = (fileId: string, type: "attach" | "workpaper") => {
    if (type === "attach") {
      setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
    } else {
      setWorkpaperFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Task handlers
  const openAddTaskDialog = () => {
    setEditingTaskId(null);
    setTaskForm({ task: "", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" });
    setTaskDialogOpen(true);
  };

  const openEditTaskDialog = (task: AuditTask) => {
    setEditingTaskId(task.id);
    setTaskForm({ task: task.task, done: task.done, plannedHours: task.plannedHours, actualHours: task.actualHours, auditorId: task.auditorId, comments: task.comments });
    setTaskDialogOpen(true);
  };

  const handleSaveTask = () => {
    if (!taskForm.task.trim()) return;
    if (editingTaskId) {
      setTasks(tasks.map((t) => (t.id === editingTaskId ? { ...t, ...taskForm } : t)));
    } else {
      const newTask: AuditTask = { id: Date.now().toString(), ...taskForm };
      setTasks([...tasks, newTask]);
    }
    setTaskDialogOpen(false);
    setEditingTaskId(null);
  };

  const updateTask = (id: string, field: keyof AuditTask, value: string | boolean) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const calculateTotalHours = (field: "plannedHours" | "actualHours") => {
    return tasks.reduce((sum, task) => sum + (parseFloat(task[field]) || 0), 0);
  };

  const validateEngagementForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!engagementForm.engagementTitle.trim()) {
      errors.engagementTitle = t("Engagement Title is required") || "Engagement Title is required";
    } else if (!isValidName(engagementForm.engagementTitle.trim())) {
      errors.engagementTitle = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!engagementForm.engagementObjective.trim()) {
      errors.engagementObjective = t("Engagement Objective is required") || "Engagement Objective is required";
    }
    if (!engagementForm.engagementScope.trim()) {
      errors.engagementScope = t("Engagement Scope is required") || "Engagement Scope is required";
    }
    if (!engagementForm.auditCategoryId) {
      errors.auditCategoryId = t("Audit Category is required") || "Audit Category is required";
    }
    if (selectedDeptIds.length === 0) {
      errors.departmentId = t("At least one department must be selected") || "At least one department must be selected";
    }
    // Validate each department has at least one auditor
    for (const deptId of selectedDeptIds) {
      const config = deptConfigs[deptId];
      if (!config?.auditorIds?.length) {
        errors.auditorId = t("Auditor is required") + ` (${getDeptName(deptId)})`;
        break;
      }
    }
    if (!engagementForm.startDate) {
      errors.startDate = t("Start Date is required") || "Start Date is required";
    }
    if (!engagementForm.targetDate) {
      errors.targetDate = t("Target Date is required") || "Target Date is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveEngagement = async () => {
    if (!validateEngagementForm()) return;

    setSaving(true);
    try {
      const departmentsPayload = selectedDeptIds.map(deptId => ({
        departmentId: deptId,
        auditorIds: deptConfigs[deptId]?.auditorIds || [],
        auditeeIds: deptConfigs[deptId]?.auditeeIds || [],
        linkedRiskIds: deptConfigs[deptId]?.linkedRiskIds || [],
      }));

      const response = await fetch("/api/internal-audit/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...engagementForm,
          departments: departmentsPayload,
          tasks,
          plannedHours: calculateTotalHours("plannedHours"),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const engList = Array.isArray(result) ? result : [result];
        for (const eng of engList) {
          if (eng?.id) {
            triggerTranslation('AuditEngagement', eng.id, { engagementTitle: eng.engagementTitle, engagementObjective: eng.engagementObjective, engagementScope: eng.engagementScope, initialObservation: eng.initialObservation, relatedPolicies: eng.relatedPolicies });
          }
        }
        const count = engList.length;
        toast.success(count > 1 ? `${count} ${t("engagements created successfully")}` : t("Engagement created successfully"));
        setAddDialogOpen(false);
        resetFormState();
        fetchEngagements();
      } else {
        const error = await response.json();
        toast.error(error.error || t("Failed to create engagement"));
      }
    } catch (error) {
      console.error("Failed to create engagement:", error);
      toast.error(t("Failed to create engagement"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEngagement = async () => {
    if (!validateEngagementForm() || !editingEngagementId) return;

    setSaving(true);
    try {
      // Separate original department (PUT update) from new departments (POST create)
      const origDeptId = originalDeptId || selectedDeptIds[0];
      const origConfig = deptConfigs[origDeptId] || {};
      const newDeptIds = selectedDeptIds.filter(id => id !== origDeptId);

      // 1. Update the existing engagement with its (possibly changed) department
      const updateResponse = await fetch(`/api/internal-audit/engagements/${editingEngagementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...engagementForm,
          departmentId: origDeptId || "",
          auditorId: origConfig.auditorIds?.[0] || "",
          auditeeId: origConfig.auditeeIds?.[0] || "",
          linkedRiskIds: origConfig.linkedRiskIds || [],
          tasks,
          plannedHours: calculateTotalHours("plannedHours"),
        }),
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        toast.error(error.error || t("Failed to update engagement"));
        setSaving(false);
        return;
      }

      const savedEngagement = await updateResponse.json();
      triggerTranslation('AuditEngagement', savedEngagement.id, {
        engagementTitle: savedEngagement.engagementTitle,
        engagementObjective: savedEngagement.engagementObjective,
        engagementScope: savedEngagement.engagementScope,
        initialObservation: savedEngagement.initialObservation,
        relatedPolicies: savedEngagement.relatedPolicies,
      });

      // 2. Create new engagements for any newly added departments
      let newCount = 0;
      if (newDeptIds.length > 0) {
        const newDepartmentsPayload = newDeptIds.map(deptId => ({
          departmentId: deptId,
          auditorIds: deptConfigs[deptId]?.auditorIds || [],
          auditeeIds: deptConfigs[deptId]?.auditeeIds || [],
          linkedRiskIds: deptConfigs[deptId]?.linkedRiskIds || [],
        }));

        const createResponse = await fetch("/api/internal-audit/engagements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...engagementForm,
            parentAuditId: editingAuditId, // e.g. "AUD012" → new ones become AUD012.2, AUD012.3
            departments: newDepartmentsPayload,
            tasks,
            plannedHours: calculateTotalHours("plannedHours"),
          }),
        });

        if (createResponse.ok) {
          const created = await createResponse.json();
          const createdList = Array.isArray(created) ? created : [created];
          newCount = createdList.length;
          for (const eng of createdList) {
            if (eng?.id) {
              triggerTranslation('AuditEngagement', eng.id, {
                engagementTitle: engagementForm.engagementTitle,
                engagementObjective: engagementForm.engagementObjective,
                engagementScope: engagementForm.engagementScope,
                initialObservation: engagementForm.initialObservation,
                relatedPolicies: engagementForm.relatedPolicies,
              });
            }
          }
        } else {
          const error = await createResponse.json();
          toast.error(error.error || t("Failed to create engagement"));
        }
      }

      if (newCount > 0) {
        toast.success(`${t("Engagement updated successfully")} + ${newCount} ${t("engagements created successfully")}`);
      } else {
        toast.success(t("Engagement updated successfully"));
      }

      setEditDialogOpen(false);
      setEditingEngagementId(null);
      resetFormState();
      fetchEngagements();
    } catch (error) {
      console.error("Failed to update engagement:", error);
      toast.error(t("Failed to update engagement"));
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (item: Engagement) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/internal-audit/engagements/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(t("Engagement deleted successfully"));
        fetchEngagements();
      } else {
        toast.error(t("Failed to delete engagement"));
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error(t("Failed to delete engagement"));
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleExport = async () => {
    try {
      const headers = ["Audit ID", "Engagement Title", "Department", "Audit Type", "Assigned Auditors", "Status"];
      const rows = translatedEngagements.map(e => [
        e.auditId,
        e.engagementTitle,
        translatedDepartments.find(d => d.id === e.department?.id)?.name || e.department?.name || "",
        e.auditType || "",
        e.assignedAuditorId ? (translatedAuditors.find(u => u.id === e.assignedAuditorId)?.fullName || e.assignedAuditors.join("; ")) : e.assignedAuditors.join("; "),
        e.status
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-plan-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(t("Export completed"));
    } catch (error) {
      toast.error(t("Failed to export"));
    }
  };

  const openReportDialog = () => {
    setReportFilterType("");
    setReportYear("");
    setReportStartDate("");
    setReportEndDate("");
    setReportDialogOpen(true);
  };

  const handleShowReport = async () => {
    if (!reportFilterType) {
      toast.error(t("Please select a filter type"));
      return;
    }
    if (reportFilterType === "Year" && !reportYear) {
      toast.error(t("Please select a year"));
      return;
    }
    if (reportFilterType === "DateRange") {
      if (!reportStartDate) {
        toast.error(t("Please select a start date"));
        return;
      }
      if (!reportEndDate) {
        toast.error(t("Please select an end date"));
        return;
      }
      if (new Date(reportStartDate) > new Date(reportEndDate)) {
        toast.error(t("Start date cannot be after end date"));
        return;
      }
    }

    setReportDialogOpen(false);
    setLoadingStats(true);
    setReportPreviewOpen(true);

    // Fetch report stats
    try {
      let url = `/api/internal-audit/audit-plan/stats?`;
      if (reportFilterType === "DateRange") {
        url += `filterType=DateRange&startDate=${reportStartDate}&endDate=${reportEndDate}`;
      } else {
        url += `year=${reportYear}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setReportStats({ riskCount: data.riskCount, findingCount: data.findingCount, auditHeadName: data.auditHeadName || '' });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      let url = `/api/internal-audit/audit-plan/download?`;
      let filename = "";
      if (reportFilterType === "DateRange" && reportStartDate && reportEndDate) {
        url += `filterType=DateRange&startDate=${reportStartDate}&endDate=${reportEndDate}`;
        filename = `Annual_Audit_Plan_${reportStartDate}_to_${reportEndDate}.pdf`;
      } else {
        url += `year=${reportYear}`;
        filename = `Annual_Audit_Plan_${reportYear}.pdf`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
        toast.success(t("Report downloaded successfully"));
      } else {
        toast.error(t("Failed to download report"));
      }
    } catch (error) {
      console.error("Failed to download report:", error);
      toast.error(t("Failed to download report"));
    } finally {
      setDownloadingReport(false);
    }
  };

  // Render the engagement form content (shared between Add and Edit dialogs)
  const renderEngagementFormContent = () => (
    <div className="space-y-5">
      {/* Engagement Title */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t("Engagement Title")} <span className="text-red-500">*</span>
        </Label>
        <Input
          value={engagementForm.engagementTitle}
          onChange={(e) => setEngagementForm({ ...engagementForm, engagementTitle: e.target.value })}
          placeholder={t("Enter engagement title")}
          className={`w-full bg-white ${validationErrors.engagementTitle ? 'border-red-500' : ''}`}
        />
        {validationErrors.engagementTitle && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.engagementTitle}</p>
        )}
      </div>

      {/* Engagement Objective */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t("Engagement Objective")} <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={engagementForm.engagementObjective}
          onChange={(e) => setEngagementForm({ ...engagementForm, engagementObjective: e.target.value })}
          placeholder={t("Enter engagement objective")}
          rows={3}
          className={`w-full bg-white resize-none ${validationErrors.engagementObjective ? 'border-red-500' : ''}`}
        />
        {validationErrors.engagementObjective && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.engagementObjective}</p>
        )}
      </div>

      {/* Engagement Scope */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t("Engagement Scope")} <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={engagementForm.engagementScope}
          onChange={(e) => setEngagementForm({ ...engagementForm, engagementScope: e.target.value })}
          placeholder={t("Enter engagement scope")}
          rows={3}
          className={`w-full bg-white resize-none ${validationErrors.engagementScope ? 'border-red-500' : ''}`}
        />
        {validationErrors.engagementScope && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.engagementScope}</p>
        )}
      </div>

      {/* Audit Category */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t("Audit Category")} <span className="text-red-500">*</span>
        </Label>
        <Select
          value={engagementForm.auditCategoryId}
          onValueChange={(value) => setEngagementForm({ ...engagementForm, auditCategoryId: value })}
        >
          <SelectTrigger className={`w-full bg-white ${validationErrors.auditCategoryId ? 'border-red-500' : ''}`}>
            <SelectValue placeholder={t("Select Audit Category")} />
          </SelectTrigger>
          <SelectContent>
            {translatedAuditCategories.length > 0 ? (
              translatedAuditCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                {t("No audit categories configured")}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        {validationErrors.auditCategoryId && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.auditCategoryId}</p>
        )}
      </div>

      {/* Departments — Multi-select */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t("Select Departments")} <span className="text-red-500">*</span>
        </Label>
        <MultiSelect
          options={translatedDepartments.map(d => ({ value: d.id, label: d.name }))}
          selected={selectedDeptIds}
          onChange={handleDeptSelectionChange}
          placeholder={t("Select Departments")}
        />
        {selectedDeptIds.length > 0 && (
          <p className="text-xs text-slate-500">{selectedDeptIds.length} {t("departments selected")}</p>
        )}
        {validationErrors.departmentId && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.departmentId}</p>
        )}
      </div>

      {/* Per-Department Configuration Cards */}
      {selectedDeptIds.length > 0 && (
        <div className="space-y-3">
          {selectedDeptIds.map((deptId) => {
            const deptName = getDeptName(deptId);
            const config = deptConfigs[deptId] || { auditorIds: [], auditeeIds: [], linkedRiskIds: [] };
            const data = deptData[deptId] || { auditors: [], auditees: [], risks: [], loading: true };

            return (
              <div key={deptId} className="border border-slate-200 rounded-xl bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-800">{deptName}</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeDept(deptId)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {data.loading ? (
                  <div className="flex items-center gap-2 py-3 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    <span className="text-xs text-slate-500">{t("Loading...")}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">{t("Auditor")} <span className="text-red-500">*</span></Label>
                      <MultiSelect
                        options={data.auditors.map(u => ({ value: u.id, label: u.fullName }))}
                        selected={config.auditorIds}
                        onChange={(val) => updateDeptConfig(deptId, 'auditorIds', val)}
                        placeholder={t("Select Auditor")}
                      />
                      {data.auditors.length === 0 && <p className="text-xs text-amber-600">{t("No auditors found in this department")}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600">{t("Auditee")}</Label>
                      <MultiSelect
                        options={data.auditees.map(u => ({ value: u.id, label: u.fullName }))}
                        selected={config.auditeeIds}
                        onChange={(val) => updateDeptConfig(deptId, 'auditeeIds', val)}
                        placeholder={t("Select Auditee")}
                      />
                      {data.auditees.length === 0 && <p className="text-xs text-amber-600">{t("No auditees found in this department")}</p>}
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-medium text-slate-600">{t("Link Open Risks in this Department")}</Label>
                      <MultiSelect
                        options={data.risks.map(r => ({ value: r.id, label: `${r.riskId} - ${r.riskName}` }))}
                        selected={config.linkedRiskIds}
                        onChange={(val) => updateDeptConfig(deptId, 'linkedRiskIds', val)}
                        placeholder={t("Select Risk")}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {validationErrors.auditorId && (
        <p className="text-sm text-red-600">{validationErrors.auditorId}</p>
      )}

      {/* Process */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">{t("Process")}</Label>
        <Select
          value={engagementForm.processId}
          onValueChange={(value) => setEngagementForm({ ...engagementForm, processId: value })}
        >
          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder={t("Select Process")} />
          </SelectTrigger>
          <SelectContent>
            {translatedProcesses.length > 0 ? (
              translatedProcesses.map((process) => (
                <SelectItem key={process.id} value={process.id}>
                  {process.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                {t("No processes available")}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Two columns for Audit Rating and Audit Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">{t("Audit Rating")}</Label>
          <Select
            value={engagementForm.auditRating}
            onValueChange={(value) => setEngagementForm({ ...engagementForm, auditRating: value })}
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue placeholder={t("Select rating")} />
            </SelectTrigger>
            <SelectContent>
              {auditRatings.length > 0 ? (
                auditRatings.map((rating) => {
                  const translated = translatedAuditRatings.find(r => r.id === rating.id);
                  return (
                    <SelectItem key={rating.id} value={rating.label}>
                      {translated?.label || rating.label}
                    </SelectItem>
                  );
                })
              ) : (
                <SelectItem value="none" disabled>
                  {t("No ratings configured")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">{t("Audit Type")}</Label>
          <Select
            value={engagementForm.auditType}
            onValueChange={(value) => setEngagementForm({ ...engagementForm, auditType: value })}
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue placeholder={t("Select type")} />
            </SelectTrigger>
            <SelectContent>
              {auditTypes.length > 0 ? (
                auditTypes.map((type) => {
                  const translated = translatedAuditTypes.find(t => t.id === type.id);
                  return (
                    <SelectItem key={type.id} value={type.name}>
                      {translated?.name || type.name}
                    </SelectItem>
                  );
                })
              ) : (
                <SelectItem value="none" disabled>
                  {t("No audit types configured")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Auditor/Auditee now handled per-department above */}

      {/* Two columns for Start Date and Target Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">
            {t("Start Date")} <span className="text-red-500">*</span>
          </Label>
          <DatePicker
            value={engagementForm.startDate}
            onChange={(date) => setEngagementForm({ ...engagementForm, startDate: date ? formatLocalDate(date) : "" })}
            placeholder={t("Select start date")}
            className={`w-full h-10 bg-white ${validationErrors.startDate ? 'border-red-500' : ''}`}
          />
          {validationErrors.startDate && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.startDate}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">
            {t("Target Date")} <span className="text-red-500">*</span>
          </Label>
          <DatePicker
            value={engagementForm.targetDate}
            onChange={(date) => setEngagementForm({ ...engagementForm, targetDate: date ? formatLocalDate(date) : "" })}
            placeholder={t("Select target date")}
            className={`w-full h-10 bg-white ${validationErrors.targetDate ? 'border-red-500' : ''}`}
          />
          {validationErrors.targetDate && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.targetDate}</p>
          )}
        </div>
      </div>

      {/* Attach File */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">{t("Attach File")}</Label>
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragOverAttach ? "border-primary-500 bg-primary-50/50" : "border-slate-200 bg-slate-50/30 hover:bg-slate-50/60"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOverAttach(true); }}
          onDragLeave={() => setIsDragOverAttach(false)}
          onDrop={(e) => handleFileDrop(e, "attach")}
          onClick={() => attachFileRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 font-medium">{t("Drag and drop or select file.")}</p>
            <p className="text-xs text-slate-400">{t("Upload supporting documents")}</p>
          </div>
          <input
            ref={attachFileRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => handleFileSelect(e, "attach")}
          />
        </div>
        {attachedFiles.length > 0 && (
          <div className="space-y-2 mt-3">
            {attachedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => removeFile(file.id, "attach")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Workpaper */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">{t("Upload Workpaper")}</Label>
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragOverWorkpaper ? "border-primary-500 bg-primary-50/50" : "border-slate-200 bg-slate-50/30 hover:bg-slate-50/60"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOverWorkpaper(true); }}
          onDragLeave={() => setIsDragOverWorkpaper(false)}
          onDrop={(e) => handleFileDrop(e, "workpaper")}
          onClick={() => workpaperRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 font-medium">{t("Drag and drop or select file.")}</p>
            <p className="text-xs text-slate-400">{t("Upload audit workpapers")}</p>
          </div>
          <input
            ref={workpaperRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => handleFileSelect(e, "workpaper")}
          />
        </div>
        {workpaperFiles.length > 0 && (
          <div className="space-y-2 mt-3">
            {workpaperFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => removeFile(file.id, "workpaper")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Additional Details - Tabs */}
      <div>
        <Tabs defaultValue="observation" className="w-full">
          <TabsList className="w-full justify-start bg-white border-b border-slate-200 rounded-none h-auto p-0">
            <TabsTrigger value="observation" className="data-[state=active]:bg-white data-[state=active]:border-b-0.5 data-[state=active]:border-primary-600">
              {t("Observation")}
            </TabsTrigger>
            <TabsTrigger value="procedure" className="data-[state=active]:bg-white data-[state=active]:border-b-0.5 data-[state=active]:border-primary-600">
              {t("Testing Procedure")}
            </TabsTrigger>
            <TabsTrigger value="policies" className="data-[state=active]:bg-white data-[state=active]:border-b-0.5 data-[state=active]:border-primary-600">
              {t("Policies & Procedures")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="observation" className="mt-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Auditor's Initial Observation")}</Label>
              <Textarea
                value={engagementForm.initialObservation}
                onChange={(e) => setEngagementForm({ ...engagementForm, initialObservation: e.target.value })}
                rows={5}
                className="w-full bg-white resize-none border-slate-200 focus:border-primary-300 focus:ring-primary-200"
                placeholder={t("Enter initial observations from the auditor")}
              />
            </div>
          </TabsContent>

          <TabsContent value="procedure" className="mt-6">
            <div className="space-y-4">
              {/* Header Section */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t("Testing Procedure Tasks")}</p>
                  
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={openAddTaskDialog}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Add Task")}
                </Button>
              </div>

              {/* Tasks Table */}
              {tasks.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="text-center py-16">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                      <FileText className="h-6 w-6 text-primary-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 mb-1">{t("No tasks added yet")}</p>
                    <p className="text-xs text-slate-400">{t("Click 'Add Task' to begin")}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5 w-[50px]">#</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Task Description")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-[100px]">{t("Status")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-[90px]">{t("Planned")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-[90px]">{t("Actual")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Auditor")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5 w-[80px]">{t("Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task, index) => (
                        <TableRow key={task.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <TableCell className="py-3 ps-5 text-sm text-slate-400 font-medium">{index + 1}</TableCell>
                          <TableCell className="py-3">
                            <p className="text-sm text-slate-700 font-medium">{task.task || <span className="text-slate-400 italic">{t("No description")}</span>}</p>
                            {task.comments && (
                              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{task.comments}</p>
                            )}
                          </TableCell>
                          <TableCell className="py-3">
                            {task.done ? (
                              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">{t("Done")}</span>
                            ) : (
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{t("Pending")}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-3 text-sm text-slate-600 text-center">{task.plannedHours || "-"}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-600 text-center">{task.actualHours || "-"}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-600">
                            {translatedAuditors.find((a) => a.id === task.auditorId)?.fullName || <span className="text-slate-400">-</span>}
                          </TableCell>
                          <TableCell className="py-3 pe-5">
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-600"
                                onClick={() => openEditTaskDialog(task)}
                                title={t("Edit")}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                                onClick={() => removeTask(task.id)}
                                title={t("Delete")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Totals Footer */}
                  <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-600">{t("Total Hours")}</span>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{t("Planned")}:</span>
                        <span className="text-sm font-bold text-slate-800">{calculateTotalHours("plannedHours")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{t("Actual")}:</span>
                        <span className="text-sm font-bold text-slate-800">{calculateTotalHours("actualHours")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="policies" className="mt-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Related Policies / Procedures")}</Label>
              <Textarea
                value={engagementForm.relatedPolicies}
                onChange={(e) => setEngagementForm({ ...engagementForm, relatedPolicies: e.target.value })}
                rows={5}
                className="w-full bg-white resize-none border-slate-200 focus:border-primary-300 focus:ring-primary-200"
                placeholder={t("List relevant policies and procedures for this audit")}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );


  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Annual Audit Plan")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading...")}</p>
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
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </>
        )}
        <span className="text-primary-700 font-medium">{t("Audit Engagement")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Annual Audit Plan")}</h1>
        <div className="w-full sm:w-auto grid grid-cols-1 sm:flex sm:items-center sm:ltr:justify-end sm:rtl:justify-start gap-2">
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleExport}>
            <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Export")}
          </Button>
          <Button variant="outline" size="sm" className="w-full sm:w-auto border-primary-600 text-primary-600 hover:bg-primary-50" onClick={openReportDialog}>
            <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Generate Annual Plan Report")}
          </Button>
          {isAuditHead && (
            <Button size="sm" className="w-full sm:w-auto" onClick={openAddDialog}>
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Add Engagement")}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search By Audit ID, Name")}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Department")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Departments")}</SelectItem>
                {translatedDepartments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Status")}</SelectItem>
                <SelectItem value="Pending Approval">{t("Pending Approval")}</SelectItem>
                <SelectItem value="Planned">{t("Planned")}</SelectItem>
                <SelectItem value="In Progress">{t("In Progress")}</SelectItem>
                <SelectItem value="Completed">{t("Completed")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-full sm:w-[110px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Year")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Years")}</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5 whitespace-nowrap">{t("Audit ID")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Engagement Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Department")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Audit Type")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Assigned Auditors")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {translatedEngagements.map((engagement) => (
                <TableRow key={engagement.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 pl-5 text-sm font-medium text-slate-800">{engagement.auditId}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.engagementTitle}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{translatedDepartments.find(d => d.id === engagement.department?.id)?.name || engagement.department?.name || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{translatedAuditTypes.find(at => at.id === (engagement.auditTypeId || auditTypes.find(o => o.name === engagement.auditType)?.id))?.name || engagement.auditType || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">
                    {engagement.assignedAuditorId
                      ? (translatedAuditors.find(u => u.id === engagement.assignedAuditorId)?.fullName || engagement.assignedAuditors.join(", ") || "-")
                      : (engagement.assignedAuditors.length > 0 ? engagement.assignedAuditors.join(", ") : "-")}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{t(engagement.status)}</TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center ltr:justify-end rtl:justify-start gap-0.5">
                      <Link href={`/internal-audit/engagement/${engagement.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-slate-600 hover:text-slate-800"
                          title={t("Workflow")}
                        >
                          <Workflow className="h-4 w-4" />
                          {t("Workflow")}
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openEditDialog(engagement)}
                        title={t("Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(engagement)}
                        title={t("Delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {filteredPlannedAudits.map((p) => (
              <TableRow key={p.id} className="border-b border-slate-100 last:border-0">
                <TableCell className="py-3 pl-5 text-sm text-slate-400 whitespace-nowrap">—</TableCell>
                <TableCell className="py-3 text-sm text-slate-700">
                  {p.title}
                  <span className="ltr:ml-2 rtl:mr-2 text-xs text-slate-400 whitespace-nowrap">
                    {[p.planCode, p.year, p.plannedQuarter].filter(Boolean).join(" · ")}
                  </span>
                </TableCell>
                <TableCell className="py-3 text-sm text-slate-700">{translatedDepartments.find(d => d.id === p.departmentId)?.name || p.departmentName || "-"}</TableCell>
                <TableCell className="py-3 text-sm text-slate-700">{p.auditType || "-"}</TableCell>
                <TableCell className="py-3 text-sm text-slate-400">—</TableCell>
                <TableCell className="py-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{t("Pending Approval")}</span>
                </TableCell>
                <TableCell className="py-3 pr-5 text-sm text-slate-400">—</TableCell>
              </TableRow>
            ))}
            {translatedEngagements.length === 0 && filteredPlannedAudits.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                  {t("No audit engagements found")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Confirmation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this engagement?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Selection Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Generate Annual Plan Report")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                {t("Filter Type")} <span className="text-red-500">*</span>
              </Label>
              <Select value={reportFilterType} onValueChange={setReportFilterType}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder={t("Select filter type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Year">{t("Year")}</SelectItem>
                  <SelectItem value="DateRange">{t("Date Range")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportFilterType === "Year" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Year")} <span className="text-red-500">*</span>
                </Label>
                <Select value={reportYear} onValueChange={setReportYear}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("Select year")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportFilterType === "DateRange" && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Start Date")} <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={reportStartDate}
                    onChange={(date) => setReportStartDate(date ? formatLocalDate(date) : "")}
                    placeholder={t("Select start date")}
                    className="w-full h-10 bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("End Date")} <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={reportEndDate}
                    onChange={(date) => setReportEndDate(date ? formatLocalDate(date) : "")}
                    placeholder={t("Select end date")}
                    className="w-full h-10 bg-white"
                  />
                </div>
              </>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleShowReport} className="bg-primary-600 hover:bg-primary-700">
              {t("Show Report")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Engagement Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Add Engagement")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            {dialogLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : (
              renderEngagementFormContent()
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleSaveEngagement}
              disabled={saving || dialogLoading}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Engagement Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Edit Audit Plan")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            {dialogLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : (
              renderEngagementFormContent()
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditingEngagementId(null); }}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleUpdateEngagement}
              disabled={saving || dialogLoading}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {saving ? t("Saving...") : t("Update")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">
                {editingTaskId ? t("Edit Task") : t("Add Task")}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-4 sm:px-6 py-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Task Description")} <span className="text-red-500">*</span></Label>
              <Input
                value={taskForm.task}
                onChange={(e) => setTaskForm({ ...taskForm, task: e.target.value })}
                placeholder={t("Enter task description")}
                className="w-full bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Planned Hours")}</Label>
                <Input
                  type="number"
                  value={taskForm.plannedHours}
                  onChange={(e) => setTaskForm({ ...taskForm, plannedHours: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.5"
                  className="w-full bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">{t("Actual Hours")}</Label>
                <Input
                  type="number"
                  value={taskForm.actualHours}
                  onChange={(e) => setTaskForm({ ...taskForm, actualHours: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.5"
                  className="w-full bg-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Assigned Auditor")}</Label>
              <Select
                value={taskForm.auditorId}
                onValueChange={(value) => setTaskForm({ ...taskForm, auditorId: value })}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder={t("Select auditor")} />
                </SelectTrigger>
                <SelectContent>
                  {translatedAuditors.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
              <div className="flex items-center gap-2 h-10 px-3 border border-slate-200 rounded-md bg-white">
                <Checkbox
                  checked={taskForm.done}
                  onCheckedChange={(checked) => setTaskForm({ ...taskForm, done: !!checked })}
                  id="task-dialog-done"
                />
                <label htmlFor="task-dialog-done" className="text-sm cursor-pointer select-none">
                  {taskForm.done ? (
                    <span className="text-green-600 font-medium">{t("Done")}</span>
                  ) : (
                    <span className="text-slate-500">{t("Pending")}</span>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Comments")}</Label>
              <Textarea
                value={taskForm.comments}
                onChange={(e) => setTaskForm({ ...taskForm, comments: e.target.value })}
                placeholder={t("Add notes or comments for this task")}
                rows={3}
                className="w-full bg-white resize-none"
              />
            </div>
          </div>

          <div className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleSaveTask}
              disabled={!taskForm.task.trim()}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {editingTaskId ? t("Save Changes") : t("Add Task")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Preview Modal */}
      <Dialog open={reportPreviewOpen} onOpenChange={setReportPreviewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Annual Audit Plan Report")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            <div className="space-y-6">
              {/* Document Metadata */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-2">
                  <span className="font-semibold text-slate-700">{t("Document Type")} :</span>
                  <span className="text-primary-600">{t("Annual plan report")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-2">
                  <span className="font-semibold text-slate-700">{t("Document Reference")} :</span>
                  <span className="text-primary-600">
                    {reportFilterType === "DateRange" && reportStartDate && reportEndDate
                      ? `MOF-IAD-${reportStartDate}-${reportEndDate}`
                      : `MOF-IAD-${reportYear}`}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-2">
                  <span className="font-semibold text-slate-700">{t("Responsible Department")} :</span>
                  <span className="text-slate-700">{t("Internal Audit Department")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-2">
                  <span className="font-semibold text-slate-700">{t("Document Description")} :</span>
                  <span className="text-slate-700">{t("This document includes the objectives and scope of the engagement, the audit team, completion timeline, execution phases, and reporting procedures.")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-2">
                  <span className="font-semibold text-slate-700">{t("Purpose")} :</span>
                  <span className="text-slate-700">{t("To use the form for documenting the planning of the internal audit engagement.")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-2">
                  <span className="font-semibold text-slate-700">{t("Scope of Application")} :</span>
                  <span className="text-slate-700">{t("Internal Audit Department")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-2">
                  <span className="font-semibold text-slate-700">{t("Related Policies")} :</span>
                  <div className="text-slate-700">
                    <p>• {t("Internal Audit Charter")}</p>
                    <p>• {t("Internal Audit Methodology")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-2">
                  <span className="font-semibold text-slate-700">{t("Related Procedures")} :</span>
                  <span className="text-slate-700">{t("None")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-2">
                  <span className="font-semibold text-slate-700">{t("Reference Documents")} :</span>
                  <div className="text-slate-700">
                    <p>• {t("International Standards for the Professional Practice of Internal Auditing (IIA)")}</p>
                    <p>• {t("Supplementary Guidance issued by the Institute of Internal Auditors (IIA)")}</p>
                  </div>
                </div>
              </div>

              {/* Engagement Overview */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900">{t("Engagement Overview")}</h3>
                <p className="text-slate-700">
                  {t("The independent review of the internal controls established by the department, assessing their adequacy and effectiveness against the objectives they aim to achieve, and ensuring compliance with laws, regulations, policies, and procedures related to the relevant control systems, etc")}
                </p>
                <ul className="list-disc list-inside text-slate-700 space-y-1">
                  <li>{t("Independent review of the internal control system and its adequacy and effectiveness.")}</li>
                  <li>{t("Verify compliance with laws, regulations, policies, and procedures.")}</li>
                  <li>{t("Review the procedures and policies implemented in the department.")}</li>
                  <li>{t("Follow up on the implementation of previous internal audit recommendations.")}</li>
                </ul>
              </div>

              {/* Audit Scope */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900">{t("Audit Scope")}</h3>
                <p className="text-slate-700">{t("Financial year")} {reportFilterType === "DateRange" && reportStartDate ? reportStartDate.split("-")[0] : reportYear}</p>
              </div>

              {/* Initial Risks */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900">{t("Initial Risks and Observations from Preliminary Document Review")}</h3>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700 w-40">{t("Count of Risk")}:</span>
                    <span className="text-primary-600 font-medium">
                      {loadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : reportStats.riskCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700 w-40">{t("Count of Findings")}:</span>
                    <span className="text-primary-600 font-medium">
                      {loadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : reportStats.findingCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Audit Procedures and Tests */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900">{t("Audit Procedures and Tests")}</h3>
                <p className="text-slate-700">{t("The team shall adhere to the following")}:</p>
                <ol className="list-decimal list-inside text-slate-700 space-y-1">
                  <li>{t("Prepare and update the audit program and comply with it")}</li>
                  <li>{t("Use audit methods such as data analysis, document review, and sampling audit")}</li>
                  <li>{t("Follow up on previous audit results")}</li>
                </ol>
              </div>

              {/* Approvals */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900">{t("Approvals")}</h3>
                <div className="space-y-1">
                  <p className="text-slate-700">{t("Job Title")} : {t("Audit Head")}</p>
                  <p className="text-slate-700">
                    {t("Name")} : {loadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : (reportStats.auditHeadName || '-')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setReportPreviewOpen(false)}>
              {t("Close")}
            </Button>
            <Button
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {downloadingReport ? (
                <>
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                  {t("Downloading...")}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Download Report")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
